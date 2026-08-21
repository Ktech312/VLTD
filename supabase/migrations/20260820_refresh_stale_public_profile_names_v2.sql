-- Second follow-up. 20260820_refresh_stale_public_profile_names.sql only
-- matched rows stuck on the placeholder "collector" -- but confirmed with
-- EK (cat_uh_tonick): an even older sync (2026-06-15) could also leave a
-- row stuck on "User" (the OTHER placeholder branch in syncPublicProfile's
-- fallback chain, back before this account had set a real display_name or
-- username). This widens the match to catch both placeholder values, so
-- this is the one to trust going forward -- the first refresh migration is
-- now subsumed by this one.

update public.public_profiles pp
set
  display_name = case
    when lower(trim(coalesce(p.display_name, ''))) not in ('', 'user', 'collector')
      then trim(p.display_name)
    when lower(trim(coalesce(p.username, ''))) not in ('', 'user', 'collector')
      then trim(p.username)
    else pp.display_name
  end,
  updated_at = now()
from public.profiles p
where p.id = pp.profile_id
  and lower(trim(pp.display_name)) in ('user', 'collector')
  and (
    lower(trim(coalesce(p.display_name, ''))) not in ('', 'user', 'collector')
    or lower(trim(coalesce(p.username, ''))) not in ('', 'user', 'collector')
  );
