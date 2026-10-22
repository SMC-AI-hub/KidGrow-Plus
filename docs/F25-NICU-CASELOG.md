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

Discharge-summary section checklist (tick per case in the "Dsumm OK?" column
only if ALL hold): demographics correct · admission details (GA, birth wt,
mode of delivery) · hospital course accurate · procedures listed ·
feeds + growth recorded · immunisations given/planned · follow-up plan with
dates · red-flag counselling present.

Validator signature: ______________________ Date: __________
Counter-sign (clinic owner): ______________________ Date: __________
