-- 3D Museum beta gate: a "Beta" button on every exhibition card lets a
-- user REQUEST access; EK enables it per-user from /admin/users. Two
-- columns on profiles:
--   museum_beta_requested_at — the user sets this themselves (just "I
--     asked"), no protection needed.
--   museum_beta_enabled — the actual grant. Same risk as tier/
--     stripe_customer_id earlier this session: profiles_update_own only
--     checks "is this your row", never which columns changed, so without
--     protection a user could self-grant beta access the same way they
--     could have self-granted a paid tier. Added to the SAME trigger
--     (protect_profile_billing_columns, 20260823_protect_profile_billing_columns.sql)
--     rather than a new one — same is_privileged check, same reasoning.

alter table public.profiles
  add column if not exists museum_beta_requested_at timestamptz,
  add column if not exists museum_beta_enabled boolean not null default false;

create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_privileged boolean;
begin
  is_privileged := (
    auth.role() = 'service_role'
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
    new.museum_beta_enabled := old.museum_beta_enabled;
  else
    new.tier := null;
    new.tier_expires_at := null;
    new.tier_source := null;
    new.stripe_customer_id := null;
    new.bulk_scans_used := 0;
    new.bulk_scan_limit_override := null;
    new.museum_beta_enabled := false;
  end if;

  return new;
end;
$$;
