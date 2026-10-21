-- One result row. Every value must read true.
select jsonb_build_object(
  'view_has_asking_price', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_vault_items' and column_name = 'asking_price'),
  'asking_price_is_last_column', (select column_name from information_schema.columns where table_schema = 'public' and table_name = 'public_vault_items' order by ordinal_position desc limit 1) = 'asking_price',
  'view_still_public_only', pg_get_viewdef('public.public_vault_items'::regclass, true) ilike '%is_public = true%',
  'view_still_hides_private_profiles', to_regprocedure('public.profile_is_hidden(text)') is null or pg_get_viewdef('public.public_vault_items'::regclass, true) ilike '%profile_is_hidden%',
  'price_only_for_items_for_sale', (select count(*) from public.public_vault_items where asking_price is not null and status <> 'FOR_SALE') = 0
) as result;
