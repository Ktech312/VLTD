# Batch 6 to 11 SQL: three small files (RC-11 scan allowance, RC-10 avatar upload, RC-23 Market asking prices, RC-27 exhibition view counter)

Run each file once in the Supabase SQL editor, in this order, then its check. All three are safe to run again and none changes any existing data.

## File 1: scan allowance + avatar upload (RC-11, RC-10)
**What it fixes for people**
- Business profiles and the Personal profiles whose profile id differs from their user id (17 of 39 real profiles) cannot see or use their AI-scan allowance: the Bulk ticker never shows and scanning is blocked.
- Nobody can upload an avatar picture today (every upload is refused). After the file runs, a member can upload into their own profile's folder only.

**Touches**: one function (`bulk_scan_guard`, adds "is a member of that profile") and four storage rules on the public `avatars` bucket.

1. Run [1-scan-quota-guard-and-avatar-uploads.sql](sql/1-scan-quota-guard-and-avatar-uploads.sql). Expect "Success. No rows returned".
2. Run [validation-1.sql](sql/validation-1.sql). Expect one row where the first, second and fourth values are `true` and `avatar_policies` is `4`.
3. If anything looks wrong: [rollback-1.sql](sql/rollback-1.sql).

Tested locally in a real in-process Postgres (apply, re-run, validation, rollback; 23 of 23, `scripts/test-batch6-sql-in-postgres.cjs`): a member can read/spend only their own profile's allowance and write only their own profile's avatar folder; other profiles, other accounts, the bucket root and other buckets stay refused.

## File 2: the Market shows the seller's asking price (RC-23)
**What it fixes**: the Market page showed each item's estimated value as if it were the price, because the public items view had no asking-price column. The page already reads the new column when it exists (and labels prices "asking" or "value"); this file adds it.

**Touches**: the public items view `public_vault_items` only: one new last column `asking_price`, filled only for items that are public AND for sale (empty for everything else). Same columns, same public-only rows, same hidden-profile filter, no private column exposed.

1. Run [2-public-view-asking-price.sql](sql/2-public-view-asking-price.sql). Expect "Success. No rows returned".
2. Run [validation-2.sql](sql/validation-2.sql). Expect one row where every value is `true`.
3. If anything looks wrong: [rollback-2.sql](sql/rollback-2.sql) (rebuilds the view without the column).

Tested locally (apply, re-run, validation, rollback; 11 of 11, `scripts/test-view-sql-in-postgres.cjs`) against a stand-in built from the production migrations' own view definitions, including a hidden profile, a private item and a stale asking price on an item that is not for sale.

## File 3: exhibition view counter (RC-27)
**What it fixes**: an exhibition's view counter never goes up for visitors (EXH-283, 284, 285, 292): the page tried to write to the exhibition row, which only its owner's team may do, and the refusal was silent.

**Touches**: adds one function, `record_exhibition_view(gallery id, viewer key)`. For a public, active exhibition it adds one view per distinct viewer key, never counts the exhibition's own team, keeps the keys on the server (not returned to anyone), and does nothing for private or draft exhibitions. No table, column, policy or existing data changes. The site already calls it (and ignores the answer until it exists).

1. Run [3-exhibition-view-counter.sql](sql/3-exhibition-view-counter.sql). Expect "Success. No rows returned".
2. Run [validation-3.sql](sql/validation-3.sql). Expect one row where every value is `true`.
3. If anything looks wrong: [rollback-3.sql](sql/rollback-3.sql).

Tested locally (visitor counts once per viewer key, a second viewer and a signed-in non-member count, the owner's team, private and draft exhibitions do not, bad keys ignored, direct table writes still refused, key list trimmed to 500, validation, rollback; 13 of 13, `scripts/test-views-sql-in-postgres.cjs`). One limit to know: anyone can call it with made-up viewer keys, so the counter is a friendly figure, not a defence against deliberate inflation.

## After you run them
I verify on production with a synthetic account (`scripts/rb26-sql-verify.cjs` for file 1: allowance reads for Personal and Business with nothing spent, avatar upload through the account page and the cross-profile refusals; the Market check for file 2) and update the status files. Nothing else is waiting on these files.
