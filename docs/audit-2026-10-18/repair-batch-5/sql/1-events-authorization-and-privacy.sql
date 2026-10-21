-- RC-05, STEP 1 of 4. Exhibition events: who may record one, and who may read one. ONE TRANSACTION (all or nothing).
--
-- WHY (found 2026-10-20 on production with throwaway QA accounts):
--  * Recording is refused for everyone today: the old insert rule is "auth.uid() = profile_id" (20260823_fix_exhibition_events_team_check.sql
--    was never applied), so Announce and the follower notice on Make public cannot work.
--  * Reading is open to everyone ("using (true)") and every row carries profile_id and the exhibition id, so the events of an exhibition that
--    uses an alias, or that is Private / Guest-only / draft, would reveal the real profile and the exhibition once events can be written.
--
-- WHAT THIS DOES
--  INSERT: allowed only for a signed-in person who is a member of the event's profile AND only when the referenced exhibition belongs to
--          that same profile. An event that combines your profile with someone else's exhibition (or an exhibition that does not exist)
--          is refused.
--  READ:   a visitor or any unrelated account gets an event only while its exhibition is currently PUBLIC + ACTIVE and does NOT use an alias.
--          Because this is checked when the event is read, switching an exhibition to Private / Guest View / Registered / draft, or turning on
--          an alias, hides its earlier events too. Members of the event's profile can still read their own events (any state).
--  No update/delete: none existed before and none is added; the API roles' update/delete privileges are removed as well.
--  No data is changed (the table is empty today: 0 rows).
--
-- STOPS WITHOUT CHANGING ANYTHING if the table has a policy this file does not know (it lists them): send me the step-0 output.
-- Safe to run more than once. UNDO: rollback-1.sql.

begin;

-- helpers (run with the owner's rights so they can look at galleries whatever the caller can see)

-- True only when the CALLER is a member of p_profile and the exhibition belongs to p_profile.
-- It takes the caller from the login (auth.uid()); a non-member always gets false, so it cannot be used to probe who owns which exhibition.
create or replace function public.can_record_exhibition_event(p_gallery_id text, p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_profile_member(p_profile)
     and exists (select 1 from public.galleries g where g.id::text = p_gallery_id and g.profile_id = p_profile);
$$;

-- True only while the exhibition is publicly listed without an alias. Says nothing about owners, so it is safe for everyone to call.
create or replace function public.exhibition_events_are_public(p_gallery_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.galleries g
    where g.id::text = p_gallery_id and g.visibility = 'PUBLIC' and g.state = 'ACTIVE' and g.alias_enabled = false
  );
$$;

revoke all on function public.can_record_exhibition_event(text, uuid) from public, anon;
grant execute on function public.can_record_exhibition_event(text, uuid) to authenticated;
revoke all on function public.exhibition_events_are_public(text) from public;
grant execute on function public.exhibition_events_are_public(text) to anon, authenticated;

-- refuse to touch a rule set we have not seen
do $$
declare unknown_rules text;
begin
  select string_agg(policyname, ', ') into unknown_rules
  from pg_policies
  where schemaname = 'public' and tablename = 'exhibition_events'
    and policyname not in ('Public read exhibition_events', 'Owner insert exhibition_events', 'Members insert exhibition_events',
                           'Public read of public exhibitions'' events', 'Members read their own events', 'Members record events for their own exhibitions');
  if unknown_rules is not null then
    raise exception 'exhibition_events has policies this file does not know (%). Nothing was changed. Run 0-inspect-read-only.sql and send the result.', unknown_rules;
  end if;
end;
$$;

alter table public.exhibition_events enable row level security;

drop policy if exists "Public read exhibition_events" on public.exhibition_events;
drop policy if exists "Owner insert exhibition_events" on public.exhibition_events;
drop policy if exists "Members insert exhibition_events" on public.exhibition_events;
drop policy if exists "Public read of public exhibitions' events" on public.exhibition_events;
drop policy if exists "Members read their own events" on public.exhibition_events;
drop policy if exists "Members record events for their own exhibitions" on public.exhibition_events;

create policy "Public read of public exhibitions' events"
  on public.exhibition_events for select
  using (public.exhibition_events_are_public(gallery_id));

create policy "Members read their own events"
  on public.exhibition_events for select to authenticated
  using (public.is_profile_member(profile_id));

create policy "Members record events for their own exhibitions"
  on public.exhibition_events for insert to authenticated
  with check (public.can_record_exhibition_event(gallery_id, profile_id));

-- privileges: read for everyone the policies allow, insert for signed-in people only, nothing else
-- (production grants every privilege to both roles today, stage 0: row rules were the only protection, and TRUNCATE is not covered by row rules)
revoke insert, update, delete, truncate, references, trigger on public.exhibition_events from anon;
revoke update, delete, truncate, references, trigger on public.exhibition_events from authenticated;
grant select on public.exhibition_events to anon, authenticated;
grant insert on public.exhibition_events to authenticated;

commit;
