-- =====================================================================
-- 0007_role_governance — Phase 2 database hardening. ADDITIVE + tightening.
-- Closes: H1 (roles ignored on clinical writes, incl. sync RPC path),
-- H3 (hard delete), M1 (storage write), M4 (RPC EXECUTE to PUBLIC/anon),
-- M5 (role enum + owner-grant). No data changes, no drops of tables.
-- Reads stay member-wide (front-desk column views are deferred scope).
-- Safe no-op if 0001-0006 were never applied? NO — requires 0001+0002.
-- Order inside: helper -> precheck -> constraints -> policies -> trigger
-- -> grants -> storage. Rollback block at bottom.
-- =====================================================================

-- Atomic apply: Supabase SQL editor autocommits per statement, so wrap the
-- whole migration — any failure rolls everything back, never half-applied.
begin;

-- ================= 1. WRITER-ROLE HELPER =================
create or replace function public.tenant_can_write(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_tenant_role(p_tenant) in ('owner', 'admin', 'doctor', 'nurse')
$$;

-- ================= 2. PRECHECK: live roles must already be enum-clean ====
-- Fails fast with the offending values instead of halfway through.
do $$
declare bad_m text; bad_i text;
begin
  select string_agg(distinct quote_literal(role), ', ') into bad_m
    from public.memberships
    where role not in ('owner','admin','doctor','nurse','pharmacist','lab','mrd','billing','auditor','readonly');
  if bad_m is not null then
    raise exception '0007 blocked: memberships has non-enum roles: %. Fix rows first.', bad_m;
  end if;
  select string_agg(distinct quote_literal(role), ', ') into bad_i
    from public.invites
    where role not in ('owner','admin','doctor','nurse','pharmacist','lab','mrd','billing','auditor','readonly');
  if bad_i is not null then
    raise exception '0007 blocked: invites has non-enum roles: %. Fix rows first.', bad_i;
  end if;
end $$;

-- ================= 3. ROLE ENUM CHECKS (M5) =================
alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('owner','admin','doctor','nurse','pharmacist','lab','mrd','billing','auditor','readonly'));
alter table invites drop constraint if exists invites_role_check;
alter table invites add constraint invites_role_check
  check (role in ('owner','admin','doctor','nurse','pharmacist','lab','mrd','billing','auditor','readonly'));

-- ================= 4. CLINICAL WRITE POLICIES (H1) =================
-- patients
drop policy if exists "p_ins" on patients;
create policy "p_ins" on patients for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.tenant_can_write(tenant_id)
  and public.tenant_write_ok(tenant_id)
  and (public.plan_quota(public.tenant_plan(tenant_id), 'patients') is null
    or public.tenant_patient_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'patients')));
drop policy if exists "p_upd" on patients;
create policy "p_upd" on patients for update
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_can_write(tenant_id) and public.tenant_write_ok(tenant_id));
-- encounters
drop policy if exists "e_ins" on encounters;
create policy "e_ins" on encounters for insert with check (
  tenant_id in (select public.my_tenant_ids()) and public.tenant_can_write(tenant_id) and public.tenant_write_ok(tenant_id));
drop policy if exists "e_upd" on encounters;
create policy "e_upd" on encounters for update
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_can_write(tenant_id) and public.tenant_write_ok(tenant_id));
-- consents
drop policy if exists "c_ins" on consents;
create policy "c_ins" on consents for insert with check (
  tenant_id in (select public.my_tenant_ids()) and public.tenant_can_write(tenant_id) and public.tenant_write_ok(tenant_id));
drop policy if exists "c_upd" on consents;
create policy "c_upd" on consents for update
  using (tenant_id in (select public.my_tenant_ids()) and public.tenant_write_ok(tenant_id))
  with check (tenant_id in (select public.my_tenant_ids()) and public.tenant_can_write(tenant_id) and public.tenant_write_ok(tenant_id));
