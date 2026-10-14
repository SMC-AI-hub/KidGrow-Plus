# M7 Gate 5 — Go / no-go decision

Convene only when gates 1–4 are closed with evidence filed.

## Readiness checklist

- [ ] Pen-test: report filed; 0 open Critical/High (or retest letter on the go commit).
- [ ] UAT: all scripts pass, six sign-offs collected, C7 closed.
- [ ] Restore drill: PASS within targets, witness-signed.
- [ ] Legal: opinion READY (or all conditions closed with evidence).
- [ ] `npm test` green on the exact go-live commit: hash ____ (365/365 at v10.5.0 baseline).
- [ ] Prod Supabase project hardened per staging parity review (RLS, auth, JWT, backups/PITR enabled).
- [ ] On-call roster + incident runbook ([OPERATIONS §8](OPERATIONS.md)) acknowledged by two humans.
- [ ] Rollback plan: previous PWA version pinned + restore path rehearsed.

## Rollout (recommended)

1. One pilot clinic, ≤ 100 real patients, 2-week hypercare (daily log review).
2. Pre-registered success criteria: 0 data-loss incidents, sync conflicts < 2%, uptime per status page, guardian complaints triaged in 48 h.
3. Full rollout only after pilot review signed by owner + tech lead.

## Decision

| | |
|---|---|
| Date | |
| Go-live commit | |
| Decision | GO / NO-GO (conditional: ____) |
| Owner sign | |
| Tech-lead sign | |

A NO-GO names the blocking gate, the fix owner, and the re-convene date. The
decision + all gate evidence are retained ≥ 3 years.
