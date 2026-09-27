-- Drops the three diagnostic functions added while root-causing the
-- exhibition create/delete RLS regression this pass (see
-- 20260927_fix_galleries_owner_select_policy.sql for the actual fix).
-- All three already served their purpose. Read-only / self-cleaning in
-- effect; nothing else is touched.

drop function if exists public.debug_galleries_policies();
drop function if exists public.debug_gallery_insert_probe();
drop function if exists public.debug_gallery_delete_probe_v2();
