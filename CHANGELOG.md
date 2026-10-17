# Changelog

## v10.23.0 — 2026-10-17 — IST date fixes + direct-print hardening
- 🐛 FIX: every due/catch-up/appointment date showed ONE DAY
  EARLY on India-timezone devices (UTC/local mix-up in
  addDays/todayISO). Dates are now timezone-proof calendar
  math; analytics month buckets + eMAR dose clocks fixed
  the same way. Suite now verified under Asia/Kolkata too.
- 🖨️ FIX: phone/browser Print menu no longer prints raw
  screen chrome — the visible page is auto-marked for
  printing (no more blank/stale prints), Record/Edit
  buttons + inputs + update banner are hidden on paper,
  and the print mark is always cleared afterwards.
- 📲 SW cache v13 so devices pick up the fix with the
  "new version ready" banner.
- ✅ Verified with headless-Chrome print emulation (IST).
- Tests: 708/708 (502 offline + 107 isolation + 52 hardening + 47 api).

## v10.22.0 — 2026-10-17 — IAP ACVIP 2025 immunisation schedule
- 💉 Schedule rebuilt from the IAP ACVIP 2025 timetable
  (Indian Pediatrics 2026;63:311–324): 18 visits, 45 doses.
  Hep-B now birth + 6/10/14 w (4th dose as combo);
  TCV single dose at 6–9 mo with NO booster; flu is
  trivalent, annual till 5 y; new 18–19 mo visit
  (HepA-2 inactivated + Varicella-2); HPV single dose
  for girls 9–<15 y, 2-dose boys, 3-dose >15 y/
  immunocompromised; Tdap at 10 y; Td/Tdap at 16–18 y.
- 🗂️ Legacy safety: any recorded typhoid booster (TCVB)
  auto-moves to Additional-vaccines history on load —
  no record is lost. Vitamin A + JE stay flagged as UIP.
- 💊 Brand guide updated: HPV ages (Cervavac 9–26,
  Gardasil-9), Havisure HepA, Vaximune/Pneumoguard-13
  + Pneumoshield-14 (primary-only), PCV20 >18 y.
- ✅ Verified with headless-Chrome A4 screenshot.
- Tests: 700/700 (494 offline + 107 isolation + 52 hardening + 47 api).

## v10.21.0 — 2026-10-17 — Immunisation card as record table (paper-schedule format)
- 💉 Card rebuilt like the clinic's paper schedule: one row per
  visit — Age | Recommended Vaccines | Due on | Brand given |
  Given on | Batch (navy header). Given cells fill from
  records (brand + mfr + batch); pending cells stay blank so
  the doctor can write in them. Next-due visit highlighted.
- 📄 Same record table in the downloadable parent file
  (wider layout, matching columns).
- 🔄 Supersedes the v10.20 card collapse: a record card must
  show the full schedule with writable future rows; the
  age-exact rule still applies to reports (milestones etc.).
- ✅ Verified with headless-Chrome A4 screenshot.
- Tests: 697/697 (491 offline + 107 isolation + 52 hardening + 47 api).

## v10.20.0 — 2026-10-17 — Clustered, age-exact printouts
- 🌟 Milestones print: current band clustered by domain (group
  subheads, no repetitive domain column); earlier bands are one
  summary line each; future bands gone entirely — report shows
  exactly the assessment age. Interpretation + overdue list kept.
- 💉 Immunisation card: visits clustered with status subheads
  (✅ Complete / ⏰ Due date); only given visits + next due visit
  print in full — later visits collapse to one line. Same
  clustering in the downloadable parent file. Cards are one page.
- 📏 House rule going forward: printouts show age-relevant data
  only — no long future/unmarked documents anywhere in the app.
- ✅ Both verified with headless-Chrome A4 screenshots.
- Tests: 696/696 (490 offline + 107 isolation + 52 hardening + 47 api).

## v10.19.0 — 2026-10-17 — Immunisation card: logo, layout, useful QR
- 🏥 Hospital logo now prints on the Digital Immunisation Card
  (was missing — header showed name/address only).
- 🎨 Card rebuilt as a proper certificate: letterhead band (logo +
  clinic + doctor/address/reg), verify-code badge, tidy child-info
  + QR row, signature + date row, audit footer.
- 📷 QR made genuinely useful: framed scannable box with plain
  instructions ("Scan at any KidGrow clinic to verify / import"),
  plus a human-readable verify code (KG-XXXXXX) as fallback.
- ✅ Verified with a headless-Chrome A4 screenshot before commit.
- Tests: 692/692 (486 offline + 107 isolation + 52 hardening + 47 api).

