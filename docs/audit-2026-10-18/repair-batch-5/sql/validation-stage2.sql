-- RC-05 validation for STAGE 2 (view and link responses). READ ONLY. ONE query, ONE result cell: copy the cell to me.
-- (The editor's login has no signed-in user, so the link function is evaluated the way it answers any non-member.)
select jsonb_pretty(jsonb_build_object(
  'view_columns', (select jsonb_agg(column_name::text order by column_name) from information_schema.columns where table_schema = 'public' and table_name = 'public_galleries'),
  'view_rows', (select count(*) from public.public_galleries),
  'public_active_rows_in_table', (select count(*) from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE'),
  'alias_rows_in_view_naming_a_profile', (select count(*) from public.public_galleries where alias_enabled and profile_id is not null),
  'alias_rows_in_view_containing_an_account_id', (select count(*) from public.public_galleries v
        join public.profiles p on position(p.id::text in v::text) > 0 or (p.user_id is not null and position(p.user_id::text in v::text) > 0) where v.alias_enabled),
  'keys_outside_the_allowlist', (select count(*) from (
        select k from public.public_galleries, jsonb_object_keys(layout) k
          where k not in ('adultOnly','displayMode','glassShelfOverlay','guestViewMode','itemIds','publicItemSnapshots','sections','shelfBackground','shelfOverlayStyle','templateId','themePack','type')
        union all
        select k from public.public_galleries, jsonb_object_keys(exhibition_layout) k
          where k not in ('adultOnly','displayMode','glassShelfOverlay','guestViewMode','itemIds','publicItemSnapshots','sections','shelfBackground','shelfOverlayStyle','templateId','themePack','type')
        union all
        select k from public.public_galleries v, jsonb_array_elements(v.layout->'publicItemSnapshots') s, jsonb_object_keys(s) k
          where jsonb_typeof(v.layout->'publicItemSnapshots') = 'array'
            and k not in ('id','title','subtitle','number','grade','year','description','categoryLabel','subcategoryLabel','imageFrontUrl','imageBackUrl','imageFrontStoragePath','primaryImageKey','createdAt','hidden','blurThumb')
        union all
        select k from public.public_galleries v, jsonb_array_elements(v.exhibition_layout->'sections') s, jsonb_object_keys(s) k
          where jsonb_typeof(v.exhibition_layout->'sections') = 'array' and k not in ('id','title','description','featuredItemId','itemIds','slotLayout')) x),
  'hidden_items_still_exposing_title_or_images', (select count(*) from public.public_galleries v, jsonb_array_elements(v.layout->'publicItemSnapshots') s
        where jsonb_typeof(v.layout->'publicItemSnapshots') = 'array' and s->'hidden' = 'true'::jsonb
          and (s ? 'title' or s ? 'imageFrontUrl' or s ? 'imageBackUrl' or s ? 'imageFrontStoragePath' or s ? 'primaryImageKey' or s ? 'description')),
  'material_the_view_leaves_out', jsonb_build_object(
        'public_exhibitions_with_curator_notes', (select count(*) from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE' and item_notes is not null and item_notes <> '[]'::jsonb),
        'public_exhibitions_with_visitor_keys', (select count(*) from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE' and analytics_unique_view_keys is not null and analytics_unique_view_keys <> '[]'::jsonb)),
  'link_function_answers_for_a_non_member', (select jsonb_build_object('exhibitions_checked', count(*),
        'still_with_curator_notes', count(*) filter (where item_notes is not null and item_notes <> '[]'::jsonb),
        'still_with_visitor_keys', count(*) filter (where analytics_unique_view_keys is not null),
        'still_with_last_viewed_time', count(*) filter (where analytics_last_viewed_at is not null),
        'alias_rows_still_naming_a_profile', count(*) filter (where alias_enabled and profile_id is not null))
        from (select r.* from public.galleries g cross join lateral public.gallery_public_row(g) r where g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE') z),
  'row_helper_is_the_sanitising_version', position('gallery_public_layout' in pg_get_functiondef('public.gallery_public_row(public.galleries)'::regprocedure)) > 0
)) as stage2;
-- expected: view_columns = the 15 listed in the proposal (no analytics_unique_view_keys, analytics_last_viewed_at, item_notes, updated_at);
--   view_rows = public_active_rows_in_table; the next four counts = 0; every "still_*" = 0; row_helper_is_the_sanitising_version = true.
