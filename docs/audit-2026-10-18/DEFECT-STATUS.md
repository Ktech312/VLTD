# Audit defect status after repair batches 1, 1b and 2 (updated 2026-10-19)

The frozen audit evidence (`rows.jsonl` first-failure rows, `results.csv`, screenshots) is unchanged. This file is the status layer on top of it; `SUMMARY.md` and `root-causes.json` carry the same status tags. "Closed" means re-tested on production with synthetic data after the fix (evidence named). Anything not shown here is still open as written in `SUMMARY.md`.

**Closed so far: 24 specific audit rows** (RC-01: 2, RC-02: 6, RC-03: 2, RC-09: 7, RC-19: 7). Open P1 root causes now: RC-05, RC-06, RC-07 (RC-06 and RC-07 are planned in `repair-batch-3/PLAN.md`).

## 1. Closed findings

### Batch 1 (closeout: `repair-batch-1/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-01 opening another profile's exhibition empties it | EXH-433, CRW-012 | `a9e23fb` | 9 of 9 final checks; `repair-batch-1/evidence/rb1-*` |
| RC-02 private notes and cost basis in public/buyer text | ITM-230, ITM-624, ITM-262, ITM-263, ITM-264, ITM-645 | `9c70219`, `03d6200`, `ce16903`, `27d06cd` | 5 of 5 production checks; `rb2-*` |
| RC-03 cancelling an auction leaves the item public | ITM-253, ITM-634 | `37ab253` | 13 of 13 checks; `rb3-*` |

### Batch 1b: two exhibition risks found while repairing RC-01 (not audit rows; closeout `repair-batch-1b/CLOSEOUT.md`)
| Finding | Commits | Evidence |
|---|---|---|
| Opening or switching profiles re-saved an exhibition and replaced its link rows | `31334e9` | rows RB4-001 to RB4-008 (first failure RB4-005 kept) |
| Moving items between profiles pruned exhibitions before the account confirmed the move (and an unconfirmable move claimed "left as before") | `0b0904f`, `b5d66d9` | rows RB4-025 to RB4-028 (final run; earlier failed runs RB4-009 to RB4-024 kept) |

### Batch 2: Insurance (closeout `insurance-batch2/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-09 blank packet, unreadable and site-bar prints | GIN-122, GIN-123, GIN-227, GIN-228, GIN-229, GIN-230, GIN-231 | `2bd446b`, `9903f96`, `f00ff32`, `67985e1` | actual PDFs and renders, `insurance-batch2/after-fix/` |
| RC-19 totals and counts disagree (part) | GIN-087 (sold counted), GIN-240 / GIN-243 / VLT-297 (Vault Insurance PDF count and content), GIN-260 (cost definition), GIN-097 / GIN-098 (exclusion not applied to report and schedule) | `5ac1d30` | same totals in every document; excluded-by-you run |
| Found during batch 2 verification (not audit rows) | Packet screen controls printed; dark theme painted dark panels behind printed pages; "Open Printable Page" and item-sheet "Print / Save as PDF" labels near-invisible in the dark theme; printable packet unreadable on screen in the dark theme | `9903f96`, `67985e1`, `05322fd` | `insurance-batch2/screens/` (dark and light, 1440 and 390 wide) |

## 2. Partly closed: still open inside RC-19
| Row | Why still open |
|---|---|
| GIN-095 exclusions follow the account | Device-only by decision; every document now says so. Needs the migration below. |
| GIN-092 "See what is missing" count vs Vault | The count now covers owned items only (31 of 31 on the fixture); a like-for-like comparison with the Vault page was inconclusive, so not claimed closed. |
| GIN-155 weekly report "Insurance report (N)" | Different checklist on a different page; not touched. |
| VLT-353 three stale-price numbers | Insights/Vault/Home; not touched. |

## 3. Deferred migrations (proposals, nothing applied)
1. Atomic exhibition links and atomic profile move: `repair-batch-1b/MIGRATION-PROPOSAL.md`. The shipped fixes do not depend on it.
2. Account-synced Insurance exclusions: `insurance-batch2/MIGRATION-PROPOSAL-account-exclusions.md` (SQL `insurance-excluded-column.sql`). GIN-095 stays open until applied.
3. Remembering an item's visibility from before an auction (so Cancel can restore it automatically): needs a stored field; deferred by agreement in batch 1 (RC-03 itself is closed with an explicit choice).

## 4. Unresolved incidents (not defects of the repairs)
1. **Original missing-record attribution.** One real exhibition (public, Business profile, id prefix `fbbb6fc7`, empty, with a cover and background, 4 views) was already empty when first read, before the audit. A wipe leaves no trace in the data, so whether RC-01 emptied it cannot be established. It was not restored. Wording: "no current evidence found", not "ruled out".
2. **Historical exposure of RC-02.** No saved description contains its own private note, a cost line or generated listing copy (read-only check). Text that was copied to a clipboard or posted elsewhere cannot be known.
