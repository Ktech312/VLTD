-- exhibition_events' own INSERT policy (20260622_exhibition_events.sql)
-- predates the team/profile_members model (20260707_profile_members.sql)
-- and was never updated to match it:
--   with check (auth.uid() = profile_id)
-- profile_id here is profiles.id, NOT auth.uid() — those are only equal
-- for a legacy solo account (profiles.id happened to be seeded from the
-- owning user's own auth id before team profiles existed). For any
-- business/team profile, profiles.id is the shared profile's own id,
-- never any individual member's auth.uid() — so this check fails closed
-- for every real team member trying to publish/announce an exhibition
-- on behalf of their own team's profile. Not an open hole (it blocks
-- legitimate use rather than allowing unauthorized use), but still wrong
-- and inconsistent with every other team-aware table in this schema.
--
-- Fix: use the same is_profile_member() helper vault_items/galleries/
-- gallery_items already use for this exact purpose (any member — owner,
-- admin, or member role — can act on behalf of their profile).

drop policy if exists "Owner insert exhibition_events" on public.exhibition_events;

create policy "Members insert exhibition_events"
  on public.exhibition_events for insert
  with check (public.is_profile_member(profile_id));
