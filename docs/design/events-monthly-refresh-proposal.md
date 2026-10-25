# Monthly Events refresh: proposal (OFF until you approve its cost)

Status: built, tested, **switched off, and it stays off**. Nothing here is approved: the dollar figures below are my own estimate, not an approved budget and not a spending cap set at SerpApi or Anthropic. It sends nothing until you set three variables in Vercel. It has no schedule. Nothing here needed SQL, and SQL file 8 is not required.

## What one run does (one pass over the coming year)
- Splits the next twelve months into 4 windows (today to 1 Jan, then one window per quarter).
- For each of the 6 categories (conventions, card shows, auctions, drops, galleries, music) and each window: **1 Google Events search (SerpApi)** and **1 Ticketmaster search** (with the window's dates).
- Puts the soonest **300** distinct events, no more, to the AI check, in groups of 50.
- Saves only what the AI check approves, through the same save step the daily job used (no duplicates, nothing blanked, nothing re-enabled).
- Fills missing banner pictures from each organiser's own page (free; no paid request).

## Estimated maximum usage and cost (my estimate; nobody has approved it and no provider enforces it)
| Item | Most it can do | Most it can cost |
|---|---|---|
| Google Events searches (SerpApi) | **24** | **$0.60** at $0.025 each (the dearest plan I checked); $0.36 on Developer ($0.015); $0.24 on Production ($0.01); $0 on the free plan while you are under 250 a month |
| Ticketmaster searches | 24 | $0 (free quota is 5,000 calls a day) |
| AI calls (Claude Haiku 4.5) | **6**, each at most 8,000 input tokens and 1,500 output tokens (the 1,500 is sent with the request, so it cannot be exceeded) | **$0.093** ($1 per million input, $5 per million output) |
| **One run, estimated worst case** | | **about $0.69** (about $8.30 a year if run monthly), as I calculate it |

Honest limits of these numbers: SerpApi charges a search only when it succeeds, so a failed search costs nothing. The AI figure is a bound from token limits and list prices, not a measurement; the first real run reports the tokens the AI service says it used. The figures come from SerpApi's published plan prices on 2026-10-24 and the Claude price table I last cached on 2026-10-06; the provider's billing page is the record of what was actually charged. I do not know which SerpApi plan you are on.

## No retries
Every request is made once. A search that fails is listed in the report and is **not repeated**; an AI call that is refused is not repeated and **nothing from that group is published**. Vercel does not retry a cron on its own. The only way another paid request happens is you running the job again.

## It refuses unless all three are set
`GET /api/cron/refresh-events-monthly?plan=1` (with the cron secret) prints the plan, the worst case and what is missing, with no outside request.

1. `EVENTS_MONTHLY_REFRESH_ENABLED` = `true` (exactly)
2. `EVENTS_MONTHLY_APPROVED_MAX_USD` = a number at least as large as the worst case (`0.70` covers it; it is checked again if you set a price below)
3. `EVENTS_MONTHLY_APPROVED_MAX_SEARCHES` = at least `24`
Optional: `SERPAPI_USD_PER_SEARCH` = your plan's real price per search (otherwise `0.025` is assumed).

If any is missing or too low the call answers "switched off" and says why; no search, AI call or database change happens.

## To approve and run it (when you decide)
1. Set the three variables above in Vercel (Settings, Environment Variables), redeploy.
2. Run it once by hand (the dashboard's Cron Jobs run button does not exist until a schedule is added, so call the URL with the secret) and read the report: searches made, events found, tokens used, estimated dollars.
3. Only if you want it monthly, add to `vercel.json` (it is deliberately not there now):
```json
{ "crons": [{ "path": "/api/cron/refresh-events-monthly", "schedule": "0 13 1 * *" }] }
```
That runs at 13:00 UTC on the 1st. A Hobby plan allows one run a day per cron at most, so this is fine.

## What stays working with no paid request
The Events page, the Home banner and its rotation, the countdown and date-based expiry read stored rows only. A row disappears from the banner and the list on its own end date. Without refreshes, no new events arrive and the banner shows whatever remains; the monthly run (or an admin adding events by hand through the admin quick-add) is how new ones come in.

## The live "Find events" lookup is paused
The lookup behind the Events page (`/api/events/search`) spent up to three SerpApi searches each time anyone pressed Search, signed in or not. It is now **paused**: the page no longer offers it (stored events can still be searched and filtered), and the route answers "paused" with no outside request unless `EVENTS_LIVE_LOOKUP_ENABLED` is exactly `true`, which is not set. Turning it back on needs a code change as well as that variable.