## v10.18.0 — 2026-10-17 — Milestones print: due/overdue + interpretation
- 🖨️ Future age bands no longer print full unmarked tables — one
  compact line each ("not due yet — still has time"). Bands scored
  ahead still print fully ("assessed ahead of age").
- 🖨️ Overdue items (marked ✗ at/past the right age) print in red as
  "✗ Not attained at appropriate age" with highlighted rows; early
  ✗ items read "✗ Not yet — still has time".
- 📋 New "Overall interpretation" section at the end: verdict
  (On track / Monitor closely / Needs attention), the overdue-item
  list with bands, and a still-has-time note for upcoming bands.
- 🖥️ Same due/overdue logic applied to the on-screen band verdict.
- ✅ Verified with a headless-Chrome A4 screenshot before commit.
- Tests: 689/689 (483 offline + 107 isolation + 52 hardening + 47 api).

## v10.17.3 — 2026-10-17 — Larger, clearer sidebar logo
- 🎨 Sidebar logo tile 56 → 66px; uploaded clinic logo now fills
  the tile on a clean white background (was a small 40px image on
  gradient) — clearly visible on the navy sidebar. Verified with a
  headless-Chrome screenshot.
- Tests: 683/683 (477 offline + 107 isolation + 52 hardening + 47 api).

## v10.17.2 — 2026-10-17 — Revert side-by-side print trial
- ↩️ Reverts v10.17.1 (never deployed): growth charts print one per
  row again, standard resolution. A4 density (v10.17.0) kept.
- Tests: 682/682 (476 offline + 107 isolation + 52 hardening + 47 api).

## v10.17.0 — 2026-10-17 — A4 professional print density
- 🖨️ New `@page` rule: A4 with 10/9/11mm margins — predictable,
  full-sheet output instead of browser-default margins.
- 🖨️ Print density overhaul (all printouts): 12px base type, compact
  cards (11/13px padding, full width), tighter tables (5/7px cells),
  headings, alerts, key-value lists and letterheads — no more
  half-empty pages.
- 🖨️ Empty blocks (blank alerts/hints) auto-hidden in print; headings
  never strand at page bottom; tables/cards keep full-width.
- 🖨️ Receipts + vaccine cards go full-width in print (were 560px).
- Tests: 682/682 (476 offline + 107 isolation + 52 hardening + 47 api).

## v10.16.0 — 2026-10-17 — Production billing hardening
- 🐛 Cancelled subscriptions now keep paid access till period end
  (previously any `cancelled` status hit the paywall immediately) —
  with "Cancelled · access till <date>" label, banner countdown and a
  Resubscribe button.
- 🔒 Webhook state machine fixed: `subscription.authenticated`
  (mandate ok, first charge pending) stays gated as pending — only
  activated/charged (money moved) grants active.
- 🔒 Failed FIRST payment can no longer grant `past_due` access —
  past_due now requires a previously-paid status (active/cancelled).
- 🗄️ New migration `0006_billing_grants`: EXECUTE on
  `ensure_profile()` for authenticated users (trial provisioning
  failed exactly when the signup trigger was absent). Run on staging
  AND production.
- 🖨️ Trial/subscription banner + toast no longer print on PDFs.
- 🛡️ CSP widened to `*.razorpay.com` (script/connect/frame) so UPI
  AutoPay + future checkout hosts never break on a locked CSP.
- 🧾 Invoice link relabelled Download → Receipt.
- 🔢 Version synced: package.json 10.16.0 (health endpoint).
- Tests: 679/679 (473 offline + 107 isolation + 52 hardening + 47 api).

## v10.15.2 — 2026-10-17 — Growth print: no tabs, no duplicate chart
- 🐛 Growth sub-tabs (Charts / All charts / Full assessment / Velocity /
  Puberty / Standards) no longer print — the tab bar is now `no-print`
  (it was the only tab bar outside a toolbar; all others verified hidden).
