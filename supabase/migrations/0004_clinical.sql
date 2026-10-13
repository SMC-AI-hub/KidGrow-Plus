-- =====================================================================
-- 0004_clinical — M5 clinical modules (NICU longitudinal, eMAR, growth).
-- Four tenant-scoped tables + one generic idempotent applier with per-table
-- clinical validation. Sync path is apply_clinical_op(); direct writes are
-- additionally role- and write-gated (stricter than the M1 tables — see
-- RISK-REGISTER: tightening the M1 policies is M6 governance scope).
-- LWW semantics mirror 0003: returns 'inserted' | 'updated' | 'stale'.
-- Rollback: drop function, drop 4 tables (order below), delete file.
-- =====================================================================

create table if not exists nicu_admissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  local_id text not null,
  patient_local_id text not null,
  client_rev timestamptz,
  admitted_at timestamptz,
  birth_weight_g int check (birth_weight_g is null or (birth_weight_g between 300 and 8000)),
  ga_weeks numeric(4,1) check (ga_weeks is null or (ga_weeks between 22 and 45)),
  status text not null default 'admitted'
    check (status in ('admitted', 'discharged', 'transferred', 'expired')),
  indication text not null default '',
  discharged_at timestamptz,
  outcome text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, local_id)
);
create table if not exists nicu_rounds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  local_id text not null,
  admission_local_id text not null,
  client_rev timestamptz,
  round_date date,
  weight_g int check (weight_g is null or (weight_g between 300 and 15000)),
  vitals jsonb not null default '{}',
  feeds jsonb not null default '{}',
  events jsonb not null default '[]',
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, local_id)
);
create table if not exists mar_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  local_id text not null,
  patient_local_id text not null,
  client_rev timestamptz,
  drug text not null default '',
  dose text not null default '',
  route text not null default '',
  freq text not null default '',
  controlled boolean not null default false,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'given', 'held', 'refused', 'missed')),
  scheduled_at timestamptz,
  given_at timestamptz,
  given_by text not null default '',
  witness text not null default '',
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, local_id),
  check (controlled = false or witness <> '')
);
create table if not exists growth_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  local_id text not null,
  patient_local_id text not null,
  client_rev timestamptz,
  measured_at timestamptz,
  wt_kg numeric(6,2) check (wt_kg is null or (wt_kg between 0.2 and 200)),
  len_cm numeric(6,1) check (len_cm is null or (len_cm between 20 and 250)),
  hc_cm numeric(5,1) check (hc_cm is null or (hc_cm between 10 and 80)),
  muac_cm numeric(4,1) check (muac_cm is null or (muac_cm between 5 and 60)),
  source text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, local_id)
);

alter table nicu_admissions enable row level security;
alter table nicu_rounds enable row level security;
alter table mar_entries enable row level security;
alter table growth_points enable row level security;

drop policy if exists "na_sel" on nicu_admissions;
create policy "na_sel" on nicu_admissions for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "na_ins" on nicu_admissions;
create policy "na_ins" on nicu_admissions for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "na_upd" on nicu_admissions;
create policy "na_upd" on nicu_admissions for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "na_del" on nicu_admissions;
create policy "na_del" on nicu_admissions for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));

drop policy if exists "nr_sel" on nicu_rounds;
create policy "nr_sel" on nicu_rounds for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "nr_ins" on nicu_rounds;
create policy "nr_ins" on nicu_rounds for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "nr_upd" on nicu_rounds;
create policy "nr_upd" on nicu_rounds for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "nr_del" on nicu_rounds;
create policy "nr_del" on nicu_rounds for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));

drop policy if exists "mar_sel" on mar_entries;
create policy "mar_sel" on mar_entries for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "mar_ins" on mar_entries;
create policy "mar_ins" on mar_entries for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "mar_upd" on mar_entries;
create policy "mar_upd" on mar_entries for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "mar_del" on mar_entries;
create policy "mar_del" on mar_entries for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));

drop policy if exists "gp_sel" on growth_points;
create policy "gp_sel" on growth_points for select using (tenant_id in (select public.my_tenant_ids()));
drop policy if exists "gp_ins" on growth_points;
create policy "gp_ins" on growth_points for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "gp_upd" on growth_points;
create policy "gp_upd" on growth_points for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "gp_del" on growth_points;
create policy "gp_del" on growth_points for delete using (public.my_tenant_role(tenant_id) in ('owner','admin'));

