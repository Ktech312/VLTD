-- Owner-membership checks. READ-ONLY: nothing is changed. Run in the Supabase SQL editor BEFORE and AFTER
-- supabase/migrations/20261014_owner_membership_completion.sql, and send back the table each time.
--
-- Result meanings:
--   PASS   what was expected.
--   FAIL   something is wrong; the detail column says what.
--   INFO   not an error by itself: needs a human decision (it is never changed automatically).

select * from (
  select 1 as n, 'profiles total' as what, count(*)::text as value, 'INFO' as result, '' as detail
  from public.profiles

  union all
  select 2, 'profiles with NO membership rows (expect 0)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(left(id::text, 8), ', '), '')
  from public.profiles p
  where not exists (select 1 from public.profile_members m where m.profile_id = p.id)

  union all
  select 3, 'profiles with members but NO owner row (expect 0)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(left(id::text, 8), ', '), '')
  from public.profiles p
  where exists (select 1 from public.profile_members m where m.profile_id = p.id)
    and not exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner')

  union all
  select 4, 'owner row exists but profiles.user_id names someone else (transfer in an odd state; NEVER auto-changed)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'INFO' end,
         coalesce(string_agg(left(id::text, 8), ', '), '')
  from public.profiles p
  where exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner')
    and not exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner' and m.user_id = p.user_id)

  union all
  select 5, 'profiles with more than one owner (informational)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'INFO' end,
         coalesce(string_agg(left(id::text, 8), ', '), '')
  from public.profiles p
  where (select count(*) from public.profile_members m where m.profile_id = p.id and m.role = 'owner') > 1

  union all
  select 6, 'profiles whose profiles.user_id is not a real account (cannot be auto-fixed)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'INFO' end,
         coalesce(string_agg(left(id::text, 8), ', '), '')
  from public.profiles p
  where p.user_id is null or not exists (select 1 from auth.users u where u.id = p.user_id)

  union all
  select 7, 'membership rows pointing at a profile that no longer exists (expect 0)', count(*)::text,
         case when count(*) = 0 then 'PASS' else 'FAIL' end, ''
  from public.profile_members m
  where not exists (select 1 from public.profiles p where p.id = m.profile_id)

  union all
  select 8, 'new-profile trigger installed (expect 1)', count(*)::text,
         case when count(*) = 1 then 'PASS' else 'FAIL' end, ''
  from pg_trigger t
  where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'profiles_add_owner_member' and not t.tgisinternal

  union all
  select 9, 'trigger function runs with owner rights (expect true)',
         coalesce(bool_or(p.prosecdef), false)::text,
         case when coalesce(bool_or(p.prosecdef), false) then 'PASS' else 'FAIL' end, ''
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'add_profile_owner_member'
) checks
order by n;

-- Detail for anything the checks above flag with INFO or FAIL (empty when everything is clean).
-- Shows the short profile id, who the profile says it belongs to, and the team as stored.
select left(p.id::text, 8) as profile,
       p.profile_type,
       left(p.user_id::text, 8) as profile_user,
       coalesce(
         (select string_agg(m.role || ':' || left(m.user_id::text, 8), ', ' order by m.role)
          from public.profile_members m where m.profile_id = p.id),
         '(no team rows)') as team
from public.profiles p
where not exists (select 1 from public.profile_members m where m.profile_id = p.id)
   or not exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner')
   or not exists (select 1 from public.profile_members m where m.profile_id = p.id and m.role = 'owner' and m.user_id = p.user_id)
   or p.user_id is null
   or not exists (select 1 from auth.users u where u.id = p.user_id)
order by p.created_at;
