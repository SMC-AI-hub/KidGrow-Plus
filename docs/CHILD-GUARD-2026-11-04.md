# Child-safety guard — 2026-11-04

**Decision:** the owner reviewed two visual mockups (`/home/user/twin-choice-preview.html`)
and chose **Both A and B** — "banner app-wide AND required pick on the highest-risk
forms. Biggest change, most clicks." Both are implemented here.

## The problem

The reported symptom was *"still I could see the Abhinaya twin 1 is selected as
default"*. It is not a `<select>` default in one form. The app keeps ONE active
child in `DB.activeId`; `child()` falls back to `DB.children[0]`, and nearly every
clinical write silently targets that child. `js/clinic.js` also pre-selected the
active child in `#aChild`. With two look-alike records, a single mistaken context
switch writes a vaccine, note, prescription or dose to the wrong twin. The eMAR
fix from `2d00312` closed one dropdown default; this closes the underlying
wrong-child hazard.

## A — App-wide twin-confirm banner + write gate

- `js/childguard.js` detects a conservative look-alike pair: explicit
  `twinGroup`/`twinOf` links, BOTH names carrying a twin marker with the same
  stripped base name, or same DOB + shared mother/father/parent/phone.
  Unrelated children sharing a first name are **not** flagged.
- When a pair exists, an amber bar renders in `#cgBanner` above every `.page`
  (i.e. on every screen), naming the active child and the matching record(s),
  with **Confirm**, **⇄ switch to the other child** and, once confirmed,
  **Change confirmation** actions. A confirmed green bar stays visible.
- All ~70 delegated clinical write **and delete** actions are blocked at the one
  choke point (`actRun` → `cgAllow`) until confirmation. Non-clinical saves
  (settings, users, stock, branding, cloud, tenant, export, print) are untouched.
- Confirmation is session-scoped (`kgChildGuard.v1`) with an in-memory fallback
  for restricted/embedded contexts. Its fingerprint covers child id, name, DOB,
  MRN and the peer ids/names/DOBs — so a switch, rename, DOB/MRN edit, or adding
  or removing a sibling forces a fresh confirmation.

## B — Explicit child pick on the six highest-risk forms

`mVisit`, `mGrowth`, `mVac`, `mTanner`, `mExtra` and `mAppt` open with **no child
selected**. Each gets a `Child * — who is this entry for?` selector showing name,
DOB and MRN, plus a lock note. Save / Book is disabled and the delegated save is
blocked until a child is explicitly picked. Picking a child counts as an explicit
identity confirmation (it also satisfies A) and switches the active child if
needed. `#aChild` no longer pre-selects `DB.activeId` and now carries DOB/MRN to
make twins distinguishable.

## Scope and safety

- **Client-side only.** No data-model, schema, migration, API, auth or billing
  change; no server-side writes. CSS is additive (existing class names are a
  public contract). Guard chrome is `no-print` and hidden in `@media print`.
- CSP-clean: no inline handlers, inline scripts, `javascript:` URLs, `eval`,
  `document.write` or logging of any kind (no PHI in logs). All four new
  delegated actions are registered.
- A clinic with no twin / same-DOB pair sees no banner and no extra confirm click;
  B still applies to the six forms by design (the owner chose the belt-and-braces
  option).
- Session confirmation is deliberately not persisted to `localStorage` or the
  cloud: a new browser session starts unconfirmed.

## Delivery

| Item | Value |
| --- | --- |
| New files | `js/childguard.js`, `tests/childguard.test.js` (69 asserts) |
| Wiring | `index.html` (banner slot, script, `data-onchange` on `#aChild`), `js/app.js` (`renderAll` → `cgRender`, `openModal` → `cgFormOpen`), `js/delegate.js` (`actRun` → `cgAllow`), `js/clinic.js` (neutral picker), `css/style.css` |
| Offline | `sw.js` SHELL includes `./js/childguard.js`; cache `neokid-v50` → `neokid-v51` so cached clients receive it |
| Version | `10.53.2` → `10.53.3` across `package.json`, `package-lock.json`, `js/cloud.js`, `api/health.js` |
| Tests | `npm test` → 32 suites / 2,121 asserts / 0 FAIL; `npm audit --audit-level=high` → 0 vulnerabilities |

## Still owner-owned (unchanged)

- No real patients before M7 sign-off (Go/No-Go 8/8 still unchecked).
- The `docs/security/prod-gate-nov5.md` gate is **not** due before 2026-11-05 and
  requires re-taken preconditions plus an owner decision.
- Guideline validator modes remain OFF until signed sheets are supplied.
- Billing is down (`razorpayConfigured=false`, `webhookSecretSet=false`); Razorpay
  live keys and Step-5 e2e are pending.
- The GitHub token pasted in the earlier chat is compromised and must be rotated
  by the owner; it is not stored in this repo or these notes.
