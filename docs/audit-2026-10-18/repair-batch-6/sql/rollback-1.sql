-- Undo file 1: restores the ORIGINAL guard and the original execute rights, and removes the four avatar policies.
-- WARNING: the original guard lets any caller with no session read and spend any profile's AI-scan allowance, and the original rights let the
-- public "anon" role call the functions. Run this only if the app breaks, and tell me so the guard can be fixed forward instead.
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
-- bulk_scan_status goes back to the original guard
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
  perform public.bulk_scan_guard(p_profile);

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
drop function if exists public.bulk_scan_guard_read(uuid);
grant execute on function public.bulk_scan_guard(uuid) to public;
grant execute on function public.bulk_scan_status(uuid) to public;
grant execute on function public.consume_bulk_scan(uuid, int) to public;
drop policy if exists "avatars_member_insert" on storage.objects;
drop policy if exists "avatars_member_update" on storage.objects;
drop policy if exists "avatars_member_select" on storage.objects;
drop policy if exists "avatars_member_delete" on storage.objects;
commit;
