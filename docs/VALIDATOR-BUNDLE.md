# Validator sign-off bundle (cover sheet)

One checklist for every human countersign the gates require. Automation is
conformance-only and substitutes for NONE of the below. Standing rules for
every sheet: any wrong clinical number fails its gate (not just the row);
initial + date every row; F25 cases de-identified (case IDs only — no names,
UHID, or DOB in sheets or scans); file signed sheets in `evidence/m7/`
(see its README for expected filenames; retain ≥ 3 years).

## Checklist

| # | Item | Sheet | Requirement | Status |
|---|------|-------|-------------|--------|
| 1 | F1 dose pack, 30/30 rows | `docs/F1-DOSE-SIGNOFF.md` (generated from code v10.46 — regenerate + re-verify affected rows if `js/drugs.js` changed) | Verify every row vs CIMS / IAP / standard paediatric references | ⬜ unsigned |
| 2 | F9 growth spot-check, ≥20 cells | `docs/F9-GROWTH-SPOTCHECK.md` | Read official WHO + INTERGROWTH charts, enter same inputs in app, compare (±0.05 z) | ⬜ unsigned |
| 3 | F9 companion flag FC-1 | This bundle, §FC below | Rule: under-91d muacfa / over-5y inputs currently CLAMP to the edge (flagged) instead of refusing — accept or require refuse | ⬜ unruled |
| 4 | F9 companion flag FC-2 | This bundle, §FC below | Confirm intended: `newbornSize` switches reference populations at 33+0 (vp→nb, up to ~42% step on the bw −3SD line) | ⬜ unruled |
| 5 | F25 findings P1 + P2 + P3 | `docs/F25-NICU-CASELOG.md`, "Proposed rulings" block (in-sheet sign lines) | P1: confirm preterm lines on NICE graphs A–F. P2: rule stop-rule input vs manual handling. P3: countersign the keep-app-intervals ruling | ⬜ unsigned |
| 6 | F25 real cases, ≥10 | `docs/F25-NICU-CASELOG.md` | Case mix per header (≥2 preterm <35wk, ≥1 exchange-range, ≥1 stop decision, ≥2 mg/dL entries); app tier/action vs expected management | ⬜ unsigned |
| 7 | M7 gate reports | `docs/M7-VALIDATION-PACK.md` (pentest, UAT, restore drill, DPDP opinion, go/no-go) | Per the pack | ⬜ owner's track |

Automation record (for the file, not a substitute): F9 companion
`tests/f9-growth.test.js` 31/31 at staging `78d47b9`; F25 suites 39/39 +
40/40; isolation 166/166; full `npm test` exit 0.

## FC rulings (validator completes)

**FC-1 — out-of-range growth inputs clamp (flagged) instead of refusing.**
Under-91-day muacfa and over-5-year age inputs return values computed at the
nearest table edge with a `clip` flag (proven by the companion suite). Ruling
(accept clamping / require refusal / other): ___________________________
Validator: ______________________ Date: __________

**FC-2 — INTERGROWTH band switch at 33+0.** `newbornSize` uses the very-preterm
reference below 33+0 and the newborn standard at/above (per the tables'
documented `use` note); the same weight can classify differently across the
boundary (largest step ~42% on the bw −3SD line). Availability is unaffected
(both sides resolve). Confirm intended: ___________________________
Validator: ______________________ Date: __________

## Bundle receipt

All items above received back signed (or explicitly deferred with owner
acceptance): ______________________ Date: __________
Clinic owner countersign: ______________________ Date: __________
