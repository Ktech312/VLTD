# Batch 18 closeout: banner and events pass (2026-10-21)

Live on production (pushed as `9756d2b`, `a460fca`, `f638937`). Nothing of yours was changed except the empty picture slots of 21 catalogue events (below). The QA fixture `bnr` is dropped and production is back to 3,477 items, 39 profiles, 47 exhibitions, 3 sales, 907 events (744 upcoming), no QA rows.

## What was wrong, found on production before any fix
- **The seasonal theme did nothing visible.** Pressing Yes set the theme's name, but the app's gold colour stayed platinum and 0 elements changed colour (RB59 before-run). The app's own theme code writes its colours directly on the page, which beats the seasonal stylesheet rule, so that rule could never win. Fixed: the seasonal colours are now laid over the base ones (and the base theme puts itself back when it is turned off).
- **The banner changed size.** 91 to 95 px on an undecided theme slide, 55.5 px on every event slide, so everything below moved about 40 px.
- **The ten events could never include a major convention.** Production had 744 upcoming events, none featured, and the banner took "the ten that start first": 128 events start before LA Comic Con.
- **The scheduled refreshes have saved almost nothing.** Only two events were ever created by something other than the manual importers (Aug 25 and Oct 7), and none by the refreshes since Oct 8.

## Results on the deployed site (browser run RB61, isolated QA account; `repair-batch-6/scripts/rb61-banner-visual.cjs`)
| Check | Result |
|---|---|
| Artwork | 8 of 11 slides show the event's own picture, every picture loads; the 3 without one (the seasonal slide and two events) use the plain fallback card |
| Size | Card is 72 px high on every slide at 1440 px (1044 wide) and at 390 px (354 wide); the Collection overview stays at the same position across all 11 slides and through every switch and drag |
| Seasonal theme control | The small palette line ("Seasonal theme on / off", the one from your picture 2) now sits right-aligned under the banner, above the Collection overview, and is clickable. "Switch app theme?", Yes/No, the separate "on" label and "Back to normal" are gone. It starts Off; On changes the colours (128 elements) and survives slide changes, reload and other pages; Off puts the platinum back with nothing left over and survives reload. An older stored "Yes" shows as On |
| Automatic rotation | Changes at 14.9, 29.9 and 44.8 s (every 15 s) through 4 slides; after clicking Next 11 s into a cycle the next automatic change came 15.9 s later (timer restarted); rotation continued after using the control |
| Arrows, dots | Work and wrap, on both sizes |
| Drag and swipe | Mouse drag at 1440 px and a finger swipe at 390 px move next/previous both ways and wrap; a drag never opens the event; a vertical finger drag that starts on the banner scrolls the page (0 to 406 px) without changing the slide or opening anything |
| Links | Seasonal button opens /discover; event button and a click or tap on the event open /events |

**Browser-emulated, not a physical phone.** The touch results use Chrome's touch emulation. I have not tried a real phone; do one swipe, one vertical scroll starting on the banner, and one tap on a real device.

