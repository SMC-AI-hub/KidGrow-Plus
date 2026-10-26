# M8 readiness snapshot (scale track) — 2026-10-26

M8 per ROADMAP: multi-facility enterprise, dedicated DB/keys option, React/TS
migration decision, performance/load program. No M8 build work has started;
this file records the baseline + the decisions needed. Nothing here authorises
a rewrite.

## Baseline facts (staging, pre-merge)
- Repo 6.8 MB; `index.html` 53 KB; `js/cdata.gen.js` 71 KB; ~14.7k JS lines.
- Suite: 28 files, ~1,850 asserts, ~25 s wall time, exit 0.
- Runtime: vanilla-JS offline-first PWA; server surface = Vercel lambdas
  under `api/` (health, razorpay-webhook, …) + Supabase Postgres/Auth/Storage.
- Hosting: Vercel hobby; Supabase prod org on FREE tier (no PITR — see
  Nov-5 gate preconditions); repo public, Vercel project private.

## Decisions required (owner/tech-lead — not automatable)
1. React/TS migration: ROADMAP defers unless justified by team size. No team
   growth stated → recommendation: STAY on vanilla JS; revisit with hires.
2. Multi-facility enterprise: product scoping (org hierarchy, cross-facility
   roles, billing) before any schema work.
3. Dedicated DB/keys per tenant: needs billing tier decision + Supabase
   project-per-tenant ops design.
4. Load program: needs a target environment + SLOs first (suggested: k6
   against staging preview for API/RPC paths; Lighthouse for shell load).
   10k-patient load budget exists (`tests/load.test.js`) for the local DB.

## Suggested first automatable M8 steps (when authorised)
- Lighthouse CI on the staging preview URL (perf + PWA score budget).
- k6 smoke (10 VU) on `api/health` + one RPC path from staging.
- Bundle audit: per-script sizes + SHELL list drift check (extends the
  guides-wiring regression pattern in `tests/guides.test.js`).
