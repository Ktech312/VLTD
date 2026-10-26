# Current status (2026-10-26): the one list

This replaces the conflicting session updates. If another status file disagrees, this one is right. Older files are kept unchanged as history: `LIVE-STATUS.md` (to 2026-10-21, now marked superseded), `repair-batch-*/CLOSEOUT.md`, `NAVIGATION-CLOSEOUT.md`, `WISHLIST-PULL-LIST-CLOSEOUT.md`.

## Superseded (do not act on these)
- **Navigation proposals** (the Browse menu, commit `38b3d01`; the visible six-link row, local commit `3892ecc`, never pushed or deployed, kept only as the local branch `nav-visible-wip`): superseded by the header now on `main` (`e1b6285`: Home, Vault, Exhibitions, Insights, More). The six-link row is not to be restored.
- **Events retry-memory proposal and SQL file 8**: withdrawn, not to be run. The memory code in the two old jobs is inert.
- **"Event refresh BLOCKED on credit / needs credit added / runs daily and weekly"** in `LIVE-STATUS.md`, `repair-batch-18/CLOSEOUT.md`, `APP_MAP.md` and `HANDOFF.md`: historical. The daily and weekly jobs are not scheduled; a monthly refresh is (below).
- **The earlier "$0.70 / 24 searches approval"** for the monthly refresh: never given by the owner and removed. The owner's actual authorization is below.

## Completed (deployed on production; commits are on `main`)
| What | Deployed commit | Evidence |
|---|---|---|
| "Universes displayed" no longer filters owned items or totals | `f06c29a` | `repair-batch-18/UNIVERSES-DISPLAYED-REMOVED.md`, RB60 |
| Header search no longer shows a lighter inner box | `b0dcf5b` | |
| Navigation: Home, Vault, Exhibitions, Insights, More (Discover, Events, VLT Lounge, Activity, Learn); Browse removed; Discover public sections | `e1b6285` | `repair-batch-18/NAVIGATION-CLOSEOUT.md`, RB66 (26 of 26 on the second run) |
| Wishlist, Pull List, Following; SQL 9 run by the owner and validated | `5f78db9`, `7aa73d6` | `repair-batch-18/WISHLIST-PULL-LIST-CLOSEOUT.md`, RB67, RB68 final 39 of 39 |
| Cross-account want-id defect (a real app defect) found and fixed | `d97cf1c` | row `ITM-785`; original failure `RB68-043` kept; regression `RB68-078` to `RB68-116` and a unit test |
| Following refuses a series already followed | `bd6c701` | RB68 |
| Daily and weekly Events jobs unscheduled and switched off | `d066a99` | Vercel Cron Jobs page shows only the two monthly entries |
| Paid visitor "Find events" lookup paused; stored-event search and filters untouched | `e829bba` | RB69 (14 of 14 after two check fixes) and 62 events tests |
| Monthly Events refresh on the 1st (12:00 UTC read-only allowance check, 13:00 UTC refresh); once-a-month marker; allowance check; authorization recorded | `724dd88`, `826f210` (temporary read removed), `1f9da26` | `docs/design/events-monthly-refresh-proposal.md`, simulated-service tests; SerpApi read 2026-10-24: Free Plan, 185 of 250 left |
| Labelled links: Collector supplies & services (Marketplace), Kickstarter comics and Patreon comics (Upcoming Comics); More stays highlighted there | `22aed62` | RB73 (43 checks on production), 17 navigation tests |
| Wishlist phone fixes from the visual review: status control 44 px on phones, Pause icon removed, Following cards no longer wider than the screen (a real defect: 486 px on a 390 px phone), long titles truncate at 320 px | `22aed62`, `1555e61`, `9823fad` | RB72 clip scan: before 8 FAIL rows kept, after all PASS; unit test (29 of 29) |
| **AI scans owner-only** (`/api/ai/analyze-item`, `/api/ai/analyze-coa`): every account except the owner's (confirmed `eck1679@gmail.com`) is refused 403 before the request is read and before any lookup, reservation or provider call | `877205d` | RB76 27 of 27 on production (no paid call), 59 simulated-provider tests, 14 every-route gate checks |
| **AI scan routes closed** (`/api/ai/analyze-item`, `/api/ai/analyze-coa`): verified sign-in, profile membership, existing monthly allowance reserved before the provider is called (item, single and certificate scans), image checked from its bytes, browser-side charge removed, duplicate requests spend once (full once SQL package 10 is run), failed provider calls give the scan back (full mode) | `35af705` and the commit after it (see `repair-batch-19/CLOSEOUT.md`) | RB74 (21 live refusal checks), RB75 (browser), 44 simulated-provider tests, 35 in-Postgres SQL checks |
| Batches 1 to 18 of the audit repair programme | see `LIVE-STATUS.md` | per-batch closeouts |

