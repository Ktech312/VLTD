# Insurance exclusions that follow the account (GIN-095): approved, built, waiting for the SQL

**Problem.** "Leave this item out of the insurance documents" was saved in the browser only, so a second device or browser printed a packet that still included the item.

**Decision (EK, 2026-10-21):** go ahead.

**The SQL (for review, not yet run):** [6-insurance-exclusions.sql](sql/6-insurance-exclusions.sql), [validation-6.sql](sql/validation-6.sql), [rollback-6.sql](sql/rollback-6.sql). One small table, `insurance_exclusions (profile_id, item_id, created_at)`, primary key on (profile, item). Only members of the profile can read, add or remove rows (the same `is_profile_member` rule that protects its items); a signed-out visitor and other accounts get nothing; rows cannot be edited. New tables in this project are granted to anon and signed-in people by default, so the file takes everything away first and gives back only select, insert and delete to signed-in people. Nothing existing is changed. Tested 14 of 14 in a real local Postgres (`scripts/test-exclusions-sql-in-postgres.cjs`), including the exact statements the site sends (insert ... on conflict do nothing, delete ... where item_id in (...)).

**What the site does now (already live, works before and after the SQL):**
- Each profile keeps its exclusions on the device (so pages paint at once and work offline) and in the account.
- A change is shown at once, then sent to the account, and is only called saved when the account answered. If the account cannot be reached, the page says "Some exclusions have not reached your account yet" and retries; re-including an item is remembered as "waiting to delete" so a reload cannot bring it back.
- The account's list is read on every Insurance page (the tab, the packet, the print page, the schedule, the report, the per-item sheet and the PDF button), so a second device shows and prints the same thing.
- The first visit after the SQL is run copies each profile's on-device exclusions up. The old browser-wide list is split by profile (a profile adopts only the ids of its own items) and is never deleted. Nothing is removed from the device because the account lacks it, except an item this device itself saw in the account that another device has since re-included.
- Until the table exists (or if the account refuses), exclusions stay on the device and every page says "Exclusions are saved on this device only", exactly as before; once they are in the account that sentence disappears and the not-counted line reads "excluded by you".
- Tested 25 of 25 against the real module (`npm run test:exclusions`: table missing, copy-up, other device's changes, re-included elsewhere, unreachable then recovered, refused, separate profiles, signed out). After you run the SQL, `rb54-exclusions-account.cjs` proves it on production with two browsers and a second account.
