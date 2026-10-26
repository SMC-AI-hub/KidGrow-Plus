# Independent Clinical-Data Validation Report — 2026-10-25

**Validator role:** agent acting as strict, adversarial clinical-data validator (separate pass from the build agent).
**Scope:** every number the app shows for growth (F9), the F1 high-risk dose sample, jaundice/NICU (F25),
and the Phase-7 lab bands. Security/migration work (P3.x) is out of scope here.
**Method:** exhaustive programmatic comparison against primary sources downloaded today (not spot-checks
wherever the source is machine-readable). Verdicts use three levels: **PASS** (matches primary source),
**FLAG** (deviation needing a fix or a documented validator override), **OBS** (observation — defensible but
the validator must consciously accept it).
**Code touched:** none. This report + the scripts under `evidence/validation-2026-10-25/` are the only artefacts.
In-code `verification: "PENDING"` strings are deliberately left for the human validator to flip.

Reproduction: all source URLs, file versions and comparison tolerances are listed per section. Re-run scripts
need the downloaded sources in `/tmp/whox`, `/tmp/ig` (re-downloadable from the URLs below).

---

## 1. F9 — WHO growth tables (ref-who.js): PASS, exhaustive

**Sources.**
- (S1) Official WHO expanded z-score tables, all 7 indicators × both sexes, downloaded 2026-10-25 from
  `https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/…`
  (`wfa/lhfa/bfa/hcfa/acfa/wfl/wfh`, `{boys,girls}-zscore-expanded-tables.xlsx`). URLs harvested from the
  indicator toolkit pages (e.g. `/child-growth/standards/weight-for-age`), except BMI which was pattern-guessed
  and verified (`bfa-boys-zscore-expanded-tables.xlsx`, 185,753 bytes, valid OOXML).
- (S2, independent triangulation) CDC `WHOref_d.csv` (daily LMS reference),
  `https://www.cdc.gov/growthcharts/who_child_ref/WHOref_d.csv` (1,087 KB, 16,716 rows).

**Method** (`evidence/validation-2026-10-25/validate_who.py`): every app grid point vs official L/M/S;
effective ±3SD lines recomputed via LMS and checked against the official SD columns. Flag thresholds:
L/M/S > 2e-4 (4× official rounding), SD lines > 0.002. App→official name map: bmifa↔bfa, muacfa↔acfa
(arm circumference — naming verified correct).

**Result — S1: all 14 table/sex combos BIT-IDENTICAL (max |ΔL|,|ΔM|,|ΔS| = 0.00e+00):**

| table | n rows ×2 sexes | max ‖ΔLMS‖ | max ‖ΔSD-line‖ |
|---|---|---|---|
| wfa | 1,827 | 0 | 5.0e-4 (official 3-dp rounding) |
| lhfa | 1,827 | 0 | 5.0e-4 (rounding) |
| bmifa | 1,827 | 0 | 5.0e-4 (rounding) |
| hcfa | 1,827 | 0 | 5.0e-4 (rounding) |
| muacfa | 1,736 (days 91–1826) | 0 | 5.0e-4 (rounding) |
| wfl | 131 (0.5 cm grid) | 0 | 5.0e-4 (rounding) |
| wfh | 111 (0.5 cm grid) | 0 | 5.0e-4 (rounding) |

Total: **18,572 rows / 55,716 LMS values, zero deviations.** SD-line diffs peak at exactly 5.0e-4 = half-ULP
of the official 3-decimal SD columns (expected; the app computes from full-precision LMS).

