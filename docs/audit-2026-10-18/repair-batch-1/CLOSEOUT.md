# Repair batch 1: closeout (RC-01, RC-02, RC-03)

Fixes are live in production and verified with synthetic fixtures only. Frozen audit evidence is untouched (`1372d37`). No customer record, real exhibition, existing description or item visibility was changed. The potentially affected empty exhibition was not restored.

## Commits (all on main)
| Commit | What |
|---|---|
| `a9e23fb` | **RC-01** the page-load "self-heal" is removed from the exhibition editor; items that cannot be shown are counted as "NOT LOADED"; pruning stays only in the confirmed delete workflow and the explicit move-to-profile action; guard test `scripts/test-exhibition-no-prune.cjs` |
| `9c70219` | **RC-02** all eight marketplace builders and the generated listing copy use public fields only; artist-name guessing no longer reads private notes; test `scripts/test-listing-privacy.cjs` |
| `03d6200`, `ce16903` | **RC-02** the readiness checklist and the For Sale readiness score/gaps counted (and the checklist displayed) private notes; now the public description only, labelled "Public description needed." |
| `27d06cd` | **RC-02 dependency (found during verification)** the item normalizer never copied the public `description`, so every load dropped it from the local item and the new public-description logic could never see it; one line added |
| `37ab253` | **RC-03** "Cancel auction" opens one dialog (make private / keep public / go back); starting an auction says it makes the item public |
| `bea0ad3` | **Build fix (my mistake)** see "Deployment incident" |

## Results (production, synthetic fixtures)
**RC-01 (exhibitions): 9 of 9 final checks pass.** Five synthetic exhibitions were compared before and after every scenario (item ids, link rows, public snapshots, all five, plus every write request the page sent). Scenarios: wrong active profile opening every Personal exhibition (the original failure), vault read refused, cloud answers "no items" (success but empty), vault read held 20 s, profile switched Personal → Business → Personal while the page is open, unrelated signed-in viewer (editor and guest addresses), signed-out visitor (guest and share addresses), three refreshes. Result: nothing removed anywhere, no write carrying fewer ids than the database, other exhibitions unchanged. The confirmed delete workflow still works: deleting a synthetic item removes its id from exactly the exhibition that held it and from no other.
**RC-02 (private text): 5 of 5 production checks pass** with unmistakable sentinels: copied text for every marketplace offered (eBay, Mercari, Facebook, Etsy, Whatnot, Icona) contains the public description and neither the private note nor the cost; readiness says "Public description needed." and never shows the note; Generate listing copy produces a draft without the note or cost; Accept saves a description without them; a signed-out visitor's `/share/<id>` (text and page source) contains neither; the private note and purchase price are still stored unchanged. Offline test: 61 checks pass now; run against the old generators the first 55 checks failed 43 times, so it does detect the defect.
**RC-03 (auction): 13 of 13 pass.** Start sheet states "Starting this auction makes the item public."; the question has the exact title, sentence and three buttons and does not claim the earlier state; Go back, Escape and clicking outside change nothing; "make private" saves cancelled + private + back in the collection in one record and survives reload (and a signed-out visitor sees nothing); "keep public" saves cancelled + public (visitor can see it); with the save refused the person is told it is saved on this device, the cloud keeps the old state (nothing half-applied), a reload shows the cancellation locally, and when the connection returns cancellation and visibility arrive together.

## First failures, kept, and why they were not app defects
Eight first-run rows are FAIL and stay in `rows.jsonl` (RB1-005, RB1-009, RB3-010, RB3-011, RB2-001, RB2-002, RB2-007, RB2-008). Evidence files: `evidence/rb1-exhibit-*.json`, `rb2-listing-*.json`, `rb3-auction-*.json`.
- **RB1-009** my check matched ids by substring (`…_2` is inside `…_20`); the database showed the id had left exactly the one exhibition that held it. **RB1-005** the exhibition's snapshot count rose (the page refreshes missing public details), which is an addition, not a removal; the criterion was corrected to "none removed".
- **RB3-010/011** the synthetic profile was private (so even a public item is hidden from visitors by design) and the "saved on this device" notice takes 20 s or more, longer than my 5 s window.
- **RB2-002/008** the check read the owner's own private-notes box as part of the readiness panel. **RB2-001/007** were real: the public description never reached the listing text. Cause: the item normalizer dropped `description` (fixed in `27d06cd`), then the same check passed (RB2-013).

## Deployment incident (my mistake, no customer impact)
The plan commit included `rc02-unit-repro.ts` under `docs/`. Next.js type-checks every `.ts` file, and that file imported `C:/Users/...` paths that exist on my machine but not on Vercel, so the production build for `37ab253` failed while my local build passed. Vercel keeps serving the last good build on failure, so customers saw no change, but the three fixes were not live until `bea0ad3` (renamed to `.ts.txt`). The earlier plan commit `a618cd1` very likely failed to build for the same reason (not confirmed from the Vercel history). A grep confirmed no other tracked TypeScript file imports an absolute path. From now on docs-folder scripts are `.cjs` or `.txt`.

## Historical exposure (read-only; "no current evidence found" is not proof that nothing happened)
- **RC-02:** no current evidence found of private text in published content: 0 saved descriptions contain their own private note, 0 look like generated or pasted listing copy, 0 contain a cost line. Not knowable: listing text that was copied to the clipboard and pasted elsewhere leaves no record.
- **RC-03:** no current evidence found: there are no auction records in production at all.
- **RC-01:** one exhibition cannot be ruled out (public, Business profile, id prefix `fbbb6fc7`, empty, with a cover and uploaded background, 4 views; it was already empty when first read, before the audit). A wipe leaves no trace in the data, so this can be neither confirmed nor excluded. Nothing was restored.

## Residual observations and decisions for review (not changed here)
1. **Opening an exhibition can still write.** Scenario E showed that after a profile switch the page re-saves the exhibition to add missing public snapshot details and replaces its link rows (delete, then insert). Nothing was lost in any scenario, but a delete-then-insert is not atomic; if the insert failed after the delete the links would be gone until the next sync. Worth a separate, small change (make the refresh additive or skip it unless the person edits).
2. **Move to another profile** still removes the moved items from exhibitions immediately and without waiting for the cloud to confirm (explicit action, unchanged).
3. **Cancel auction leaves the old end time on the record** (the cloud keeps `auction_ends_at`), harmless but untidy. Cancel also resets bid counters on the item record.
4. **Auction visibility "remember the previous state"** (so cancel can restore automatically) still needs a stored field, i.e. a migration; not done, as agreed.
5. **For Sale readiness will flag more items** now: those with a private note but no public description.

## Cleanup
Verification fixture dropped by manifest; after 25 s the database reads 3,477 items, 39 profiles, 47 exhibitions (baseline); no QA-named profiles or synthetic accounts remain; scratch browser profiles deleted; `C:\qa-chrome` untouched (66 entries); no audit or test process left running.

## Next: Insurance (batch 2)
Prepared separately in `docs/audit-2026-10-18/repair-batch-2/PLAN.md` (blank printable packet, unreadable print output, inconsistent totals). Not started.
