-- RC-05 validation for STAGE 4 (old table read closed). READ ONLY. ONE query, ONE result cell: copy the cell to me. Run only after step 4.
select jsonb_pretty(jsonb_build_object(
  'galleries_policies', (select jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles::text, 'using', qual) order by policyname)
                         from pg_policies where schemaname = 'public' and tablename = 'galleries'),
  'gallery_items_public_rule', (select qual from pg_policies where schemaname = 'public' and tablename = 'gallery_items' and policyname = 'gallery_items_read_public'),
  'helper_exists', to_regprocedure('public.gallery_is_publicly_listed(text)') is not null,
  'view_rows', (select count(*) from public.public_galleries),
  'items_belonging_to_non_public_exhibitions', (select count(*) from public.gallery_items gi where not coalesce(public.gallery_is_publicly_listed(gi.gallery_id::text), false))
)) as stage4;
-- expected: galleries_policies has NO rule whose condition is PUBLIC + ACTIVE without a member check; gallery_items_public_rule calls
--   gallery_is_publicly_listed; helper_exists = true; view_rows = number of public exhibitions. The last count is how many items belong to
--   non-public exhibitions (the rule hides them from visitors); what a visitor really sees is what I test on production.
