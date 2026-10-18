# EMR Usability Audit — NeoKid Care vs 20-point checklist

Date: 2026-10-15 · Commit audited: `c1a7aee` (staging/main) · Auditor: Arena agent (code-level)
Principle: the doctor should spend more time treating than typing.

## Score: 11 / 20 strict (9 ✅ · 5 🟡 · 6 ❌)

| # | Checklist item | Verdict | Evidence |
|---|---|---|---|
| Navigation and screen design | | | |
| 1 | Find any registered patient within seconds | 🟡 Partial | `index.html:78` — plain `<select id="childSelect">` dropdown, no type-ahead. Fine for dozens of patients; slow at 100+. Token queue (`front.js`) covers today's flow only. |
| 2 | Open active encounter directly from search | 🟡 Partial | Token queue has waiting/in/done statuses (`front.js:148-187`) but no deep-link from patient pick → today's encounter/note. |
| 3 | Reduce unnecessary screens / repeated navigation | ✅ | Single-page app (`pg-*` sections), paediatric flows kept on one screen per module. |
| 4 | Clear labels, not DB terminology | ✅ | Plain-language labels + hints throughout (`calc.js:75` "Guidance only…", `rx.js` "No medicines yet — calculate on the left, then Add."). |
| 5 | Save status / unsaved changes visible | ❌ Gap | Only transient toasts (`tenant.js:151` "Branding saved ✓"). No persistent dirty-dot / "Unsaved changes" indicator on forms. |
| Clinical documentation | | | |
| 6 | Reuse verified demographics without retyping | 🟡 Partial | Weight carried in `RXB.wt`; Rx pulls `dx/advice` per-draft. No verified-demographics prefill block stamped into encounters. |
| 7 | Editable templates for common encounters | ❌ Gap | Only WhatsApp message templates (`clinic.js:56`) + consent forms. **No clinical consultation templates** (fever, cold/cough, diarrhoea, well-child…). |
| 8 | Draft saving + recovery after interruption | ❌ Gap | `RX_DRAFT` (`rx.js:8`) and `BILL_DRAFT` (`front.js:194`) are **in-memory only** — reload/crash loses the half-written Rx. |
| 9 | Previous notes / investigations easy to review | ✅ | Previous-prescription cards (`rx.js:138`), vaccine + growth histories rendered per child. |
| 10 | Prevent overwriting signed records | ❌ Gap | **No clinical note sign/lock workflow exists** — "sign" matches are only clinical signs (Apgar/NBS) and auth sign-in. Nothing to protect yet. |
| Safety and data integrity | | | |
| 11 | Patient identifiers prominent | ✅ | Hero banner: "Active child: **name** · age · vaccines" (`app.js:619-623`); calculators echo active child (`calc.js:75`). |
| 12 | Allergies / safety alerts clearly shown | ✅ | `allergyCheck()` at prescribing → red ALLERGY ALERT → explicit acknowledge → flag **prints on Rx** (`rx.js:34-138`). Strongest area alongside dosing. |
| 13 | Validate medication doses and units | ✅ | `calcDose()` (`drugs.js:66`): mg/kg, weight/age bands, required weight, blocks Add on failure (`rx.js:106`). Formulary carries `maxDose`, `ageMinM`, ceilings. |
| 14 | Prevent duplicate orders / submissions | ✅ | `guardSubmit("child"/"rx")` (`app.js:313`, `rx.js:117`), double-submit guard in `sync-rel.js:169`. |
| 15 | Audit trails for changes | ✅ | `audit()` tenant events (`tenant.js:103`), `auditSafe()` on Rx save, `audit_events` table server-side with RLS. (Clinical field-level edits: partial.) |
| Daily operations | | | |
| 16 | Role-specific dashboards | 🟡 Partial | Roles exist (`roleRank()` Doctor/Nurse, `tenant.js:40`) with MFA gating, but one shared dashboard — no per-role landing view. |
| 17 | Pending tasks / overdue actions | 🟡 Partial | Vaccine overdue badges (`app.js:351-410`), defaulter lists (`ops.js:70`), token queue, appointment `done` flags. No **unified task inbox** (labs-to-review, unsigned notes, discharges, follow-ups). |
| 18 | Keyboard navigation / efficient search | ❌ Gap | Only usage of `keydown` is an idle timer (`front.js:127`). No shortcuts (e.g. `/` search, `Ctrl+S` save, `Ctrl+P` print). |
| 19 | Printing / reports straightforward | ✅ | `printPage()` + dedicated print views: Rx, bill, consent, growth report (`index.html:120-194`). |
| 20 | Works on supported devices | ✅ | Viewport meta + responsive `@media` CSS (`css/style.css`). (Needs a real device pass to confirm — see fix list.) |

## The 5 "best ideas" mapped

1. **One-screen workspace** — 🟡 hero banner + per-module screens exist, but identity/allergy/meds/vitals/pending-tasks are not unified on one consultation screen.
2. **Reusable templates** — ❌ missing for clinical encounters.
3. **Task-based dashboard** — 🟡 fragments exist (queue, overdue, defaulters); no unified inbox.
4. **Smart prescribing** — ✅ strongest area: formulary + mg/kg + allergy interaction + acknowledgment + print flag.
5.. **Consistent design** — ✅ CSS-variable system (`--red/--muted`), shared `btn/alert/badge/tbl` components.

## Recommended fix list (ranked for go-live)

| Pri | Fix | Closes | Effort |
|---|---|---|---|
| P0 | Persist `RX_DRAFT`/clinical drafts to localStorage + restore banner | #8 | S |
| P0 | Note sign/lock workflow (sign → read-only, amendment creates new version, audit-logged) | #10 | M |
| P1 | 4–6 editable encounter templates (fever, URI, diarrhoea, well-child, vaccine-only, follow-up) | #2, #7 | M |
| P1 | Type-ahead patient search (`/` shortcut, recent-first) replacing raw dropdown at scale | #1, #18-part | S–M |
| P1 | Unsaved-changes indicator + navigation guard on dirty forms | #5 | S |
| P2 | Unified task inbox (labs to review, unsigned notes, overdue vaccines, follow-ups, discharges) | #16-part, #17 | M–L |
| P2 | Keyboard shortcuts (`/`, `Ctrl+S`, `Ctrl+P`, `Esc`) + shortcut help | #18 | S |
| P2 | Verified-demographics stamp block on encounters/Rx print | #6 | S |
| P2 | Real device pass (Android low-end + iPad) + maxDose-cap enforcement test | #13-verify, #20-verify | S |

S < 1 day · M 1–3 days · L 3–5 days (single dev, incl. tests).
