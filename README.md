# KidGrow Pro 👶 — Paediatric Clinic Suite → Multi-tenant EMR SaaS

Offline-first PWA for child health (birth–18 y) to Indian Academy of Pediatrics
standards, evolving into a production-grade multi-tenant SaaS. Works fully
offline after first open; syncs to Supabase (encrypted blob + relational rows)
when online. No build step: static files + Vercel serverless API.

## ✨ What's inside (35+ modules)

| Area | Modules |
|---|---|
| Overview | Dashboard (hero + pulse + NICU/MAR/growth cards), Children registry, Newborn care, Schedule & reminders |
| Clinical | Milestones, Vaccination (IAP ACVIP) + QR card, AEFI, Growth (WHO/CDC/IAP) + alerts, Labs, Screening, Diet, Visits (SOAP), Prescription (mg/kg engine + formulary review), E-consent, NICU longitudinal, eMAR, Clinical calculators, Formulary review |
| Front office | Tokens & billing, Vaccine stock, TV display |
| Insights | Analytics (defined denominators), Emergency reckoner, Handouts (EN/TA/HI), Reports & certificates, MRD registers, CSV/ABHA/JSON exports |
| Platform | Multi-tenant orgs + invites + MFA, break-glass, quotas, lifecycle, DPDP consents, dual-write sync with conflict queue, FHIR R4 read API |

## 🚀 Quickstart

```bash
# run locally (any static server)
python3 -m http.server 8080   # → http://localhost:8080

# tests (Node 18+; Postgres suite spins up embedded PG17 automatically)
npm ci && npm test            # 522 green: 325 offline + 107 isolation + 52 hardening + 38 api
```

Cloud features need `SUPABASE_URL` + `SUPABASE_ANON_KEY` (PWA config) and, for
billing, Razorpay keys (see `PRODUCTION-SETUP.md`). Staging fixtures:
`supabase/seed-staging.sql` (**staging only**, synthetic data).

## 🏗️ How it's built

- `index.html` + `js/*` — the app (vanilla JS, one file per module, `sw.js` offline shell).
- `supabase/migrations/0001–0004.sql` — tenants, RLS, quotas, sync RPCs, clinical tables.
- `api/*` — Vercel functions: health, billing, FHIR facade.
- `tests/*` — four suites; `docs/` — audit, roadmap, runbooks, M7 validation pack.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
Security/runbooks: [docs/OPERATIONS.md](docs/OPERATIONS.md) ·
Status: [docs/ROADMAP.md](docs/ROADMAP.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

## ⚠️ Safety notes

- **No real patients before M7 sign-off** ([validation pack](docs/M7-VALIDATION-PACK.md)):
  pen-test, clinician UAT, witnessed restore drill, legal review.
- Calculators + formulary are guidance only until a pharmacist verifies them (M7).
- Synthetic fixtures only in dev/test — never commit real PHI.

License: Apache-2.0.
