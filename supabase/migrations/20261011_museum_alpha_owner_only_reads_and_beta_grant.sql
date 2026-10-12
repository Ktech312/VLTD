-- Follow-up to 20261011_museum_alpha_owner_and_3d_approval.sql (run that one first).
--
-- 1. Museum Alpha reads are owner-only. Writes were already owner-only; the public read policies that
--    still let anyone read the campus, spotlight, store, room-item and room-meta tables are removed.
--    Ordinary exhibitions (galleries) are different tables and are not touched.
-- 2. Only the owner (or the server, for the owner-checked admin route) can set profiles.museum_beta_enabled.
--    Other admins could change it before. Every other billing protection stays exactly as it was.
-- 3. The Museum room-bake file storage: only the owner can list, upload, replace or delete.
--    The bucket itself stays public so the owner's baked rooms keep loading by URL.
--
-- Safe to run more than once. No data is deleted.

-- ── 1. Reads: owner only ─────────────────────────────────────────────────────

drop policy if exists "Public can read museum campus config" on public.museum_campus_config;
drop policy if exists "Public can read active spotlight programs" on public.museum_spotlight_programs;
drop policy if exists "Public can read enabled store items" on public.museum_store_items;
drop policy if exists "Public can read enabled museum room items" on public.museum_room_items;
drop policy if exists "Public can read museum room meta" on public.museum_room_meta;

-- Defense in depth: signed-out visitors get no table access at all (row security already returns nothing).
revoke select on public.museum_campus_config from anon;
revoke select on public.museum_spotlight_programs from anon;
revoke select on public.museum_store_items from anon;
revoke select on public.museum_room_items from anon;
revoke select on public.museum_room_meta from anon;

-- The "Owner full access ..." policies from the previous migration (FOR ALL) now cover owner reads.

-- ── 2. museum_beta_enabled: owner only ───────────────────────────────────────

create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
  is_privileged boolean;
begin
  -- The owner, or the server (service role), which only the owner-checked admin route uses.
  is_owner := (auth.role() = 'service_role') or public.is_vltd_owner();

  -- 3D Gallery approval can only be granted by the owner. Other admins cannot change it.
  if not is_owner then
    if tg_op = 'UPDATE' then
      new.museum_beta_enabled := old.museum_beta_enabled;
    else
      new.museum_beta_enabled := false;
    end if;
  end if;

  -- Billing columns: unchanged behaviour. The owner and granted admins may change them.
  is_privileged := (
    is_owner
    or (auth.jwt() ->> 'email') = 'eck1679@gmail.com'
    or exists (select 1 from public.user_roles where email = (auth.jwt() ->> 'email'))
  );

  if is_privileged then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.tier := old.tier;
    new.tier_expires_at := old.tier_expires_at;
    new.tier_source := old.tier_source;
    new.stripe_customer_id := old.stripe_customer_id;
    new.account_code := old.account_code;
    new.bulk_scans_used := old.bulk_scans_used;
    new.bulk_scan_limit_override := old.bulk_scan_limit_override;
  else
    new.tier := null;
    new.tier_expires_at := null;
    new.tier_source := null;
    new.stripe_customer_id := null;
    new.bulk_scans_used := 0;
    new.bulk_scan_limit_override := null;
  end if;

  return new;
end;
$$;

-- The trigger itself already exists from 20260823_protect_profile_billing_columns.sql; this re-attaches it
-- to be sure it is in place.
drop trigger if exists protect_profile_billing_columns_trigger on public.profiles;
create trigger protect_profile_billing_columns_trigger
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing_columns();

-- ── 3. Museum room-bake storage: owner only ──────────────────────────────────

drop policy if exists "Public can read museum room bakes" on storage.objects;
create policy "Owner can list museum room bakes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'museum-room-bakes' and public.is_vltd_owner());

drop policy if exists "Admins can upload museum room bakes" on storage.objects;
create policy "Owner can upload museum room bakes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'museum-room-bakes' and public.is_vltd_owner());

drop policy if exists "Admins can update museum room bakes" on storage.objects;
create policy "Owner can update museum room bakes"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'museum-room-bakes' and public.is_vltd_owner());

drop policy if exists "Admins can delete museum room bakes" on storage.objects;
create policy "Owner can delete museum room bakes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'museum-room-bakes' and public.is_vltd_owner());
