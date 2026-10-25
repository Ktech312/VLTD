# Monthly Events refresh: ENABLED (the 1st of each month, covering the coming year)

Status (2026-10-24): enabled on the owner's instruction ("Enable one Events refresh on the first of each month, covering the coming year. Use the existing monthly allowances. Keep daily/weekly jobs and paid visitor lookups off. No automatic top-ups, paid overages or repeated paid retries."). The daily job, the weekly job and the visitor "Find events" lookup stay off. Nothing here needed SQL.

## Schedule (`vercel.json`)
- **12:00 UTC on the 1st**: `/api/cron/refresh-events-monthly?preflight=1`. A free read of SerpApi's own account figures (not a search). Nothing is spent or saved.
- **13:00 UTC on the 1st**: `/api/cron/refresh-events-monthly`. The refresh itself.
- Vercel's free (Hobby) plan runs a cron somewhere in the hour it names, so the two can run in either order. The refresh does not depend on the first one: it makes the same allowance check itself.

## What one run does
- Splits the next twelve months into 4 windows (today to 1 Jan, then one window per quarter).
- For each of the 6 categories and each window: **1 Google Events search (SerpApi)** and **1 Ticketmaster search** (with the window's dates), once each: **24 + 24** requests.
- Puts the soonest **300** distinct events, no more, to the AI check, in groups of 50 (**6 AI calls**).
- Saves only what the AI check approves, through the same save step the daily job used (no duplicates, nothing blanked, nothing re-enabled).
- Fills missing banner pictures from each organiser's own page (free).

## Checks BEFORE the first search is paid for (a shortfall stops the run with nothing spent)
1. **SerpApi allowance**: SerpApi's account figures must show the plan's remaining monthly searches cover all 24 (bought extra credits are never counted or used), and room in the hourly limit. If not, the run stops and says exactly what is short, for example "plan Free Plan: 10 of 250 monthly searches left, this run needs 24 (short by 14)". If the figures cannot be read, it stops too.
2. **AI check**: one tiny request (at most 5 words back) must succeed, so searches are never bought that the AI check could not then judge. If the AI account cannot be charged, the run stops with the provider's own message.
A stopped run answers with an error so Vercel marks the cron run failed. Neither check is retried.

## Allowance read on 2026-10-24
SerpApi: **Free Plan, 250 searches a month, 185 left this month, 0 extra credits, hourly limit 250.** The run needs 24, so it fits, with room for several months. Ticketmaster is free (5,000 calls a day). The Anthropic balance cannot be read by code or without signing in to its console, so the AI side is guarded by the tiny check above rather than a read.

## Usage and estimated cost (my estimate, not an approved cap set at a provider)
| Item | Most it can do | Estimated most it can cost |
|---|---|---|
| Google Events searches | **24** | $0 inside the free plan's monthly allowance; about $0.60 only if the account were on the dearest paid plan ($0.025 each) |
| Ticketmaster searches | 24 | $0 |
| AI check | 1 tiny request + **6 calls**, each at most 8,000 input and 1,500 output tokens (the 1,500 is sent with the request) | about **$0.09** ($1 per million input, $5 per million output) |

The plan's own ceiling is $0.70 per run. It is a calculation from list prices and token limits, not a limit enforced by SerpApi or Anthropic. The job reports the searches it made and the tokens the AI service says it used.

## No retries, no overage
Every request is made once. A search that fails is listed in the report and not repeated. An AI call that is refused is not repeated, and nothing from that group is published. Vercel does not retry a failed cron. SerpApi's free plan stops at its monthly limit rather than charging, and the allowance check refuses to start a run that would not fit.

## Where the approval lives
`RECORDED_APPROVAL` in `src/lib/events/monthlyRefreshPlan.ts` (enabled, $0.70 ceiling, 24 searches). An environment variable of the same name overrides it. To switch the refresh off without a deploy, set `EVENTS_MONTHLY_REFRESH_ENABLED=false` in Vercel; to stop the schedule entirely, remove the two entries from `vercel.json`. `GET /api/cron/refresh-events-monthly?plan=1` (with the cron secret) prints the plan and the approval state with no outside request.

## What stays working with no paid request
The Events page, the stored-event search and filters, the Home banner and its rotation, the countdown and date-based expiry read stored rows only. A row leaves the banner and the list on its own end date.

## The live "Find events" lookup stays paused
It spent up to three SerpApi searches per press for anyone. The page no longer offers it, and the route answers "paused" with no outside request unless `EVENTS_LIVE_LOOKUP_ENABLED` is exactly `true`.
