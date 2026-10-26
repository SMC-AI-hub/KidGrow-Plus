-- =====================================================================
-- 0010_email_confirmed — P3.3: unconfirmed users cannot write.
-- Closes P3.3: the Auth dashboard toggle (confirm-email ON, both projects
-- since 2026-10-23) only gates NEW signups. This gates WRITES at RLS level:
-- any authenticated user whose auth.users.email_confirmed_at is null becomes
-- read-only (login + reads + self-service still work; writes get 42501).
-- DEPENDENCY: apply AFTER 0009 (policies below replace 0009's; the writer
-- gate calls my_aal2()). Staging has 0009. Prod sequence: 0009 (Nov 5) first.
-- IMPACT WARNING: existing unconfirmed users lose write access on apply.
-- Run the pre-flight census first; have stragglers confirm (re-send the link
-- from Auth -> Users) or accept read-only until they do. At last count prod
-- had 2 unconfirmed of 3 users.
-- DELIBERATE NON-GATES: all READS (availability; unconfirmed users can still
-- see their data + export); audit/break-glass INSERTs (logging never breaks);
-- t_ins (P3.2 owns tenant minting); accept_invite/ensure_profile (SECURITY
-- DEFINER RPCs bypass RLS AND must serve unconfirmed newcomers). No data
-- changes. Atomic.
-- =====================================================================

begin;

-- ================= 1. EMAIL HELPER =================
-- The JWT does not carry email_confirmed_at, so read auth.users directly
-- (definer runs as owner; standard pattern). Missing row -> false.
create or replace function public.my_email_confirmed()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.email_confirmed_at is not null
    from auth.users u where u.id = auth.uid()), false)
$$;
revoke all on function public.my_email_confirmed() from public, anon;
grant execute on function public.my_email_confirmed() to authenticated;

-- ================= 2. WRITER GATE v3 =================
-- 0009 text + email clause (applies to ALL writers incl. nurses: email
-- confirmation is universal, not role-based). Covers all 7 clinical
-- ins/upd policies + sync_guard (apply_patient_op checks this gate).
create or replace function public.tenant_can_write(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_tenant_role(p_tenant) in ('owner','admin','doctor','nurse')
    and (public.my_tenant_role(p_tenant) = 'nurse' or public.my_aal2())
    and public.my_email_confirmed()
$$;

-- ================= 3. PRIVILEGED-ACTOR WRITES (0009 text + email) ======
drop policy if exists "m_ins" on memberships;
create policy "m_ins" on memberships for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id)
  and public.my_aal2()
  and public.my_email_confirmed()
  and (public.plan_quota(public.tenant_plan(tenant_id), 'users') is null
    or public.tenant_user_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'users')));
drop policy if exists "m_upd" on memberships;
create policy "m_upd" on memberships for update
  using (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner'))
  with check (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
    and public.my_aal2()
    and public.my_email_confirmed());
drop policy if exists "m_del" on memberships;
create policy "m_del" on memberships for delete
  using (public.my_tenant_role(tenant_id) in ('owner','admin')
    and public.my_aal2()
    and public.my_email_confirmed());
drop policy if exists "i_ins" on invites;
create policy "i_ins" on invites for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id)
  and public.my_aal2()
  and public.my_email_confirmed());
drop policy if exists "i_del" on invites;
create policy "i_del" on invites for delete using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin')
  and public.my_aal2()
  and public.my_email_confirmed());
drop policy if exists "t_upd" on tenants;
create policy "t_upd" on tenants for update
  using (public.my_tenant_role(id) in ('owner','admin'))
  with check (public.my_tenant_role(id) in ('owner','admin')
    and public.my_aal2()
    and public.my_email_confirmed());
drop policy if exists "s_ins" on tenant_settings;
create policy "s_ins" on tenant_settings for insert with check (
  public.my_tenant_role(tenant_id) in ('owner', 'admin')
  and public.tenant_write_ok(tenant_id)
  and public.my_aal2()
  and public.my_email_confirmed());
drop policy if exists "s_upd" on tenant_settings;
create policy "s_upd" on tenant_settings for update
  using (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id))
  with check (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id)
    and public.my_aal2()
    and public.my_email_confirmed());

commit;

-- ================= POST-APPLY VERIFICATION =================
-- 1) Helper exists + locked down (expect 3 rows: postgres/authenticated/
--    service_role; gate = none PUBLIC/anon — same baseline rule as my_aal2):
--    select routine_name, grantee from information_schema.routine_privileges
--      where specific_schema = 'public' and routine_name = 'my_email_confirmed';
-- 2) Re-run E-block v3 (phase2-live-verify.sql Part 2): expect E1-E8 all PASS.
-- PRE-FLIGHT (run BEFORE apply — impact census, expect 0 unconfirmed
-- or a conscious accept: those users go read-only until they confirm):
--    select count(*) filter (where email_confirmed_at is not null) as confirmed,
--           count(*) filter (where email_confirmed_at is null) as unconfirmed
--      from auth.users;

-- ================= ROLLBACK (0010) =================
-- Re-run the 0009 policy blocks for m_ins/m_upd/m_del/i_ins/i_del/t_upd/
-- s_ins/s_upd to drop the email clauses, then restore the 0009 writer gate:
--   create or replace function public.tenant_can_write(p_tenant uuid)
--   returns boolean language sql stable security definer set search_path = public as $$
--     select public.my_tenant_role(p_tenant) in ('owner','admin','doctor','nurse')
--       and (public.my_tenant_role(p_tenant) = 'nurse' or public.my_aal2())
--   $$;
--   drop function if exists public.my_email_confirmed();
