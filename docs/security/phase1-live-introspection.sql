-- =====================================================================
-- KidGrow Pro — Phase 1 LIVE database introspection (READ-ONLY).
-- Run in Supabase Dashboard → SQL Editor on STAGING first, then PROD.
-- Paste ALL result tables back to the agent. No writes, no config changes.
-- =====================================================================

-- 1. Every table + is RLS on?  (expect: all public tables true)
select schemaname, tablename, rowsecurity as rls_on
from pg_tables where schemaname = 'public' order by 2;

-- 2. Every RLS policy + its expression  (look for 'true', missing roles)
select tablename, policyname, cmd as applies_to,
       qual as using_expr, with_check as check_expr
from pg_policies where schemaname = 'public' order by 1, 2;

-- 3. Views + are they security_invoker?  (expect: true/option set, or no views)
-- NOTE: version-tolerant form (works on PG14 where pg_views lacks the column)
select n.nspname as schemaname, c.relname as viewname, c.reloptions as options
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v';

-- 4. Functions: SECURITY DEFINER? search_path locked?  (expect: definer + public)
select n.nspname as schema, p.proname as function,
       pg_get_function_arguments(p.oid) as args,
       p.prosecdef as is_definer,
       p.proconfig as config
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' order by 2;

-- 5. Who can EXECUTE each function?  (expect: authenticated only, NOT anon/PUBLIC)
select routine_name as function, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public' order by 1, 2;

-- 6. Storage buckets: any public?  (expect: all false)
select id, name, public from storage.buckets order by 1;

-- 7. Storage policies on objects
select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' order by 1;

-- 8. Extensions present?  (pgsodium/vault wanted later for field encryption)
select extname, extversion from pg_extension order by 1;

-- 9. Auth footprint: users, confirmed emails, MFA factors in use
select count(*) as users,
       count(*) filter (where email_confirmed_at is not null) as email_confirmed
from auth.users;
select factor_type, status, count(*) from auth.mfa_factors group by 1, 2;

-- 10. Postgres version (EOL check)
select version();
