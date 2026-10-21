-- UNDO for step 1: back to the rules before it (recording refused for everyone, reading open to everyone). Only if step 1 causes a problem.
begin;
drop policy if exists "Public read of public exhibitions' events" on public.exhibition_events;
drop policy if exists "Members read their own events" on public.exhibition_events;
drop policy if exists "Members record events for their own exhibitions" on public.exhibition_events;
create policy "Public read exhibition_events" on public.exhibition_events for select using (true);
create policy "Owner insert exhibition_events" on public.exhibition_events for insert with check (auth.uid() = profile_id);
-- production's original grants (stage 0): every privilege to both roles
grant all on public.exhibition_events to authenticated;
grant all on public.exhibition_events to anon;
drop function if exists public.can_record_exhibition_event(text, uuid);
drop function if exists public.exhibition_events_are_public(text);
commit;
