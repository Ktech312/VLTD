-- One result row. Every value must read true, and avatar_policies must read 4.
select jsonb_build_object(
  'guard_allows_profile_members', pg_get_functiondef('public.bulk_scan_guard(uuid)'::regprocedure) ilike '%is_profile_member(p_profile)%',
  'guard_has_no_anonymous_bypass', pg_get_functiondef('public.bulk_scan_guard(uuid)'::regprocedure) not ilike '%auth.uid() is null%'
                                   and pg_get_functiondef('public.bulk_scan_guard(uuid)'::regprocedure) not ilike '%user_roles%',
  'only_the_read_guard_knows_admins', pg_get_functiondef('public.bulk_scan_guard_read(uuid)'::regprocedure) ilike '%user_roles%',
  'anon_cannot_call_status', not has_function_privilege('anon', 'public.bulk_scan_status(uuid)', 'execute'),
  'anon_cannot_call_consume', not has_function_privilege('anon', 'public.consume_bulk_scan(uuid,int)', 'execute'),
  'signed_in_can_call_status_and_consume', has_function_privilege('authenticated', 'public.bulk_scan_status(uuid)', 'execute')
                                           and has_function_privilege('authenticated', 'public.consume_bulk_scan(uuid,int)', 'execute'),
  'nobody_but_the_database_calls_the_guards', not has_function_privilege('anon', 'public.bulk_scan_guard(uuid)', 'execute')
                                              and not has_function_privilege('authenticated', 'public.bulk_scan_guard(uuid)', 'execute'),
  'avatar_policies', (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_member_insert','avatars_member_update','avatars_member_select','avatars_member_delete')),
  'avatar_policies_all_scoped_to_bucket', (select bool_and(coalesce(qual, '') || coalesce(with_check, '') ilike '%bucket_id = ''avatars''%') from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_member_%')
) as result;
