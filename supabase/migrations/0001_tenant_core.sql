-- =====================================================================
-- 0001_tenant_core — multi-tenant SaaS core (M1). ADDITIVE: legacy tables
-- (profiles, clinic_snapshots, subscription_events) are untouched.
--
-- Model: every tenant-owned row carries tenant_id (cryptographically random
-- uuid). Tenant context ALWAYS derives from auth.uid() -> memberships.
-- Request-supplied tenant ids are never trusted (RLS re-checks on every row).
-- Apply after supabase/schema.sql. Order matters: tables -> helpers ->
-- triggers -> policies (Postgres validates SQL-function/policy bodies at
-- creation). Reversible: see ROLLBACK block at bottom.
-- =====================================================================
create extension if not exists pgcrypto;

-- ================= 1. TABLES =================
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  status text not null default 'active',          -- active|suspended|closed
  plan text not null default 'trial',             -- trial|solo|clinic|nicu|hospital|enterprise
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists memberships (
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'readonly',  -- owner|admin|doctor|nurse|pharmacist|lab|mrd|billing|auditor|readonly
  status text not null default 'active',  -- active|suspended
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create table if not exists tenant_settings (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  display_name text not null default '',
  logo_url text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  currency text not null default 'INR',
  mrn_prefix text not null default '',
  registration_no text not null default '',
  modules jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  mrn text not null,
  name text not null default '',
  dob date,
  sex text not null default 'unknown',      -- male|female|other|unknown
  ga_at_birth_weeks numeric(4,1),
  birth_weight_g int check (birth_weight_g is null or (birth_weight_g between 300 and 8000)),
  guardian jsonb not null default '{}',
  allergies jsonb not null default '[]',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, mrn),
  unique (tenant_id, id)
);
create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  kind text not null default 'opd',          -- opd|emergency|admission|nicu|picu|followup
  status text not null default 'open',       -- open|closed|cancelled
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, patient_id) references patients (tenant_id, id) on delete cascade
);
create table if not exists audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  record_table text not null default '',
  record_id text not null default '',
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table tenants enable row level security;
alter table memberships enable row level security;
alter table tenant_settings enable row level security;
alter table patients enable row level security;
alter table encounters enable row level security;
alter table audit_events enable row level security;
create index if not exists idx_audit_tenant_time on audit_events (tenant_id, created_at desc);

-- ================= 2. HELPERS (SECURITY DEFINER, fixed search_path) =================
create or replace function public.my_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships
  where user_id = auth.uid() and status = 'active'
