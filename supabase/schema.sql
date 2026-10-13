-- =====================================================================
-- KidGrow Pro — Supabase schema (run once in Supabase SQL editor)
-- Tables: profiles (account + subscription) · clinic_snapshots (cloud backup
-- history) · subscription_events (webhook audit). RLS: users see only OWN rows.
-- Service-role key bypasses RLS (used by Vercel webhook only).
-- =====================================================================

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text default '',
  clinic_name text default '',
  trial_ends_at timestamptz,
  sub_status text default 'none',
  -- none | trialing | created | authenticated | active | past_due | cancelled | expired
  razorpay_sub_id text default '',
  razorpay_customer_id text default '',
  current_period_end timestamptz,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create profile + 14-day trial on signup (keep TRIAL_DAYS in sync in js/config.js)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, trial_ends_at, sub_status)
  values (new.id, coalesce(new.email, ''), now() + interval '14 days', 'trialing')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- clinic_snapshots (cloud backup history, newest = current) ----------
create table if not exists clinic_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  data jsonb not null,
  device text default '',
  app_version text default '',
  created_at timestamptz default now()
);
alter table clinic_snapshots enable row level security;
drop policy if exists "own snapshots" on clinic_snapshots;
create policy "own snapshots" on clinic_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_snap_user_time on clinic_snapshots (user_id, created_at desc);

-- ---------- subscription_events (webhook audit log) ----------
create table if not exists subscription_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles (id) on delete cascade,
  event text default '',
  razorpay_sub_id text default '',
  payload jsonb,
  created_at timestamptz default now()
);
alter table subscription_events enable row level security;
drop policy if exists "own events read" on subscription_events;
create policy "own events read" on subscription_events
  for select using (auth.uid() = user_id);
-- (writes come from the webhook via service-role key, which bypasses RLS)
