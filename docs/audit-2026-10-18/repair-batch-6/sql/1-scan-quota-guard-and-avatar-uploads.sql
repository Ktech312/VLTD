-- Batch 6 SQL, corrected 2026-10-21 (RC-11, RC-10, and a security fix found while reviewing it). Run the whole file once in the Supabase SQL editor. Safe to re-run.
--
-- 1. SECURITY: the existing guard let anyone with NO session through (`auth.uid() is null`), and the quota functions were executable by the public
--    "anon" role. So a visitor holding only the public site key could read, and SPEND, any profile's AI-scan allowance by calling the functions
--    directly. This file removes that bypass and removes anon's right to call the functions at all.
-- 2. RC-11: the guard let only profile id = user id through, so Business profiles and Personal profiles whose id differs from their user id
--    could not read or spend their own allowance. A member of the profile (the same membership rule that protects the profile's items) now can.
-- 3. RC-10: the public "avatars" bucket has no upload rule for signed-in people, so every avatar upload fails. Members of a profile may now write
--    only inside that profile's own folder ("<profile id>/avatar.jpg", which is what the account page uses). Viewing avatars is unchanged.
--
-- Who may do what after this file:
--   * SPEND (consume_bulk_scan) and READ (bulk_scan_status): the signed-in profile owner or a member of that profile, or the server's service role.
--   * READ only: also the owner email and anyone listed in user_roles (the same people who may already edit tiers and overrides), so support can
--     look at an allowance. They cannot spend someone else's scans.
--   * Anonymous callers and unrelated signed-in accounts: refused ("permission denied" / "not authorized").
begin;

-- Strict guard: used by anything that changes an allowance.
create or replace function public.bulk_scan_guard(p_profile uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (p_profile = auth.uid() or public.is_profile_member(p_profile))
  then
    return;
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;
  raise exception 'not authorized to access this quota';
end;
$$;

-- Read guard: the strict rule, plus the admin people who may already change tiers and overrides.
create or replace function public.bulk_scan_guard_read(p_profile uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and ((auth.jwt() ->> 'email') = 'eck1679@gmail.com'
          or exists (select 1 from public.user_roles r where r.email = (auth.jwt() ->> 'email')))
  then
    return;
  end if;
  perform public.bulk_scan_guard(p_profile);
end;
$$;

-- Status now uses the read guard; the body is otherwise unchanged from 20260723_bulk_scan_quota.sql.
create or replace function public.bulk_scan_status(p_profile uuid)
returns table (scan_limit int, used int, remaining int, cycle_start date, cycle_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
  v_tier    text;
  v_override int;
  v_used    int;
  v_start   date;
  v_want    date;
  v_limit   int;
begin
  perform public.bulk_scan_guard_read(p_profile);

  select p.created_at, p.tier, p.bulk_scan_limit_override,
         p.bulk_scans_used, p.bulk_scans_cycle_start
    into v_created, v_tier, v_override, v_used, v_start
    from public.profiles p
   where p.id = p_profile;

  if not found then
    raise exception 'profile not found';
  end if;

  v_want := public.bulk_scan_cycle_start(coalesce(v_created, now()), current_date);

  if v_start is distinct from v_want then
    update public.profiles
       set bulk_scans_used = 0,
           bulk_scans_cycle_start = v_want
     where id = p_profile;
    v_used  := 0;
    v_start := v_want;
  end if;

  v_limit := coalesce(
               v_override,
               (select q.monthly_limit from public.bulk_scan_quotas q
                 where q.tier = coalesce(v_tier, 'FREE')),
               (select q.monthly_limit from public.bulk_scan_quotas q where q.tier = 'FREE'),
               0);

  scan_limit := v_limit;
  used       := v_used;
  remaining  := greatest(v_limit - v_used, 0);
  cycle_start := v_start;
  cycle_end   := (v_start + interval '1 month')::date;
  return next;
end;
$$;

-- consume_bulk_scan keeps its body and keeps calling the strict guard (now without the bypass).

-- Nobody outside the database should call the guards directly; the public/anon role must not call the allowance functions at all.
revoke all on function public.bulk_scan_guard(uuid) from public, anon, authenticated;
revoke all on function public.bulk_scan_guard_read(uuid) from public, anon, authenticated;
revoke all on function public.bulk_scan_status(uuid) from public, anon;
revoke all on function public.consume_bulk_scan(uuid, int) from public, anon;
grant execute on function public.bulk_scan_status(uuid) to authenticated, service_role;
grant execute on function public.consume_bulk_scan(uuid, int) to authenticated, service_role;

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
