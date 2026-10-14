# Architecture

## Client (offline-first PWA)

- `index.html` + one vanilla-JS file per module + `sw.js` app-shell cache. No build.
- Source of truth on-device: `DB` in localStorage (`children[]` with visits/rx/
  vaccines/measures/nicu/mar/consents, settings, formularyReviews).
- Every clinical write path is guarded: validation pures (unit-tested),
  double-submit guards, role gates (`roleBlock`/`needSafe`), audit entries.

## Server (Supabase Postgres + RLS)

- `0001`: tenants, memberships, tenant_settings, patients/encounters/consents,
  member-scoped RLS, owner/admin deletes.
- `0002`: invites, MFA flags, break-glass, quotas, lifecycle (suspended/grace/
  closed), `tenant_write_ok` enforcement on direct writes too.
- `0003`: sync identity (`local_id`/`client_rev`/`deleted_at`) + idempotent
  `apply_*_op()` RPCs (membership + write-gate + quota + LWW).
- `0004`: clinical tables (NICU/MAR/growth) + `apply_clinical_op()` with
  clinical validation (witness rule, ranges, status whitelists) and the
  strictest RLS shape (role + write-gate).

## Sync protocol (dual-write)

1. Every `save()` diffs the device DB by hash → idempotent outbox ops.
2. Flush (FIFO, patients-first) calls `apply_*` RPCs; replays are safe no-ops;
   fatal errors surface instead of spinning.
3. Pull merges newer server rows: demographics → human review queue,
   high-frequency clinical rows → automatic LWW on `client_rev`.
4. Deletes are tombstones; audit is append-only.

## API (Vercel, stateless)

- `health` (booleans only, never secrets), Razorpay billing, and a GET-only
  FHIR R4 facade (caller JWT + mandatory `?tenant=`, RLS upstream, 5 resources).

## Test pyramid (384)

- `cloud-offline` (209): every pure + page wiring + sync engine in a vm harness.
- `tenant-isolation` (97): real PG17 — cross-tenant/stranger/suspended/quota/
  lifecycle/RPC-semantics scenarios over all migrations.
- `hardening` (52): static rails — logging policy, RLS-per-table, witness rule,
  review gates, secret hygiene.
- `api` (26): endpoint shapes, auth guards, mapper correctness, marker-leak scans.

CI runs all four + `npm audit` on every push. Standing rule: every isolation
claim has an automated test; every test runs in CI.
