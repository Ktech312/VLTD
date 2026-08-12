-- ─────────────────────────────────────────────────────────────
-- Generic lookup-API guard: permanent cache + daily budget,
-- reusable across every metered third-party lookup this app calls
-- (upcitemdb, Discogs, Metron), not just PSA.
--
-- Same two-part design as the PSA guard (20260806_psa_api_guard.sql),
-- generalized with a `provider` key instead of one-table-per-service:
--   1. PERMANENT cache, keyed by (provider, cache_key). A barcode's
--      product/comic/release info doesn't change once published, so a
--      repeat lookup of the same code -- a user re-scanning, two users
--      with the same item, or diagnostic testing -- costs zero real API
--      calls after the first, for any provider.
--   2. Hard internal DAILY budget per provider, enforced BEFORE the
--      outbound call. Only actually applied to providers with a real
--      confirmed hard daily cap (upcitemdb: 100/day, same shape as PSA's
--      100/day that got exhausted 2026-08-06 -- see that migration's
--      notes). Discogs/Metron are per-MINUTE rate limits, not daily caps,
--      so they lean on the cache + graceful 429 handling instead of this
--      table; the function still works generically if a real daily cap
--      is ever confirmed for either.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Permanent cache, any provider ─────────────────────────────
create table if not exists public.lookup_api_cache (
  provider      text not null,
  cache_key     text not null,
  result        jsonb not null,
  first_looked_up_at timestamptz not null default now(),
  last_served_at     timestamptz not null default now(),
  serve_count         int not null default 1,
  primary key (provider, cache_key)
);

alter table public.lookup_api_cache enable row level security;

drop policy if exists "service_role_all_lookup_api_cache" on public.lookup_api_cache;
create policy "service_role_all_lookup_api_cache" on public.lookup_api_cache
  for all to service_role
  using (true)
  with check (true);

-- ── 2. Daily call budget, one row per provider ───────────────────
create table if not exists public.lookup_api_usage (
  provider         text primary key,
  usage_date       date not null default current_date,
  calls_made       int  not null default 0,
  quota_exhausted  boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table public.lookup_api_usage enable row level security;

drop policy if exists "service_role_all_lookup_api_usage" on public.lookup_api_usage;
create policy "service_role_all_lookup_api_usage" on public.lookup_api_usage
  for all to service_role
  using (true)
  with check (true);

-- ── 3. Reserve one call against a provider's daily budget (atomic) ──
create or replace function public.lookup_api_try_reserve(p_provider text, p_safe_cap int)
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
  insert into public.lookup_api_usage (provider) values (p_provider)
  on conflict (provider) do nothing;

  select usage_date, calls_made, quota_exhausted
    into v_date, v_calls, v_exhausted
    from public.lookup_api_usage
   where provider = p_provider
   for update;

  if v_date is distinct from current_date then
    v_date := current_date;
    v_calls := 0;
    v_exhausted := false;
  end if;

  if v_exhausted or v_calls >= p_safe_cap then
    update public.lookup_api_usage
       set usage_date = v_date, calls_made = v_calls, quota_exhausted = v_exhausted,
           updated_at = now()
     where provider = p_provider;
    allowed := false;
    calls_made := v_calls;
    usage_date := v_date;
    return next;
  end if;

  v_calls := v_calls + 1;
  update public.lookup_api_usage
     set usage_date = v_date, calls_made = v_calls, quota_exhausted = false, updated_at = now()
   where provider = p_provider;

  allowed := true;
  calls_made := v_calls;
  usage_date := v_date;
  return next;
end;
$$;

-- Called the moment a provider itself reports a quota-exceeded response, so
-- every OTHER call to that SAME provider the rest of today short-circuits
-- via lookup_api_try_reserve instead of spending another real call to find
-- out the same way.
create or replace function public.lookup_api_mark_exhausted(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lookup_api_usage (provider, quota_exhausted)
  values (p_provider, true)
  on conflict (provider) do update
    set quota_exhausted = true,
        usage_date = case when public.lookup_api_usage.usage_date = current_date
                          then public.lookup_api_usage.usage_date else current_date end,
        updated_at = now();
end;
$$;

-- ── 4. Cache read/write helpers ───────────────────────────────────
create or replace function public.lookup_api_cache_get(p_provider text, p_key text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update public.lookup_api_cache
     set last_served_at = now(), serve_count = serve_count + 1
   where provider = p_provider and cache_key = p_key
  returning result;
$$;

create or replace function public.lookup_api_cache_put(p_provider text, p_key text, p_result jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lookup_api_cache (provider, cache_key, result)
  values (p_provider, p_key, p_result)
  on conflict (provider, cache_key) do update
    set result = excluded.result, last_served_at = now();
$$;

grant execute on function public.lookup_api_try_reserve(text, int) to service_role;
grant execute on function public.lookup_api_mark_exhausted(text) to service_role;
grant execute on function public.lookup_api_cache_get(text, text) to service_role;
grant execute on function public.lookup_api_cache_put(text, text, jsonb) to service_role;
