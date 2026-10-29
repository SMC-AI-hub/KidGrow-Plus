-- RLS subscription-gate regression (KG-PT-001) + tenant-matrix smoke.
-- AUTO-ROLLBACK: safe on staging AND prod (nothing persists; temp rows only).
-- Run in the Supabase SQL editor or via the query API, then check every line.
--   Pre-0013:  B1/B1W show CONFIRMED-VULN, G-MINT shows FAIL-ALLOWED.
--   Post-0013: every line must be PASS.
begin;
DO $$
DECLARE
  u_own uuid; u_mem uuid; u_out uuid;
  t uuid := 'b1e00000-0000-4000-8000-000000000001';
  p uuid := 'b1e00000-0000-4000-8000-000000000002';
  n int;
BEGIN
  SELECT id INTO u_own FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO u_mem FROM auth.users WHERE id <> u_own ORDER BY id LIMIT 1;
  SELECT id INTO u_out FROM auth.users WHERE id NOT IN (u_own, u_mem) ORDER BY id LIMIT 1;
  CREATE TEMP TABLE gate_out(line text);
  DELETE FROM gate_out;
  GRANT ALL ON TABLE gate_out TO authenticated;

  -- ---------- setup (privileged) ----------
  PERFORM set_config('request.jwt.claim.sub', '', true);
  DELETE FROM break_glass_events WHERE tenant_id = t;
  DELETE FROM encounters WHERE tenant_id = t;
  DELETE FROM patients WHERE id = p OR tenant_id = t;
  DELETE FROM memberships WHERE tenant_id = t;
  DELETE FROM tenants WHERE id = t;
  DELETE FROM profiles WHERE id IN (u_own, u_mem, u_out);
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  INSERT INTO tenants (id, name, plan, status)
    VALUES (t, 'rls-gate probe (auto-rollback)', 'hospital', 'active');
  INSERT INTO memberships (tenant_id, user_id, role) VALUES (t, u_mem, 'doctor');
  UPDATE auth.users SET email_confirmed_at = now() WHERE id IN (u_own, u_mem, u_out);
  INSERT INTO profiles (id, trial_ends_at, sub_status) VALUES
    (u_own, now() + interval '30 days', 'trialing'),
    (u_mem, now() - interval '30 days', 'expired'),
    (u_out, now() + interval '30 days', 'trialing');
  INSERT INTO patients (id, tenant_id, mrn, name) VALUES (p, t, 'GATE-1', 'Gate Fixture');
  INSERT INTO encounters (tenant_id, patient_id, kind, status) VALUES (t, p, 'opd', 'open');

  -- ---------- B1: lapsed member reads stay OPEN (read-only on lapse) ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    SELECT count(*) INTO n FROM patients WHERE tenant_id = t;
    IF n = 1 THEN INSERT INTO gate_out VALUES ('B1-lapsed-read PASS(open,' || n || ')');
    ELSE INSERT INTO gate_out VALUES ('B1-lapsed-read FAIL(rows=' || n || ')'); END IF;
  EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('B1-lapsed-read FAIL(' || SQLSTATE || ')');
  END;

  -- ---------- B1W: lapsed member writes DENIED (the fix) ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    INSERT INTO patients (tenant_id, mrn, name) VALUES (t, 'GATE-W', 'Gate Write');
    INSERT INTO gate_out VALUES ('B1W-lapsed-write CONFIRMED-VULN(allowed)');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN INSERT INTO gate_out VALUES ('B1W-lapsed-write PASS(42501)');
    ELSE INSERT INTO gate_out VALUES ('B1W-lapsed-write FAIL(' || SQLSTATE || ')'); END IF;
  END;

  -- ---------- BG1: lapsed member can file break-glass (relief path open) ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    INSERT INTO break_glass_events (tenant_id, actor_id, reason, scope)
      VALUES (t, u_mem, 'emergency surgery!!', 'subscription-gate');
    INSERT INTO gate_out VALUES ('BG1-relief-file PASS(inserted)');
  EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('BG1-relief-file FAIL(' || SQLSTATE || ')');
  END;

  -- ---------- BG2: live relief re-opens lapsed writes (emergency care safe) ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    INSERT INTO patients (tenant_id, mrn, name) VALUES (t, 'GATE-BG', 'Gate Relief');
    INSERT INTO gate_out VALUES ('BG2-relief-write PASS(allowed)');
  EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('BG2-relief-write FAIL(' || SQLSTATE || ')');
  END;

  -- ---------- BG3: expired relief (5h old) no longer opens writes ----------
  PERFORM set_config('role', 'postgres', true);
  UPDATE break_glass_events SET created_at = now() - interval '5 hours'
    WHERE tenant_id = t AND actor_id = u_mem;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    INSERT INTO patients (tenant_id, mrn, name) VALUES (t, 'GATE-BG2', 'Gate Relief2');
    INSERT INTO gate_out VALUES ('BG3-expired-relief FAIL-ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN INSERT INTO gate_out VALUES ('BG3-expired-relief PASS(42501)');
    ELSE INSERT INTO gate_out VALUES ('BG3-expired-relief FAIL(' || SQLSTATE || ')'); END IF;
  END;

  -- ---------- G-MINT: lapsed member cannot mint a dodge tenant ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_mem::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_mem::text || '","aal":"aal2"}', true);
    INSERT INTO tenants (name, plan) VALUES ('Gate Dodge', 'solo');
    INSERT INTO gate_out VALUES ('G-MINT FAIL-ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN INSERT INTO gate_out VALUES ('G-MINT PASS(42501)');
    ELSE INSERT INTO gate_out VALUES ('G-MINT FAIL(' || SQLSTATE || ':' || left(SQLERRM, 60) || ')'); END IF;
  END;

  -- ---------- E-smoke: valid owner CRUD + deletes still blocked ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_own::text || '","aal":"aal2"}', true);
    INSERT INTO patients (tenant_id, mrn, name) VALUES (t, 'GATE-O', 'Gate Owner');
    UPDATE patients SET name = 'Gate Owner2' WHERE tenant_id = t AND mrn = 'GATE-O';
    SELECT count(*) INTO n FROM patients WHERE tenant_id = t;
    IF n >= 2 THEN INSERT INTO gate_out VALUES ('E-owner-crud PASS(' || n || ')');
    ELSE INSERT INTO gate_out VALUES ('E-owner-crud FAIL(rows=' || n || ')'); END IF;
    BEGIN
      -- No p_del policy: empirically a silent no-op on BOTH envs (0 rows, no
      -- error, row survives — prod-verified). Assert the safe behavior, not 42501.
      DELETE FROM patients WHERE tenant_id = t AND mrn = 'GATE-O';
      SELECT count(*) INTO n FROM patients WHERE tenant_id = t AND mrn = 'GATE-O';
      IF n = 1 THEN INSERT INTO gate_out VALUES ('E-owner-delete PASS(silent-noop,survives)');
      ELSE INSERT INTO gate_out VALUES ('E-owner-delete FAIL-ALLOWED(deleted!)'); END IF;
    EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('E-owner-delete FAIL(' || SQLSTATE || ')');
    END;
  EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('E-owner-crud FAIL(' || SQLSTATE || ')');
  END;

  -- ---------- E-smoke: outsider denied both ways ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_out::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_out::text || '","aal":"aal2"}', true);
    SELECT count(*) INTO n FROM patients WHERE tenant_id = t;
    IF n = 0 THEN INSERT INTO gate_out VALUES ('E-outsider-read PASS(0)');
    ELSE INSERT INTO gate_out VALUES ('E-outsider-read FAIL(' || n || ')'); END IF;
    BEGIN
      INSERT INTO patients (tenant_id, mrn) VALUES (t, 'GATE-X');
      INSERT INTO gate_out VALUES ('E-outsider-write FAIL-ALLOWED');
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = '42501' THEN INSERT INTO gate_out VALUES ('E-outsider-write PASS(42501)');
      ELSE INSERT INTO gate_out VALUES ('E-outsider-write FAIL(' || SQLSTATE || ')'); END IF;
    END;
  EXCEPTION WHEN OTHERS THEN INSERT INTO gate_out VALUES ('E-outsider FAIL(' || SQLSTATE || ')');
  END;

  -- ---------- E-smoke: aal1 owner write still denied (MFA layer intact) ----------
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
    PERFORM set_config('request.jwt.claims', '{"sub":"' || u_own::text || '","aal":"aal1"}', true);
    INSERT INTO patients (tenant_id, mrn) VALUES (t, 'GATE-AAL1');
    INSERT INTO gate_out VALUES ('E-aal1-write FAIL-ALLOWED');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN INSERT INTO gate_out VALUES ('E-aal1-write PASS(42501)');
    ELSE INSERT INTO gate_out VALUES ('E-aal1-write FAIL(' || SQLSTATE || ')'); END IF;
  END;
END $$;
SELECT line AS gate_result FROM gate_out ORDER BY line;
rollback;
