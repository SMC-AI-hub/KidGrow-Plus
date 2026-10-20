# F12 — ABDM position note (decision required, do not skip)

## Current state (verified in code)

- ABHA is a **storage-only field** (recorded in Children → Edit, included in
  ABHA-ready JSON and FHIR export). No verification, no linking, no consent
  manager, no HIP/HIU flows.
- Export-page copy says files are "integration-ready" for the ABDM gateway step
  as a registered Health Information Provider — that registration does NOT exist.

## Decision (tick one, sign, file)

- [ ] **A. Stop claiming.** Remove/soften ABDM language to "ABHA field for
  manual recording; ABDM integration not built". Zero regulatory exposure.
- [ ] **B. Sandbox spike (approved scope: Phase E).** ABHA-address verification
  via ABDM sandbox APIs behind a feature flag; no prod claims until certified.
- [ ] **C. Full integration.** Out of current scope — needs HIP certification,
  consent-manager flows, and legal review. Do not promise timelines.

Until (B) ships and is certified, staff must NOT tell patients the clinic is
"ABDM-connected". ABHA numbers recorded manually must still be verified by the
patient showing their card.

Decision: ______ Owner: ______________________ Date: __________
