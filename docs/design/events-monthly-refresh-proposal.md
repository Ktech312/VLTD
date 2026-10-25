# Monthly Events refresh: ON (the 1st of each month, covering the coming year)

## What the owner authorized (2026-10-24)
Once a month, using the allowances the accounts already have, covering the coming year. No top-ups, no paid overages, no repeated paid retries. The daily job, the weekly job and the visitor "Find events" lookup stay off.

**The owner did not approve a dollar budget.** Any dollar figure in this document or the code is the developer's own estimate; nothing treats it as an approved amount or as a cap set at SerpApi or Anthropic. An earlier version of this file and of the code recorded a "$0.70 approval" and a "24 searches approval"; that was wrong and has been removed.

## Schedule (`vercel.json`)
- **12:00 UTC on the 1st**: `/api/cron/refresh-events-monthly?preflight=1`. Reads SerpApi's own account figures (SerpApi says this read is free and not counted as a search). Nothing else is sent or saved.
- **13:00 UTC on the 1st**: `/api/cron/refresh-events-monthly`. The refresh itself.
- Vercel's free plan runs a cron somewhere in the hour it names, so the two can run in either order. The refresh does not depend on the first.

## What one run does
- The next twelve months in 4 windows. For each of the 6 categories and each window: **1 Google Events search (SerpApi)** and **1 Ticketmaster search**, once each (**24 + 24**).
- Puts the soonest **300** distinct events, no more, to the AI check, in groups of 50 (**6 AI calls**).
- Saves only what the AI check approves (no duplicates, nothing blanked, nothing re-enabled). Fills missing banner pictures from each organiser's own page.

## Once a month, whatever invokes it
Before any outside request the run writes one marker for the calendar month (UTC) into the existing `vltd_migration_flags` table (`events-monthly-refresh:YYYY-MM`; the table's primary key allows one row per name, checked on production: a second insert is refused with a duplicate-key error). Of any number of invocations that month, whether a second cron, a hand-pressed Run, or several at the same instant, exactly one gets the marker and does the work; the others find it taken, answer "already ran this month" and send nothing (not even the SerpApi read) and change nothing. If the marker cannot be written, the run does not start. A run that stops before any search (allowance short, or the AI request refused) gives the marker back, because no monthly work was done. A run that fails after its searches keeps it, so nothing repeats the paid work. Verified with simulated services (sequential duplicates, four at the same instant, next month, stopped-early, failed-late, marker unwritable); no real paid run was made for this.

## Checks before the first search
1. **SerpApi allowance**: SerpApi's figures must show the plan's remaining monthly searches cover all 24 (bought extra credits are never counted or used) and room in the hourly limit. If not, the run stops and says exactly what is short ("plan Free Plan: 10 of 250 monthly searches left, this run needs 24 (short by 14)"). If the figures cannot be read, it stops.
2. **One very small AI request** (a few words back). **This is a paid request**: it uses a little of the AI account's credit. It shows only that the key works and that request could be charged. **It does not show that the account's balance covers the whole run**: the later AI calls can still be refused if the balance runs out, in which case that group's events are not published and nothing is repeated.

## Allowances as of 2026-10-24
- **SerpApi: confirmed.** Free Plan, 250 searches a month, 185 left, 0 extra credits, hourly limit 250. A run needs 24. This is a reading on 2026-10-24; each run re-reads it.
- **Ticketmaster**: free quota, 5,000 calls a day.
- **Anthropic balance: UNVERIFIED.** It cannot be read by code or without signing in to its console, and the check above is a paid request that does not establish the balance.

## Estimated usage and cost (the developer's estimate, from list prices and token limits)
| Item | Most it can do | Estimated most it can cost |
|---|---|---|
| Google Events searches | 24 | $0 inside the free plan's allowance (about $0.60 only if the account were on the dearest paid plan) |
| Ticketmaster searches | 24 | $0 |
| AI | 1 tiny request + 6 calls, each at most 8,000 input and 1,500 output tokens | about $0.09 |

The run reports the searches it made and the tokens the AI service says it used. The provider billing pages are the record of what was charged.

## No retries, no overage
Every request is made once. A failed search is listed and not repeated; a refused AI call is not repeated and nothing from that group is published. Vercel does not retry a failed cron. SerpApi's free plan stops at its monthly limit rather than charging, and the allowance check refuses to start a run that would not fit.

## Switching it off
`EVENTS_MONTHLY_REFRESH_ENABLED=false` in Vercel (no deploy needed), or remove the two entries from `vercel.json`. The owner's authorization is recorded as the default in `RECORDED_AUTHORIZATION` (`src/lib/events/monthlyRefreshPlan.ts`). Optional extra limits (`EVENTS_MONTHLY_APPROVED_MAX_USD`, `EVENTS_MONTHLY_APPROVED_MAX_SEARCHES`) are enforced only if someone sets them. `?plan=1` (with the cron secret) prints the plan and whether it is switched on with no outside request.

## Unchanged
Stored events, their search and filters, the Home banner and its rotation, the countdown and date-based expiry read stored rows only. The live "Find events" lookup stays paused (`EVENTS_LIVE_LOOKUP_ENABLED` unset). The daily and weekly jobs are not scheduled.
