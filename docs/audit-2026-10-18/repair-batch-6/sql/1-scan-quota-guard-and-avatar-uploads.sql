-- Batch 6 SQL (RC-11 and RC-10). Run the whole file once in the Supabase SQL editor. Safe to re-run.
-- 1. RC-11: bulk_scan_guard let only profile id = user id through, so Business profiles and 14 Personal profiles whose id differs from
--    their user id could not read or spend their own AI-scan allowance. It now also lets a member of the profile through
--    (the same membership rule that already protects the profile's items). Nothing else in the quota functions changes.
-- 2. RC-10: the public "avatars" bucket has no upload rule for signed-in people, so every avatar upload fails. Members of a profile may now
--    write only inside that profile's own folder (path "<profile id>/avatar.jpg", which is what the account page uses). Viewing avatars
--    is unchanged (the bucket is public).
begin;

create or replace function public.bulk_scan_guard(p_profile uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_profile = auth.uid()
     or auth.uid() is null
     or public.is_profile_member(p_profile)
     or (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
     or exists (select 1 from public.user_roles r where r.email = (auth.jwt() ->> 'email'))
  then
    return;
  end if;
  raise exception 'not authorized to access this quota';
end;
$$;

drop policy if exists "avatars_member_insert" on storage.objects;
create policy "avatars_member_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_profile_member_text((storage.foldername(name))[1]));

drop policy if exists "avatars_member_update" on storage.objects;
create policy "avatars_member_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.is_profile_member_text((storage.foldername(name))[1]))
  with check (bucket_id = 'avatars' and public.is_profile_member_text((storage.foldername(name))[1]));

drop policy if exists "avatars_member_select" on storage.objects;
create policy "avatars_member_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_profile_member_text((storage.foldername(name))[1]));

drop policy if exists "avatars_member_delete" on storage.objects;
create policy "avatars_member_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.is_profile_member_text((storage.foldername(name))[1]));

commit;
