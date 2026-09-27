-- Removes the diagnostic function added in 20260926_debug_gallery_fk_definitions.sql.
-- It already did its job (confirmed gallery_items/gallery_invites both carry
-- ON DELETE CASCADE to galleries.id) and isn't needed going forward.

drop function if exists public.debug_gallery_fk_definitions();
