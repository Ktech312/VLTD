-- One result row. Every value must read true.
select jsonb_build_object(
  'has_goal_type', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'collection_goals' and column_name = 'goal_type'),
  'has_unit', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'collection_goals' and column_name = 'unit'),
  'pair_is_checked', exists (select 1 from pg_constraint where conname = 'collection_goals_type_unit_ok'),
  'rls_still_on', (select relrowsecurity from pg_class where oid = 'public.collection_goals'::regclass),
  'owner_only_rules_still_there', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'collection_goals') >= 4
) as result;