-- clinical tables: add nurse to the writer set (nurses must chart MAR/rounds)
drop policy if exists "na_ins" on nicu_admissions;
create policy "na_ins" on nicu_admissions for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "na_upd" on nicu_admissions;
create policy "na_upd" on nicu_admissions for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "nr_ins" on nicu_rounds;
create policy "nr_ins" on nicu_rounds for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "nr_upd" on nicu_rounds;
create policy "nr_upd" on nicu_rounds for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "mar_ins" on mar_entries;
create policy "mar_ins" on mar_entries for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "mar_upd" on mar_entries;
create policy "mar_upd" on mar_entries for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
    and public.tenant_write_ok(tenant_id));
drop policy if exists "gp_ins" on growth_points;
create policy "gp_ins" on growth_points for insert with check (
  tenant_id in (select public.my_tenant_ids())
  and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
  and public.tenant_write_ok(tenant_id));
drop policy if exists "gp_upd" on growth_points;
create policy "gp_upd" on growth_points for update
  using (tenant_id in (select public.my_tenant_ids()))
  with check (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','doctor','nurse')
    and public.tenant_write_ok(tenant_id));

-- ================= 5. SYNC PATH ROLE CHECK (H1, RPC half) =================
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
  if not public.tenant_can_write(p_tenant) then
    raise exception 'role cannot write clinical data' using errcode = '42501';
  end if;
end; $$;

-- ================= 6. HARD DELETE BLOCKED (H3) =================
-- Layer 1: no DELETE policy on clinical tables (RLS default-deny).
drop policy if exists "p_del" on patients;
drop policy if exists "e_del" on encounters;
drop policy if exists "na_del" on nicu_admissions;
drop policy if exists "nr_del" on nicu_rounds;
drop policy if exists "mar_del" on mar_entries;
drop policy if exists "gp_del" on growth_points;
-- (consents never had one.)
-- Layer 2: trigger backstop. Service key / direct postgres owner have no
-- auth.uid(), so break-glass + DBA work still flows; app users are stopped.
create or replace function public.block_clinical_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    raise exception 'hard delete of clinical records is blocked — set deleted_at instead' using errcode = '42501';
  end if;
  return old;
end; $$;
drop trigger if exists block_delete on patients;
create trigger block_delete before delete on patients for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on encounters;
create trigger block_delete before delete on encounters for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on consents;
create trigger block_delete before delete on consents for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on nicu_admissions;
create trigger block_delete before delete on nicu_admissions for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on nicu_rounds;
create trigger block_delete before delete on nicu_rounds for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on mar_entries;
create trigger block_delete before delete on mar_entries for each row execute function public.block_clinical_delete();
drop trigger if exists block_delete on growth_points;
create trigger block_delete before delete on growth_points for each row execute function public.block_clinical_delete();

-- ================= 7. OWNER-ONLY OWNER-GRANT (M5) =================
drop policy if exists "m_ins" on memberships;
create policy "m_ins" on memberships for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id)
  and (public.plan_quota(public.tenant_plan(tenant_id), 'users') is null
    or public.tenant_user_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'users')));
drop policy if exists "m_upd" on memberships;
create policy "m_upd" on memberships for update
  using (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner'))
  with check (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner'));
drop policy if exists "i_ins" on invites;
create policy "i_ins" on invites for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id));

-- ================= 8. RPC LEAST PRIVILEGE (M4) =================
-- Postgres grants EXECUTE to PUBLIC by default; Supabase RPC exposes every
-- public function to anon+authenticated. Lock to authenticated only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_tenant_ids()', 'public.my_tenant_role(uuid)',
    'public.tenant_plan(uuid)', 'public.tenant_write_ok(uuid)',
    'public.tenant_read_ok(uuid)', 'public.tenant_can_write(uuid)',
    'public.my_email()', 'public.plan_quota(text,text)',
    'public.tenant_user_count(uuid)', 'public.tenant_patient_count(uuid)',
    'public.sync_guard(uuid)', 'public.apply_patient_op(jsonb)',
    'public.apply_encounter_op(jsonb)', 'public.apply_consent_op(jsonb)',
    'public.apply_clinical_op(text,jsonb)', 'public.accept_invite(text)',
    'public.ensure_profile()',
    'public.trg_tenant_owner()', 'public.trg_stamp_creator()',
    'public.guard_last_owner()', 'public.touch_updated()',
    'public.handle_new_user()', 'public.block_clinical_delete()']
  loop
    begin
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    exception when undefined_function then
      raise notice '0007: % missing, skipped (partial apply?)', f;
    end;
  end loop;
