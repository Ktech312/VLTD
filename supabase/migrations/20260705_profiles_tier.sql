-- ─────────────────────────────────────────────────────────────
-- profiles.tier: backend-controlled subscription tier
-- FREE | MID | FULL — synced into the app on load, overriding
-- the device's local tier. Managed from /admin/tiers.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists tier text;

-- Safe to re-run: drop the CHECK + policies first, then recreate.
alter table public.profiles drop constraint if exists profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check check (tier is null or tier in ('FREE', 'MID', 'FULL'));

drop policy if exists "admins_read_all_profiles" on public.profiles;
drop policy if exists "admins_update_all_profiles" on public.profiles;

-- Admins (user_roles) and the owner can read every profile
create policy "admins_read_all_profiles" on public.profiles
  for select to authenticated
  using (
    (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (
      select 1 from public.user_roles r
      where r.email = (auth.jwt() ->> 'email')
    )
  );

-- Admins and the owner can update any profile (used to set tier)
create policy "admins_update_all_profiles" on public.profiles
  for update to authenticated
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
