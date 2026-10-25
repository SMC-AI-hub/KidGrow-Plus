-- =====================================================================
-- 0011_rpc_input_casts — P3.4/L5: bad tenant_id/client_rev -> clean P0001.
-- The 4 sync RPCs cast untrusted JSON input in DECLARE initializers, so
-- garbage raised raw 22P02 (tenant_id) / 22007 (client_rev). Bodies below are
-- byte-identical to 0003/0004 except: t/rev declare without initializer and
-- are assigned in guarded sub-blocks first. Conventions preserved: null
-- tenant_id still reaches sync_guard ('tenant_id required'); null client_rev
-- still raises 'client_rev required'. Garbage now raises 'bad tenant_id' /
-- 'bad client_rev' (P0001, same class as the other input errors here).
-- No policy/logic/data changes. Atomic. Rollback: re-run the 0003 + 0004
-- function blocks (restores raw 22P02/22007 behavior).
-- =====================================================================

begin;


create or replace function public.apply_patient_op(p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz;
  cur record;
  sx text;
begin
  begin
    t := (p_row ->> 'tenant_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'bad tenant_id';
  end;
  begin
    rev := (p_row ->> 'client_rev')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'bad client_rev';
  end;
  perform public.sync_guard(t);
  if lid is null or lid = '' then raise exception 'local_id required'; end if;
  if rev is null then raise exception 'client_rev required'; end if;
  if (p_row ->> 'mrn') is null or (p_row ->> 'mrn') = '' then raise exception 'mrn required'; end if;
  if (p_row ->> 'dob') is not null and (p_row ->> 'dob')::date > current_date then raise exception 'dob cannot be in the future'; end if;
  sx := coalesce(p_row ->> 'sex', 'unknown');
  if sx not in ('male', 'female', 'other', 'unknown') then sx := 'unknown'; end if;
  select * into cur from public.patients where tenant_id = t and local_id = lid;
  if cur.id is null then
    if public.plan_quota(public.tenant_plan(t), 'patients') is not null
       and public.tenant_patient_count(t) >= public.plan_quota(public.tenant_plan(t), 'patients') then
      raise exception 'patient quota reached';
    end if;
    insert into public.patients (tenant_id, local_id, mrn, name, dob, sex, ga_at_birth_weeks,
        birth_weight_g, guardian, allergies, client_rev, deleted_at, created_by)
    values (t, lid, p_row ->> 'mrn', coalesce(p_row ->> 'name', ''),
        (p_row ->> 'dob')::date, sx, (p_row ->> 'ga_at_birth_weeks')::numeric,
        (p_row ->> 'birth_weight_g')::int, coalesce((p_row -> 'guardian')::jsonb, '{}'),
        coalesce((p_row -> 'allergies')::jsonb, '[]'), rev,
        case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
    return 'inserted';
  end if;
  if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
  update public.patients set mrn = p_row ->> 'mrn', name = coalesce(p_row ->> 'name', ''),
      dob = (p_row ->> 'dob')::date, sex = sx,
      ga_at_birth_weeks = (p_row ->> 'ga_at_birth_weeks')::numeric,
      birth_weight_g = (p_row ->> 'birth_weight_g')::int,
      guardian = coalesce((p_row -> 'guardian')::jsonb, '{}'),
      allergies = coalesce((p_row -> 'allergies')::jsonb, '[]'),
      client_rev = rev,
      deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
    where id = cur.id;
  return 'updated';
end; $$;

create or replace function public.apply_encounter_op(p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz;
  pid uuid;
  kd text;
  st text;
  cur record;
begin
  begin
    t := (p_row ->> 'tenant_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'bad tenant_id';
  end;
  begin
    rev := (p_row ->> 'client_rev')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'bad client_rev';
  end;
  perform public.sync_guard(t);
  if lid is null or lid = '' then raise exception 'local_id required'; end if;
  if rev is null then raise exception 'client_rev required'; end if;
  select id into pid from public.patients
    where tenant_id = t and local_id = p_row ->> 'patient_local_id' and deleted_at is null;
  if pid is null then raise exception 'unknown patient in this tenant (push patient first)'; end if;
  kd := coalesce(p_row ->> 'kind', 'opd');
  if kd not in ('opd', 'emergency', 'admission', 'nicu', 'picu', 'followup') then
    raise exception 'invalid encounter kind';
  end if;
  st := coalesce(p_row ->> 'status', 'open');
  if st not in ('open', 'closed', 'cancelled') then raise exception 'invalid encounter status'; end if;
  select * into cur from public.encounters where tenant_id = t and local_id = lid;
  if cur.id is null then
    insert into public.encounters (tenant_id, local_id, patient_id, kind, status, started_at, ended_at, client_rev, deleted_at, created_by)
    values (t, lid, pid, kd, st, coalesce((p_row ->> 'started_at')::timestamptz, now()),
        (p_row ->> 'ended_at')::timestamptz, rev,
        case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() end, auth.uid());
    return 'inserted';
  end if;
  if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
  update public.encounters set patient_id = pid, kind = kd, status = st,
      started_at = coalesce((p_row ->> 'started_at')::timestamptz, started_at),
      ended_at = (p_row ->> 'ended_at')::timestamptz, client_rev = rev,
      deleted_at = case when coalesce(p_row ->> 'deleted', 'false') = 'true' then now() else null end
    where id = cur.id;
  return 'updated';
end; $$;

create or replace function public.apply_consent_op(p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz;
  pid uuid;
  pp text;
  ss text;
  cur record;
begin
  begin
    t := (p_row ->> 'tenant_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'bad tenant_id';
  end;
  begin
    rev := (p_row ->> 'client_rev')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'bad client_rev';
  end;
  perform public.sync_guard(t);
  if lid is null or lid = '' then raise exception 'local_id required'; end if;
  if rev is null then raise exception 'client_rev required'; end if;
  select id into pid from public.patients
    where tenant_id = t and local_id = p_row ->> 'patient_local_id' and deleted_at is null;
  if pid is null then raise exception 'unknown patient in this tenant (push patient first)'; end if;
  pp := coalesce(p_row ->> 'purpose', 'care');
  if pp not in ('care', 'billing', 'research', 'marketing', 'sharing') then raise exception 'invalid purpose'; end if;
  ss := coalesce(p_row ->> 'status', 'granted');
  if ss not in ('granted', 'withdrawn', 'expired') then raise exception 'invalid consent status'; end if;
  select * into cur from public.consents where tenant_id = t and local_id = lid;
  if cur.id is null then
    insert into public.consents (tenant_id, local_id, patient_id, purpose, status, granted_by, granted_at, expires_at, withdrawn_at, note, client_rev, created_by)
    values (t, lid, pid, pp, ss, coalesce(p_row ->> 'granted_by', ''),
        coalesce((p_row ->> 'granted_at')::timestamptz, now()),
        (p_row ->> 'expires_at')::timestamptz, (p_row ->> 'withdrawn_at')::timestamptz,
        coalesce(p_row ->> 'note', ''), rev, auth.uid());
    return 'inserted';
  end if;
  if cur.client_rev is not null and rev <= cur.client_rev then return 'stale'; end if;
  update public.consents set purpose = pp, status = ss,
      granted_by = coalesce(p_row ->> 'granted_by', ''),
      expires_at = (p_row ->> 'expires_at')::timestamptz,
      withdrawn_at = (p_row ->> 'withdrawn_at')::timestamptz,
      note = coalesce(p_row ->> 'note', ''), client_rev = rev
    where id = cur.id;
  return 'updated';
end; $$;

create or replace function public.apply_clinical_op(p_table text, p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz;
  cur record;
  st text;
  wt numeric; ln numeric; hc numeric; mu numeric;
  madm timestamptz; mgiv timestamptz; mmeas timestamptz;
begin
  begin
    t := (p_row ->> 'tenant_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'bad tenant_id';
  end;
  begin
    rev := (p_row ->> 'client_rev')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'bad client_rev';
  end;
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


commit;

-- ================= POST-APPLY VERIFICATION =================
-- 1) Garbage in -> clean P0001 (expect ERROR: bad tenant_id, code P0001):
--    select public.apply_patient_op('{"tenant_id":"nope","local_id":"x","client_rev":"2026-10-10T00:00:00Z","mrn":"m"}');
-- 2) Re-run E-block v3 Part 2: expect E1-E8 all PASS (E2/E5 prove the RPCs
--    still work — 0011 changes only the error path).
