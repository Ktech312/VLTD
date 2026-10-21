# Audit defect status after repair batches 1, 1b and 2 (updated 2026-10-19)

The frozen audit evidence (`rows.jsonl` first-failure rows, `results.csv`, screenshots) is unchanged. This file is the status layer on top of it; `SUMMARY.md` and `root-causes.json` carry the same status tags. "Closed" means re-tested on production with synthetic data after the fix (evidence named). Anything not shown here is still open as written in `SUMMARY.md`.

**Closed so far: 71 specific audit rows through batch 5; batches 6 and 7 add 24 + 24 more (see the last sections)** (RC-01: 2, RC-02: 6, RC-03: 2, RC-09: 7, RC-19: 7, RC-06: 10, RC-07: 3, RC-17: 20, RC-18: 9, RC-05: 5). Open P1 root causes: RC-05 (untouched) and the six profile-validation rows of RC-07 (kept with RC-28). **Insurance is not fully closed** (section 2 and the open items RC-14 and RC-31).

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

### Batch 3: save and import failures (closeout `repair-batch-3/CLOSEOUT.md`)
| Root cause | Audit rows closed | Defect IDs and commits | Evidence |
|---|---|---|---|
| RC-06 silent data loss in Add / Import / Halls | ADD-371 (D-01), VLT-256 and VLT-288 (D-02), ADD-357 (D-06), ADD-365, ADD-267 and ADD-272 (D-07), ADD-432 (D-08), ADD-035 (D-09), ADD-037 (D-10) | `20b1461`, `87154b8`, `d2597c7`, `0942548`, `f4761cb`, `292847c`, `96677b9`, `f332a51` | rows RB6-029 to RB6-137 |
| RC-07 writes that look saved but are lost | GIN-066 (D-05), GIN-068 (D-03), GIN-070 (D-04) | `14661a8`, `748ab2b`, `f4761cb` | rows RB6-052 to RB6-137 |

Still open inside these: RC-07's six profile-validation rows (ACC-381, ACC-796, ACC-390, ACC-811, ACC-395, ACC-819) stay with RC-28. ADD-272 and the cross-account Capture draft are now verified (RB6-118, RB6-078). Goal ownership with cloud goals present is verified (RB6-120 to RB6-125; a first check recorded it only as an observation and RB6-138 corrects that: it was a failing case, fixed in `f4761cb`). Open elsewhere, unchanged: **RC-14** install-banner overlap and **RC-31** small tap targets.

### Batch 4: money inputs and sales agreement (closeout `repair-batch-4/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-17 letters, blanks and negatives become money; numbers parsed wrongly | ADD-005, ADD-115, ADD-404, ADD-139, ADD-141, ADD-142, ADD-164, ITM-070, ITM-558, ITM-294, ITM-306, ITM-044, ITM-529, ITM-292, ITM-227, ITM-308, ITM-248, ITM-249, ITM-629, ITM-630 (20 of 20) | `97c1e9b`, `a07fabc` | rows RB9-147 to RB9-217 (Quick Add manual path included) |
| RC-18 sales ledger and profit figures break the value rule or disagree | ITM-354, ITM-353, ITM-357, ITM-364, ITM-333, ITM-430, ITM-666, ITM-043, ITM-527 (9 of 9) | `8eea0fc`, `b38f5f7` | rows RB9-188 to RB9-217; clean second browser RB9-204, RB9-205 |

Final deployed commit `b38f5f7`. Two defects in the first fix were found by the production recheck and fixed (Add page showed no refusal message; ledger loader turned a blank cost into 0); first-run rows RB9-002 to RB9-005 and RB9-066, RB9-068, RB9-074 are kept and explained by rows RB9-218 to RB9-221. Not claimed: Quick Add has no before/after pair (checked after the fix only). A second pass drove Bulk `1e3` and the Vault card Sell button directly on production (RB10-011 to RB10-022). **New, not fixed:** the value box on a Vault card still uses an old lenient parser (RB10-024, found by code reading, no audit row).

### Batch 5: Vault-card value box and RC-05 (closeout `repair-batch-5/CLOSEOUT.md`)
| Item | Rows / defect | Commits | Evidence |
|---|---|---|---|
| Vault-card value box (RB10-024, no audit row) | letters, 1e3, 1,5 and negatives refused; explicit 0 saved; blank leaves the value | `37081c7` | RB11-001 to RB11-009 |
| RC-05 alias and shelf-style edits do not persist | EXH-165, EXH-123, EXH-124, EXH-126, EXH-127 (closed) | `525438b` | RB12-017 to RB12-019 |
| RC-05 Announce / Make public report success after a refused write | EXH-179, EXH-161: reporting fixed (message stays until next action; one accurate publish message); the notice itself cannot be recorded until migration file 1 | `525438b`, `5c79c31`, `3ff509e` | RB12-020, RB12-021 |
| Discover shows the real collector under an alias (same family) | not an audit row | `d1b6293` | RB13-001, RB13-002 |

