# Exhibition risks (repair batch 1b): closeout

Commits on `main`: `31334e9` (opening an exhibition no longer saves it), `0b0904f` (a profile move waits for the account), `b5d66d9` (an unconfirmable move says so). Evidence: `repair-batch-1/evidence/rb4-*.json`, rows `RB4-001`…`RB4-028` in `docs/audit-2026-10-18/rows.jsonl`, screenshots under `shots/rb4-*`. Everything ran on production with synthetic fixtures only; the real exhibitions, customer records and visibility were not touched, and the empty exhibition `fbbb6fc7` was not restored.

## 1. Opening or switching profiles does not save or rewrite an exhibition
- Loading is read-only: no share-token creation, no snapshot refresh, no link-row writes. Those belong to an intentional save (Save, edit, publish).
- A save writes the link rows additively: insert what is missing, fix positions, delete only rows that no longer belong (planner tested: `npm run test:exhibit-sync`, 13 checks).
- Items that cannot be loaded are shown as "N NOT LOADED" and never removed from the exhibition.

| Check (production) | Result |
|---|---|
| V1 owner opens every exhibition (stale snapshots, missing token) | PASS: no write request, all five exhibitions identical (ids, snapshots, links, positions, token) |
| V2 other profile active opens every exhibition | PASS |
| V3 profile switched Personal → Business → Personal while open | PASS |
| V4 vault read refused | PASS: nothing removed |
| V5 unrelated viewer and signed-out visitor | first run FAIL (`PATCH galleries` seen); rerun PASS, see note |
| V6 stale-snapshot exhibition refreshed three times | PASS: no write |
| I1 intentional remove of one item | PASS: that one link row removed, nothing else changed |

Note on V5: the only request was the visitor view counter, which writes analytics fields only. The first run counted it as a content write; the rule was corrected to "no write that touches exhibition content" and the first failure is kept (`RB4-005`).

## 2. Moving items between profiles waits for the account
- The item update runs first and is confirmed by reading the rows back (`select … .select("id")`, then a read-back if the answer is lost). Only confirmed ids leave the profile on this device and are removed from exhibitions.
- On a certain failure: items and exhibition membership are left exactly as before, and the message says so. When the account cannot be asked (answer lost and read-back refused): the message says the account did not confirm whether the move happened, and exhibitions stay untouched.

| Check (production, run 5 = final) | Result |
|---|---|
| M1 normal move of 2 items that sit in exhibitions | PASS: Business + private, gone from the exhibitions, a reload agrees |
| M2 save refused | PASS: message says it could not be confirmed; items still Personal, exhibitions unchanged |
| M3 account applied the move but the answer never arrived | PASS: read-back sees it, reported as moved, removed from exhibitions |
| M4 answer lost and read-back refused | PASS: "did not confirm whether the move happened", exhibitions untouched |

First failures are kept: runs 1–2 (`RB4-009`…`016`) failed because the harness could not enter select mode (it only exists in Gallery view, not Wall view); run 3 found a real honesty gap (M4: the account had moved the items but the message said "left exactly as before"), fixed in `b5d66d9`; run 4 failures (`RB4-022`, `RB4-024`) were the harness message-capture not knowing the new wording.

## Observations, not fixed here
- Select mode (needed to move items) is only available in Gallery view, not Wall view.
- One of four exhibitions with stored snapshots will refresh them on its next intentional save instead of on view (trade-off of the read-only load).
- 40 of 47 real exhibitions have no share token (seeded rows); they no longer get one just by being viewed.

## Not atomic yet: proposal, not applied
[`MIGRATION-PROPOSAL.md`](MIGRATION-PROPOSAL.md): one database function for the link rows and one for the move, so each is a single transaction. The shipped fixes do not depend on it.
