-- Museum Builder: per-item "show value" option (2026-09-12).
-- EK: "This should be an option of the items in the room" — a per-item
-- toggle, not a room-wide setting like the personal Gallery's Values
-- checkbox. A shared public museum room can show some items' dollar
-- value and not others (unlike a private personal room where it's all-
-- or-nothing), so this lives on each museum_room_items row, not
-- museum_room_meta.
--
--   - estimated_value: the vault item's own estimatedValue at the moment
--     it was placed here (a snapshot, same as title/image_url already
--     are — the shared museum's own display never depends on live vault
--     data). NULL if the item had no set value.
--   - show_value: whether to actually display that value under the
--     frame. Defaults to false — showing a price is an explicit choice,
--     never the default for a public museum room.

alter table public.museum_room_items add column if not exists estimated_value numeric;
alter table public.museum_room_items add column if not exists show_value boolean not null default false;
