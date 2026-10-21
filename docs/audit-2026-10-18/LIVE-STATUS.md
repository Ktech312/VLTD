# Live status (updated as work completes; a checkpoint is not a request to stop)

Last updated: 2026-10-20.

## Waiting on you (external, two ready files; nothing else is blocked)
- **RC-10 / RC-11 SQL** (avatar upload, Business-profile scan allowance): `repair-batch-6/SQL-RUN-ME.md`.
- **RC-05 stage 4 SQL**: one ready package, `repair-batch-5/STAGE4-RUN-ME.md`. Nothing else is blocked on it; work continues meanwhile.

## Done and verified on production
- Batches 1 to 4 and the batch-4 gap closure (see their CLOSEOUT files); RB10-024 (Vault card value box).
- RC-05: alias and shelf-style persistence, honest Announce / Make public messages, event privacy (stage 1), sanitised view and link responses (stage 2), public-view consumers and cache ownership (stage 3, all nine consumers including the admin page, verified with a disposable QA admin, role and factor removed and verified).
- **Batch 6 (2026-10-20)**: RC-04, RC-07, RC-08, RC-28, RC-33 closed and re-tested on production, 21 of 21 checks (`repair-batch-6/CLOSEOUT.md`).
- **Batch 7 (2026-10-20)**: RC-13, RC-14, RC-15 closed; RC-12 and RC-11 code halves shipped; all re-tested on production (`repair-batch-7/CLOSEOUT.md`).
- **Batch 8 (2026-10-20)**: RC-16 (silent camera / image / PSA failures) 14 of 16 rows closed and re-tested on production (`repair-batch-8/CLOSEOUT.md`).
- **Batch 9 (2026-10-21)**: RC-21 closed (26 of 26 rows: a failed load is never shown as an empty collection); RC-20 plain Goals defects closed (10 of 22; the rest needs explicit goal types, a decision). `repair-batch-9/CLOSEOUT.md`.
- **Batch 10 (2026-10-21)**: RC-22 closed (direct loads in a clean browser show the account's data; exports never empty). `repair-batch-10/CLOSEOUT.md`.
- `test:isolation` repaired (real network-failure rule and the goal rules module wired into the test; 85 checks pass, assertions unchanged).

## Queue (order: data loss / private exposure / false "saved", then Insurance and core workflows, then figures / search / filters / misleading actions, then navigation and interaction, then cosmetics)
See `root-causes.json` for IDs; each batch below gets its own CLOSEOUT.