Migration-blocked (stage-0 production output reviewed 2026-10-21: matches; stage 1 cleared, stages 2-4 not authorised; `repair-batch-5/STAGE0-REVIEW.md`; nothing applied; SQL package revision 2, staged order in `MIGRATION-PROPOSAL-RC05.md`): the refused follower-notice insert and the required alias/private/draft protection of events (stage 1), EXH-281 and the public-data privacy of exhibitions (stages 2 to 4: allowlist view, site change, then closing the old table read). Not fixed, recorded: the profile page lists no exhibitions at all (wrong column names); an alias gives no anonymity against item/content matching; the other lenient money parsers (text import copy, AI-draft review, auction bid, watchlist target: rows RB15-001 to RB15-004, recorded as separate findings, not repaired).

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

### Batch 6: admin gate, legacy API, sign-out, account/exhibition forms (closeout `repair-batch-6/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-08 admin Themes / Studio shown to everyone | CRW-001, ACC-396, ACC-439, ACC-515, ACC-405, ACC-459, ACC-528 | `9c4bcc8` | RB23-001 to 004 (admin-positive path not exercised on production) |
| RC-33 legacy /api/vault/[id] open to anonymous writes | CRW-027 | `29e18cb` | RB23-005, 006 |
| RC-04 failed sign-out request looks like a sign-out | ACC-850, ACC-286, ACC-344 | `67d037e` | RB23-015, 016 |
| RC-07 profile validation (rest of the group) | ACC-381, ACC-796, ACC-390, ACC-811, ACC-395, ACC-819 | `86ed798` | RB23-007 to 011 |
| RC-28 create/profile form validation | EXH-076, EXH-063, EXH-077, ACC-869, ACC-870, ACC-808, ACC-817 | `86ed798`, `cad5cc5` | RB23-010, 012 to 014, 017; RB24-001 to 004 |

### Batch 7: core workflows (closeout `repair-batch-7/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-13 header search / palette | ACC-230, ACC-232, ACC-244, ACC-311, ACC-875, ACC-243, ACC-309, ACC-844 | `065f152`, `baac35b`, `62df159`, `d046ae6` | RB27 |
| RC-14 install pill covers controls | ADD-235, ADD-379, ADD-380, ITM-424, ITM-425, ACC-832 | (same commits) | RB27-045..048 |
| RC-15 phone exhibitions sheet | EXH-381 to EXH-389 | (same commits) | RB27-038..044 |
| RC-12 subject leaderboards (part) | DIS-346 | (same commits) | RB25-006..009 |

### Batch 8: silent camera / image / PSA failures (closeout `repair-batch-8/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-16 (14 of 16) | ADD-197, 218, 237, 200, 202, 204, 465, 394, 395, 474, 195, 424, 190, 417 | `1c7dec1`, `9d52e16` | RB28, RB29 (open: ADD-415 needs the SQL, ADD-168 is a decision) |

### Batch 9: failed loads and Goals (closeout `repair-batch-9/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-21 (26 of 26) | VLT-434, 484, 485, 343, 437, 086; GIN-067, 188, 193, 196, 197, 069; DIS-086, 267, 268, 359, 360, 159, 154; ACC-599, 738, 647, 748; ITM-615; CRW-005, 006 | `d5a7ec7`, `1e7c19f`, `b8a2aa6` | RB30, RB32, RB33 |
| RC-20 (10 of 22) | GIN-001, 013, 025, 029, 030, 031, 032, 033, 041, 237 | `3064380` (Goals) | RB31 (open: the 12 type-guessing rows, a decision) |

### Batch 10: clean-browser direct loads (closeout `repair-batch-10/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-22 (9 of 9) | EXH-001, EXH-064, GIN-174, GIN-216, VLT-232, VLT-233, ACC-418, ACC-848, ACC-849 | `294ca45` (and `d5a7ec7` for the two report pages) | RB34 |

### Batch 11: Watchlist, Market, Favorites (closeout `repair-batch-11/CLOSEOUT.md`)
| Root cause | Audit rows closed | Commits | Evidence |
|---|---|---|---|
| RC-23 (13 of 15) | DIS-144, 145, 146, 147, 149, 213, 085, 234, 235, 236, 238, 240, 241 | `0b9a57e` | RB35, RB36 (open: DIS-233 and DIS-242 need SQL file 2) |
