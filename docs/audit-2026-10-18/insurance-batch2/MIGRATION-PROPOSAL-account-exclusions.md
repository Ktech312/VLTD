# Proposal (NOT applied): Insurance exclusions that follow the account

Status: proposal only. Nothing here has been run, and the Insurance print-repair batch changes no storage or schema. Today an exclusion ("leave this item out of the insurance documents") is saved **in the browser** under `vltd_insurance_excluded_item_ids_v1`. It does not follow the account to another device or browser, and every Insurance document now says so ("Exclusions are saved on this device only. They do not follow your account.").

## Recommendation: one column on the item row
File: [`insurance-excluded-column.sql`](insurance-excluded-column.sql) (one statement: `vault_items.insurance_excluded boolean not null default false`).

Why a column and not a new table:
- The exclusion is a fact about one item and moves with it (profile move, export, delete) with no extra clean-up.
- It is written by the same item save that already runs, under the same row-level security (owner only). No new policy, no new function.
- Default `false` means every existing row stays counted exactly as today. Adding a column with a constant default is a metadata-only change on Postgres 11+; it does not rewrite the table.

## What the app change would be (after the SQL is run)
1. Item model + `vaultCloud` mapping read/write `insurance_excluded`; the Insurance pages read it from the item instead of the localStorage set.
2. **One-time merge, never a loss:** on first load after the change, any ids still in the local set are written to the account as `insurance_excluded = true` (union, nothing is ever un-excluded by the merge), then the local key is cleared. If the write fails, the local set is kept and the documents keep saying "this device only".
3. The "device only" wording is removed only when the column exists and the merge has finished.
4. The public item whitelist (listing/exhibit public columns) is a whitelist, so the new column is not exposed to visitors unless someone adds it; a test would assert that.

## Risks and checks before running
- Run on a copy first or confirm the column is absent: `select column_name from information_schema.columns where table_name='vault_items' and column_name='insurance_excluded';` (expect 0 rows).
- If the app is deployed before the column exists, the existing "missing column" handling in `vaultCloud` drops unknown columns from the upsert with a console warning (it must be checked in a test, not assumed).
- Rollback: `alter table public.vault_items drop column insurance_excluded;` loses only the exclusion flags (the local copy was cleared only after a confirmed write, so deploy the merge step only once the column is verified).

## Not decided here
Whether exclusions should also exist per profile (Personal vs Business). The column above follows the item, and items already belong to exactly one profile, so profile separation is preserved without extra work.
