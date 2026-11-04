# Business member access: cause, fix, verification (2026-11-03)

Status: **fixed and verified end to end on https://vltd.app with the real database function (45 of 45, nothing simulated).** Code is live (55a49dd); EK ran `20261103_business_member_profiles.sql` and its checks on production.

## The defect

A team member added by a business owner (Account > Settings > Workspace and team > Team > Add) was on the roster, but when they signed in:

- their Account menu listed only their own profile (no Switch Profile),
- Settings had no "Workspace and team",
- `/account/team` and `/account/workspace` sent them to their own Settings.

(Recorded as U-2 / D-2 / F-010 in the video-library-2 defect list.)

## Root cause (traced end to end)

Reproduced on https://vltd.app with three synthetic accounts in separate isolated browsers, real sign-in, and the Team page's own Add button. Then checked what each account can read straight from the database with its own login:

| What the added member can read | Result |
|---|---|
| the business's items | yes (3 of 3), the existing database rules already allow members |
| the business's exhibitions | yes |
| the business's roster | yes |
| **the business's profile row** | **no** (0 rows): the `profiles` table only answers for its owner |

So the data layer was already membership-aware. The break was in two places that work together:

1. `listMyProfiles()` in `src/lib/auth.ts` asked for `profiles where user_id = me`. Team membership (`profile_members`) was never read.
2. Even if it had asked, the database would not have returned the business's profile row to a non-owner.

Everything the member saw follows from that: no profile in the list, so no switcher, no active business (the app silently reset any stored "active" id it did not recognise), and the Team/Workspace pages (which require the active profile to be a business) redirected away.

## What changed

**Database (one new function, nothing loosened)**

- `supabase/migrations/20261103_business_member_profiles.sql`: adds `public.list_member_profiles()`, a read-only function that returns, for the signed-in person, the **business** profiles they were added to (role admin or member) with only the columns the app needs to show and switch into them. It never returns the caller's own profiles, never a personal profile (even if a stray member row exists), nothing for signed-out callers, and nothing once the member row is deleted. The `profiles` table's own access rules are **not** changed, so contact details, tax id, billing and AI-usage columns stay owner-only.
- `supabase/verification/20261103_business_member_profiles_checks.sql`: read-only checks to run after the migration (function exists, signed-out cannot call it, no owner-only column is ever returned, every real team member gets their business back, no personal profile surfaces).
- `supabase/validation/test-business-member-profiles-in-postgres.cjs`: the same function exercised in a real in-process Postgres (PGlite) for owner, admin, member, removed member, unrelated person, signed-out, and a member row on a personal profile (12 of 12 pass).

**App**

