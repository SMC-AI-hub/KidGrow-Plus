# KidGrow Pro — Operations: environments, backups, monitoring, incidents (M2)

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

## 4. Uptime monitoring

- `GET /api/health` → `{status, version, time, checks{...}}` — booleans only, never
  secrets (proven by `tests/api.test.js` marker scan). Wire any monitor
  (UptimeRobot/BetterStack/Vercel checks) to poll it every 1–5 min; alert when:
  non-200, or `checks.supabaseLive === false`, or `version` != deployed tag.
- Target (to be contracted after 90 days of staging data): 99.5% monthly on the
  Vercel+Supabase path; offline-first app remains usable regardless.
- Vercel function logs + Supabase Postgres logs are the first triage stop;
  privacy rule: logs must never contain PHI (§2).

## 5. Incidents (first-response runbook)

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

## 6. Maintenance cadence

Weekly: `npm audit`, review CI; monthly: rotate webhook secret (Razorpay dash +
Vercel env), review `audit_events` exports per tenant on request; quarterly:
restore drill (§3), access review (stale memberships), dependency upgrades on
`staging` first. Supabase/Vercel manage OS-level patching.
