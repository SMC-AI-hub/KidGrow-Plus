# NeoKid Care — Phase 1 Audit: architecture, features, data & API

Date: 2026-10-13 · Codebase: v10 (`3c96ac5`, unpushed) · Method: source inspection +
baseline test run (`cloudtest`: **30/30 pass**) + OSV vulnerability lookup.
No real patient data was used. All patient-like data in tests is synthetic/seeded demo data.

## 1. Existing architecture report

**Stack (verified, not assumed):** vanilla JavaScript (no framework, no bundler,
no TypeScript) + single `index.html` + 26 classic `<script>` files (~6,400 LOC
excl. vendor) + one CSS file. PWA via `manifest.json` + `sw.js`. Backend:
Supabase (Postgres + Auth, client `2.117.3` vendored as UMD) and two zero-dependency
Vercel Node functions for Razorpay. Hosting: static on GitHub Pages (live demo) and
Vercel (production path). Package manager: none yet — no `package.json`.

**Runtime data flow (local-first):**

```
Browser (per device)                          Cloud (only if js/config.js has keys)
─────────────────────                         ─────────────────────────────────────
localStorage "kidgrow_pro_v1"  ──save()──▶   Supabase Auth (email+pw, localStorage session)
  whole-DB JSON: children[],                   clinic_snapshots: whole-DB JSON blobs/user
  bills, tokens, users, audit…                 (RLS: auth.uid()=user_id) — history, latest=live
  + PIN users + 500-entry audit                profiles: trial/subscription state
Service worker: stale-while-                   Vercel /api/*: Razorpay subscription create +
  revalidate shell cache                       HMAC-verified webhook → profile updates
```

**Auth mechanisms (two, independent):** (a) Local PIN users (`js/front.js`) —
3 roles (Doctor/Nurse/Frontdesk), page hiding, action ranks; (b) Supabase Auth
(`js/cloud.js`) — one login = one clinic account, 14-day trial, paywall,
7-day offline grace. There is **no server-side RBAC, no MFA, no org membership**.

**Integrations:** Razorpay Checkout.js (CDN, loaded on demand) + Subscriptions API
(server-side); WhatsApp deep links (`wa.me`) for reminders; no LIS/RIS/FHIR/ABDM.

**What this architecture is:** a mature single-clinic offline-first PWA with an
account-level cloud backup + subscription layer. **What it is not (yet):** a
multi-tenant SaaS — there is no tenant identity, no shared-org data, no per-record
server authorization. See `RISK-REGISTER.md` and `ROADMAP.md`.

## 2. Feature inventory (all controls verified present; spot-tested via boot suite)

| Area | File(s) | Status |
|---|---|---|
| Patient registration, longitudinal child record | app.js | ✅ working |
| Growth charts WHO 0–5 + IAP/CDC 5–18, Fenton preterm | growth*.js, ref-*.js, tools/build_refs.py | ✅ working, sources documented |
| Vaccines: IAP schedule, due/overdue, AEFI | app.js, aefi.js | ✅ working |
| Visits/OPD, prescriptions (weight-based), vitals | rx.js, drugs.js, clinic.js | ✅ working; dosing provenance partial (risk C2) |
| Newborn basic record, screening, diet, consents | nb.js, screen.js, diet.js, consent.js | ✅ working (basic depth) |
| Labs, frontdesk tokens/queue, billing/receipts | labs.js, front.js | ✅ working |
| Users + PINs + roles + audit trail | front.js | ⚠️ works, plaintext PINs (risk S2) |
| Exports: JSON, CSV, PDF/print, **AES-256-GCM encrypted backup** | exports.js, docs.js, ops.js | ✅ working; weak pw minimum (S7) |
| Cloud: auth, trial, sync, paywall, Razorpay | cloud.js, api/*, supabase/schema.sql | ✅ implemented, untested against live cloud (no project yet) |
| Offline PWA + background refresh | sw.js, manifest.json | ✅ working; caches same-origin GET incl. future `/api/*` (S5) |
| NICU longitudinal flows, MAR, fluid/nutrition calculator, wards/beds, handover, discharge summaries, analytics, FHIR, ABDM | — | ❌ missing (roadmap M5–M6) |

## 3. Database & API assessment

**Client DB (localStorage `kidgrow_pro_v1`):** single JSON doc — `children[]`
(each with nested visits/vaccines/growth/rx), `bills`, `tokens`, `users`
(PINs **plaintext**), `audit[]` (cap 500), `settings`, `session`. No schema
versioning beyond `_auto` mirror + `_prev` fallback. Integrity: good enough for
single-device; no transactions, no concurrent-edit protection beyond last-write-wins.

**Cloud DB (`supabase/schema.sql`):** `profiles` (trial/subscription, RLS own-row),
`clinic_snapshots` (whole-DB JSONB history, RLS own-rows), `subscription_events`
(audit, RLS own-read). Correct for account-level backup; **cannot express**
multi-user clinics, per-patient authz, record versioning, or cross-device
concurrency. Evolution target: `supabase/migrations/0001_tenant_core.sql`
(relational tenant core, additive — legacy tables untouched).

**APIs:** `POST /api/create-subscription` (verifies Supabase JWT server-side,
creates Razorpay customer+subscription, PATCHes profile via service key —
sound; missing strict input schema + rate limit: S9) and
`POST /api/razorpay-webhook` (HMAC-SHA256 verified, raw-body read — sound;
duplicate deliveries append duplicate audit rows — low: S10; PATCH effect itself
is idempotent). No patient-data APIs exist yet. No CSP/security headers on
responses (S6). No API serves PHI today, so exposure surface is currently small —
headers and schema validation land **before** any PHI API (roadmap M1).
