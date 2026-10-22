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