## Trace of the automatic events (schedule to banner)
- **Schedule:** `vercel.json` runs `/api/cron/refresh-events` daily 13:00 UTC and `/api/cron/refresh-major-events` Mondays 14:00 UTC; both answer 401 without the secret, so the secret is set in production.
- **Why it saved nothing, as far as can be shown from here.** I could not read Vercel's run logs and cannot run the jobs (no keys here, and a real run spends SerpApi and AI credit), so the exact cause on production is **not proven**. What I could prove: a bulk save that names one event twice is rejected whole by the database. Captured on production with a QA row, then removed: `ON CONFLICT DO UPDATE command cannot affect row a second time`, 0 rows saved from that batch (`evidence/dup-slug-upsert-production.json`). The daily job collects the same event from several searches and from two sources, so that is very likely. Also found by reading: every search, AI and save failure was swallowed and the job still answered 200; there was no time limit set for a run that makes a dozen searches plus an AI call one after another.
- **Fixed:** repeats inside a run are merged; the same event already in the table under another spelling or slug (the importers') is updated, not copied; one bad row no longer sinks the rest; a refresh never blanks a field, re-enables a disabled event or replaces a picture; a dead source, an AI failure or a failed save now returns an error status and a log line; searches run side by side with a 60 s limit; dates from the AI are accepted only if real, not already over and a sensible length.
- **Tests** (`npm run test:events`, 26 of 26): the real route handlers against a pretend internet and a pretend table, including the cases above, the weekly job, the banner's ten, the date rules and the theme layering. A real run on production is still the one thing not shown; the first Monday run (Oct 26) will show in Vercel's logs as `[refresh-major-events]` with an `ok` flag.
- **Date filters:** events are stored as calendar days at midnight/23:59:59 UTC, so a US event showed "Happening now!" the evening before it started and counted as over late on its last day. The banner now reads them as your calendar days. **Not fixed, needs your call:** the database hides an event after 23:59:59 UTC on its last day (about 5 pm Pacific), and the Events page filters the same way; fixing it means a one-line change to the read policy plus the Events page, which I have not made.
- **The ten:** featured events first (at most 6, starting within 60 days), then the nearest, 10 in all, shown in date order, past ones dropped.

## LA Comic Con
- **Official dates confirmed** on comicconla.com: Oct 30 to Nov 1, 2026, Los Angeles Convention Center. The same dates are already on production (from the manual importer, `freshcomics-la-comic-con-2026`, spelled "L.A. Comic Con").
- **Added to the maintained list** (`lib/events/majorShows.ts`). In the tests the real weekly job turns the official snippets into exactly those dates, featured, with its universes, and updates the existing row instead of adding a second one (name and Disabled kept).
- **Not yet in the banner on production**, and I did not change that: nothing is featured there yet, and LA Comic Con is not among the nearest events. It gets in once the Monday Oct 26 run succeeds, or **now if you press Featured on it in Admin > Events** (or tell me to set that one flag).
- Shows on that list are saved as Featured every week, so un-featuring one by hand is undone; to take one off the banner's priority, remove it from the list.

## Artwork (new)
Almost no event had a picture (1 of 744). The daily refresh now also looks at each banner event's own website for the share image its organiser publishes, checks it really is an image, and fills the empty slot only. I ran it once now: 21 events filled (list in `evidence/event-art-backfill-1.json`; undo = set those 21 `image_url` back to empty). **These are links to the organisers' pictures, not copies:** no storage used, but a picture stops showing if its owner moves or removes it, and the banner then shows its plain fallback. The Events page also shows these pictures now.

## Things to know
- Event slides are 16 px taller than before (72 against 55.5); with the new control line the content below sits about 30 px lower than it did on an event slide.
- On a phone the seasonal slide's title is cut ("Trick or Tr…") because its button is wide; that was already so and I did not change it.
- The red "?" in your earlier screenshot sat by the "Universes displayed" notice, which has since been removed (separate note in this folder).
- Test mistakes superseded by correction rows (ITM-759 to 761): the check compared Home's address with "/" (Home is /dashboard) and read the window's scroll instead of the page's scroll box. Real failures kept: RB61-007 and RB61-030 (the first, toggle-style control sat 32 px in from the banner's right edge; redone as the small line, which passes), RB59 before-run (the defects above). RB59's "after" run was cut short by my own change of design; RB61 replaces it.

---

# Finishing pass (2026-10-22)

Live: `81a2085` and `8c4c9c8`. Browser run RB62 (15 of 15, `repair-batch-6/scripts/rb62-la-comic-con-banner.cjs`); fixture dropped, production back to 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 907 events.

## Done and checked on the live site
- **LA Comic Con is featured and on the banner.** I set Featured on its one existing row (`freshcomics-la-comic-con-2026`; record in `evidence/la-comic-con-featured.json`; undo = turn Featured off). On the live banner it is slide 11 of 11 (the banner is in date order and it starts last), at desktop and phone width:
  - **Artwork:** its official title graphic (from comicconla.com) loads. It is black lettering on a transparent background, which disappears on the dark banner, so graphics like that are now shown on a light card with dark words (same size and layout). This applies to every transparent-PNG logo (5 events today); photos still fill the card behind the words.
  - **Dates:** "Starts in 8 days — Los Angeles, CA", and the Events page shows Oct 30 - Nov 1, 2026.
  - **Destination:** the button and a click on the slide now open that event on the Events page (`/events?highlight=<event>`), not the generic list.
- **Phone title:** the seasonal button was too wide for the title. The button is now narrower and wraps onto two lines, event titles may use two lines on a phone, and "Trick or Treat" shows in full. The card is still 72 px high on every slide (checked at 390 px). The small line under the title ("Starts in 8 days — …") is still shortened on a phone.
- **Expiry in the event's own time zone (code, tested; live on the site).** An event now counts as over at local midnight at the end of its last day, in the zone its place names (state, province or country; 29 US/Canada/other zones covered). An LA event is on at 8 pm and 11:59 pm Pacific on Nov 1 and over at 00:01 on Nov 2; Miami, Honolulu and London likewise; an event whose place does not name a zone uses the viewer's calendar. Both the banner and the Events page use it. Tested with fixed instants in `npm run test:events` (30 of 30), not by waiting for Nov 1.

