# Live status (updated as work completes; a checkpoint is not a request to stop)

Last updated: 2026-10-21.

## Waiting on you (external, one item)
- **RC-05 stage 4 SQL**: one ready package, `repair-batch-5/STAGE4-RUN-ME.md`. Nothing else is blocked on it; work continues meanwhile.

## Done and verified on production
- Batches 1 to 4 and the batch-4 gap closure (see their CLOSEOUT files); RB10-024 (Vault card value box).
- RC-05: alias and shelf-style persistence, honest Announce / Make public messages, event privacy (stage 1), sanitised view and link responses (stage 2), public-view consumers and cache ownership (stage 3, all nine consumers including the admin page, verified with a disposable QA admin, role and factor removed and verified).
- `test:isolation` repaired (real network-failure rule and the goal rules module wired into the test; 85 checks pass, assertions unchanged).

## Queue (order: data loss / private exposure / false "saved", then Insurance and core workflows, then figures / search / filters / misleading actions, then navigation and interaction, then cosmetics)
See `root-causes.json` for IDs; each batch below gets its own CLOSEOUT.
