# Security Phase 3 — DRAFT plan (awaiting approval; no code yet)

Target: H2 (MFA/AAL), M2 (tenant minting), confirm-email enforcement, L1–L5 batch.
Principles carried over: no clinical-functionality change, additive migrations,
rehearse-before-live, report + STOP per sub-phase. pgsodium at-rest (2b) stays a
separate sub-phase AFTER 3.x below (it touches data encoding; do it on a quiet base).

## P3.1 — H2: server-side MFA (AAL) enforcement [the big one]
Problem (Phase 1): MFA is client-side-only (`tenant.js`, owner/admin); RLS never
checks the authenticator level, so a stolen password alone fully impersonates an
owner, including break-glass and billing paths.
Approach sketch:
- RLS helper `public.my_aal_ok()` reading the JWT (`auth.jwt() ->> 'aal' = 'aal2'`,
  Supabase session variable; verify exact claim name on staging first).
- Gate WRITES for owner/admin (and break-glass RPC, if any) on `aal2`; reads stay
  member-wide (availability over paranoia for read paths — ER at 3am).
- App UX: TOTP enrollment via supabase-js `mfa` APIs (enroll → challenge → verify),
  recovery codes, "MFA required" interstitial for privileged roles; NO lockout:
  staged rollout (warn → enforce) + documented break-glass that still audit-logs.
- Tests: isolation-suite asserts (aal1 owner write denied, aal2 allowed) + live E-block
  extension with forged `request.jwt.claims` JSON.
Risks: lockout (mitigated by warn-first + break-glass), Supabase MFA API quirks
(rehearse on staging with real TOTP), front-desk/shared-device friction.
DECISIONS NEEDED: (a) which roles require aal2 — owner+admin only, or +doctor?
(b) enforce on writes-only, or also sensitive reads (audit/billing)? (c) hard
cutover vs warn-then-enforce grace period (recommend 14 days)?

## P3.2 — M2: tenant minting (anon INSERT on tenants — confirmed reachable)
Problem: `t_ins` + anon INSERT grant lets anyone with the (public) anon key mint
tenants; trigger auto-makes them owner. Impact is abuse/quota, not PHI (isolation
holds), but it is live-exploitable today.
Approach sketch (needs app-flow mapping FIRST — do not break legit signup):
- Map exactly how signup creates tenants today (client insert? trigger? edge fn?).
- Likely fix: `t_ins` requires authenticated + `owner = auth.uid()` (creator owns),
  plus per-user tenant cap + rate limiting; optional Turnstile on signup.
- Keep handle_new_user profile/trial flow untouched.
DECISIONS NEEDED: (d) confirm legit signup flow before I touch `t_ins` (walk me
through it or point at the code path); (e) tenant cap per user (recommend 3)?

## P3.3 — confirm-email enforcement
Problem: prod has 3 users, only 1 email-confirmed — unclear anything enforces it.
Approach: check `auth.users.email_confirmed_at` handling + Supabase Auth settings
(confirm-email on/off); enforce at RLS helper level for writes if settings allow.
DECISION NEEDED: (f) is confirm-email currently ON in both projects' Auth settings?

## P3.4 — L1–L5 batch (small, one migration + app patch)
L1 HMAC `!==` → timing-safe compare; L2 stop echoing `e.message` in 500s;
L3 beacon IP in Vercel logs (drop/hash); L4 X-Frame-Options/DENY (or SAMEORIGIN?);
L5 22P02 on bad tenant_id cast (validate-before-cast).
DECISION NEEDED: (g) L4: DENY vs SAMEORIGIN (any iframe-embed requirement?).

## P3.5 — M3 client-side PHI encryption: SCOPING CHOICE
localStorage/IndexedDB PHI is plaintext. Real fix = WebCrypto envelope (per-device
key + server-wrapped DEK), a project in itself with UX trade-offs (offline access,
key recovery). Options: (i) full design in Phase 3, (ii) defer to Phase 4, minimal
hardening now (short TTLs, wipe-on-logout already?).
DECISION NEEDED: (h) (i) vs (ii)?

## Acceptance criteria (each sub-phase)
Repo: migration + tests green (isolation suite), rehearsed scratch proof.
Live: staging apply + verify, then prod apply + verify, same gating as Phase 2.
Sign-off: report + STOP after EACH sub-phase (3.1 … 3.4 separately).

## Decision checklist (block build until answered)
a) aal2 roles? · b) writes-only or +sensitive reads? · c) grace period? ·
d) signup flow walkthrough · e) tenant cap? · f) confirm-email settings? ·
g) DENY vs SAMEORIGIN? · h) M3 now or Phase 4?
