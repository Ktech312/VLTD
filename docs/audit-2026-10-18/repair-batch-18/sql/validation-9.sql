-- One result row. Every value must read true. Run after 9-wishlist-pull-list.sql.
select jsonb_build_object(
  'wishlist_has_new_columns', (
    select count(*) = 15 from information_schema.columns
    where table_schema = 'public' and table_name = 'wishlist'
      and column_name in ('quantity', 'quantity_acquired', 'series', 'edition', 'release_window', 'source_url', 'shop', 'details', 'skipped_at',
                          'acquired_item_ids', 'rule_id', 'source_identity', 'edited', 'expected_price', 'updated_at')
  ),
  'status_allows_acquired_and_skipped', exists (
    select 1 from pg_constraint where conname = 'wishlist_status_check' and pg_get_constraintdef(oid) like '%acquired%' and pg_get_constraintdef(oid) like '%skipped%'
  ),
  'one_row_per_source_identity', exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'wishlist_profile_identity_uidx' and indexdef like '%UNIQUE%'
  ),
  'existing_catalog_picks_have_identity', not exists (
    select 1 from public.wishlist where source = 'metron' and external_id is not null and source_identity is null
  ),
  'pull_rules_exists_with_row_security', exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pull_rules' and c.relrowsecurity
  ),
  'pull_rules_has_four_owner_policies', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pull_rules') = 4,
  'pull_rules_closed_to_visitors', not has_table_privilege('anon', 'public.pull_rules', 'select'),
  'share_has_field_switches', exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wishlist_shares' and column_name = 'fields'
  ),
  'public_read_returns_switchable_columns', (
    select count(*) = 4 from information_schema.parameters p
    join information_schema.routines r on r.specific_name = p.specific_name and r.specific_schema = p.specific_schema
    where r.routine_schema = 'public' and r.routine_name = 'get_shared_wishlist' and p.parameter_mode = 'OUT'
      and p.parameter_name in ('quantity', 'price', 'shop', 'notes')
  )
) as result;