- `src/lib/auth.ts`: `listMyProfiles()` now also asks that function and appends the businesses the person was added to (own profiles first). New `member_role` field and `isSharedProfile()`. If the function is missing or fails, the answer is "unknown": nothing is added and nothing is forgotten (safe before the SQL is run). When a business that this device had shown disappears from a successful answer (the person was removed), the device's cached copy of that business's items and exhibitions is forgotten (`forgetLocalProfileData` in `vaultModel.ts`, `forgetLocalProfileGalleries` in `galleryModel.ts`).
- `src/components/account/SettingsShell.tsx`: while a business they were added to is active, Settings shows "You are a team member" and offers only Workspace and team (Team, Roles), Preferences, Privacy and security, Data. Profile and Billing and contact are hidden. The profile switcher labels the business "Business · team member".
- `src/components/TopNav.tsx`: the Account menu's Switch Profile block shows the same label.
- `src/app/account/workspace/page.tsx`, `src/app/account/page.tsx` (profile and contact), `src/app/account/billing/page.tsx`: send a team member to the Team page (these are the owner's).
- `src/components/account/PrivacyIdentityCards.tsx`: replaced by a notice for a team member (it edits the active profile's own details).
- `src/app/vault/VaultListView.tsx`: the "move selected items to another profile" buttons never offer a business the person was added to, and are hidden while one is active. Personal and business collections therefore cannot be mixed by a team member.

## What a team member can and cannot do (current rules, not extended)

These come from the existing database rules and Team page text; no role system was built.

- Can: see and switch into the business, read its items, exhibitions and roster, add items and edit items/exhibitions (existing "members can read/add/edit" rule).
- Cannot: delete items or exhibitions, add/remove people, change roles, transfer ownership, rename the business, change its plan or billing (all refused by the database; the app hides the controls).
- An **admin** (the existing second role) additionally gets what the Team page already gave admins: add/remove members and change roles, delete items. Admins still cannot edit the business profile, billing or transfer ownership.
- Roles page: still a preview of four planned roles; nothing there is enforced and nothing was changed. The only enforced roles today are owner, admin and member.

## Sending email

`add_profile_member` (read before using) only inserts a roster row. It sends no email, there is no invitation step (current behaviour, unchanged). Only synthetic QA addresses were typed.

## Product decisions for EK

1. A plain **Member** may currently edit items and exhibitions (including switching an item's public flag), not only add. That is the existing database rule. Say if members should be view-and-add only.
2. A member working inside a business uses the business's plan (tier) for feature limits. Private-photo uploads stay off for members, because the app cannot read the plan from the profile row it is not allowed to read.
3. Member/admin Add still works on a personal profile if someone calls the database function directly (the Team page only offers it for businesses). The new function ignores such rows, so nothing is exposed in the app. Tightening the function itself is a separate, small change.

## Verification

How it was tested: three synthetic collectors (owner with a personal and a business profile, a member, an unrelated person) plus a signed-out visitor, each in its own isolated headless Chrome with its own profile folder and a real sign-in through the login form. Membership was created and removed **only with the Team page's own Add and Remove buttons**; the harness only created the accounts and seed items. Scripts: `docs/repair-2026-11-03/qa/` (`fixture.cjs`, `repro.cjs`, `probe.cjs`, `verify.cjs`, `degrade.cjs`; the passwords live in a manifest outside the repo).

### Before the fix (live site, reproduced)
Member signs in after the owner's Add: profile list = own profile only; forcing the business as the active profile snaps back to their own; `/account/team`, `/account/workspace` go to Settings. Direct database reads with the member's own login: items 3/3, exhibitions 1/1, roster 2/2, **business profile row 0/1**.

### First round (before the SQL was applied): what was proven where
The database function cannot be run against production by me (EK applies SQL by hand). So the app test below answers **only the one call to `list_member_profiles`** with the function's exact result, computed from the real tables with the service key (same logic as the migration, which is separately proven in a real in-process Postgres: 12 of 12). Every other request in these runs went to the real production database with each person's own login, so the database refusals, the roster, the Add and Remove, the items and exhibitions are all real. **After EK runs the SQL, `node docs/repair-2026-11-03/qa/verify.cjs --base=https://vltd.app` (no `--sim`) repeats the whole table with nothing simulated.**

Safe before the SQL (no simulation, function absent in the real database, answers 404): the member sees their own profile, no business, no error page, own items only (`degrade.cjs`).

### Result table (production build of the final code, `verify.cjs --sim`: 40 of 40 pass)

| | Check | Result |
|---|---|---|
| a | Member's Account menu lists the business ("Business · team member") next to their own profile; own profile is still the one active on arrival | PASS |
| a | Member switches with the Switch button; the business becomes active; the menu shows ACTIVE on it and the header names it | PASS |
| a | Member in the business sees its 3 items, its exhibition, and the Team roster (owner + self) | PASS |
| b | Owner clicks Remove on the Team page: roster and database row gone | PASS |
| b | Same open member session, just reload: back on their own profile, business not in the menu, business items not shown, Team and Workspace URLs no longer open, this device's cached copy of the business items and exhibitions forgotten | PASS |
| b | Removed member's data requests (profile, items, exhibitions, roster, roster function) = 0 rows; cannot add an item to it | PASS |
| b | Added again with the Team page: business is back in the same open session, all 3 items load again | PASS |
| c | Unrelated account: no business in the menu, forcing the business id as the active profile falls back to their own, Team and Workspace URLs do not open, guessed-id requests for profile / items / exhibitions / roster / roster function return 0 rows, cannot add itself to the team | PASS |
| d | Owner: Team page with Invite box, Remove / role buttons and the transfer-ownership zone; Workspace Settings opens; business Vault shows the business items only; personal profile shows personal items only | PASS |
| e | Member: no Invite box, no Remove / Make admin, no transfer zone; Workspace, Billing, Profile and Contact settings URLs all go to the Team page; Settings hides Profile and Billing; the identity cards are replaced by a notice; database refuses rename, delete of items, add person, transfer, change of plan columns | PASS |
| f | Member in the business never sees their personal items; back in personal never sees business items; the owner's personal items never appear in the business | PASS |
| g | Signed-out visitor: Vault, Team and Workspace URLs go to sign-in; data requests for the business id return 0 rows | PASS |
| - | Member (re-added) can add an item to the business (the existing member rule) | PASS |

Not browser-tested: the Vault's "move selected items" buttons (changed by reading the code only); admin-role screens (the admin path uses the same list and the existing admin rules; the function itself is proven for admin in Postgres).

### Quality gates
`tsc --noEmit` clean; `eslint` on every changed file: 0 errors (existing warnings only); `next build --webpack` clean; `npm run test:nav` 17/17; `npm run test:isolation` 85/85; `test:delete` 9/9; `test:vault-load` 18/18.

### On the live site (https://vltd.app), after the deploy of 55a49dd
- Polled the live JavaScript until it contained the new code (found on the 14th check, about 2 minutes after the push).
- No simulation, SQL not applied: the member's function call answers 404, they see their own profile only, no error page, own items only. Safe.
- Full table with fresh synthetic accounts, function answer simulated: **40 of 40 pass** (`qa/verify-result-sim.json` is the live run's record).

### Clean-up
All three synthetic accounts, their 4 profiles, 8 items, 1 exhibition and membership rows were removed by exact id. Counts after: Vault items 3,477, auth users 16, public exhibitions 46 (the stated baseline), 0 leftover QA profiles or users, no storage pictures were ever uploaded. The temporary browser folders were deleted.

### What EK must do
1. Open the Supabase SQL editor and run [supabase/migrations/20261103_business_member_profiles.sql](../../supabase/migrations/20261103_business_member_profiles.sql) (code is already live and safe without it; run the SQL any time, order does not matter).
2. Optionally run [supabase/verification/20261103_business_member_profiles_checks.sql](../../supabase/verification/20261103_business_member_profiles_checks.sql) and send back the table (checks 1, 2, 5, 6, 7 should say PASS).
3. Tell the video session to re-run `node docs/repair-2026-11-03/qa/verify.cjs --base=https://vltd.app` (no `--sim`) once the SQL is in: it repeats the whole table against the real function.

## Final verification: real function, nothing simulated (live, after EK applied the SQL)

Fresh synthetic accounts (tag `biz2`: owner with personal + business profile, member, unrelated person), separate isolated browsers, real login form, membership created and removed only with the Team page's Add and Remove buttons. `node docs/repair-2026-11-03/qa/verify.cjs --base=https://vltd.app` (no `--sim`): **45 of 45 pass** (record: `qa/verify-result-live.json`, `sim: false`). Nothing failed that had passed in the simulated round, so no further fix was needed.

Extra checks that only exist with the real function:
- F1: the real `list_member_profiles()` returns exactly the business for the member (role member) and none of the owner-only columns (contact, tax id, billing, user id, AI usage).
- F2: an unrelated account gets an empty list. F3: signed-out (anon) is refused. F4: the owner gets nothing from it (own profiles come from the normal list).
- R9: after the owner clicks Remove, the removed member's real call returns an empty list.
- Before the owner's Add, the member's real call returned an empty list, so the function exists and does not hand out access by itself.

All the table rows (a to g) above hold with the real function: the member finds the business in the Account menu ("Business · team member"), switches with the Switch button, the menu shows ACTIVE, the Vault shows the 3 business items and the Exhibitions page the business exhibition; the owner-only screens and database actions stay refused; the unrelated account is refused including by guessed ids; Remove takes access away in the already-open session after a reload and the device's cached copy is forgotten; Add again brings it back; personal and business collections never mix; signed-out visitors are refused.

Clean-up of the `biz2` fixtures: 3 accounts, 4 profiles, 8 items, 1 exhibition, membership rows removed by exact id; no storage pictures uploaded. Counts after: 3,483 Vault items, 17 auth users, 46 public exhibitions. The 6 extra items and 1 extra account against the 3,477 / 16 baseline are not mine: they are the video session's temporary `qa-jr-…` collector (6 items), still present at that moment.