-- Generic clinical applier: membership + write-gate via sync_guard, per-table
-- clinical validation, LWW on client_rev. Raises 42501 on guard failure and
-- plain exceptions on invalid clinical data (message vocabulary mirrors 0003).
create or replace function public.apply_clinical_op(p_table text, p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid := (p_row ->> 'tenant_id')::uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz := (p_row ->> 'client_rev')::timestamptz;
  cur record;
  st text;
  wt numeric; ln numeric; hc numeric; mu numeric;
  madm timestamptz; mgiv timestamptz; mmeas timestamptz;
begin
  if p_table not in ('nicu_admissions', 'nicu_rounds', 'mar_entries', 'growth_points') then
    raise exception 'unknown clinical table: %', p_table;
  end if;
  perform public.sync_guard(t);
  if lid is null or lid = '' then raise exception 'local_id required'; end if;
  if rev is null then raise exception 'client_rev required'; end if;

  if p_table = 'nicu_admissions' then
    if not exists (select 1 from public.patients
        where tenant_id = t and local_id = p_row ->> 'patient_local_id' and deleted_at is null) then
      raise exception 'unknown patient';
    end if;
    st := coalesce(p_row ->> 'status', 'admitted');
    if st not in ('admitted', 'discharged', 'transferred', 'expired') then raise exception 'invalid status'; end if;
    madm := (p_row ->> 'admitted_at')::timestamptz;
    if madm is not null and madm > now() then raise exception 'admitted_at cannot be in the future'; end if;
    select * into cur from public.nicu_admissions where tenant_id = t and local_id = lid;
    if cur.id is null then
      insert into public.nicu_admissions (tenant_id, local_id, patient_local_id, client_rev,
          admitted_at, birth_weight_g, ga_weeks, status, indication, discharged_at, outcome,
          deleted_at, created_by)
      values (t, lid, p_row ->> 'patient_local_id', rev, madm,
          (p_row ->> 'birth_weight_g')::int, (p_row ->> 'ga_weeks')::numeric, st,
          coalesce(p_row ->> 'indication', ''), (p_row ->> 'discharged_at')::timestamptz,
          coalesce(p_row ->> 'outcome', ''),
          case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
      return 'inserted';
    end if;
    if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
    update public.nicu_admissions set patient_local_id = p_row ->> 'patient_local_id',
        client_rev = rev, admitted_at = madm,
        birth_weight_g = (p_row ->> 'birth_weight_g')::int,
        ga_weeks = (p_row ->> 'ga_weeks')::numeric, status = st,
        indication = coalesce(p_row ->> 'indication', ''),
        discharged_at = (p_row ->> 'discharged_at')::timestamptz,
        outcome = coalesce(p_row ->> 'outcome', ''),
        deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
      where id = cur.id;
    return 'updated';
  end if;

  if p_table = 'nicu_rounds' then
    if not exists (select 1 from public.nicu_admissions
        where tenant_id = t and local_id = p_row ->> 'admission_local_id' and deleted_at is null) then
      raise exception 'unknown admission';
    end if;
    if (p_row ->> 'round_date') is not null and (p_row ->> 'round_date')::date > current_date then
      raise exception 'round_date cannot be in the future';
    end if;
    select * into cur from public.nicu_rounds where tenant_id = t and local_id = lid;
    if cur.id is null then
      insert into public.nicu_rounds (tenant_id, local_id, admission_local_id, client_rev,
          round_date, weight_g, vitals, feeds, events, note, deleted_at, created_by)
      values (t, lid, p_row ->> 'admission_local_id', rev,
          (p_row ->> 'round_date')::date, (p_row ->> 'weight_g')::int,
          coalesce((p_row -> 'vitals')::jsonb, '{}'), coalesce((p_row -> 'feeds')::jsonb, '{}'),
          coalesce((p_row -> 'events')::jsonb, '[]'), coalesce(p_row ->> 'note', ''),
          case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
      return 'inserted';
    end if;
    if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
    update public.nicu_rounds set admission_local_id = p_row ->> 'admission_local_id',
        client_rev = rev, round_date = (p_row ->> 'round_date')::date,
        weight_g = (p_row ->> 'weight_g')::int,
        vitals = coalesce((p_row -> 'vitals')::jsonb, '{}'),
        feeds = coalesce((p_row -> 'feeds')::jsonb, '{}'),
        events = coalesce((p_row -> 'events')::jsonb, '[]'),
        note = coalesce(p_row ->> 'note', ''),
        deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
      where id = cur.id;
    return 'updated';
  end if;

  if p_table = 'mar_entries' then
    if not exists (select 1 from public.patients
        where tenant_id = t and local_id = p_row ->> 'patient_local_id' and deleted_at is null) then
      raise exception 'unknown patient';
    end if;
    st := coalesce(p_row ->> 'status', 'scheduled');
    if st not in ('scheduled', 'given', 'held', 'refused', 'missed') then raise exception 'invalid status'; end if;
    if coalesce((p_row ->> 'controlled')::boolean, false) and coalesce(p_row ->> 'witness', '') = '' then
      raise exception 'witness required for controlled drugs';
    end if;
    mgiv := (p_row ->> 'given_at')::timestamptz;
    if mgiv is not null and mgiv > now() then raise exception 'given_at cannot be in the future'; end if;
    select * into cur from public.mar_entries where tenant_id = t and local_id = lid;
    if cur.id is null then
      insert into public.mar_entries (tenant_id, local_id, patient_local_id, client_rev,
          drug, dose, route, freq, controlled, status, scheduled_at, given_at, given_by,
          witness, note, deleted_at, created_by)
      values (t, lid, p_row ->> 'patient_local_id', rev,
          coalesce(p_row ->> 'drug', ''), coalesce(p_row ->> 'dose', ''),
          coalesce(p_row ->> 'route', ''), coalesce(p_row ->> 'freq', ''),
          coalesce((p_row ->> 'controlled')::boolean, false), st,
          (p_row ->> 'scheduled_at')::timestamptz, mgiv, coalesce(p_row ->> 'given_by', ''),
          coalesce(p_row ->> 'witness', ''), coalesce(p_row ->> 'note', ''),
          case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
      return 'inserted';
    end if;
    if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
    update public.mar_entries set patient_local_id = p_row ->> 'patient_local_id',
        client_rev = rev, drug = coalesce(p_row ->> 'drug', ''), dose = coalesce(p_row ->> 'dose', ''),
        route = coalesce(p_row ->> 'route', ''), freq = coalesce(p_row ->> 'freq', ''),
        controlled = coalesce((p_row ->> 'controlled')::boolean, false), status = st,
        scheduled_at = (p_row ->> 'scheduled_at')::timestamptz, given_at = mgiv,
        given_by = coalesce(p_row ->> 'given_by', ''), witness = coalesce(p_row ->> 'witness', ''),
        note = coalesce(p_row ->> 'note', ''),
        deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
      where id = cur.id;
    return 'updated';
  end if;

  -- growth_points
  if not exists (select 1 from public.patients
      where tenant_id = t and local_id = p_row ->> 'patient_local_id' and deleted_at is null) then
    raise exception 'unknown patient';
  end if;
  wt := (p_row ->> 'wt_kg')::numeric; ln := (p_row ->> 'len_cm')::numeric;
  hc := (p_row ->> 'hc_cm')::numeric; mu := (p_row ->> 'muac_cm')::numeric;
  if wt is not null and (wt < 0.2 or wt > 200) then raise exception 'invalid wt_kg'; end if;
  if ln is not null and (ln < 20 or ln > 250) then raise exception 'invalid len_cm'; end if;
  if hc is not null and (hc < 10 or hc > 80) then raise exception 'invalid hc_cm'; end if;
  if mu is not null and (mu < 5 or mu > 60) then raise exception 'invalid muac_cm'; end if;
  mmeas := (p_row ->> 'measured_at')::timestamptz;
  if mmeas is not null and mmeas > now() then raise exception 'measured_at cannot be in the future'; end if;
  select * into cur from public.growth_points where tenant_id = t and local_id = lid;
  if cur.id is null then
    insert into public.growth_points (tenant_id, local_id, patient_local_id, client_rev,
        measured_at, wt_kg, len_cm, hc_cm, muac_cm, source, deleted_at, created_by)
    values (t, lid, p_row ->> 'patient_local_id', rev, mmeas, wt, ln, hc, mu,
        coalesce(p_row ->> 'source', ''),
        case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
    return 'inserted';
  end if;
  if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
  update public.growth_points set patient_local_id = p_row ->> 'patient_local_id',
      client_rev = rev, measured_at = mmeas, wt_kg = wt, len_cm = ln, hc_cm = hc,
      muac_cm = mu, source = coalesce(p_row ->> 'source', ''),
      deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
    where id = cur.id;
  return 'updated';
end; $$;
