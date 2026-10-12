-- Two separate settings that used to share one column (profiles.focused_universes):
--   collection_interests  = what you collect. Shown on your profile and used to personalise Discover.
--                           An empty list means you chose to clear it; that choice is kept.
--   displayed_universes   = which universes VLTD shows you (Vault universe chips, Discover).
--                           null means "show all"; that choice is kept too.
-- Changing one never changes the other.
--
-- The old selections are copied into the new columns ONCE, at the first run. After that, running this file
-- again does not copy anything, so a setting someone changed (or cleared, or set to "show all") is never
-- put back to what the old shared column held. focused_universes itself is left untouched as the record of the old value.
--
-- Safe to run any number of times.

create table if not exists public.vltd_migration_flags (
  name text primary key,
  done_at timestamptz not null default now()
);
alter table public.vltd_migration_flags enable row level security;
revoke all on public.vltd_migration_flags from anon, authenticated;

-- The one-time copy. Guarded by a flag. p_force and p_profile exist only so the verification script can
-- rehearse the first-run copy on a single test profile (inside a test that is undone).
create or replace function public.vltd_backfill_universe_settings(p_force boolean default false, p_profile uuid default null)
returns integer
language plpgsql
as $$
declare
  v_done boolean;
  v_total integer := 0;
  v_rows integer;
begin
  select exists (select 1 from public.vltd_migration_flags where name = '20261012_universe_settings_backfill') into v_done;
  if v_done and not p_force then
    return 0;
  end if;

  -- Both new settings start as a copy of the old shared selection.
  update public.profiles
     set collection_interests = focused_universes
   where collection_interests is null
     and focused_universes is not null
     and (p_profile is null or id = p_profile);
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  update public.profiles
     set displayed_universes = focused_universes
   where displayed_universes is null
     and focused_universes is not null
     and (p_profile is null or id = p_profile);
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  -- A profile that only had the older single "primary focus" keeps it as a collection interest.
  update public.profiles
     set collection_interests = array[primary_focus]
   where collection_interests is null
     and primary_focus = any (array['POP_CULTURE','SPORTS','TCG','MUSIC','JEWELRY_APPAREL','GAMES','BUILT_BOTANY','MISC','AUTOMOTIVE','ART'])
     and (p_profile is null or id = p_profile);
  get diagnostics v_rows = row_count;
  v_total := v_total + v_rows;

  if p_profile is null and not v_done then
    insert into public.vltd_migration_flags(name) values ('20261012_universe_settings_backfill') on conflict do nothing;
  end if;
  return v_total;
end;
$$;

revoke execute on function public.vltd_backfill_universe_settings(boolean, uuid) from public, anon, authenticated;

do $$
declare
  v_had_columns boolean;
begin
  -- Did an earlier version of this file already create the columns (and already copy)? If so, never copy again.
  v_had_columns := exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'collection_interests'
  );

  alter table public.profiles
    add column if not exists collection_interests text[] default null,
    add column if not exists displayed_universes text[] default null;

  if v_had_columns then
    insert into public.vltd_migration_flags(name) values ('20261012_universe_settings_backfill') on conflict do nothing;
  end if;

  perform public.vltd_backfill_universe_settings();
end $$;
