# Proposal: a restricted deletion audit for vault items (2026-10-18, v2): STATUS = PROPOSED (draft SQL tested in a real Postgres engine; NOT applied; no migration this round)

## Why
Two items left the Kellogg collection between 2026-10-15 and 2026-10-17 and nothing recorded which, who or from where (`docs/investigations/reliability-investigation-2026-10-18.md`; the two are now identified by id, but not who removed them). The database keeps no deletion history, and the gateway logs that would show it expire within about a day on the Free plan.

## What it records (one row per deleted item; `docs/proposals/vault-items-deletion-audit-2026-10-18.sql`)
| Field | Why |
|---|---|
| time (`deleted_at`) | when |
| item id, permanent item code (e.g. `260312-0001-000142`), collection (`profile_id`), when the item was added, status | which item, and whether it was new or old |
| first 60 characters of the title | only so a deleted record can be recognised; the table is restricted. This is customer content: **EK's choice** whether to keep it (remove the column to drop it) |
| `actor_user_id` (the signed-in account, from `auth.uid()`), `actor_role` | who: an account, the service key, or nobody (direct SQL) |
| `request_origin` (Origin header), `client_info` (x-client-info), `user_agent` | **where the call came from.** A browser page running the app sends `Origin: https://vltd.app` and `supabase-js-web`; a script run from a computer normally sends no Origin and `supabase-js-node`; the SQL editor sends no request at all |
| `client_ip` (first address in x-forwarded-for) | which network (home, phone, the QA machine). Personal data; the table is restricted; **EK's choice** whether to keep it |
| `db_user`, `app_name`, `via`, request method and path | the database session; `via = api` when the call came through the REST gateway, else `direct` |
| `txid` and `statement_head` (first 300 characters of the statement) | every row written by one DELETE statement shares a `txid`, so a bulk delete reads as one event; the gateway sends values separately, so the statement text carries no item content |
| a chain hash (`prev_hash`, `row_hash`, covering time, item, actor, origin, address, `txid`) | see limits |

Read it with `select * from vault_item_deletion_statements order by first_at desc;` (one line per delete statement: how many items, by whom, from where) and `select * from vault_item_deletions where item_id = '…';` for the detail. `select * from vault_deletion_chain_head();` returns the newest id and hash to copy somewhere outside the database.

A TRUNCATE of the whole table is recorded too. A delete that row-level security refuses (0 rows) records nothing.

## Access
Row-level security on, no policies; all privileges revoked from visitors, signed-in accounts and PUBLIC on the table, the two functions and the view (the view runs with the caller's rights). Only the service key and the database owner can read it. The rows are append-only through the app and API keys: editing, deleting and truncating are refused (a trigger). A read-only function reports the first row whose hash no longer matches.

## What it would have answered
For the two items now identified: whether an account or the service key removed each (`actor_role`), whether it was a browser running the app, a script or the SQL editor (`request_origin`, `client_info`, `via`), from which network (`client_ip`), and whether both went in one action (`txid`).

## Limits (stated plainly; this is NOT tamper-proof)
- **Tamper-evident, not tamper-proof.** The database owner (the Supabase SQL editor runs as `postgres`) can disable a trigger, edit or delete audit rows, truncate the table or drop it. The hash chain makes a partial edit **detectable** (tested: an owner edit is reported), but an owner who rewrites the whole chain defeats it. Keep the newest `row_hash` outside the database from time to time.
- **Starts at adoption.** It explains deletions from the day it is applied. It cannot explain earlier deletions.
- **Not every route.** Anything that switches row triggers off (`session_replication_role = replica`), a dropped table, or a restore from backup is not captured.
- **Headers can be forged by whoever holds a key.** `Origin`, `x-client-info` and the user agent are set by the caller; a script can claim to be a browser. They separate honest sources and ordinary mistakes, not a determined impersonator. The account, role, database user and time cannot be forged by the caller.
- **Context depends on the route.** A delete typed in the SQL editor carries only the database user, application name and time.
- **Small cost:** one row per deleted item; a bulk delete of 1,500 items writes 1,500 rows.

## Decision for EK (not needed for the visual work or for the two investigations)
1. Apply it (a normal hand-run migration plus the checks used before) or not.
2. Keep `title_start` and `client_ip`, or drop either column.
3. Whether to copy `vault_deletion_chain_head()` somewhere outside the database now and then.
Nothing is applied in this round.

Test: `supabase/validation/test-deletion-audit-draft.cjs` (21/21 in an in-process Postgres: owner API delete with browser headers, service-key delete with script headers, SQL-editor delete, bulk delete sharing one `txid`, per-statement view, refused delete, truncate, restricted reads and writes of the table, head and view, append-only, chain check, owner-edit detection).
