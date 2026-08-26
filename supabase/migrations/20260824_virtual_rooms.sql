-- ─────────────────────────────────────────────────────────────
-- Virtual Rooms ("Halls") -- real cloud-saved 3D Room Builder rooms.
--
-- EK's ask 2026-08-24: the 3D Room Builder's "Save Room Draft" button only
-- ever wrote to a single fixed slot in the browser's own local storage --
-- no name, no per-room identity, overwritten by literally any save no
-- matter what you were working on, invisible on any other device. EK:
-- "Scratch room" (now labeled "Empty Hall" in the UI) starting a new room
-- and hitting Save should ask for a name; if the room started from an
-- existing Exhibition, Save should ask whether to add the newly-placed
-- items into that Exhibition, or branch off a new, separately-named Hall.
--
-- A Hall optionally links to one Exhibition (gallery_id) but is always its
-- own independent row -- linking to an Exhibition never merges the two
-- concepts into one record, so a Hall can still be reopened/renamed on its
-- own regardless of what it's linked to.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.virtual_rooms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- galleries.id is uuid in the live DB. (An old comment on
  -- exhibition_events elsewhere in this repo claimed it was text -- that
  -- table's own gallery_id column has never actually had a real foreign
  -- key constraint to prove it either way, so the claim went untested
  -- until this migration tried to add one for real and Postgres rejected
  -- the mismatch. galleryModel.ts's client-side id generator does have a
  -- `gallery_<timestamp>` text fallback for browsers without
  -- crypto.randomUUID(), but a row using that fallback could never have
  -- been inserted into a real uuid column anyway, so it isn't a live
  -- concern here.)
  gallery_id uuid references public.galleries(id) on delete set null,
  title text not null,
  room_style text not null default 'vault',
  room_layout text not null default 'storefront',
  view_mode text not null default 'room',
  show_values boolean not null default true,
  -- The shelf -> item assignment: a fixed-length array of vault item ids
  -- (or "" for an empty slot), same shape as VirtualGalleryRoom's own
  -- `selectedIds` state -- stored as-is, no reshaping needed on load/save.
  selected_ids jsonb not null default '[]'::jsonb,
  wallpaper_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive: the first attempt at this migration may have already created
-- the table with gallery_id as text before failing on the foreign key
-- below (see the column comment above for why). The table is empty either
-- way (that first run never got past the failing statement), so this cast
-- is always safe -- makes the migration correct to re-run from a clean
-- copy-paste no matter which state it's starting from.
alter table if exists public.virtual_rooms alter column gallery_id type uuid using gallery_id::uuid;

create index if not exists virtual_rooms_profile_id_idx on public.virtual_rooms (profile_id);
create index if not exists virtual_rooms_gallery_id_idx on public.virtual_rooms (gallery_id);

alter table public.virtual_rooms enable row level security;

-- Same is_profile_member() ownership pattern as galleries/exhibition_events
-- (see 20260707_profile_members.sql) -- covers team-shared profiles, not
-- just a single auth.uid().
drop policy if exists virtual_rooms_select_member on public.virtual_rooms;
create policy virtual_rooms_select_member on public.virtual_rooms
  for select
  using (public.is_profile_member(profile_id));

drop policy if exists virtual_rooms_insert_member on public.virtual_rooms;
create policy virtual_rooms_insert_member on public.virtual_rooms
  for insert
  with check (public.is_profile_member(profile_id));

drop policy if exists virtual_rooms_update_member on public.virtual_rooms;
create policy virtual_rooms_update_member on public.virtual_rooms
  for update
  using (public.is_profile_member(profile_id))
  with check (public.is_profile_member(profile_id));

drop policy if exists virtual_rooms_delete_member on public.virtual_rooms;
create policy virtual_rooms_delete_member on public.virtual_rooms
  for delete
  using (public.is_profile_member(profile_id));

create or replace function public.touch_virtual_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists virtual_rooms_touch_updated_at on public.virtual_rooms;
create trigger virtual_rooms_touch_updated_at
  before update on public.virtual_rooms
  for each row execute function public.touch_virtual_rooms_updated_at();

-- ── Wallpaper storage bucket ─────────────────────────────────────
-- Public, same as vault-images/avatars/vault-videos -- a Hall's wallpaper
-- needs to load for guest room views with no auth, same reasoning as every
-- other image bucket in this app (only vault-documents is private, and
-- that's a deliberate exception -- see 20260822_vault_documents.sql).
-- Folder is auth.uid(), matching every other bucket's own convention --
-- precise per-profile ownership is enforced by the virtual_rooms table's
-- own RLS above, not the storage layer.
insert into storage.buckets (id, name, public)
values ('room-wallpapers', 'room-wallpapers', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload their own room wallpapers" on storage.objects;
create policy "Users can upload their own room wallpapers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'room-wallpapers' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own room wallpapers" on storage.objects;
create policy "Users can delete their own room wallpapers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'room-wallpapers' and auth.uid()::text = (storage.foldername(name))[1]);
