# F9 — Growth-chart spot-check log (WHO + INTERGROWTH-21st)

**Rule: no real patients until ≥20 cells below are verified against the
official charts and signed.** Code under test: `js/ref-who.js`
(WHO MGRS 2006 daily LMS, days 0–1826) and `KGCONTENT.intergrowth` in
`js/cdata.gen.js` (INTERGROWTH-21st Newborn Size Standards, 33+0–42+6 +
very-preterm band; z −3…+3; tables bw/lt/hc).

Validator: ______________________ Qualification/reg: ______________________
Date range: ____________ App commit tested: ____________
Official refs used: WHO ______________________ INTERGROWTH PDFs (tables_provenance): ______________________

Method per row: (1) read the official chart value for the coordinate;
(2) enter the same inputs in the app; (3) record both; tolerance ±0.05 z
(or app-display rounding). Mark: ✅ match · ✏️ app wrong (file bug with exact
inputs, STOP further rows until fixed + retested) · ❌ coordinate invalid.
**Any wrong clinical number fails the gate, not just the row.**
Initial + date every row. File in `evidence/m7/` with the M7 gates.

| # | Table | Sex | Age / GA / length | Line | Official value | App value | Verdict | Initial/date |
|---|-------|-----|-------------------|------|---------------|-----------|---------|------------|
| 1 | WHO wfa | boy | 0 days | median |  |  |  |  |
| 2 | WHO wfa | girl | 0 days | median |  |  |  |  |
| 3 | WHO wfa | boy | 180 days | −2 SD |  |  |  |  |
| 4 | WHO wfa | girl | 365 days | +2 SD |  |  |  |  |
| 5 | WHO lhfa | boy | 0 days | median |  |  |  |  |
| 6 | WHO lhfa | girl | 730 days | −2 SD |  |  |  |  |
| 7 | WHO bmifa | boy | 365 days | median |  |  |  |  |
| 8 | WHO bmifa | girl | 1826 days (5 y edge) | +2 SD |  |  |  |  |
| 9 | WHO hcfa | boy | 0 days | median |  |  |  |  |
| 10 | WHO hcfa | girl | 180 days | +3 SD |  |  |  |  |
| 11 | WHO muacfa | boy | 365 days | median |  |  |  |  |
| 12 | WHO muacfa | girl | 91 days (youngest valid) | median |  |  |  |  |
| 13 | WHO wfl | boy | 45 cm (shortest) | median |  |  |  |  |
| 14 | WHO wfl | girl | 78 cm | −2 SD |  |  |  |  |
| 15 | WHO wfh | boy | 65 cm (shortest) | median |  |  |  |  |
| 16 | WHO wfh | girl | 110 cm | +2 SD |  |  |  |  |
| 17 | IG bw | boy | 40+0 | 50th |  |  |  |  |
| 18 | IG bw | girl | 33+0 (youngest std band) | 10th |  |  |  |  |
| 19 | IG lt | boy | 37+0 | 90th |  |  |  |  |
| 20 | IG hc | girl | 42+0 | 50th |  |  |  |  |
| 21 | IG bw (very-preterm band) | either | 28+0 | 50th |  |  |  |  |

Validator signature: ______________________ Date: __________
Counter-sign (clinic owner): ______________________ Date: __________
