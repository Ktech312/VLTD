# SQL package 10 (corrected): for review. HOLD: not run.

Files: [10-ai-scan-reservations.sql](sql/10-ai-scan-reservations.sql), [validation-10.sql](sql/validation-10.sql), [rollback-10.sql](sql/rollback-10.sql). Server caller: `src/lib/server/scanGuard.ts`.

## What the review found, and what changed
1. **Completion and refunds were callable by any signed-in member** (first draft). A member could refund their own in-flight reservation, or mark it complete, and so scan for free. **Now `reserve_ai_scan`, `complete_ai_scan` and the helper are executable by the service role only** (privileges revoked from `anon` and `authenticated`, and each function also checks `auth.role() = 'service_role'` inside). The server alone decides whether the provider answered and whether a refund is due.
2. **Membership is the verified user's, checked before anything is reserved.** The server verifies the sign-in token with Supabase, then passes the verified user id as `p_user`; `reserve_ai_scan` requires that user to be the profile itself or a member (`profile_members`), the same rule as the existing guard. Nothing the browser sends can name a different user.
3. **A second problem this review exposed (existing, not caused by this package):** the billing-column protection trigger on `profiles` silently restores `bulk_scans_used` for any caller that is not the owner, an admin or the service role, even inside the `SECURITY DEFINER` allowance functions. Measured on production on a QA profile: three calls to `consume_bulk_scan` with a member's own token answered "granted 1, used 1" and the counter stayed 0; two calls as the service role moved it to 2. So the monthly AI allowance has not been moving for ordinary members. Consequences handled here: every write is made as the service role; `bulk_scan_status` becomes **read-only** (the version in production rolls a lapsed cycle forward with an UPDATE that, for a member's own call, keeps the new cycle start but the old count, which would carry last cycle's usage into the next).

## What the package contains
- `public.ai_scan_requests`: one row per (profile, request id), state reserved / done / released, with the user who asked and the allowance cycle. No policies; nobody but the service role can touch it.
- `public.ai_scan_numbers(profile)`: the profile's numbers with a lapsed cycle rolled forward IN THE ANSWER (writes nothing). Service-internal.
- `public.reserve_ai_scan(p_user, p_profile, p_request, p_kind)`: locks the profile row, then `reserved` (one scan spent from the existing allowance), `duplicate` (this id already reserved or finished: nothing spent) or `limit`.
- `public.complete_ai_scan(p_profile, p_request, p_succeeded)`: `true` keeps the scan spent; `false` gives it back once, only inside the cycle it was taken from. Repeating either does nothing.
- `public.bulk_scan_status`: same readers, same guard, same answer shape, now read-only.
- No limit, tier, override or cycle rule changes.

## Regression checks (all use simulated providers; no paid call anywhere)
**Real Postgres 18, separate connections, 47 of 47** (`repair-batch-19/scripts/test-sql10-real-postgres.cjs`; real roles, real row-level security, the real billing trigger, the real quota migration, the real membership guard):
- A signed-in member cannot call `reserve_ai_scan` or `complete_ai_scan` (permission denied), nor read the request table, nor call the helper; an anonymous caller cannot either.
- **During an in-flight reservation** the member cannot refund it, complete it, re-reserve it, edit its row, or reset their own counter; the reservation is untouched; the server then completes it once; a later "refund" of a finished scan changes nothing.
- The server's refund works once only (8 refunds on 8 connections at the same instant give exactly one scan back); a released id can be retried.
- **16 different requests on 16 separate connections against an allowance of 3: exactly 3 reserved.** 16 copies of one request: exactly one reserved. Two connections racing for the one scan left, 12 rounds: exactly one wins every time. A success and a failure reported at the same instant: one outcome, counter agrees.
- **Cross-profile**: a verified user who is not a member is refused, nothing reserved, including six refused requests mixed into concurrent legitimate ones.
- **Negative control**: the same function with the profile lock removed over-spends the allowance under the same race, so the test can see the bug it guards against.
- The pre-existing behaviour is reproduced and recorded: a member's own `consume_bulk_scan` moves nothing; the server's does.
- `bulk_scan_status` is read-only (a member's ticker read of a lapsed cycle writes nothing); the server's next reservation rolls the cycle; a stranger and an anonymous caller cannot read status; refund is not applied across cycles; old rows are cleared; rollback restores the previous status function; the file re-applies; `validation-10.sql` reads all true.

**Route level, simulated provider, 52 of 52** (`npm run test:ai-scan`): the route uses the service role for every allowance call, never the caller's own token (and the counter really moves, which a member-token call would not do); during a held provider call the member's direct refund, completion and re-reservation are all refused and the reservation is untouched until the server completes it; a failed provider call is refunded by the server once and the retry is charged once; a request that claims to be another user (extra form fields) is still refused; plus the earlier cases (anonymous, forged token, someone else's profile, bad images, over-limit, duplicates, concurrent requests, basic mode).

## How to run the real-Postgres test
`npm install embedded-postgres pg` in any folder, set `EMBEDDED_PG_DIR` to it, run `node docs/audit-2026-10-18/repair-batch-19/scripts/test-sql10-real-postgres.cjs`. It starts its own temporary database; nothing outside your machine is touched.

## Until the SQL is run (live now): "basic" mode
The server verifies the token, checks the verified user's membership itself (`profile_members`), rolls the cycle as the service role, and spends one scan with the existing `consume_bulk_scan` as the service role, all before the provider is called. This already makes the allowance real (it was not before). Not available until the SQL is run: recognising a repeated request across servers, and giving the scan back after a provider failure. One honest limit: until `bulk_scan_status` is replaced by the read-only version, a member's ticker read at the exact moment a cycle lapses could carry the old count into the new cycle for that profile; run this package before the first profile's next allowance cycle begins (cycles run monthly from each profile's signup day).

## Not changed (decisions for you)
- `consume_bulk_scan` is still executable by signed-in members; it is now harmless (it moves nothing for them) and nothing in the app calls it. Revoking that grant is a one-line follow-up if you want it.
- The billing-column trigger itself is untouched: it is doing its job (a member cannot edit their own counter), and the fix is that the server, not the member, writes it.
