# Full recheck — 2026-11-03 (UTC)

Resumed session on `arena/510fe3ba-kidgrow-plus` (branched from `main @ 2d00312`).
This is a **recheck record**, not a new gate sign-off. No real patients, no prod
writes, no migration applies, no Vercel deploy, no PR merge.

## 0. Where the old chat stopped

- Working tree was clean, branch identical to `main`; no stash, no open PRs/issues.
- HEAD `2d00312` (2026-11-03 13:58 UTC): *"Fix eMAR default status selection
  (prevent silent 'given')"* — `js/mar.js` + pentest register sync. That was the
  last action of the previous session.
- Both `main` CI runs since the `f0d9440` merge were **RED** at `npm test`
  (`41463582610`, `41649136708`); smoke job skipped.
- The eMAR fix shipped **without a service-worker cache bump**: live `sw.js` on
  both targets still read `neokid-v49`, so offline clients would keep the old
  `<select>` that silently defaulted to `given`.

## 1. Method

| Layer | Check |
|---|---|
| Repo | unshallowed history, full log, diff vs main, changelog/readme/version pins |
| CI | `gh run list/view`, job/step conclusions for the two red runs |
| Local | `npm ci`, `npm test` (31 suites), `npm audit --audit-level=high`, `node --check` on every tracked `.js` |
| DB | Supabase connector: migration history, health, read-only census, `pg_policies`/`pg_get_functiondef` read-back on BOTH projects |
| Behavioral | committed `supabase/tests/rls-gate.sql` re-run on staging inside `begin … rollback`, then a no-stray-rows read |
| HTTP | live `GET /api/health` + `GET /sw.js` + `GET /js/mar.js` on both Vercel targets |
| Vercel connector | credential validation + project/deployment/domain/event listings |

## 2. Findings and disposition

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | `supabase/migrations/0013_subscription_gate.sql` had an unmatched `)` in the `d_upd` storage policy (`syntax error at or near ")"`, position 841 of that statement). Its two `storage.objects` statements were also unguarded, unlike 0001/0007, so fresh applies on vanilla Postgres (CI) failed with `schema "storage" does not exist`. | P1 — CI red since 2026-11-02 | **FIXED.** Balanced parens, explicit `);` closers, both policies wrapped in the `if exists (information_schema.tables where table_schema='storage' …)` DO guard. Storage `d_ins`/`d_upd` expressions on both projects and the four helper definitions on prod were read back; they are **semantically identical** to the corrected source — no re-apply needed, this is a source-of-truth/CI repair only. |
| 2 | eMAR fix (commit `2d00312`) not delivered to cached clients: `sw.js` still `neokid-v49`. | P1 — safety fix not effective offline | **FIXED.** Release rolled to `v10.53.2` / `neokid-v50` across `package.json`, `package-lock.json`, `js/cloud.js` (`APP_VER`), `api/health.js`, `sw.js` and both version-pin tests. |
| 3 | eMAR fix had no regression test. | P2 | **FIXED.** Two hardening asserts pin the empty placeholder and the `logMarDose` empty-status guard. |
| 4 | Boot-time render faults (12 × `clinicPulseHTML is not defined`, 1 × `childById is not defined`, 3 × `b.items.map` on legacy bills) — `app.js` boots before later scripts; `ops.js` tail re-render masked them in prod, but console faults and stale/legacy data could blank panels. | P3 | **FIXED.** `typeof` guards for `clinicPulseHTML`/`childById`, defensive bill rendering/receipt, new cloud-offline assert for a bill with no `items`. Full suite now logs **zero** `render failed` lines. |
| 5 | Live DB parity | INFO | Both projects `ACTIVE_HEALTHY` (auth/db/rest/storage/pooler). Migration history: prod `0001–0012` + `20261029133409 subscription_gate` + `20261102143433 webhook_idempotency_prod`; staging `0001–0012` + `20261029131801 webhook_idempotency` + `20261029132222 subscription_gate` + `20261029132403 restore_aal` (the documented 0013b incident). Helpers `my_subscription_ok`, `break_glass_live`, `tenant_can_write`, `tenant_write_ok` and storage `d_ins`/`d_upd` match the repo. `subscription_events.razorpay_event_id` + `profiles.last_webhook_at` present on both. |
| 6 | Subscription gate behavior | INFO | `rls-gate.sql` re-run on staging: **11/11 PASS** (B1, B1W, BG1, BG2, BG3, G-MINT, E-owner-crud, E-owner-delete, E-outsider-read/write, E-aal1-write). Post-rollback read: probe tenant/patient rows 0; staging census unchanged (2 tenants / 4 patients / 7 profiles / 7 users). |
| 7 | Prod census + entitlement | INFO | 2 users / 2 confirmed / 2 profiles, all `trialing`; 2 future trials (2026-11-08, 2027-02-02), 0 lapsed, 0 paid subs; 0 tenants / 0 patients (still pre-launch). No imminent lapse — the Oct-30/Nov-1 trial dates were extended, but the owner should still confirm the intended end dates. |
| 8 | Live HTTP (2026-11-03 ~14:54 UTC) | INFO | `kidgrow-prod.vercel.app` and `kidgrow-staging.vercel.app` `/api/health` → 200, `version 10.53.1`, `supabaseConfigured/Live true`, **`razorpayConfigured false`, `webhookSecretSet false`** (billing still DOWN). Live `/js/mar.js` on **both** targets already contains `— select status —` (so `2d00312` deployed); live `/sw.js` still `neokid-v49` on both. Version `10.53.2`/`v50` appears only after this branch is merged and redeployed. |
| 9 | Vercel connector scope | BLOCKER (read-only) | `validate_credential` OK, `get_authenticated_user` OK (`limited: true`), `list_teams` empty. `list_projects`, `list_deployments`, `list_domains`, `list_user_events` all returned **Access denied** (token lacks project/deployment scope). Deployment inventory could not be rechecked through the connector; live HTTP probes were used instead. Owner action: grant the token project/deployment read scope if a full Vercel inventory is wanted. |
| 10 | Prod auth config read-back | OPEN (M7) | `disable_signup=false`, `mailer_autoconfirm=false`, `jwt_exp=3600`, `refresh_token_rotation_enabled=true`, `mfa_totp` on, but `password_min_length=6`, `password_hibp_enabled=false`, `security_captcha_enabled=false`, `sessions_inactivity_timeout=0`, `sessions_single_per_user=false`. These are the previously logged M7/dashboard-hardening items — **not changed** (owner decision). |
| 11 | E2E smoke | NOT RUN LOCALLY | `tests/e2e-smoke.js` needs Chromium; `npx playwright install chromium` failed (`cdn.playwright.dev` blocked in this sandbox). CI's `smoke` job installs it; it was skipped on the two red runs and will run once CI is green on `main`/`staging`. |
| 12 | Nov-5 prod gate | NOT DUE | `docs/security/prod-gate-nov5.md` explicitly says nothing runs before 2026-11-05. Today is 2026-11-03 — panel untouched, preconditions not re-taken, no SQL applied. |