$$;
create or replace function public.my_tenant_role(p_tenant uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships
  where tenant_id = p_tenant and user_id = auth.uid() and status = 'active'
  limit 1
$$;

-- ================= 3. TRIGGERS =================
create or replace function public.trg_tenant_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (tenant_id, user_id, role, status)
  values (new.id, auth.uid(), 'owner', 'active') on conflict do nothing;
  return new;
end; $$;
drop trigger if exists trg_tenant_owner on tenants;
create trigger trg_tenant_owner after insert on tenants
  for each row execute function public.trg_tenant_owner();

-- Stamp server-side authorship BEFORE insert. This also fixes INSERT...RETURNING:
-- STABLE policy helpers use the statement snapshot, which does NOT see the
-- membership row the AFTER trigger just wrote — so t_sel must additionally
-- trust created_by (which the trigger below makes unspoofable).
create or replace function public.trg_stamp_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.created_by := auth.uid(); return new; end; $$;
drop trigger if exists trg_stamp_tenants on tenants;
create trigger trg_stamp_tenants before insert on tenants
  for each row execute function public.trg_stamp_creator();
drop trigger if exists trg_stamp_patients on patients;
create trigger trg_stamp_patients before insert on patients
  for each row execute function public.trg_stamp_creator();
drop trigger if exists trg_stamp_encounters on encounters;
create trigger trg_stamp_encounters before insert on encounters
  for each row execute function public.trg_stamp_creator();

create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner') or
     (tg_op = 'UPDATE' and old.role = 'owner' and (new.role <> 'owner' or new.status <> 'active')) then
    select count(*) into n from public.memberships
    where tenant_id = old.tenant_id and role = 'owner' and status = 'active' and user_id <> old.user_id;
    if n = 0 then raise exception 'cannot remove the last owner of a tenant'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists guard_last_owner on memberships;
create trigger guard_last_owner before delete or update on memberships
  for each row execute function public.guard_last_owner();

create or replace function public.touch_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists touch_patients on patients;
create trigger touch_patients before update on patients for each row execute function public.touch_updated();

-- ================= 4. POLICIES =================
-- tenants: members read; any signed-in user may create (becomes owner); owner/admin update; no delete.
drop policy if exists "t_sel" on tenants;
create policy "t_sel" on tenants for select
  using (id in (select public.my_tenant_ids()) or created_by = auth.uid());
drop policy if exists "t_ins" on tenants;
create policy "t_ins" on tenants for insert with check (auth.uid() is not null);
drop policy if exists "t_upd" on tenants;
create policy "t_upd" on tenants for update
  using (public.my_tenant_role(id) in ('owner','admin'))
  with check (public.my_tenant_role(id) in ('owner','admin'));

-- memberships: read own + admins read all of their tenant; owner/admin manage.
drop policy if exists "m_sel_own" on memberships;
create policy "m_sel_own" on memberships for select using (user_id = auth.uid());
drop policy if exists "m_sel_admin" on memberships;
create policy "m_sel_admin" on memberships for select
  using (public.my_tenant_role(tenant_id) in ('owner','admin'));
drop policy if exists "m_ins" on memberships;
create policy "m_ins" on memberships for insert
  with check (public.my_tenant_role(tenant_id) in ('owner','admin'));
drop policy if exists "m_upd" on memberships;
create policy "m_upd" on memberships for update
  using (public.my_tenant_role(tenant_id) in ('owner','admin'))
  with check (public.my_tenant_role(tenant_id) in ('owner','admin'));
drop policy if exists "m_del" on memberships;
create policy "m_del" on memberships for delete
  using (public.my_tenant_role(tenant_id) in ('owner','admin'));

-- tenant_settings: members read; owner/admin write.
drop policy if exists "s_sel" on tenant_settings;
create policy "s_sel" on tenant_settings for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "s_ins" on tenant_settings;
create policy "s_ins" on tenant_settings for insert
  with check (public.my_tenant_role(tenant_id) in ('owner','admin'));
drop policy if exists "s_upd" on tenant_settings;
create policy "s_upd" on tenant_settings for update
  using (public.my_tenant_role(tenant_id) in ('owner','admin'))
  with check (public.my_tenant_role(tenant_id) in ('owner','admin'));

-- patients & encounters: members full CRUD-read/write; delete owner/admin only.
drop policy if exists "p_sel" on patients;
create policy "p_sel" on patients for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "p_ins" on patients;
create policy "p_ins" on patients for insert with check (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "p_upd" on patients;
create policy "p_upd" on patients for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "p_del" on patients;
create policy "p_del" on patients for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));
drop policy if exists "e_sel" on encounters;
create policy "e_sel" on encounters for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "e_ins" on encounters;
create policy "e_ins" on encounters for insert with check (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "e_upd" on encounters;
create policy "e_upd" on encounters for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "e_del" on encounters;
create policy "e_del" on encounters for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));

-- audit_events: members append own actions only; owner/admin/auditor read; NEVER update/delete.
drop policy if exists "a_ins" on audit_events;
create policy "a_ins" on audit_events for insert
  with check (tenant_id in (select public.my_tenant_ids()) and actor_id = auth.uid());
drop policy if exists "a_sel" on audit_events;
create policy "a_sel" on audit_events for select
  using (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','auditor'));

-- ================= 5. LEGACY LINK + STORAGE =================
alter table if exists profiles add column if not exists default_tenant uuid references tenants (id);

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('clinic-docs', 'clinic-docs', false)
    on conflict (id) do nothing;
  end if;
end; $$;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "d_all" on storage.objects;
    create policy "d_all" on storage.objects for all
      using (bucket_id = 'clinic-docs'
        and (storage.foldername(name))[1] in (select public.my_tenant_ids()::text))
      with check (bucket_id = 'clinic-docs'
        and (storage.foldername(name))[1] in (select public.my_tenant_ids()::text));
  end if;
end; $$;

-- ================= ROLLBACK (M1) =================
-- drop policy if exists "d_all" on storage.objects;
-- drop table if exists audit_events, encounters, patients, tenant_settings, memberships, tenants cascade;
-- drop function if exists public.my_tenant_ids(), public.my_tenant_role(uuid),
--   public.trg_tenant_owner(), public.guard_last_owner(), public.touch_updated();
-- alter table if exists profiles drop column if exists default_tenant;
