# M7 automation status (machine-verifiable slice) — 2026-10-26

Companion to `M7-VALIDATION-PACK.md` (human gates). This file records ONLY
what automation can prove. It does not close any M7 gate — gates 1–5 stay
human-owned (pen-tester, clinicians, ops witness, counsel, owner).

## Automated evidence (staging @ `6148d49` + wiring fix, pre-merge)
- `npm test`: exit 0 — 28 suites, ~1,850 asserts, zero FAIL (~25 s).
  Suites include: tenant isolation (PG17), hardening, CSP, sync/merge,
  clinical (dose/nicu/f25/f9/hri/chronic/panels), guideline modes
  (guides/tsh/bili/f1a/aap), comply/printaudit/cmdk/validate/load/idb.
- Guideline track: fresh-DB behaviour = validated status quo (Mayo/NICE);
  new modes gated behind `guideEnabled` + validator sign-off sheets
  (`VALIDATOR-HANDOFF-2026-10-26.md`). Two no-flag behaviour changes exist
  (F1a warn-tier gates, NICE 1.4 completion) — Sheets 6–7.
- Production wiring verified by suite: `guides.js` in `index.html` +
  `sw.js` SHELL; `saveSettings` persists guide keys (guides suite pins).

## Entry-criteria automation mapping
| Criterion (M7-VALIDATION-PACK) | Machine state |
| Staging mirrors prod config | UNVERIFIED BY MACHINE — owner check (M3-MANUAL-TESTS) |
| Synthetic data only, attested | HUMAN ATTESTATION — cannot be automated |
| `npm test` green on exact commit | ✅ PROVEN (record hash in each gate report; re-run on merge commit) |
| OPERATIONS runbooks reviewed | HUMAN REVIEW — owner |

## What each human still does
1. Pen-tester: scope in `M7-PENTEST-SCOPE.md` → report + retest High/Critical.
2. Clinicians (paediatrician, NICU nurse, pharmacist, frontdesk, MRD,
   auditor): scripts in `M7-CLINICIAN-UAT.md` → signed results.
3. Ops lead + witness: `M7-RESTORE-DRILL.md` → timed evidence log.
4. Counsel: `M7-DPDP-CHECKLIST.md` → opinion + notice approval.
5. Owner + tech lead: `M7-GO-NOGO.md` → signed decision + rollout plan.

Rule stands: **no real patients before M7 is fully signed off.**
