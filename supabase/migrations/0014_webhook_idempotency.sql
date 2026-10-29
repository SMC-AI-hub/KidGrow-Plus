-- 0014 · Webhook idempotency (KG-PT-002) · ADDITIVE ONLY, zero effect on existing rows.
-- APPLY TO AN ENVIRONMENT BEFORE DEPLOYING THE WEBHOOK CODE THAT READS THESE COLUMNS.
-- (Unknown-column SELECT/PATCH would otherwise fail against Razorpay retries.)
--
-- ROLLBACK (if ever needed):
--   drop index if exists public.uniq_subscription_events_rzp_evt;
--   alter table public.subscription_events drop column if exists razorpay_event_id;
--   alter table public.profiles drop column if exists last_webhook_at;

-- Razorpay event id (evt_...) for exactly-once processing. NULL for pre-fix rows;
-- Postgres UNIQUE treats NULLs as distinct, so old rows never collide.
alter table public.subscription_events
  add column if not exists razorpay_event_id text;

create unique index if not exists uniq_subscription_events_rzp_evt
  on public.subscription_events (razorpay_event_id);

-- Last applied webhook event time per profile: stale/out-of-order redeliveries
-- (older created_at) are acknowledged but not applied.
alter table public.profiles
  add column if not exists last_webhook_at timestamptz;
