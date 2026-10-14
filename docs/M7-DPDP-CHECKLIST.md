# M7 Gate 4 — Legal / DPDP review checklist

For counsel, against India's DPDP Act 2023 (+ draft Rules) as applicable to
a paediatric clinic processor. References: [PRIVACY-NOTICE-TEMPLATE](PRIVACY-NOTICE-TEMPLATE.md),
consent system (M3), retention/export behaviour, audit logging.

## A. Notice + consent

- [ ] Privacy notice approved (language, guardian consent for children, grievance officer, retention table).
- [ ] Notice is shown before/at collection in-app; version + acceptance timestamp stored per guardian.
- [ ] Consent purposes (care / billing / research / marketing / sharing) match actual processing — no purpose creep.
- [ ] Withdrawal path tested end-to-end (M3 consent withdraw; research/marketing stop on withdrawal).

## B. Rights + retention

- [ ] Access/export: guardian can obtain the full record (JSON + CSVs + documents) within the committed SLA.
- [ ] Correction: guardians can request fixes; corrections are new entries (clinical immutability explained in notice).
- [ ] Erasure: retention schedule defined (clinical vs billing vs audit); deletion request flow documented incl. legal-hold exception.
- [ ] Nomination + grievance redressal contacts published; complaint log process defined.

## C. Security + breach (reasonable safeguards)

- [ ] Encryption story reviewed: at-rest (Supabase + device), in-transit (TLS), backup passwords.
- [ ] Access control reviewed: roles, MFA, break-glass rules, idle lock, audit completeness.
- [ ] Breach playbook exists: detection → containment → DPDP Board + guardian notification timelines, evidence preservation.
- [ ] Processor chain listed (Supabase, Vercel, Razorpay, any lab/SMS vendor) with DPAs / data-residency notes.

## D. Contracts + go-live

- [ ] Clinic ↔ vendor (DPDP processor) agreement signed; sub-processors disclosed.
- [ ] Employee/staff confidentiality + access-ack collected for all seeded users.
- [ ] Counsel's written opinion: READY / READY-WITH-CONDITIONS (list) / NOT READY.
- [ ] Conditions (if any) tracked to closure before Gate 5.

Sign: counsel ____ date ____ opinion ____.