**Result — S2 (CDC, independent file):** all 10 age-table/sex combos agree to ≤ 3.9e-6 (max |ΔM| 3.81e-6 —
float32 rounding inside CDC's CSV, e.g. 3.3464000 vs 3.3464). Triangulated PASS.

**Verdict: PASS.** The ≥20-cell validator spot-check for WHO data is superseded by exhaustive verification.
FC-1/FC-2 (engine behaviour rulings) remain human items.

---

## 2. F9 — INTERGROWTH-21st tables (cdata.gen.js `intergrowth`): PASS, exhaustive

**Source:** official INTERGROWTH-21st z-score TABLE PDFs (not the chart PDFs of similar name),
downloaded 2026-10-25 from intergrowth21.com:
- newborn (33+0–42+6, Villar Lancet 2014): `…/2023-02/grow_newborn-zs-{boys,girls}_{bw,lt,hc}_table.pdf`
- very-preterm (24+0–32+6, Villar Lancet 2016): `…/2025-09/grow_verypreterm-zs-{boys,girls}_{bw,lt,hc}_table.pdf`
Matches the in-code `tables_provenance` string exactly.

**Method** (`evidence/validation-2026-10-25/validate_ig.py`): pdfplumber text extraction, GA-day mapping
(weeks×7+days), all 7 z-columns per row vs app, both coverage directions (no missing / no extra GA days).
Tolerances: bw ±0.005, lt/hc ±0.05 (half-ULP of official print precision).

**Result: 12/12 band/measure/sex combos EXACT — 5,586/5,586 cells, max |Δ| = 0.0000,**
70/70 newborn rows and 63/63 very-preterm rows matched per table, zero missing, zero extra.

**Verdict: PASS.** IG data layer exhaustively verified. (The vp→nb band switch at GA 230/231 is a real
≈42% median step between two different reference populations — already flagged as FC-2 for the validator.)

---

## 3. F1 — formulary high-risk sample (6 drugs vs FDA labels): PASS with 2 minor flags

**Source:** FDA DailyMed SPL XML (LOINC 34068-7 Dosage & Administration), pulled 2026-10-25 via the
public API (`drugnames.json → spls.json → spls/{setid}.xml`). Labels: Children's Tylenol suspension
(Kenvue), Children's Motrin suspension (Kenvue), Amoxil suspension, Zithromax, ondansetron tablets (generic),
Bactrim. SPL texts saved during validation (reproducible via script
`evidence/validation-2026-10-25/dailymed3.py`).
**Caveat:** US labels. Indian practice (IAP/CIMS, local brands/strengths) still needs the human validator —
unchanged residual item.

| drug | app | label / evidence | verdict |
|---|---|---|---|
| Paracetamol 15 mg/kg/dose Q6H, max 1000 | chart 5 mL (=160 mg) for 10.9–15.9 kg → top of band 14.7 mg/kg; label q4h max 5×/24 h | **PASS** (app Q6H + "max 4–5/24 h" is the conservative side) |
| Ibuprofen 10 mg/kg/dose Q8H, max 400 | chart 5 mL (=100 mg) for 10.9–15.9 kg → top 9.2 mg/kg; label q6–8h max 4×/day | **PASS** on dose |
| Amoxicillin 15 mg/kg/dose TDS (=45/day) | label: mild-moderate 20–25/day, **severe 40–45/day**; AAP high-dose AOM 80–90/day | **OBS-1** (below) |
| Azithromycin 10 mg/kg OD ×3 d | label-exact (sinusitis + AOM 3-day regimens); app `defDays: 3` consistent | **PASS** |
| Ondansetron 0.15 mg/kg SOS, max 8 | CPS position statement: "0.15 mg/kg … max 8 mg" verbatim; RCH + DOSE-AGE protocol identical; matches gastroenteritis use ("stop when vomiting settles") | **PASS** |
| Cotrimoxazole TMP 4 mg/kg/dose BD | label: 8 mg/kg TMP/day ÷ BD = 4/dose | **PASS, exact** |

**FLAG-F1a (minor): paracetamol has no lower age gate; ibuprofen gated at 3 months.**
`para` carries no `ageMinM`, so the app computes 15 mg/kg/dose even for neonates (neonatal paracetamol is
7.5–10 mg/kg/dose with prescriber review). `ibu` has `ageMinM: 3`; US labels say "ask a doctor" under
2 years and standard teaching avoids ibuprofen under 6 months (renal). Recommended: neonatal paracetamol
rule or prescriber-gate < 3 mo; ibuprofen `ageMinM` 3 → 6 (or gate < 6 mo to prescriber).

**OBS-1:** amoxicillin's single default (45 mg/kg/day) equals the label's *severe-tier* dose — 2× the
mild-moderate label dose (20–25/day) and ~half the AAP high-dose AOM dose (80–90/day). Defensible for a
high-resistance setting, but the validator should consciously accept a severe-tier-only default (consider an
indication split or note).

---

## 4. F25 — jaundice/NICU vs NICE CG98 (primary): PASS with 1 minor flag

**Sources (all primary, pulled 2026-10-25):**
- NICE CG98 full guideline PDF, © NICE 2026 (29 pp): threshold table (p.8) + §1.4–1.8.
- NICE CG98 2009 draft guideline §1.6 + Table 1 (action-row semantics + preterm formula), nice.org.uk.
- GOSH-hosted official NICE quick-reference threshold table (4-column layout incl. "–" cells).

**Term table (`biliTerm`, 17 rows): EXACT vs final NICE at every cell** — photo/exchange match the 2026
threshold table (0h 100/100 … 24h 200/300 … 96h+ 350/450); consider (= photo−50) and repeat columns match
the quick-ref, including the "–" cells transcribed as `null` (0h repeat/consider; 78h+ repeat). The app
correctly follows the *final* quick-ref (dashes at 78h+ repeat) over the 2009 draft (which printed values).

| F25 item | check | verdict |
|---|---|---|
| P1 photo formula GA×10−100, ≥72 h | NICE draft 1.6.9: "(gestational age × 10) − 100 … after 72 hours" — verbatim | **PASS (primary)** |
| P1 <72 h line (from 40@0h) + exchange GA×10 | NICE is silent ("use phototherapy at lower bilirubin levels"); values come from the UNSW trial protocol (secondary) | **OBS-2:** correct provenance is UNSW-protocol interpolation, not NICE consensus — label it so |
| P1 >336 h unit-protocol note | formula validated to day 14 only | **PASS** (safe direction) |
| P2 stop margin 50 µmol/L | NICE 1.4.5: "at least 50 micromol/litre below" — exact; `biliStop` implements `v <= photo − 50` | **PASS (primary)** |
| P2 haemolytic 2-value rule | NNF CPG (secondary); chip text discloses it | **PASS** |
| Rise-rate 8.5/h (`biliRiseRate`) | NICE 1.4.9 + 1.5.1 + 1.8.1 all use "> 8.5" — exact | **PASS (primary)** |
| mg/dL→µmol/L 17.1 | standard factor | **PASS** |
| Kernicterus flag (>340 ≥37w, 1.5.1) | not implemented (340 sits inside the photo band at 72 h+) | **OBS-3:** consider a kernicterus-risk flag |

**FLAG-F25a (minor): repeat/consider advice is the superseded 2010 wording; the current 18/24 h rule is missing.**
NICE Table 1's repeat-column header ("Repeat … (6–12 hours)") matches the app's "repeat in 6-12h" verbatim,
and the consider column matches — but NICE 2016 update §1.4.1 superseded this for babies who are well,
≥38 w and >24 h old and within 50 of the line: repeat **within 18 h (risk factors: sibling-photo history or
exclusive-breastfeed intent) / 24 h (no risk)**. The P3 "risk shifts interval, not tier" principle is correct
per 1.4.1, but no 18/24 h logic or risk input exists anywhere in `js/` (verified by grep). The consider-band
"repeat in 6h" has no direct Table-1-header basis either. Recommended: keep 6–12 h for ≤24 h/ill babies;
add the 1.4.1 branch (risk input + 18/24 h advice) for well >24 h babies.

---

## 5. Phase-7 lab bands: PASS with 1 moderate-minor flag

**WBC** (`wbc` bands 0–14d 9–30 / 14–60d 5–21 / 2mo–6y 5–19 / >6y 4.5–13.5 ×10⁹/L) vs URMC encyclopedia
+ Seattle Children's test catalogue (both re-fetched 2026-10-25):
- Bands 1–3 match URMC exactly (0–2 wk 9–30; 2–8 wk 5–21; 2 mo–6 y 5–19). **PASS.**
- **OBS-4:** Seattle Children's publishes finer bands (e.g. 2–4 y 6–15.5); the app's coarse 5–19 trades
  sensitivity for fewer false alarms. Validator to accept for screening use.
- **OBS-5:** band 4 (4.5–13.5) is wider than URMC 6–18 y (4.8–10.8); hi matches Seattle 4–6 y (13.5) instead.
  Clarify intended source; consider 4.8–10.8 for 6–18 y.

**Platelets 150–450:** matches ABPath (cited in code). **OBS-6:** NBT NHS children's ranges use 150–400.
Validator to pick; either is defensible.

**TSH** (bands ≤12 mo 0.7–8.4 / ≤6 y 0.7–6.0 / ≤11 y 0.6–4.8 / older 0.5–4.3) vs Mayo s-TSH (re-fetched
2026-10-25: 0–5d 0.7–15.2; 6d–2mo 0.7–11.0; 3–11mo 0.7–8.4; 1–5y 0.7–6.0; 6–10y 0.6–4.8; 11–19y 0.5–4.3):
- **FLAG-LAB1 (moderate-minor): no neonatal band.** App applies hi 8.4 from birth; Mayo allows 15.2 (0–5 d)
  and 11.0 (6 d–2 mo). A 10-day-old with TSH 10 flags HIGH in the app but is normal per Mayo — systematic
  false positives across the physiological neonatal TSH surge. Recommended: add a 0–2 mo band (0.7–11.0,
  optionally 0–5 d 0.7–15.2). Safe direction (over-flagging), but noisy enough to matter.
- Child/adult bands: exact. Round-year boundaries (12/72/132 mo) vs Mayo's 11 mo/5 y/10 y are reasonable
  interpolation across Mayo's own 5–6 y gap — no action.

---

## 6. Retained secondary groundings (validator to confirm — not re-fetched today)

These were grounded earlier in the build track from secondary sources and were out of reach of today's
exhaustive pass; values are restated so the validator can countersign each against the cited source:
- **GINA 2024–2026 Box 2-2** (asthma control 4Q; 0 = well, 1–2 = partly, 3–4 = uncontrolled).
- **ISPAD 2024** (HbA1c ≤6.5% with CGM/AID or honeymoon, ≤7.0% all others).
- **ROP timing AAP 2018** (Fierson et al, Pediatrics 142(6):e20183061; app: ≤1.5 kg or ≤30 w, first exam
  31 wk PMA / day 28).
- **CCHD screen AAP 2025** (Pediatrics 155(1):e2024069667; app: pass ≥95% both, diff ≤3, fail <90, 1 retest).
- **HRI timetable** (WHOCC + Toronto/CHOP/RBSK touchpoints).
- **F1 rows not in today's 6-drug sample** (24 remaining incl. mefenamic, cefixime, fluconazole, iron,
  salbutamol syrup, domperidone QT risk) — sample method documented in §3; full 30-row sign-off stays human.