- 🔍 "Weight-for-age duplicated at end" traced to the same stale-client
  screen leak as v10.15.1 (report's own 6 charts verified distinct) —
  fixed at delivery level (below), not just in CSS.
- 📦 Service worker cache bumped v10 → v11 so every device re-downloads
  the shell (with the v10.15.1 print fix) on next visit instead of
  serving stale CSS indefinitely.
- Tests: 665/665 (468 offline + 107 isolation + 52 hardening + 38 api).

## v10.15.1 — 2026-10-17 — Printout no longer mirrors the screen
- 🐛 Fixed: printouts showed the current screen page first, then the real
  content. Root cause: `.page.active{display:block}` (specificity 0,2,0)
  beat the print rule `.page{display:none}` (0,1,0), so the visible page
  leaked into print. Print-hide is now `!important`; the `.printing`
  page still wins by source order.
- 🐛 Same fix for open modals (`.modal-bg.open` had the same leak) —
  modals are now hidden in print.
- Tests: 664/664 (467 offline + 107 isolation + 52 hardening + 38 api).

## v10.15.0 — 2026-10-17 — First Foods enrichment + logo & copyright
- 🍲 Complementary-feeding booklet enriched from the reference handbook:
  6 food & calorie guides (grains, pulses, proteins, fats, veg, fruit),
  7 low-cost recipes with age badges + cost/kcal, allergy note, and a
  myths-vs-facts table (EN first; TA/HI fall back to EN pending translation).
- 🏥 Every booklet now centers the hospital logo on its cover — pulled
  live from the app's clinic settings (Settings → logo); the topic icon
  shows only when no logo is set.
- ©️ Copyright protection: © year + clinic-name line on the cover,
  screen footer, and a fixed footer on EVERY printed page, plus a
  "do not reproduce without permission" notice and copyright meta tag.
- Tests: 664/664 (467 offline + 107 isolation + 52 hardening + 38 api).

## v10.14.0 — 2026-10-17 — Mother-booklet design for every handout
- 📖 NEW booklet engine (tools/make-booklets.js): all 22 handout topics ×
  EN/TA/HI = 66 print-ready booklets in warm mother-booklet design —
  cream pages, orange header bar, dark-green footer, color-blocked
  sections, numbered steps, tinted charts, red-flag boxes, A4 print CSS.
- 🔘 Handout toolbar gains a 📖 Booklet button opening the current
  topic+language booklet in a new tab (works offline via runtime cache).
- Play booklets include all 5 age bands; fever booklet carries the
  weight-based dose formula; cold booklet keeps the breath guide.
- Tests: 661/661 (464 offline + 107 isolation + 52 hardening + 38 api).

## v10.13.0 — 2026-10-17 — Infant Feeding Handbook under Handouts
- 📖 All 13 handbook chapters now live under Handouts as separate headings
  (new "Infant Feeding Handbook" group): first 1,000 days, milk science,
  position/latch, expressed milk, term first weeks, preterm/LBW, formula,
  first foods 6–24 mo, growth monitoring, mother's health, illness feeding,
  special situations, counselling guide — each condensed to about/do/don't/
  expect/red-flags in EN/TA/HI.
- 🔗 Every handbook handout links its full illustrated chapter
  (handbook/phase1–4.html, 26 original SVG figures) — readable offline,
  cached by the service worker, opens in a new tab, hidden on print.
- 🗂️ Topic picker now grouped: "Everyday care" (9) + "Infant Feeding
  Handbook" (13) = 22 handout topics, all trilingual.
- Tests: 658/658 (461 offline + 107 isolation + 52 hardening + 38 api).

## v10.12.0 — 2026-10-17 — Breastfeeding + complementary feeding handouts
- 🤱 NEW handout: Breastfeeding complete guide — first-hour start, colostrum,
  8–12 feeds/day, hunger cues, attachment check, hindmilk, burping, 6+ wet
  nappies, nursing-diet reassurance, 2-year continuation + red flags.
- 🍼 Expressed-milk storage chart (room 4h / fridge 4d / freezer 6–12mo /
  thawed 24h, never refreeze) in all 3 languages.
- 🍽️ "Starting solids" upgraded to full Complementary feeding (6–23 mo):
  180-day start, meal-building formula, daily animal-source + fruit/veg,
  day-wise meal-plan chart (frequency, katori quantities, textures),
  illness feeding, monthly weighing, no salt/sugar <1y.
- 🎨 Handouts now more visual: tinted section cards, gold "golden rule" boxes,
  teal chart tables — all print in color. 9 topics, EN/TA/HI throughout.
- Tests: 655/655 (458 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.5 — 2026-10-17 — Standards-tab accuracy audit
- 🔬 Audited every Standards & method claim against the code, the bundled LMS
  data, and the authoritative sources (WHO anthro tables, CDC z-score files,
  IAP 2015 paper, Fenton 2025 3rd-generation publication) — 14 of 16 claims
  verified exact (ranges, cutoffs, formulas, flags, URLs).
- 🐛 Fixed the 2 gaps: CDC 5+ note now flags BMI <P5 as "Underweight range"
  (was "Healthy range"); dropped the unverifiable "2022 extended BMI" wording
  (severe-obesity classes use the standard %–of–P95 method) and reworded the
  Fenton note to "data aren't embedded in-app".
- Tests: 649/649 (452 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.4 — 2026-10-17 — Standards & method tab fix
- 🐛 Fixed: Growth → "ⓘ Standards & method" tab opened empty — the tab-click
  handler never called its renderer (content only appeared after a reload).
  One-line fix; all four cards now render on click.
- Tests: 646/646 (449 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.3 — 2026-10-17 — Assessment-grade handouts
- 🫁 Cold handout gains a breath-rate guide (age-wise cutoffs + chest-indrawing
  watch) so parents count for 1 minute and know exactly when to return same-day.
- 💧 ORS handout gains a weight-based 4-hour ORS plan strip (75 mL/kg, rounded),
  personalized like the paracetamol strip, plus a twice-daily dehydration check.
- 🍼 NEW topic: newborn warning signs (0–28 days) — feeding, warmth, cord care,
  breathing count, and a same-day return list (fits, yellow palms/soles, …).
- 🚨 Fever/vomiting red flags strengthened with general danger signs (can't
  drink/breastfeed, vomits everything, unusually sleepy).
- Tests: 645/645 (448 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.2 — 2026-10-17 — Rich parent handouts + dose strip
- 📄 Handouts rebuilt from plain bullets into color-coded sections: ℹ️ What's
  happening · ✅ numbered do-steps · 🚫 myth-busting don'ts · 🕐 what to expect
  · 🚨 red flags — all 7 topics complete in EN/TA/HI, with clinic letterhead
  (logo, doctor, phone), child name/age/weight strip, and advice footer.
- ⚖️ NEW: weight-based paracetamol dose strip on the fever handout — pulls the
  child's latest weight and prints exact mg + syrup/drops mL (confirm w/ doctor).
- 🤮 NEW topic: vomiting home care (ORS sips schedule, position, red flags).
- 🐛 Fixed: play-prescription age band always showed "6 years+" (NaN month math)
  — now auto-picks the correct band from the child's real age.
- Tests: 639/639 (442 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.1 — 2026-10-17 — Color printing + ink-saver toggle
- 🖨️🎨 Printouts now keep their color (badges, charts, banners) — the print CSS
  forces exact color reproduction so the browser no longer strips backgrounds.
  New "Print in color" checkbox in Settings → Clinic profile (on by default);
  uncheck for grayscale ink-saver mode. Applies to all reports immediately.
- Tests: 633/633 (436 offline + 107 isolation + 52 hardening + 38 api).

## v10.11.0 — 2026-10-16 — Sunrise dashboard home + MRN + lab review
- 🌅 New **Sunrise theme** (warm cream + deep teal + gold) joins Light/Dark in a
  3-way header toggle; fresh installs start on Sunrise, saved prefs untouched.
- 🏠 Dashboard Home rebuilt per mockup: greeting + type-ahead patient search
  (MRN-aware, keyboard friendly), Start visit / Register actions, and 4 clinic
  stat cards (patients today, due ≤7d, growth flags, vaccine dues) — every
  number rides real data and drills into its list (queue, schedule/eligibility,
  Analytics growth, due tabs); Schedule alerts carry per-child WhatsApp links.
- 📋 Minimal MRN: auto-assigned 4-digit record numbers on registration, backfilled
  on load/import, searchable in type-ahead, shown on the hero + patient cards.
- 🧪 Lab reports gain a reviewed flag + one-tap Mark reviewed; the dashboard
  counts unreviewed reports from the last 60 days. Also: shared global `toast()`
  (fixes latent crashes in plain-script callers), empty-roster graceful states.
- Tests: 630/630 (433 offline + 107 isolation + 52 hardening + 38 api).

## v10.10.7 — 2026-10-16 — Pricing + Billing merged into one Subscription page
- 💳 The separate Plans & Pricing page is gone — one **Subscription** entry
  (System section) serves both states: visitors/expired accounts see the
  pitch (price, features, trial/subscribe CTA, FAQ); trial/active/past-due
  accounts see status, invoices, subscribe/update/cancel. The duplicated
  "You are subscribed — manage from Billing" block is deleted.
- Old links keep working: `#pricing` and `go('pricing')` redirect to the
  merged page via `ROUTE_ALIASES`; role rules unchanged (Frontdesk/Nurse/
  Pharmacist still blocked — pitch CTAs are owner actions).
- Tests: 593/593 (396 offline + 107 isolation + 52 hardening + 38 api).

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
