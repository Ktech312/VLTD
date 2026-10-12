-- Two separate settings that used to share one column (profiles.focused_universes):
--   collection_interests  = what you collect. Shown on your profile and used to personalise Discover.
--   displayed_universes   = which universes VLTD shows you (Vault universe chips, Discover). null = show all.
-- Changing one never changes the other.
--
-- Existing selections are kept: both new columns start as a copy of whatever was in focused_universes, and a
-- profile that only had the older single "primary focus" (a universe key) keeps it as its collection interest.
-- focused_universes itself is left in place, untouched, as the record of what was there before.
--
-- Safe to run more than once: it only fills a new column that is still empty.

alter table public.profiles
  add column if not exists collection_interests text[] default null,
  add column if not exists displayed_universes text[] default null;

-- Interests and displayed universes both start from the old shared selection.
update public.profiles
   set collection_interests = focused_universes
 where collection_interests is null
   and focused_universes is not null;

update public.profiles
   set displayed_universes = focused_universes
 where displayed_universes is null
   and focused_universes is not null;

-- Profiles that only had the single older "primary focus" keep it as a collection interest.
update public.profiles
   set collection_interests = array[primary_focus]
 where collection_interests is null
   and primary_focus = any (array['POP_CULTURE','SPORTS','TCG','MUSIC','JEWELRY_APPAREL','GAMES','BUILT_BOTANY','MISC','AUTOMOTIVE','ART']);
