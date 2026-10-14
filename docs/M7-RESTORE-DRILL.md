# M7 Gate 3 — Witnessed backup-restore drill

**Purpose:** prove a total-loss recovery works, timed, with a witness.
Extends the M2 automated drill (AES-256-GCM round-trip) to a full human run.

## Roles

- **Operator:** performs the restore (the on-call owner, not the developer if avoidable).
- **Witness:** observes, times, and signs (auditor or clinic manager).

## Preconditions

- [ ] Staging tenant with ≥ 50 synthetic patients incl. NICU, MAR, growth, consents, bills.
- [ ] Fresh encrypted backup exported per [OPERATIONS §3](OPERATIONS.md) (record size + checksum).
- [ ] Operator has only the runbook + backup file + password envelope (no developer help).

## Drill steps (operator narrates, witness times)

1. [ ] Wipe the staging device profile completely (record how: timestamp).
2. [ ] Reinstall/reload the app; verify clean state (no patients).
3. [ ] Import the backup with the password; record decrypt+import time.
4. [ ] Verify counts: patients, visits, Rx, vaccines, growth measures, NICU admissions, MAR logs, consents, bills — all must match the pre-wipe manifest exactly.
5. [ ] Spot-open 5 records end-to-end (growth chart renders, Rx prints).
6. [ ] Attempt import with a wrong password; verify clean rejection, no partial state.
7. [ ] Re-run cloud sync (staging project); verify outbox drains and server row counts match.

## Targets

| Step | Target |
|------|--------|
| Decrypt + import (50 patients) | < 5 min |
| Count mismatches | 0 |
| Wrong-password behaviour | clean reject, state unchanged |
| Sync drain after restore | 100%, 0 conflicts unexplained |

## Evidence to file

- Pre-wipe manifest (counts + checksum) and post-restore manifest.
- Timed log with witness initials per step.
- Screenshots of count verification + wrong-password rejection.
- Dated sign-off: operator ____ witness ____ result PASS / FAIL.

On FAIL: root-cause, fix with tests, re-drill within 7 days. No go-live on a failed drill.
