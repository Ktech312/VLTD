-- One result row. Every value must read true.
select jsonb_build_object(
  'table_exists', to_regclass('public.insurance_exclusions') is not null,
  'rls_on', (select relrowsecurity from pg_class where oid = 'public.insurance_exclusions'::regclass),
  'three_member_rules', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'insurance_exclusions') = 3,
  'anon_has_no_access', not has_table_privilege('anon', 'public.insurance_exclusions', 'select') and not has_table_privilege('anon', 'public.insurance_exclusions', 'insert'),
  'signed_in_can_read_add_remove_only', has_table_privilege('authenticated', 'public.insurance_exclusions', 'select')
                                        and has_table_privilege('authenticated', 'public.insurance_exclusions', 'insert')
                                        and has_table_privilege('authenticated', 'public.insurance_exclusions', 'delete')
                                        and not has_table_privilege('authenticated', 'public.insurance_exclusions', 'update')
) as result;
