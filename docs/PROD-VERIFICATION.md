# Production backend verification — NeoKid Care

Date: 2026-10-15 · Prod DB: `jmlvcrekttbzibqitftj` (Sydney) · Method: live
PostgREST-equivalent sessions (`BEGIN` + `RESET ROLE` + `SET LOCAL`, two
independent users A/B across two tenants T1/T2) + code review + repo suites.
Prod left pristine: 0 users/tenants/patients/encounters/memberships/audit/profiles/snapshots.

## Verdicts

| # | Property | Verdict | Evidence |
|---|---|---|---|
| 1 | Persistent server-side storage | ✅ PROVEN LIVE | Owner insert → read-back of patient + encounter + snapshot; data survives across sessions (33-assert live run). |
| 2 | Tenant isolation | ✅ PROVEN LIVE | Cross-tenant select/insert/update/delete all denied (42501 / 0 rows); victim row byte-identical after attacks; `anon` reads 0 rows everywhere. |
| 3 | Secure backups | ✅ app-level LIVE · platform PENDING | `clinic_snapshots`: owner write/read works, outsider reads 0; client keeps newest-wins restore with conflict prompt (`cloud.js:237-264`). **Supabase PITR: confirm in dashboard** (Database → Backups) — API token can't see this org. |
| 4 | Role-based permissions | ✅ PROVEN LIVE | Owner vs nurse differentiated: nurse reads but cannot delete / rename tenant / self-promote; owner can add/remove members; creator auto-owner via `trg_tenant_owner`; last-owner guard `guard_last_owner` fired correctly under test. |
| 5 | Session management | ✅ code + staging | Supabase Auth JWT + refresh; TOTP MFA enforced for owner/admin (`tenant.js:217`); inactivity auto-lock + PIN + logout (`front.js:115-123`); staging interactive login proven 2026-10-15. |
| 6 | Auditable record changes | ✅ PROVEN LIVE | `audit_events` append-only: owner append/read works, outsider + anon read 0, UPDATE and DELETE affect 0 rows (no policies). Client sends correct columns (`auditPayload`, `tenant.js:56`). |
| 7 | Sync conflicts + recovery (offline-first) | ✅ code + suites | LWW + `detectConflict` + persisted review queue (`kidgrow_conflicts`) + `resolveConflict` keep-local/keep-remote (`sync-rel.js:94-479`); conflict toasts route to Sync card; covered in `cloud-offline` + `tenant-isolation` suites (395/395 green on `bb75287`). |

## Live assert log (prod, 2026-10-15)

28/29 + 4/4 retest. The single FAIL was a harness bug (wrong column
`table_name` in the test's own SQL); the client sends the real columns and
the retest passed 4/4. No product bug found. Full list: tenant create ×2,
auto-owner, patient insert/read-back, cross-tenant select/insert/update/delete
deny, victim-intact, anon-zero, encounter insert + cross-tenant deny, member
add, nurse read, nurse delete/rename/self-promote deny, owner rename/remove,
audit append/read/outsider-deny/update-deny/delete-deny, profile self-read,
profile cross-read deny, self-grant 0 rows, `ensure_profile` RPC, snapshot
write + cross-read deny.

## Findings (non-blocking)

- **F1 — Tenants are immortal (by design, needs a runbook line).** No DELETE
  policy on `tenants` + `guard_last_owner` blocks even cascade deletes, so a
  clinic's records cannot be destroyed via API or accident. Lifecycle runs
  through `status` (active/suspended/closed). Emergency superuser cleanup
  requires `SET session_replication_role TO 'replica'` + explicit
  dependency-order deletes (replica mode also skips FK cascades — orphans
  must be deleted per-table). Add to OPERATIONS.
- **F2 — Platform PITR unconfirmed.** Paid tier was requested; verify
  Database → Backups → Point-in-time recovery ON, and schedule the M7
  restore drill before the pilot admits real patients.
- **F3 — Hand-made SQL users can't password-sign-in (harness artifact, not a
  product bug).** GoTrue 500s on rows inserted via SQL (missing server-side
  state). Real signup → confirm → login is proven on staging and prod
  (signup + trigger trial). No action.
- **F4 — Pooler session-state leakage (harness lesson).** Supavisor
  transaction mode preserves `SET ROLE` across pooled checkouts; raw-SQL
  verification must use `BEGIN` + `RESET ROLE` + `SET LOCAL` (PostgREST
  already does this — the app is unaffected).

## Residual pre-pilot items

1. Dashboard: confirm PITR ON (F2). 2. Run restore drill, witness-sign (M7).
3. Prod interactive login by owner (rate-limit window has passed).
4. Razorpay live keys → billing E2E in test mode first (PRODUCTION-SETUP §5).
5. Usability fixes from EMR-USABILITY-AUDIT (draft persistence = P0).
