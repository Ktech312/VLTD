-- RC-05, file 1b (OPTIONAL, needs a product decision). Events of an exhibition that uses an alias should not hand out the real profile id.
--
-- exhibition_events is readable by everyone ("using (true)") and every row carries profile_id. For an exhibition with alias_enabled
-- an event row therefore reveals the real profile behind the alias (gallery_id -> event -> profile_id).
-- WHAT IT DOES: events of alias exhibitions stop being publicly readable (the profile's own members can still read them).
-- COST: followers of the real profile will no longer see "published/announced" events of alias exhibitions in their feed.
-- Changes no data. Safe to run more than once.
--
-- UNDO: drop policy if exists "Public read exhibition_events" on public.exhibition_events;
--       create policy "Public read exhibition_events" on public.exhibition_events for select using (true);
--       drop policy if exists "Members read exhibition_events" on public.exhibition_events;

create or replace function public.gallery_is_alias(p_gallery_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select g.alias_enabled from public.galleries g where g.id::text = p_gallery_id limit 1), false);
$$;

revoke all on function public.gallery_is_alias(text) from public;
grant execute on function public.gallery_is_alias(text) to anon, authenticated, service_role;

drop policy if exists "Public read exhibition_events" on public.exhibition_events;
create policy "Public read exhibition_events"
  on public.exhibition_events for select
  using (not public.gallery_is_alias(gallery_id));

drop policy if exists "Members read exhibition_events" on public.exhibition_events;
create policy "Members read exhibition_events"
  on public.exhibition_events for select to authenticated
  using (public.is_profile_member(profile_id));
