> **All five files were run by the owner on 2026-10-21 and verified on production (see `repair-batch-17/CLOSEOUT.md`). This page is kept as the record of what each did.**

# SQL to run (updated 2026-10-21): five files, in this order

RC-05 stage 4 (the old exhibitions-table read) is done and verified (database checks 20 of 20, page matrix 41 of 41), so nothing below waits on it any more.
Run each file once in the Supabase SQL editor, then its check. All are safe to run again. None changes customer data. Each has a rollback.

For each file: open it, paste the whole file, Run. Then open its `validation-N.sql`, Run, and paste me the single result cell. I verify on production with a synthetic account and update the status files.

## File 1: scan allowance + avatar upload. **Run this one first: it closes a hole.**
[1-scan-quota-guard-and-avatar-uploads.sql](sql/1-scan-quota-guard-and-avatar-uploads.sql), then [validation-1.sql](sql/validation-1.sql). Rollback: [rollback-1.sql](sql/rollback-1.sql) (it puts the hole back, so use it only if the app breaks).

**The hole (found while correcting this file, shown on a synthetic profile only):** the live scan-allowance functions let anyone with no session read and spend any profile's AI-scan allowance, because the guard had `auth.uid() is null` as an allowed case and the "anonymous" role could call the functions. With only the site's public key and a profile id, someone could use up another person's monthly scans. No customer's allowance was touched by me.

**What it does:**
- Removes that bypass, and removes the anonymous role's right to call the allowance functions at all.
- The owner of a profile, or a member of it, can read and spend that profile's allowance (this also fixes Business profiles and Personal profiles whose id differs from their user id, who could not use their allowance: RC-11).
- Admins (the owner email and anyone in the user_roles table) can READ an allowance, not spend someone else's. The server's service role can do both.
- Members can write only inside their own profile's avatar folder (RC-10 avatar upload), and nobody else can.

Tested in a real local Postgres, 42 of 42 (`scripts/test-batch6-sql-in-postgres.cjs`): it first shows the anonymous read and spend working on the current rules, then shows them refused after the file, plus members, other accounts, admins, the owner email, the service role, the avatar folders, re-run, validation and rollback.

## File 2: the Market shows the seller's asking price (RC-23)
[2-public-view-asking-price.sql](sql/2-public-view-asking-price.sql), then [validation-2.sql](sql/validation-2.sql). Rollback: [rollback-2.sql](sql/rollback-2.sql).

It no longer rebuilds the public items view from a column list. It wraps the view exactly as it is in production, so every existing column and its order, the public-only rule, the hidden-profile rule, the grants and any view options stay as they are, and `asking_price` is added last (filled only for public items that are for sale). **It stops without changing anything** if the privacy helper `profile_is_hidden(text)` is missing, if the view is missing or no longer filters on `is_public` and on the hidden-profile rule, if the needed columns are missing, or if anon / signed-in people cannot read the view today (it never adds or widens a grant). Tested 24 of 24 in a local Postgres, including each "stops" case leaving the view untouched, view options kept, grants identical, and a rollback that restores the exact previous definition.

## File 3: exhibition view counter (RC-27)
[3-exhibition-view-counter.sql](sql/3-exhibition-view-counter.sql), then [validation-3.sql](sql/validation-3.sql). Rollback: [rollback-3.sql](sql/rollback-3.sql).

Kept separate and run last, as you asked, now that stage 4 has passed. **The number is approximate and can be inflated:** a "viewer key" is a random value the visitor's own browser makes up, so anyone can call the function with made-up keys to raise a public exhibition's counter, and the same person on a new browser counts again. It is a friendly "people looked" figure, not a measurement. The function only ever touches the counter of a public, active exhibition. Tested 13 of 13.

## File 4 (new): goals store an explicit type and unit
[5-goal-type-and-unit.sql](../repair-batch-15/sql/5-goal-type-and-unit.sql), then [validation-5.sql](../repair-batch-15/sql/validation-5.sql). Rollback: [rollback-5.sql](../repair-batch-15/sql/rollback-5.sql).

Adds two empty columns to goals (`goal_type`: items or value, `unit`: items or usd, always matching). Existing goals are not changed and not guessed: they show "needs setup" until the person chooses. **The site already works without this file:** until it runs, the choice a person makes is kept on that device and the page says so; after it runs, the choice is saved in the account and follows them. Tested 8 of 8.

## File 5 (new, for your review): insurance exclusions that follow the account (GIN-095)
[6-insurance-exclusions.sql](../repair-batch-15/sql/6-insurance-exclusions.sql), then [validation-6.sql](../repair-batch-15/sql/validation-6.sql). Rollback: [rollback-6.sql](../repair-batch-15/sql/rollback-6.sql).

One small table: one row per excluded item per profile; only members of the profile can read, add or remove rows; nobody else and no visitor sees anything; rows cannot be edited. **The site is already switched over and works before and after this file:** until it runs, every Insurance page says exclusions are on this device only; after it runs, the first visit to Insurance copies each profile's on-device exclusions up (never removing anything) and the warning goes away. Tested 14 of 14 in a local Postgres; the site's side 25 of 25. Details: [PROPOSAL-insurance-exclusions.md](../repair-batch-15/PROPOSAL-insurance-exclusions.md). After you run it, `rb54-exclusions-account.cjs` proves it on production.

