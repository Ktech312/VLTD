# Business member access: cause, fix, verification (2026-11-03)

Status: **code fixed and checked. One small SQL file must be run by hand to switch the new access on** (see "What EK must do"). Until it is run the app behaves exactly as before for team members (nothing breaks, they just still do not see the business).

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

See the results section at the end of this file (filled in from the verification runs).