## Not finished: needs you, or cannot be checked yet
1. **Run `repair-batch-18/sql/7-events-visible-through-local-last-evening.sql`** ([file](sql/7-events-visible-through-local-last-evening.sql), then [validation-7.sql](sql/validation-7.sql); undo with [rollback-7.sql](sql/rollback-7.sql)). Until it runs, the database still hides an event at 23:59:59 UTC on its last day (about 5 pm Pacific), so an LA event still disappears at 5 pm on Nov 1 whatever the pages do. The file only widens the read rule by 12 hours (no event row is touched); tested 5 of 5 in a local Postgres (`repair-batch-18/scripts/test-sql7-in-postgres.cjs`). The real check is the evening of Nov 1 Pacific: the LA Comic Con slide should still be there until midnight.
2. **The production refresh is not verified end to end.** What I could read from your Vercel dashboard (Hobby plan; request logs there are kept for one hour, so the older runs are gone):
   - The daily job `/api/cron/refresh-events` ran **once** in the last day (today, 13:00 UTC window) with an **error rate of 100%**, about 1 minute long, and only 1.7 s of active CPU. That means it spent its time waiting on outside services and then either hit the 60 s limit or returned an error; I cannot tell which, because the log lines are gone. That run was already on my first rewrite (which still did the picture lookups inside the run), so it may be my own change that pushed it over the limit.
   - **Fixed since:** the picture lookups now run after the response is sent, every outside request has its own limit (SerpApi 15 s, Ticketmaster 8 s, AI 25 s), and the response and the log line now say where the time went (`timingMs`) and how many events were saved. These are in `8c4c9c8`.
   - The weekly job did not run in the window (next run Mon Oct 26 14:00 UTC), so nothing is known about it from production.
   - **Remaining blocker, a real run costs money, so I did not do it.** To check it now: Vercel > vltd > Settings > Cron Jobs > **Run** beside `/api/cron/refresh-events`, then open Logs within the hour and look for the `[refresh-events]` line. Cost: 6 SerpApi searches (about 6 of your monthly searches; roughly $0.09 if billed at $0.015 each, nothing if inside a free allowance) plus one Haiku call (about $0.01); Ticketmaster is free. The weekly job (**Run** beside `/api/cron/refresh-major-events`) is 20 searches plus one Haiku call, about $0.30. Without that, the next daily run tomorrow (13:00 to 14:00 UTC) will show in Vercel > Observability > Cron Jobs / Vercel Functions: an error rate of 0% there is the sign it works.
   - **Kept separate:** the simulated route tests (`npm run test:events`, 30 of 30) run the real handlers against a pretend internet and table; they are not a production run. The one real production fact I have for the daily job is the error rate above, plus the earlier duplicate-slug rejection captured on the real database.
