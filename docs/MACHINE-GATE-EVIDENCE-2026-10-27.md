# Machine-gate evidence — 2026-10-27 (owner order: "do it yourself")

Machine-executable slice of the remaining launch gates, executed autonomously.
Human/external items are listed in §9 and were NOT attempted.

## 1. E-block Part 2 (E1–E8) — PASS on staging AND production
- Method: whole `E-BLOCK-PART2.sql` (begin … rollback) sent as ONE `execute_query`
  call. Single-session semantics pre-proven on staging (`TXN-PROBE ok:1`:
  temp table visible across statements, rollback honored). Auto-rollback —
  zero writes persisted on either project.
- Staging (`bubnidgejmbzkevxvthl`): E1–E8 ALL PASS.
- Production (`jmlvcrekttbzibqitftj`, 2 real users, rolled back): E1–E8 ALL PASS —
  E1 readonly-insert 42501, E2 readonly-RPC 42501 "role cannot write clinical
  data", E3 DELETE 0/row intact, E4 owner-insert allowed, E5 owner-RPC
  inserted, E6 aal1-owner 42501, E7 audit aal2=1/aal1=0, E8 unconfirmed 42501.
- The gate doc's "staging verified, prod needs owner/psql" claim is now
  machine-verified on BOTH. Blocker #7's E-block item: CLOSED.

## 2. Live endpoint probes (prod @`aab7028`, curl)
| probe | result |
|---|---|
| `GET /api/health` | 200, v10.52.0, supabase true/true, razorpay false/false (billing DOWN, as known) |
| webhook, bad signature | 401 (HMAC verified before parse) |
| webhook, 300 KB body | 500 → **fixed to 413 in this commit** (`api/razorpay-webhook.js` + api test; live after deploy) |
| create-subscription, no auth | 503 `PAYMENTS_NOT_CONFIGURED` (guard works, no silent fail) |
| billing-info, no auth | 401 |
| FHIR export | 401 w/o auth, 405 on wrong method |

## 3. XSS audit (198 `innerHTML` sinks)
- Escaper census: `esc()` + 8 module escapers (`hxEsc hriEsc formsEsc
  chronicEsc exEsc termsEsc doseEsc csvEsc`); PII interpolations traced
  (`c.name`, conflict rows, consent rows…) — all escaped.
- **Fixed 2 real gaps**: `s.logo` unescaped in `<img src>` — sidebar brand
  (`app.js`) AND print letterhead (`clinicHeader`) — both `esc()`'d + pinned
  in hardening (83/83).
- Residual: 18 `${}` sinks with no same-line escaper = composers whose
  internals escape (`clinicHeader`/`childHeader` verified), frozen constants
  (`EXTRA_VACCINE_NAMES`, Tanner maps), internal enums/colors. Safe by
  construction; dynamic verification stays with the human pen-tester.

## 4. Machine restore drill (`scripts/restore-drill.js`) — 7/7 PASS
Full app booted in stub DOM: 50 synthetic children → encrypted backup
(52.1 KB, PBKDF2-100k/AES-GCM-256) → state wiped → restored → manifest
(names+dobs+mrns) matches EXACTLY; decrypt+import 431 ms; wrong password →
clean "Could not restore" + state byte-identical. Covers M7-RESTORE-DRILL
steps 2/3/4/6 machine-side. Witnessed drill, 50-patient staging tenant, and
sync-drain (step 7) stay human. Drill artifact note: seed child Diya ships
without an MRN and `ensureMrns()` correctly assigns one on import — app
working as designed, drill now stamps it pre-export.

## 5. DPDP code-map + builds
- Already present: E-consent (7 types + signature pad + print), erasure with
  30-day grace (`comply.js`), audit trail UI, retention/`legal_hold`
  server-side (`0002_platform.sql`).
- **BUILT this commit**:
  - Consent WITHDRAWAL (`js/consent.js`): status flip + `withdrawnAt` +
    audit + Withdrawn badge + WITHDRAWN print stamp; idempotent. 9 tests.
  - In-app PRIVACY NOTICE (`js/notice.js`, v2026-10-27-v1): first-run modal
    before any collection, version+date stamp in settings, Settings re-view,
    re-prompt on version bump. 6 tests + 3 hardening pins.
- Still human/legal: counsel opinion + notice fill-ins, processor DPAs,
  breach playbook, validator sign-offs.

## 6. HS256 carry-over — CLOSED (already revoked)
`dbe95cba` is ABSENT from the prod key list (4 keys live: legacy anon
`Rt6su…`, legacy service_role `dWfXn…`, `sb_publishable_IAFKG…`,
`sb_secret_zXh0F…`). Nothing to revoke. Note: legacy Supabase JWTs carry no
`kid` header, so dashboard↔token mapping is impossible — prefix matching is
the only identification. HYGIENE: the key-list API exposes full legacy
secrets; referenced by prefix only, never copied anywhere.

## 7. Vercel auto-expose — needs 2 owner clicks (tool cannot)
`autoExposeSystemEnvs=true` verified on BOTH projects; the `update_project`
API exposes no such field (no-op attempts returned unchanged). Owner path:
Vercel → each project → Settings → Environment Variables → turn OFF
"Automatically expose System Environment Variables". Safe: the app uses no
`VERCEL_*` ambient vars. — Also noted: the `kidgrow-staging` project env has
only `SUPABASE_URL`+`SUPABASE_ANON_KEY` (no service-role key); mirror the
Supabase integration there if staging `/api/*` calls are ever needed.

## 8. Shipped in this commit (staging, suite exit 0)
`js/consent.js` withdraw · `js/notice.js` NEW · `index.html` modal+card+tag ·
`sw.js` SHELL+v48 · `js/boot.js` hook · `js/app.js` logo esc ×2 + notice
status · `api/razorpay-webhook.js` 413 · `tests/consent.test.js` NEW (15/15,
chained) · `tests/api.test.js` 74/74 · `tests/hardening.test.js` 83/83 ·
`scripts/restore-drill.js` NEW (7/7) · v10.53.0.

## 9. Still human-only (not attempted)
Hire pen-tester · clinician UAT + F1 signatures · counsel opinion ·
Razorpay keys (account login) + dashboard cancel of 2 deleted test subs ·
PAT rotation clicks · restore-drill witness · trial-lapse call · gate
retirement pick · confirm who applied 0009→0012.
