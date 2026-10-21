# Batch 7 closeout (core workflows: search, palette, install pill, phone exhibitions sheet, leaderboards), 2026-10-20

On production (commits `065f152`, `baac35b`, `62df159`, `d046ae6`), re-tested there with the isolated QA fixture. Scripts live in `repair-batch-6/scripts/` (`rb25-leaderboard-bulk.cjs`, `rb27-search-banner-sheet.cjs`; rows RB25, RB27). First-run failures are kept as before-fix evidence; test mistakes have correction rows (RB25-001/003/004).

| ID | What changed | Production check (final run) |
|---|---|---|
| RC-12 (partly) | Subject leaderboards call `get_subject_leaderboard` with `p_subject` / `p_limit` (also the Lounge preview); a failed load says "Couldn't load this leaderboard" with Try again, not "No public collectors". | RB25-006..009 |
| RC-13 | The Vault follows `?q=`; the header sends the whole typed text as the search (it used to peel off words like "comic" or "psa" into URL filters the Vault never read); no match says "No items match"; the palette offers 19 main pages by name, ranks a name match above a subtitle match and puts the best match first, and item commands open the item page; every item is searchable (it was only the 24 highest-value ones). | RB27-033..037 (header Album 17 shows one card; no-match message; 11 page names found; 'goals' + Enter opens /goals; 'Album 17' + Enter opens the item) |
| RC-14 | Install pill hidden on `/vault/quick` and `/vault/bulk`; pages scroll 72px further while it shows (app scroller, public home footer). | RB27-045..048 |
| RC-15 | Phone exhibitions details sheet starts closed, opens on card tap, has Close; wide screens unchanged. | RB27-038..044 |
| RC-11 (code half) | Bulk says "Couldn't check your AI scan allowance, so AI scanning is paused" instead of "You've used all your AI scans" when the allowance was never read; no AI call is made. | RB25-010 |

## Waiting on you (one file)
RC-11 (cause in the database) and RC-10 (avatar upload) need [the batch 6 SQL](repair-batch-6/SQL-RUN-ME.md). Tested locally 23 of 23 (apply, re-run, validation, rollback); not applied. A production verification script is ready (`rb26-sql-verify.cjs`).

## Limits and decisions
- DIS-341 ("View full leaderboard" opens Discover): left as is; there is no leaderboard page, so the destination is a product decision.
- The install pill is hidden on the two camera/bulk screens rather than moved; it shows on other pages. The phone item page was not separately tapped (desktop item page and phone landing page were).
- With the allowance unreadable, Capture and Quick Add still let an AI scan run unmetered (existing behaviour, unchanged); after the SQL the read works for every profile.
