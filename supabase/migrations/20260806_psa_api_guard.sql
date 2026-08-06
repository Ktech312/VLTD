-- ─────────────────────────────────────────────────────────────
-- PSA public API guard
--
-- PSA's cert-lookup API has a hard, ACCOUNT-WIDE cap of 100 calls/day
-- (shared across every VLTD user, not per-user) -- confirmed 2026-08-06
-- when a session's own diagnostic testing exhausted it. This migration
-- adds two things so that never silently happens again:
--
--   1. A PERMANENT cache of every cert PSA has ever answered for. A PSA
--      cert's grade/subject/etc. never changes once issued, so once we've
--      looked up a cert, we never need to ask PSA again -- for anyone,
--      ever. This is the single biggest lever: repeat lookups of the same
--      cert (a user re-scanning, two users with the same card, or a
--      developer testing) cost zero real PSA calls after the first.
--   2. A hard internal daily budget the APP enforces on itself, stopping
--      short of PSA's own 100 (SAFE_DAILY_CAP below) so there's always
--      headroom before PSA ever has to say no -- and a "quota_exhausted"
--      flag that gets set immediately if PSA does reject a call, so every
--      other call that same day short-circuits instantly instead of
--      wasting another real PSA call (and getting another rejection) to
--      find out.
--
-- This is a global/account-level guard, NOT a per-user quota like
-- bulk_scan_quotas -- PSA doesn't know or care which VLTD user is asking,
-- the 100/day is shared across all of them.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Permanent cert result cache ───────────────────────────────
create table if not exists public.psa_cert_cache (
  cert_number   text primary key,
  -- The exact shape returned to the client (PSACertResult), stored as-is
  -- so a cache hit is a straight passthrough with no re-shaping needed.
  result        jsonb not null,
  first_looked_up_at timestamptz not null default now(),
  last_served_at     timestamptz not null default now(),
  serve_count         int not null default 1
);

alter table public.psa_cert_cache enable row level security;

-- Server-side only (service role) -- this table is never read/written
-- directly from the browser, only via /api/psa-lookup.
drop policy if exists "service_role_all_psa_cert_cache" on public.psa_cert_cache;
create policy "service_role_all_psa_cert_cache" on public.psa_cert_cache
  for all to service_role
  using (true)
  with check (true);

-- ── 2. Daily call budget (single row, resets on date change) ────
create table if not exists public.psa_api_usage (
  id               int primary key default 1,
  usage_date       date not null default current_date,
  calls_made       int  not null default 0,
  quota_exhausted  boolean not null default false,
  updated_at       timestamptz not null default now(),
  constraint psa_api_usage_singleton check (id = 1)
);

insert into public.psa_api_usage (id) values (1) on conflict (id) do nothing;

alter table public.psa_api_usage enable row level security;

drop policy if exists "service_role_all_psa_api_usage" on public.psa_api_usage;
create policy "service_role_all_psa_api_usage" on public.psa_api_usage
  for all to service_role
  using (true)
  with check (true);

-- ── 3. Reserve one call against today's budget (atomic) ──────────
-- Stops at p_safe_cap (leave real headroom below PSA's own 100 -- if
-- other traffic/testing nudges the count, PSA still never sees a call
-- past what we already know is safe) OR immediately if a PREVIOUS call
-- today already got a real quota-exceeded response from PSA.
create or replace function public.psa_usage_try_reserve(p_safe_cap int default 90)
returns table (allowed boolean, calls_made int, usage_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_calls int;
  v_exhausted boolean;
begin
  select usage_date, calls_made, quota_exhausted
    into v_date, v_calls, v_exhausted
    from public.psa_api_usage
   where id = 1
   for update;

  if v_date is distinct from current_date then
    v_date := current_date;
    v_calls := 0;
    v_exhausted := false;
  end if;

  if v_exhausted or v_calls >= p_safe_cap then
    update public.psa_api_usage
       set usage_date = v_date, calls_made = v_calls, quota_exhausted = v_exhausted,
           updated_at = now()
     where id = 1;
    allowed := false;
    calls_made := v_calls;
    usage_date := v_date;
    return next;
  end if;

  v_calls := v_calls + 1;
  update public.psa_api_usage
     set usage_date = v_date, calls_made = v_calls, quota_exhausted = false, updated_at = now()
   where id = 1;

  allowed := true;
  calls_made := v_calls;
  usage_date := v_date;
  return next;
end;
$$;

-- Called the moment PSA itself reports a quota-exceeded response, so every
-- OTHER call the rest of today short-circuits via psa_usage_try_reserve
-- above instead of finding out the same way (another wasted real call).
create or replace function public.psa_usage_mark_exhausted()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.psa_api_usage
     set quota_exhausted = true,
         usage_date = case when usage_date = current_date then usage_date else current_date end,
         updated_at = now()
   where id = 1;
end;
$$;

-- ── 4. Cache read/write helpers ───────────────────────────────────
create or replace function public.psa_cache_get(p_cert text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update public.psa_cert_cache
     set last_served_at = now(), serve_count = serve_count + 1
   where cert_number = p_cert
  returning result;
$$;

create or replace function public.psa_cache_put(p_cert text, p_result jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.psa_cert_cache (cert_number, result)
  values (p_cert, p_result)
  on conflict (cert_number) do update
    set result = excluded.result, last_served_at = now();
$$;

grant execute on function public.psa_usage_try_reserve(int) to service_role;
grant execute on function public.psa_usage_mark_exhausted() to service_role;
grant execute on function public.psa_cache_get(text) to service_role;
grant execute on function public.psa_cache_put(text, jsonb) to service_role;
