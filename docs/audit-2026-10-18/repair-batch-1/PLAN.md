# Repair batch 1 (plan for review: NOTHING is implemented)

Scope: RC-01, RC-02, RC-03 from the 2026-10-18/19 audit only. No migrations, no cosmetic work, no broader fixes. Insurance is the next functional batch (batch 2), ahead of any cosmetic cleanup.

**Evidence frozen before any code change:** commit `1372d37`, `docs/audit-2026-10-18/frozen-evidence-rc01-03/` (rows, screenshots, reproduction scripts, SHA-256 manifest). New reproductions and the exposure assessment are in `repair-batch-1/evidence/`. All reproductions used synthetic fixtures only (dropped and recounted afterwards). The confirmed repair queue is only the defects below; historical Discover failures (KNO), SUPERSEDED rows and the UNRECONCILED first-run test failures are outside it.

## Existing-content exposure (read-only, counts only, no content printed; `evidence/rc-exposure-readonly.json`, `rc01-empty-detail-readonly.json`)

| Defect | Could it have touched existing published content? | Finding |
|---|---|---|
| RC-02 (private text into public/buyer text) | **Stored/public text: no evidence of impact.** | Of 3,477 real items only 1 has a description at all; **0** descriptions contain their own private note; **0** look like generated or pasted listing copy; **0** contain a "Recorded cost basis" line. The public pages cannot show a note directly (the public view has no notes column); the only route was the saved description, and none is affected. **Not knowable:** the marketplace "listing copy" is copied to the clipboard, so whether anyone pasted it onto a real marketplace leaves no trace in the data. |
| RC-03 (visibility after auction cancel) | **No.** | There are **0** items with any auction record in production (0 cancelled, 0 active), so no existing item can have been left public by this path. (The prior visibility is not stored, so for a future case it could not be told from the data either.) |
| RC-01 (exhibition emptied) | **Cannot be ruled out for one exhibition.** | Only users with both a Personal and a Business profile can trigger it: 2 users, owning 6 exhibitions, 2 of which are empty. One of those is 5 days old, never edited since creation (genuinely empty). **One is not**: a PUBLIC exhibition on a Business profile, 189 days old, edited well after creation, with a cover and an uploaded background and 4 views, now holding 0 items (id prefix `fbbb6fc7`, owner profile prefix `3cbff34b`). It was already empty when I first read exhibitions during the Discover investigation, hours before the audit began; the audit itself only opened synthetic exhibitions, so the audit did not cause it. A wipe leaves no trace in the database (the same write removes items, links and snapshots), so this can be neither confirmed nor excluded from the data. Nothing was restored or changed. The owner is the best source: did that exhibition once hold items? |

## RC-01 — exhibition emptied by opening it under the wrong active profile

Split into three actionable defects (same function, three separate causes):

**RB1-01 — Pruning runs for an exhibition that does not belong to the active profile.**
- *Reproduced (synthetic):* EXH-433, CRW-012 and again here: Business profile active, open a Personal exhibition's address → page says "Exhibition not found" yet the database goes 7 items / 7 link rows → 0; the captured write is `POST galleries` for that exhibition with **0 item ids**, then `DELETE gallery_items` (`evidence/rc01-repro-result.json`, screenshot `rc01-repro-A-…`). Control (Personal active) writes nothing.
- *Cause / code:* `src/app/museum/[galleryId]/page.tsx:319-374` (`hydrateVaultItems`). `syncVaultItemsFromSupabase()` (line 325) pulls only the ACTIVE profile's items; `deadIds` (line 338) is "ids not in the locally loaded items"; `removeItemIdsFromAllGalleriesConfirmed(deadIds)` (line 353, `src/lib/galleryModel.ts:2269`) then writes the pruned list to the cloud. Every item of another profile's exhibition therefore looks deleted.
- *Proposed fix:* before any pruning, require `currentGallery.profile_id === getActiveProfileId()`; otherwise do nothing (the page can keep showing "not found" or, better, tell the owner to switch profile: wording is a separate product decision, not part of this fix).

**RB1-02 — Pruning does not check that the cloud read succeeded or that the items are really gone.**
- *Reproduced (partly):* with the Personal profile active and the cloud read of vault items blocked, the page issues the **same destructive write (0 ids, this exhibition)** (`rc01-repro-B`). In this simulation the write did not complete within 12 s and the database stayed at 7, so this is "attempted, not shown to complete" — plausible, not proven. The unchecked variant `syncVaultItemsFromSupabase()` ignores the `ok` flag that `syncVaultItemsFromSupabaseChecked()` (`src/lib/vaultModel.ts:1488`) exists to return.
- *Proposed fix:* use the Checked variant and prune only when `ok === true`; and decide "dead" by asking the cloud for those exact ids belonging to the owner profile and pruning only ids the cloud answers are absent (positive confirmation), never from the local list alone.

**RB1-03 — The prune is applied to every exhibition, not just the one being opened.**
- *Code:* line 353 passes no `onlyGalleryId`, so `removeItemIdsFromAllGalleriesConfirmed` rewrites every local gallery that lists those ids (and drops their public snapshots). Blast radius is larger than the page.
- *Proposed fix:* pass `{ onlyGalleryId: id }` here (the item-deletion callers `vaultActions.ts:117/175/192` and `VaultListView.tsx:1916` are deliberate and stay as they are).

