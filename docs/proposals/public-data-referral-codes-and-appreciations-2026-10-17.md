# Public-data findings: `referral_codes` and `appreciations` (read-only assessment, 2026-10-17, production)

Method: the anonymous public client only (the site's public key, no session) for everything a visitor can retrieve, run by `docs/ui-verification-2026-10-17/scripts/public-data-assessment.cjs`. The service-role client was used afterwards, read-only, only to say whether an id a visitor receives is an authentication user id or a profile id (yes/no per row). Nothing was written, no policy was changed, and no customer value is printed in this write-up or in the script output (column names, counts and yes/no only). Not a full security audit: two tables only.

## What an anonymous visitor can retrieve

### `referral_codes` (1 row visible today)
| Field | Readable by a visitor | What it is |
|---|---|---|
| `id` | yes | row id |
| `user_id` | **yes** | the **authentication user id** (checked: it exists in the auth users list, it is NOT a profile id) |
| `code` | **yes** | the person's referral code (9 characters; the first 5 are the first 5 hex characters of that user id, by `generateCode` in `src/lib/referral.ts`) |
| `created_at` | yes | when the code was made |

A visitor can also search both ways: code -> user id, and user id -> code. The owner in the visible row has a public, finished profile. A visitor cannot turn an authentication user id into a profile or a name by themselves (the profile table is not readable by visitors), but the id is a stable account identifier and the code is a working invitation code that anyone can read and use.

### `appreciations` (the "Vibe" reactions; 1 row visible today)
| Field | Readable by a visitor | What it is |
|---|---|---|
| `id` | yes | row id |
| `item_id` | yes | the item that was appreciated (the one in the visible row is a public item) |
| `profile_id` | **yes** | a **profile id** (checked: it exists as a profile id, it is NOT an authentication user id). It resolves to a public name through the public profile table for that row. |
| `created_at` | yes | when |

So a visitor can see which profile appreciated which item, and the name where the profile is public. The visible row's profile is not hidden. The code does not stop a hidden (private or unfinished) profile's id from appearing here: no such row exists today (0 of 1), so nothing is exposed now, but nothing in the database prevents it (the same gap the 20261016 migration closed for items and profile names).

## What the existing features actually need

`referral_codes`: **nothing anonymous.**
- Own code, shown and created on the invite page (`/account/invite`): signed in, reads and writes the person's own row.
- Admin list and delete (`/admin/referrals`): signed in as an admin.
- `redeemReferralCode` (looks a code up to find the referrer): written but **not called anywhere** today; when it is used it runs for a signed-in new user, not a visitor.
- The table's access rules are not in any tracked migration (nothing under `supabase/migrations` mentions it), so who may read it is whatever was set by hand in Supabase.

`appreciations`:
- Public counts on exhibitions and Discover (`getAppreciationCounts`: `select item_id`; `getAppreciationCount`: count of `id` for an item). A signed-out visitor needs **only `id` and `item_id`**.
- "Has this viewer already vibed it" (`getAppreciatedSet`, `hasAppreciated`): filters by the viewer's own `profile_id`, so it only runs for a signed-in viewer.
- Vibe / un-vibe: signed in, by the policies in `20260622_appreciations.sql` (insert/delete only as your own profile). That migration also sets "Appreciations are publicly readable" with `using (true)`.
- The app never selects `profile_id` or `created_at` for a visitor, and never uses `select *` on this table.

## Final proposal: STATUS = APPLIED by EK on 2026-10-17 and VERIFIED on production (the SQL is now `supabase/migrations/20261018_restrict_visitor_reads_referral_codes_appreciations.sql`)
Files, to be used together and in this order:
1. `supabase/validation/public_data_before_after_checks.sql`: read-only. Run it BEFORE (it shows today's exposure) and again AFTER.
2. `supabase/migrations/20261018_restrict_visitor_reads_referral_codes_appreciations.sql`: the change (grants only; repeatable; wrapped in a transaction).
3. the checks file again: every row that has an expected value must read `true`.

What the SQL does
- Visitors (anon) lose all reading of `referral_codes`.
- Visitors keep only `id` and `item_id` on `appreciations` (what the public Vibe counts use). `profile_id` and `created_at` are withheld.
- Signed-in users and the service key keep exactly what they hold today.

Review against the real grants, including inherited ones
- I cannot read the production grants myself (no SQL access; the API does not expose them), so the SQL is written to be correct whichever way visitors hold access today: **a grant made to them directly (Supabase's default) or a grant to PUBLIC (everybody) that they inherit.** The first draft only revoked from visitors; a test showed that would have left both tables readable if the access is inherited from PUBLIC. The final SQL therefore revokes from both, after Step 0 gives signed-in users and the service key a grant of their own for what they hold now (so removing PUBLIC cannot take it from them). Table-level revokes also remove any column-level grants on those tables (PostgreSQL documents this).
- Real-engine test (`supabase/validation/test-public-data-sql-in-postgres.cjs`, 61 checks, in-process Postgres with the real appreciations policies): in each of three starting situations (direct grants, PUBLIC-only grants, both) the BEFORE query shows the exposure, the SQL (run twice) removes it, the AFTER query is all true, a visitor gets "permission denied" for codes, authentication ids, Vibe profile ids, times and `select *`, the public counts still work (count of `id`, `item_id` for a list), and signed-in actions still work (read/create own code; "have I vibed it"; "which have I vibed"; Vibe; un-Vibe; counts) with row-level security and all five policies unchanged; visitors cannot Vibe or create codes as someone else.
- Production API check (`public-data-after-checks.cjs`, anonymous client plus the synthetic QA user): BEFORE-baseline measured on production today: 5 visitor checks fail (visitors read codes with authentication ids, look up owner from code, read Vibe profile ids, times and `select *`), 10 pass (counts, signed-in actions). After the SQL it must be 15 of 15.

Production verification (after EK ran the SQL): the production API check passes 15 of 15 (visitor: referral codes, authentication ids, owner/code look-ups, Vibe profile ids, times and select * are all "permission denied"; the public Vibe count and batch counts still work; signed-in user: reads and adds their own referral code, "which have I vibed", "have I vibed this", Vibe, un-Vibe, counts, and cannot Vibe as somebody else); a signed-out visitor's real exhibition page still gets its Vibe counts (the request is accepted with status 200); the visitor view of both tables shows `referral_codes` denied and `appreciations` denied for `select *`. EK's BEFORE rows showed the exposure came from direct grants to visitors (nothing inherited from PUBLIC). EK's AFTER rows from the checks file are still welcome as the final confirmation of the grants themselves.

Found while checking, NOT changed by this SQL: a signed-in user can read other people's referral codes (the QA account saw 2 codes, its own plus another person's), so authentication user ids and codes remain visible to every signed-in account. The checks file shows whether row-level security is on for `referral_codes` (row 16, information only). Limiting signed-in reads to the person's own row (plus admin) is a separate decision.

Not proposed (needs EK's decision, bigger): limiting what other SIGNED-IN accounts can read of these two tables, and a tracked migration that records the current `referral_codes` rules.
