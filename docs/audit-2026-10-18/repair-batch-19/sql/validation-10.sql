-- Run after 10-ai-scan-reservations.sql. One result row; every value must read true. Changes nothing.
select jsonb_build_object(
  'request_table_exists', to_regclass('public.ai_scan_requests') is not null,
  'request_table_has_row_level_security', (select relrowsecurity from pg_class where oid = 'public.ai_scan_requests'::regclass),
  'request_table_has_no_policies_for_people', not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_scan_requests'),
  'signed_in_and_anonymous_cannot_touch_the_request_table', not has_table_privilege('anon', 'public.ai_scan_requests', 'select')
                                                            and not has_table_privilege('authenticated', 'public.ai_scan_requests', 'select')
                                                            and not has_table_privilege('authenticated', 'public.ai_scan_requests', 'insert')
                                                            and not has_table_privilege('authenticated', 'public.ai_scan_requests', 'update'),
  'one_row_per_profile_and_request', exists (select 1 from pg_index i where i.indrelid = 'public.ai_scan_requests'::regclass and i.indisprimary),
  'reserve_exists_with_the_verified_user', to_regprocedure('public.reserve_ai_scan(uuid,uuid,uuid,text)') is not null,
  'complete_exists', to_regprocedure('public.complete_ai_scan(uuid,uuid,boolean)') is not null,
  'the_first_drafts_member_callable_reserve_is_gone', to_regprocedure('public.reserve_ai_scan(uuid,uuid,text)') is null,
  'only_the_server_can_reserve', has_function_privilege('service_role', 'public.reserve_ai_scan(uuid,uuid,uuid,text)', 'execute')
                                 and not has_function_privilege('authenticated', 'public.reserve_ai_scan(uuid,uuid,uuid,text)', 'execute')
                                 and not has_function_privilege('anon', 'public.reserve_ai_scan(uuid,uuid,uuid,text)', 'execute'),
  'only_the_server_can_complete_or_refund', has_function_privilege('service_role', 'public.complete_ai_scan(uuid,uuid,boolean)', 'execute')
                                            and not has_function_privilege('authenticated', 'public.complete_ai_scan(uuid,uuid,boolean)', 'execute')
                                            and not has_function_privilege('anon', 'public.complete_ai_scan(uuid,uuid,boolean)', 'execute'),
  'only_the_database_calls_the_number_helper', not has_function_privilege('anon', 'public.ai_scan_numbers(uuid)', 'execute')
                                               and not has_function_privilege('authenticated', 'public.ai_scan_numbers(uuid)', 'execute'),
  'reserve_checks_it_is_the_server_inside_the_function', pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,uuid,text)'::regprocedure) ilike '%auth.role()%service_role%',
  'complete_checks_it_is_the_server_inside_the_function', pg_get_functiondef('public.complete_ai_scan(uuid,uuid,boolean)'::regprocedure) ilike '%auth.role()%service_role%',
  'reserve_checks_membership_of_the_verified_user', pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,uuid,text)'::regprocedure) ilike '%profile_members%p_user%',
  'reserve_locks_the_profile_row', pg_get_functiondef('public.reserve_ai_scan(uuid,uuid,uuid,text)'::regprocedure) ilike '%for update%',
  'status_is_read_only', pg_get_functiondef('public.bulk_scan_status(uuid)'::regprocedure) not ilike '%update public.profiles%',
  'status_still_readable_by_members_not_anonymous', has_function_privilege('authenticated', 'public.bulk_scan_status(uuid)', 'execute')
                                                    and not has_function_privilege('anon', 'public.bulk_scan_status(uuid)', 'execute'),
  'existing_spend_function_untouched', to_regprocedure('public.consume_bulk_scan(uuid,integer)') is not null,
  'billing_column_protection_trigger_still_in_place', exists (select 1 from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'protect_profile_billing_columns_trigger' and not tgisinternal)
) as result;
