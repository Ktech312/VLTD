-- Backfill real user avatar presets from the older emoji avatar field.
-- Safe to rerun: only fills blank avatar_url values.

alter table profiles
  add column if not exists avatar_url text default '',
  add column if not exists avatar_emoji text default U&'\+01F5DD\FE0F';

update profiles
set avatar_url = case avatar_emoji
  when U&'\+01F981' then '__preset:lion'
  when U&'\+01F409' then '__preset:dragon'
  when U&'\+01F98A' then '__preset:fox'
  when U&'\+01F985' then '__preset:eagle'
  when U&'\+01F48E' then '__preset:gem'
  when U&'\+01F52E' then '__preset:orb'
  when U&'\2694\FE0F' then '__preset:sword'
  when U&'\+01F0CF' then '__preset:cards'
  when U&'\+01F451' then '__preset:crown'
  when U&'\+01F3DB\FE0F' then '__preset:vault'
  when U&'\+01F525' then '__preset:fire'
  else '__preset:key'
end
where coalesce(avatar_url, '') = '';

update public_profiles pp
set avatar_url = p.avatar_url
from profiles p
where pp.profile_id = p.id
  and coalesce(pp.avatar_url, '') = ''
  and coalesce(p.avatar_url, '') <> '';
