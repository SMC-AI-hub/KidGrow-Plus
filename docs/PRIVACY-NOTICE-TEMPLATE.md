# Privacy notice TEMPLATE (DPDP Act 2023, India) — counsel review required

> This is a starting template for subscribing hospitals, NOT legal advice.
> Each hospital (data fiduciary for its patients) must adapt it with qualified
> counsel before onboarding real patients. NeoKid Care (the SaaS provider)
> typically acts as data **processor** — confirm per contract.

## 1. Who we are
[Hospital name, address, registration no.] ("the Hospital"). Grievance officer:
[name, email, phone] — DPDP requires published grievance redressal.

## 2. What data we collect (and why)
- **Child/patient:** name, DOB, sex, growth/vaccine/visit records — purpose:
  treatment & continuity of care (`consents.purpose='care'`).
- **Guardian:** name, phone — purpose: communication & billing.
- **Billing:** invoices, payment references (card/UPI data stays with Razorpay —
  we never see full card numbers).
- **Technical:** login audit, device sync metadata — purpose: security & fraud
  prevention. No advertising trackers.

## 3. Consent & choices
- Treatment consent is captured at registration (see in-app consent records).
- Optional purposes (research, marketing) are **opt-in only**, recorded with
  timestamp, withdrawable anytime in-app or at [contact] — withdrawal is
  honored prospectively and logged; past lawful processing stands.
- Children's data: consent is taken from the lawful guardian.

## 4. Sharing & storage
- Data is stored with [Supabase region ap-south-1 / Mumbai] and backed up
  encrypted. Processors: hosting (Vercel), database (Supabase), payments
  (Razorpay) — each under contract, no sale of data, no unrelated AI training.
- Medico-legal disclosures happen only as required by law, with minimum
  necessary data, and are logged.

## 5. Retention & deletion
- Medical records: retained per applicable medical-record rules (commonly
  3+ years from last visit; hospitals must confirm current rules) — see
  `retain_until` / legal-hold in-app; under legal hold, deletion is blocked.
- Accounts: on closure, the hospital gets a full export window (read-only
  access preserved — billing disputes never delete records); then data is
  securely deleted per schedule, except what law requires us to keep.

## 6. Your rights (DPDP)
Access, correction, erasure (subject to §5), nomination, and grievance
redressal — write to [grievance email]; we respond within statutory timelines.
Breach notification will be given as required by the Act and Board.

## 7. Security
TLS 1.2+, AES-256 at rest, authenticated backups, role-based access, MFA for
admins, audit trails, and tenant isolation (each hospital's data is
database-enforced separate). No system is perfect — report concerns to
[security contact] and see our incident runbook (`docs/OPERATIONS.md` §5).

---
*Version [date]. Changes to this notice are versioned and shown in-app on login
when material. Previous versions: [link].*
