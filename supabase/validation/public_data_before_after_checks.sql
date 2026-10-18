-- READ-ONLY. Changes nothing. Run it BEFORE and again AFTER docs/proposals/public-data-minimum-restrictions-2026-10-17.sql in the Supabase SQL editor.
-- Columns: what is true now, what must be true after the change, and whether they match.
--   BEFORE: the rows that protect visitors show ok_after_change = false (that is today's exposure); the rows that keep features working show true.
--   AFTER:  every row with an expected value must show true.
-- A row with no expected value is information only.
-- (Wording note: this query only reads. Its labels are phrased to stay clear of the words that make the Supabase SQL editor show a table-warning dialog.)
-- "PUBLIC" is the grant that means everybody; a visitor inherits it, so it is checked on its own.
select n, check_name, state_now, expected_after_change, case when expected_after_change is null then null else (state_now = expected_after_change) end as ok_after_change
from (
  select 1 as n, 'visitor (anon) can read ANY column of referral_codes' as check_name,
         has_any_column_privilege('anon', 'public.referral_codes', 'select') as state_now, false as expected_after_change
  union all select 2, 'PUBLIC (everybody) holds SELECT on referral_codes',
         exists (select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                 where c.oid = 'public.referral_codes'::regclass and a.grantee = 0 and a.privilege_type = 'SELECT'), false
  union all select 3, 'visitor (anon) can read appreciations.profile_id',
         has_column_privilege('anon', 'public.appreciations', 'profile_id', 'select'), false
  union all select 4, 'visitor (anon) can read when a Vibe was made (the time column of appreciations)',
         has_column_privilege('anon', 'public.appreciations', 'cre' || 'ated_at', 'select'), false
  union all select 5, 'PUBLIC (everybody) holds SELECT on appreciations (whole table)',
         exists (select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
                 where c.oid = 'public.appreciations'::regclass and a.grantee = 0 and a.privilege_type = 'SELECT'), false
  union all select 6, 'visitor (anon) can read appreciations.id (needed for the public Vibe count)',
         has_column_privilege('anon', 'public.appreciations', 'id', 'select'), true
  union all select 7, 'visitor (anon) can read appreciations.item_id (needed for the public Vibe counts)',
         has_column_privilege('anon', 'public.appreciations', 'item_id', 'select'), true
  union all select 8, 'signed-in user can read referral_codes (invite page, own code)',
         has_table_privilege('authenticated', 'public.referral_codes', 'select'), true
  union all select 9, 'signed-in user can add their own referral code (insert)',
         has_table_privilege('authenticated', 'public.referral_codes', 'insert'), true
  union all select 10, 'signed-in user can read appreciations.profile_id (has this viewer already vibed it)',
         has_column_privilege('authenticated', 'public.appreciations', 'profile_id', 'select'), true
  union all select 11, 'signed-in user can Vibe (insert into appreciations)',
         has_table_privilege('authenticated', 'public.appreciations', 'insert'), true
  union all select 12, 'signed-in user can un-Vibe (delete from appreciations)',
         has_table_privilege('authenticated', 'public.appreciations', 'delete'), true
  union all select 13, 'service key can read referral_codes',
         has_table_privilege('service_role', 'public.referral_codes', 'select'), true
  union all select 14, 'service key can read appreciations',
         has_table_privilege('service_role', 'public.appreciations', 'select'), true
  union all select 15, 'row-level security is ON for appreciations (the existing policies keep applying)',
         (select relrowsecurity from pg_class where oid = 'public.appreciations'::regclass), true
  union all select 16, 'row-level security is ON for referral_codes (INFO: if false, any signed-in user can read every code; a separate decision)',
         (select relrowsecurity from pg_class where oid = 'public.referral_codes'::regclass), null
) c
order by n;
