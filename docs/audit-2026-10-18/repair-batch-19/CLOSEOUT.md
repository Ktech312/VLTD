# AI scan endpoints: closed, corrected after review, owner-only, SQL 10 applied (2026-10-24 to 2026-10-26)

## 2026-10-26: SQL 10 applied by the owner (validation all true); production checks
No paid call, no credit touched. Three checks, all on production, each with a throwaway QA account that was dropped afterwards:
- **RB77, database level, 40 of 40** (`repair-batch-19/scripts/rb77-sql10-prod.cjs`, evidence `evidence/rb77-prod1.json`): only the server can reserve or complete (a signed-in member and an anonymous caller are refused by the database); during an in-flight reservation the member cannot refund, complete, re-reserve, edit the row or reset the counter; a repeated request id spends once, including 10 identical requests at the same instant; 14 different requests at once against an allowance of 3 reserve exactly 3 (6 rounds of two racing for the last scan: one winner each time); the server refund works once only (8 at once: one scan back), a released id can be retried, a finished scan cannot be refunded; **cycle rollover**: a member status read of a lapsed cycle answers with the new cycle and 0 used and writes nothing, the server next reservation rolls the cycle with no carry-over of the old count, and a refund for a reservation from an older cycle changes nothing in the current one.
- **RB78, the real routes in full mode, 23 of 23** (`rb78-routes-full-mode.ts`): the real item and certificate routes, run against the real production database and real sign-in, with only the AI provider replaced by a local stand-in (every other outbound host is blocked). Both routes answer `x-scan-guard: full`; a normal scan spends one and ends done; a repeated id gets 409 with no second provider call; three identical requests at once make one provider call; a failed provider call is given back by the server and the retry is charged once; 8 requests at once against an allowance of 3 make exactly 3 provider calls; an allowance of 0 is refused before the provider; a member direct refund during a held provider call is refused. For this run only, the owner check was pointed at the QA account through a path override outside the app.
- **RB76 again, 27 of 27, on the deployed site**: owner-only is still enforced (a non-owner who really is a member with allowance left gets 403 owner_only on both routes; counter unchanged; nothing reserved).
- Limit: the deployed site answers non-owner accounts before the mode is chosen, so the word full on the live site can only be seen on an owner scan. The mode is chosen at run time by whether the reservation function exists; RB77 shows it does, and RB78 shows the same route code answering full against that database. The first real owner scan will show the header.
- Cleanup: QA accounts dropped by exact manifest; production at 3,477 vault items, 39 profiles, 47 exhibitions; the scan ledger, usage log and every allowance counter or override are empty or unset.

## 2026-10-25: only the owner's account has AI access (live, commit `877205d`)
Product rule: every account except the owner's is refused before any paid scan, whatever its profile membership or allowance. The gate now decides this right after Supabase verifies the sign-in: the verified user must have a **confirmed** email equal to the owner address (`eck1679@gmail.com`, the same address the app and its SQL already treat as the owner; it is a real, confirmed production account). Anyone else gets `403 owner_only` ("AI scans are not available on this account.") before the request is read, before any membership, allowance or reservation lookup, and before the provider. Nothing in the request (form fields, headers, claimed user id or email) is used. Look-alike addresses and an unconfirmed owner address are refused. Admins and other roles are not included. The counter repair and the server-only reservation/refund design are unchanged.

**Proof, no paid call:** simulated providers (59 of 59 in `npm run test:ai-scan`): another signed-in account that is a real member of its profile with allowance left makes 0 provider calls, 0 reserve/consume/status/membership/complete calls and reserves nothing, on both routes in both gate modes; a non-owner claiming to be the owner, a look-alike address and an unconfirmed owner address are refused the same way; the owner still scans end to end in both modes. Removing the owner check makes 6 of those tests fail (negative control). `npm run test:ai-gate` (14 of 14) now also fails if the owner refusal moves after the form read, the service client, the reservation or the provider. **Production, RB76, 27 of 27** (refusals only): no sign-in 401, forged token 401, a QA account that really is a member with allowance left 403 owner_only on both routes (also with a bad file, no profile, a repeated request id), counter unchanged, no reservation row. The owner's own success path was not exercised (it would spend credit). Note `rb74` (the earlier membership/allowance refusal run) is superseded by RB76 for non-owner accounts: those requests now stop at the owner rule first.

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

## Was there an earlier "owner-only" restriction on the AI endpoints? (answer from 2026-10-24; the rule now exists as of 2026-10-25, above)
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
- (Superseded 2026-10-26: SQL 10 is applied and the routes run in full mode.) Before SQL 10, in basic mode a failed provider call was not given back and a repeated request was recognised only on the same server instance.
- "Zero unauthorized paid calls" on production is shown by what the server answered before the paid step and by the order of the code; the provider's own usage page is the only direct record.
- The allowance numbers are the placeholders already in the database (10 / 100 / 500 a month by tier unless overridden); this work did not change them. Because the counter was not moving before, profiles start from their stored counts (zero for ordinary members).
- A scan the browser abandons after its own timeout may still finish on the server and stay counted.

## Cleanup
QA accounts used for these checks are dropped by exact manifest; the QA scan overrides and counters are reset; production is back to 3,477 vault items, 39 profiles and 47 exhibitions. No SQL was run, no paid call was made, no credit or billing was touched.

## Also corrected
The Events notes no longer say the monthly checks "spend nothing": the tiny Anthropic availability request is a paid request and can consume a little credit when it succeeds.
