-- Read-only. Run AFTER 20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql. Changes nothing. Send the one-row result.
select jsonb_build_object(
  'helper_hides_layout_for_signed_out_registered_users', (select position('guestViewMode' in pg_get_functiondef('public.gallery_public_row(public.galleries)'::regprocedure)) > 0 and position('auth.uid() is null' in pg_get_functiondef('public.gallery_public_row(public.galleries)'::regprocedure)) > 0),
  'items_lookup_gated', (select position('auth.uid() is null' in pg_get_functiondef('public.get_gallery_items_by_share_token(text)'::regprocedure)) > 0),
  'helper_not_callable_by_visitors', not has_function_privilege('anon', 'public.gallery_public_row(public.galleries)', 'execute') and not has_function_privilege('authenticated', 'public.gallery_public_row(public.galleries)', 'execute'),
  'registered_users_exhibitions', (select count(*) from public.galleries where coalesce(layout->>'guestViewMode', exhibition_layout->>'guestViewMode', '') = 'guest'),
  'galleries_total', (select count(*) from public.galleries)
) as validation;
-- Expected: first three true. The last two numbers are for the record.
