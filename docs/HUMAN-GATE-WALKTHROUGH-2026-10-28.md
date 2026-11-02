# Human-gate walkthrough — do-it-now runbook (2026-10-28)

The 8 remaining human-only gates, in the order to do them. Check boxes as you
go. Anything marked **AGENT** I can do the moment you say so.

**Do first (today, ~1 hour):** 1 → 2 → 3.
**Send out today (runs in background):** 6 → 7 → 8.
**Schedule this week:** 4 → 5.

---

## 1. PAT rotation (10 min) — do this FIRST, it unblocks the deploy

Why: 3 GitHub PATs were pasted in chat during development (audit HIGH item).
They must die. Order matters: create the new one first, deploy, then revoke.

- [ ] 1.1. GitHub → avatar → **Settings → Developer settings → Personal access
  tokens → Tokens (classic)** (or Fine-grained, whichever you used before).
- [ ] 1.2. **Generate new token (classic)** → note `kidgrow-deploy-2026-10-28` →
  expiry **30 days** → scope **`repo`** only → Generate → **copy it now**
  (shown once).
- [ ] 1.3. Paste the new PAT to me in chat. I will immediately: push staging
  (`08c457a`) → merge to main (suite re-verified) → push main → confirm both
  Vercel targets → live-probe 413 + v10.53.0. Then I delete it from the
  workspace as always.
- [ ] 1.4. After I confirm "live": back on the PAT page, **Revoke** the 3 old
  dev PATs. Confirm nothing else uses them (they were only ever used for
  these pushes).
- [ ] 1.5. Done when: old PATs show Revoked, new PAT works (proven by my push).

## 2. Trial-lapse call (10 min) — URGENT, one lapses Oct 30

Live prod state right now (queried 2026-10-28):

| Profile | Status | Trial ends (IST) |
|---|---|---|
| susheender@gmail.com | trialing | **Oct 30, 8:49 PM (~2 days!)** |
| muthuvelbalasubramaniyan@gmail.com | trialing | Nov 8, 8:29 PM |

What lapse means: `trialLeft()` hits 0 → access flips to locked for
cloud/sync/subscription features. Local on-device data is NOT touched, and
extending the date restores access instantly. Billing is DOWN (no Razorpay
keys), so nobody can subscribe yet — lapsing now just locks you out early.

- [ ] 2.1. Confirm who `muthuvelbalasubramaniyan@gmail.com` is (pilot user?
  second tester?). If unknown, treat as external pilot — do NOT let it lapse
  silently; email them first.
- [ ] 2.2. Pick ONE:
  - **A (recommended): extend both to Nov 30** — buys room to wire Razorpay
    (§3) and run UAT, then convert to paid properly.
  - **B: let Oct-30 lapse** — only if susheender is you and you want to watch
    the lock UX live. (You can extend afterwards anyway.)
- [ ] 2.3. Execute — either:
  - **AGENT (30 sec):** tell me "extend both to Nov 30" and I run it + show
    you the new dates; or
  - Dashboard: Supabase → prod project → Table Editor → `profiles` → edit
    `trial_ends_at` cells → Save.
