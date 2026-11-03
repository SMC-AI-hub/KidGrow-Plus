-- 0013 · Server-side subscription gate (KG-PT-001).
-- STAGING FIRST. Apply to PROD only with explicit owner approval (it restricts writes).
--
-- Problem: the paywall lived only in js/cloud.js. RLS never consulted
-- profiles.sub_status/trial_ends_at, so lapsed members kept full cloud
-- read+write via direct API (proof: B1 in supabase/tests/rls-gate.sql).
--
-- Design (mirrors js/cloud.js accessFor() truth table exactly, so client and
-- server never disagree):
--   active    → ok (period-end tolerated 3d past, for webhook lag — as client)
--   past_due  → ok (retries in flight — as client)
--   cancelled → ok iff current_period_end is future (paid time honored — as client)
--   trialing/created/authenticated/none/null + live trial_ends_at → ok
--   missing profile row → DENY (secure default; signup trigger + backfill cover it)
-- READS stay open on lapse (read-only + export), mirroring suspend semantics:
-- clinical data is never stranded. Break-glass relief is honored server-side
-- from the EXISTING break_glass_events rows the client already inserts
-- (scope='subscription-gate', reason ≥8, created within 4h — re-validated here).
-- Deliberately NOT gated: a_ins (audit must always land), b_ins (relief path).
--
-- ROLLBACK (restores pre-0013 bodies; new helpers left inert-harmless):
--   create or replace function public.tenant_can_write(p_tenant uuid) returns boolean
--     language sql stable security definer set search_path = public as $$
--     select public.my_tenant_role(p_tenant) in ('owner','admin','doctor','nurse')
--       and (public.my_tenant_role(p_tenant) = 'nurse' or public.my_aal2())
--       and public.my_email_confirmed() $$;  -- 0010 body
--   create or replace function public.tenant_write_ok(p_tenant uuid) returns boolean
--     language sql stable security definer set search_path = public as
--     $$ select exists (select 1 from public.tenants t where t.id = p_tenant
--        and (t.status = 'active' or (t.status = 'grace' and t.grace_until is not null
--        and t.grace_until > now()))) $$;
--   ... then drop + recreate i_del, m_del, m_upd, t_ins, t_upd, d_ins, d_upd
--   with their pre-0013 expressions (see 0001/0002/0004/0007/0009 sources).

-- ================= 1. Entitlement mirror (per-user, per-seat) =================
create or replace function public.my_subscription_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        (p.sub_status = 'active'
          and (p.current_period_end is null or p.current_period_end > now() - interval '3 days'))
        or (p.sub_status = 'past_due')
        or (p.sub_status = 'cancelled'
          and p.current_period_end is not null and p.current_period_end > now())
        or (p.trial_ends_at is not null and p.trial_ends_at > now()
          and (p.sub_status is null or p.sub_status in ('trialing','created','authenticated','none','')))
      )
  );
$$;

-- ================= 2. Live emergency relief (existing rows, re-validated) =================
create or replace function public.break_glass_live(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.break_glass_events b
    where b.tenant_id = p_tenant
      and b.actor_id = auth.uid()
      and b.scope = 'subscription-gate'
      and char_length(b.reason) >= 8
      and b.created_at > now() - interval '4 hours'
  );
$$;

