-- SQL package 10: one reservation per AI scan request, so a repeated request cannot spend twice and a failed provider call gives the scan back.
-- Run the whole file once in the Supabase SQL editor, then run validation-10.sql (every value must read true). Safe to re-run. Rollback: rollback-10.sql.
--
-- WHY. The AI scan routes now check, on the server and BEFORE any paid call, that the caller is signed in and is a member of the profile, then spend one scan from
-- the profile's existing monthly allowance (the same allowance, tiers and overrides as today: bulk_scan_quotas, profiles.bulk_scan_limit_override,
-- profiles.bulk_scans_used and the signup-anniversary cycle; nothing about the limits changes). Until this file is run the routes use the existing atomic
-- consume_bulk_scan(profile, 1) and work, but cannot recognise a repeated request or give a scan back after a provider failure. This file adds both:
--
--   public.ai_scan_requests         one row per (profile, request id): reserved, done or released. No policies: only the functions below and the service role touch it.
--   public.reserve_ai_scan(profile, request, kind)
--       Atomic (the profile row is locked, so two requests for one profile are decided one after the other). Returns outcome:
--         'reserved'  one scan was spent now;
--         'duplicate' this request id was already reserved or completed: NOTHING is spent;
--         'limit'     the allowance is used up: nothing is spent.
--       A request id whose earlier attempt was released (provider failure) may be reserved again.
--   public.complete_ai_scan(profile, request, succeeded)
--       succeeded = true  -> the reservation stays spent (state done);
--       succeeded = false -> the scan is given back (only if the allowance cycle has not rolled over since), state released.
--
-- WHO MAY CALL. Exactly the people who may already spend an allowance (bulk_scan_guard: a member of the profile, or the server's service role). Anonymous callers and
-- unrelated signed-in accounts are refused. Anonymous callers cannot execute the functions at all.
begin;

create table if not exists public.ai_scan_requests (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  request_id  uuid not null,
  kind        text not null check (kind in ('item', 'coa')),
  state       text not null check (state in ('reserved', 'done', 'released')),
  cycle_start date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, request_id)
);
create index if not exists ai_scan_requests_created_idx on public.ai_scan_requests (created_at);
alter table public.ai_scan_requests enable row level security;
revoke all on public.ai_scan_requests from public, anon, authenticated;

