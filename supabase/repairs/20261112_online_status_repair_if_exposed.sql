-- ONLY RUN THIS IF the SQL A validation (supabase/validation/20261112_online_status_checks.sql) says privacy_status = 'INCOMPLETE'. Otherwise do not run it. NOT RUN by anyone.
--
-- WHAT IT FIXES: an anonymous visitor or an unrelated signed-in account can read last_seen_at and/or session_started_at of a profile whose "show when I am online" switch is OFF,
-- straight from public.profiles. The app hides the status, but the database still hands it out.
--
-- WHAT IT DOES (and nothing else): for the roles anon and authenticated, it takes away the table-wide SELECT on public.profiles and gives SELECT back on every column EXCEPT last_seen_at and
-- session_started_at. Every row stays readable exactly as before, every other column too, and nobody's ability to insert, update or delete changes. The heartbeat (touch_presence) is a
-- security-definer function and the admin Users page uses the service key, so neither is affected.
--
-- REQUIRED APP CHANGE (otherwise profile loading breaks): src/lib/auth.ts reads the signed-in person's own profiles with select("*") in two places (the profile list, and the row returned after
-- creating a profile). "*" now includes the two protected columns and the database refuses it ("permission denied"). Both must be changed to the explicit column list that STEP 0 below prints
-- BEFORE this is run. Deploy that app change together with (or just before) this SQL. Do not run this SQL without it.
--
-- STEP 0 (read-only, run first, send me the one cell): the exact column list to put in those two select(...) calls.
--   select string_agg(column_name, ',' order by ordinal_position) as safe_select_list
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles' and column_name not in ('last_seen_at', 'session_started_at');
--
-- AFTER RUNNING: run the validation again (expected privacy_status = 'COMPLETE'), then open the app and check you can still log in, switch profiles and see Account.
-- UNDO: supabase/rollback/20261112_online_status_repair_rollback.sql
do $$
declare
  who text;
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name not in ('last_seen_at', 'session_started_at');
  if cols is null then
    raise exception 'public.profiles has no columns to grant; nothing was changed';
  end if;
  foreach who in array array['anon', 'authenticated'] loop
    -- only roles that could read the table at all are touched, so a role that had no access does not gain any
    if has_table_privilege(who, 'public.profiles', 'select') then
      execute format('revoke select on public.profiles from %I', who);
      execute format('grant select (%s) on public.profiles to %I', cols, who);
    end if;
  end loop;
end $$;
