-- =====================================================================
-- 0005_billing — harden the v10 billing base (supabase/schema.sql):
--  1. CLOSES A SELF-GRANT HOLE: the base "own profile" policy is FOR ALL
--     constrained only by id, so any user could UPDATE their own row to
--     sub_status='active' with a far-future trial_ends_at. Billing status is
--     now service-managed: owners get SELECT-only; all writes go through the
--     webhook / subscription API (service key, bypasses RLS) or
--     ensure_profile() below. Nothing client-side ever UPDATEs profiles.
--  2. Adds the missing sub_status CHECK (base had only a comment).
--  3. ensure_profile() lazily provisions the 14-day trial row on first login
--     (belt-and-braces next to the handle_new_user trigger; covers users
--     created while the trigger was absent). Called by fetchStatus().
-- Assumes schema.sql + 0001 are applied (like 0002-0004 assume 0001).
-- Trial length must match TRIAL_DAYS in js/config.js (14).
-- Rollback: drop function, drop CHECK, restore "own profile" FOR ALL policy.
-- =====================================================================

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check
  check (sub_status in ('none', 'trialing', 'created', 'authenticated', 'active', 'past_due', 'cancelled', 'expired'));

drop policy if exists "own profile" on profiles;
drop policy if exists "prof_sel_own" on profiles;
create policy "prof_sel_own" on profiles for select using (id = auth.uid());
-- No insert/update policies: inserts via ensure_profile(), updates via the
-- service key only. (subscription_events in schema.sql was already correct.)

-- Lazily provisions the caller's trial row. Idempotent; safe to call on
-- every login. Raises when called without a user session.
create or replace function public.ensure_profile()
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  row public.profiles%rowtype;
begin
  if uid is null then raise exception 'login required'; end if;
  insert into public.profiles (id, trial_ends_at, sub_status)
  values (uid, now() + interval '14 days', 'trialing')
  on conflict (id) do nothing;
  select * into row from public.profiles where id = uid;
  return row_to_json(row);
end; $$;
