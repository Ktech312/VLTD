-- ─────────────────────────────────────────────────────────────
-- Access coupons + tier lifecycle
-- =============================================================
-- Adds time-boxed tier grants (expiry + source), redeemable coupon
-- codes (e.g. "6 months FULL"), a redemption log, and a tier-change
-- audit trail. Safe to re-run.
--
-- Depends on: 20260705_profiles_tier.sql (profiles.tier column)
-- ─────────────────────────────────────────────────────────────

-- ── profiles: tier lifecycle ────────────────────────────────
alter table public.profiles add column if not exists tier_expires_at timestamptz;
alter table public.profiles add column if not exists tier_source text;  -- 'admin' | 'coupon' | 'stripe' | 'comp'

-- ── Coupons ─────────────────────────────────────────────────
create table if not exists public.access_coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  tier             text not null default 'FULL' check (tier in ('FREE','MID','FULL')),
  duration_months  integer not null default 6,   -- 0 = lifetime
  max_redemptions  integer,                        -- null = unlimited
  times_redeemed   integer not null default 0,
  note             text,
  active           boolean not null default true,
  expires_at       timestamptz,                    -- code validity window (null = no expiry)
  created_by       text,
  created_at       timestamptz not null default now()
);

-- ── Redemption log ──────────────────────────────────────────
create table if not exists public.coupon_redemptions (
  id             uuid primary key default gen_random_uuid(),
  coupon_id      uuid references public.access_coupons(id) on delete set null,
  code           text,
  user_id        uuid,
  tier           text,
  granted_until  timestamptz,   -- null = lifetime
  redeemed_at    timestamptz not null default now()
);

-- ── Tier-change audit ───────────────────────────────────────
create table if not exists public.tier_changes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid,
  old_tier    text,
  new_tier    text,
  source      text,      -- 'admin' | 'coupon' | 'stripe' | 'comp'
  reason      text,
  changed_by  text,
  changed_at  timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.access_coupons     enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.tier_changes        enable row level security;

-- Admin check helper (owner email or a row in user_roles)
create or replace function public.is_vltd_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select
    (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (
      select 1 from public.user_roles r where r.email = (auth.jwt() ->> 'email')
    );
$$;

drop policy if exists "admins manage coupons"        on public.access_coupons;
drop policy if exists "admins read redemptions"      on public.coupon_redemptions;
drop policy if exists "self read redemptions"        on public.coupon_redemptions;
drop policy if exists "admins read tier changes"     on public.tier_changes;

create policy "admins manage coupons" on public.access_coupons
  for all to authenticated
  using ( public.is_vltd_admin() )
  with check ( public.is_vltd_admin() );

create policy "admins read redemptions" on public.coupon_redemptions
  for select to authenticated
  using ( public.is_vltd_admin() );

create policy "self read redemptions" on public.coupon_redemptions
  for select to authenticated
  using ( user_id = auth.uid() );

create policy "admins read tier changes" on public.tier_changes
  for select to authenticated
  using ( public.is_vltd_admin() );

-- ── Redemption RPC (runs as definer; scoped to the caller) ──
create or replace function public.redeem_access_coupon(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_coupon public.access_coupons;
  v_uid    uuid := auth.uid();
  v_email  text := auth.jwt() ->> 'email';
  v_until  timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in to redeem a code.');
  end if;

  select * into v_coupon from public.access_coupons
    where lower(code) = lower(trim(p_code)) and active = true
    limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code is not valid.');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'That code has expired.');
  end if;
  if v_coupon.max_redemptions is not null and v_coupon.times_redeemed >= v_coupon.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'That code has reached its redemption limit.');
  end if;
  if exists (select 1 from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'You have already redeemed this code.');
  end if;

  v_until := case when v_coupon.duration_months = 0
                  then null
                  else now() + make_interval(months => v_coupon.duration_months) end;

  -- Apply to every profile owned by the caller
  insert into public.tier_changes (profile_id, old_tier, new_tier, source, reason, changed_by)
    select id, tier, v_coupon.tier, 'coupon', 'coupon ' || v_coupon.code, v_email
      from public.profiles where user_id = v_uid;

  update public.profiles
    set tier = v_coupon.tier, tier_expires_at = v_until, tier_source = 'coupon'
    where user_id = v_uid;

  insert into public.coupon_redemptions (coupon_id, code, user_id, tier, granted_until)
    values (v_coupon.id, v_coupon.code, v_uid, v_coupon.tier, v_until);
  update public.access_coupons set times_redeemed = times_redeemed + 1 where id = v_coupon.id;

  return jsonb_build_object('ok', true, 'tier', v_coupon.tier, 'until', v_until);
end $$;

grant execute on function public.redeem_access_coupon(text) to authenticated;

-- ── Owner gets lifetime FULL ────────────────────────────────
update public.profiles p
  set tier = 'FULL', tier_expires_at = null, tier_source = 'admin'
  from auth.users u
  where p.user_id = u.id and u.email = 'eck1679@gmail.com';