- **mg/kg edge behaviour** (max-dose caps, band tables for albendazole/loratadine/zinc/ORS/vit D/montelukast)
  — engine-tested by the suite, clinically unsigned.

---

## 7. Verdict summary

| area | result |
|---|---|
| WHO tables (55,716 values) | **PASS** — bit-identical + CDC triangulation |
| IG tables (5,586 cells) | **PASS** — exact, full coverage both directions |
| F1 sample (6 high-risk drugs) | **PASS** + FLAG-F1a (age gates) + OBS-1 (amox tier) |
| F25 term table + P1/P2/rise | **PASS** (primary NICE) + FLAG-F25a (18/24 h rule) + OBS-2/OBS-3 |
| Labs WBC/platelets/TSH | **PASS** + FLAG-LAB1 (neonatal TSH) + OBS-4/5/6 |

**Three minor flags, six observations, zero data-layer failures.** No flag contradicts the Nov-5 security
gate (all are clinical-content refinements, mostly over-flagging/safe-direction). Recommended disposition:
fix F1a + F25a + LAB1 in a clinical-content patch (validator-approved), record OBS acceptances on the
validator sheets, then proceed. The human validator track (F1 30-row countersign, FC-1/FC-2, F25 ≥10 real
cases, M7 reports) is unchanged and still required — this report upgrades the *data* evidence, not the
*rulings*.

