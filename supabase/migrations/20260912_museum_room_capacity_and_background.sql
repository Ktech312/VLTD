-- Museum Builder pass (2026-09-12): per-room overrides for the new, owner-
-- only /museum/builder page — EK's feature-parity asks after using the
-- in-Gallery-Builder museum room popup:
--
--   - item_capacity: per-room override of the wall/frame item count (falls
--     back to museum_campus_config.items_per_room, the existing global
--     default, when null).
--   - shelf_capacity / case_capacity: per-room item counts for the new
--     shelf-board / display-case furniture (see
--     src/lib/museumRoomFurniture.ts, src/lib/campusRoomBuilder.ts's
--     computeRoomShelfSlots/computeRoomCaseSlots) — null or 0 means that
--     furniture kind is off for this room (the existing wall-only layout,
--     unchanged).
--   - background_image_url: a custom uploaded wallpaper image for this
--     room, sharing the exact same Storage bucket ("room-wallpapers") and
--     upload function (virtualRooms.ts's uploadHallWallpaper) the Gallery
--     Builder's own personal-Hall Wallpaper feature already uses — not a
--     second, museum-only upload path. Independent of the existing
--     background_id preset column; null means "use background_id/the
--     room's default finish instead."
--
-- Every read of these new columns in the app already falls back safely if
-- this migration hasn't been run yet (src/lib/museumCampusConfig.ts's
-- selectRoomMeta/getAllRoomMeta both retry with fewer columns on a
-- Postgrest "column does not exist" error, all the way back to the
-- original bare (room_id, title, description) select) — nothing here is
-- required for the museum's current live display, MuseumRoomPopup.tsx, or
-- RoomEditorModal.tsx to keep working before EK runs this by hand.

alter table public.museum_room_meta add column if not exists item_capacity integer;
alter table public.museum_room_meta add column if not exists shelf_capacity integer;
alter table public.museum_room_meta add column if not exists case_capacity integer;
alter table public.museum_room_meta add column if not exists background_image_url text;