## Added 2026-10-26 (see the closeout in the session; each item below links its evidence)
- **SQL 10 applied** by the owner; production checks RB77 (database, 40 of 40), RB78 (real routes in full mode with a provider stand-in, 23 of 23), RB76 (owner-only, 27 of 27). See `repair-batch-19/CLOSEOUT.md`.
- **Release-to-Wishlist handoff**: six defects fixed (`515c679`), 26 new tests, RB68 re-run on production 39 of 39. See `repair-batch-20/HANDOFF-VERIFICATION.md`. Open there: Remove vs Skip on a followed release; stale dates the source cannot correct.
- **Awaiting owner review (nothing built or published):** the compact Wishlist layout proposal [wishlist-layout-proposal.html](../design/wishlist-layout-proposal.html); the card and toy release-source assessment [release-sources-assessment.md](../design/release-sources-assessment.md) (recommends Scryfall for Magic sets as the one first connection); the redone Tutorial 1 preview (Quick Add and Add Item) in `docs/walkthrough/tutorial-1-redo/`, with its findings in `FINDINGS.md` (none fixed).

QA accounts used in this pass are dropped; production is at the baseline (3,477 vault items, 39 profiles, 47 exhibitions).

## The owner's actual authorization for the monthly Events refresh
Once a month, using the allowances the accounts already have, covering the coming year. No automatic top-ups, no paid overages, no repeated paid retries. **No dollar budget was approved**; any dollar figure is the developer's estimate. The Anthropic balance is **unverified** (it cannot be read without signing in to its console), and the small AI request made before the first search is a paid request that does not prove the balance covers the run.

## Genuinely unresolved
1. **The first real monthly Events result** (due 2026-11-01, 13:00 UTC; the read-only allowance check runs about an hour earlier, Vercel may fire either first). Check it when it runs: searches made, events saved, tokens used. If the Anthropic credit is too low, the small AI request is refused and the run makes no search. Note that the tiny AI request is itself a PAID request and can consume a little credit when it succeeds, so "stops before any search" does not mean "costs nothing".
2. **The Back failure RB66-022** (Home, Insights, Events, Back landed on Home): not reproducible. 45 instrumented runs on production (30 normal, 15 on a slowed device and connection; clicks from 0 ms to 9 s after Home loads) all behaved correctly. The cause of the one original failure cannot be proven (its script and per-step values were not preserved). No app defect confirmed; no code changed. See `repair-batch-6/evidence/rb71-prod1.json` and `rb71b-prod1.json`.
3. **Older open items, unchanged**: Vault item count 3,479 to 3,477 (cause unknown), intermittent blank Vault (not reproduced), slower-device rendering, real-phone checks of the Browse/Account/new header and Discover (the harness emulates a phone), Supabase Free-plan egress (last read 2026-10-12, not re-read), Vercel Hobby storage shown over its allowance on the dashboard (deploys have kept succeeding), signed-in users can read other people's referral codes (owner decision), aliases are not anonymity.
4. **Product questions already put to the owner and still open**: Upcoming Comics "Own" records the cover price as paid; connect Scryfall as a card source; the card scan's Pokemon lookup uses an API ending 2027-03-01; Sell is not on the Vault Wall view.

## Awaiting owner review
1. **Wishlist visual acceptance**: screenshots `docs/audit-2026-10-18/shots/rb72-final-*`, measurements `repair-batch-6/evidence/rb72-final.json`; my assessment is in the "Visual review" section of `repair-batch-18/WISHLIST-PULL-LIST-CLOSEOUT.md` (compact rows and no empty pricing panels hold; details open as a long edit form; an open row follows you to another tab). Functional results (RB67, RB68) are separate and pass.
2. **Styles page** (`/styles`): Apply and Reset work, but five of the six styles change almost nothing visible; not linked from Settings. Decide: build real styles, or retire the page.
3. **SQL package 10: APPLIED by the owner 2026-10-26 (validation all true); production checks RB77 40 of 40, RB78 23 of 23, RB76 27 of 27, see `repair-batch-19/CLOSEOUT.md`. Closed. (Earlier text: corrected for review and HELD)**: [SQL-10-REVIEW.md](repair-batch-19/SQL-10-REVIEW.md); files [10-ai-scan-reservations.sql](repair-batch-19/sql/10-ai-scan-reservations.sql), [validation-10.sql](repair-batch-19/sql/validation-10.sql), [rollback-10.sql](repair-batch-19/sql/rollback-10.sql). The first draft let a member refund their own in-flight scan; refunds and completion are now server-only. The review also found that the monthly allowance counter has not been moving for ordinary members (a billing-column trigger undoes it); the server now moves it as the service role (live), and this SQL makes the status read read-only. Please review before it is run.
4. **Automatic usage without an established authorization or cap** (see `AUTOMATIC-USAGE-INVENTORY.md`): the direct-message push trigger, club-post cross-posting triggers (Reddit marked unverified) and browser polling against Supabase.