- [ ] 2.4. Done when: both rows show the new dates (I'll re-query to confirm).

## 3. Razorpay: keys + cancel 2 dead subs (45 min)

Code reads exactly these 4 (verified in `api/` + `js/`):
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`,
`RAZORPAY_WEBHOOK_SECRET`.

Part A — keys + plan (test mode first):
- [ ] 3.1. Login to Razorpay → stay in **Test mode** → Settings → API keys →
  Generate → copy Key ID + Secret.
- [ ] 3.2. Subscriptions → **Plans → Create plan** (ONE plan only — app
  supports a single plan): amount + monthly interval → copy the Plan ID
  (`plan_...`).
- [ ] 3.3. Settings → Webhooks → Add webhook → URL =
  `https://<your-prod-domain>/api/razorpay-webhook` → tick ONLY:
  `subscription.authenticated`, `subscription.charged`,
  `subscription.activated`, `subscription.cancelled`,
  `subscription.completed`, `subscription.expired`, `payment.failed` →
  copy the Webhook Secret.
- [ ] 3.4. Vercel → **neokidcare** project → Settings → Environment Variables
  → add all 4 keys, target **Production** → **Redeploy** production.
- [ ] 3.5. Verify: open `https://<prod-domain>/api/health` → need
  `razorpayConfigured: true`, `webhookSecretSet: true`. (Tell me and I'll
  probe it + run a test-subscribe round-trip.)
- [ ] 3.6. Follow `docs/PRODUCTION-SETUP.md` Step-5 e2e (test subscribe →
  webhook fires → profile flips to subscribed). Only then repeat 3.1–3.4
  with **Live mode** keys.

Part B — cancel the 2 dead subs (do in the SAME session):
- [ ] 3.7. Razorpay → Subscriptions → find the 2 trial subs from **Oct 17/18**
  (customers = the 2 deleted test accounts). Their app-side users are
  already deleted (prod is 2/2 confirmed) — these subs are orphans.
- [ ] 3.8. Open each → **Cancel immediately** (NOT at cycle end) → confirm.
  Check Invoices/Payments for each: confirm ₹0 captured; dispute if not.
- [ ] 3.9. Reconcile the 2 REMAINING profiles' subs: the old `razorpay_sub_id`
  values were set manually and the webhook can't retro-sync them. After
  3.6 passes: if either profile doesn't show live status, cancel its manual
  sub too and re-subscribe cleanly through the app flow.
- [ ] 3.10. Done when: health shows true/true, Step-5 e2e passes, 2 orphans
  cancelled, 2 live profiles reconcile.

## 4. Gate retirement pick (20 min decision)

The audit lists 10 blockers; #9 (F12) is DONE. For each of the rest, mark
**RETRACE→CLOSE** (must close pre-pilot), **ACCEPT** (close with written
risk acceptance), or **DEFER** (post-pilot with a dated ticket). Suggested
picks — change any, then tell me and I'll update the audit doc:

| # | Blocker | Suggested |
|---|---|---|
| 1 | Pen-test (§6) | CLOSE (§6 running) |
| 2 | Clinician UAT + F1 (§7) | CLOSE (§7 running) |
| 3 | Restore drill (§5) | CLOSE (§5 running) |
| 4 | DPDP (§8) | CLOSE (§8 running; DPAs may ACCEPT w/ date) |
| 5 | Gate 5 go/no-go (on-call roster, runbook ack ×2, rollback rehearsal) | CLOSE — schedule with §5 |
| 6 | Billing DOWN | CLOSE via §3 |
| 7 | Gate-bypass fallout | CLOSE: E-block ✅ done by agent; HS256 ✅ revoked; dead subs → §3.9; auto-expose → your 2 clicks; "who applied 0009→0012" → just TELL me if you know, else record "unknown, effects verified" and retire it |
| 8 | Guideline validators (36 boxes) | KEEP OPEN — modes stay OFF until signed (this is the Nov-5 sheet, separate track) |
| 10 | M3 manual tests (18, staging live timings) | CLOSE alongside §5/§7 (same staging session) |

- [ ] 4.1. Reply with your picks (e.g. "all as suggested except #4-DPAs must
  close"). I'll update the audit doc + ROADMAP the same turn.

## 5. Restore witness drill (schedule 1–2 hrs this week)

Packet: `docs/M7-RESTORE-DRILL.md`. My machine drill (7/7) already proves the
mechanics — this is the formal witnessed pass. Roles must be humans:
**operator** (you/on-call, NOT me) + **witness** (auditor/clinic manager).

Prep (day before):
- [ ] 5.1. Staging tenant with **≥ 50 synthetic patients** incl. NICU, MAR,
  growth, consents, bills. Realistic path: log into the staging app as
  `owner@staging.test`, register/import 50 synthetic children with rich
  records, **Sync now**, then ask me to verify server row counts
  (staging currently has 4 patients — I'll confirm when you hit 50).
- [ ] 5.2. Export a FRESH encrypted backup per OPERATIONS §3; record file
  size + checksum. Seal the password in an envelope for the operator.
- [ ] 5.3. Operator gets ONLY: runbook + backup file + envelope. No dev help.

Run (witness times + initials every step):
- [ ] 5.4. Steps 1–7 of the drill doc: wipe → clean-state check → import
  (record time) → count-check vs manifest (MUST be 0 mismatches) → spot-open
  5 records → wrong-password attempt (clean reject) → cloud sync drain
  (100%, 0 unexplained conflicts).
- [ ] 5.5. Targets: import < 5 min (machine run: 0.4 s for 50 — you'll pass
  on time; the value is the human procedure), 0 mismatches.
- [ ] 5.6. File evidence: pre/post manifests, timed log, screenshots, dated
  sign-off (operator + witness, PASS/FAIL). On FAIL: root-cause → I fix with
  tests → re-drill within 7 days. No go-live on a failed drill.

## 6. Clinician UAT + F1 signatures (send TODAY, runs over days)

Packets: `docs/M7-CLINICIAN-UAT.md` (25 scripts A1–E5, 6 sign-off rows) +
`docs/validator-handoff-pack.docx` (§3 = F1 30-row dose sheet for the
pharmacist). F1's own rule: **no real prescriptions until every row is
verified + signed**.

Test environment (give testers EXACTLY this):
- URL: `https://kidgrow-staging-git-staging-smc-ai-hub.vercel.app`
  (tracks the staging branch — wait for my "pushed" in §1.3 so they test
  the latest incl. notice + withdraw).
- Accounts: `owner@staging.test` (admin scripts) + `doctor@staging.test`
  (clinical scripts). Passwords = what you set at creation; if forgotten:
  Supabase → staging project → Authentication → Users → click user →
  Update → set new password. **Or AGENT:** tell me 2 passwords and I'll set
  them via SQL in 30 seconds.
- Ground rule (in the doc, repeat it in your email): ANY wrong clinical
  number = fail the GATE, file the exact inputs, stop clinical scripts.

Send list:
- [ ] 6.1. Paediatrician: scripts A1–A5 + sign row. (A1 needs the official
  WHO chart app for z-score cross-check.)
- [ ] 6.2. NICU nurse: B1–B5 + sign row.
- [ ] 6.3. Pharmacist: C1–C5 + F1 30-row verification + sign row.
  (C1 closes C1-source-check; calculator scripts close C7.)
- [ ] 6.4. Frontdesk/MRD staff: D1–D5 + sign row. Auditor: D4 + review row.
- [ ] 6.5. You (tenant admin): E1–E5 + sign row — fold in the M3 manual
  timings (blocker #10) in the same session.
- [ ] 6.6. Collect: per-script pass/fail + screenshot + concerns; all six
  rows signed. Fails come to me → fix with tests → tester re-passes.

## 7. Pen-tester hire (send TODAY, runs 1–2 weeks)

Packet: `docs/M7-PENTEST-SCOPE.md` (staging-only targets, 12 must-probes,
rules of engagement, severity rubric, deliverables). Also hand them
`docs/MACHINE-GATE-EVIDENCE-2026-10-27.md` (§2–§3) so they start above my
baseline instead of re-billing it.

- [ ] 7.1. Shortlist 2–3: vetted freelance app-sec tester or boutique firm
  with **web-app + API** experience (ask for OWASP WSTG / API Top-10
  methodology). Get fixed-price quotes for: test + written report +
  ONE free retest.
- [ ] 7.2. Before they touch anything: sign mutual **NDA** + give WRITTEN
  **authorization letter** naming scope = staging URL + accounts ONLY,
  explicit "never prod", test window dates, and your contact for
  stop-the-test. (No letter = no test. This is the industry rule.)
- [ ] 7.3. Provision: `owner@staging.test` + `doctor@staging.test` (victim
  accounts) + `intruder@staging.test` (attacker account — already exists,
  confirmed). Same password-reset path as §6.
- [ ] 7.4. Evaluate the report against the scope's severity rubric; every
  High/Critical comes to me → fix with tests → tester retests → file the
  clean report as Gate-1 evidence.
- [ ] 7.5. Done when: report filed + retest clean + you sign Gate 1.

## 8. Counsel opinion (send TODAY, days–weeks turnaround)

Packets: `docs/M7-DPDP-CHECKLIST.md` (16 items: A notice+consent, B
rights+retention, C security+breach, D contracts+go-live) +
`docs/PRIVACY-NOTICE-TEMPLATE.md` (your in-app notice v2026-10-27-v1
implements its short form — counsel reviews BOTH).

- [ ] 8.1. Engage a tech lawyer with **DPDP Act 2023** practice. Fixed-fee
  quote for: (a) written opinion letter, (b) redline of the notice +
  fill all `[bracketed]` fields, (c) processor DPA templates (Supabase /
  Vercel / Razorpay), (d) breach-notification playbook sign-off.
- [ ] 8.2. Send: the 2 docs + this system summary: SaaS child-health SaaS;
  each clinic is data fiduciary for its patients, NeoKid Care is
  processor (confirm per contract); data in Supabase (+region to confirm),
  hosting Vercel, payments Razorpay (card data never touches us); AES-256
  + TLS, role-based access, MFA admins, tenant isolation, audit trails;
  guardian e-consent in-app, erasure with 30-day grace + legal-hold block.
- [ ] 8.3. Questions to put in writing: fiduciary-vs-processor confirmation;
  notice sufficiency for children's data via guardian consent; retention
  schedule (medical-record 3+ yr rule — confirm current); grievance-officer
  publication duty; breach timelines to Board + guardians; staff
  confidentiality + access-review cadence.
- [ ] 8.4. File the opinion letter + redlined notice as Gate-4 evidence; any
  code changes (e.g. retention automation) come to me as a work order.

---

## Scoreboard (update as you go)

- [ ] 1 PAT rotated + `08c457a` live (agent deploys on PAT receipt)
- [ ] 2 Trials resolved (Oct-30 + Nov-8)
- [ ] 3 Razorpay true/true + Step-5 e2e + 2 orphans cancelled
- [ ] 4 Retirement picks recorded
- [ ] 5 Drill witnessed + PASS filed
- [ ] 6 UAT 25/25 + F1 signed
- [ ] 7 Pen-test report + clean retest
- [ ] 8 Counsel opinion filed
