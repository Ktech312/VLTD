# Repair batch 3 closeout: D-01 to D-10 (RC-06 and RC-07 save/import failures)

Production, synthetic fixture only, prepared AI drafts (no AI call made or allowed), requests blocked or answered by the test harness are labelled SIMULATED (they test the app's handling of a failure, not a real outage). Original audit rows (`ADD-357`, `ADD-365`, `ADD-371`, `ADD-432`, `ADD-035`, `ADD-037`, `VLT-256`, `VLT-288`, `GIN-066`, `GIN-068`, `GIN-070`) are untouched in `rows.jsonl`. New rows `RB6-001` to `RB6-077`; evidence JSON in `evidence/`, screenshots in `../shots/rb6-*`, scripts in `scripts/`.

## Result table
| ID | Defect | Deployed commits | Result on production | Final evidence rows |
|---|---|---|---|---|
| D-01 | AI draft approval claimed "Saved" without queuing the upload | `20b1461`, `87154b8` | **PASS**: 3 rapid clicks give one item, in the account and in a clean second browser; account blocked: "Saved on this device. Sync pending", nothing in the account while blocked, uploads after reconnect; answer lost: still exactly one item | RB6-044, 046, 048 |
| D-02 | Save as Hall created nothing | `20b1461` | **PASS**: opens the hall, one exhibition row with all 11 links, 3 rapid clicks make one hall, a clean second browser lists it; account blocked: stored on the device, nothing in the account, uploads later | RB6-009, 011 |
| D-03 | Goal create said Saved, then vanished | `14661a8`, `748ab2b` | **PASS**: normal create (one goal after 3 clicks, reload, clean browser, not in the Business profile); account blocked: "Sync pending" notice, survives reload, Retry now uploads once and clears the notice; answer lost: one goal; refused (403): not kept, form kept | RB6-059, 061, 063, 064 |
| D-04 | Goal delete failure reappeared silently | `14661a8` | **PASS**: normal delete; blocked: hidden, says sync pending, does NOT reappear after a reload, Retry now deletes it in the account; refused (403): goal back with a message | RB6-065, 067, 069 |
| D-05 | Goal target above the database limit | `14661a8` | **PASS**: 99,999,999,999 / 2,147,483,648 / 2.5 / 1e3 / 0 / -4 refused with a message, sheet and form kept, nothing stored or listed; 2,147,483,647 accepted | RB6-052, 054 |
| D-06 | Import Undo left uploaded items in the account | `d2597c7`, `0942548` | **PASS**: removes exactly that import's rows (a same-title item the import did not create stays), gone after reload and in a clean browser; an item edited since is named first and can be kept; one refused delete: "Removed 1 of 2 … 1 is still there", Undo stays available and finishes it; account blocked: "Removed 0 of 2"; another profile is not offered the import | RB6-068, 070, 071, 072, 073 |
| D-07 | Skip existing titles blind to the account | `d2597c7` | **PASS**: clean second browser skips the existing title and "Recent" is filled from the account; account unreadable: banner, confirm-step warning and a result line saying duplicate detection was incomplete; a not-yet-uploaded copy counts as existing | RB6-074, 075, 076 |
| D-08 | Bulk dropped files over 60 silently | `292847c` | **PASS**: 62 files: 60 taken, the 2 named; limit counts what is queued; non-photo files named; choosing writes nothing | RB6-029 to 032 |
| D-09 | Capture draft lost on leaving | `f332a51` | **PASS** with one claim unverified (below): restored after leaving to the Vault and after a refresh, with a notice and no AI request; scoped to account and profile; other profile sees none; Discard clears it; Save clears it | RB6-053, 055, 056, 058 |
| D-10 | Capture draft lost on refresh | `f332a51` | **PASS**: name and photo restored after refresh, no AI request | RB6-057 |

Regression tests: `scripts/test-repair-batch3.cjs` (67 checks, `npm run test:repair-batch3`, commit `50ac10e`, extended in `0942548`); the spreadsheet importer's own 40 checks still pass.

## Real defects found by this verification (fixed, first failures kept)
- **D-01** with the account unreachable the page said nothing while the queue retried: now waits at most 6 seconds, then "Saved on this device. Sync pending" (RB6-002 FAIL, fixed `87154b8`).
- **D-06** the first change check flagged every untouched import as "edited" (loading from the account fills in categories and defaults): now compares normalised editable fields of the stored record (RB6-020, 022, 024, 026 FAIL, fixed `0942548`).
- **D-03** after a successful automatic retry the "waiting to upload" notice could stay: the page now follows the status pill and retry timer (RB6-042 FAIL, fixed `748ab2b`).

## First failures that were test mistakes (kept)
RB6-004, 006, 007 (selected-count read before the results loaded); RB6-014, 016 (leftover synthetic goal from my own aborted run with the same name); RB6-018, 019 (read the sheet's label after it had closed itself); RB6-015, 017, 062, 066 (status line read too early; an import that first re-checks an unreachable account takes about a minute); RB6-027 (toast already gone).

## Not verified, said plainly
- **D-09 another signed-in account on the same browser** (RB6-077, NOT TESTED): the draft key carries the account id and the profile id, the scope is unit-tested, and switching profile on one browser shows no draft. Swapping the stored session to another user id made the app leave /capture, so that attempt proves nothing (RB6-041 and RB6-060 kept as inconclusive). A real second account signed in on one browser was not exercised.
- **ADD-272** ("Vault Matches" tile for an existing title) was not rechecked; its cause (the page never read the account) is fixed and RB6-074 shows the account's items in use.
- **D-06 moved and in-exhibition flags** are unit-tested (`importUndo`), not exercised on production; edited-record flag, partial failure, blocked account and profile isolation were.

## Still open, under their existing audit IDs (not touched here)
- Insurance is **not** fully closed: `GIN-092`, `GIN-095` (needs the proposed migration), `GIN-155`, `VLT-353` remain open; the install banner over controls (`RC-14`) and small tap targets (`RC-31`) remain open.
- RC-07's six profile-validation rows (`ACC-381`, `796`, `390`, `811`, `395`, `819`) stay with RC-28 as planned.

## Cleanup
Fixture dropped by manifest; leftover check found no `QA RB6` items, halls, goals or `ai_rb6_` rows; after 20 s the database reads 3,477 items, 39 profiles, 47 exhibitions (baseline); no QA-named profiles; `Temp\qa-c` scratch profiles deleted; `C:\qa-chrome` untouched (66 entries); no audit browser left running.
