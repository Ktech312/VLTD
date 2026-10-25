# AI scan endpoints: closed (2026-10-24)

**Deployed commits:** `35af705` (the gate, both routes, all callers, SQL package 10 prepared) and `03be19d` (a refusal is also shown on the Capture page when the free local scans found something). Production was running `35af705` for the live refusal checks (RB74) and `03be19d` for the browser check (RB75).

## What was wrong
`/api/ai/analyze-item` and `/api/ai/analyze-coa` called Anthropic with no server-side sign-in, no allowance check and no limit on what was sent. The monthly allowance was charged only in the browser, after the paid call had already returned, and single Add Item scans and certificate scans were not counted at all.

## What happens now (every step is before the paid call)
1. **Verified sign-in**: the Supabase access token is verified by Supabase on the server. No token, a forged token, or a Supabase that cannot be reached means refused (401 or 503). Nothing else is touched.
2. **The image is checked from its bytes** (`src/lib/server/scanGuard.ts`): it must really be a JPEG, PNG, WebP or GIF (the name and the type the browser claims are not trusted), between 200 bytes and 4 MB, and between 8 and 8,000 pixels each way. The provider is sent the real type. Free text sent with the scan is cut to a fixed size.
3. **Membership and allowance, atomically in the database**: the caller's own token is used for the existing allowance functions, which check the person is a member of the requested profile (the existing hardened guard) and take one scan from the profile's **existing** monthly allowance (same tiers, same per-person overrides, same signup-anniversary cycle; no new limit was invented). Item scans, single scans and certificate scans are one scan each.
4. **A repeated request spends once**: every request carries a request id; the browser also collapses a double press of the same photo into one request.
5. **Provider failures give the scan back**; a provider that answered keeps the scan spent.
6. **The browser no longer charges anything** (`consumeBulkScans` is deleted; a test fails if any browser code charges again). It reads the new allowance numbers from the server's answer.
7. Clear refusals for every caller (item photo on Add Item, Capture, Quick Add batch, the scan panel, certificate scan): sign in, not your profile, allowance used (with the numbers and the reset date), not a photo, too large, already counted, temporarily unavailable.

## Two modes (important)
- **basic** (live now, because SQL package 10 has not been run): steps 1 to 3 and 6 to 7 are fully enforced using the existing atomic `consume_bulk_scan(profile, 1)` before the call. A repeated request id is recognised only if it reaches the same server instance, and a failed provider call is NOT given back (the person loses that scan).
- **full** (after you run [10-ai-scan-reservations.sql](sql/10-ai-scan-reservations.sql)): repeated requests are recognised in the database whichever server they reach, and a failed provider call gives the scan back. The route switches by itself; every answer carries `x-scan-guard: basic` or `full`.

Run [10-ai-scan-reservations.sql](sql/10-ai-scan-reservations.sql) once, then [validation-10.sql](sql/validation-10.sql) (every value must read true). Rollback: [rollback-10.sql](sql/rollback-10.sql) (the routes fall back to basic mode). No hurry for safety: the gate is already in force.

## Verification (focused)
- **Simulated providers, 44 of 44** (`npm run test:ai-scan`): for both routes, an anonymous caller, a forged token, an unverifiable sign-in, someone else's profile, a missing profile or request id, six kinds of invalid or oversized image, an over-limit profile, five copies of one request at the same instant, six different requests at the same instant with two scans left, and a missing provider key each make **zero provider calls** (and spend nothing); the success path spends exactly one scan before the provider is called; provider failure, busy and unreachable give the scan back (full mode); an unreadable answer keeps the charge; the same behaviour before the SQL is run (basic mode); both scan kinds share one allowance; and the browser helper sends token, profile and request id, collapses three presses into one request, and no browser code charges a scan.
- **Real Postgres, 35 of 35** (`repair-batch-19/scripts/test-sql10-in-postgres.cjs`, on the real allowance functions and membership guard): reserve, duplicate, limit, give-back, give-back only inside the same cycle, a released id can be retried, non-members and anonymous callers refused, certificate and item scans share the allowance, eight different requests together against an allowance of 3 give exactly 3, eight copies of one request give exactly one, cycle roll-over, old rows cleared, validation file all true, rollback and re-apply. (PGlite is a single connection, so "together" means decided one after another; the protection is the row lock inside the function, checked by the validation file.)
- **Production, refusals only (RB74, 21 of 21)**: for both routes, no sign-in 401, forged token 401, someone else's profile 403, text file named photo.jpg 415, oversized 413, no request id 400, no profile 400, and a profile whose allowance was set to zero refused 429 with the numbers after sign-in, membership and the image were verified live. None spent a scan.
- **Production browser (RB75)**: on the real Capture page with the network call intercepted in the page: two presses sent one request carrying the token, the profile, a request id and the photo; the browser made no allowance-spending call of its own (113 requests watched); the server's refusal sentence is shown. The first run (on `35af705`) passed 5 of 6: **the refusal sentence did NOT reach the screen on the Capture page when the page's free local scans had filled something in** (a real gap in my wiring, kept on record as a failing row, not a test mistake). Fixed in `03be19d`; the re-run on `03be19d` passed 6 of 6.
- **Not tested, on purpose**: the success path against the real provider (it would spend Anthropic credit). It is proven only with the simulated provider. The first real scan after this deploy will be its first live run: if a scan misbehaves, the person sees a plain message and the allowance is not lost in full mode.

## Limits to know
- In basic mode a failed provider call costs the person a scan until SQL package 10 is run.
- "Zero unauthorized paid calls" on production is shown by what the server answered before the paid step and by the order of the code; the provider's own usage page is the only direct record.
- The allowance numbers are the placeholders already in the database (10 / 100 / 500 a month by tier unless overridden); this work did not change them.
- A scan that the browser abandons after its own timeout may still finish on the server and stay counted.

## Cleanup
QA accounts created for these checks (`scan1`) are dropped by exact manifest; the QA profile's scan override was removed; production is back to 3,477 vault items, 39 profiles and 47 exhibitions. No SQL was run, no paid call was made, no credit or billing was touched.

## Also corrected in this pass
The Events notes no longer say the monthly checks "spend nothing": the tiny Anthropic availability request is a paid request and can consume a little credit when it succeeds (`CURRENT-STATUS.md`, the inventory, the route comment, the design note).
