-- =====================================================================
-- 0006_billing_grants — let signed-in users lazily provision their trial row.
-- ensure_profile() (0005) is SECURITY DEFINER but had no EXECUTE grant, so the
-- app's fetchStatus() RPC fell through to a plain select and brand-new users
-- (created while the signup trigger was absent) hit the paywall instead of
-- their 14-day trial. Idempotent; run on staging AND production.
-- =====================================================================

grant execute on function public.ensure_profile() to authenticated;
