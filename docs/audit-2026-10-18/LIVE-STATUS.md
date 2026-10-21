# Live status (updated as work completes; a checkpoint is not a request to stop)

Last updated: 2026-10-21.

## Waiting on you (external SQL, four ready files in one run order: [SQL-RUN-ME.md](repair-batch-6/SQL-RUN-ME.md); everything else is done)
- **File 1 first: scan allowance + avatar upload (RC-10, RC-11) and a hole in the live allowance functions** (anyone with no session could read and spend any profile's allowance). **File 2** Market asking price (RC-23), **file 3** exhibition view counter (RC-27, approximate and inflatable), **file 4** goal type and unit (optional; the site works without it).
- **Decisions for you:** GIN-095 (account-wide insurance exclusions: proposal and SQL ready, [PROPOSAL-insurance-exclusions.md](repair-batch-15/PROPOSAL-insurance-exclusions.md)); ADD-168 (should Cancel in the crop step discard the photo you just chose?).

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
- **Batch 15 (2026-10-21)**: RC-05 stage 4 verified (20 of 20 + 41 of 41); your decisions applied; the held SQL corrected; the phone pass (RC-31) and the Insurance count rows verified (`repair-batch-15/CLOSEOUT.md`).
- `test:isolation` repaired (real network-failure rule and the goal rules module wired into the test; 85 checks pass, assertions unchanged).

## Queue (order: data loss / private exposure / false "saved", then Insurance and core workflows, then figures / search / filters / misleading actions, then navigation and interaction, then cosmetics)
See `root-causes.json` for IDs; each batch below gets its own CLOSEOUT.

## Cleanup (2026-10-21)
QA fixture `rb24` dropped by exact manifest ids; recount after 20 s: 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 0 activity events / 0 QA-named profiles = baseline. Scratch credentials file removed. A new fixture is created when the SQL re-checks run.
