-- =====================================================================
-- 0002_platform — M3 core platform. ADDITIVE except policy tightening
-- (all policy changes keep prior behavior for active tenants).
-- Adds: invites + accept_invite(), plan quotas (server-enforced), tenant
-- lifecycle (active|grace|suspended|closed) with read-only + owner-export
-- guarantees, break-glass log, DPDP consents, retention/legal-hold.
-- NEVER locks owners out of reads: billing failure -> read-only, never deletion.
-- =====================================================================

-- ================= 1. TENANT LIFECYCLE =================
alter table tenants add column if not exists grace_until timestamptz;
alter table tenants add column if not exists read_until timestamptz;
alter table tenants add column if not exists suspended_at timestamptz;

create or replace function public.tenant_plan(p_tenant uuid)
returns text language sql stable security definer set search_path = public as $$
  select plan from public.tenants where id = p_tenant
$$;
create or replace function public.tenant_write_ok(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenants t where t.id = p_tenant
    and (t.status = 'active'
      or (t.status = 'grace' and t.grace_until is not null and t.grace_until > now())));
$$;
create or replace function public.tenant_read_ok(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenants t where t.id = p_tenant
    and (t.status in ('active', 'grace')
      or (t.status = 'suspended' and (t.read_until is null or t.read_until > now()))));
$$;
create or replace function public.my_email()
returns text language sql stable security definer set search_path = public as $$
  select email from auth.users where id = auth.uid()
$$;

-- ================= 2. QUOTAS (NULL = unlimited) =================
create or replace function public.plan_quota(p_plan text, p_key text)
returns bigint language sql immutable security definer set search_path = public as $$
  select case p_key
    when 'users' then case p_plan
      when 'trial' then 3 when 'solo' then 1 when 'clinic' then 5
      when 'nicu' then 15 when 'hospital' then 50 else null end
    when 'patients' then case p_plan
      when 'trial' then 200 when 'solo' then 500 when 'clinic' then 5000
      when 'nicu' then 20000 when 'hospital' then 100000 else null end
  end
$$;
create or replace function public.tenant_user_count(p_tenant uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.memberships where tenant_id = p_tenant and status = 'active'
$$;
create or replace function public.tenant_patient_count(p_tenant uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.patients where tenant_id = p_tenant
$$;

-- ================= 3. RETENTION COLUMNS =================
alter table patients add column if not exists legal_hold boolean not null default false;
alter table patients add column if not exists retain_until date;
alter table encounters add column if not exists legal_hold boolean not null default false;

-- ================= 4. TIGHTENED POLICIES =================
-- patients: writes need active/grace + quota; reads need readable tenant (owner/admin always).
drop policy if exists "p_sel" on patients;
create policy "p_sel" on patients for select using (
  tenant_id in (select public.my_tenant_ids())
  and (public.tenant_read_ok(tenant_id) or public.my_tenant_role(tenant_id) in ('owner', 'admin')));
drop policy if exists "p_ins" on patients;
create policy "p_ins" on patients for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.tenant_write_ok(tenant_id)
  and (public.plan_quota(public.tenant_plan(tenant_id), 'patients') is null
    or public.tenant_patient_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'patients')));
drop policy if exists "p_upd" on patients;
create policy "p_upd" on patients for update
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id));
drop policy if exists "p_del" on patients;
create policy "p_del" on patients for delete using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin')
  and public.tenant_write_ok(tenant_id) and legal_hold is not true);

-- encounters: same gating, no quota.
drop policy if exists "e_sel" on encounters;
create policy "e_sel" on encounters for select using (
  tenant_id in (select public.my_tenant_ids())
  and (public.tenant_read_ok(tenant_id) or public.my_tenant_role(tenant_id) in ('owner', 'admin')));
drop policy if exists "e_ins" on encounters;
create policy "e_ins" on encounters for insert with check (
  tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id));
drop policy if exists "e_upd" on encounters;
create policy "e_upd" on encounters for update
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id));
drop policy if exists "e_del" on encounters;
create policy "e_del" on encounters for delete using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin')
  and public.tenant_write_ok(tenant_id) and legal_hold is not true);

-- memberships: adding members needs active/grace + user quota.
drop policy if exists "m_ins" on memberships;
create policy "m_ins" on memberships for insert with check (
  public.my_tenant_role(tenant_id) in ('owner', 'admin')
  and public.tenant_write_ok(tenant_id)
  and (public.plan_quota(public.tenant_plan(tenant_id), 'users') is null
    or public.tenant_user_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'users')));

