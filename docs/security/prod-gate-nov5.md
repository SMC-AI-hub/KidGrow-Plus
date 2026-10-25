# Prod migration gate — on/after 2026-11-05 (0009 → 0010 → 0011 → 0012)

Staging is fully verified at `0007→0012` (E-block v3 E1–E8 PASS after every
migration). Prod is at `0007+0008`. This packet is the prod runbook: two
checkpoints, copy-paste probes, rollback map. Nothing here runs before
2026-11-05 (MFA_GRACE_UNTIL) and nothing runs without the preconditions below.

## 0. Preconditions (all must hold, else STOP)

- [ ] Date is on/after 2026-11-05.
- [ ] Prod census re-taken (banked 2026-10-23: 3 users, 1 confirmed /
  2 unconfirmed; re-taken 2026-10-25 via connector: 4 users, 2 confirmed —
  RE-VERIFY at the gate, people change):
  `select count(*) as users, count(email_confirmed_at) as confirmed from auth.users;`
- [ ] Confirm-or-accept decided for every unconfirmed prod user: at 0010 they
  go read-only until they confirm via email link. Either confirm them first
  or record acceptance (names + owner sign).
- [ ] Backups decision recorded: prod org is FREE (no PITR). These four
  migrations change no data and each is atomic with a re-run rollback (see
  §4), but there is no restore path if anything else goes wrong. Recommended:
  upgrade before the gate; minimum: owner signs acceptance of the risk.
- [ ] Billing state checked: the Oct 23 trial had ~8 days left (~Oct 31), so
  the gate likely runs post-trial. Verify current `sub_status`; break-glass
  covers a lapse mid-shift, but know the state before starting.
- [ ] Carry-over hardening (advised, not blocking): revoke previous HS256 key
  `dbe95cba`; set auto-expose OFF.

## 1. Tab fingerprint (every session, before every apply)

Prod must read users=3 (or the §0 re-take), `my_aal2` absent, helper absent:

```sql
select 'users' as check, count(*)::text as value from auth.users
union all
select 'my_aal2', count(*)::text from pg_proc where proname = 'my_aal2'
union all
select 'my_email_confirmed', count(*)::text from pg_proc where proname = 'my_email_confirmed';
```

Expect `3 / 0 / 0` (users per §0 re-take). Staging reads `7 / 1 / 1` —
abort and switch tabs if you see staging numbers. (`current_database()` reads
`postgres` on BOTH projects — it is not a valid check.)

## 2. Checkpoint 1 — 0009 then 0010 (behavior-heavy pair)

Apply `supabase/migrations/0009_aal_enforcement.sql` (staging branch, copy
button). Expect `Success`. Then:

```sql
select count(*) as my_aal2 from pg_proc where proname = 'my_aal2'; -- expect 1
```

Apply `0010_email_confirmed.sql`. Expect `Success`. Then:

```sql
select count(*) as my_email from pg_proc where proname = 'my_email_confirmed'; -- expect 1
select grantee from information_schema.routine_privileges
  where routine_name = 'my_email_confirmed'; -- expect postgres + authenticated, no PUBLIC/anon
```

Then run the E-block (`docs/security/phase2-live-verify.sql`, unchanged,
both parts). Expect E1–E8 all PASS. **Report checkpoint 1 outputs before
proceeding.**

## 3. Checkpoint 2 — 0011 then 0012 (narrow pair) + final regression

Apply `0011_rpc_input_casts.sql`. Expect `Success`. Then (each SHOULD error):

```sql
select public.apply_patient_op('{"tenant_id":"not-a-uuid","local_id":"x","client_rev":"2026-10-01T10:00:00Z","mrn":"DRILL"}');
-- expect ERROR P0001: bad tenant_id (NOT "invalid input syntax")
select public.apply_patient_op('{"tenant_id":"00000000-0000-0000-0000-000000000000","local_id":"x","client_rev":"not-a-time","mrn":"DRILL"}');
-- expect ERROR P0001: bad client_rev
```

Both errors fire before any DML — nothing is written.

Apply `0012_tenant_minting.sql`. Expect `Success`. Then:

```sql
select with_check from pg_policies where schemaname = 'public'
  and tablename = 'tenants' and policyname = 't_ins'; -- expect my_email_confirmed() in text
select grantee from information_schema.routine_privileges
  where routine_name = 'my_created_tenant_count'; -- expect postgres + authenticated only
select position('inviter is no longer an owner' in prosrc) > 0 as has_guard
  from pg_proc where proname = 'accept_invite'; -- expect true
```

Optional but recommended (E8-precedented, auto-rolled-back): the staging C2
behavioral probe for `t_ins` — see the P3.2 drill message (two runs, u1
substituted). Expect `42501 … policy "t_ins"`, then `rollback;`.

Then run the E-block again, unchanged. Expect E1–E8 all PASS (E7 exact-1
proves no stray writes). **Report checkpoint 2 outputs for sign-off.**

## 4. Rollback map (reverse order; each step re-verified before continuing)

- 0012: re-run the 0001 `t_ins` block + the 0002 `accept_invite` block;
  `drop trigger if exists trg_stamp_invites on invites;`
  `drop function if exists public.my_created_tenant_count();`
- 0011: re-run the 0003 + 0004 function blocks (restores raw 22P02/22007).
- 0010: commented block at the foot of `0010_email_confirmed.sql` (re-run the
  0009 policy blocks, restore the 0009 writer gate, drop the helper).
- 0009: commented block at the foot of `0009_aal_enforcement.sql` (re-run the
  0007 policy blocks, restore the 0007 writer gate, drop `my_aal2()`).

## 5. Post-gate

- Record the confirm-or-accept outcome for the §0 unconfirmed users.
- Record the final prod census + migration level (`0007→0012`).
- Re-file dashboard shots if anything changed (key IDs only, never values).
- Confirm the §0 carry-overs (HS256 revoke, auto-expose OFF) are scheduled.
