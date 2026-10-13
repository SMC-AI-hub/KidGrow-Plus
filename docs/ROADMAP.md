# KidGrow Pro — Missing-feature matrix & prioritized roadmap (Phase 1 →)

## Stack decision (why no rewrite)

Keep: vanilla-JS offline-first PWA + Supabase Postgres/Auth/Storage + Vercel.
Reasons: (1) the clinical UI is mature, tested (30/30), and works offline —
a React rewrite would reintroduce years of bugs; (2) Postgres RLS gives
database-enforced tenant isolation without a custom backend; (3) Supabase Auth
gives MFA/session controls cheaper than building them; (4) sustainable cost
for Indian clinics. The evolution is **data-layer first** (relational tenant
core alongside the legacy snapshot blob), then modules incrementally.
TypeScript/React migration is deferred to M8 and only if justified by team size.

## Missing-feature matrix (master prompt §3–17 vs v10)

| Requirement | v10 | Lands in |
|---|---|---|
| Tenant identity, org onboarding, branding | ❌ | M1 schema → M3 UI |
| RLS tenant isolation + isolation tests | ❌ | **M1 (this turn)** |
| Server RBAC, MFA, break-glass, audit (tamper-evident) | ❌ (local only) | M3 |
| NICU longitudinal, MAR, fluids/nutrition calc | ❌ (basic NB only) | M5 |
| Wards/beds, handover, discharge, analytics | ❌ | M5–M6 |
| Plans/quotas/suspension-grace billing | ⚠️ single plan only | M3 |
| Backups tested, RPO/RTO, staging env | ❌ | M2 |
| FHIR/ICD/LOINC/ABDM | ❌ | M6 |
| DPDP consent/retention/breach workflows | ❌ | M3 + legal review |
| Pen-test, clinician UAT, go-live gates | ❌ | M7 (human blockers) |

## Milestones (small, verifiable; each needs tests + docs to close)

- **M1 — Tenant isolation foundation (✅ DONE 2026-10-13 — 84/84 tests green: 36 offline + 26 isolation on PG17 + 22 hardening).** Multi-tenant Postgres schema
  with RLS (`tenants`, `memberships`, `tenant_settings`, `patients`, `encounters`,
  `audit_events`, tenant-scoped storage) + automated cross-tenant tests (A↔B
  record/doc/search/IDOR attempts all fail) + SW `/api/` bypass + security headers
  + PIN hashing/lockout + stronger backup passwords + repo hygiene + `npm test`.
  Exit: isolation suite green against real Postgres; `npm test` green.
- **M2 — Hardening & ops (✅ DONE 2026-10-13 — 111/111 green: 45 offline + 26 isolation + 30 hardening + 10 api; client restore drill 145 ms; live PITR drill pending Supabase project).** Inactivity lock, secret/CSP roadmap step, staging env,
  backup-restore drill (Supabase PITR) with measured RTO, uptime/health checks.
- **M3 — Core platform (✅ DONE 2026-10-13 — 176/176 green: 75 offline + 58 isolation + 33 hardening + 10 api; live MFA/invite timing needs staging per M3-MANUAL-TESTS).** Org signup/onboarding UI, invites + roles (pediatrician,
  nurse, pharmacist, MRD, billing, auditor…), MFA, break-glass, server audit,
  usage quotas, suspension-with-export-grace, DPDP consent/retention baseline.
- **M4 — Web migration to relational core.** Dual-write (blob + relational),
  conflict-safe sync, idempotent orders; keep offline-first guarantees.
- **M5 — Clinical modules.** OPD depth, NICU longitudinal, MAR, validated
  fluids/feeds/nutrition calculator (every formula cited + tested), growth alerts.
- **M6 — Reports/analytics/interop.** Tenant-branded documents, MRD registers,
  dashboards with defined denominators, FHIR read API, ABDM Connector (if authorized).
- **M7 — Validation gates (human).** Independent pen-test, clinician/pharmacist/nurse
  UAT, backup-restore drill witnessed, legal/DPDP review. **No real patients before M7.**
- **M8 — Scale.** Multi-facility enterprise, dedicated DB/keys option, React/TS
  migration decision, performance/load program.

## First demonstrable slice (covers the prompt's "two hospitals" milestone)

After M1: two synthetic hospitals exist as rows with isolated patients; the
automated suite proves neither can read/write/list the other's records, documents,
or search results — at the **database policy layer**, not UI. App UI for hospital
self-registration lands in M3; until then onboarding is SQL + scripted (documented).
