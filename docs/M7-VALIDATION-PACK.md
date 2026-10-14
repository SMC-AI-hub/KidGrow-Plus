# M7 Validation Pack — index

**Rule: no real patients before M7 is fully signed off** (standing policy 3).
This pack turns the M7 roadmap gate into executable work owned by humans.
Automated evidence to date: `npm test` **365/365 green**
(194 offline + 97 PG17 isolation + 48 hardening + 26 api) at v10.5.0.

## The five gates

| # | Gate | Owner | Document | Output |
|---|------|-------|----------|--------|
| 1 | Independent penetration test | External tester (CREST/OSCP or equiv.) | [M7-PENTEST-SCOPE](M7-PENTEST-SCOPE.md) | Report + retest of High/Critical |
| 2 | Clinician / pharmacist / nurse UAT | Paediatrician, NICU nurse, pharmacist, frontdesk, MRD, auditor | [M7-CLINICIAN-UAT](M7-CLINICIAN-UAT.md) | Signed script results; closes C7 |
| 3 | Witnessed backup-restore drill | Ops lead + witness | [M7-RESTORE-DRILL](M7-RESTORE-DRILL.md) | Timed evidence log |
| 4 | Legal / DPDP review | Counsel | [M7-DPDP-CHECKLIST](M7-DPDP-CHECKLIST.md) | Opinion + notice approval |
| 5 | Go / no-go decision | Clinic owner + tech lead | [M7-GO-NOGO](M7-GO-NOGO.md) | Signed decision + rollout plan |

## Entry criteria (all must hold before gate 1 starts)

- [ ] Staging environment mirrors prod config (Supabase project, Vercel env, RLS, seed tenants) — see [M3-MANUAL-TESTS](M3-MANUAL-TESTS.md).
- [ ] Synthetic data only; a written attestation that no real PHI is in staging/dev.
- [ ] `npm test` green on the exact commit under test; commit hash recorded in every gate report.
- [ ] [OPERATIONS](OPERATIONS.md) runbooks reviewed by the on-call owner.

## Evidence locker

Keep every report, signed sheet, screenshot, and timing log in one folder
(e.g. `evidence/m7/`, never committed with secrets). Each gate doc lists its
required artefacts. Retain ≥ 3 years.

## Sequencing

Gates 1–4 may run in parallel once entry criteria hold. Gate 5 needs all four
closed. Any Critical/High finding re-opens its gate; fixes land as new commits
with tests, then the gate re-runs.
