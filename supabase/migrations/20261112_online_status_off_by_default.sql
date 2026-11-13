-- Public online status: OFF by default, with a switch the person controls (policy decision 2026-11-12).
--
-- WHAT THIS CHANGES
--   1. profiles.show_online_status boolean NOT NULL DEFAULT false. Every existing profile starts OFF; the owner of a profile turns it on or off from Account > Preferences
--      (the existing "update your own profile" rule already lets them write it; nothing else about who may write profiles changes).
--   2. get_public_online_status(profile_id): the ONLY way a visitor learns anything about when a profile was last active. It returns
--        visible          = the switch is on AND the profile is public and set up (a private or unfinished profile never shows a status)
--        last_seen_at     = the last-active time, only when visible is true; otherwise NULL
--      It is granted to signed-out and signed-in callers. It never returns another column.
--   3. Nothing else changes. The app still records each profile's last-active time privately (profiles.last_seen_at, written by the existing touch_presence heartbeat) for the account's own
--      session totals and for administrators; that is described in the Privacy Policy. It is simply no longer shown to anyone unless the person switches it on.
--
-- Safe to run more than once. Changes no existing data (the new column fills with false). NOT run by anyone yet.
-- AFTER RUNNING: run supabase/validation/20261112_online_status_checks.sql (read-only) and send the one-row result.
-- UNDO: supabase/rollback/20261112_online_status_rollback.sql
begin;

alter table public.profiles add column if not exists show_online_status boolean not null default false;

create or replace function public.get_public_online_status(p_profile_id uuid)
returns table (visible boolean, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (coalesce(p.show_online_status, false) and p.is_public is distinct from false and p.onboarding_completed is distinct from false) as visible,
    case
      when coalesce(p.show_online_status, false) and p.is_public is distinct from false and p.onboarding_completed is distinct from false then p.last_seen_at
      else null
    end as last_seen_at
  from public.profiles p
  where p.id = p_profile_id;
$$;

revoke all on function public.get_public_online_status(uuid) from public;
grant execute on function public.get_public_online_status(uuid) to anon, authenticated;

commit;
