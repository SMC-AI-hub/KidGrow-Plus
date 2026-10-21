# NeoKid Care — Operations: environments, backups, monitoring, incidents (M2)

## 1. Environments

| Env | Branch | Hosting | Database | Purpose |
|---|---|---|---|---|
| Production | `main` | Vercel prod + GitHub Pages mirror | Supabase prod project | Real clinics (only after M7 gates) |
| Staging | `staging` | Vercel preview deploy | Supabase **separate** staging project | Pre-prod verification with **synthetic** data |
| Dev/CI | any | `npm test` + embedded PG17 | Ephemeral | Every push runs all suites (`.github/workflows/ci.yml`) |

Rules: promote `staging` → `main` only when CI is green **and** the restore drill
(§3) was re-run; never copy prod data into staging; staging Supabase project uses
its own keys/plan/allow-lists.

## 2. Logging policy (enforced by `tests/hardening.test.js`)

- App code may use `console.error` **only** for render/boot faults (page name +
  exception object). `console.log/info/warn/debug` are **banned** in `js/*`.
- Never log: patient names/ids, PINs, passwords, tokens, keys, full records.
- Server functions log only request outcome + synthetic ids; Razorpay webhook
  stores event envelopes in `subscription_events` (no key material).
- CI fails on new violations.

## 3. Backup & restore

**Client path (works today, tested):** Settings → Export → AES-256-GCM encrypted
`.kgenc` (PBKDF2-100k, random salt/IV, min 8-char password). Drill evidence:
`cloud-offline` suite round-trips encrypt→decrypt and proves a wrong password is
rejected by GCM auth — last run **145 ms**. Restore: Import → pick file → password.
Keep one offline copy per week per clinic (USB/print-room PC).

**Cloud path (when Supabase project exists):**
- Continuous: auto-sync snapshots (`clinic_snapshots`, 30-deep history) +
  relational rows (M4) + Supabase daily backups + PITR (point-in-time recovery).
- Quarterly drill (required): restore PITR snapshot into the **staging** project,
  run `npm run test:isolation` against it, verify row counts, record RTO.
  Do not mark M7 complete without one witnessed drill.

**RPO/RTO (honest, current):**

| Path | RPO (max data loss) | RTO (restore time) |
|---|---|---|
| Client encrypted export | Last manual export (push clinics to weekly) | Minutes (measured crypto: ~0.15 s + handling) |
| Cloud sync snapshots | ~seconds while online | Minutes (download + apply) |
| Supabase PITR | Minutes (WAL) | TBD by first live drill — **must measure before M7** |

## 4. Sync-conflict policy (M4 dual-write)

> **Status (E4 verdict, 2026-10-21): M4 DEFERRED — engine dormant, blob is the
> supported path.** `Cloud._sb` was never wired, so `live()` is always false
> and no relational push/pull runs. The policy below describes the engine as
> built (pure logic tested); it takes effect only after the arming drill in
> `docs/F10-SYNC-SOP.md` passes. Until then: keep blob + monitor.


- Local device storage is the source of rich truth; Postgres holds identity +
  encounter/consent skeletons via idempotent `apply_*_op()` RPCs (last-writer-
  wins on `client_rev`, ties broken by op id — deterministic on all devices).
- Offline edits queue in a local outbox (capped 1000, exponential backoff,
  fatal errors surface instead of spinning). Replays are safe no-ops.
- When both sides changed the same row, the row is flagged — never silently
  merged. Staff resolve per row in Settings → Sync ("Keep mine" force-pushes
  with a fresh rev; "Take theirs" applies the server row). Until resolved, the
  local value stays on screen and the conflict counter stays visible.
- Deletes are tombstones (`deleted_at`); rows are preserved for audit.
- Double-submit guards (2.5 s) cover prescriptions, bills, registrations.

## 5. Medication + clinical convergence (M5)

- Controlled drugs follow a two-person rule: the eMAR UI requires a witness
  and the server rejects unwitnessed controlled rows (function + CHECK).
  Never bypass by editing rows directly — corrections are new log entries.
- Convergence differs by data class (by design): patient demographics use
  the review queue (§4); high-frequency clinical rows (NICU, MAR, growth)
  converge by automatic last-writer-wins on `client_rev`. If two staff edit
  the same dose simultaneously, the newest write wins and the loser stays in
  the local audit trail — review the audit log after busy shifts.
- Calculators are guidance only: every result shows its method, caps, and
  warnings. Confirm all fluid/feed orders against unit protocol.
- NICU rounds are append-only in the UI; a mistaken round is corrected by a
  new round, never by deletion.

## 6. FHIR read API (`/api/fhir/*`)

- GET-only facade over Supabase PostgREST; exactly 5 resources
  (Patient, Encounter, Observation, MedicationAdministration, Consent).
- Every call needs the caller's user JWT (`Authorization: Bearer`) plus
  `?tenant=<uuid>`; RLS is enforced upstream by Postgres, never in the
  facade. No service keys exist in this path — if a key ever appears in
  code or logs, rotate immediately and treat as an incident (§8).
- Soft-deleted rows are excluded; `_count` clamps to 1–100.
- Upstream failures return generic 502 (no PHI, no internals in bodies).
- Live end-to-end queries need staging (see M3 manual-test pattern);
  mappers + guards are covered by `tests/api.test.js`.

## 7. Uptime monitoring

- `GET /api/health` → `{status, version, time, checks{...}}` — booleans only, never
  secrets (proven by `tests/api.test.js` marker scan). Wire any monitor
  (UptimeRobot/BetterStack/Vercel checks) to poll it every 1–5 min; alert when:
  non-200, or `checks.supabaseLive === false`, or `version` != deployed tag.
- Target (to be contracted after 90 days of staging data): 99.5% monthly on the
  Vercel+Supabase path; offline-first app remains usable regardless.
- Vercel function logs + Supabase Postgres logs are the first triage stop;
  privacy rule: logs must never contain PHI (§2).

## 8. Incidents (first-response runbook)

1. **Contain:** revoke exposure (rotate Supabase service key / Razorpay keys in
   Vercel env + redeploy; suspend compromised memberships; pull abusive deploy).
2. **Assess:** scope from `audit_events` + `subscription_events` + function logs
   (which tenants/rows, what time window).
3. **Notify (India):** CERT-In directions require incident reporting within
   **6 hours** of discovery for covered incidents; DPDP Act requires breach
   notification to the Board and affected principals — confirm current thresholds
   with counsel before launch (M3 legal review).
4. **Recover:** restore from §3 paths, force re-login (revoke sessions), verify
   isolation suite green, post-mortem within 5 days.
5. Never pay ransomware or delete evidence; keep backups offline-protected.

## 9. Maintenance cadence

Weekly: `npm audit`, review CI; monthly: rotate webhook secret (Razorpay dash +
Vercel env), review `audit_events` exports per tenant on request; quarterly:
restore drill (§3), access review (stale memberships), dependency upgrades on
`staging` first. Supabase/Vercel manage OS-level patching.
