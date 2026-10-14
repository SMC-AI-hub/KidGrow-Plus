# M7 Gate 2 — Clinician / pharmacist / nurse UAT

**Purpose:** independent humans verify clinical safety and workflow fit on
staging with synthetic patients. **Passing the calculator scripts closes C7.**
Record tester name, role, date, app commit, and pass/fail per script.

## Ground rules

- Testers use role-appropriate accounts (confirm `roleBlock` mapping before starting).
- Every script ends with: result (pass/fail), screenshot/page ref, and any safety concern — even if the script "passed".
- Any wrong clinical number = **fail the gate** (not just the script), file a bug with the exact inputs, and stop further clinical scripts until fixed + retested.

## A. Paediatrician (growth, immunisation, Rx)

- [ ] A1. Register a synthetic newborn; record 3 growth measures; verify z-scores/percentiles against the official WHO chart app (tolerance ±0.05 z).
- [ ] A2. Trigger each growth alert (overdue, >10% drop, <−2 z) and confirm wording + chart pointer.
- [ ] A3. Complete a vaccination catch-up; verify due-list, AEFI form, and UIP register CSV.
- [ ] A4. Write an Rx with an allergy-flagged drug; verify the flag prints on the prescription.
- [ ] A5. Double-submit each of Rx / bill / registration (double-click); verify exactly one record.

## B. NICU nurse (admissions, rounds, eMAR)

- [ ] B1. Admit a 1.8 kg 34-weeker; verify census card, LOS counter, feed guide.
- [ ] B2. Record rounds on 3 dates; verify ordering, no-edit-after-save behaviour, discharge flow + outcome.
- [ ] B3. Schedule 3 doses incl. one controlled drug; verify witness is mandatory in UI.
- [ ] B4. Log given/held/missed; verify adherence stat and doses-due card.
- [ ] B5. Attempt a controlled dose without witness via UI (must fail) and confirm the audit entry.

## C. Pharmacist (formulary + calculators — closes C1-source-check and C7)

- [ ] C1. Spot-check 20 formulary entries (`drugs.js`) against the cited reference; log every mismatch with source + edition.
- [ ] C2. Holliday–Segar at 8 / 15 / 25 / 60 kg vs hand calculation; verify cap + warnings.
- [ ] C3. Neonatal fluids day 1/3/7 at 1.2 / 3 kg; verify per-kg steps + VLBW warning.
- [ ] C4. Feed splits + nutrition goals at 2 / 3 kg, term + preterm; verify numbers + warnings.
- [ ] C5. Enter out-of-range inputs everywhere; verify every rejection message is clinically sensible.

## D. Frontdesk + MRD + auditor

- [ ] D1. Tokens → bill → receipt; verify totals, receipt print, day-collection summary.
- [ ] D2. MRD registers for a month; verify counts against known synthetic fixtures + CSV opens cleanly in Excel.
- [ ] D3. Analytics denominators: verify each n/d/period against manual counts.
- [ ] D4. Auditor role: verify read-only (no writes possible), audit log complete for A–D actions above.
- [ ] D5. Export everything (JSON + CSVs); verify completeness for a portability request.

## E. Tenant admin (platform)

- [ ] E1. Invite → accept → role check; expired + reused links must fail.
- [ ] E2. Suspend tenant: verify read-only + export still works; restore and verify writes resume.
- [ ] E3. Break-glass: request → use → auto-expiry; verify audit events at each step.
- [ ] E4. Sync conflicts: edit one patient on two devices offline; verify conflict queue + both resolutions.
- [ ] E5. FHIR: valid JWT + tenant returns own data only; wrong tenant returns nothing (not an error leak).

## Sign-off

| Role | Name | Date | Scripts passed | Concerns |
|------|------|------|----------------|----------|
| Paediatrician | | | /5 | |
| NICU nurse | | | /5 | |
| Pharmacist | | | /5 | |
| Frontdesk/MRD | | | /5 | |
| Auditor | | | /5 (D4 + review) | |
| Tenant admin | | | /5 | |

Gate passes when every script passes (or fails are fixed, committed with tests, and re-passed) and all six rows are signed.
