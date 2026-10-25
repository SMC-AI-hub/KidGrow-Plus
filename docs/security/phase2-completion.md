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

## P3.3 staging (`0010_email_confirmed.sql`) — VERIFIED 2026-10-23
- Commits `dcf0f88` (migration + 8 isolation asserts + E-block v3) and
  `4d3de64` (E-block setup-confirm fix after read-back caught a lost edit).
- Staging: apply Success; E-block v3 E1–E8 all PASS (E8 unconfirmed-owner
  42501 deny; E1–E7 Phase 2 + P3.1 guarantees intact).
- Step B baseline: `my_email_confirmed` shows 2 rows (postgres +
  authenticated), no PUBLIC/anon. Differs from `my_aal2`'s 3 rows
  (service_role absent) — irrelevant: service_role bypasses RLS by design.
- Suite: isolation 154/154, full run exit 0.
- Wrong-tab incident 2026-10-23: Step 0 + Step A first run hit PROD (3-user
  census 1 confirmed/2 unconfirmed = prod fingerprint; 0010 correctly aborted
  with my_aal2-missing, proving prod untouched). Standalone `rollback;`
  issued; no rows touched. Prod census banked for Nov 5 sequencing.
- Staging Step 0 was skipped (retroactive confirmed-email list requested,
  still pending at sign-off). Unconfirmed staging users are read-only until
  they confirm via email link.
- Prod sequence: 0009 on/after 2026-11-05 FIRST, then 0010; prod's 2
  unconfirmed users go read-only at that point (confirm-or-accept repeats).

## P3.4 staging (`0011_rpc_input_casts.sql` + app L1–L4) — VERIFIED 2026-10-25
- Commit `d3c345a` (0011 + webhook/billing/guard/err/vercel patches + 19 asserts).
- Staging: 0011 apply Success; has_0011 true; C1 garbage tenant_id ->
  P0001 `bad tenant_id`, C2 garbage client_rev -> P0001 `bad client_rev`
  (both from guard RAISE, no raw 22P02/22007). E-block v3 rerun E1–E8 all
  PASS — 0011 changed nothing but the two casts.
- Drill incident (process, no data): C1/C2 first run BEFORE Step A showed raw
  22P02/22007 with DECLARE-init context, proving old body live; resolved by
  applying 0011. Also learned: `current_database()` reads `postgres` on BOTH
  projects — valid tab fingerprint is users=7 + my_email_confirmed=1.
- Suite: isolation 160/160, api 71/71, hardening 79/79, cloud-offline
  598/598, full run exit 0.
- L1–L4 ride the Vercel deploy off the staging push (no SQL). Prod untouched
  at 0007+0008 (prod has_0011=false read requested as trailing confirmation).
- Still owed (trailing): P3.3 Step 0 retro confirmed-email list; P3.4 prod
  has_0011=false read.
