# RC-05 migration proposal (HELD: nothing here has been run)

Status: for review. No SQL has been applied to the account by me. Each file below is plain SQL for you to run by hand in the Supabase SQL editor, in this order. Every file is safe to run twice and changes no data.

## What was inspected (and how)
I cannot read `pg_policies` from outside the account, so the live rules were established two ways, on production with throwaway QA data:
1. **Behaviour probes** (signed-in owner, signed-out visitor): `repair-batch-5/evidence/rb12-rc05-fourth-before.json` ("probes" block).
2. **The repo's own migrations**, which define the rules that should be in force (`20260601_public_galleries_read.sql`, `20260707_profile_members.sql`, `20260927_fix_galleries_owner_select_policy.sql`, `20260622_exhibition_events.sql`, `20260823_fix_exhibition_events_team_check.sql`).

File `0-inspect-read-only.sql` prints the actual policies and column grants so the assumptions can be checked before anything is changed.

## Findings (all on production, QA data)
| # | Finding | Evidence |
|---|---|---|
| F-1 | The profile's owner (a row exists in `profile_members`) is **refused** when inserting into `exhibition_events` (42501). Using the owner's auth id as the profile id fails on the **foreign key** (23503) instead, which can only happen if the old rule `auth.uid() = profile_id` is still the rule. So `20260823_fix_exhibition_events_team_check.sql` was never applied. | probes `ownerInsertForOwnProfile`, `ownerInsertWithAuthUidAsProfile`; row RB12-015 (blocked) |
| F-2 | A signed-out visitor reading a public exhibition that uses an alias receives the real `profile_id` (and every other column, `select=*`). The table has one public read rule (`visibility = PUBLIC and state = ACTIVE`) and column grants that include `profile_id`. | probe `anonReadsAliasExhibition`; row RB12-016 (blocked) |
| F-3 | `exhibition_events` is readable by everyone and every row carries `profile_id`, so once events can be written, the events of an alias exhibition would reveal the real profile. Today the table is empty (0 rows) because nobody can write to it. | recount: `events_left: 0` |
| F-4 | There is no `public_galleries` view (PGRST205). | probes `anonRelation_*` |

## Files (run in this order)
| Step | File | Fixes | Needs a decision? |
|---|---|---|---|
| 0 | [0-inspect-read-only.sql](sql/0-inspect-read-only.sql) | nothing (read only): shows policies and grants | no |
| 1 | [1-exhibition-events-members-insert.sql](sql/1-exhibition-events-members-insert.sql) | F-1: Announce and the follower notice on Make public can be recorded by the profile's members | no (this is the already-written 20260823 fix) |
| 1b | [1b-exhibition-events-hide-alias-optional.sql](sql/1b-exhibition-events-hide-alias-optional.sql) | F-3: events of alias exhibitions stop being public | **yes, D2 below** |
| 2 | [2-public-galleries-view-step1.sql](sql/2-public-galleries-view-step1.sql) | F-2 step 1: a public view with `profile_id` NULL for alias exhibitions | no |
| 3 | [3-galleries-public-read-non-alias-step2.sql](sql/3-galleries-public-read-non-alias-step2.sql) | F-2 step 2: the table's public rule stops returning alias exhibitions | no, but only after step 2 AND the site reads the view |

Decisions for you:
- **D1 order.** Step 1 is independent and can go first. Steps 2 then 3 are the profile-id fix; step 3 must wait until the site code that reads `public_galleries` is deployed (see "Code dependency").
- **D2 alias exhibitions and the follower feed.** With step 1 applied, announcements/publishes of an alias exhibition would appear in the real collector's followers' feed under the real name (the feed has no alias guard). Either apply 1b with step 1 (followers never see alias exhibitions' events) or tell me to add a feed guard in code first. Do not apply step 1 alone if alias exhibitions must stay unlinked.

## Validation
Run locally before this proposal (real Postgres in-process, synthetic data, as signed-out visitor, signed-in non-member and member): `repair-batch-5/scripts/test-rc05-sql-in-postgres.cjs`, output `repair-batch-5/evidence/rc05-sql-local-postgres.log`: **25 passed, 0 failed**. It reproduces today's behaviour first (anon gets `profile_id`; member insert refused 42501; auth-uid probe 23503) and then checks after each file: member can insert, non-member and visitor cannot; the view returns only public + active exhibitions with `profile_id` NULL for aliases and every column of the table; after step 3 the table no longer returns alias exhibitions to visitors or non-members while the profile's own members still see all theirs; step 3 stops (and changes nothing) if it cannot identify exactly one public rule; each file runs twice.

On production after applying (re-run `repair-batch-5/scripts/rb12-rc05.cjs <label> after` with a fresh QA fixture; I will do this on your word):
| Check | Before | Expected after |
|---|---|---|
| Owner inserts a follower notice | refused 42501 | accepted (step 1) |
| Announce / Make public with the account accepting | message "not announced / followers not notified" | "✓ Announced", one row in `exhibition_events` |
| Visitor reads an alias exhibition from the table | `profile_id` returned | row not returned (step 3) |
| Visitor reads it from `public_galleries` | no such view | row returned, `profile_id` NULL (step 2) |
| Discover, guest view, share links, profile page query | work | still work (must be re-checked with the code below) |

## Code dependency (prepared, not deployed)
Steps 2 and 3 need public pages to read `public_galleries`: Discover (`src/app/discover/page.tsx`), the guest view (`src/app/museum/[galleryId]/guest/page.tsx`), `fetchGalleryFromSupabaseById` in `src/lib/galleryModel.ts`, `lounge-preview`, and the profile page query. After step 3 an alias exhibition is no longer returned by the table for visitors, so these consumers must prefer the view (fall back to the table when the view does not exist, as the items view already does). I did not ship that change: it cannot be exercised end to end until the view exists, and shipping it before review would be untested code on public discovery. When you approve steps 2 and 3 I will ship it with the fallback first, then you run step 2, I verify, then step 3, I verify again.

## What this does NOT claim
An alias hides the curator's name and avatar on that exhibition. It does not make the exhibition anonymous: the same items, descriptions and photos can still be matched across exhibitions and with the real vault. That separate limitation remains and is not addressed by any file here.
