-- Rolls back 10-ai-scan-reservations.sql. The AI scan routes then fall back to "basic" mode automatically (the server uses the existing consume_bulk_scan as the service role:
-- no recognition of a repeated request across servers, no give-back after a provider failure). Scans already spent stay spent; the numbers on profiles are not touched.
-- bulk_scan_status goes back to the version in production before this file (the one from repair-batch-6 SQL 1, which writes the cycle roll).
begin;
drop function if exists public.complete_ai_scan(uuid, uuid, boolean);
drop function if exists public.reserve_ai_scan(uuid, uuid, uuid, text);
drop function if exists public.reserve_ai_scan(uuid, uuid, text);

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
revoke all on function public.bulk_scan_status(uuid) from public, anon;
grant execute on function public.bulk_scan_status(uuid) to authenticated, service_role;

drop function if exists public.ai_scan_numbers(uuid);
drop table if exists public.ai_scan_requests;
commit;