3. **A real phone** for swipe, vertical scroll and tap (all touch results so far are Chrome's emulation).

## Small things to know
- Pictures are classified (photo or graphic) once the daily job has seen the event; a brand-new event that enters the banner before that is treated as a photo for up to a day.
- Event pictures I filled are links to the organisers' own images (37 events now have one): they stop showing if the organiser removes the file, and the banner then shows its plain fallback.
- Shows on the maintained list are saved Featured every week; LA Comic Con's Featured flag was set by hand today and the weekly run will keep it.

---

# Final status after SQL file 7 (2026-10-22)

You ran file 7 and both validation values read true. Commit `b9d1233`. Checks: RB63 (`repair-batch-6/scripts/rb63-final-evening-expiry.cjs`, fourth run 12 of 12). Fixture dropped; production back to 3,477 items / 39 profiles / 47 exhibitions / 3 sales / 907 events (744 upcoming), no QA rows left.

## Synthetic production checks (what "synthetic" means here)
- **Database read rule, real production database, public key:** short-lived QA rows that ended 1, 9, 11 and 13 hours ago, a disabled one and a future one. Readable: 1 h, 9 h, 11 h and the future one. Hidden: 13 h and the disabled one. So the rule holds the 12-hour margin and no more. The rows are far in the past with real end times (no page ever showed them) and were deleted by exact slug.
- **Page logic, live site, browser clock moved** (the answer of the events table topped up in the browser only with QA events in Los Angeles, Miami, Honolulu and London; nothing written for real users; the real LA Comic Con row is read as it is):
  - 8 pm Pacific on Nov 1: the real LA Comic Con and the LA, Miami and Honolulu events are on the banner and read "Happening now!"; London's is gone.
  - 11:59 pm Pacific: LA and Honolulu still on, Miami gone.
  - 00:01 on Nov 2 Pacific: both LA events gone, Honolulu still on; 00:01 in Honolulu: gone.
  - Local-midnight start: at 11:30 pm Oct 29 Pacific LA Comic Con has not started; at 00:30 Oct 30 it is "Happening now!".
  - Events page at the same instants: lists LA at 8 pm, not at 00:01; Honolulu still listed.
- **A real bug found by this and fixed:** with the 12-hour margin, the Events page chose its default "Featured event" before checking whether it was over in its own zone, so LA Comic Con would have stayed on show as the featured event until about noon UTC on Nov 2. It now picks from events that are not over in their own zone (RB63-012 and RB63-024 stay recorded as failures; RB63-036 and RB63-048 pass).
- **Test mistakes superseded** (ITM-762): the first three runs could not see the banner because the moved clock made the stored sign-in look expired and signed the test account out; the harness now keeps the sign-in valid under the moved clock.
- **Not shown:** the real evening of Nov 1. The clock was moved for the pages; the database rule was checked at today's real time with rows that had already ended. Watch the LA Comic Con slide that evening: it should be on until midnight Pacific.

## Still open
1. **Automatic event refresh: open.** Nothing in production has confirmed a run that processed and saved events. What is known: today's daily run (13:00 UTC window, already on my first rewrite) showed a 100% error rate, about 1 minute, on Vercel. The fixes (picture lookups after the response, a time limit on every outside request, timings and counts in the response and log) are live since `8c4c9c8`. The next scheduled run is the daily one tomorrow in the 13:00 to 14:00 UTC window; the weekly one is Mon Oct 26, 14:00 UTC. It is confirmed only when Vercel > Observability > Cron Jobs / Vercel Functions shows that route with an error rate of 0%, and the `[refresh-events]` log line (read within the hour) shows `inserted` or `updated` above 0. To do it now: **Run** beside `/api/cron/refresh-events` in Vercel > Settings > Cron Jobs; about $0.10 (6 SerpApi searches plus one Haiku call; free inside a search allowance). Weekly job, about $0.30. Not run, because it spends credits.
2. **A real phone** for swipe, vertical scroll and tap.
3. **Nov 1 evening** observation of LA Comic Con (above).

## Cleanup done
QA fixtures `bnr`, `bnr2` and `bnr3` dropped; QA events and read-rule rows removed; scratch sign-in settings file removed; production counts as above.

---

# Owner verification on a physical phone (recorded 2026-10-23)

The owner tested the Home banner on their own physical phone and reported that all of these passed: **banner swipe, vertical scrolling, event opening, and the Seasonal theme on/off control.** This is owner-verified (not run by me); it closes the real-phone item for the banner. It does not cover the Browse menu or the Account menu rows, which were not named, so those phone checks stay browser-emulated only (RB64). Earlier emulated results (RB61, RB62) are unchanged.

---

# Automatic event refresh: the real scheduled run (2026-10-23)

**Result: the run was seen and read; it processed events but saved none, because the Anthropic account has no credit. Still open until credit is added and a real run saves events.**

Read from Vercel (Logs and Observability) for the real run at 13:21 UTC, within the one-hour log retention. Evidence: `repair-batch-18/evidence/refresh-events-real-run-2026-10-23.json`.
- **What the run did:** it finished in 15 s (no timeout; the earlier fixes work: it answered with its own failure status, 502, and logged the reason). It ran 12 searches (6 Google Events, 6 Ticketmaster), found **42 candidate events** (convention 10, card show 19, drop 1, gallery 8, music 4), then asked the AI relevance check which are real collectibles events.
- **Why nothing was saved:** the AI check was refused: `Your credit balance is too low to access the Anthropic API`. By design (the run drops everything it cannot check, so unchecked results are never published) it approved 0 and saved 0 (`inserted 0, updated 0, failed 0`). The records check agrees: no event created or updated by the run. This is almost certainly why the refresh has produced nothing for weeks, hidden until the failures became visible.
- **Also found:** 3 of the 6 Google Events searches (drop, gallery, music) timed out at the 15 s limit I had set. I raised that limit to 25 s for both jobs (25 s + the 25 s AI check still ends inside the 60 s limit), pushed in the commit after this note.
- **The picture step** (which runs after the response) worked: 15 checked, 2 filled, 2 classified, no errors.

## What is needed from you (nothing else is blocking)
1. **Add credit to the Anthropic API account** (console.anthropic.com > Plans & Billing). Cost: the daily refresh makes one small AI call (about 3,000 words in, 1,000 out, roughly **1 cent a day**) and the weekly major-shows job one more, so the smallest top-up lasts for months. **The same key powers the app's other AI features (scan and verify), so those are probably refused too until credit is added**; I did not test that, because it would spend credit.
2. Then the next scheduled run (tomorrow 13:00 to 14:00 UTC, or the weekly one Mon Oct 26 14:00 UTC) will show whether events are saved: Vercel > Observability > Vercel Functions should show `/api/cron/refresh-events` with an error rate of 0%, and the log line `[refresh-events]` should show `inserted` or `updated` above 0. I have a check set for tomorrow's window and will read it if this session is still open. A manual Run in Vercel > Settings > Cron Jobs would confirm sooner at the cost of 6 search credits (about $0.10, or free inside an allowance) plus the cent of AI.
3. Not changed, your call: I did not loosen the rule that nothing is saved without the AI check. If you would rather have a no-AI fallback filter while credit is low, that is a product decision for you to make.

---

# Event refresh: BLOCKED on Anthropic credit; retries made cheap (2026-10-24)

**Status: BLOCKED.** The refresh will not save events until the Anthropic account has credit. Nothing below changes that, adds credit, changes billing or makes a paid call.

## What the real runs show (Oct 23 and Oct 24, 13:21 UTC)
1. **Exact credit error text** (from the run's log, the AI request's HTTP 400): `AI request failed: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CgKEnU9pwKYrzuy5QL5z2"}` (Oct 23; Oct 24 reads the same, its request id is cut off in the log view).
2. **The step that failed: the AI relevance check** (the Anthropic call), and only that. The searches did not fail the run: 9 of 12 searches succeeded each day (Ticketmaster all 6, Google Events 3 of 6); the other 3 Google Events searches timed out (a separate, secondary slowness). Parsing did not fail. The save step did not fail: it ran with nothing approved (`inserted 0, updated 0, failed 0`).
3. **The 42 candidates were fetched and parsed** (`totalFound 42` counts parsed events with a name and valid dates) **and were ready for the AI check, not ready to save**: the AI check is what decides which of them are real collectibles events, and by design nothing is saved without it. They were **not retained**: they lived only in that run's memory, so they were lost when the run ended, and the next run would have paid for the same searches again.

## What changed so a retry does not repeat paid work (code in this commit; takes effect once SQL file 8 is run)
- A small memory for both refresh jobs: **[8-event-refresh-store.sql](sql/8-event-refresh-store.sql)**, then [validation-8.sql](sql/validation-8.sql); undo with [rollback-8.sql](sql/rollback-8.sql). **Not run: it is yours to run by hand.** Two tables, server-only (no public access), no existing table touched; tested 8 of 8 in a local Postgres.
  - `event_refresh_candidates`: each event found and parsed, with the AI's verdict (pending, approved, rejected) and when it was saved;
  - `event_refresh_steps`: each paid step that already succeeded today (a search; for the weekly job, a show's search results and the AI's answer for that show).
- Daily job: **does not repeat a search that succeeded the same day; keeps every event it parses; asks the AI only about events it has not yet judged** (an event the AI leaves out of its answer stays not-yet-judged); events already approved but not saved (a save failed) are saved without asking the AI again; next day the searches run again and events still waiting from yesterday are judged with the new ones. Old candidates (30 days) and steps (3 days) are cleared.
- Weekly job: a show whose search succeeded today is not searched again, and a show the AI already answered about is not asked about again, so a retry after a refused AI call costs one AI call and no searches.
- **Until SQL file 8 is run the jobs behave exactly as before** (they notice the tables are missing and say so in the log: `memory.available false`). The run's log line now also reports what was reused (`searchesReusedFromToday`, `memory.askedTheAiAbout`, `alreadyApprovedNowSaved`, `stillNotJudged`).
- Tests: `npm run test:events` 37 of 37 (7 new, all against pretend services, none of them a production run), including: a refused AI call keeps the found events; a same-day retry repeats no search and asks the AI once; a later success saves only the approved; a finished day makes no AI call and no search; an omitted event is the only one asked about next; an approved-but-unsaved event is saved without the AI; next day searches repeat; old rows are cleared; the weekly job likewise.

## To unblock (yours)
1. Add credit to the Anthropic account (console.anthropic.com > Plans & Billing); about one cent a day for the daily run. The same key powers the app's AI scan and verify.
2. Run SQL file 8 when you want the retry memory on (optional but recommended before credit is restored, so the first real run keeps its candidates even if something else goes wrong).
3. Then the next scheduled run (daily 13:00 to 14:00 UTC, weekly Mon 14:00 UTC) shows whether events are saved: Vercel > Observability error rate 0% and the `[refresh-events]` log line with `inserted` or `updated` above 0.
