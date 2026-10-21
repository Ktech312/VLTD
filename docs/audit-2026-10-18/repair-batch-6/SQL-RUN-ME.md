# Batch 6 SQL: one file to run (RC-11 scan allowance, RC-10 avatar upload)

**What it fixes for people**
- Business profiles and 14 Personal profiles (anyone whose profile id differs from their user id) cannot see or use their AI-scan allowance: the Bulk ticker never shows and scanning is blocked. After the file runs, they can.
- Nobody can upload an avatar picture today (every upload is refused). After the file runs, a member can upload into their own profile's folder only.

**What it touches**: one function (`bulk_scan_guard`, adds "is a member of that profile") and four storage rules on the public `avatars` bucket. No table, column or data changes. Safe to run more than once.

**Run**
1. Open the file [1-scan-quota-guard-and-avatar-uploads.sql](sql/1-scan-quota-guard-and-avatar-uploads.sql), copy all of it into the Supabase SQL editor and run it. Expect "Success. No rows returned".
2. Then run [validation-1.sql](sql/validation-1.sql). Expect one row where the first, second and fourth values are `true` and `avatar_policies` is `4`.
3. If anything looks wrong, run [rollback-1.sql](sql/rollback-1.sql) (restores the original function, removes the four rules).

**Already tested**: the file, a second run, the validation query and the rollback all ran against a real in-process Postgres with synthetic members and profiles whose ids differ from their user ids (23 of 23 checks, `scripts/test-batch6-sql-in-postgres.cjs`): a member can read/spend only their own profile's allowance and write only their own profile's avatar folder; other profiles, other accounts, the bucket root and other buckets stay refused.

**After you run it** I verify it on production with a synthetic account (`scripts/rb26-sql-verify.cjs`: allowance reads for Personal and Business, nothing spent, avatar upload through the account page, cross-profile refusals) and update the status files. Nothing else is waiting on this file.
