-- =====================================================================
-- 0008_revoke_truncate_trigger — revoke RLS-blind table privileges.
-- Q7 (staging 2026-10-21) found blanket grants including TRUNCATE + TRIGGER
-- to anon+authenticated on all 16 public tables (64 rows). TRUNCATE ignores
-- RLS policies and fires no row triggers, so it bypasses BOTH H3 layers;
-- TRIGGER (CREATE TRIGGER) is unneeded by app roles. Revoke both, on present
-- tables and (via default privileges) future ones created by postgres.
-- SAFE: nothing truncates or creates triggers as these roles — no app path,
-- no Supabase subsystem (Realtime uses logical decoding, not triggers).
-- DELETE/INSERT/UPDATE/SELECT grants (the RLS-gated ones) are untouched.
-- Idempotent: re-running is a silent no-op. Atomic: all-or-nothing.
-- =====================================================================

begin;

-- Present tables.
revoke truncate, trigger on all tables in schema public from anon, authenticated;

-- Future tables (no-op if default grants were never set up).
alter default privileges for role postgres in schema public
  revoke truncate, trigger on tables from anon, authenticated;

commit;

-- ================= POST-APPLY VERIFICATION (any SQL editor) ============
-- Expect 0 rows (staging baseline pre-0008 was 64):
--   select table_name, grantee, privilege_type
--     from information_schema.role_table_grants
--     where table_schema = 'public' and grantee in ('anon','authenticated')
--       and privilege_type in ('TRUNCATE','TRIGGER');
-- Also re-run the E-block (phase2-live-verify.sql Part 2) to confirm the
-- RLS-gated paths still behave identically (expect the same 5 PASS).

-- ================= ROLLBACK (0008) =================
-- Only if something legitimately needs these (nothing known does):
--   grant truncate, trigger on all tables in schema public to anon, authenticated;
-- (Do NOT re-grant blindly: TRUNCATE bypasses RLS and the H3 trigger.)