## 3. Verification output (this session)

```
npm test                      → exit 0, 31 suites / 2,049 asserts, 0 FAIL
                                cloud-offline 599 · isolation 166 · hardening 86 · api 79
                                zero "NeoKid Care render failed" lines
npm audit --audit-level=high  → found 0 vulnerabilities
node --check (all tracked js) → clean
rls-gate.sql on staging       → 11/11 PASS, auto-rollback clean
```

Suite detail: `docs/M7-AUTOMATION-STATUS.md` records the older 28-suite/1,850-assert
baseline; this recheck supersedes it with 31 suites / 2,049 asserts.

## 4. Files changed

`supabase/migrations/0013_subscription_gate.sql` · `js/app.js` · `js/front.js` ·
`js/cloud.js` · `sw.js` · `api/health.js` · `package.json` · `package-lock.json` ·
`tests/cloud-offline.test.js` · `tests/hardening.test.js` ·
`tests/syncmerge.test.js` · `README.md` · `CHANGELOG.md` · this report.

**No SQL was applied to any environment.** All Supabase writes in this recheck
were the committed auto-rollback gate on staging, verified rolled back.

## 5. Still open (human-owned, unchanged)

- M7 Gates 1–5: pen-test authenticated phase, clinician UAT + F1 pharmacist
  sign-off, witnessed restore drill, DPDP/counsel opinion, signed go/no-go.
  **No real patients before M7 sign-off.**
- Billing end-to-end: Razorpay keys + Step-5 e2e (`razorpayConfigured` still false).
- Guideline validator sheets (36 boxes) — modes stay OFF until signed.
- `autoExposeSystemEnvs` + Vercel token scope + on-call roster/runbook ack.
- 2026-11-05 prod gate (on/after that date; re-take census, backups decision,
  billing state, unconfirmed-user decision first).

## 6. Post-merge verification — COMPLETED 2026-11-03 15:12 UTC

- PR **#1** `arena/510fe3ba-kidgrow-plus → main` opened; checks: `test` PASS
  (31 s), `smoke` PASS (36 s), `Vercel – kidgrow-staging` PASS,
  `Vercel – neokidcare` PASS, `Supabase Preview` skipping, merge state CLEAN.
- Merged with `gh pr merge 1 --merge` → `main @ a187a81` (merge commit).
- Main CI run `41661177883`: **test success (28 s) + smoke success (53 s)** —
  the Playwright e2e smoke that could not run locally is now CI-verified.
  `npm audit --audit-level=high` also passed. The two previously red main runs
  (`41463582610`, `41649136708`) are superseded.
- Live read-back at 15:12:29 UTC:
  - `kidgrow-prod.vercel.app/api/health` → 200, `version 10.53.2`,
    `supabaseLive true`, `razorpayConfigured false`, `webhookSecretSet false`.
  - `kidgrow-staging.vercel.app/api/health` → 200, `version 10.53.2`, same checks.
  - Both `/sw.js` → `const CACHE = "neokid-v50"`.
  - Both `/js/mar.js` → `— select status —` placeholder present.
  So cached clients now receive the eMAR fix; the v49→v50 cache bust is live.

## 7. Remaining (human-owned / dated)

1. Re-take the Nov-5 gate preconditions on/after 2026-11-05, then follow
   `docs/security/prod-gate-nov5.md` — never before.
2. Wire Razorpay test→live keys + Step-5 e2e (billing still DOWN).
3. Close M7 Gates 1–5 and the §5 items; **no real patients before M7 sign-off**.
4. Owner: grant the Vercel token project/deployment read scope if a connector-
   based deployment inventory is wanted; confirm the auth-config hardening
   items (password length/HIBP/CAPTCHA/session timeout) and trial end dates.
