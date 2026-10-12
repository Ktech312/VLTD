-- Museum Alpha is owner-only and the 3D Gallery is invite-only (owner decision, 2026-10-11).
-- The app screens already enforce this; this file makes the database enforce it too, so it cannot be
-- bypassed by calling the database directly.
--
--   * Museum Alpha tables: only the owner can write. Everyone can still read (the shared museum rooms
--     are public to view today; reading is unchanged).
--   * 3D Gallery saved rooms (virtual_rooms): only approved profiles (profiles.museum_beta_enabled,
--     which only an admin can set) and the owner can create or change them. Anyone can still delete
--     their own saved rooms, and reading is unchanged.
--
-- Safe to run more than once. Nothing is deleted or changed in existing rows.

create or replace function public.is_vltd_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (
      select 1 from public.user_roles
      where email = auth.email() and role = 'owner'
    );
$$;

create or replace function public.has_3d_gallery_access(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_vltd_owner()
    or coalesce((select museum_beta_enabled from public.profiles where id = p_profile_id), false);
$$;

grant execute on function public.is_vltd_owner() to authenticated;
grant execute on function public.has_3d_gallery_access(uuid) to authenticated;

-- ── Museum Alpha tables: writes are owner-only ───────────────────────────────

drop policy if exists "Admin full access museum campus config" on public.museum_campus_config;
create policy "Owner full access museum campus config"
  on public.museum_campus_config for all
  using (public.is_vltd_owner())
  with check (public.is_vltd_owner());

drop policy if exists "Admin full access spotlight programs" on public.museum_spotlight_programs;
create policy "Owner full access spotlight programs"
  on public.museum_spotlight_programs for all
  using (public.is_vltd_owner())
  with check (public.is_vltd_owner());

drop policy if exists "Admin full access store items" on public.museum_store_items;
create policy "Owner full access store items"
  on public.museum_store_items for all
  using (public.is_vltd_owner())
  with check (public.is_vltd_owner());

drop policy if exists "Admin full access museum room items" on public.museum_room_items;
create policy "Owner full access museum room items"
  on public.museum_room_items for all
  using (public.is_vltd_owner())
  with check (public.is_vltd_owner());

drop policy if exists "Admin full access museum room meta" on public.museum_room_meta;
create policy "Owner full access museum room meta"
  on public.museum_room_meta for all
  using (public.is_vltd_owner())
  with check (public.is_vltd_owner());

-- ── 3D Gallery saved rooms: creating and changing needs approval ─────────────

drop policy if exists virtual_rooms_insert_member on public.virtual_rooms;
create policy virtual_rooms_insert_member on public.virtual_rooms
  for insert
  with check (public.is_profile_member(profile_id) and public.has_3d_gallery_access(profile_id));

drop policy if exists virtual_rooms_update_member on public.virtual_rooms;
create policy virtual_rooms_update_member on public.virtual_rooms
  for update
  using (public.is_profile_member(profile_id) and public.has_3d_gallery_access(profile_id))
  with check (public.is_profile_member(profile_id) and public.has_3d_gallery_access(profile_id));
