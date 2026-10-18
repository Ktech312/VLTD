# Proposal: a restricted deletion audit for vault items (2026-10-18): STATUS = PROPOSED (draft SQL tested in a real Postgres engine; NOT applied; no migration this round)

## Why
The item count fell by two between 2026-10-15 and 2026-10-17 and nothing recorded which items, who or when (`docs/investigations/reliability-investigation-2026-10-18.md`). The database keeps no deletion history.

## What it records (one row per deleted item; `docs/proposals/vault-items-deletion-audit-2026-10-18.sql`)
| Field | Why |
|---|---|
| time (`deleted_at`) | when |
| item id, permanent item code (e.g. `260312-0001-000142`), collection (`profile_id`), when the item was added, status | which item, and whether it was new or old |
| first 60 characters of the title | only so a deleted record can be recognised; the table is restricted. This is customer content: **EK's choice** whether to keep it (remove the column to drop it) |
| `actor_user_id` (the signed-in account, from `auth.uid()`), `actor_role` (`authenticated`, `service_role`, none) | who: an account, the service key, or a direct SQL session |
| `db_user`, `via` (`api` when the call came through the REST gateway, else `direct`), request method and path, browser name (`user-agent`) | the context of the call; for an API call this separates the app from a script |
| a chain hash (`prev_hash`, `row_hash`) | see limits |

A TRUNCATE of the whole table is recorded too. A delete that row-level security refuses (0 rows) records nothing.

## Access
Row-level security on, no policies; all privileges revoked from visitors, signed-in accounts and PUBLIC. Only the service key and the database owner can read it. The rows are append-only through the app and API keys: editing, deleting and truncating are refused (a trigger). A read-only function reports the first row whose hash no longer matches.

## Limits (stated plainly; this is NOT tamper-proof)
- **Tamper-evident, not tamper-proof.** The database owner (the Supabase SQL editor runs as `postgres`) can disable a trigger, edit or delete audit rows, truncate the table or drop it. The hash chain makes a partial edit **detectable** (tested: an owner edit is reported), but an owner who rewrites the whole chain defeats it. To make the chain count for something, the newest `row_hash` should be copied somewhere outside the database from time to time (for example into a note kept by EK).
- **Starts at adoption.** It explains deletions from the day it is applied. It cannot explain the two that have already happened.
- **Not every route.** Anything that switches row triggers off (a session with `session_replication_role = replica`), a dropped table, or a restore from backup is not captured.
- **Context depends on the route.** An API call carries method, path and user agent; a delete typed in the SQL editor carries only the database user and time.
- **Small cost:** one row per deleted item; a bulk delete of 1,500 items writes 1,500 rows.

## Decision for EK (not needed for the visual work)
Apply it (it would be a normal hand-run migration plus the checks used before) or not; whether to keep `title_start`; whether to also keep the latest hash somewhere outside the database. Nothing is applied in this round.

Test: `supabase/validation/test-deletion-audit-draft.cjs` (15/15 in an in-process Postgres: owner API delete, service-key delete, SQL-editor delete, bulk delete, refused delete, truncate, restricted reads and writes, append-only, chain check, owner-edit detection).
