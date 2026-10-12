-- Museum Alpha is owner-only, so its baked room files must not be reachable by a direct public link.
-- Before this, the bucket was public: anyone with the file's address could download it even though the
-- listing policies were owner-only. This makes the bucket private. From now on the app opens a baked room with a
-- short-lived signed link that only the owner's signed-in session can create.
--
-- Run it AFTER the matching app update is live (the app already understands both the old and the new stored form).
-- Safe to run more than once.

update storage.buckets
   set public = false
 where id = 'museum-room-bakes';

-- Rooms published before this stored a full public link ("https://.../object/public/museum-room-bakes/POP_CULTURE.glb?v=123").
-- Keep only the file path and version ("POP_CULTURE.glb?v=123"), which is what the app now stores.
update public.museum_room_meta
   set baked_asset_url = regexp_replace(baked_asset_url, '^.*/museum-room-bakes/', '')
 where baked_asset_url like '%/museum-room-bakes/%';

-- The owner-only list, upload, replace and delete policies on storage.objects were set in
-- 20261011_museum_alpha_owner_only_reads_and_beta_grant.sql. Signing a link needs the owner's read policy, which is there.
