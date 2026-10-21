# Stage 4: one package for your SQL run (everything else is done)

**Gate:** all nine required consumers pass on production (stage-3 checklist 41/41, plus consumer 9, the admin characters page, verified with a disposable QA admin: see `STAGE3-STATUS.md` addendum below). The old table read is the only thing left open.

## Run, in this order (about two minutes)
1. Open [4-restrict-galleries-table-read.sql](sql/4-restrict-galleries-table-read.sql) in the Supabase SQL editor, paste the whole file, Run (confirm the "destructive operations" prompt). One transaction: it either completes or changes nothing, and it stops with a message if production is not exactly as reviewed (member rule present, view present, exactly one public read rule).
2. Open [validation-stage4.sql](sql/validation-stage4.sql), Run, click the single result cell, copy all of it and paste it to me.
3. If anything looks wrong at any point: run [rollback-4.sql](sql/rollback-4.sql) (restores the old public read rules exactly) and tell me.

## What it does (plain words)
- Public exhibition items keep working: their read rule is rewritten first to ask a small helper instead of reading the exhibitions table.
- Then the public read rule on the exhibitions table is removed. After this a visitor or any unrelated account gets nothing from that table (the real profile id of an alias exhibition included); public pages read the cleaned-up view; share and invite links keep working; owners and team members keep reading and writing their own exhibitions.
- No data is changed.

## What I do the moment you paste the result (no further question to you)
Run `rb22-stage4-db.cjs` (table, view, items, link, write checks as a visitor, an unrelated account and the owner) and `rb20-stage3.cjs stage4` (the whole page matrix and cache-ownership checks), then record the result in `LIVE-STATUS.md`. If a check fails I tell you to run the rollback and I fix forward.
