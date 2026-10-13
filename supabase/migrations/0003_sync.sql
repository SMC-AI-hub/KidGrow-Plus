-- =====================================================================
-- 0003_sync — M4 dual-write + idempotent ops. Adds client identity/revision
-- columns and server-side apply functions with last-writer-wins (LWW).
-- Clients NEVER write patients/encounters/consents directly during sync; they
-- call apply_*_op(row) which re-checks membership + write-gate + quota and
-- returns 'inserted' | 'updated' | 'stale'. Replays are safe (idempotent).
-- =====================================================================

alter table patients add column if not exists local_id text;
alter table patients add column if not exists client_rev timestamptz;
alter table patients add column if not exists deleted_at timestamptz;
alter table encounters add column if not exists local_id text;
alter table encounters add column if not exists client_rev timestamptz;
alter table encounters add column if not exists deleted_at timestamptz;
alter table consents add column if not exists local_id text;
alter table consents add column if not exists client_rev timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patients_tenant_local_uniq') then
    alter table patients add constraint patients_tenant_local_uniq unique (tenant_id, local_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'encounters_tenant_local_uniq') then
    alter table encounters add constraint encounters_tenant_local_uniq unique (tenant_id, local_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consents_tenant_local_uniq') then
    alter table consents add constraint consents_tenant_local_uniq unique (tenant_id, local_id);
  end if;
end $$;

-- Shared guards (definer helpers read memberships for the CALLER via auth.uid()).
create or replace function public.sync_guard(p_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tenant is null then raise exception 'tenant_id required'; end if;
  if not exists (select 1 from public.memberships
      where tenant_id = p_tenant and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member of this tenant' using errcode = '42501';
  end if;
  if not public.tenant_write_ok(p_tenant) then
    raise exception 'tenant is read-only' using errcode = '42501';
  end if;
end; $$;

create or replace function public.apply_patient_op(p_row jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  t uuid := (p_row ->> 'tenant_id')::uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz := (p_row ->> 'client_rev')::timestamptz;
  cur record;
  sx text;
begin
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
  t uuid := (p_row ->> 'tenant_id')::uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz := (p_row ->> 'client_rev')::timestamptz;
  pid uuid;
  kd text;
  st text;
  cur record;
begin
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
  t uuid := (p_row ->> 'tenant_id')::uuid;
  lid text := p_row ->> 'local_id';
  rev timestamptz := (p_row ->> 'client_rev')::timestamptz;
  pid uuid;
  pp text;
  ss text;
  cur record;
begin
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

-- ================= ROLLBACK (M4) =================
-- drop function if exists public.apply_consent_op(jsonb), public.apply_encounter_op(jsonb),
--   public.apply_patient_op(jsonb), public.sync_guard(uuid);
-- alter table if exists patients drop constraint if exists patients_tenant_local_uniq;
-- alter table if exists encounters drop constraint if exists encounters_tenant_local_uniq;
-- alter table if exists consents drop constraint if exists consents_tenant_local_uniq;
-- alter table if exists patients drop column if exists local_id, drop column if exists client_rev, drop column if exists deleted_at;
-- alter table if exists encounters drop column if exists local_id, drop column if exists client_rev, drop column if exists deleted_at;
-- alter table if exists consents drop column if exists local_id, drop column if exists client_rev;
