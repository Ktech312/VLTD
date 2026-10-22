# Live status (updated as work completes; a checkpoint is not a request to stop)

Last updated: 2026-10-21.

## Waiting on you
Nothing. All five SQL files were run and verified on production (2026-10-21, `repair-batch-17/CLOSEOUT.md`); every root cause is closed.

## Done and verified on production
- Batches 1 to 4 and the batch-4 gap closure (see their CLOSEOUT files); RB10-024 (Vault card value box).
- RC-05: alias and shelf-style persistence, honest Announce / Make public messages, event privacy (stage 1), sanitised view and link responses (stage 2), public-view consumers and cache ownership (stage 3, all nine consumers including the admin page, verified with a disposable QA admin, role and factor removed and verified).
- **Batch 6 (2026-10-20)**: RC-04, RC-07, RC-08, RC-28, RC-33 closed and re-tested on production, 21 of 21 checks (`repair-batch-6/CLOSEOUT.md`).
- **Batch 7 (2026-10-20)**: RC-13, RC-14, RC-15 closed; RC-12 and RC-11 code halves shipped; all re-tested on production (`repair-batch-7/CLOSEOUT.md`).
- **Batch 8 (2026-10-20)**: RC-16 (silent camera / image / PSA failures) 14 of 16 rows closed and re-tested on production (`repair-batch-8/CLOSEOUT.md`).
- **Batch 9 (2026-10-21)**: RC-21 closed (26 of 26 rows: a failed load is never shown as an empty collection); RC-20 plain Goals defects closed (10 of 22; the rest needs explicit goal types, a decision). `repair-batch-9/CLOSEOUT.md`.
- **Batch 10 (2026-10-21)**: RC-22 closed (direct loads in a clean browser show the account's data; exports never empty). `repair-batch-10/CLOSEOUT.md`.
- **Batch 11 (2026-10-21)**: RC-23 13 of 15 rows closed on production (Watchlist numbers, Market seller/link/sort/pills, Favorites/Discover counts); the Market asking price needs SQL file 2.
- **Batch 12 (2026-10-21)**: RC-25 6 of 7 and RC-27 8 of 12 rows closed on production (gain sort, Halls, Upcoming, invites, Messages, bid history); view counter needs SQL file 3.
- **Batch 13 (2026-10-21)**: RC-24 15 of 16 and RC-26 19 of 24 rows closed on production (links lead somewhere real, buttons do what they say) (`repair-batch-13/CLOSEOUT.md`).
- **Batch 14 (2026-10-21)**: RC-30 closed; RC-29 10 of 12, RC-32 8 of 9, RC-34 7 of 8 rows closed on production (Close/Escape, empty results, setup notice, Lounge dates, no emoji on Shop) (`repair-batch-14/CLOSEOUT.md`).
- **Batch 16 (2026-10-21)**: insurance exclusions follow the account (code live, tests 25 of 25, production device-only path 8 of 8; SQL file 6 waiting) and Cancel in the crop step discards a just-chosen photo (`repair-batch-16/CLOSEOUT.md`).
- **Batch 15 (2026-10-21)**: RC-05 stage 4 verified (20 of 20 + 41 of 41); your decisions applied; the held SQL corrected; the phone pass (RC-31) and the Insurance count rows verified (`repair-batch-15/CLOSEOUT.md`).
- **Batch 18 (2026-10-21)**: banner and events pass verified on production (`repair-batch-18/CLOSEOUT.md`): seasonal theme recolors the app, one fixed-size banner with artwork, 15 s rotation, drag/swipe, one clickable Seasonal theme line; event refreshes fixed and tested; LA Comic Con on the maintained list. LA Comic Con featured and on the banner (2026-10-22). Waiting on you: run repair-batch-18/sql/7-events-visible-through-local-last-evening.sql, a real-phone check, and (optional, costs about $0.10) one manual Run of the daily refresh to verify it end to end.
- **Batch 17 (2026-10-21)**: SQL files 1 to 5 verified on production: scan security and allowances, avatar uploads, Market asking prices, exhibition view counting, goal type across browsers, account-synced insurance exclusions (`repair-batch-17/CLOSEOUT.md`). All root causes closed.
- `test:isolation` repaired (real network-failure rule and the goal rules module wired into the test; 85 checks pass, assertions unchanged).


## Cleanup (2026-10-21)
QA fixture `rb24` dropped by exact manifest ids; recount after 20 s: 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 0 activity events / 0 QA-named profiles = baseline. Scratch credentials file removed. A new fixture is created when the SQL re-checks run.

## Cleanup (2026-10-21, batch 15)
QA fixture `rb48` dropped by exact manifest ids; recount: 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 0 activity events / 0 QA-named profiles = baseline. The temporary goals, watch entry and Universes displayed setting used in the checks were restored or removed by the scripts. Scratch credentials file removed (`qa/env.cjs` is just a parse of `.env.local`; recreate it before creating a new fixture).

## Cleanup (2026-10-21, batch 16)
QA fixture `rb55` dropped by exact manifest ids; recount: 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 0 activity events / 0 QA-named profiles = baseline. Scratch credentials file removed again.

## Cleanup (2026-10-21, batch 17)
QA fixture `rb56` dropped by exact manifest ids; recount: 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 0 activity events / 0 QA-named profiles = baseline. No leftover QA rows in goals, wishlist, exhibitions or insurance exclusions; the avatar test object was removed and the profile's avatar restored. Scratch credentials file removed.
