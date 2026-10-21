-- One result row. Every value must read true, and avatar_policies must read 4.
select jsonb_build_object(
  'guard_allows_profile_members', pg_get_functiondef('public.bulk_scan_guard(uuid)'::regprocedure) ilike '%is_profile_member(p_profile)%',
  'guard_still_allows_owner_email_and_admins', pg_get_functiondef('public.bulk_scan_guard(uuid)'::regprocedure) ilike '%user_roles%',
  'avatar_policies', (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('avatars_member_insert','avatars_member_update','avatars_member_select','avatars_member_delete')),
  'avatar_policies_all_scoped_to_bucket', (select bool_and(coalesce(qual, '') || coalesce(with_check, '') ilike '%bucket_id = ''avatars''%') from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars_member_%')
) as result;
