# Changelog

## v10.6.0 — 2026-10-14 — Formulary review + handoff
- 📚 Formulary review workflow (C1 → partial): per-drug source/edition sign-off page,
  ⚠️ unverified badges in the prescription picker + dose calc, structural validation
  of all 30 drugs (tested). Content verification remains M7 pharmacist UAT.
- 🔒 Role map covers NICU/eMAR/calculators/MRD/formulary for Frontdesk accounts.
- 📖 README rewritten, ARCHITECTURE + CHANGELOG added, synthetic staging seed added.
- Tests: 384/384 (209 offline + 97 isolation + 52 hardening + 26 api).

## v10.5.0 — 2026-10-14 — M6 reports/analytics/interop ✅
- MRD registers (admissions/discharges/births/deaths + CSV), denominator'd metrics,
  tenant branding on documents, GET-only FHIR R4 read API. G1 closed-invalid by re-audit.

## v10.4.0 — 2026-10-13 — M5 clinical modules ✅
- NICU longitudinal, eMAR + controlled-drug witness rule, validated calculators,
  growth alerts, clinical sync (LWW). 326/326.

## v10.3.0 — 2026-10-13 — M4 relational sync ✅
- Dual-write outbox, idempotent `apply_*_op` RPCs, conflict queue, double-submit
  guards. 240/240.

## v10.2.0 — 2026-10-13 — M3 core platform ✅
- Tenants/invites/MFA/break-glass/quotas/lifecycle/consents, staging checklist,
  DPDP notice template. 176/176.

## v10.1.0 — 2026-10-13 — M2 ops hardening ✅
- Idle auto-lock, CI, health endpoint, backup drill, runbooks. 111/111.

## v10.0.0 — 2026-10-13 — M1 audit + tenant RLS core ✅
- Phase 1 audit, tenant isolation suite on PG17, hardening suite. 84/84.
