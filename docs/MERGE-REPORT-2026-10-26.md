# Merge + M7/M8 + prod-gate report — 2026-10-26

## 1. Merge & push (DONE)

- Pre-merge fix on `staging` (`a4a6785`): `js/guides.js` was shipped but never
  loaded by `index.html` (all guideline modes silently inert in production;
  unit tests + full-boot harnesses missed it — they parse `index.html` too).
  Fixed: script tag after `dose.js` + `sw.js` SHELL entry + `saveSettings()`
  guide-key writer + 3 regression pins (`tests/guides.test.js` 24/24).
- Merged `staging` → `main` as `8c2491e` (clean, no conflicts).
  `origin/main` tree was identical to base `fdcf88b` (47 phantom commits,
  content-neutral), so the merge payload = staging only: 82 files,
  +9044/−78, additive-safe (6 NEW migration files, 0 deletions;
  `vercel.json` +X-Frame-Options DENY; `sw.js` cache v47; package 10.52.0).
- Full suite green on merged `main` BEFORE push: 28 suites, ~1,850 asserts,
  exit 0, zero FAIL.
- Pushed `staging → a4a6785`, `main → 8c2491e` to `SMC-AI-hub/KidGrow-Plus`
  (exit 0). Remote removed afterwards; PAT-hygiene grep clean.
- Deploy consequence: Vercel production auto-deploys from `main` (was
  `a08c34d` v10.51). New guideline modes are flag-gated OFF (default AIIMS).
  Rollback: Vercel instant-rollback to `a08c34d`, or `git revert`.
- Post-merge Vercel state: see §5.

## 2. M7 / M8 (DONE, machine slice)

- `docs/M7-AUTOMATION-STATUS.md`: automation evidence green; the 5 human
  gates (pen-test, UAT, restore drill, legal, go/no-go) stay explicitly
  human — no self-certification. "No real patients before M7" stands.
- `docs/M8-READINESS.md`: static baseline facts only (repo 6.8M, js 14707
  lines, `cdata.gen.js` 70896B). No React rewrite authorised or started.

## 3. PROD GATE FINDING — migrations already applied, gate bypassed ⚠️

`docs/security/prod-gate-nov5.md` was NOT deleted and I did NOT apply
anything. But read-only census re-take (self-labeled probes, unambiguous)
shows prod is ALREADY at `0001→0012`:

| Project (verified by data, not name) | ref | users | confirmed | helpers | level |
|---|---|---|---|---|---|
| kidgrow-prod = **PROD** (ap-southeast-2) | `jmlvcrekttbzibqitftj` | 4 | 2 | 1 / 1 | →0012 |
| Kidgrow-Pro = **staging** (ap-south-1) | `bubnidgejmbzkevxvthl` | 7 | 7 | 1 / 1 | →0012 |

- Names are correct after all (kidgrow-prod = prod). My first two probe
  batches returned results out of order and looked contradictory; the
  labeled re-probes are the source of truth. (Separately, the connector's
  `list_migrations` reads a different/stale source — it showed →0009/→0011
  while `schema_migrations` shows →0012 on both. Trust `schema_migrations`.)
- Timeline evidence: my first fingerprint of prod read helpers 0/0; minutes
  later the labeled re-probe read 1/1 with level →0012. **0009→0012 were
  most likely applied to prod DURING this session window (~10 days before
  the Nov-5 date lock), outside the gate process.** Owner: please confirm
  who ran them and from where (dashboard history).
- The gate's §0 preconditions were therefore skipped: date lock, backup
  decision (FREE org, no PITR), confirm-or-accept, trial check.

## 4. Post-apply verification (read-only, all PASS ✅)

Gate §2/§3 asserts on prod: `my_aal2`=1, `my_email_confirmed`=1, grantees
postgres+authenticated only (both helpers), `t_ins` contains helper,
`accept_invite` guard present, 0011 probes raise `P0001 bad tenant_id` /
`bad client_rev` before any DML (nothing written). E-block Part 1 (pure
SELECTs): Q1 0 rows, Q2 0 rows, Q5 33 policies (clinical = sel/ins/upd only,
no `*_del`, no `d_all`), Q6 2 CHECKs, Q7 full grants = staging Oct-21
baseline (RLS is the live gate — recorded as prod baseline), Q8 7/7
`block_delete`, Q0 tenants=0/memberships=0/patients=0 (pre-launch, no data).
- Billing: all 4 prod profiles `trialing`, ends Oct 30 → Nov 8, all 4 now
  have `razorpay_sub_id` (Oct-25: none). 3 of 4 trials lapse by Nov 1 —
  resolve (subscribe/extend) or record acceptance; break-glass covers a lapse.
- Unconfirmed: still exactly the 2 Oct-17/18 probe-named test accounts (no
  PII pulled). **They are NOW read-only under live 0010** — confirm-or-delete
  pre-launch, owner's call. AAL enforcement (0009) is also live.

NOT run (owner, in dashboard): E-block Part 2 (E1–E8 e2e) — it does
transactional writes incl. `UPDATE auth.users` on real accounts; designed as
a single-session dashboard paste with auto-rollback, and I will not push
writes (even rolled-back ones) through the API connector to prod. Paste
`docs/security/phase2-live-verify.sql` Part 2 in the prod SQL editor,
expect E1–E8 all PASS, send output back.

## 5. Vercel post-merge state (verified via API)

- `neokidcare` production @ `8c2491e` (merge commit, ref main) — READY,
  PROMOTED. The merge is live.
- `kidgrow-staging` production target also @ `8c2491e` — READY, PROMOTED
  (its production branch is `main`); staging-branch builds (`a4a6785`,
  `6148d49`, …) deploy as STAGED previews.
- Rollback: instant-rollback on either project to the previous READY
  deployment, or `git revert` + push.

## 6. Gate retirement options (owner decision)

1. **Retire as bypassed** — annotate the gate doc (applied early, by whom,
   verify record = this report), keep §4 rollback map on file.
2. **Retro-run the gate** — complete skipped §0 items (backup call,
   confirm-or-accept, trial resolution, carry-over hardening) + E-block
   Part 2, then sign off.
3. **Keep date + re-verify Nov 5** — leave the doc live as the Nov-5
   checklist (verify-only, since applies are done).

Recommended: option 2 (closes every precondition with evidence), then
option 1 (file it as done). The §4 rollback map stays valid regardless.
