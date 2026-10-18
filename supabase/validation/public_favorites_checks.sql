-- READ-ONLY. Changes nothing. Run it BEFORE and again AFTER supabase/migrations/20261019_public_favorites_not_readable_by_others.sql in the Supabase SQL editor.
-- (If the editor shows a warning dialog, "Run without RLS" is the safe button: this query only reads.)
-- BEFORE: the rows that close the exposure show ok_after_change = false (that is today's exposure); the rows that keep saving working show true.
-- AFTER:  every row with an expected value must show true. A row with no expected value is information only.
select n, check_name, state_now, expected_after_change, case when expected_after_change is null then null else (state_now = expected_after_change) end as ok_after_change
from (
  select 1 as n, 'a read policy on public_favorites has no condition at all (using true): anyone can read every save' as check_name,
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and cmd in ('SELECT', 'ALL') and qual = 'true') as state_now, false as expected_after_change
  union all select 2, 'signed-in accounts read only their own saves (policy "Own favorites are readable": user_id = auth.uid())',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and policyname = 'Own favorites are readable' and cmd = 'SELECT' and qual like '%user_id = auth.uid()%'), true
  union all select 3, 'a visitor (anon) holds SELECT on public_favorites',
         has_any_column_privilege('anon', 'public.public_favorites', 'select'), false
  union all select 4, 'PUBLIC (everybody) holds SELECT on public_favorites',
         coalesce((select exists (select 1 from aclexplode(c.relacl) a where a.grantee = 0 and a.privilege_type = 'SELECT') from pg_class c where c.oid = 'public.public_favorites'::regclass), false), false
  union all select 5, 'a signed-in account can read its own saves (SELECT kept for authenticated, limited by the policy)',
         has_table_privilege('authenticated', 'public.public_favorites', 'select'), true
  union all select 6, 'saving still works: the signed-in and the guest insert policies are both there',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and cmd = 'INSERT') >= 2, true
  union all select 7, 'unsaving still works: the signed-in delete policy and unfavorite_as_guest are both there',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'public_favorites' and cmd = 'DELETE' and qual like '%user_id = auth.uid()%') and to_regprocedure('public.unfavorite_as_guest(text,text,text)') is not null, true
  union all select 8, 'the function favorite_count(text, text) exists and runs with its owner''s rights (security definer)',
         coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.favorite_count(text,text)')), false), true
  union all select 9, 'the function guest_favorite_status(text, text, text) exists and runs with its owner''s rights (security definer)',
         coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.guest_favorite_status(text,text,text)')), false), true
  union all select 10, 'a visitor and a signed-in account can run both functions',
         coalesce(case when to_regprocedure('public.favorite_count(text,text)') is not null and to_regprocedure('public.guest_favorite_status(text,text,text)') is not null
                  then has_function_privilege('anon', 'public.favorite_count(text,text)', 'execute') and has_function_privilege('anon', 'public.guest_favorite_status(text,text,text)', 'execute')
                   and has_function_privilege('authenticated', 'public.favorite_count(text,text)', 'execute') and has_function_privilege('authenticated', 'public.guest_favorite_status(text,text,text)', 'execute') end, false), true
  union all select 11, 'PUBLIC (everybody) holds EXECUTE on either function',
         coalesce((select bool_or(exists (select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE')) from pg_proc p where p.proname in ('favorite_count', 'guest_favorite_status') and p.pronamespace = 'public'::regnamespace), false), false
  union all select 12, 'the 2026-10-10 backup copy of the saves is readable by a visitor or a signed-in account (false also when the copy does not exist)',
         coalesce(case when to_regclass('public.public_favorites_backup_20261010') is not null
                  then has_any_column_privilege('anon', 'public.public_favorites_backup_20261010', 'select') or has_any_column_privilege('authenticated', 'public.public_favorites_backup_20261010', 'select') end, false), false
  union all select 13, 'row-level security is ON for public_favorites',
         (select relrowsecurity from pg_class where oid = 'public.public_favorites'::regclass), true
  union all select 14, 'INFO: the policies on public_favorites right now: ' || coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'public_favorites'), '-'),
         null, null
) s
order by n;
