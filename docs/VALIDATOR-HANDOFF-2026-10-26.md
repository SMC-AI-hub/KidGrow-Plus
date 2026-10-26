# Validator handoff — guideline-source track (G1–G5), 2026-10-26

Branch `staging` (8 local-only commits — push pending, no remote/PAT in this
environment). Full suite: `npm test` exit 0, zero FAIL.

## How to use this pack
- Each sheet below = one enable decision. Enable a mode in
  **Settings → Guideline source** (global default AIIMS + per-module override)
  ONLY after countersigning its sheet.
- `guideEnabled` keys: `tsh_aiims`, `tsh_aap`, `bili_iap`, `bili_nnf`,
  `bili_aap`. F1a and NICE-1.4 have no flag (direct changes — confirm only).
- In-code `verification: "PENDING"` strings were deliberately NOT flipped —
  flip them as you countersign.
- Fresh-DB behaviour is unchanged (Mayo TSH, NICE jaundice); every new mode
  is additive + gated, except Sheets 6–7 (read carefully).

## Sheet 1 — TSH `aiims` (ISPAE-2018, via Behura et al, Indian Pediatr 2023)
Files: `data/labpanels.json` → `tshNeo`; `js/labpanels.js` (`tshChFlag`).
Tests: `npm run test:tsh` (27 asserts).
- [ ] Table II term step-band edges (day 2 uses day-3 band, etc.) vs print.
- [ ] Preterm GA 95th uppers use the UPPER of printed ranges (11.8 / 9) —
      chosen to minimise false positives. Confirm or overrule.
- [ ] Action cutoffs: treat >80, immediate confirm 40–80, repeat 20–40 in
      7–10d; treat if FT4<1.1/T4<8 at any TSH; persistent >10 beyond 3 wk.
- [ ] Persistence needs a prior value, else the app prompts a 1–2 wk recheck.
- [ ] Serum-unit caveat shown (serum ≈ 2.2× DBS) — adequate?
- [ ] >28d falls back to Mayo bands labelled "hybrid" — acceptable?
- [ ] Unknown ageD neonate → Mayo + "DOB needed" note — acceptable?

## Sheet 2 — TSH `aap` (AAP-2023, same Behura table)
Same files/tests as Sheet 1.
- [ ] Cutoffs: >40 confirm + START L-T4; 24–48h screen >34 recall; ≤40
      immediate confirm; low FT4 + normal/low TSH → central-hypo workup first.
- [ ] Persistent >10 beyond 4 wk (vs 3 wk ISPAE) — correct per print?
- [ ] Shared Table II bands with AIIMS mode (only cutoffs/persistence differ).

## Sheet 3 — bili `iap` (IAP STG 2022 Ch-079; NICE thresholds retained)
Files: `data/nicu.json` → `biliGuides`; `js/nicu.js` (`biliIapSub`).
Tests: `npm run test:bili` (50 asserts).
- [ ] <24h jaundice → severe warn + exchange-centre referral line.
- [ ] Follow-up: 24h with risk / 48h without (≤72h) / routine after.
- [ ] Preterm <38 auto-counts as risk. Stop ≈ 2–3 mg/dL below range.
- [ ] Photo-failure rule (no 1–2 fall in 4–6h → escalate) worded right?

## Sheet 4 — bili `nnf` (NNF CPG 2019 + MoHFW STG Table 1; NICE thresholds)
Same files/tests as Sheet 3 (`biliNnfSub`).
- [ ] TcB within 50 of photo line → confirm with TSB.
- [ ] Near-exchange TSB q4–6h, declining q8–12h on intensive photo.
- [ ] MoHFW follow-up grid (24/48h risk, 48h no-risk, optional late).
- [ ] Stop: 2nd consecutive value if haemolytic, else single value (non-haem).
- [ ] Post-stop TSB 12–24h if haemolysis.

## Sheet 5 — bili `aap` (AAP 2022 CPG — full engine, biggest sheet)
Files: `data/aapbili.json`; `evidence/aap2022-transcription/` (sampler + raw
360-row JSON + README); `js/nicu.js` (`aapThreshold`/`aapSub`/`biliAapAdvise`).
Tests: `npm run test:aap` (57 asserts).
- [ ] CURVES vs print figures (photo Fig 2/3, exchange Fig 5/6), esp. early
      hours + plateaus. Machine checks pass (60/60 vs 2nd source, monotonic,
      GA/risk ordering) but print is truth.
- [ ] Risk = 6 non-GA factors; prematurity via GA column only. Confirm.
- [ ] Blood-group incompatibility alone does NOT select risk curve (CPG asks
      for DAT+ *disease*). Overrule? (one tag flip in `data/nicu.json`).
- [ ] Escalation (2 below exchange) + exchange actions text appropriate?
- [ ] Stop ≥2 below START threshold; start-age prompt when unknown (no
      approximation). Rebound: 6–12h + next-day vs next-day.
- [ ] Follow-up distances (<2 / 2–3.4 / 3.5–5.4 / ≥5.5) vs CPG Fig 7.
- [ ] TcB rule = stated rule (≥15 or within 3), not bili2022's UI quirk.
- [ ] Rise-rate still shared NICE 8.5 µmol/L/h engine — acceptable, or want
      AAP haemolysis-suggestive cutoffs (0.2–0.3 mg/dL/h) as well?
- [ ] <35w / unknown-GA NICE delegation labelled `aap-oos` — acceptable?

## Sheet 6 — F1a vs Harriet Lane 2026 print (NO FLAG — live behaviour)
Files: `js/drugs.js` (rows), `js/dose.js` (`doseAgeCheck`).
Tests: `npm run test:f1a` (19 asserts).
- [ ] Ibuprofen min age 6 mo + message wording vs HL2026 print.
- [ ] Paracetamol <3mo prescriber-gate message vs print.
- [ ] Neonatal 10 mg/kg single-dose note (dose + interval) vs print.
- [ ] DECISION: warn (aid, current) vs hard block for these gates?

## Sheet 7 — NICE 1.4.1/1.4.2 completion (NO FLAG — live in nice mode)
Files: `js/nicu.js` (`biliNiceSub`). Covered by `test:bili`.
- [ ] Well + >24h + term + within-50 → 18h (risk) / 24h (no risk) repeat.
- [ ] >50 below line → "do not routinely repeat". Resolves FLAG-F25a.
- [ ] Without full context, Table-1 texts byte-identical (pinned by tests).
- [ ] Risk subset for 1.4.1 = sibling-phototherapy + exclusive-BF-intent. OK?

## Sign-off
| Sheet | Mode | Verdict | Signed | Date |
| 1 | tsh_aiims | | | |
| 2 | tsh_aap | | | |
| 3 | bili_iap | | | |
| 4 | bili_nnf | | | |
| 5 | bili_aap | | | |
| 6 | F1a (print check + warn/block) | | | |
| 7 | NICE 1.4 (confirm) | | | |

Nov-5 gate (`0009→0011→0012`) unaffected: all clinical-content, additive +
flagged, no security-surface change. Push of all 8 commits pending PAT.
