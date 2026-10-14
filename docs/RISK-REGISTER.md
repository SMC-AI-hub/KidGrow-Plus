# KidGrow Pro — Risk registers (Phase 1)

Severity: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low. Status is updated as work lands.
Rule: nothing here is "fixed" until a test proves it.

## A. Security risk register

| ID | Risk | Severity | Evidence | Mitigation / plan | Status |
|---|---|---|---|---|---|
| S1 | No tenant isolation — any future shared backend would leak across hospitals | 🔴 | No tenant id anywhere; RLS was per-user blob | `migrations/0001_tenant_core.sql` + 26-test isolation suite **green on PG17** (2026-10-13); Supabase apply pending user project | ✅ implemented+tested |
| S2 | Staff PINs stored **plaintext**, synced to cloud snapshots | 🟠 | `front.js: doLogin` compares `u.pin`; no hashing anywhere | Salted SHA-256 + 60s lockout + legacy migration — **tested** (cloud-offline 36/36); staff → Supabase Auth memberships (M3) | ✅ implemented+tested |
| S3 | Auth session (Supabase JWT) in localStorage — XSS steals session | 🟠 | supabase-js default storage; 117 `innerHTML` sinks | XSS hygiene already strong (379 `esc(`, 0 eval); + SW/hash fixes, ✅ device auto-lock 15m default (M2, tested), short sessions; document residual | open |
| S4 | Subscription paywall is UI-only — devtools bypasses gate | 🟡 | `cloud.js enforceGate()` hides UI only | Acceptable while data is device-local; server enforcement via lifecycle/quotas (M3 ✅); break-glass emergency path added (logged, 4h, tested). Never gate export/safety on payment | accepted + planned |
| S5 | Service worker caches **all** same-origin GET — future PHI APIs would be cached to disk | 🟡 | `sw.js` fetch handler, no `/api/` bypass | ✅ `/api/*` bypassed + asserted (hardening suite) | ✅ done |
| S6 | No security headers / CSP | 🟡 | `vercel.json` had cache headers only | ✅ HSTS/nosniff/referrer/CSP (script-src keeps unsafe-inline for onclick) + asserted; full CSP needs inline-handler refactor (M4) | ✅ done |
| S7 | Encrypted backup allows 4-char passwords via `prompt()` | 🟡 | `ops.js: exportEncrypted` | ✅ minimum 8 + asserted | ✅ done |
| S8 | No MFA, no brute-force lockout on local PIN, no session revoke | 🟡 | `front.js` has none | ✅ PIN lockout (M1) + auto-lock (M2) + TOTP enroll/verify w/ owner/admin enforcement (M3: logic tested, live GoTrue flow per M3-MANUAL-TESTS); admin session-revoke pending M4 | 🛠️ partial |
| S9 | API functions lack schema validation + rate limiting | 🟢 | `api/*.js` read minimal input | zod-style manual validation + Vercel/Upstash limits before PHI APIs (M3) | planned |
| S10 | Webhook redelivery duplicates `subscription_events` rows | 🟢 | no dedupe key | Dedupe on (event, entity, created_at) (M3); money-effect already idempotent | planned |
| S11 | Untracked junk logs + no `package.json`/lockfile → supply-chain drift | 🟢 | repo root (logs were never committed) | ✅ logs removed + `*.log` ignored, `package.json`+lockfile added, `npm test` wired | ✅ done |

**Verified non-issues (evidence kept):** no `eval`/`document.write`; OSV reports
**zero** known vulns for `@supabase/supabase-js@2.117.3` and `qrcode-generator@1.4.4`
(checked 2026-10-13); repo secret-scan clean (only `rzp_*_xxxx` placeholders);
output encoding consistent in report paths (`clinicHeader`, `childHeader`).

## B. Clinical-safety risk register

| ID | Risk | Severity | Evidence | Mitigation / plan | Status |
|---|---|---|---|---|---|
| C1 | Drug doses lack **per-drug versioned source**; no pharmacist sign-off trail | 🟠 | `drugs.js` header cites "IAP/Nelson/formularies" generically | Add `source`+`version` per drug, formulary review workflow, clinician UAT gate (M5; **blocks** SaaS prescribing claims) | planned |
| C2 | Neonatal dosing essentially absent; age bands are coarse | 🟠 | `ageMinM` only; no GA/weight-band tables | ✅ neonatal fluids/feeds/nutrition validated + tested (M5); drug GA/PNA bands + independent validation still open (M7 gate) | 🛠️ partial |
| C3 | Fenton curves are **fitted approximations** (transcribed percentiles) | 🟡 | `tools/build_refs.py` header (honestly documented) | Label fitted curves in UI; never compute precise Fenton z-scores for diagnosis (M5) | planned |
| C4 | No record versioning/amendment history; silent overwrite possible | 🟡 | `save()` replaces whole DB | ✅ client_rev ordering + apply_* LWW + conflict queue + server audit writer (M4, tested); per-field version history with M5 modules | 🛠️ partial |
| C5 | No allergy/interaction checking beyond keyword match | 🟡 | `drugs.js allergy:[keywords]` | Interaction DB license/source + versioned rules (M5) | planned |
| C6 | No duplicate-order / double-submit protection | 🟢 | forms submit directly | ✅ outbox opIds + server replay-safe LWW + 2.5s double-submit guards on rx/bill/registration (M4, tested) | ✅ done |
| C7 | Growth/dose calculators unvalidated by independent clinicians | 🟡 | no UAT evidence | Validation protocol + UAT scripts delivered in M7 pack (M7-CLINICIAN-UAT scripts A1–A2, C1–C5); closure needs executed sign-offs | 🛠️ partial |
| C8 | Retention/legal-hold/deletion workflows absent (India: 3-yr+ record rules vary) | 🟡 | no retention code | ✅ legal_hold delete-block + retain_until + consents + notice template (M3, tested); retention automation + counsel sign-off pending | 🛠️ partial |
| G1 | M1 direct-write policies: re-audit 2026-10-14 found 0002 already enforces `tenant_write_ok` (+quota trigger) on direct writes — original premise wrong | 🟢 | M1 isolation tests prove suspended/grace/quota denial on direct INSERT | ✅ closed-invalid; residual (any active member may chart) accepted — matches clinic workflow, viewer role is UI-level | ✅ done |

## C. Standing policies (non-negotiable)

1. No real patient data in dev/test — synthetic fixtures only.
2. No paywall may ever block record **export** or emergency access; billing failure
   → read-only + export grace, never deletion (see ROADMAP M3).
3. No independent pen-test + clinician UAT → no real-patient onboarding (M7 gate).
4. Every isolation claim must have an automated test; every test must run in CI.
