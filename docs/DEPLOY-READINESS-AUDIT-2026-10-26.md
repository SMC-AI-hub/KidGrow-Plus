# Deploy-readiness audit — 2026-10-26 (15:00 IST)

## Verdict

- **Technically deployed: YES ✅** — `main @ 13b7d86` is live on both
  production targets, HTTP 200, APIs responding, suite green, DB verified.
- **Ready for real deployment (pilot with real patients / paying clinics):
  NO ❌** — 10 launch blockers below, all human-gated. Realistic path is the
  existing `GO-LIVE-WALKTHROUGH.md`: 3–6 weeks, mostly waiting on humans
  (pen-tester, clinicians, counsel). **No real patients before M7** stands.

## Live & green (verified today)

| Check | Evidence |
|---|---|
| Prod serving | `kidgrow-prod.vercel.app` → HTTP 200; `kidgrow-staging.vercel.app` → 200 (SSO wall covers only deployment-hash URLs) |
| API live | `/api/health` → 200, `{"status":"ok","version":"10.52.0","supabaseLive":true}` (version matches `package.json`) |
| Suite green | `npm test` exit 0 on `13b7d86` (~1,850 asserts, 0 FAIL) |
| DB verified (read-only) | prod `0001→0012`, §2/§3 asserts + E-block Part 1 all PASS, 0 clinical rows (pre-launch), no PUBLIC/anon EXECUTE, 7/7 `block_delete` |
| Security headers | HSTS, `X-Frame-Options: DENY`, CSP, no-sniff shipped in `vercel.json` |
| Config wiring | `js/config.js` hostname switch points prod host → prod ref, staging → staging ref; SW cache v47, `guides.js` in SHELL |
| Guideline modes | G1–G5 ship but are flag-gated OFF pending validator sign-off (correct fail-closed posture) |
| Secrets hygiene | No PATs/tokens in repo; server secrets only in Vercel env |

## Launch blockers (CRITICAL — all must close before pilot)

1. **M7 Gate 1 — pen-test: not started.** Scope doc ready
   (`M7-PENTEST-SCOPE.md`, 12 items), no tester engaged, no report.
2. **M7 Gate 2 — clinician UAT: not started** (25 items, 6 sign-offs).
   Includes **F1 dose-pack: UNSIGNED** — the sheet's own rule is "no real
   prescriptions until every row verified + signed" (RISK C1 blocks SaaS
   prescribing claims until the pharmacist sign-off; calculators await UAT).
3. **M7 Gate 3 — restore drill: never run.** Prod org is FREE (no PITR);
   backup export + operator-only restore untested in practice.
4. **M7 Gate 4 — legal/DPDP: 16/16 open.** No privacy-notice approval, no
   breach playbook, no processor DPAs, no counsel opinion.
5. **M7 Gate 5 — go/no-go: 8/8 open**, incl. on-call roster + incident-runbook
   ack by two humans and a rehearsed rollback plan.
6. **Billing is DOWN end-to-end.** Live `/api/health`: `razorpayConfigured:
   false`, `webhookSecretSet: false`; `RAZORPAY_KEY_ID` empty in `config.js`.
   The 4 `razorpay_sub_id`s on profiles were created outside the app flow
   (manual/dashboard) and cannot sync without the webhook secret. Trials
   lapse Oct 30 / Oct 31 / Nov 1 / Nov 8 — resolve (subscribe/extend) or
   record acceptance; then wire test→live keys per `PRODUCTION-SETUP.md` and
   run its Step-5 e2e. NOTE for wiring day: `api/` reads
   `SUPABASE_SERVICE_KEY`, Vercel visibly has `SUPABASE_SERVICE_ROLE_KEY` —
   confirm/set the exact name the code reads.
7. **Prod-gate bypass fallout (unclosed).** 0009→0012 reached prod ~10 days
   early, outside the gate: E-block Part 2 (E1–E8) never run on prod; the 2 unconfirmed Oct-17/18 test accounts were DELETED 2026-10-27 per owner
   (prod now 2 users / 2 confirmed; cancel their Razorpay trial subs in dashboard); backup decision unrecorded; carry-overs open (revoke
   old HS256 key, `autoExposeSystemEnvs` still `true` on neokidcare).
8. **Guideline validators: 36/36 handoff boxes open** (TSH AIIMS/AAP, bili
   IAP/NNF/AAP curves-vs-print, F1a print check, NICE 1.4.1). Modes stay OFF
   until signed — do not enable early.
9. **F12 ABDM honesty — DECIDED + DONE 2026-10-27.** Owner chose full ABHA
   removal (stronger than option A). Field, exports, FHIR identifier, and
   all ABDM copy deleted; hardening test pins absence.
10. **M3 manual tests: 18/18 open** (invite/MFA/sync live timings on staging).

## HIGH (close during pilot prep)

- Risk register: S3 open (Supabase JWT in localStorage — residual XSS);
  S8 partial (admin session-revoke); C2 partial (neonatal drug GA/PNA bands);
  C8 partial (retention automation + counsel sign-off).
- Wards/beds missing (M5 partial); single plan only; `?env=` backend
  override is auth-gated but should be removed/flagged at pilot.
- **Rotate the 3 GitHub PATs pasted during development**
  (`GO-LIVE-WALKTHROUGH.md` Phase 0.4) after confirming nothing else uses them.

## Not blocking pilot (post-launch track)

- M8 decisions (React stay/go — recommendation: stay; load program SLOs;
  multi-facility scoping; dedicated DB/keys) — decide after pilot data.
- Custom domain (optional), quarterly/yearly M7 refresh cadence (Phase 5).

## Suggested sequence

1. This week: tester quotes + UAT clinician lineup + counsel intro (the long
   poles); pick F12-A/B/C; confirm-or-delete the 2 read-only test accounts;
   run E-block Part 2 on prod (dashboard paste); revoke PATs.
2. Weeks 1–2: wire Razorpay test keys → Step-5 e2e → live keys; trial
   resolution; run M3 manual tests; execute restore drill with witness.
3. Weeks 3–5: pen-test → fix Critical/High → retest letter; UAT scripts +
   F1/pharmacist sign-off; DPDP checklist + counsel opinion.
4. Week 5–6: sign Gate 5 → one clinic ≤100 patients, 2-week hypercare →
   pilot review → rollout.
