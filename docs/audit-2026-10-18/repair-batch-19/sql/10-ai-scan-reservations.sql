-- SQL package 10 (CORRECTED for review, 2026-10-24. HOLD: do not run until reviewed): one reservation per AI scan request, decided ONLY by the trusted server.
-- Run the whole file once in the Supabase SQL editor, then validation-10.sql (every value must read true). Safe to re-run. Rollback: rollback-10.sql.
--
-- WHAT CHANGED FROM THE FIRST DRAFT (review finding): the first draft let any signed-in member call complete_ai_scan. A member could therefore mark their own in-flight
-- reservation "released" (a refund) while the provider was still answering, or before it, and so scan for free. Completion and refunds are now callable ONLY by the
-- server's service role, and so is reserve. The server alone decides whether the provider succeeded and whether a refund is due.
--
-- A SECOND FINDING THIS REVIEW SURFACED (existing, not caused by this file): the billing-column protection trigger on public.profiles
-- (protect_profile_billing_columns) silently puts bulk_scans_used back to its old value for any caller that is not the owner, an admin or the service role, EVEN INSIDE the
-- SECURITY DEFINER allowance functions. So today consume_bulk_scan(profile, 1) called with a member's own token answers "granted 1, used 1" and changes nothing: measured on
-- production on a QA profile (three calls, counter still 0). Called by the service role it works (two calls, counter 2). Everything below therefore writes the counter
-- as the service role, and bulk_scan_status becomes read-only so a member's ticker call can no longer roll a lapsed cycle forward while the trigger keeps the old count.
--
-- HOW IT IS USED. The scan routes verify the caller's sign-in token with Supabase, then call these functions with the service role, passing the VERIFIED user id:
--   public.reserve_ai_scan(p_user, p_profile, p_request, p_kind)    outcome 'reserved' (one scan spent from the profile's existing monthly allowance), 'duplicate' (this
--       request id was already reserved or finished: nothing spent) or 'limit' (allowance used up: nothing spent). The user must be the profile itself or a member of it
--       (the same rule as the existing guard), otherwise 'not authorized to access this quota'. The profile row is locked, so reservations for one profile are decided one
--       after the other and two requests can never spend the same last scan.
--   public.complete_ai_scan(p_profile, p_request, p_succeeded)       true: the reservation stays spent; false: the scan is given back, ONCE, and only inside the allowance cycle it was
--       taken from. Doing either again does nothing.
-- No limit, tier, override or cycle rule changes: bulk_scan_quotas, profiles.bulk_scan_limit_override, bulk_scans_used and the signup-anniversary cycle are the existing ones.
--
-- WHO MAY CALL: reserve, complete and the number helper: the service role only (each also checks auth.role() inside, so a later careless GRANT cannot open them).
-- bulk_scan_status keeps its existing readers (a member of the profile, plus the owner/admins who may already read it).
begin;

create table if not exists public.ai_scan_requests (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  request_id  uuid not null,
  user_id     uuid,
  kind        text not null check (kind in ('item', 'coa')),
  state       text not null check (state in ('reserved', 'done', 'released')),
  cycle_start date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (profile_id, request_id)
);
alter table public.ai_scan_requests add column if not exists user_id uuid;
create index if not exists ai_scan_requests_created_idx on public.ai_scan_requests (created_at);
alter table public.ai_scan_requests enable row level security;
revoke all on public.ai_scan_requests from public, anon, authenticated;

-- The profile's current numbers with a lapsed cycle rolled forward IN THE ANSWER (nothing is written here).
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

create or replace function public.reserve_ai_scan(p_user uuid, p_profile uuid, p_request uuid, p_kind text default 'item')
returns table (outcome text, scan_limit int, used int, remaining int, cycle_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  n          record;
  v_state    text;
begin
  -- Only the trusted server may reserve (privileges say so too; this is the belt to those braces).
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only the server may reserve a scan';
  end if;
  if p_user is null then
    raise exception 'a verified user is required';
  end if;
  if p_request is null then
    raise exception 'a request id is required';
  end if;
  if p_kind is null or p_kind not in ('item', 'coa') then
    raise exception 'unknown scan kind';
  end if;
  -- The VERIFIED caller must be the profile itself or a member of it, before anything is reserved.
  if not (p_profile = p_user or exists (select 1 from public.profile_members m where m.profile_id = p_profile and m.user_id = p_user)) then
    raise exception 'not authorized to access this quota';
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

  insert into public.ai_scan_requests (profile_id, request_id, user_id, kind, state, cycle_start)
  values (p_profile, p_request, p_user, p_kind, 'reserved', n.v_start)
  on conflict (profile_id, request_id)
  do update set state = 'reserved', user_id = excluded.user_id, kind = excluded.kind, cycle_start = excluded.cycle_start, updated_at = now();

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
  -- Only the trusted server decides whether the provider succeeded and whether a refund is due.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only the server may complete a scan';
  end if;
  if p_succeeded is null then
    raise exception 'the result is required';
  end if;

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
    outcome := v_state;                       -- already done or already released: nothing more happens, ever
  elsif p_succeeded then
    update public.ai_scan_requests set state = 'done', updated_at = now() where profile_id = p_profile and request_id = p_request;
    outcome := 'done';
  else
    -- Give the scan back, once, and only inside the allowance cycle it was taken from.
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

-- bulk_scan_status becomes READ-ONLY. The version in production rolls a lapsed cycle forward with an UPDATE; for a member's own call the billing-column trigger keeps the old
-- bulk_scans_used while the new cycle start sticks, which would carry last cycle's count into the new cycle. The roll now happens when the server reserves (as the service role).
-- Same readers, same guard, same answer shape, same numbers.
create or replace function public.bulk_scan_status(p_profile uuid)
returns table (scan_limit int, used int, remaining int, cycle_start date, cycle_end date)
language plpgsql
security definer
set search_path = public
as $$
declare
  n record;
begin
  perform public.bulk_scan_guard_read(p_profile);
  select * into n from public.ai_scan_numbers(p_profile);   -- raises 'profile not found' for an unknown profile
  scan_limit  := n.v_limit;
  used        := n.v_used;
  remaining   := greatest(n.v_limit - n.v_used, 0);
  cycle_start := n.v_start;
  cycle_end   := n.v_end;
  return next;
end;
$$;

revoke all on function public.ai_scan_numbers(uuid) from public, anon, authenticated;
revoke all on function public.reserve_ai_scan(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_ai_scan(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.reserve_ai_scan(uuid, uuid, uuid, text) to service_role;
grant execute on function public.complete_ai_scan(uuid, uuid, boolean) to service_role;
revoke all on function public.bulk_scan_status(uuid) from public, anon;
grant execute on function public.bulk_scan_status(uuid) to authenticated, service_role;
-- The first draft's member-callable signatures must not linger if it was ever applied.
drop function if exists public.reserve_ai_scan(uuid, uuid, text);

commit;