*Regression checks (synthetic, offline where possible; add as `scripts/test-exhibit-self-heal.cjs`):* (1) Business active opens a Personal exhibition → DB items and links unchanged, no write. (2) Personal active, cloud read refused → exhibition unchanged. (3) Personal active, one item truly deleted in the database → that id is pruned from this exhibition (self-heal still works) and from no other exhibition. (4) A cross-profile item in an exhibition of the active profile is still pruned. (5) An unrelated viewer opening someone's exhibition → no write. (6) The item-deletion paths still prune everywhere (unchanged behaviour).
*Risk:* low; the change only adds gates before an existing deletion. Side effect: stale dead ids in an exhibition of the non-active profile are cleaned the next time that profile is active.

## RC-02 — private notes / cost entering public or buyer-facing text

Split into four defects; the public share page is NOT a defect of its own (it correctly shows the public `description`, which is why the saved copy mattered).

**RB2-01 — Marketplace listing copy uses the PRIVATE note instead of the public description.**
- *Reproduced:* ITM-230/624 (browser) and a unit-level run on a synthetic item for all eight builders (eBay, Etsy, Icona, Whatnot, Discogs, Mercari, Facebook, PWCC): every output contained the private-note sentinel and none contained the public description (`evidence/rc02-unit-repro-output.json`).
- *Code:* `src/lib/listingGenerator.ts:198` (`input.notes || input.description || …`); `itemToListingInput` (line 238-262) passes `notes` and never passes `description`; readiness check line 147 also counts notes as the description.
- *Fix:* build from `description` only (pass it in `itemToListingInput`), never `notes`; keep the existing fallback sentence; make the line-147 warning look at the description only.

**RB2-02 — Marketplace listing copy states what the owner paid ("Recorded cost basis").**
- *Reproduced:* ITM-230/624; unit run: all eight outputs contain the purchase price and the cost line.
- *Code:* `listingGenerator.ts:173` and `:193`.
- *Fix:* delete the cost line and the unused `cost`.

**RB2-03 — "Generate listing copy" appends the private note to the draft.**
- *Reproduced:* ITM-262 and the unit run (`generateListingModeContainsPrivateNote: true`; description and social modes do not).
- *Code:* `src/lib/generateItemCopy.ts:192-195` ("Existing notes as closing detail"). Also `:88` lets private notes feed the artist-name guess (optional hardening: use title and subject only).
- *Fix:* remove the closing-notes block; optionally restrict `findArtist` to title/subject.

**RB2-04 — Accepting that draft saves the private note as the PUBLIC description.**
- *Reproduced:* ITM-263/264/645 (after Accept, a signed-out visitor sees the note on the item's share page).
- *Code:* `src/app/vault/item/[id]/page.tsx:1517-1518` persists the draft as `description`. With RB2-03 fixed the draft contains no note, so no separate code change is needed; this row is the regression check that proves the chain is closed.

*Regression checks (add as `scripts/test-listing-privacy.cjs`, runs offline with `tsx`):* for all eight platforms and the three copy modes, an item with sentinel private note + purchase price must produce text with neither sentinel nor the number; the public description appears in listing copy when present, the fallback sentence when absent; a browser check on a synthetic item: Generate → Accept → signed-out `/share/<id>` contains no note.
*Risk / visible side effect for review:* the For Sale readiness checklist currently passes items that have a private note but no description; after RB2-01 those items will correctly be flagged "description blank". No stored descriptions need cleaning (none affected).

## RC-03 — private visibility not restored after auction cancellation

**RB3-01 — Starting an auction forces the item public without remembering what it was.**
- *Code:* `src/components/AuctionSetupSheet.tsx:96-118` (`isPublic: true`, line 111); nothing records the prior value.

**RB3-02 — Cancelling the auction never touches visibility.**
- *Reproduced:* ITM-253/634 (synthetic): item private before, `is_public = true` after Cancel Auction.
- *Code:* `AuctionSetupSheet.tsx:121-136` (`handleCancel` spreads the item and leaves `isPublic`).
- *Proposed fix (no migration):* when the owner presses Cancel Auction, ask once: "This item was made public when the auction started. Keep it public or make it private again?", defaulting to private, and apply the choice. This also covers auctions that were started before the fix. **Decision for EK:** the alternative (remember the prior visibility at start and restore it automatically) needs a stored field, i.e. a migration, which is excluded from this batch; it could follow later.
- *Regression checks (synthetic):* private item → start → cancel with "make private" → `is_public=false`; public item → start → cancel with "keep public" → stays public; choosing nothing/closing the prompt must not change visibility silently to public; cancel while the cloud save fails shows the existing "saved on this device" notice and the choice is still queued.
- *Existing data:* none affected (see table). No existing item's visibility is touched by this batch.

## Adjacent observations (NOT in this batch, recorded only)
- Cancel Auction also resets the bid counters/winner on the item record (data on bids lives elsewhere; separate review).
- Opening an exhibition page also re-pushes other exhibitions' data (writes on view): worth a look when the exhibition code is next opened.
- Social "then/now" export uses what was paid, but only after the owner switches dollar amounts on (deliberate; not changed).

## Order and size
RB1-01..03 (one function, one test script) → RB2-01..04 (two files + test) → RB3-01/02 (one component, decision needed) — about five source files plus three test scripts, all small. After approval each defect lands as its own commit with its regression check. **Batch 2 (next): Insurance** (blank printable packet, unreadable item-sheet/inventory prints, totals that disagree), before any cosmetic work.
