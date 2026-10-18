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

## Smallest restriction (PROPOSAL, nothing applied)
Files: `docs/proposals/public-data-minimum-restrictions-2026-10-17.sql` (the two changes) and `supabase/validation/public_data_policies_read_only.sql` (a read-only listing of the real policies and grants, to run first because the `referral_codes` rules are not in the repo).

1. **`referral_codes`: take reading away from visitors.** `revoke select on public.referral_codes from anon;` No feature loses anything (none is anonymous). Signed-in behaviour is unchanged. Undo: `grant select on public.referral_codes to anon;`.
2. **`appreciations`: leave visitors only what the counts use.** `revoke select on public.appreciations from anon; grant select (id, item_id) on public.appreciations to anon;` Public counts keep working; `profile_id` and `created_at` are no longer visible to visitors; signed-in viewers are unchanged. (Same column-grant pattern already used for `vault_items` in `20261007_public_item_columns.sql`.) Undo: `grant select on public.appreciations to anon;`.
3. **Not proposed now (needs EK's decision, bigger):** limiting what other SIGNED-IN accounts can read of these two tables (own rows plus admin for `referral_codes`; counts only for `appreciations`), and a tracked migration that records the current `referral_codes` rules. Run the read-only listing first.

After applying 1 and 2, rerun `public-data-assessment.cjs`: `referral_codes` should be denied outright, and for `appreciations` `profile_id` and `created_at` should be denied while `item_id` and the counts stay readable; then check an exhibition's Vibe counts on the live site as a signed-out visitor.

Status: assessment only; no change applied, none requested to apply.