-- settings: writes need active/grace; reads need readable tenant (owner/admin always).
drop policy if exists "s_sel" on tenant_settings;
create policy "s_sel" on tenant_settings for select using (
  tenant_id in (select public.my_tenant_ids())
  and (public.tenant_read_ok(tenant_id) or public.my_tenant_role(tenant_id) in ('owner', 'admin')));
drop policy if exists "s_ins" on tenant_settings;
create policy "s_ins" on tenant_settings for insert with check (
  public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id));
drop policy if exists "s_upd" on tenant_settings;
create policy "s_upd" on tenant_settings for update
  using (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id))
  with check (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id));
-- tenants/memberships-read/audit policies unchanged (owners must always see
-- status, roster, and audit — including during suspension).

-- ================= 5. INVITES =================
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  email text not null,
  role text not null default 'readonly',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid,
  accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
drop policy if exists "i_sel" on invites;
create policy "i_sel" on invites for select using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin') or email = public.my_email());
drop policy if exists "i_ins" on invites;
create policy "i_ins" on invites for insert with check (
  public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id));
drop policy if exists "i_del" on invites;
create policy "i_del" on invites for delete using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin'));
-- no UPDATE: acceptance runs through accept_invite() only.

create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.invites where token = p_token;
  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.accepted_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  if lower(inv.email) <> lower(public.my_email()) then raise exception 'invite is for a different email'; end if;
  if not public.tenant_write_ok(inv.tenant_id) then raise exception 'tenant cannot accept members right now'; end if;
  if public.plan_quota(public.tenant_plan(inv.tenant_id), 'users') is not null
     and public.tenant_user_count(inv.tenant_id) >= public.plan_quota(public.tenant_plan(inv.tenant_id), 'users') then
    raise exception 'tenant user limit reached';
  end if;
  insert into public.memberships (tenant_id, user_id, role, status)
  values (inv.tenant_id, auth.uid(), inv.role, 'active')
  on conflict (tenant_id, user_id) do update set role = excluded.role, status = 'active';
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.tenant_id;
end; $$;

-- ================= 6. BREAK-GLASS (emergency access log) =================
create table if not exists break_glass_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id) on delete cascade,
  actor_id uuid not null,
  reason text not null check (char_length(reason) >= 8),
  scope text not null default 'subscription-gate',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);
alter table break_glass_events enable row level security;
drop policy if exists "b_ins" on break_glass_events;
-- DELIBERATE: no tenant_write_ok — emergencies (incl. suspension) must be loggable.
create policy "b_ins" on break_glass_events for insert with check (
  tenant_id in (select public.my_tenant_ids()) and actor_id = auth.uid());
drop policy if exists "b_sel" on break_glass_events;
create policy "b_sel" on break_glass_events for select using (
  tenant_id in (select public.my_tenant_ids())
  and (actor_id = auth.uid() or public.my_tenant_role(tenant_id) in ('owner', 'admin', 'auditor')));
-- no update/delete: append-only.

-- ================= 7. CONSENTS (DPDP baseline) =================
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  patient_id uuid not null,
  purpose text not null,                 -- care|billing|research|marketing|sharing
  status text not null default 'granted', -- granted|withdrawn|expired
  granted_by text not null default '',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  withdrawn_at timestamptz,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, patient_id) references patients (tenant_id, id) on delete cascade
);
alter table consents enable row level security;
drop policy if exists "c_sel" on consents;
create policy "c_sel" on consents for select using (
  tenant_id in (select public.my_tenant_ids())
  and (public.tenant_read_ok(tenant_id) or public.my_tenant_role(tenant_id) in ('owner', 'admin')));
drop policy if exists "c_ins" on consents;
create policy "c_ins" on consents for insert with check (
  tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id));
drop policy if exists "c_upd" on consents;
create policy "c_upd" on consents for update   -- withdraw/expire via status change
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id));
-- no DELETE: consent history is a legal record — withdraw, don't erase.

-- ================= ROLLBACK (M3) =================
-- drop table if exists consents, break_glass_events, invites cascade;
-- drop function if exists public.accept_invite(text), public.my_email(),
--   public.tenant_write_ok(uuid), public.tenant_read_ok(uuid),
--   public.tenant_plan(uuid), public.plan_quota(text, text),
--   public.tenant_user_count(uuid), public.tenant_patient_count(uuid);
-- alter table if exists tenants drop column if exists grace_until,
--   drop column if exists read_until, drop column if exists suspended_at;
-- alter table if exists patients drop column if exists legal_hold,
--   drop column if exists retain_until;
-- alter table if exists encounters drop column if exists legal_hold;
-- (0001 policies must then be re-applied from 0001 file to restore M1 behavior.)
