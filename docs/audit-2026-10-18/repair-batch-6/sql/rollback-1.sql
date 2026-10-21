-- Undo batch 6 SQL: restores the original bulk_scan_guard and removes the four avatar policies.
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
     or (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
     or exists (select 1 from public.user_roles r where r.email = (auth.jwt() ->> 'email'))
  then
    return;
  end if;
  raise exception 'not authorized to access this quota';
end;
$$;
drop policy if exists "avatars_member_insert" on storage.objects;
drop policy if exists "avatars_member_update" on storage.objects;
drop policy if exists "avatars_member_select" on storage.objects;
drop policy if exists "avatars_member_delete" on storage.objects;
commit;