end $$;

-- ================= 9. STORAGE WRITE SPLIT (M1) =================
-- Vanilla-Postgres CI has no storage schema: guard everything like 0001.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "d_all" on storage.objects;
    drop policy if exists "d_sel" on storage.objects;
    create policy "d_sel" on storage.objects for select
      using (bucket_id = 'clinic-docs'
        and (storage.foldername(name))[1] in (select public.my_tenant_ids()::text));
    drop policy if exists "d_ins" on storage.objects;
    create policy "d_ins" on storage.objects for insert
      with check (bucket_id = 'clinic-docs' and exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.status = 'active'
          and m.tenant_id::text = (storage.foldername(name))[1]
          and m.role in ('owner','admin','doctor','nurse')));
    drop policy if exists "d_upd" on storage.objects;
    create policy "d_upd" on storage.objects for update
      using (bucket_id = 'clinic-docs'
        and (storage.foldername(name))[1] in (select public.my_tenant_ids()::text))
      with check (bucket_id = 'clinic-docs' and exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.status = 'active'
          and m.tenant_id::text = (storage.foldername(name))[1]
          and m.role in ('owner','admin','doctor','nurse')));
    drop policy if exists "d_del" on storage.objects;
    create policy "d_del" on storage.objects for delete
      using (bucket_id = 'clinic-docs' and exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.status = 'active'
          and m.tenant_id::text = (storage.foldername(name))[1]
          and m.role in ('owner','admin')));
  end if;
end $$;

-- ================= 10. POST-APPLY VERIFICATION (run in staging SQL editor) ==
-- 1) No DELETE policies survive on clinical tables (expect 0 rows):
--    select tablename, policyname from pg_policies where schemaname='public'
--      and cmd='DELETE' and tablename in ('patients','encounters','consents',
--      'nicu_admissions','nicu_rounds','mar_entries','growth_points');
-- 2) No PUBLIC/anon EXECUTE on RPC surface (expect 0 rows):
--    select routine_name, grantee from information_schema.routine_privileges
--      where specific_schema='public' and grantee in ('PUBLIC','anon');
-- 3) Negative test as a readonly member (expect 42501 on writes):
--    -- set request.jwt.claim.sub to a readonly member, then:
--    insert into patients (tenant_id, mrn) values ('<tenant>','NEG-1');
--    -- expect: ERROR 42501 role cannot write / policy violation
-- 4) Owner hard delete is a silent no-op (expect 0, row intact):
--    delete from patients where id='<a-patient-uuid>'; -- 0 rows
-- 5) No stale permissive policy survived (expect exactly the 0007 set —
--    *_sel/*_ins/*_upd on each table, NO *_del, NO d_all; any extra row
--    means an old policy outlived the rename/drop and must be dropped):
--    select tablename, policyname, cmd from pg_policies
--      where schemaname in ('public','storage')
--        and tablename in ('patients','encounters','consents',
--        'nicu_admissions','nicu_rounds','mar_entries','growth_points',
--        'memberships','invites','objects')
--      order by 1, 2, 3;
-- 6) Role CHECKs present (expect 2 rows):
--    select conrelid::regclass, conname from pg_constraint
--      where conname in ('memberships_role_check','invites_role_check');

-- ================= ROLLBACK (0007) =================
-- Re-apply 0001+0002+0004 policy sections to restore M1/M3/M5 behavior, then:
-- drop trigger if exists block_delete on patients; (repeat per table)
-- drop function if exists public.block_clinical_delete(), public.tenant_can_write(uuid);
-- alter table memberships drop constraint if exists memberships_role_check;
-- alter table invites drop constraint if exists invites_role_check;
-- (Storage d_* policies: re-run the 0001 storage block. EXECUTE grants:
--  re-grant to PUBLIC only if you understand the exposure — default is open.)

commit;
