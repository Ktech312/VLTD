# AI scan endpoints: closed, then corrected after review (2026-10-24)

**Commits:** `35af705` (the gate), `03be19d` (Capture page shows a refusal), and the correction commit that carries this file (server caller moved to the service role, SQL 10 corrected and held, new regression tests). The corrected SQL package is for review in [SQL-10-REVIEW.md](SQL-10-REVIEW.md); **SQL 10 is held and has not been run.**

## What was wrong originally
`/api/ai/analyze-item` and `/api/ai/analyze-coa` called Anthropic with no server-side sign-in, no allowance check and no limit on what was sent. The allowance was charged only in the browser, after the paid call, and single Add Item scans and certificate scans were not counted at all.

## What happens now (every step is before the paid call)
1. **Verified sign-in:** Supabase verifies the access token on the server. No token, a forged token, or an unreachable Supabase means refused.
2. **The image is checked from its bytes:** JPEG, PNG, WebP or GIF only, 200 bytes to 4 MB, 8 to 8,000 pixels each way; the file's name and claimed type are not trusted; free text sent with the scan is cut to a fixed size.
3. **The verified user's membership of the requested profile**, then **one scan reserved atomically from the profile's existing monthly allowance** (item, single and certificate scans are one scan each; no new limit was invented).
4. **A repeated request id spends once** (the browser also collapses a double press into one request).
5. **Provider failure gives the scan back; a provider that answered keeps it spent.**
6. **Only the trusted server moves the allowance.** It reserves, completes and refunds as the service role. A signed-in browser cannot refund, complete or reserve (see the review package). The browser no longer charges anything (`consumeBulkScans` is deleted; a test fails if browser code charges again).
7. Plain refusal messages for every caller.

## What the review changed (2026-10-24, after the first version)
- **Refunds and completion are server-only.** In the first draft of SQL 10 a member could have refunded their own in-flight reservation. Fixed in the SQL (privileges plus an in-function check) and in the server caller.
- **The allowance had not been moving for ordinary members, ever since the billing-column trigger was added.** A member's own call to `consume_bulk_scan` is told "granted 1, used 1" but the trigger silently puts the counter back (measured on production: three calls, counter still 0; as the server, two calls, counter 2). So the first deployed version of this gate (which used the member's own token in "basic" mode) was checking sign-in, membership, images and the zero case, but the counter would not have advanced. Fixed: all allowance calls now use the service role, with the membership of the verified user checked by the server first. The fix is deployed (see "Production" below).
- **`bulk_scan_status` becomes read-only in the corrected SQL** so a member's ticker read cannot carry an old count into a new cycle.

## Was there an earlier "owner-only" restriction on the AI endpoints?
I searched every commit on every branch. **No.** Neither AI route has ever had an owner, admin, role or sign-in check, from the first AI scan (`f05f70c`, 2026-05-12, Claude Haiku vision; earlier Gemini versions before it) up to `35af705`. The only owner/admin controls near AI features are:
- **`8b9b795` and `44f64bd` (2026-07-23):** the monthly scan allowance tables and the Admin "Scan Limits" page; the owner and admins edit limits and overrides. They never limited who may scan, and the browser did the charging.
- **`3bfb8f9` (2026-08-23, exactly two months ago):** per-user AI usage logging and the admin Users page. `ai_usage_log` is admin-only with service-role writes, and `/admin/users` is admin-only (with 2FA required for admin routes). It records AI calls; it does not restrict them.
- **The cron routes** (`d7eb654`, 2026-08-23, the Events AI relevance gate): protected by the cron secret since they were written; now also switched off or approval-gated.
- Nothing in Vercel either: the project's Firewall shows 0 custom rules.
If you remember a specific commit, file or dashboard setting, tell me where and I will compare it; I could not find one. What the repository does have today, on every AI-spending route, is below.

## Every route that can spend AI credit, and its gate on production now
| Route | Gate |
|---|---|
| `/api/ai/analyze-item` | verified sign-in + profile membership + allowance + image checks (server-only reservation) |
| `/api/ai/analyze-coa` | the same |
| `/api/cron/refresh-events-monthly` | cron secret + switched on + once-a-month claim + SerpApi allowance check + one small AI request first |
| `/api/cron/refresh-events`, `/api/cron/refresh-major-events` | cron secret + `EVENTS_REFRESH_ENABLED` (not set), not scheduled |
**Regression test added** (`npm run test:ai-gate`, 14 checks): lists every route that can reach the AI provider, fails if a new one appears without being added on purpose, fails if the gate does not come before the first provider call, fails if a library file talks to the provider directly, and calls every one of them with no credentials (and with wrong ones) against a pretend internet that throws on any outbound request: each refuses and none reaches out. I confirmed the test fails when an ungated AI route is added and passes when it is removed.

## Verification (no paid call anywhere)
- **Real Postgres 18, separate connections, 47 of 47**; **route level with a simulated provider, 52 of 52**; **every-route gate test, 14 of 14**. Details in [SQL-10-REVIEW.md](SQL-10-REVIEW.md).
- **Production, refusals only** (`rb74`, `rb75`): see the final report; the success path against the real provider is deliberately never exercised.

## Limits to know
- In "basic" mode (live until SQL 10 is run) a failed provider call is not given back, and a repeated request is recognised only on the same server instance. The allowance itself, sign-in, membership and image checks are fully enforced.
- "Zero unauthorized paid calls" on production is shown by what the server answered before the paid step and by the order of the code; the provider's own usage page is the only direct record.
- The allowance numbers are the placeholders already in the database (10 / 100 / 500 a month by tier unless overridden); this work did not change them. Because the counter was not moving before, profiles start from their stored counts (zero for ordinary members).
- A scan the browser abandons after its own timeout may still finish on the server and stay counted.

## Cleanup
QA accounts used for these checks are dropped by exact manifest; the QA scan overrides and counters are reset; production is back to 3,477 vault items, 39 profiles and 47 exhibitions. No SQL was run, no paid call was made, no credit or billing was touched.

## Also corrected
The Events notes no longer say the monthly checks "spend nothing": the tiny Anthropic availability request is a paid request and can consume a little credit when it succeeds.