---

## Appendix — reproduction pointers

- WHO S1 harvest: toolkit pages at `www.who.int/tools/child-growth-standards/standards/*`, file links to
  `cdn.who.int`. S2: CDC URL above. Script compares `js/ref-who.js` `WHO_REF`.
- IG: intergrowth21.com PDF URLs in §2. Script parses `js/cdata.gen.js` → `KGCONTENT.intergrowth`.
- DailyMed: `https://dailymed.nlm.nih.gov/dailymed/services/v2/` + script in evidence folder.
- NICE: guideline PDF `https://www.nice.org.uk/guidance/cg98/resources/jaundice-in-newborn-babies-under-28-days-pdf-975756073669`;
  draft §1.6/Table 1 `…/guidance/cg98/update/CG98/documents/neonatal-jaundice-draft-nice-guideline-for-consultation2`.
- CPS ondansetron statement: `https://cps.ca/en/documents/position/oral-ondansetron`; RCH gastroenteritis
  guideline: `https://www.rch.org.au/clinicalguide/guideline_index/gastroenteritis/`.
- URMC WBC: `https://www.urmc.rochester.edu/encyclopedia/content?contenttypeid=167&contentid=white_cell_count`;
  Seattle Children's CBC: `https://seattlechildrenslab.testcatalog.org/show/LAB294-1`;
  Mayo s-TSH: `https://www.mayocliniclabs.com/test-catalog/overview/8939`.
