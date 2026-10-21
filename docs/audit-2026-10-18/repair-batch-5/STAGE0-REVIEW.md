# Stage-0 review: production's actual configuration (output received 2026-10-21 02:19 UTC)

Source: the single-result inspection query, run by you on production. Copy kept in `evidence/stage0-production-output-2026-10-21.json` (whitespace compacted; content unchanged). The 76 local checks show the SQL behaves as designed on the schema I assumed; **this review is what confirms production has that schema.**

## Verdict
Production matches every assumption the package makes. **Stage 1 is cleared to run.** Stages 2 and 4 have their prerequisites confirmed but are not authorised yet: they follow the staged order (stage 1 verified, then 2, then the deployed and verified consumers, and only then 4). Nothing has been run by me.

## Item by item
| Check | Production shows | Matches? | Consequence |
|---|---|---|---|
| Row security | on for `galleries`, `gallery_items`, `gallery_invites`, `exhibition_events`, none forced | yes | as assumed |
| `exhibition_events` rules | exactly two: "Public read exhibition_events" (SELECT, everyone, `true`) and "Owner insert exhibition_events" (INSERT, `auth.uid() = profile_id`); 0 rows | yes | step 1's guard passes (it refuses only unknown rules); event privacy is a straight replacement, no data to reconcile |
| `galleries` rules | public read (PUBLIC + ACTIVE), `galleries_select_member`, `galleries_insert_member`, `galleries_update_member`, `galleries_delete_manager`; nothing else permissive | yes | step 4 finds exactly one public SELECT rule; member rules stay |
| `gallery_items` rules | `gallery_items_read_public` (sub-query on `galleries`, anon + authenticated), `gallery_items_read_member`, `gallery_items_write_member` | yes | confirms the dependency: step 4 must rewrite `gallery_items_read_public` first (it does) |
| `gallery_invites` | member-managed only | yes | unaffected |
| Column grants of note | anon and authenticated can select `profile_id`, `item_notes`, `analytics_unique_view_keys` on `galleries`; both roles can select `profile_id` on events | yes | confirms F-2 / F-3; the view is the only way to withhold them |
| Link functions | present, security definer; `gallery_public_row` executable only by `postgres` / `service_role`; share / invite functions executable by anon and signed-in | yes | 20261018 is applied |
| `gallery_public_row` body | exactly the 20261018 version (removes visitor keys and an alias's profile id; still returns notes, layout JSON and last-viewed time) | yes | step 2 replaces it with the sanitising version; `rollback-2.sql` restores this body |
| `get_gallery_by_share_token` body | as 20261018 | yes | unchanged by the package (it calls the helper) |
| Triggers | `trg_enforce_gallery_limit` (insert on galleries), `gallery_items_same_profile` (insert/update on gallery_items); none on events | yes | `enforce_gallery_limit` is `security definer` (read from its migration source) so closing the public read does not affect it; the item trigger runs as the signed-in member who can read their own exhibitions |
| Other readers of `galleries` | only the member rules above and `gallery_items_read_public`; no view mentions galleries | yes | step 4 affects exactly one other rule |
| `public_galleries` view | absent | yes | step 2 creates it |
| Data | 47 exhibitions: 44 public without alias, 2 public with alias, 1 guest-only (INVITE) with alias; 0 events; 0 exhibitions with an account id in a public column | yes | matches my earlier scan; the guest-only alias exhibition is already covered by the link function's profile-id rule and is outside the view (not public) |

## What the output added (not in my assumptions)
1. **Broad table privileges.** `anon` and `authenticated` hold every privilege (including DELETE, INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES) on `galleries`, `gallery_items` and `exhibition_events`. Today only the row rules stand between a visitor and a write, and TRUNCATE is not covered by row rules (the web API does not offer it, so it is not reachable from the site). I extended step 1 to remove the unnecessary privileges **on `exhibition_events`** (insert for visitors, update/delete/truncate/references/trigger for both roles) and made `rollback-1.sql` restore the original grants. I did **not** touch `galleries` or `gallery_items` grants: that is outside this package. Recorded as a separate hardening finding for your decision.
2. **Visitor view counting cannot persist.** There is no UPDATE rule for non-members on `galleries`, so a visitor's counter write changes nothing (consistent with only 7 visitor keys in total). Confirmed from the rules, not by a test. Not part of this package.
3. **Free-tier exhibitions are always PUBLIC** (the limit trigger coerces them), which is why 46 of 47 are public; it does not affect the package.

## One consequence you must accept before running stage 1
The events table has **never been writable** in production (0 rows). After stage 1 the site's existing code starts recording real events: every time any user makes an exhibition public, and every time any user presses Announce, a row is written. Followers of that profile will see public, alias-free events in their feed. That is the designed feature switching on for the first time, not something I added; alias, private, guest-only and draft exhibitions never appear. If you want it switched on later, run stage 1 later: nothing else depends on it.

## Authorised now
- **Stage 1** (`sql/1-events-authorization-and-privacy.sql`; one transaction; rollback `sql/rollback-1.sql`), then the stage-1 block of `sql/validation-stage1.sql`, `validation-stage2.sql`, `validation-stage4.sql` with the output sent to me. I then run the two-account production checks on isolated QA content (0 followers, nothing reaches a real person).

## Not authorised yet
- Stage 2 (view and link sanitising): after stage 1 is verified.
- Stage 3 (site change): I deploy it after stage 2 and verify the nine consumers (section 6b of the proposal).
- Stage 4 (close the old table read): only after every required consumer is verified; I will say so explicitly.
