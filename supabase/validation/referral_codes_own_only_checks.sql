-- READ-ONLY. Changes nothing. Run it BEFORE and again AFTER supabase/migrations/20261019_referral_codes_own_rows_only.sql in the Supabase SQL editor.
-- (If the editor shows a warning dialog, "Run without RLS" is the safe button: this query only reads.)
-- BEFORE: the rows that close the exposure show ok_after_change = false (that is today's exposure); the rows that keep things working show true.
-- AFTER:  every row with an expected value must show true. A row with no expected value is information only.
select n, check_name, state_now, expected_after_change, case when expected_after_change is null then null else (state_now = expected_after_change) end as ok_after_change
from (
  select 1 as n, 'a policy lets ANY signed-in account read every referral code ("Read any code")' as check_name,
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_codes' and policyname = 'Read any code') as state_now, false as expected_after_change
  union all select 2, 'some read policy on referral_codes has no condition at all (using true)',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_codes' and cmd in ('SELECT', 'ALL') and qual = 'true'), false
  union all select 3, 'an account can still read and manage its OWN code ("Own referral code": auth.uid() = user_id)',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_codes' and policyname = 'Own referral code' and qual like '%auth.uid() = user_id%'), true
  union all select 4, 'admins keep read access to every code (policy "Admins read all referral codes")',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_codes' and policyname = 'Admins read all referral codes' and cmd = 'SELECT'), true
  union all select 5, 'the admin policy is tied to the existing admin check (is_vltd_admin)',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'referral_codes' and policyname = 'Admins read all referral codes' and qual like '%is_vltd_admin%'), true
  union all select 6, 'the function redeem_referral_code(text) exists',
         to_regprocedure('public.redeem_referral_code(text)') is not null, true
  union all select 7, 'it runs with its owner''s rights (security definer), so a code owner is never exposed to the caller',
         coalesce((select prosecdef from pg_proc where oid = to_regprocedure('public.redeem_referral_code(text)')), false), true
  union all select 8, 'a visitor with no sign-in can run it',
         coalesce(case when to_regprocedure('public.redeem_referral_code(text)') is not null then has_function_privilege('anon', 'public.redeem_referral_code(text)', 'execute') end, false), false
  union all select 9, 'PUBLIC (everybody) holds EXECUTE on it',
         coalesce((select exists (select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE') from pg_proc p where p.oid = to_regprocedure('public.redeem_referral_code(text)')), false), false
  union all select 10, 'a signed-in account can run it',
         coalesce(case when to_regprocedure('public.redeem_referral_code(text)') is not null then has_function_privilege('authenticated', 'public.redeem_referral_code(text)', 'execute') end, false), true
  union all select 11, 'a visitor can read any column of referral_codes (closed earlier on 2026-10-17; must stay false)',
         has_any_column_privilege('anon', 'public.referral_codes', 'select'), false
  union all select 12, 'row-level security is ON for referral_codes',
         (select relrowsecurity from pg_class where oid = 'public.referral_codes'::regclass), true
  union all select 13, 'referral_redemptions still has exactly its 2 policies (unchanged)',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'referral_redemptions') = 2, true
  union all select 14, 'user_perks still has exactly its 1 policy (unchanged)',
         (select count(*) from pg_policies where schemaname = 'public' and tablename = 'user_perks') = 1, true
  union all select 15, 'increment_user_perk_galleries is unchanged (still not security definer)',
         coalesce((select not prosecdef from pg_proc where oid = to_regprocedure('public.increment_user_perk_galleries(uuid,integer,text,text)')), false), true
  union all select 16, 'INFO: the policies on referral_codes right now: ' || coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'referral_codes'), '-'),
         null, null
) s
order by n;
