-- RC-05, file 3 of 3 (STEP 2 of 2 for the profile id). Run ONLY after file 2 and after the site version that reads public_galleries is live.
--
-- WHAT IT DOES: the public read rule on the galleries table stops returning exhibitions that use an alias. Those are then readable by the
-- public only through public_galleries (profile_id hidden). Exhibitions without an alias, and every member's own exhibitions
-- (galleries_select_member), are unchanged. Insert/update/delete rules are not touched. Changes no data.
--
-- BEFORE RUNNING: run 0-inspect-read-only.sql and check that the only public SELECT rule on galleries is the one this file replaces
-- (it is found by its content, not by name, and the block stops with a message if it finds none or more than one).
--
-- UNDO: drop policy if exists "Public galleries are readable" on public.galleries;
--       create policy "Public galleries are readable" on public.galleries for select using (visibility = 'PUBLIC' and state = 'ACTIVE');

do $$
declare
  r record;
  found_count int := 0;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'galleries' and cmd = 'SELECT'
      and qual ilike '%PUBLIC%' and qual ilike '%ACTIVE%' and qual not ilike '%is_profile_member%' and qual not ilike '%auth.uid%'
  loop
    found_count := found_count + 1;
    execute format('drop policy %I on public.galleries', r.policyname);
  end loop;
  if found_count <> 1 then
    raise exception 'expected exactly one public read rule on galleries, found %: nothing was changed (this block rolls back)', found_count;
  end if;
end;
$$;

create policy "Public galleries are readable"
  on public.galleries for select
  using (visibility = 'PUBLIC' and state = 'ACTIVE' and alias_enabled = false);
