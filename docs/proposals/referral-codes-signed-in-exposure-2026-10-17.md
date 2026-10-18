# Signed-in referral-code exposure (2026-10-17): STATUS = APPLIED by EK and VERIFIED on production

## The problem (measured on production, two synthetic accounts J and K, ordinary user keys; no real person's code or id printed)
| Check (signed in as J) | Result BEFORE any change |
|---|---|
| J reads its own code | yes |
| Rows belonging to OTHER accounts that J can list (`select *`, no filter) | **2** (K, plus one real person) |
| J looks up K's row by K's account id | **1 row** |
| J looks up the OWNER ID of K's code by the code alone | **1 row** |
| A visitor with no sign-in reads `referral_codes` | no (denied; closed earlier on 2026-10-17) |
| J inserts a code for K / deletes K's code / changes K's code | no / no / no (row-level security already blocks writes across accounts) |
| Other accounts' redemption rows / perk rows visible to J | 0 / 0 |
| J gives ITSELF bonus galleries through `increment_user_perk_galleries` | **no** (refused by row-level security on `user_perks`) |
| Redemption the way the app does it today (look the code up, record the redemption) | works (so the look-up is the part that has to move into the database) |

So the open hole is **read only**: every signed-in account can list every referral code together with the owner's authentication id.

## The real rules (EK's read-only query output, 2026-10-17)
- `referral_codes`: `"Own referral code"` (ALL, `auth.uid() = user_id`) and `"Read any code"` (SELECT, `using true`). The second one is the exposure.
- `referral_redemptions`: insert only as yourself (`auth.uid() = referred_id`), read only your own. `referred_id` is unique.
- `user_perks`: read only your own; **no insert or update policy**, and `increment_user_perk_galleries` is not a security-definer function, so for an ordinary account it is refused. Nobody has ever been granted a bonus gallery through the referral flow.
- Admin check already in the database: `public.is_vltd_admin()` (owner address or a row in `user_roles`).

## The change: `supabase/migrations/20261019_referral_codes_own_rows_only.sql`
1. Drops `"Read any code"`. An account now sees and manages only its own row (`"Own referral code"` is untouched).
2. Adds `"Admins read all referral codes"` (SELECT, `is_vltd_admin()`), so `/admin/referrals` keeps listing every code.
3. Adds `redeem_referral_code(code)`, a security-definer function that does what `redeemReferralCode` did (code must exist, no self-referral, one redemption per account) for the signed-in caller and answers with only `ok` or a plain message, never an id. `src/lib/referral.ts` now calls it. Not callable by visitors.

Not changed (deliberately): visitors, `referral_redemptions` and `user_perks` policies, `increment_user_perk_galleries`, bonus galleries, admin delete and admin perk editing.

## Tested before anyone runs it
`supabase/validation/test-referral-sql-in-postgres.cjs` (30/30): a real Postgres rebuilt from the pasted policies, grants, constraints and function bodies. Before: lists everyone, finds owner ids. After (run twice): own read/create works, cross-account list and lookup return nothing, cross-account insert/delete/update still refused, visitors still blocked, admin and owner address still list everything, a non-admin sees only its own row, redemption works through the function and returns only `ok`, repeat/self/unknown/empty/visitor all refused, no galleries granted, other tables' policies untouched. Read-only before/after checks: `supabase/validation/referral_codes_own_only_checks.sql` (15 rows with an expected value; today rows 1, 2, 4, 5, 6, 7 and 10 show false, after the change all are true).

## Production verification (done, 2026-10-17)
EK ran the migration and the read-only checks: all 15 rows true, and the info row lists exactly the two remaining policies. The two-account production probe then passed 25/25: J lists 0 other accounts' rows and finds 0 by id or by code (before: 2, 1 and 1); own read/create works; cross-account insert/delete/change and visitor reads are still refused; redemption through the function returns only `{ok:true}` and is recorded with K as referrer; repeat, own-code, unknown-code and visitor calls are refused with plain messages; no galleries are granted; the admin read still works (a synthetic address in `user_roles` listed every code; the throwaway row was removed). The synthetic accounts and their rows were then removed.

(Original plan, kept for the record:)
Plan after EK runs the migration: the same two synthetic accounts against production (`referral-probe.cjs AFTER`): own access works, cross-account listing and lookup return nothing, redemption works through the function and returns no id, repeat/self/unknown/visitor refused, and the admin read still works (checked with a throwaway `user_roles` row for the synthetic address only, removed straight away).

## Found while reading the real rules (not changed; for EK)
- **The invite page promises bonus galleries that nobody receives.** `/account/invite` says a friend gets +1 free Exhibition and the inviter earns +1, and `getReferralStats` reports "bonus earned", but the grant is refused by row-level security and no screen calls the redeem function at all. Enabling grants needs a decision (and a limit, otherwise one person can farm galleries with extra accounts).
- **The admin referrals page is only partly working today:** it can list every code (through the policy this change keeps for admins), but listing every redemption count and every perk row, deleting other people's codes, and setting other people's perks have no admin policy, so they show or change only the admin's own data.
- `referral_redemptions` lets an account record a redemption naming any `referrer_id` and any code text (check is only `auth.uid() = referred_id`). It needs the victim's account id, which this change stops leaking, but the redeem function is the safer path if that insert policy is ever removed.
