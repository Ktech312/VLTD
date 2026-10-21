# Proposal: insurance exclusions that follow the account (GIN-095)

**Problem.** "Leave this item out of the insurance documents" is saved in the browser only. Every page says so ("Exclusions are saved on this device only"), so nothing is false, but a second device or browser prints a packet that still includes the item.

**Why it needs SQL.** There is nowhere in the account to keep it today. Putting it in the browser is the only option without a schema change.

**Proposed design.** One small table, `insurance_exclusions (profile_id, item_id, created_at)`, primary key on (profile, item): one row means "this item is left out of this profile's insurance documents". Only members of the profile can read, add or remove rows (the same `is_profile_member` rule that protects its items); no signed-out access; rows cannot be edited, only added and removed. Nothing existing is changed.

**Files (ready, not applied):** [6-insurance-exclusions.sql](sql/6-insurance-exclusions.sql), [validation-6.sql](sql/validation-6.sql), [rollback-6.sql](sql/rollback-6.sql). Tested 12 of 12 in a real local Postgres (`scripts/test-exclusions-sql-in-postgres.cjs`): a member excludes and re-includes, cannot touch another profile, an unrelated account sees and deletes nothing, an anonymous caller is refused, rows cannot be edited, validation passes, rollback removes the table.

**The code change that would follow (after the SQL is run, as its own reviewed commit):**
1. The Insurance pages read exclusions from the account, with the browser copy as the fast first paint (the same device-first, account-confirmed pattern as goals: nothing says "saved" until the account answered).
2. The first time a person opens Insurance after the switch, their existing on-device exclusions are copied into the account (never removed from the device, never overwriting what the account already has).
3. The "saved on this device only" sentence is removed from every Insurance page, and the print/packet pages read the account's list, so a second device produces the same packet.

**Decision for you:** go ahead (I will wire the site after you run the SQL), or keep device-only exclusions and the honest wording as they are.
