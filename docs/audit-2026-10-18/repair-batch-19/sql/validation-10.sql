-- Run after 10-ai-scan-reservations.sql. One result row; every value must read true. Changes nothing.
select jsonb_build_object(
  'request_table_exists', to_regclass('public.ai_scan_requests') is not null,
  'request_table_has_row_level_security', (select relrowsecurity from pg_class where oid = 'public.ai_scan_requests'::regclass),
  'request_table_has_no_policies_for_people', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_scan_requests'),
  'signed_in_and_anonymous_cannot_touch_the_request_table', not has_table_privilege('anon', 'public.ai_scan_requests', 'select')
                                                            and not has_table_privilege('authenticated', 'public.ai_scan_requests', 'select')
                                                            and not has_table_privilege('authenticated', 'public.ai_scan_requests', 'insert'),
  'one_row_per_profile_and_request', exists (select 1 from pg_index i where i.indrelid = 'public.ai_scan_requests'::regclass and i.indisprimary),
  'reserve_exists', to_regprocedure('public.reserve_ai_scan(uuid,uuid,text)') is not null,
  'complete_exists', to_regprocedure('public.complete_ai_scan(uuid,uuid,boolean)') is not null,
  'anon_cannot_reserve_or_complete', not has_function_privilege('anon', 'public.reserve_ai_scan(uuid,uuid,text)', 'execute')
                                     and not has_function_privilege('anon', 'public.complete_ai_scan(uuid,uuid,boolean)', 'execute'),
  'signed_in_can_reserve_and_complete', has_function_privilege('authenticated', 'public.reserve_ai_scan(uuid,uuid,text)', 'execute')
                                        and has_function_privilege('authenticated', 'public.complete_ai_scan(uuid,uuid,boolean)', 'execute'),
  'only_the_database_calls_the_number_helper', not has_function_privilege('anon', 'public.ai_scan_numbers(uuid)', 'execute')
                                               and not has_function_privilege('authenticated', 'public.ai_scan_numbers(uuid)', 'execute'),
  'reserve_uses_the_existing_membership_guard', pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,text)'::regprocedure) ilike '%bulk_scan_guard(p_profile)%',
  'complete_uses_the_existing_membership_guard', pg_get_functiondef('public.complete_ai_scan(uuid,uuid,boolean)'::regprocedure) ilike '%bulk_scan_guard(p_profile)%',
  'reserve_locks_the_profile_row', pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,text)'::regprocedure) ilike '%for update%',
  'existing_allowance_functions_untouched', to_regprocedure('public.consume_bulk_scan(uuid,integer)') is not null
                                            and to_regprocedure('public.bulk_scan_status(uuid)') is not null
) as result;
