-- Follow-up to 20260820_backfill_public_profiles.sql. That migration only
-- INSERTed rows for profiles with no public_profiles row at all -- it
-- correctly skipped any profile_id that already had one, on the assumption
-- an existing row was already synced correctly. Wrong for a handful of
-- accounts (confirmed: FreckArgent, Debi, cat_uh_tonick): they got a
-- public_profiles row written once, early, with the placeholder name
-- "collector"/"Collector" (the account's still-default username at the
-- time), then later set a real display_name on their own account -- but
-- since syncPublicProfile() previously only ran from the home dashboard/
-- account page (see PublicProfileSync.tsx, added this same day, for the
-- real fix), that update to public_profiles never happened. Their real name
-- has been sitting correctly in profiles.display_name the whole time.
--
-- This refreshes any public_profiles row still stuck on the placeholder,
-- using the same real-name-with-fallback logic as the other migration.

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
  and lower(trim(pp.display_name)) = 'collector'
  and (
    lower(trim(coalesce(p.display_name, ''))) not in ('', 'user', 'collector')
    or lower(trim(coalesce(p.username, ''))) not in ('', 'user', 'collector')
  );
