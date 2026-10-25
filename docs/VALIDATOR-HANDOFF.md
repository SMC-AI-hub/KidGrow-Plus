# Validator handoff note (draft — owner: fill [brackets], then send)

To: Dr. [Name], [Qualification / Registration No.]
From: [Owner name], KidGrow-Plus (NeoKid Care paediatric EMR)
Date: [Date]

## What we are asking

Before real patients touch this system, we need your independent sign-off on
the sheets below. The cover checklist is `docs/VALIDATOR-BUNDLE.md`; the
automation record there (31/31 growth asserts, F25 suites green, isolation
166/166) proves our code is internally consistent — it does NOT substitute
for your verification against the official references.

| # | Sheet (attached / in repo `docs/`) | Your task |
|---|------------------------------------|-----------|
| 1 | `F1-DOSE-SIGNOFF.md` — 30 drug rows | Verify each coded dose + max vs CIMS / IAP / standard paediatric references. Mark ✅ / ✏️ (note correction) / ❌ per row. |
| 2 | `F9-GROWTH-SPOTCHECK.md` — 21 cells | Read the official WHO + INTERGROWTH charts, enter the same inputs in the app, compare (±0.05 z). ≥20 cells to pass. |
| 3 | FC-1 ruling (in `VALIDATOR-BUNDLE.md`) | Out-of-range growth inputs currently clamp to the table edge (flagged) instead of refusing. Accept, or require refusal. |
| 4 | FC-2 ruling (in `VALIDATOR-BUNDLE.md`) | Newborn-size engine switches references at 33+0 weeks (very-preterm → newborn standard). Confirm intended. |
| 5 | `F25-NICU-CASELOG.md`, P1–P3 block | Three proposed rulings on preterm lines, stop rule, and repeat timing — confirm each against NICE CG98 / unit protocol (in-sheet sign lines). |
| 6 | `F25-NICU-CASELOG.md`, ≥10 real cases | Run de-identified real cases through the bilirubin tiers + discharge builder; compare app output vs expected management. Case mix is specified in the sheet header. |

## Standing rules (all sheets)

- Any wrong clinical number fails its gate, not just the row/case — file the
  exact inputs, STOP that sheet until fixed + retested.
- Initial + date every row/case.
- F25 cases strictly de-identified: case IDs only, no names / UHID / DOB in
  the log or any scan.
- App version under test: staging branch commit [fill at send time]
  (F9 companion last green at `78d47b9`; F1 sheet generated from code v10.46 —
  tell us if you test a different commit).

## Return path

Please return signed sheets (scan or photo is fine) to [owner contact]. We
file everything in `evidence/m7/` (retained ≥ 3 years) and log each sign-off.
Questions on method or the app at any point — ask us, don't guess.

Thank you,
[Owner name]
