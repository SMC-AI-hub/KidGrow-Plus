# Clinical + billing validation — review items 1–4

Date: 2026-10-15 · Commit: see log · Suite: 405/405 + 31/31 growth-numeric probe.
(Review item 5 verified in PROD-VERIFICATION.md; item 6 proposed there — awaiting greenlight.)

## 1. NICU workspace — audited, build proposed

Present (M5): admissions + validation, daily rounds + validation, discharge +
validation, LOS, census list, enteral feed guide (trophic→goal + q3h split),
basic eMAR (logDose with signature, dosesDue, adherence). All covered in suite.
Confirmed gaps (zero code matches): bed assignment, respiratory support
tracking (vent/CPAP/O₂), serial vitals/observation flows, fluid balance,
NICU lab trends, discharge-readiness checklist, abnormal-result
acknowledgment. Labs module is anaemia-focused (Hb/ferritin/D/B12), not NICU.
Proposed build (in order): bedded census → vitals/observation charting →
respiratory + fluids → NICU labs (bilirubin/glucose/CRP trends) + result
acknowledgment → discharge-readiness gate. Est. M/L.

## 2. Growth + corrected age — VALIDATED rigorously (2 fixes shipped)

31/31 numeric probes green: LMS round-trip (7 param sets incl. L=0 Box-Cox
limit), median→z=0 on live tables (2 sex × 4 indicators × 6 ages), A&S CDF +
Acklam inverse, table grid/LMS integrity, birth medians in physiological
range (unit check), WHO authenticity signatures (neonatal weight dip +
exact −0.67 length→height step at 24 mo), extremes finite (restricted-SD),
out-of-range flags, corrected-age cases (GA32+100d→44, negative never used,
stops ~2 y), end-to-end median child waz≈0, BIV implausibility flags.
Fixes shipped: (a) `sxB`/`sxW` crashed on server/import sex codes
('male'/'female'/'other') — 12 call sites (assess + charts) now tolerant,
other/unknown → boys ref as documented fallback (needs pediatric sign-off);
(b) regression tests added (10 asserts). Residual: independent pediatric
validation of schedule/grade thresholds before pilot (reviewer requirement).

## 3. Vaccination chain — audited, 1 safety fix shipped

Verified present: dose-due → appointments/schedule → batch capture →
administration record → **auto-deduct** (`stockDeduct`) → next-dose
scheduling → parent reminders + sent-log → AEFI register with India 24 h
serious-AEFI reporting cues → stock ledger with expiry/low/out alerts +
FEFO pick → historical import. Fix shipped: auto-deduct could silently
consume EXPIRED lots (FEFO sorts earliest-first) — expired lots are now
excluded, with a quarantine toast + ledger entry; regression-tested.
Open gaps: (a) NO duplicate-dose warning — re-recording a code silently
overwrites (safety gap, propose confirm-modal + same-day block); (b) catch-up
is guidance text only (propose minimum-interval engine); (c) batch/expiry
verification is manual entry (propose lot picker from stock). Pediatric
sign-off on schedule logic still required.

## 4. Subscription layer — backend enforced, product UI missing

Verified enforced: `accessFor` trial/active/grace gate (`cloud.js:48`),
plan quotas client + server (`plan_quota`, sync-op re-check in 0003),
authenticated `create-subscription` API (server-side plan), webhook handles
all 7 events incl. `payment.failed`→`past_due`, `subscription_events` audit
trail, self-grant impossible (0005, proven live). Missing product area: public
pricing page, plan comparison, billing history, invoice list (Razorpay emails
invoices today), in-app plan change/cancel, dunning UX for past_due,
trial→paid onboarding checklist. Proposed: billing center page (status,
history, invoices via Razorpay API, plan change, cancel) + pitch section for visitors (v10.10.7: merged into the billing page — no separate pricing route). Est. M.
Plan-change proration + GST invoices via Razorpay; no card data touches us.
