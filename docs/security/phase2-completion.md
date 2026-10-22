# Security Phase 2 — completion record (2026-10-22)

Scope: H1 (role-gated clinical writes + sync_guard role check + nurse charting),
H3 (hard deletes blocked), M1 (storage write split), M4 (EXECUTE to authenticated),
M5 (role CHECKs + owner-only owner-grant). Delivered as one additive migration.

## Repo evidence
- `supabase/migrations/0007_role_governance.sql` — the migration (atomic BEGIN/COMMIT).
- `tests/tenant-isolation.test.js` — 23 Phase-2 asserts (role matrix, delete no-op,
  trigger backstop, anon RPC deny, CHECK violations, grant matrix).
- Isolation suite: **130/130 green** on embedded PG17 (no regressions).
- `docs/security/phase2-live-verify.sql` — Part 1 inventory + Part 2 auto-rollback
  E1–E5 block, rehearsed against a staging-faithful scratch DB before live use.

## Staging (`bubnidgejmbzkevxvthl`) — VERIFIED 2026-10-21/22
- Apply: `Success. No rows returned`. Census at verify time: 2 tenants / 4 memberships / 4 patients.
- Fingerprint: 2/7/2 (functions / triggers / CHECKs).
- E-block: E1–E5 all PASS (readonly deny ×2, owner DELETE 0 + intact, owner positive controls ×2).
- Q1 = 0 (no DELETE policies), Q2 = 0 (no PUBLIC/anon EXECUTE), Q5 = 0007 set exactly
  (sel/ins/upd per clinical table; storage d_sel/d_ins/d_upd/d_del, no d_all;
  m_del/i_del intentionally kept), Q8 = 7/7 triggers on the right tables.
- Q7 baseline RECORDED (not expected): full table grants incl. TRUNCATE/TRIGGER
  to anon+authenticated on all 16 tables → RLS is the live gate, not dormancy.
  New latent finding filed: TRUNCATE bypasses RLS (see below).

## Prod (`jmlvcrekttbzibqitftj`) — VERIFIED 2026-10-22
- Pre-flight green: census 0/0/0, fingerprint 0/0/0, memberships+invites empty, 3 auth users.
- Apply: `Success. No rows returned`.
- (a) fingerprint 2/7/2 ✓ · (b) E1–E5 all PASS ✓ ·
  (c) census 0/0/0 + Q1 = 0 + Q2 = 0 ✓ · (d) Q5 = 0007 set exactly ✓.

## 0008 follow-up (`0008_revoke_truncate_trigger.sql`) — VERIFIED 2026-10-22
- Staging: apply Success; TRUNCATE/TRIGGER grants 64 → 0 rows; E-block 5/5 PASS (no behavior change).
- Prod: pre-check already 0 rows (prod never had the grants — staging-only drift);
  apply Success (no-op); post-check 0 rows; E-block 5/5 PASS.
- Suite: 134/134 green. Open item 2 below is now RESOLVED.

## Open items / follow-ups (NOT part of Phase 2 sign-off)
1. Prod Q7 was run 2026-10-22: uniform 5-privilege pattern (no TRUNCATE/TRIGGER)
   on all shown tables; the 0008 0-row pre-check covered all 16 tables. Prod grant
   baseline = narrower than staging's was. No action needed.
2. ~~TRUNCATE/TRIGGER to anon+authenticated~~ — RESOLVED by 0008 (this file).
3. PAT used for staging pushes traveled through chat — rotate (was already pending).
4. Deferred per plan: pgsodium at-rest (2b), AAL/MFA enforcement + M2 tenant minting (Phase 3),
   front-desk column views (pending confirmation front-desk get logins).

## P3.1 staging (`0009_aal_enforcement.sql` + grace UX) — VERIFIED 2026-10-22
- Commit `7cdc84f` (migration + 12 isolation asserts + E-block v2 + app grace UX).
- Staging: apply Success; E-block v2 E1–E7 all PASS (E6 aal1-owner 42501 deny,
  E7 audit aal2 sees 1 / aal1 sees 0; E1–E5 Phase 2 guarantees intact).
- Step B baseline CORRECTED (chat expectation "1 row" was wrong; migration file
  comment left untouched as immutable history): `my_aal2` shows 3 rows —
  postgres (owner, always listed), authenticated, service_role (default grant).
  Security gate = no PUBLIC/anon rows. This 3-row pattern is the baseline.
- Suite: isolation 146/146, cloud-offline 598/598 (3 new grace asserts), full run exit 0.
- Prod `0009` GATED until on/after 2026-11-05 (MFA_GRACE_UNTIL, warn-then-enforce).
