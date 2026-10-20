# Repair batch 3 plan: saves that say "saved" but are not (RC-06 and RC-07)

Status: plan only, nothing implemented. No new audit: every defect below is a confirmed row in `rows.jsonl`; root causes were found by reading the code (file and line named). No database change is needed for any item.

## What was split out, and what was left out
RC-06 (10 rows) and RC-07 (9 rows) are split into **10 individual defects**. Left out on purpose:

| Left out | Why |
|---|---|
| ACC-381, ACC-796 (empty display name), ACC-390, ACC-811 (username "ab"), ACC-395, ACC-819 (username "A B!") | Profile-validation improvements. The value the person typed *was* saved, so no write was lost. They stay in RC-28. |
| ADD-361, ADD-362, ADD-305, ADD-308 | Earlier AI-draft runs measured while another suite was running or after the toast had gone. Superseded by ADD-371 ("the careful run"). |
| ADD-411, ADD-283, ADD-275 | Their PASS results are void (text check matched another word; the test file was refused, so nothing was imported). Replaced by ADD-432 and ADD-365. |
| ADD-267, ADD-272 | Not separate repairs: same cause as D-07 (the import page reads only this browser's copy). Kept as evidence for D-07. |
| The 188 UNRECONCILED first-run rows | Mostly auditor mistakes; they need triage, not repair. Not touched. |

## Priority
Rule applied: first the actions that **tell the person it worked while nothing was stored**, then the ones where the message is true on this device but the account disagrees, then silent loss with no success claim.

### Tier 1: says "saved" / "created", nothing stored
| ID | Defect | Audit rows | Cause (checked in code) |
|---|---|---|---|
| **D-01** | AI draft "Approve & save to vault" shows "Saved to vault!" but the item never reaches the account (it appears only on this browser; the sync page says "no queued changes") | ADD-371 | `src/app/ai/review/page.tsx:174` calls `saveItem()` only. Every other save path also calls `enqueueVaultItemSync` (or `saveItemDurably`); this one never queues the item. Approve itself calls no AI or billing service, so the audit's "possibly intercepted" label does not weaken it. |
| **D-02** | Halls "Save Hall" creates nothing and opens "Exhibition not found" | VLT-256, VLT-288 | `src/app/vault/halls/page.tsx:354` calls `createGallery()`, which only *builds* an object (`galleryModel.ts:1997`). `updateGallery` and `setGalleryItemIds` only change galleries that already exist, so both do nothing. `museum/new` is the only caller that stores the new exhibition (`saveGalleries([...existing, new])`). |
| **D-03** | Creating a goal while the account is unreachable shows "Saved"; after reload the goal is gone | GIN-068 | `src/lib/collectionGoals.ts` `pushGoal` never reads the answer (`{ error }` is ignored; a failed request is swallowed as "best-effort"). A later cloud load replaces the local list with the cloud list, so the unsent goal disappears. |
| **D-04** | Deleting a goal while the delete is refused removes it from the list; after reload it is back | GIN-070 | Same file: `deleteGoal` removes locally, `deleteGoalRow` ignores the answer, and the next cloud load restores the row. |
| **D-05** | A goal target above the database's integer limit shows "Saved" and is lost on reload | GIN-066 | The form accepts any number; the database column is `integer` and refuses 99999999999; the failure is swallowed as in D-03. |

### Tier 2: message true on this device, account disagrees
| ID | Defect | Audit rows | Cause |
|---|---|---|---|
| **D-06** | Import "Undo last" says "Undid 2 items" but they stay in the account and return on reload (works only if they had not uploaded yet) | ADD-357 (ADD-257/258 pass only for not-yet-uploaded items) | `undoLastImport()` in `src/lib/spreadsheetImport.ts:929` removes the items from local storage and the upload queue only. The confirmed delete that already exists (`deleteVaultItemsEverywhere`, `src/lib/vaultActions.ts:128`) is not used. |
| **D-07** | "Skip exact titles already in vault" imports a duplicate when this browser has not loaded the vault yet (second device, fresh browser); the page also says "Vault is empty" and counts 0 matches | ADD-365 (evidence ADD-267, ADD-272) | `SpreadsheetImportClient.tsx:185` builds the duplicate list from `readVaultForActiveProfile()`, the local copy only; the page never loads the account's items first. |

### Tier 3: silent loss, smaller
| ID | Defect | Audit rows | Cause |
|---|---|---|---|
| **D-08** | Bulk upload: choosing 62 photos takes 60 and says nothing about the other 2 (the cap is also applied per pick, not in total; non-image files vanish too) | ADD-432 | `src/app/vault/bulk/page.tsx:185` `.slice(0, MAX_FILES)` per call, no message. |
| **D-09** | `/capture`: leaving with a typed item discards it with no warning | ADD-035 | No `useUnsavedChangesGuard` on the page (the Add page has one). |
| **D-10** | `/capture`: reloading with a typed name discards it | ADD-037 | Same missing guard (a reload prompt, not a restored draft). |

## Fix per defect
- **D-01** Approve: `await saveItemDurably(item)` (writes locally, queues, uploads, tells whether it is still pending). The toast says "Saved to your vault" only when the upload is done; otherwise "Saved on this device. It will upload when the connection is back." The draft becomes CONVERTED only after the local write succeeds.
- **D-02** Build the exhibition with the title, the selected item ids and visibility LOCKED, then store it once with `saveGalleries([...existing, hall])` like `museum/new`; check the exhibition limit the same way `museum/new` does (message if reached); confirm it can be read back before opening it, otherwise say it was not created and stay on the page.
- **D-03/D-04/D-05** Goals writes become confirmed: `upsert/delete ... .select()` and check the answer. On failure the goal is kept as "waiting to upload" (marked, retried through the existing `cloudSaveStatus` pill and retry timer by adding a "goals" source) with the sheet saying so; a delete that fails restores the goal with a plain message; a deleted goal id is remembered until the cloud confirms so a cloud load cannot bring it back; the cloud load must not overwrite goals that are still waiting. `updateGoal` gets the same treatment (same function family). Target: refuse a value above the database maximum (2,147,483,647) in the sheet with a plain message (the limit is the database's; a smaller product cap can be set later).
- **D-06** Undo: remove unsent items from the queue first, then `deleteVaultItemsEverywhere(ids)` for the rest; keep the history entry until the account confirms; message states what happened ("Undid 2 items" / "Removed 1; 1 could not be removed from your account and is still there").
- **D-07** On opening the import page, load the account's items (the same sync the Vault runs) and show "checking your vault…" while it runs; if the account cannot be read, "Skip existing" says it cannot check and offers Import all or Retry instead of importing blind. Duplicate and Recent lists then use the account's items.
- **D-08** Cap the total (queued + picked) at 60, and say "N photos were left out (60 at a time)" and "M files were not photos".
- **D-09/D-10** Add `useUnsavedChangesGuard` to `/capture` when the form holds typed data or photos (same words as the Add page); this covers Vault-link navigation, back button and reload prompt.

## Verification (production, synthetic fixture, nothing real touched, no AI spend)
Each defect gets: the original failing steps, the normal-path pass, the interrupted-request case (blocked or refused request through the test harness, labelled simulated), a reload, and a second clean browser reading the account.
- D-01: seeded draft approved; item row in the account within 90 s; second browser shows it; with `vault_items` writes refused: honest "saved on this device" message, sync pill pending, row appears after the block is lifted and the page reloaded.
- D-02: exhibition row and one link row per selected item in the account; opens with the items; limit-reached case; unrelated exhibitions unchanged.
- D-03/D-04/D-05: create/delete with requests refused (message shown, goal state matches after reload and after the block is lifted), huge target refused with message, normal create/delete persist; goals of another profile untouched.
- D-06: import 2, wait until uploaded, Undo: rows gone in the account after 20 s and after reload; undo before upload still works; undo with delete refused: items stay and the message says so.
- D-07: second clean browser, existing title skipped (no second copy after 60 s); account unreadable case shows the cannot-check message.
- D-08: 62 files (and 60 + 5 picks), message names the number left out. D-09/D-10: leave and reload prompts appear with typed data and not on an empty form.
Unit tests added with each fix (pure parts: goals write planner, bulk cap, undo planner, hall builder) in the existing `scripts/test-*.cjs` style; `npm run build`, eslint and tsc clean before each push.

## Order and checkpoints
1. D-01, D-02 (two small, isolated writes) 2. D-03, D-04, D-05 (one shared goals change) 3. D-06, D-07 (import page) 4. D-08, D-09, D-10. Focused commits, push to main when clean, production check after each group. Checkpoint after group 2.

## Risks and notes
- D-02 and D-06 can touch exhibitions through the existing confirmed delete and the existing store; both reuse code already verified in batch 1b, no new pruning logic.
- D-03/D-04 add a local "waiting" state for goals; it uses the same status pill as items, so the person sees one consistent answer.
- Not in this batch: profile-validation messages (RC-28), goal progress/labels (RC-20), the install banner covering controls (RC-14).
