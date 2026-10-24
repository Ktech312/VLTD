-- One result row. Every value must read true.
select jsonb_build_object(
  'both_tables_exist', to_regclass('public.event_refresh_candidates') is not null and to_regclass('public.event_refresh_steps') is not null,
  'row_security_on', (select relrowsecurity from pg_class where oid = 'public.event_refresh_candidates'::regclass) and (select relrowsecurity from pg_class where oid = 'public.event_refresh_steps'::regclass),
  'public_roles_have_no_access', not has_table_privilege('anon', 'public.event_refresh_candidates', 'select') and not has_table_privilege('authenticated', 'public.event_refresh_candidates', 'select')
                                 and not has_table_privilege('anon', 'public.event_refresh_steps', 'select') and not has_table_privilege('authenticated', 'public.event_refresh_steps', 'select'),
  'no_read_rules_for_anyone', (select count(*) from pg_policies where schemaname = 'public' and tablename in ('event_refresh_candidates', 'event_refresh_steps')) = 0
) as result;
