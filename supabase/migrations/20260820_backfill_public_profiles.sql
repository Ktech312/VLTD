-- Root cause of "search isn't finding real people I signed up": a profile
-- only gets a row in public_profiles (the table Messages' collector search
-- and searchCollectors() query) the first time it loads either the home
-- dashboard or /account -- see syncPublicProfile() in
-- src/lib/publicProfile.ts, called from HomeClient.tsx and account/page.tsx
-- only. An account that only ever visited a deep-linked page (EK confirmed
-- "FreckArgent" added real vault items but never showed up in search) never
-- triggers that sync, so it stays permanently invisible to search even
-- though it's a genuine account with real activity.
--
-- One-time backfill: give every existing profile a public_profiles row
-- right now, so nobody has to log back in just to become searchable. Same
-- validation syncPublicProfile() itself uses (skip a placeholder "user"
-- name, fall back to username, then "Collector"); skips anyone who has
-- explicitly gone incognito (is_public = false) and anyone already synced.

insert into public.public_profiles (profile_id, display_name, avatar_emoji, updated_at)
select
  p.id,
  case
    when lower(trim(coalesce(p.display_name, ''))) not in ('', 'user')
      then trim(p.display_name)
    when lower(trim(coalesce(p.username, ''))) not in ('', 'user')
      then trim(p.username)
    else 'Collector'
  end,
  coalesce(nullif(trim(p.avatar_emoji), ''), '🗝️'),
  now()
from public.profiles p
where p.is_public is distinct from false
  and not exists (
    select 1 from public.public_profiles pp where pp.profile_id = p.id
  )
on conflict (profile_id) do nothing;
