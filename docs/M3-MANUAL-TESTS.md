# M3 staging checklist — backend-dependent flows (run with synthetic data)

Automated suites cover RLS + pure logic. The flows below need a live Supabase
project + Vercel deploy (see `PRODUCTION-SETUP.md`), because they exercise
GoTrue (MFA), Edge networking, and multi-user timing. Run on **staging** first.

Setup: two test users (owner@synthetic.test, nurse@synthetic.test) + TOTP app.

## Org onboarding
- [ ] Owner signs up → Settings → 🏥 Organization → "Register hospital / clinic"
      → creates `City Care (test)` → appears in switcher with `owner` badge.
- [ ] Fill branding (name/address/phone/prefix) → Save → reload → values persist
      (read back from `tenant_settings`).
- [ ] "Apply to this device" → sidebar + a printed prescription show the name.

## Members & invites
- [ ] Owner → Members & invites → invite nurse@synthetic.test as `nurse` →
      link copied → open link in Incognito as the nurse (after nurse signs up) →
      nurse sees the org with `nurse` badge.
- [ ] Nurse opens Settings → Users page hidden? (roleBlock: nurse hides users/
      settings — tenant card still visible with read-only branding.)
- [ ] Re-open the same invite link → "already used". Forge `?invite=deadbeef` →
      "not found". Expired invite (set `expires_at` past in SQL) → "expired".
- [ ] Owner removes nurse (SQL `delete from memberships` for now — UI lands M4)
      → nurse reloads → org gone, local data untouched.

## MFA (owner/admin enforced)
- [ ] Owner → 🔐 Authenticator → scan QR → enter code → "Verified ✓".
- [ ] Log out → log in → code prompt appears → wrong code rejected, right code in.
- [ ] Nurse (non-required role) → no prompt. Supabase dashboard → user shows
      `aal2` after verify.

## Suspension / grace (simulate billing states in SQL)
- [ ] `status='suspended'` → owner sees ⛔ banner; can read + export; any cloud
      write fails (watch toast); local entry still works offline.
- [ ] `status='grace', grace_until=+3d` → ⏳ banner, writes work. Set
      `grace_until` past → writes fail. `status='closed'` → nurse sees nothing,
      owner still reads.

## Break-glass
- [ ] As lapsed-trial user at paywall → "🚨 Emergency access" → reason
      "Night duty, renewal pending" → 4-hour access + red banner with countdown.
- [ ] `break_glass_events` row exists server-side with actor/reason/expiry.
- [ ] "End now" → paywall returns. Short reason (<8) rejected client + server.

## Audit + quotas
- [ ] Owner → 🧾 Audit log → shows own test actions (latest 50).
- [ ] 📊 Usage → counts match SQL (`select count(*) from patients…`).
- [ ] Set plan `solo`, fill 500 synthetic patients (script) → 501st insert fails
      with quota toast; upgrade plan → succeeds.

## Record evidence
For each box: screenshot + timestamp + tester name in the release notes.
Uncheck anything untested — M7 requires this sheet complete on staging AND prod.