-- ================= 3. Gate the two write choke-point helpers =================
-- tenant_can_write: covers c/e/p ins+upd policies + write-guard fns.
-- tenant_can_write: 0010 body (role + nurse-or-aal2 + confirmed) PLUS the gate.
-- (Staging briefly carried a role-only variant; 0013b restored aal/confirmed.
-- This file is the corrected single-migration prod candidate.)
create or replace function public.tenant_can_write(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_tenant_role(p_tenant) in ('owner', 'admin', 'doctor', 'nurse')
     and (public.my_tenant_role(p_tenant) = 'nurse' or public.my_aal2())
     and public.my_email_confirmed()
     and (public.my_subscription_ok() or public.break_glass_live(p_tenant))
$$;

-- tenant_write_ok: covers gp/mar/na/nr ins+upd, i_ins, m_ins, s_ins/s_upd,
-- sync_guard/apply_*_op, accept_invite. (Verified: no SELECT policy calls it.)
create or replace function public.tenant_write_ok(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenants t where t.id = p_tenant
    and (t.status = 'active'
      or (t.status = 'grace' and t.grace_until is not null and t.grace_until > now())))
  and (public.my_subscription_ok() or public.break_glass_live(p_tenant))
$$;

-- ================= 4. Governance write policies (no helper to inherit from) =================
-- Suspend semantics preserved exactly: still no tenant_write_ok here (as before).

drop policy if exists "i_del" on public.invites;
create policy "i_del" on public.invites for delete using (
  (my_tenant_role(tenant_id) = any (array['owner'::text, 'admin'::text]))
  and my_aal2() and my_email_confirmed()
  and (my_subscription_ok() or break_glass_live(tenant_id)));

drop policy if exists "m_del" on public.memberships;
create policy "m_del" on public.memberships for delete using (
  (my_tenant_role(tenant_id) = any (array['owner'::text, 'admin'::text]))
  and my_aal2() and my_email_confirmed()
  and (my_subscription_ok() or break_glass_live(tenant_id)));

drop policy if exists "m_upd" on public.memberships;
create policy "m_upd" on public.memberships for update
  using (
    (my_tenant_role(tenant_id) = any (array['owner'::text, 'admin'::text]))
    and ((role <> 'owner'::text) or (my_tenant_role(tenant_id) = 'owner'::text))
    and (my_subscription_ok() or break_glass_live(tenant_id)))
  with check (
    (my_tenant_role(tenant_id) = any (array['owner'::text, 'admin'::text]))
    and ((role <> 'owner'::text) or (my_tenant_role(tenant_id) = 'owner'::text))
    and my_aal2() and my_email_confirmed()
    and (my_subscription_ok() or break_glass_live(tenant_id)));

drop policy if exists "t_upd" on public.tenants;
create policy "t_upd" on public.tenants for update
  using (
    (my_tenant_role(id) = any (array['owner'::text, 'admin'::text]))
    and (my_subscription_ok() or break_glass_live(id)))
  with check (
    (my_tenant_role(id) = any (array['owner'::text, 'admin'::text]))
    and my_aal2() and my_email_confirmed()
    and (my_subscription_ok() or break_glass_live(id)));

-- Tenant minting: entitlement required, no break-glass (nothing to relieve yet —
-- this closes dodge-by-mint). Fresh signups carry trialing profiles via trigger.
drop policy if exists "t_ins" on public.tenants;
create policy "t_ins" on public.tenants for insert with check (
  (auth.uid() is not null) and my_email_confirmed() and my_subscription_ok());

-- ================= 5. Storage writes (inline membership checks) =================
-- Vanilla-Postgres CI has no storage schema: guard everything like 0001/0007
-- so a fresh apply outside Supabase skips these two policies instead of
-- aborting the whole migration. On Supabase (where storage.objects exists)
-- the policy expressions are unchanged from the staging/prod applied version.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "d_ins" on storage.objects;
    create policy "d_ins" on storage.objects for insert with check (
      (bucket_id = 'clinic-docs'::text)
      and (exists (select 1 from memberships m
        where m.user_id = auth.uid() and m.status = 'active'::text
          and (m.tenant_id)::text = (storage.foldername(objects.name))[1]
          and (m.role = any (array['owner'::text, 'admin'::text, 'doctor'::text, 'nurse'::text]))))
      and (public.my_subscription_ok() or exists (select 1 from public.break_glass_events b
        where b.actor_id = auth.uid() and b.scope = 'subscription-gate'
          and char_length(b.reason) >= 8 and b.created_at > now() - interval '4 hours'
          and b.tenant_id::text = (storage.foldername(objects.name))[1]))
    );

    drop policy if exists "d_upd" on storage.objects;
    create policy "d_upd" on storage.objects for update
      using ((bucket_id = 'clinic-docs'::text)
        and ((storage.foldername(name))[1] in (select (my_tenant_ids())::text as my_tenant_ids)))
      with check (
        (bucket_id = 'clinic-docs'::text)
        and (exists (select 1 from memberships m
          where m.user_id = auth.uid() and m.status = 'active'::text
            and (m.tenant_id)::text = (storage.foldername(objects.name))[1]
            and (m.role = any (array['owner'::text, 'admin'::text, 'doctor'::text, 'nurse'::text]))))
        and (public.my_subscription_ok() or exists (select 1 from public.break_glass_events b
          where b.actor_id = auth.uid() and b.scope = 'subscription-gate'
            and char_length(b.reason) >= 8 and b.created_at > now() - interval '4 hours'
            and b.tenant_id::text = (storage.foldername(objects.name))[1]))
      );
  end if;
end $$;

-- ================= 6. RPC least privilege for the new helpers (0007 pattern) =================
do $$
declare f text;
begin
  foreach f in array array['public.my_subscription_ok()', 'public.break_glass_live(uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ================= 7. STAGING-ONLY backfill (no-op on prod: no such emails) =================
-- The 3 human-tester accounts predate the profile trigger; without rows they
-- would be write-locked on staging after this gate. Memberships still gate reads.
insert into public.profiles (id, email, trial_ends_at, sub_status)
select u.id, u.email, now() + interval '30 days', 'trialing'
from auth.users u
where u.email like '%@staging.test'
  and not exists (select 1 from public.profiles p where p.id = u.id);