-- The profile's current numbers with a lapsed cycle rolled forward, under the row lock the caller already holds.
create or replace function public.ai_scan_numbers(p_profile uuid)
returns table (v_used int, v_start date, v_limit int, v_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created  timestamptz;
  v_tier     text;
  v_override int;
  v_u        int;
  v_s        date;
  v_want     date;
begin
  select p.created_at, p.tier, p.bulk_scan_limit_override, p.bulk_scans_used, p.bulk_scans_cycle_start
    into v_created, v_tier, v_override, v_u, v_s
    from public.profiles p
   where p.id = p_profile;
  if not found then
    raise exception 'profile not found';
  end if;
  v_want := public.bulk_scan_cycle_start(coalesce(v_created, now()), current_date);
  if v_s is distinct from v_want then
    v_u := 0;
    v_s := v_want;
  end if;
  v_used  := v_u;
  v_start := v_s;
  v_limit := coalesce(
               v_override,
               (select q.monthly_limit from public.bulk_scan_quotas q where q.tier = coalesce(v_tier, 'FREE')),
               (select q.monthly_limit from public.bulk_scan_quotas q where q.tier = 'FREE'),
               0);
  v_end   := (v_s + interval '1 month')::date;
  return next;
end;
$$;
revoke all on function public.ai_scan_numbers(uuid) from public, anon, authenticated;

create or replace function public.reserve_ai_scan(p_profile uuid, p_request uuid, p_kind text default 'item')
returns table (outcome text, scan_limit int, used int, remaining int, cycle_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  n          record;
  v_state    text;
begin
  perform public.bulk_scan_guard(p_profile);
  if p_request is null then
    raise exception 'a request id is required';
  end if;
  if p_kind is null or p_kind not in ('item', 'coa') then
    raise exception 'unknown scan kind';
  end if;

  -- Lock the profile row: every reservation for this profile is decided one after the other, so two requests can never spend the same last scan.
  perform 1 from public.profiles where id = p_profile for update;
  if not found then
    raise exception 'profile not found';
  end if;

  -- Housekeeping: old request rows are not needed any more.
  delete from public.ai_scan_requests where profile_id = p_profile and created_at < now() - interval '3 days';

  select * into n from public.ai_scan_numbers(p_profile);

  select r.state into v_state from public.ai_scan_requests r where r.profile_id = p_profile and r.request_id = p_request for update;
  if found and v_state in ('reserved', 'done') then
    outcome := 'duplicate';
    scan_limit := n.v_limit; used := n.v_used; remaining := greatest(n.v_limit - n.v_used, 0); cycle_end := n.v_end;
    return next;
    return;
  end if;

  if n.v_used >= n.v_limit then
    outcome := 'limit';
    scan_limit := n.v_limit; used := n.v_used; remaining := 0; cycle_end := n.v_end;
    return next;
    return;
  end if;

  update public.profiles
     set bulk_scans_used = n.v_used + 1,
         bulk_scans_cycle_start = n.v_start
   where id = p_profile;

  insert into public.ai_scan_requests (profile_id, request_id, kind, state, cycle_start)
  values (p_profile, p_request, p_kind, 'reserved', n.v_start)
  on conflict (profile_id, request_id)
  do update set state = 'reserved', kind = excluded.kind, cycle_start = excluded.cycle_start, updated_at = now();

  outcome := 'reserved';
  scan_limit := n.v_limit; used := n.v_used + 1; remaining := greatest(n.v_limit - (n.v_used + 1), 0); cycle_end := n.v_end;
  return next;
end;
$$;

create or replace function public.complete_ai_scan(p_profile uuid, p_request uuid, p_succeeded boolean)
returns table (outcome text, scan_limit int, used int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  n          record;
  v_state    text;
  v_cycle    date;
begin
  perform public.bulk_scan_guard(p_profile);

  perform 1 from public.profiles where id = p_profile for update;
  if not found then
    raise exception 'profile not found';
  end if;

  select * into n from public.ai_scan_numbers(p_profile);

  select r.state, r.cycle_start into v_state, v_cycle
    from public.ai_scan_requests r
   where r.profile_id = p_profile and r.request_id = p_request
   for update;

  if not found then
    outcome := 'unknown';
  elsif v_state <> 'reserved' then
    outcome := v_state;                       -- already done or already released: nothing more to do
  elsif p_succeeded then
    update public.ai_scan_requests set state = 'done', updated_at = now() where profile_id = p_profile and request_id = p_request;
    outcome := 'done';
  else
    -- Give the scan back, but only inside the allowance cycle it was taken from.
    if v_cycle = n.v_start and n.v_used > 0 then
      update public.profiles set bulk_scans_used = n.v_used - 1, bulk_scans_cycle_start = n.v_start where id = p_profile;
      n.v_used := n.v_used - 1;
    end if;
    update public.ai_scan_requests set state = 'released', updated_at = now() where profile_id = p_profile and request_id = p_request;
    outcome := 'released';
  end if;

  scan_limit := n.v_limit; used := n.v_used; remaining := greatest(n.v_limit - n.v_used, 0);
  return next;
end;
$$;

revoke all on function public.reserve_ai_scan(uuid, uuid, text) from public, anon;
revoke all on function public.complete_ai_scan(uuid, uuid, boolean) from public, anon;
grant execute on function public.reserve_ai_scan(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.complete_ai_scan(uuid, uuid, boolean) to authenticated, service_role;

commit;
