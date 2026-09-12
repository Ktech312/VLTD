-- Shared Museum Room Editor overnight pass (2026-09-12): lets an admin
-- place/move/remove real vault items at explicit numbered wall positions
-- inside each shared museum room, instead of relying purely on the
-- automatic proportional-by-span layout every room used before this pass.
--
--   - museum_room_items.slot_id: which generated placement slot (from
--     src/lib/campusRoomBuilder.ts's computeRoomPlacementSlots() — the SAME
--     generator the museum's own live display now consults) this item is
--     pinned to. NULL for any pre-existing row (SPORTS's current curated
--     content) — those keep auto-filling whatever slots are still empty,
--     in slot order, until an admin explicitly assigns them a slot from the
--     new room editor.
--   - a partial unique index so at most one item can occupy a given slot
--     per room — the target the editor's "place at slot" upsert conflicts
--     into.
--   - museum_room_meta.background_id: an optional per-room background/
--     wall-finish choice, independent for every room (changing SPORTS's
--     background never touches COLLECTION/CARDS/HUB/etc).
--
-- Every read of these new columns in the app already falls back safely if
-- this migration hasn't been run yet (src/lib/museumCampusConfig.ts's
-- selectRoomItems/selectRoomMeta both retry without the new column on a
-- Postgrest "column does not exist" error) — nothing here is required for
-- the museum's current live display, or the current flat RoomEditorModal
-- item form, to keep working before EK runs this by hand.

alter table public.museum_room_items add column if not exists slot_id text;

create unique index if not exists museum_room_items_room_slot_unique
  on public.museum_room_items (room_id, slot_id)
  where slot_id is not null;

alter table public.museum_room_meta add column if not exists background_id text;
