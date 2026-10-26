# AAP 2022 threshold transcription — audit trail (G5, 2026-10-26)

## What
Hour-specific phototherapy + exchange thresholds, GA 35–40+ × neurotoxicity
risk (none/any), hours 1–336. Compiled into `data/aapbili.json` (720 points).

## How
- Source: PediTools bili2022 free API (`https://peditools.org/bili2022/api/`,
  J. Chou) — the tool credits direct validation against the CPG figures by
  Kemper + Newman. A dummy `bili=5` forces 1-decimal display output.
- Grid: h=1, 6–96/6h, 108–168/12h, 192–336/24h × GA 35–40 × risk none/any
  = 360 queries, polite (0.4s gap, descriptive UA). Zero failures/retries.
- Script: `sample-bili2022.py`. Raw responses parsed to `raw-samples.json`.
- Rules wording (follow-up table, escalation, stop, rebound, TcB confirm)
  harvested from bili2022 recommendation text + corroborated against
  CHOP / Nationwide / NPQIC / JHACH / UNC pathways (see G5 report).

## Machine checks (all pass)
- 60/60 photo points match the independent pabau grid (also bili2022-derived).
- Monotonic non-decreasing in hours; higher GA ≥ lower GA; no-risk ≥ risk.
- ga=42 accepted (= 40+ curve); ga=34 refused (scope ≥35 confirmed).
- Follow-up distance boundaries probed: <2 / 2–3.4 / 3.5–5.4 / ≥5.5.

## Deliberate engine choices (validator: confirm or overrule)
- Risk = 6 non-GA factors (prematurity handled by the GA column, per bili2022).
- Blood-group incompatibility alone does NOT select the risk curve (CPG factor
  is isoimmune haemolytic *disease* = DAT+).
- TcB-confirm implements the stated rule (≥15 or within 3 of photo line), not
  bili2022's UI bullet quirk at 5.4/5.5 below.
- Bilirubin rise still uses the shared NICE 8.5 µmol/L/h engine (unchanged).
- Stopping needs photo-start age (new optional field); without it the app
  prompts instead of approximating against the current line.

## Validator MUST still do (before enabling bili_aap)
Spot-check curves against the CPG print figures (Fig 2/3 photo, Fig 5/6
exchange), esp. early hours + plateaus, and countersign this sheet.
