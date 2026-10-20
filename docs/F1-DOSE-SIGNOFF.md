# F1 — Dose-pack clinician sign-off sheets (generated from code v10.46)

**Rule: no real prescriptions until every row below is verified against CIMS /
IAP / standard paediatric references and signed.** This sheet is generated from
`js/drugs.js` — if the code changes, regenerate and re-verify affected rows.

Validator: ______________________ Qualification/reg: ______________________
Date range: ____________ Reference used (edition): ________________________

Mark each row: ✅ correct as printed · ✏️ corrected (note new value) · ❌ remove.
Initial + date every row. File in `evidence/m7/` with the M7 gates.

| # | Drug (as coded) | Category | Coded dose | Coded max (mg) | Verdict | Initial/date |
|---|-----------------|----------|------------|----------------|---------|--------------|
| 1 | Paracetamol | Fever / pain | 15 mg/kg/dose | 1000 |  |  |
| 2 | Ibuprofen | Fever / pain | 10 mg/kg/dose | 400 |  |  |
| 3 | Mefenamic acid | Fever / pain | 6.5 mg/kg/dose | 250 |  |  |
| 4 | Amoxicillin | Antibiotic | 15 mg/kg/dose | 1000 |  |  |
| 5 | Amoxycillin + Clavulanate | Antibiotic | 15 mg/kg/dose | 1000 |  |  |
| 6 | Azithromycin | Antibiotic | 10 mg/kg/dose | 500 |  |  |
| 7 | Cefixime | Antibiotic | 8 mg/kg/day | 400 |  |  |
| 8 | Cefpodoxime | Antibiotic | 10 mg/kg/day | 400 |  |  |
| 9 | Cephalexin | Antibiotic | 12.5 mg/kg/dose | 500 |  |  |
| 10 | Cotrimoxazole (TMP-SMX) | Antibiotic | 4 mg/kg/dose | 160 |  |  |
| 11 | Metronidazole | Antibiotic | 7.5 mg/kg/dose | 500 |  |  |
| 12 | Albendazole | Antiparasitic | bands (see code) | — |  |  |
| 13 | Cetirizine | Allergy / cold | 0.25 mg/kg/dose | 10 |  |  |
| 14 | Levocetirizine | Allergy / cold | 0.125 mg/kg/dose | 5 |  |  |
| 15 | Loratadine | Allergy / cold | bands (see code) | — |  |  |
| 16 | Ondansetron | Vomiting | 0.15 mg/kg/dose | 8 |  |  |
| 17 | Domperidone | Vomiting | 0.25 mg/kg/dose | 10 |  |  |
| 18 | Zinc | Diarrhoea / nutrition | bands (see code) | — |  |  |
| 19 | ORS (WHO low-osmolarity) | Diarrhoea / nutrition | info-only directions | — |  |  |
| 20 | Vitamin D3 (maintenance) | Diarrhoea / nutrition | bands (see code) | — |  |  |
| 21 | Iron (elemental, treatment) | Diarrhoea / nutrition | 3 mg/kg/day | 200 |  |  |
| 22 | Salbutamol syrup | Wheeze / asthma | 0.1 mg/kg/dose | 4 |  |  |
| 23 | Montelukast | Wheeze / asthma | bands (see code) | — |  |  |
| 24 | Ambroxol | Cough | bands (see code) | — |  |  |
| 25 | Calamine lotion | Skin | info-only directions | — |  |  |
| 26 | Permethrin 5% cream | Skin | info-only directions | — |  |  |
| 27 | Fluconazole | Antifungal | 3 mg/kg/dose | 200 |  |  |
| 28 | Omeprazole | Gastric | bands (see code) | — |  |  |
| 29 | Hydrocortisone 1% cream | Skin | info-only directions | — |  |  |
| 30 | Xylometazoline 0.05% drops | Allergy / cold | info-only directions | — |  |  |

Also verify (separate sheets, same filing): vitals bands (`js/scores.js` /
exam flags), lab thresholds (`js/labs.js`), WHO/INTERGROWTH tables (`js/ref-who.js`,
`js/cdata.gen.js` — F9 spot-check ≥20 cells vs official charts), NICU bili +
discharge builders on ≥10 real cases (F25), QT/allergy packs.

Validator signature: ______________________ Date: __________
Counter-sign (clinic owner): ______________________ Date: __________
