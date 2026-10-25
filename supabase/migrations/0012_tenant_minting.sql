-- =====================================================================
-- 0012_tenant_minting — P3.2: close the minting gaps 0009/0010 deferred here.
-- Decisions (user-confirmed 2026-10-25): NO per-user tenant cap (audit only);
-- owner-invites stay owner-only; t_ins gets an explicit email-confirmed gate.
-- Recon notes: owner-only invites + role CHECKs already live (0007 §3/§7,
-- m_ins/m_upd owner-rule in 0009, preserved by 0010) — NOT rebuilt here.
-- This migration adds only what is missing:
--   1. t_ins += my_email_confirmed() (defense in depth; Auth confirm-email
--      already blocks sessions pre-confirm on staging+prod).
--   2. invites.created_by stamped server-side (was user-supplied/NULL).
--   3. accept_invite: owner-grant requires the INVITER to still be an active
--      owner at accept time (TOCTOU close). Pre-0012 rows (created_by NULL)
--      are grandfathered — they expire within 7 days by construction.
--   4. my_created_tenant_count() audit helper (tenants.created_by/created_at
--      are the unspoofable trail; a same-table audit trigger was REJECTED —
--      it would break E7's exact-1 audit count and couple minting to
--      audit_events availability).
-- REQUIRES 0010 (my_email_confirmed): staging now; prod only after 0010
-- (sequence stays 0009 -> 0010 -> 0012). No data changes. Atomic.
-- Rollback: re-run 0001 t_ins block + 0002 accept_invite block; drop the
-- trigger, helper, and (empty) policy additions below.
-- =====================================================================

begin;

-- ================= 1. t_ins email gate =================
drop policy if exists "t_ins" on tenants;
create policy "t_ins" on tenants for insert
  with check (auth.uid() is not null and public.my_email_confirmed());

-- ================= 2. stamp invite authorship =================
drop trigger if exists trg_stamp_invites on invites;
create trigger trg_stamp_invites before insert on invites
  for each row execute function public.trg_stamp_creator();

-- ================= 3. accept_invite inviter recheck =================
-- Body verbatim from 0002 + the owner/inviter guard before the insert.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.invites where token = p_token;
  if inv.id is null then raise exception 'invite not found'; end if;
  if inv.accepted_at is not null then raise exception 'invite already used'; end if;
  if inv.expires_at < now() then raise exception 'invite expired'; end if;
  if lower(inv.email) <> lower(public.my_email()) then raise exception 'invite is for a different email'; end if;
  if not public.tenant_write_ok(inv.tenant_id) then raise exception 'tenant cannot accept members right now'; end if;
  if public.plan_quota(public.tenant_plan(inv.tenant_id), 'users') is not null
     and public.tenant_user_count(inv.tenant_id) >= public.plan_quota(public.tenant_plan(inv.tenant_id), 'users') then
    raise exception 'tenant user limit reached';
  end if;
  if inv.role = 'owner' and inv.created_by is not null
     and not exists (select 1 from public.memberships
       where tenant_id = inv.tenant_id and user_id = inv.created_by
       and role = 'owner' and status = 'active') then
    raise exception 'inviter is no longer an owner';
  end if;
  insert into public.memberships (tenant_id, user_id, role, status)
  values (inv.tenant_id, auth.uid(), inv.role, 'active')
  on conflict (tenant_id, user_id) do update set role = excluded.role, status = 'active';
  update public.invites set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.tenant_id;
end; $$;

-- ================= 4. mint-audit helper =================
create or replace function public.my_created_tenant_count()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.tenants where created_by = auth.uid()
$$;
revoke all on function public.my_created_tenant_count() from public, anon;
grant execute on function public.my_created_tenant_count() to authenticated;

commit;
