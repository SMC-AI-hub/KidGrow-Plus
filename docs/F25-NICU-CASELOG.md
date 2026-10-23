# F25 — NICU bilirubin + discharge-builder case log (≥10 real cases)

**Rule: no real patients until the builders below agree with the unit's
expected management on ≥10 real (de-identified) cases, signed.**
Code under test: bilirubin logic + `KGCONTENT.nicu` in `js/cdata.gen.js`
(NICE CG98 term table h0–96: repeat/consider/photo/exchange; preterm
phototherapy formula GA×10−100 for age ≥72 h; mg/dL→µmol/L ×17.1;
rise-rate 8.5; stop-below 50) and the discharge builder in `js/nicu.js`
(`dischargeSummaryData` / `dischargeSummaryHTML`, gated by
`dischargeValid`).

Validator: ______________________ Qualification/reg: ______________________
Date range: ____________ App commit tested: ____________
Unit protocol ref (edition/date): ______________________

Case mix (must include): ≥2 preterm (<35 wk) · ≥1 exchange-range bili ·
≥1 stop-phototherapy decision · ≥2 values entered in mg/dL (unit conversion).
Per case: enter real inputs, record the app's tier/action + discharge summary,
compare with expected management. Mark: ✅ agree · ✏️ app wrong (file bug
with exact inputs, STOP further cases until fixed + retested).
**Any wrong clinical number fails the gate, not just the case.**
De-identify: case IDs only, no names/UHID/DOB in this log or scans.
Initial + date every case. File in `evidence/m7/` with the M7 gates.

| Case | GA | Age (h) | Bili (value + unit) | Risk factors | App tier / action | Expected management | Verdict | Dsumm OK? | Initial/date |
|------|-----|---------|---------------------|--------------|-------------------|---------------------|---------|-----------|--------------|
| 1 |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  |  |
| 11 (35–37 wk) |  |  |  |  |  |  |  |  |  |
| 12 (preterm <72 h) |  |  |  |  |  |  |  |  |  |

Discharge-summary section checklist (tick per case in the "Dsumm OK?" column
only if ALL hold): demographics correct · admission details (GA, birth wt,
mode of delivery) · hospital course accurate · procedures listed ·
feeds + growth recorded · immunisations given/planned · follow-up plan with
dates · red-flag counselling present.

Validator signature: ______________________ Date: __________
Counter-sign (clinic owner): ______________________ Date: __________

## Automated companion (for the validator's context — read before starting)
`tests/f25-validation.test.js` (20 asserts, green) locks the builder's CURRENT
boundary behavior. It found three things the validator must rule on:
1. SUSPECTED BUG — preterm ≥72 h: the formula computes a photo line (e.g. 190
   at 29 wk) but the flag path returns info instead, so NO photo/exchange
   warning ever fires for preterms (even at 400). If the unit protocol says
   preterms must warn, the code must be fixed and this sheet re-run.
2. No stop-phototherapy logic exists (pack constant `biliStopBelow: 50` is
   unwired) — the app stays silent below all lines; stopping is entirely the
   clinician's call until logic is specified + coded + tested.
3. Risk factors do NOT shift tiers (no such input exists) — same numbers give
   the same tier with or without risk factors. Confirm this matches unit protocol.
These tests check the code against its own table — they do NOT replace this
sheet (real cases vs NICE CG98 / unit protocol).

## Proposed rulings on the three findings (VALIDATOR: confirm against NICE CG98
threshold graphs / unit protocol, then sign and date each)
P1. Preterm warnings are gate-blocking and WILL be fixed before real cases:
(a) ≥72 h: photo line GA×10−100 AND exchange line GA×10 both fire warnings
(29 wk → 190/290); (b) <72 h: straight line from 40 at 0 h to the 72 h photo
value, and from 80 at 0 h to the 72 h exchange value (secondary source: UNSW
trial protocol summarising CG98 — confirm on NICE graphs A–F). Validator: ____ Date: ____
P2. Stop rule: specify-and-build is PROPOSED — stop considered when TSB is
≥50 µmol/L (≈2.9 mg/dL, NNF guideline) BELOW the applicable photo line;
haemolytic jaundice needs 2 consecutive such values (needs a haemolysis input —
validator rules: build the input, or handle haemolytic cases manually).
Alternative: declare out of scope with explicit in-app "clinician decision"
text + this requirement revised here. Validator ruling: ____ Date: ____
P3. Repeat timing: the app currently prints "repeat in 6h" / "6-12h"; NICE uses
18/24 h (risk-dependent) within 50 of threshold. Validator reconciles which
intervals stand; if NICE is adopted, a risk-factor input is added to drive
18 h vs 24 h. Validator ruling: ____ Date: ____
Term-table anchors corroborated against a secondary source (use NICE graphs for
the sheet itself): 0 h 100/100 · 12 h 150/200 · 24 h 200/300 · 96 h 350/450 —
all match the coded table.
