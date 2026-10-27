# F12 — ABDM position note (DECIDED 2026-10-27: REMOVED)

## Decision

Owner decision 2026-10-27: **remove ABHA entirely** (stronger than old
option A below).

Deleted from the app: Children → Edit ABHA field, UIP-register CSV ABHA
column, the ABHA-ready JSON export (replaced by a generic "Child health
record (JSON)" with no ABHA content), the FHIR ABHA identifier,
search/duplicate matching on ABHA, and all ABDM / "integration-ready" copy.
Suite green after removal (hardening test now pins ABHA-absence).

Kept historical references (not claims): CHANGELOG vintage entries and
`PHASE1-AUDIT.md` (point-in-time).

If ABDM is ever revisited, it restarts at old option B (sandbox spike
behind a feature flag, no prod claims until HIP-certified) with fresh
legal review — never by restoring the deleted field.

## Original options (superseded — kept for audit trail)

- [x] **A. Stop claiming.** Superseded by full removal 2026-10-27.
- [ ] **B. Sandbox spike.** Dormant unless revived with sandbox credentials.
- [ ] **C. Full integration.** Out of scope — needs HIP certification,
  consent-manager flows, and legal review. Do not promise timelines.
