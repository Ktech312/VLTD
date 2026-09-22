-- Museum campus perf fix (2026-09-21): rooms currently get rebuilt from
-- scratch, procedurally, in every visitor's browser on every page load --
-- measured 1.2-7.6+ seconds before the page is interactive. Real fix: bake
-- each room to a static .glb file from Museum Builder's own already-live
-- Three.js scene (via GLTFExporter) when EK explicitly hits "Publish," and
-- have the live campus load that file instead of rebuilding the room.
-- Full plan in HANDOFF.md's 2026-09-21 entry.
--
-- baked_asset_url/baked_at: undefined/null means "no baked version yet" --
-- the live campus falls back to today's procedural builder for that one
-- room, exactly as it does now. This is what makes a room-by-room rollout
-- safe: a room only stops being procedurally built once it has actually
-- been published. Every read of this already falls back safely if this
-- migration hasn't been run yet (museumCampusConfig.ts's selectRoomMeta/
-- getAllRoomMeta both retry with fewer columns on a Postgrest "column does
-- not exist" error, same pattern every prior museum_room_meta migration
-- has used).

alter table public.museum_room_meta add column if not exists baked_asset_url text;
alter table public.museum_room_meta add column if not exists baked_at timestamptz;

-- ── Baked room storage bucket ─────────────────────────────────────
-- Public read (visitors need no auth to load a baked room, same reasoning
-- as room-wallpapers/vault-images/etc.). Unlike room-wallpapers though,
-- this is shared, admin-curated campus content, not per-user content --
-- so write access is gated the same way museum_room_meta's own "Admin
-- full access" policy already is (public.user_roles), not the per-user
-- auth.uid()-folder pattern room-wallpapers uses.
insert into storage.buckets (id, name, public)
values ('museum-room-bakes', 'museum-room-bakes', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read museum room bakes" on storage.objects;
create policy "Public can read museum room bakes"
  on storage.objects for select
  using (bucket_id = 'museum-room-bakes');

drop policy if exists "Admins can upload museum room bakes" on storage.objects;
create policy "Admins can upload museum room bakes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'museum-room-bakes'
    and exists (select 1 from public.user_roles where email = auth.email())
  );

drop policy if exists "Admins can update museum room bakes" on storage.objects;
create policy "Admins can update museum room bakes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'museum-room-bakes'
    and exists (select 1 from public.user_roles where email = auth.email())
  );

drop policy if exists "Admins can delete museum room bakes" on storage.objects;
create policy "Admins can delete museum room bakes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'museum-room-bakes'
    and exists (select 1 from public.user_roles where email = auth.email())
  );
