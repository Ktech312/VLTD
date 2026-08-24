-- Confirmed live (EK pulled the actual policy from the dashboard):
-- "profiles_update_own" is `using (auth.uid() = user_id)`, no WITH CHECK
-- expression of its own. That's correct for "can this row be touched at
-- all" — but Postgres RLS has no column granularity. Any signed-in user
-- can already open devtools and run
--   supabase.from('profiles').update({ tier: 'FULL', tier_expires_at: null }).eq('id', myProfileId)
-- and it would succeed, because the policy only ever checks that the row
-- is their own, never which columns changed. Confirmed no legitimate
-- client code needs to touch these columns itself (grepped
-- src/app/account/page.tsx and the rest of src/ — nothing sends
-- tier/tier_expires_at/tier_source/stripe_customer_id/account_code/
-- bulk_scans_used/bulk_scan_limit_override from the browser; they're
-- only ever set by the admin tiers page, the coupon-redeem RPC, the
-- Stripe webhook (service role), or the account-code trigger).
--
-- RLS can't do column-level checks, so this is a BEFORE INSERT OR UPDATE
-- trigger instead: a non-privileged caller's row write goes through
-- completely normally for every other column, but these specific ones
-- get silently forced back to their real value (their old value on
-- update, a safe default on insert) regardless of what the request body
-- contained. Privileged callers (the owner, anyone in user_roles, or the
-- service role used by the Stripe webhook) are unaffected.
--
-- business_type/tax_id were checked and left OUT of this list on
-- purpose — those are legitimately self-set during onboarding
-- (src/app/onboarding/page.tsx), not billing/tier-granting fields.

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
  else
    -- INSERT: a non-privileged caller creating their own profile row
    -- never starts on anything but real defaults. account_code is left
    -- alone here on purpose — the existing trg_profiles_account_code
    -- trigger assigns it separately.
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

drop trigger if exists protect_profile_billing_columns_trigger on public.profiles;
create trigger protect_profile_billing_columns_trigger
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_billing_columns();
