# F18 — Billing brief for the Chartered Accountant (fill + file)

Give this to your CA with 5 sample receipt printouts + the day-close CSV.

## What the software does (v10.45+)

- Receipts carry sequential numbers `INV-YYYY-NNNN` (restarts each calendar
  year; legacy receipts show `R-XXXXXX`). Sequence = max(existing bills,
  stored counter) + 1 — gaps are possible if a bill is deleted (deletion is
  audited, Doctor/Admin only).
- Clinic GSTIN (Settings → Clinic GSTIN) prints on every receipt letterhead.
- Day-close CSV + audit trail available from Frontdesk/Export.

## Questions for the CA

1. Is calendar-year sequencing acceptable, or must we switch to FY (Apr–Mar)?
2. Are the printed particulars sufficient for a GST tax invoice (HSN codes?
   GST split CGST/SGST? place of supply?)? List every missing field.
3. Deleted-bill handling: is an audited delete + gap acceptable, or must we
   implement credit-note-only cancellation?
4. Retention + signature requirements for electronic receipts.

CA name: ______________________ Opinion date: __________ Verdict: __________
Required software changes (list): ___________________________________________
