-- Museum Runtime V2 — item interaction pass (2026-09-24): links a curated
-- museum_room_items row back to the real vault_items row it was placed
-- from, so a visitor clicking an item in the museum can open the existing
-- public "item information" treatment (GuestItemModal, exported from
-- GuestGalleryRenderer.tsx) using real vault data instead of just the
-- curated title/image copy.
--
-- Nullable, no hard foreign-key constraint — same soft-coupling choice
-- already made for museum_room_items.room_id (a plain text id, not an FK
-- into any table, since campus rooms are static TS data) and for every
-- other cross-reference in this schema that doesn't need referential
-- integrity enforced at the DB level. A null value (every row placed
-- before this migration, or an item added a way that doesn't have a real
-- vault_items id handy) just means "no real vault data available for this
-- item" — the app falls back to a minimal treatment built from this row's
-- own title/image_url/estimated_value, never a broken click.
--
-- Every existing read of museum_room_items already falls back safely if
-- this migration hasn't run yet (src/lib/museumCampusConfig.ts's
-- selectRoomItems retries without the new column on a Postgrest "column
-- does not exist" error).

alter table public.museum_room_items add column if not exists vault_item_id uuid;

create index if not exists museum_room_items_vault_item_id_idx
  on public.museum_room_items (vault_item_id)
  where vault_item_id is not null;
