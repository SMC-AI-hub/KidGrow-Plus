-- =====================================================================
-- Phase 2 live verification (staging AND prod). Two parts, both read-only
-- in effect: Part 1 is pure SELECTs; Part 2 builds throwaway rows inside a
-- transaction it always rolls back. Paste each part separately ("Run").
-- How to read results: Part 1 = row counts below; Part 2 = E1..E5 lines in
-- the editor's Notices/Messages panel. Send all output back for sign-off.
-- =====================================================================

-- ============================ PART 1: inventory =========================
-- Q1: expect 0 rows (no DELETE policies survive on clinical tables)
select tablename, policyname from pg_policies where schemaname='public'
  and cmd='DELETE' and tablename in ('patients','encounters','consents',
  'nicu_admissions','nicu_rounds','mar_entries','growth_points');

-- Q2: expect 0 rows (no PUBLIC/anon EXECUTE on the RPC surface)
select routine_name, grantee from information_schema.routine_privileges
  where specific_schema='public' and grantee in ('PUBLIC','anon');

-- Q5: eyeball — expect only *_sel/*_ins/*_upd per table, NO *_del, NO d_all
select tablename, policyname, cmd from pg_policies
  where schemaname in ('public','storage')
    and tablename in ('patients','encounters','consents',
    'nicu_admissions','nicu_rounds','mar_entries','growth_points',
    'memberships','invites','objects')
  order by 1, 2, 3;

-- Q6: expect 2 rows (role CHECKs on memberships + invites)
select conrelid::regclass, conname from pg_constraint
  where conname in ('memberships_role_check','invites_role_check');

-- Q7: table grants to app roles (staging: full grants observed 2026-10-21;
-- RLS is therefore the live gate. Any change vs that baseline = report it)
select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
  order by 1, 2, 3;

-- Q8: expect 7 rows (block_delete trigger on every clinical table)
select tgrelid::regclass as tbl, tgname from pg_trigger
  where not tgisinternal and tgname = 'block_delete' order by 1;

-- Q0: data census (staging 2026-10-21: 7 users, 0 patients)
select (select count(*) from tenants) as tenants,
       (select count(*) from memberships) as memberships,
       (select count(*) from patients) as patients;

-- ==================== PART 2: end-to-end (auto-rollback) ================
-- Paste everything below the line in ONE go. Uses any 2 auth.users; if the
-- editor shows an ERROR instead of notices, run: rollback;
-- ---------------------------------------------------------------------
begin;

DO $$
DECLARE
  u_owner uuid;
  u_ro    uuid;
  t       uuid := 'e2e00000-0000-4000-8000-000000000001';
  p       uuid := 'e2e00000-0000-4000-8000-000000000002';
  n       int;
  n_left  int;
  rpc_res text;
  res     text := '';
BEGIN
  SELECT id INTO u_owner FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO u_ro FROM auth.users WHERE id <> u_owner ORDER BY id LIMIT 1;
  IF u_owner IS NULL OR u_ro IS NULL THEN
    RAISE EXCEPTION 'need >=2 users in auth.users';
  END IF;

  -- Idempotent setup (as postgres; rolled back at the end). Claim first: the
  -- trg_tenant_owner trigger mints the owner membership from auth.uid().
  PERFORM set_config('request.jwt.claim.sub', '', true); -- null uid: cleanup deletes allowed
  DELETE FROM patients WHERE id IN (p) OR tenant_id = t;
  DELETE FROM memberships WHERE tenant_id = t;
  DELETE FROM tenants WHERE id = t;
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  INSERT INTO tenants (id, name, plan)
    VALUES (t, 'E2E verify (auto-rollback)', 'hospital'); -- auto-adds owner
  INSERT INTO memberships (tenant_id, user_id, role)
    VALUES (t, u_ro, 'readonly');
  INSERT INTO patients (id, tenant_id, mrn, name)
    VALUES (p, t, 'E2E-1', 'E2E');

  -- E1: readonly direct INSERT -> expect 42501
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_ro::text, true);
    INSERT INTO patients (tenant_id, mrn) VALUES (t, 'NEG-1');
    res := res || 'E1 FAIL: readonly insert was ALLOWED' || chr(10);
  EXCEPTION WHEN OTHERS THEN
    res := res || 'E1 ' || CASE WHEN SQLSTATE = '42501' THEN 'PASS (42501 deny)'
      ELSE 'FAIL (' || SQLSTATE || ': ' || SQLERRM || ')' END || chr(10);
  END;

  -- E2: readonly sync-RPC -> expect 42501 'role cannot write clinical data'
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_ro::text, true);
    PERFORM public.apply_patient_op(jsonb_build_object(
      'tenant_id', t::text, 'local_id', 'E2E-RO',
      'client_rev', '2026-10-10T00:00:00Z', 'mrn', 'E2E-RO', 'name', 'Ro'));
    res := res || 'E2 FAIL: readonly RPC was ALLOWED' || chr(10);
  EXCEPTION WHEN OTHERS THEN
    res := res || 'E2 ' || CASE WHEN SQLSTATE = '42501'
      THEN 'PASS (42501: ' || SQLERRM || ')'
      ELSE 'FAIL (' || SQLSTATE || ': ' || SQLERRM || ')' END || chr(10);
  END;

  -- E3: owner DELETE of the real row -> expect success, 0 rows, row intact
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    DELETE FROM patients WHERE id = p;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT count(*) INTO n_left FROM patients WHERE id = p;
    IF n = 0 AND n_left = 1 THEN
      res := res || 'E3 PASS (DELETE 0, row intact)' || chr(10);
    ELSE
      res := res || 'E3 FAIL (deleted=' || n || ' left=' || n_left || ')' || chr(10);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || 'E3 FAIL (' || SQLSTATE || ': ' || SQLERRM || ')' || chr(10);
  END;

  -- E4 (positive control): owner direct INSERT -> expect 1 row
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    INSERT INTO patients (tenant_id, mrn, name)
      VALUES (t, 'POS-1', 'Positive Control');
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 1 THEN
      res := res || 'E4 PASS (owner insert allowed)' || chr(10);
    ELSE
      res := res || 'E4 FAIL (rowcount=' || n || ')' || chr(10);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || 'E4 FAIL (' || SQLSTATE || ': ' || SQLERRM || ')' || chr(10);
  END;

  -- E5 (positive control): owner sync-RPC -> expect 'inserted'
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
    SELECT public.apply_patient_op(jsonb_build_object(
      'tenant_id', t::text, 'local_id', 'E2E-OWN',
      'client_rev', '2026-10-10T00:00:00Z', 'mrn', 'E2E-OWN', 'name', 'E2E Owner'))
      INTO rpc_res;
    IF rpc_res = 'inserted' THEN
      res := res || 'E5 PASS (owner RPC inserted)' || chr(10);
    ELSE
      res := res || 'E5 FAIL (returned ' || coalesce(rpc_res, 'NULL') || ')' || chr(10);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    res := res || 'E5 FAIL (' || SQLSTATE || ': ' || SQLERRM || ')' || chr(10);
  END;

  RAISE NOTICE '%', chr(10) || res;
END $$;

rollback;
