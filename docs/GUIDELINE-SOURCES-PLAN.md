# Guideline Sources Plan — AIIMS/AAP (TSH) + IAP/NNF (jaundice) + HL2026 (F1a)

Owner decisions (2026-10-26): no AAP for jaundice — IAP/NNF selectable; global default + per-module
override; global default AIIMS; F1a implement-first, validator confirms vs HL2026 print.
Standing rule applies: build phase by phase, report + STOP after each; validator sign-off gates rollout.

## Research bank (all primary, fetched 2026-10-25/26)

- **TSH/CH:** Behura et al, Indian Pediatrics 2023;60:855-856 — side-by-side **ISPAE-2018 vs AAP-2023**
  table (NBS cutoffs, confirmatory rules, follow-up) + **Table II neonatal TSH reference**
  (cord 2.22-10.66; d1 2.69-26.5; d3 2.8-18.6; d7 1.34-12.08; d10 1.19-10.72; d14 1.72-7.87;
  d28 2.02-4.9; preterm GA-specific). AAP-2023: Pediatrics 151(1):e2022060420.
  Serum TSH ≈ 2.2× whole-blood TSH (units caveat — must surface in UI).
- **Jaundice:** IAP STG 2022 Ch-079 (Jain et al, iapindia.org) — defers thresholds to AAP/NICE charts;
  Box-1 risk checklist; follow-up 48h all / 24h risk groups; stop 2-3 mg/dL below; severe/prolonged rules.
  NNF CPG Dec 2019 (ResearchGate 340116901) — thresholds = **NICE ≥35w**, Maisels-or-NICE preterm;
  TcB±2.9→TSB; monitoring q4-6h near exchange / q8-12h declining; stop ≥2.9 below (1 value
  non-haemolytic, 2 haemolytic); post-stop TSB 12-24h if haemolysis; TSB-only during photo + 24h after.
  MoHFW STG 5461 (NNF-adapted) — VA q12h × 3-5d; Table 1 risk-based follow-up (24h/48h/optional).
- **F1a:** HL-aligned ibuprofen <6mo avoidance corroborated by two HL-citing charts (CMA 2021 citing HL
  16th; MIT citing HL) + AAP fever report lower age limits (APAP 3mo / ibu 6mo). Exact HL2026 formulary
  text paywalled → validator confirms against print copy.
- **Scope saver:** NNF uses NICE thresholds and IAP defers to NICE/AAP charts → IAP/NNF modes need NO new
  threshold engine. The app's validated NICE table stays; only sub-threshold/monitoring/follow-up rules vary.

## G1 — Source framework (plumbing, zero clinical change)

- Global setting `guideSource` (default `aiims`) + per-module overrides (`guideTSH`, `guideBili`).
- Fallback: module override → global if the module supports it → module default.
- Support map: TSH = aiims / aap / mayo (mayo retained, validated); bili = nice / iap / nnf.
  Bili does not support `aiims` (AIIMS jaundice chapter text not sourced) → falls back to module default.
- **Safe rollout:** new modes ship behind per-mode "validator enabled" flags (same pattern as the existing
  "NICU case-validated" setting). Pre-sign-off behaviour = status quo (Mayo + NICE). Post-sign-off defaults:
  TSH → aiims, bili → nnf (Indian neonatal authority; validator may pick iap instead).
- Tests: fallback-chain asserts. No clinical assertions change.

## G2 — LAB1: TSH modes (aiims / aap / mayo)

- **aiims mode (ISPAE-2018, AIIMS-protocol-aligned):** NBS interpretation (cord/D3-5 DBS >20 confirm;
  >80 treat+confirm; 40-80 immediate confirm; 20-40 repeat 7-10d) + venous rules (FT4<1.1 or T4<8 treat any
  TSH; mild FT4<1.17/T4<10 + TSH>20 <2wk / >10 >2wk; persistent >10 >3wk) + Table II bands ≤28d
  (fixes LAB1: d10 hi becomes 10.72, d1 26.5 — neonatal surge covered).
- **aap mode (AAP-2023):** DBS 48-72h age-specific; 24-48h >34; >40 treat+confirm; ≤40 immediate confirm;
  confirm >20 treat; persistent >10 >4wk; low-FT4 + normal/low-TSH → central-hypothyroidism workup first.
- Beyond 28d both modes use Mayo intervals (ISPAE/AAP give action cutoffs, not population intervals) —
  labelled as hybrid in UI + validator to accept.
- UI: serum-vs-DBS unit warning; mode label + provenance line on every flag.
- Tests: boundary asserts per mode (incl. TSH 10 @ d10 → normal in aiims/aap, HIGH in mayo).
- Validator confirms vs ISPAE-2018 + AAP-2023 + AIIMS Protocols thyroid chapter.

## G3 — F25a: bili modes (nice / iap / nnf) + NICE 1.4.1 completion

- Thresholds unchanged (NICE table, validated). Modes change sub-threshold/monitoring/follow-up only.
- **nnf mode:** replaces consider/repeat bands with: TcB±50→TSB confirm; TSB q4-6h near exchange,
  q8-12h once declining; stop ≥50 below (1 / 2-if-haemolytic — already app behaviour); post-stop TSB
  12-24h if haemolysis; TSB-only during photo + 24h after; VA q12h × 3-5d; MoHFW-Table-1 follow-up
  (24h risk / 48h no-risk / optional >72h).
- **iap mode:** Box-1 risk checklist (Rh-ve/O mother, <38w, lactation, predischarge high-zone/TcB>13,
  cephalohematoma, previous jaundiced baby, G6PD) → follow-up 24h if any risk/high-zone else 48h;
  high-risk-zone → re-eval 24h; stop 50 below (top of IAP's 2-3 mg/dL range, = NNF/NICE);
  severe-jaundice flags (<24h, palms/soles, >95th, encephalopathy); prolonged >2wk term />3wk preterm.
- **nice mode:** keep Table-1 bands + ADD the missing §1.4.1 branch (risk input: sibling-photo hx,
  exclusive-breastfeed intent → 18h vs 24h for well >24h babies within-50). Original F25a fix, preserved.
- One unified risk checklist (IAP Box 1 ∪ MoHFW list, ~9 items); each mode reads its subset.
- Tests: per-mode timing asserts. Validator confirms vs NNF CPG + IAP STG 2022.

## G4 — F1a: HL2026 gates (implement → validator confirms vs print)

- Ibuprofen: `ageMinM` 3 → 6 with "HL minimum age" message.
- Paracetamol: <3mo prescriber-gate (fever <3mo = workup, not routine antipyresis) + neonatal note
  (10 mg/kg neonatal single-dose tradition — validator confirms exact HL2026 text/dose).
- Gate UX (proposed): computed value shown WITH prominent warning (aid, not blocker); validator may demand
  hard block. No other F1 rows touched (stay IAP/Nelson-sourced).
- Tests: gate-boundary asserts (5.9mo ibu gated, 6.0mo clear; 2.9mo para gated, 3.0mo clear).

## Build order + gates

G1 → G2 → G3 → G4. Each: implement + suite-green + commit + report + STOP. Validator enables each mode
after countersigning (sheets: TSH aiims/aap, bili iap/nnf, F1a vs HL2026 print). Nov-5 security gate unaffected
(all clinical-content, additive + flagged).
