-- Read-only. Run AFTER supabase/migrations/20261112_online_status_off_by_default.sql. Stores nothing and changes nothing (it only borrows the anonymous and signed-in roles for a moment, inside one statement, to count rows).
-- Run the WHOLE file and send the one-row result.
--
-- WHAT IT TESTS FOR REAL (not by reading rules): can an anonymous visitor, and an unrelated signed-in account (a made-up user who owns nothing and follows nothing), read the
-- last-active time of a profile whose "show when I am online" switch is OFF, straight from public.profiles? It also checks session_started_at, which reveals the same thing.
--
-- EXPECTED RESULT (privacy complete):
--   anon_last_seen_at_readable = 0                      signed_in_unrelated_last_seen_at_readable = 0
--   anon_session_started_at_readable = 0                signed_in_unrelated_session_started_at_readable = 0
--   privacy_status = 'COMPLETE'
--   (a *_blocked = true means the database refused the read outright, which also counts as safe)
-- INCOMPLETE:   any *_readable above 0 => privacy_status starts with 'INCOMPLETE'. That means hidden activity can still be read directly from the table even though the app hides it.
--               Then run supabase/repairs/20261112_online_status_repair_if_exposed.sql (instructions at the top of that file) and run this file again.
-- INCONCLUSIVE: hidden_activity_profiles_total = 0 means no profile has both the switch OFF and a recorded last-active time, so nothing could be tested. Open the app on any account for a minute (the
--               heartbeat records a time), then run this again.
-- Scope: these two kinds of caller only. It does not test other signed-in people who share a business with the profile.
do $$
declare
  hidden_ids uuid[];
  fake uuid := gen_random_uuid();
  r jsonb;
  n bigint;
  who text;
  col text;
  total int;
  exposed bigint;
begin
  select coalesce(array_agg(id), '{}') into hidden_ids from public.profiles where not coalesce(show_online_status, false) and last_seen_at is not null;
  total := coalesce(array_length(hidden_ids, 1), 0);
  r := jsonb_build_object('hidden_activity_profiles_total', total);
  foreach who in array array['anon', 'authenticated'] loop
    foreach col in array array['last_seen_at', 'session_started_at'] loop
      begin
        execute format('set local role %I', who);
        perform set_config('request.jwt.claims', case when who = 'authenticated' then json_build_object('sub', fake, 'role', 'authenticated')::text else '{}' end, true);
        perform set_config('request.jwt.claim.sub', case when who = 'authenticated' then fake::text else '' end, true);
        execute format('select count(*) from public.profiles where %I is not null and id = any($1)', col) into n using hidden_ids;
        reset role;
        r := r || jsonb_build_object(case when who = 'anon' then 'anon' else 'signed_in_unrelated' end || '_' || col || '_readable', n);
      exception
        when insufficient_privilege then
          r := r || jsonb_build_object(case when who = 'anon' then 'anon' else 'signed_in_unrelated' end || '_' || col || '_readable', 0,
                                       case when who = 'anon' then 'anon' else 'signed_in_unrelated' end || '_' || col || '_blocked', true);
        when undefined_column then
          r := r || jsonb_build_object(case when who = 'anon' then 'anon' else 'signed_in_unrelated' end || '_' || col || '_readable', 0);
      end;
    end loop;
  end loop;
  exposed := (r->>'anon_last_seen_at_readable')::bigint + (r->>'anon_session_started_at_readable')::bigint
           + (r->>'signed_in_unrelated_last_seen_at_readable')::bigint + (r->>'signed_in_unrelated_session_started_at_readable')::bigint;
  r := r || jsonb_build_object('privacy_status', case
    when total = 0 then 'INCONCLUSIVE: no profile has the switch off and a recorded last-active time, so there was nothing to test'
    when exposed > 0 then 'INCOMPLETE: hidden last-active information can be read directly from the profiles table by an anonymous visitor or an unrelated signed-in account'
    else 'COMPLETE' end);
  perform set_config('vltd.online_status_check', r::text, false);
end $$;

select jsonb_build_object(
  'column_exists', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_online_status'),
  'column_default_is_false', (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_online_status') = 'false',
  'column_not_null', (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'show_online_status') = 'NO',
  'function_exists', to_regprocedure('public.get_public_online_status(uuid)') is not null,
  'visitors_can_call_it', has_function_privilege('anon', 'public.get_public_online_status(uuid)', 'execute') and has_function_privilege('authenticated', 'public.get_public_online_status(uuid)', 'execute'),
  'profiles_select_rules', (select coalesce(jsonb_agg(jsonb_build_object('name', policyname, 'roles', roles, 'cmd', cmd, 'using', qual)), '[]'::jsonb) from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL')),
  'profiles_total', (select count(*) from public.profiles),
  'profiles_with_status_on', (select count(*) from public.profiles where show_online_status)
) || current_setting('vltd.online_status_check')::jsonb as validation;
-- Also expected: the first five true; profiles_with_status_on 0 right after the migration (everyone starts OFF); profiles_total equals the number of profiles you have.
-- profiles_select_rules lists the table's read rules for diagnosis (they were never in the repository). If the status is INCOMPLETE, send this whole row.
