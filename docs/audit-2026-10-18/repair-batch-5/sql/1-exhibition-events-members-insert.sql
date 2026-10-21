-- RC-05, file 1 of 3. Makes "Announce" and the follower notice on "Make public" work for the profile's own members.
--
-- FOUND 2026-10-20 on production with a throwaway QA account: the owner of a profile (a row in profile_members exists) is refused
-- when inserting into exhibition_events (error 42501, row-level security). An insert that uses the user's own auth id as the profile id
-- fails on the FOREIGN KEY instead (23503), which proves the old rule "auth.uid() = profile_id" is the one still in force, i.e.
-- supabase/migrations/20260823_fix_exhibition_events_team_check.sql was never applied. This file is that fix, unchanged in effect.
--
-- WHAT IT DOES: replaces the insert rule with "the person is a member of that profile" (the same helper galleries and vault_items use).
-- Reading, updating and deleting are not touched. Changes no data. Safe to run more than once.
--
-- UNDO: drop policy if exists "Members insert exhibition_events" on public.exhibition_events;
--       create policy "Owner insert exhibition_events" on public.exhibition_events for insert with check (auth.uid() = profile_id);

drop policy if exists "Owner insert exhibition_events" on public.exhibition_events;
drop policy if exists "Members insert exhibition_events" on public.exhibition_events;

create policy "Members insert exhibition_events"
  on public.exhibition_events for insert
  with check (public.is_profile_member(profile_id));
