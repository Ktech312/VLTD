-- Signed-in accounts can read only THEIR OWN referral code (today any signed-in account can list every code with the owner's authentication id).
-- Written against the real rules EK pasted on 2026-10-17 (supabase/validation/referral_rules_read_only.sql):
--   referral_codes policies today:  "Own referral code" (ALL, auth.uid() = user_id)   and   "Read any code" (SELECT, using true)   <- the exposure
-- What this changes (and nothing else):
--   1. drops "Read any code"                                  -> an account sees and manages only its own row ("Own referral code" stays as it is)
--   2. adds "Admins read all referral codes" (SELECT)         -> the admin page (/admin/referrals) keeps listing every code; same helper the coupons tables use
--   3. adds redeem_referral_code(code), a security-definer function that looks the code up and records the redemption on behalf of the signed-in
--      caller, so the unused redeemReferralCode flow keeps working WITHOUT any account id or code owner ever leaving the database
-- What this does NOT change: visitors (already blocked), referral_redemptions and user_perks policies, increment_user_perk_galleries,
--   bonus galleries (see the note on the function), and admin delete / perk editing (those were never covered by a policy).
-- Repeatable: safe to run twice. Run the checks file referral_codes_own_only_checks.sql before and after.
begin;

-- 1 + 2: who can read which rows
drop policy if exists "Read any code" on public.referral_codes;
drop policy if exists "Admins read all referral codes" on public.referral_codes;
create policy "Admins read all referral codes" on public.referral_codes
  for select to authenticated
  using (public.is_vltd_admin());

-- 3: redeeming a code, without exposing who owns it
-- Same rules as redeemReferralCode in src/lib/referral.ts: the code must exist, you cannot refer yourself, and one redemption per account
-- (referral_redemptions.referred_id is unique). The answer carries only ok and, when refused, a plain message: never an id.
-- Bonus galleries are NOT granted here. Today the client's call to increment_user_perk_galleries is refused by row-level security on
-- user_perks (measured on production 2026-10-17: it could not even grant the caller itself a gallery), so nobody has ever received one through
-- this flow. Whether to grant them, and how to stop one person farming them with extra accounts, is a separate decision.
create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_referrer uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to redeem a referral code');
  end if;
  select user_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid referral code');
  end if;
  if v_referrer = v_uid then
    return jsonb_build_object('ok', false, 'error', 'Cannot refer yourself');
  end if;
  if exists (select 1 from public.referral_redemptions where referred_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'Already redeemed a referral code');
  end if;
  insert into public.referral_redemptions (code, referrer_id, referred_id) values (v_code, v_referrer, v_uid);
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Already redeemed a referral code');
end;
$$;

revoke all on function public.redeem_referral_code(text) from public;
revoke all on function public.redeem_referral_code(text) from anon;
grant execute on function public.redeem_referral_code(text) to authenticated;
grant execute on function public.redeem_referral_code(text) to service_role;

commit;
