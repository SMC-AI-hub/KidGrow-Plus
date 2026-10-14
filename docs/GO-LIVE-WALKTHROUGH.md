# Go-live walkthrough — from this repo to real patients

Start: code on GitHub (`SMC-AI-hub/KidGrow-Plus`, CI green). End: pilot clinic
live. Realistic timeline: **3–6 weeks**, most of it waiting on humans.

> Golden rule: **staging first, prod later**. No real patient data anywhere
> until M7 is signed off.

---

## Phase 0 — Accounts & people (Day 1, ~2 hours)

**Create (all have free tiers sufficient for staging):**
1. Supabase account → you'll create TWO projects later: `kidgrow-staging`, `kidgrow-prod`.
2. Vercel account (sign up with GitHub) → later TWO projects: staging + prod.
3. Razorpay account → use **Test mode** keys for staging; live keys only at pilot.
4. GitHub: nothing needed (CI already runs). Revoke any PATs you pasted during development.

**Line up (start asking now — this is the long pole):**
5. A paediatrician, NICU nurse, and pharmacist for UAT (can be your own staff + one external pharmacist for independence on the formulary check).
6. A security tester: freelancer with OSCP/CEH or a small firm. Send them `docs/M7-PENTEST-SCOPE.md` and get 2–3 quotes.
7. A lawyer familiar with DPDP Act 2023 (even 2–3 hours of review suffices).

---

## Phase 1 — Staging backend (Day 1–2, ~1 hour)

1. Supabase → New project `kidgrow-staging` (region: Mumbai/South Asia), free tier.
2. In the project: **SQL Editor → New query**, then paste and run each migration **in order** (each must report success):
   - `supabase/migrations/0001_tenant_core.sql`
   - `supabase/migrations/0002_platform.sql`
   - `supabase/migrations/0003_sync.sql`
   - `supabase/migrations/0004_clinical.sql`
3. **Authentication → Users → Add user** (email + password, auto-confirm ON): create `owner@staging.test` and `doctor@staging.test`. Copy both UUIDs.
4. Seed synthetic fixtures. Easiest path — Supabase SQL Editor:
   - Open `supabase/seed-staging.sql`, replace `:owner_uid` and `:doc_uid` with the two UUIDs, replace the `:staging_ok` guard line's check by just deleting that `select ... 1/0` line, run it.
   - (If you have `psql`: use the `-v` command in the file header instead.)
   - Expect: `staging seed ok: 4 synthetic patients`.
5. Note down: **Project URL** + **anon public key** (Settings → API).

## Phase 2 — Staging app (Day 2, ~1 hour)

1. Vercel → Add New → Project → import `KidGrow-Plus` → name it `kidgrow-staging` → Deploy (framework: Other).
2. Vercel project → Settings → Environment Variables, add:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (staging values — for `/api/*`)
   - Razorpay **test** keys + webhook secret (for billing tests)
3. In the repo, fill `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, test `RAZORPAY_KEY_ID`), commit to a `staging` branch, and point the Vercel staging project at that branch (keeps `main` clean for prod later).
4. Open the staging URL: register/login as the seeded users, verify the 4 synthetic patients sync down.
5. Execute [M3-MANUAL-TESTS.md](M3-MANUAL-TESTS.md) (invite email timing, MFA timing, live sync timing) — log results.

## Phase 3 — M7 gates (Weeks 1–5, mostly parallel)

Run all four once Phase 2 is done; track in [M7-VALIDATION-PACK.md](M7-VALIDATION-PACK.md).

- **Gate 1 — Pen-test:** give the tester the staging URL + two logins (different tenants/roles) + the scope doc. Fix every Critical/High (send me the findings — I'll patch with tests), then get the retest letter.
- **Gate 2 — UAT:** hand each role [M7-CLINICIAN-UAT.md](M7-CLINICIAN-UAT.md). The pharmacist's formulary + calculator scripts are the most important (they close C1-content and C7). Collect all six sign-off rows.
- **Gate 3 — Restore drill:** follow [M7-RESTORE-DRILL.md](M7-RESTORE-DRILL.md) with an operator + witness. File the timed log.
- **Gate 4 — Legal:** send counsel the app + [M7-DPDP-CHECKLIST.md](M7-DPDP-CHECKLIST.md) + [PRIVACY-NOTICE-TEMPLATE.md](PRIVACY-NOTICE-TEMPLATE.md). Get the written opinion.

## Phase 4 — Production + pilot (Week 5–6)

1. Supabase → New project `kidgrow-prod` (paid tier for PITR backups). Run migrations 0001–0004. **No seed script. No synthetic data.**
2. Vercel → second project `kidgrow-prod` → production branch `main`, prod env vars, **live** Razorpay keys + webhook.
3. `js/config.js` on `main` gets the PROD public values (one small commit → push → CI → auto-deploy).
4. Sign [M7-GO-NOGO.md](M7-GO-NOGO.md), then pilot: **one clinic, ≤100 patients, 2-week hypercare** (daily log review).
5. Pilot review → full rollout. Keep the staging project forever for testing future changes.

## Phase 5 — Ongoing (after go-live)

- Weekly: review audit log + sync conflicts + failed ops (OPERATIONS §4–§5).
- Monthly: `npm audit`, dependency updates, backup spot-check.
- Quarterly: re-run the restore drill; pharmacist re-verifies new formulary entries.
- Yearly: pen-test refresh, DPDP review refresh, access recertification.
