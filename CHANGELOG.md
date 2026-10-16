# Changelog

## v10.10.6 — 2026-10-16 — Atomic restore + undo import + centralized schedule version
- 🛡️ Every restore path (JSON + encrypted) now funnels through one validated
  funnel: validate-first with per-child checks, a rich confirm preview
  (children · visits · measurements · vaccine entries · backup date), clean-
  slate replace (stale keys no longer survive a "replace all"), and an
  automatic pre-import fallback. New **↩ Undo last import** (Data page +
  Settings) rolls back one mistaken restore.
- 🏷️ Vaccine schedule version centralized to `VAX_SCHEDULE_VERSION`
  ("IAP ACVIP 2023-24", data.js — update only after clinical review); all
  print footers, handouts, certificates and static page footers draw from it.
  A test fails if the year is hardcoded anywhere else.
- 📊 Dashboard stat cards now drill into their screens (Children ·
  Vaccines · Milestones · Growth), keyboard-accessible with Enter.
- Tests: 590/590 (393 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.5 — 2026-10-16 — Type-ahead patient search + duplicate-registration guard (Build A)
- 🔍 Children-page search is now ranked type-ahead: every word must match
  across name, parents, phone (digit-normalized), ABHA and DOB year, with
  name hits outranking parent hits, recent patients first, and a "matched:"
  note on each card explaining why it hit. Empty query lists recents first.
- ⌨️ Keyboard-first: `/` jumps to patient search from anywhere (ignored while
  typing or with a modal open), ↓/Enter opens the top hit, arrows move across
  cards, Enter opens the focused card, Esc clears. Focusable cards use the
  standard focus ring; listbox/option roles added.
- ⚠️ Registration screens for duplicates (same name+DOB or phone+DOB = strong;
  same name alone = verify) and asks for confirmation before saving a likely
  duplicate — edits exclude self.
- Tests: 573/573 (376 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.4 — 2026-10-16 — Comprehensive growth report: all charts guaranteed + full detail
- 🐛 The comprehensive report could reach the printer before its six chart
  images finished decoding, so print/PDF sometimes showed fewer charts.
  `printPage` now waits for embedded images to decode (1.5 s safety timeout)
  before opening the print dialog — all call sites benefit.
- 📈 Report is now truly comprehensive: per-chart latest-%ile/z/grade
  captions, full measurement history, interval-by-interval velocity with
  norms, Tanner puberty snapshot + mid-parental target height, and a
  references & methods note (WHO 0–5 exact · CDC/IAP 5–18 · ±0.7 cm rule ·
  corrected-age rule). Missing charts render an explicit placeholder instead
  of silent gaps; header shows an honest "n of 6" count.
- Growth toolbar clarified: "Growth sheet (1 page)" vs "Full report (all charts)".
- Tests: 553/553 (356 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.3 — 2026-10-16 — Token Display exit (kiosk-trap fix)
- 🐛 The Display page hides all app chrome but offered no way back — users were
  stuck. Added a visible ← Exit display button, Esc-to-exit (works alongside
  fullscreen: first Esc leaves fullscreen, second returns to Dashboard), and a
  browser-blocked-fullscreen notice. Footer extracted as a tested pure builder.
- Tests: 540/540 (343 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.2 — 2026-10-16 — Workflow-grouped navigation (8 sections, all 33 routes mapped)
- 🗂️ Menu regrouped around work: Home · Patients · Clinic ops · Clinical care ·
  Immunization (vaccines + card + AEFI + stock together) · Specialty (NICU/eMAR) ·
  Reports · System. Emergency + Calculators moved one tap away in Clinical care.
- Collapse prefs storage bumped (kgNavCol2) so stale v1 prefs don't linger;
  Specialty/Reports/System start collapsed. Role-hiding + filter untouched.
- New guard: test fails if any TITLES route lacks a menu button or vice versa.
- Tests: 534/534 (337 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.1 — 2026-10-16 — Shorter side menu: collapsible sections + filter + role-hiding fix
- 📂 All 5 menu sections collapse (Insights + System start collapsed); choice
  persists per browser. 🔍 Filter box narrows the menu as you type (Esc clears).
- 🐛 Fixed: tenant.js redeclared `applyRole` and recursed into itself, so
  role-based menu hiding never ran — renamed to `applyServerRole`, front.js
  owns nav hiding again (Frontdesk/Nurse see shorter menus), applied at boot.
- Tests: 533/533 (336 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.0 — 2026-10-16 — NICU documents + catch-up planner + lot picker
- 🖨️ NICU discharge summary + shift handover (printable, letterhead, branded footer).
  Follow-up advice captured at discharge; summaries refuse while still admitted.
- 📋 Catch-up planner on the Vaccines page: missed doses sequenced with
  earliest-possible dates (≥28 d between visits + after same-series doses),
  one-tap Record, rotavirus eligibility flag, IAP-verify disclaimer. Exact
  per-antigen minimum intervals quarantined for M7 pediatric sign-off.
- 💉 Stock lot picker in both dose modals (qty/expiry badges, expired lots
  visible-but-disabled, given-elsewhere opt-out, batch autofill). Fixes combo
  over-deduction: one shot = exactly one deduction, lot ID stamped on record.
- Tests: 522/522 (325 offline + 107 isolation + 52 hardening + 38 api).

## v10.9.0 — 2026-10-16 — Billing center
- 💎 Pricing page (public) + 💳 Billing page (Doctor/Admin only): live
  subscription status, renews date, invoice table, past-due recovery,
  cancel-at-period-end (access runs to term, webhook flips status).
- Server: `api/billing-info` + `api/cancel-subscription` (authed, tenant-safe).
- Tests: 482/482.

## v10.8.0 — 2026-10-16 — Consult workflow: dup-dose guard → header → timeline → role dashboards
- Unified patient header on 12 clinical screens; unified patient timeline;
  per-role dashboards (doctor/nurse/pharmacist/reception/admin) with first-name
  greeting; same-day duplicate-dose block + overwrite confirm.
- Tests: 413/413 → 450/450.

## v10.7.0 — 2026-10-15 — Go-live hardening + clinical validation
- FHIR subpath routing fix, billing schema-order fix, hostname-aware
  staging/prod config, EMR usability audit (11/20 strict), sex-tolerant growth
  refs, expired-stock guard.
- Tests: 385/385 → 405/405.

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
