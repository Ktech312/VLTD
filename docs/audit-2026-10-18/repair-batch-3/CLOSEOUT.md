# Repair batch 3 closeout: D-01 to D-10 (RC-06 and RC-07 save/import failures)

Final status, after the follow-up testing. Everything ran on production with synthetic fixtures only; prepared AI drafts (no AI call made or allowed); requests blocked or answered by the test harness are labelled SIMULATED (they test how the app handles a failure, not a real outage). The original audit rows (`ADD-357`, `ADD-365`, `ADD-371`, `ADD-432`, `ADD-035`, `ADD-037`, `ADD-272`, `VLT-256`, `VLT-288`, `GIN-066`, `GIN-068`, `GIN-070`) are untouched in `rows.jsonl`. New rows `RB6-001` to `RB6-137`; evidence JSON in `evidence/`, screenshots in `screens/` and `../shots/rb6-*`, scripts in `scripts/`.

"Device-seeded" means the starting state on the browser was written directly (for example an older device-only goal, or an exhibition membership); the action, the upload, the reload and the clean second browser were then driven through the real UI and read back from the database. Every other row starts from the real UI.

## Final table
| ID | Defect | Deployed commits | Status | How verified | Final evidence rows |
|---|---|---|---|---|---|
| D-01 | AI draft approval claimed "Saved" without queuing the upload | `20b1461`, `87154b8` | **PASS** | UI + database: 3 rapid clicks give one item, clean second browser, account blocked (SIMULATED), answer lost (SIMULATED) | RB6-044, 046, 048 |
| D-02 | Save as Hall created nothing | `20b1461` | **PASS** | UI + database: one exhibition with all 11 links, 3 rapid clicks make one hall, clean second browser, account blocked (SIMULATED), exhibition limit reached refused and under the limit created (account tier set to FREE then MID in the database, restored to FULL) | RB6-009, 011, 091, 093 |
| D-03 | Goal create said Saved, then vanished | `14661a8`, `748ab2b`, `f4761cb` | **PASS** | UI + database: normal, blocked (SIMULATED), answer lost (SIMULATED), refused (403, SIMULATED); reloads, clean second browser, other profile does not see it. Rerun after the ownership change (`f4761cb`). **Plus goal ownership, see below.** | RB6-130, 131, 133, 134; ownership RB6-120, 122 to 125 |
| D-04 | Goal delete failure reappeared silently | `14661a8`, `f4761cb` | **PASS** | UI + database: normal, blocked (SIMULATED, does not reappear after reload, Retry now deletes it), refused (403, SIMULATED); rerun after `f4761cb` | RB6-135, 136, 137 |
| D-05 | Goal target above the database limit | `14661a8` | **PASS** | UI + database: six invalid values refused with the form kept, 2,147,483,647 accepted; rerun after `f4761cb` | RB6-127, 128 |
| D-06 | Import Undo left uploaded items in the account | `d2597c7`, `0942548` | **PASS** | UI + database: exact ids only (a same-title item that was not imported stays), edited item named first, one refused delete reported as "Removed 1 of 2", account blocked (SIMULATED), other profile not offered the import. Moved item (the app's own Move action) and an exhibition item are named in the prompt: the move is real UI; **the exhibition membership was device-seeded** | RB6-068, 070 to 073, 105, 106 |
| D-07 | Skip existing titles blind to the account | `d2597c7`, `f4761cb` | **PASS** | UI + database in a clean browser with populated account data; account unreadable (SIMULATED) says duplicate detection is incomplete; a not-yet-uploaded copy counts as existing. **ADD-272 (the "Vault Matches" tile) now verified, see below.** Rerun after `f4761cb` | RB6-126, 129, 132; tile RB6-118, 119, 121 |
| D-08 | Bulk dropped files over 60 silently | `292847c`, `96677b9` | **PASS** | UI + database: 62 files (60 taken, 2 named), limit counts queued photos, non-photos named, nothing written until commit | RB6-029 to 032 |
| D-09 | Capture draft lost on leaving | `f332a51` | **PASS** | UI: restored after leaving and after refresh with a notice and no AI request; scoped to account and profile; a **real second account** signed into the same browser sees no draft and keeps its own, and the first account's draft is still there on return (replaces the earlier NOT TESTED row RB6-077); Discard and Save clear it | RB6-053, 055, 056, 058, 078 |
| D-10 | Capture draft lost on refresh | `f332a51` | **PASS** | UI: name and photo restored after refresh, no AI request | RB6-057 |

Screens of the new UI on a 390 px phone and at 1440 px, dark and light themes, reviewed by eye: readable, inside the viewport, no sideways overflow (RB6-117; screenshots in `screens/`). The script's rough contrast figure was wrong for the dark theme (rows RB6-082, 085, 095, 097, 107, 109 FAIL kept).

## Goal ownership: what the ignored goal was, and the fix
The goal my earlier check saw ignored (RB6-081, which I first recorded only as an "observation") was an **older device-only goal with confirmed ownership**: it sat in this profile's own list on the device, was not waiting to upload, and was not in the account. Ownership is confirmed because goals are stored per profile and a different person's data is moved aside when someone else signs in (`localDataOwner`). It was not a pending goal and not an unlabelled legacy goal. When the account already held goals, the account's list silently replaced the device list and that goal was dropped: **a failing sync case, not a pass**. Fixed in `f4761cb`:
- Goals are matched by id. The account's goals, the goals still waiting to upload, and goals that exist only on the device under this profile are all kept; device-only goals are queued and uploaded; a pending deletion stays hidden; no duplicates.
- A goal this device itself saw in the account and the account no longer holds was deleted on another device: it is not brought back. This is only trusted when the account answered with goals; an empty answer may be a lapsed session, so nothing is dropped then (the goals are kept and owed to the account).
- The device-wide list of an older version (stored under no profile) is adopted only when the device has recorded this signed-in person as its owner. Otherwise it is kept untouched, never adopted and never uploaded.
- The lists of pending, deleted and seen-in-account goal ids are now parked with the rest of a person's data when someone else signs in.

Verified with cloud goals already present (the fixture account holds 3), device-seeded state, then UI and database:
| Case | Result | Row |
|---|---|---|
| Online: 2 older device-only goals, 1 pending goal, 1 goal deleted on another device, 1 pending deletion | **PASS**: list = account goals minus the pending deletion, plus both device-only goals and the pending goal; the deleted-elsewhere goal not brought back; the device-only and pending goals reach the account once each; the pending deletion done; reload and a clean second browser agree; no notice left | RB6-120 |
| Account unreachable at load, then reconnect | **PASS**: offline every goal the device holds stays listed (the pending deletion hidden), notice says sync pending, nothing uploaded; after reconnect and a reload everything uploaded once, the deleted-elsewhere goal gone, notice cleared, clean browser agrees. Offline the deleted-elsewhere goal is still listed (the device cannot know) and disappears after the first successful read | RB6-122 |
| Uncertain ownership: the device records another person as owner | **PASS**: not listed, not uploaded, kept (moved aside) | RB6-123 |
| Uncertain ownership: no recorded owner and a profile this person does not own on the device | **PASS**: not adopted, not uploaded, kept separately (unattributed) | RB6-124 |
| Confirmed: the device records this person as owner | **PASS**: adopted next to the account's goals and uploaded once each | RB6-125 |

Not reproduced on screen: the new note on the Goals page ("N goals saved by an older version cannot be matched to your account, so they were not added") only shows while ownership is unsettled, and no production state keeps it on screen (the settled cases above move the data aside instead). It is covered by a static test only. Within the uncertain cases the data is kept; there is no button to adopt it (that would be new design).

## ADD-272: the "Vault Matches" tile
Verified through the real tile in a clean browser with 31 items in the account (rows RB6-118, 119, 121). The CSV held an exact existing title, the same title with a different serial number, and a new title:
- Vault Matches showed **1** (only the exact title + serial match; the documented rule treats a different serial as a different piece), Likely Matches 2, Batch Duplicates 0.
- Skip exact titles already in vault: the existing title was not copied again, the different-serial piece and the new title were imported once each.
- While the account could not be read (SIMULATED) the tile used to say 0. It now says "Not checked" (and while checking), with the banner explaining; changed in `f4761cb`.

## `test-vault-load`: three checks failed before this batch
`test-vault-load` had 3 failing checks at `dcaf677`, before this batch. They are **not** counted as an app pass: the cause is that a failed download makes the next automatic one wait (3 s, 6 s, up to 5 min, added in `3d26569`, "Retry clears the wait") and the test never cleared that wait between scenarios. I corrected the test to call `resetCloudBackoff()` like the Retry button (commit `96677b9`); it now passes 18 of 18. The wait itself is the designed behaviour, not changed.

## Real defects found by this verification (fixed, first failures kept)
- **D-01** with the account unreachable the page said nothing while the queue retried: now waits at most 6 seconds, then "saved on this device, sync pending" (RB6-002, `87154b8`).
- **D-06** the first change check flagged every untouched import as "edited" (RB6-020, 022, 024, 026; `0942548`).
- **D-03** after a successful automatic retry the "waiting to upload" notice could stay (RB6-042; `748ab2b`).
- **Goals** a device-only goal was silently dropped when the account already held goals (RB6-081; `f4761cb`, above).
- **Import / Bulk** "Check again" and "Dismiss" were 20 px text links, now 36 px buttons (`96677b9`).
- **Import tiles** said 0 when the account had not been read (`f4761cb`).

## First failures that were test mistakes (kept)
RB6-004, 006, 007 (count read before results loaded); RB6-014, 016 (leftover synthetic goal from my own aborted run); RB6-018, 019 (read the sheet's label after it closed itself); RB6-015, 017, 062, 066 (status line read too early; an import that re-checks an unreachable account takes about a minute); RB6-027 (toast already gone); RB6-041 and RB6-060 (swapping the stored session to a made-up user id logged the app out: proved nothing); RB6-080 (the app takes the tier from the account, which is FULL, so my FREE setting did not apply).

## Still open, under their existing audit IDs (not touched here)
- **RC-14** the "Add to Home Screen" install banner overlaps lower content on phones: unchanged, open.
- **RC-31** small tap targets elsewhere on phones: unchanged, open (only the two new controls above were fixed).
- **Insurance is not fully closed:** `GIN-092`, `GIN-095` (needs the proposed migration), `GIN-155`, `VLT-353` remain open.
- RC-07's six profile-validation rows (`ACC-381`, `796`, `390`, `811`, `395`, `819`) stay with RC-28.

## Cleanup (after the last run)
Fixture dropped by manifest; leftover check found no `QA RB6` / `QA RB7` / `QA RB8` items, exhibitions or goals and no `ai_rb6_` rows; the fixture account's tier is back to FULL; the database reads 3,477 items, 39 profiles, 47 exhibitions (baseline, after 20 s); no QA-named profiles; `Temp\qa-c` scratch profiles deleted; `C:\qa-chrome` untouched (66 entries); no audit browser or script running. One mistake along the way: removing a temporary comparison worktree emptied this worktree's `node_modules` (the main checkout was untouched); restored with `npm ci`.
