-- PROPOSAL ONLY, NOT APPLIED, deliberately kept out of supabase/migrations. See
-- docs/proposals/public-data-referral-codes-and-appreciations-2026-10-17.md for the reasons and the checks to run afterwards.
-- Run supabase/validation/public_data_policies_read_only.sql first (read-only) to see the current grants and policies.

-- 1. referral_codes: no feature reads it as a visitor (invite page and admin page are signed in; redeem is signed in and not used yet).
revoke select on public.referral_codes from anon;
-- undo: grant select on public.referral_codes to anon;

-- 2. appreciations: visitors only need the item and the row id for the public Vibe counts.
revoke select on public.appreciations from anon;
grant select (id, item_id) on public.appreciations to anon;
-- undo: grant select on public.appreciations to anon;
