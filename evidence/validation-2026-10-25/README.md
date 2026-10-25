# Validation scripts — 2026-10-25 independent clinical-data pass
Companion to `docs/VALIDATION-REPORT-2026-10-25.md`.
- `validate_who.py` — app WHO_REF vs official WHO expanded Excels + CDC WHOref_d.csv
- `validate_ig.py` — app IG tables vs official INTERGROWTH-21st z-score table PDFs
- `dailymed3.py` — FDA DailyMed SPL dosage-section puller (F1 6-drug sample)
Re-run needs the downloaded sources in /tmp/whox, /tmp/ig (URLs in the report).
