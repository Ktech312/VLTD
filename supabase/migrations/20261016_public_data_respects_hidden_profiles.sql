-- Public pages must not show anything about a profile that is private or unfinished.
--
-- Found 2026-10-14 with throwaway QA profiles, checked from the outside as a signed-out visitor:
--   1. public_vault_items (the view every public page reads items from) returned the items of a private or
--      unfinished profile, because it only checked each item's own "public" flag.
--   2. public_profiles (name, bio, avatar) was readable by everyone for every profile, including hidden ones,
--      if a row for it existed (the app deletes the row when a profile goes private, but nothing in the database
--      enforced that).
-- Nothing in production is exposed today (there are no private or unfinished profiles with public rows), so this
-- closes the gap before one can happen. Safe to run more than once. Changes no data and no write permissions.
--
-- WHAT IT DOES
--   A. Adds profile_is_hidden(profile_id): true only for a profile that is private (is_public = false) or
--      unfinished (onboarding_completed = false). Rows with no profile at all stay visible, as before.
--   B. Rebuilds the public_vault_items view so it leaves out items of hidden profiles.
--   C. Makes public_profiles readable only for profiles that are not hidden. Insert/update/delete permissions
--      are kept exactly as they are (the old combined rule is split into one rule per action).
--
-- AFTER RUNNING: ask Claude to re-run the visibility check; it should report all checks passed.
--
-- UNDO (only if public pages or Messages search break):
--   drop policy if exists "public_profiles_read_visible" on public.public_profiles;
--   create policy "Public profiles are readable" on public.public_profiles for select using (true);
--   and for the items view, re-run supabase/migrations/20261008_public_vault_items_view.sql
--   (it rebuilds the view from scratch with only the is_public = true filter).

-- A. helper (runs with the owner's rights so it can see profiles even for signed-out visitors)
-- (vault_items.profile_id is TEXT while profiles.id is UUID, so this takes text and compares as text.)
create or replace function public.profile_is_hidden(p_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id::text = p_profile_id
      and (p.is_public = false or p.onboarding_completed = false)
  );
$$;

revoke all on function public.profile_is_hidden(text) from public;
grant execute on function public.profile_is_hidden(text) to anon, authenticated, service_role;

-- B. the public items view: keep every existing column, add the hidden-profile filter once
do $$
declare
  def text;
begin
  select pg_get_viewdef('public.public_vault_items'::regclass, true) into def;
  if def is null then
    raise notice 'public_vault_items does not exist; run 20261008_public_vault_items_view.sql first. Skipping B.';
  elsif position('profile_is_hidden' in def) > 0 then
    raise notice 'public_vault_items already filters hidden profiles. Nothing to do for B.';
  else
    execute format(
      'create or replace view public.public_vault_items as select * from (%s) pv where not public.profile_is_hidden(pv.profile_id::text)',
      rtrim(def, '; ' || chr(10))
    );
  end if;
end;
$$;

grant select on public.public_vault_items to anon, authenticated;

-- C. public_profiles: split any "for all" rule into per-action rules, then restrict reading
do $$
declare
  r record;
  role_list text;
begin
  for r in
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'public_profiles'
  loop
    role_list := array_to_string(r.roles, ', ');
    if r.cmd = 'ALL' then
      execute format('drop policy %I on public.public_profiles', r.policyname);
      execute format('create policy %I on public.public_profiles for insert to %s with check (%s)',
        left(r.policyname, 50) || ' (insert)', role_list, coalesce(r.with_check, r.qual, 'true'));
      execute format('create policy %I on public.public_profiles for update to %s using (%s) with check (%s)',
        left(r.policyname, 50) || ' (update)', role_list, coalesce(r.qual, 'true'), coalesce(r.with_check, r.qual, 'true'));
      execute format('create policy %I on public.public_profiles for delete to %s using (%s)',
        left(r.policyname, 50) || ' (delete)', role_list, coalesce(r.qual, 'true'));
    elsif r.cmd = 'SELECT' and r.policyname <> 'public_profiles_read_visible' then
      execute format('drop policy %I on public.public_profiles', r.policyname);
    end if;
  end loop;
end;
$$;

drop policy if exists "public_profiles_read_visible" on public.public_profiles;
create policy "public_profiles_read_visible"
  on public.public_profiles for select
  using (not public.profile_is_hidden(profile_id::text));
