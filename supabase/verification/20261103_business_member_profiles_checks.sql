-- Business member access checks. READ-ONLY apart from a throw-away temporary table that disappears when the run ends.
-- Run in the Supabase SQL editor AFTER supabase/migrations/20261103_business_member_profiles.sql and send back the table.
-- (Run BEFORE it and checks 1 to 3 show FAIL: the function is not there yet. That is expected.)
--
--   PASS   what was expected.
--   FAIL   something is wrong; the detail column says what.
--   INFO   a count for a human to read.

create temp table _bm_checks (n int, what text, value text, result text, detail text) on commit drop;

-- Check 4 and 5 act as each real team member in turn (the function reads the signed-in id), so they prove the new access and
-- the refusals on the real rows without changing anything.
do $$
declare
  rec record;
  got jsonb;
  seen int := 0;
  missing int := 0;
  leaked int := 0;
  wrong_type int := 0;
  detail_missing text := '';
begin
  for rec in
    select m.user_id, m.profile_id, p.profile_type
    from public.profile_members m
    join public.profiles p on p.id = m.profile_id
    where m.role in ('admin', 'member')
      and p.user_id is distinct from m.user_id
  loop
    perform set_config('request.jwt.claim.sub', rec.user_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', rec.user_id::text, 'role', 'authenticated')::text, true);
    got := public.list_member_profiles();
    seen := seen + 1;
    if rec.profile_type = 'business' then
      if not (got @> jsonb_build_array(jsonb_build_object('id', rec.profile_id))) then
        missing := missing + 1;
        detail_missing := detail_missing || left(rec.user_id::text, 8) || '->' || left(rec.profile_id::text, 8) || ' ';
      end if;
    else
      -- a member row on a personal profile must never surface
      if got @> jsonb_build_array(jsonb_build_object('id', rec.profile_id)) then wrong_type := wrong_type + 1; end if;
    end if;
    -- never any owner-only or billing column
    if exists (
      select 1 from jsonb_array_elements(got) e, jsonb_object_keys(e) k
      where k in ('full_name','phone','address_line1','address_line2','city','state','zip','country','tax_id','stripe_customer_id',
                  'date_of_birth','age_verified','marketing_opt_in','user_id','bulk_scans_used','bulk_scan_limit_override')
    ) then leaked := leaked + 1; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  insert into _bm_checks values
    (4, 'team memberships checked (admin or member of a business they do not own)', seen::text, 'INFO', ''),
    (5, 'every such member gets their business back from the function (expect 0 missing)', missing::text, case when missing = 0 then 'PASS' else 'FAIL' end, detail_missing),
    (6, 'a member row on a personal profile never surfaces (expect 0)', wrong_type::text, case when wrong_type = 0 then 'PASS' else 'FAIL' end, ''),
    (7, 'no owner-only / billing column is ever returned (expect 0 callers with one)', leaked::text, case when leaked = 0 then 'PASS' else 'FAIL' end, '');
end $$;

insert into _bm_checks
select 1, 'function public.list_member_profiles() exists', count(*)::text, case when count(*) = 1 then 'PASS' else 'FAIL' end, ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'list_member_profiles';

insert into _bm_checks
select 2, 'signed-in users can run it; signed-out (anon) cannot',
       'authenticated=' || coalesce(has_function_privilege('authenticated', 'public.list_member_profiles()', 'execute')::text, 'n/a')
         || ' anon=' || coalesce(has_function_privilege('anon', 'public.list_member_profiles()', 'execute')::text, 'n/a'),
       case when coalesce(has_function_privilege('authenticated', 'public.list_member_profiles()', 'execute'), false)
             and not coalesce(has_function_privilege('anon', 'public.list_member_profiles()', 'execute'), true) then 'PASS' else 'FAIL' end, ''
where exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'list_member_profiles');

-- the profiles table itself was NOT opened up: no profiles policy mentions membership
insert into _bm_checks
select 3, 'no policy on public.profiles was added for team members (expect 0)', count(*)::text,
       case when count(*) = 0 then 'PASS' else 'INFO' end,
       coalesce(string_agg(policyname, ', '), '')
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and (qual ilike '%profile_members%' or qual ilike '%is_profile_member%');

-- a profile's roster: removed people really are off it
insert into _bm_checks
select 8, 'business profiles with at least one added member (informational)', count(distinct m.profile_id)::text, 'INFO', ''
from public.profile_members m join public.profiles p on p.id = m.profile_id
where m.role in ('admin', 'member') and p.profile_type = 'business';

select * from _bm_checks order by n;
