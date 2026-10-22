-- =====================================================================
-- 0009_aal_enforcement — P3.1: server-side MFA (authenticator assurance).
-- Closes H2's enforcement half: owner/admin/doctor WRITES (clinical via
-- tenant_can_write + privileged-actor policies) and sensitive audit READS
-- (audit_events, break_glass_events) now require aal2. Nurses keep
-- password-only clinical writes; auditor-role audit reads stay password-only
-- (their job; MFA not required for them).
-- ROLLOUT (warn-then-enforce, 14 days): the app UX (enrollment + grace
-- banner + friendly 42501 handling) ships FIRST; apply here on STAGING now;
-- apply on PROD on/after the grace date in js/config.js MFA_GRACE_UNTIL.
-- DELIBERATE NON-GATES: audit/break-glass INSERTs (aal1 actions must still
-- be logged); t_ins (P3.2 owns tenant minting); profiles + subscription
-- reads (fetchStatus/billing UI need them pre-MFA — gating would brick the
-- app); membership reads (roster UI); accept_invite/ensure_profile
-- (self-service incl. non-privileged roles). No data changes. Atomic.
-- =====================================================================

begin;

-- ================= 1. AAL HELPER =================
create or replace function public.my_aal2()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
$$;
revoke all on function public.my_aal2() from public, anon;
grant execute on function public.my_aal2() to authenticated;

-- ================= 2. WRITER GATE v2 (clinical + sync path) ============
-- Same writer set as 0007; owner/admin/doctor additionally need aal2.
-- Covers all 7 clinical ins/upd policies + sync_guard automatically.
create or replace function public.tenant_can_write(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_tenant_role(p_tenant) in ('owner','admin','doctor','nurse')
    and (public.my_tenant_role(p_tenant) = 'nurse' or public.my_aal2())
$$;

-- ================= 3. PRIVILEGED-ACTOR WRITES =================
-- m_ins (0007 text + aal2; actors are always owner/admin)
drop policy if exists "m_ins" on memberships;
create policy "m_ins" on memberships for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id)
  and public.my_aal2()
  and (public.plan_quota(public.tenant_plan(tenant_id), 'users') is null
    or public.tenant_user_count(tenant_id) < public.plan_quota(public.tenant_plan(tenant_id), 'users')));
-- m_upd (USING unchanged = scoping; WITH CHECK += aal2 = loud deny)
drop policy if exists "m_upd" on memberships;
create policy "m_upd" on memberships for update
  using (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner'))
  with check (public.my_tenant_role(tenant_id) in ('owner','admin')
    and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
    and public.my_aal2());
-- m_del (DELETE USING += aal2; denies are silent 0-row skips — the app
-- pre-checks aal via mfaSure before roster actions)
drop policy if exists "m_del" on memberships;
create policy "m_del" on memberships for delete
  using (public.my_tenant_role(tenant_id) in ('owner','admin') and public.my_aal2());
-- i_ins (0007 text + aal2)
drop policy if exists "i_ins" on invites;
create policy "i_ins" on invites for insert with check (
  public.my_tenant_role(tenant_id) in ('owner','admin')
  and (role <> 'owner' or public.my_tenant_role(tenant_id) = 'owner')
  and public.tenant_write_ok(tenant_id)
  and public.my_aal2());
-- i_del
drop policy if exists "i_del" on invites;
create policy "i_del" on invites for delete using (
  public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.my_aal2());
-- t_upd (0001 text + aal2 on WITH CHECK; USING unchanged)
drop policy if exists "t_upd" on tenants;
create policy "t_upd" on tenants for update
  using (public.my_tenant_role(id) in ('owner','admin'))
  with check (public.my_tenant_role(id) in ('owner','admin') and public.my_aal2());
-- s_ins / s_upd (0002 text + aal2; s_upd USING unchanged)
drop policy if exists "s_ins" on tenant_settings;
create policy "s_ins" on tenant_settings for insert with check (
  public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id) and public.my_aal2());
drop policy if exists "s_upd" on tenant_settings;
create policy "s_upd" on tenant_settings for update
  using (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id))
  with check (public.my_tenant_role(tenant_id) in ('owner', 'admin') and public.tenant_write_ok(tenant_id) and public.my_aal2());

-- ================= 4. SENSITIVE READS =================
-- Privileged readers (owner/admin/doctor) need aal2; auditors exempt.
drop policy if exists "a_sel" on audit_events;
create policy "a_sel" on audit_events for select
  using (tenant_id in (select public.my_tenant_ids())
    and public.my_tenant_role(tenant_id) in ('owner','admin','auditor')
    and (public.my_tenant_role(tenant_id) not in ('owner','admin','doctor') or public.my_aal2()));
drop policy if exists "b_sel" on break_glass_events;
create policy "b_sel" on break_glass_events for select using (
  tenant_id in (select public.my_tenant_ids())
  and (actor_id = auth.uid() or public.my_tenant_role(tenant_id) in ('owner', 'admin', 'auditor'))
  and (public.my_tenant_role(tenant_id) not in ('owner','admin','doctor') or public.my_aal2()));

commit;

-- ================= POST-APPLY VERIFICATION =================
-- 1) Helper exists + locked down (expect 1 row, grantee authenticated only):
--    select routine_name, grantee from information_schema.routine_privileges
--      where specific_schema = 'public' and routine_name = 'my_aal2';
-- 2) Writer gate honors aal (as an owner WITH aal2 claim -> true; WITHOUT -> false):
--    select set_config('request.jwt.claim.sub', '<OWNER-uuid>', true);
--    select set_config('request.jwt.claims', '{"sub":"<OWNER-uuid>","aal":"aal2"}', true);
--    select public.tenant_can_write('<owner-tenant-uuid>'); -- true
--    select set_config('request.jwt.claims', '{"sub":"<OWNER-uuid>","aal":"aal1"}', true);
--    select public.tenant_can_write('<owner-tenant-uuid>'); -- false
-- 3) Re-run E-block v2 (phase2-live-verify.sql Part 2): expect E1-E7 all PASS.

-- ================= ROLLBACK (0009) =================
-- Re-run the 0007 policy blocks for m_ins/m_upd/i_ins (+ 0001 m_del/i_del/
-- t_upd, 0002 s_ins/s_upd/i_del, 0001 a_sel, 0002 b_sel) to drop the aal2
-- clauses, then restore the 0007 writer gate:
--   create or replace function public.tenant_can_write(p_tenant uuid)
--   returns boolean language sql stable security definer set search_path = public as $$
--     select public.my_tenant_role(p_tenant) in ('owner', 'admin', 'doctor', 'nurse')
--   $$;
--   drop function if exists public.my_aal2();
