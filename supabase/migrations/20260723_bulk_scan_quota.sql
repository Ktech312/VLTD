-- ─────────────────────────────────────────────────────────────
-- Bulk AI-scan quota
--
-- Adding photos / drafts is always free and unlimited. Only an AI
-- *identify* (the model naming an item) is counted. Each user gets a
-- monthly allowance that resets on their own signup anniversary day
-- (the day-of-month of profiles.created_at), NOT the calendar 1st.
--
-- Numbers are config EK sets from the Admin page:
--   • per-tier default        -> bulk_scan_quotas.monthly_limit
--   • optional per-user override -> profiles.bulk_scan_limit_override
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Per-tier config (admin-editable) ─────────────────────────
create table if not exists public.bulk_scan_quotas (
  tier          text primary key check (tier in ('FREE', 'MID', 'FULL')),
  monthly_limit int  not null default 0 check (monthly_limit >= 0),
  updated_at    timestamptz not null default now()
);

-- Starter defaults so the feature works before EK sets real numbers in
-- Admin. These are placeholders to be tuned, not user-facing data.
insert into public.bulk_scan_quotas (tier, monthly_limit) values
  ('FREE', 10),
  ('MID',  100),
  ('FULL', 500)
on conflict (tier) do nothing;

alter table public.bulk_scan_quotas enable row level security;

-- Owner + admins can change the limits.
drop policy if exists "admins_write_bulk_scan_quotas" on public.bulk_scan_quotas;
create policy "admins_write_bulk_scan_quotas" on public.bulk_scan_quotas
  for all to authenticated
  using (
    (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (
      select 1 from public.user_roles r
      where r.email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (
      select 1 from public.user_roles r
      where r.email = (auth.jwt() ->> 'email')
    )
  );

-- Any signed-in user can read the tier limits (needed to show their ticker).
drop policy if exists "authenticated_read_bulk_scan_quotas" on public.bulk_scan_quotas;
create policy "authenticated_read_bulk_scan_quotas" on public.bulk_scan_quotas
  for select to authenticated
  using (true);

-- ── 2. Per-user usage + override on profiles ────────────────────
alter table public.profiles
  add column if not exists bulk_scans_used         int  not null default 0,
  add column if not exists bulk_scans_cycle_start  date,
  add column if not exists bulk_scan_limit_override int;   -- null = use tier default

-- ── 3. Helpers ──────────────────────────────────────────────────

-- The start date of the cycle that contains `as_of`, anchored to the
-- signup day-of-month. Clamps the day to the month length so a signup on
-- the 31st still resets cleanly in short months.
create or replace function public.bulk_scan_cycle_start(p_created timestamptz, p_as_of date)
returns date
language plpgsql
immutable
as $$
declare
  v_anchor int;
  v_dim    int;
  v_cand   date;
  v_prev   date;
begin
  v_anchor := extract(day from p_created)::int;

  -- Anniversary in the month of p_as_of, clamped to that month's length.
  v_dim  := extract(day from (date_trunc('month', p_as_of) + interval '1 month - 1 day'))::int;
  v_cand := make_date(
              extract(year  from p_as_of)::int,
              extract(month from p_as_of)::int,
              least(v_anchor, v_dim));

  if v_cand > p_as_of then
    -- Anniversary hasn't happened yet this month; use last month's.
    v_prev := (date_trunc('month', p_as_of) - interval '1 month')::date;
    v_dim  := extract(day from (date_trunc('month', v_prev) + interval '1 month - 1 day'))::int;
    v_cand := make_date(
                extract(year  from v_prev)::int,
                extract(month from v_prev)::int,
                least(v_anchor, v_dim));
  end if;

  return v_cand;
end;
$$;

-- Guard: only the owning user, an admin/owner, or the server (service role,
-- where there is no JWT) may touch a profile's quota.
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

-- ── 4. Status (rolls the cycle if due, does NOT consume) ─────────
-- Used to render the ticker. Reading is allowed to lazily reset a lapsed
-- cycle so the number is always current.
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

  -- New cycle (or first ever) -> reset usage.
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

-- ── 5. Consume (atomic) ─────────────────────────────────────────
-- Spends up to p_count scans. Returns how many were granted plus the
-- resulting numbers. Never spends more than remain; granted may be 0.
create or replace function public.consume_bulk_scan(p_profile uuid, p_count int default 1)
returns table (granted int, scan_limit int, used int, remaining int)
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
  v_grant   int;
begin
  perform public.bulk_scan_guard(p_profile);

  if p_count is null or p_count < 0 then
    raise exception 'p_count must be >= 0';
  end if;

  -- Lock the row so concurrent bulk runs can't double-spend.
  select p.created_at, p.tier, p.bulk_scan_limit_override,
         p.bulk_scans_used, p.bulk_scans_cycle_start
    into v_created, v_tier, v_override, v_used, v_start
    from public.profiles p
   where p.id = p_profile
   for update;

  if not found then
    raise exception 'profile not found';
  end if;

  v_want := public.bulk_scan_cycle_start(coalesce(v_created, now()), current_date);
  if v_start is distinct from v_want then
    v_used  := 0;
    v_start := v_want;
  end if;

  v_limit := coalesce(
               v_override,
               (select q.monthly_limit from public.bulk_scan_quotas q
                 where q.tier = coalesce(v_tier, 'FREE')),
               (select q.monthly_limit from public.bulk_scan_quotas q where q.tier = 'FREE'),
               0);

  v_grant := greatest(least(p_count, v_limit - v_used), 0);

  update public.profiles
     set bulk_scans_used = v_used + v_grant,
         bulk_scans_cycle_start = v_start
   where id = p_profile;

  granted   := v_grant;
  scan_limit := v_limit;
  used       := v_used + v_grant;
  remaining := greatest(v_limit - (v_used + v_grant), 0);
  return next;
end;
$$;

grant execute on function public.bulk_scan_status(uuid)          to authenticated, service_role;
grant execute on function public.consume_bulk_scan(uuid, int)    to authenticated, service_role;
