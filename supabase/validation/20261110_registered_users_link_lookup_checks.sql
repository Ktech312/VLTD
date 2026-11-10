-- Read-only. Run AFTER 20261110_registered_users_exhibitions_hide_layout_from_signed_out.sql. Changes nothing. Send the one-row result.
select jsonb_build_object(
  'rule_helper_installed', to_regprocedure('public.gallery_blocks_signed_out(public.galleries)') is not null,
  'link_row_helper_installed', to_regprocedure('public.gallery_for_link(public.galleries)') is not null,
  'share_lookup_uses_gate', (select position('gallery_for_link' in pg_get_functiondef('public.get_gallery_by_share_token(text)'::regprocedure)) > 0),
  'invite_lookup_uses_gate', (select position('gallery_for_link' in pg_get_functiondef('public.get_gallery_by_invite_token(text)'::regprocedure)) > 0),
  'share_items_gated', (select position('gallery_blocks_signed_out' in pg_get_functiondef('public.get_gallery_items_by_share_token(text)'::regprocedure)) > 0),
  'invite_items_gated', (select position('gallery_blocks_signed_out' in pg_get_functiondef('public.get_gallery_items_by_invite_token(text)'::regprocedure)) > 0),
  'invite_financials_gated', (select position('gallery_blocks_signed_out' in pg_get_functiondef('public.get_invite_item_financials(text)'::regprocedure)) > 0),
  'helpers_not_callable_by_visitors', not has_function_privilege('anon', 'public.gallery_blocks_signed_out(public.galleries)', 'execute')
     and not has_function_privilege('authenticated', 'public.gallery_blocks_signed_out(public.galleries)', 'execute')
     and not has_function_privilege('anon', 'public.gallery_for_link(public.galleries)', 'execute')
     and not has_function_privilege('authenticated', 'public.gallery_for_link(public.galleries)', 'execute'),
  'lookups_still_callable_by_visitors', has_function_privilege('anon', 'public.get_gallery_by_share_token(text)', 'execute') and has_function_privilege('anon', 'public.get_gallery_by_invite_token(text)', 'execute'),
  'registered_users_exhibitions', (select count(*) from public.galleries where coalesce(layout->>'guestViewMode', exhibition_layout->>'guestViewMode', '') = 'guest'),
  -- A Registered Users marker on an exhibition that is ALSO Public+Active stays readable through the ordinary public read rule (table / public view), which this file does not change.
  -- The app never produces that combination (choosing Public resets the marker); this counts leftovers. 0 is expected.
  'public_exhibitions_with_leftover_registered_marker', (select count(*) from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE' and coalesce(layout->>'guestViewMode', exhibition_layout->>'guestViewMode', '') = 'guest'),
  'galleries_total', (select count(*) from public.galleries)
) as validation;
-- Expected: the first nine true. Last three are numbers for the record (the leftover count should be 0).
