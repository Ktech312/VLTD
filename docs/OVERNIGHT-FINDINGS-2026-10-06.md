# Overnight audit findings, 2026-10-06

**Summary for EK (one minute read)**
1. Nothing was changed. This is a read-only code audit of the exhibit builder, the Vault list and item pages, and the public pages.
2. Biggest worry: public exhibit pages still show private stuff. Your private item notes show in the item popup on the main share link and on invite links, and the "Info" popup shows dollar totals per exhibit.
3. Several things look like they work but do not: Timeline layout (a typo breaks it), the "Uncategorized" checkbox on universe pages, the "Exhibit name" box in the item picker, and the Automotive and Art pages (they show empty, their items land in Misc).
4. Some edits can be lost or never reach the cloud: "Generate listing copy" overwrites your private notes, a failed cloud save is never retried, and invite-link permission changes may not sync.
5. Root cause of most of it is copy-paste: five separate exhibit viewers, two copy-pasted Vault list pages, and four different "what is this item worth" formulas. Fixing one copy never fixes the others.

How to read this: findings are ranked most annoying first. "Likelihood" is how likely a real user hits it. Anything I could not fully confirm from the code is marked **unverified**.

---

## A. Private data reaching public pages (fix first)

### 1. Your private notes show on the main public share link and on invite links
- Where: `src/app/museum/share/[token]/page.tsx:134` (copies the private `notes` field), `src/app/museum/invite/[token]/page.tsx:77` and `:270`, shown by `src/components/gallery/GuestGalleryRenderer.tsx:286-290`.
- What a visitor sees: tap an item and the popup includes your internal notes. Only the older `/museum/[id]/guest` page was fixed to use the public description instead (`guest/page.tsx:58`).
- Likelihood: high (any item with notes).
- Fix: on the share and invite pages map `description` into the item, never `notes`. Better, put this mapping in one shared function used by all public pages.

### 2. The public "Info" popup shows a dollar value for every exhibit
- Where: `src/components/gallery/ExhibitionInfoModal.tsx:60` and `:148`, opened by the "Info" button at `GuestGalleryRenderer.tsx:597-603`.
- What a visitor sees: "Exhibits in this Exhibition: 12 items, $4,300" per exhibit, even though you removed EMV prices from the exhibit itself.
- Likelihood: high (every public exhibit).
- Fix: remove the value line (keep the item count).

### 3. Public pages download the whole database row for every item
- Where: `src/app/museum/[galleryId]/guest/page.tsx:132-137` (`select("*")`), `src/app/museum/share/[token]/page.tsx:418`, `src/lib/publicProfile.ts:241, 271, 380` (all `select("*")`).
- What happens: purchase price, serial number, storage location, order number and private notes are sent to every visitor's browser. Anyone can read them in the browser network tab even if the screen never shows them. The item share page (`src/app/share/[itemId]/page.tsx:57`) does this correctly by asking for named columns only.
- Likelihood: medium (needs a curious visitor), consequence high.
- Fix: public reads should request only public columns (or go through a database view).

### 4. Every item's current value is stored inside the public exhibit record
- Where: `src/app/museum/[galleryId]/page.tsx:166-169` (`toGalleryPublicItemSnapshot` includes `currentValue`), saved into the gallery row by `src/lib/galleryModel.ts:928-929, 945-946`.
- What happens: the saved exhibit that the public link reads carries each item's EMV, so the price is public data even if no screen shows it.
- Likelihood: medium. Fix: drop `currentValue` from the snapshot (nothing public needs it; the invite "financial history" permission would need its own path).

### 5. Supplies (boxes, cases) and items marked Private can still appear in a public exhibit
- Where: picker has no supply filter (`ItemPickerSheet.tsx`, fed `items` at `museum/[galleryId]/page.tsx:1550`). Public pages drop supplies from the live query (`guest/page.tsx:139`) but then fall back to the saved snapshot, which still contains them (`guest/page.tsx:168-189`, `share/[token]/page.tsx:430-440`). Toggling an item to Private (`ItemVisibilityToggle.tsx`) never touches the snapshots either.
- What you see: a box you put in an exhibit, or an item you later hid, is still visible on the public exhibit. Whether this is intended for hidden items is **unverified** (design question); for supplies it contradicts the "supplies are never shown publicly" rule.
- Likelihood: medium. Fix: filter supplies out of the picker, and rebuild or filter snapshots when an item goes Private.

### 6. Public profile list includes invite-only and storage exhibitions
- Where: `src/lib/publicProfile.ts:301-306` (`neq("visibility","LOCKED")`, no check of `state`). Also `itemCount` reads `layout.itemIds` (`:312`).
- What a visitor sees: exhibitions you set to Invite Only (Guest View and Registered Users modes both use that setting) are listed on your public profile with title, description and cover. Deleted or Storage exhibitions may also be listed (**unverified** how delete is stored).
- Likelihood: medium. Fix: only list `PUBLIC` and `ACTIVE`.

### 7. Share-item page: broken fallback address and unused description
- Where: `src/app/share/[itemId]/page.tsx:15` (`?? "${BASE}"` is a plain string, not a template) and `:152-155` (description is only used for the preview image, never shown on the page).
- What happens: if `NEXT_PUBLIC_SITE_URL` is ever missing the preview image and canonical links are literally `${BASE}/api/og...`. **Unverified** whether the variable is set in production. The page also never shows the public description you wrote.
- Likelihood: low. Fix: use a real fallback URL and show the description.

---

## B. Buttons or controls that do nothing, or the wrong thing

### 8. Timeline layout does not sort by year (typo)
- Where: `GuestGalleryRenderer.tsx:484`, the regex is written `/d{4}/` instead of `/\d{4}/`, so it matches the letters "dddd". Also the year is never passed to public pages (`guest/page.tsx:49-69`, `museum/[galleryId]/page.tsx:159-176`, share normalizer), so even a fixed regex would find no year.
- What a visitor sees: Timeline shows one "Undated" heading and the items in their normal order.
- Likelihood: high for any exhibit set to Timeline. Fix: correct the regex and carry `year` through the snapshot and the public item mappers.

### 9. "Uncategorized" checkbox on universe pages does nothing
- Where: `src/app/vault/[universe]/page.tsx:781` uses `showUncategorized` but the memo's dependency list at `:820` leaves it out.
- What you see: tick the box, the box turns gold, the list does not change until you type in search or change sort.
- Likelihood: high. Fix: add `showUncategorized` to the dependency list.

### 10. Automotive and Art pages show nothing; their items appear under Misc
- Where: `src/app/vault/[universe]/page.tsx:198-206` (the copy of `directUniverseMatch` has no Automotive or Art line; the main Vault page has them at `vault/page.tsx:211-212`), filter at `[universe]/page.tsx:778`.
- What you see: open Vault, Gears & Gasoline or Art: empty list. Same items are counted under Misc.
- Likelihood: high for anyone with those universes. Fix: delete the copy and share one universe-matching function.

### 11. "Exhibit name" box in the item picker is ignored
- Where: `ItemPickerSheet.tsx:84, 265-272, 504` collects a name; `museum/[galleryId]/page.tsx:1554` is `onConfirm={(ids) => ...` and never reads it.
- What you see: type a name, press Add, the exhibit keeps its old name.
- Likelihood: medium-high. Fix: remove the box (the name is edited elsewhere) or apply it.

### 12. Advanced section: cannot type spaces in an exhibit title, cannot clear it
- Where: `GalleryBuilder.tsx:1291-1304` trims on every keystroke and replaces empty with "Section N".
- What you see: typing "My Grails" gives "MyGrails"; deleting everything snaps back to "Section 1". (The inline title box near the top does not have this bug.)
- Likelihood: medium (Advanced is hidden by default). Fix: trim on blur, not per keystroke. Better: delete the second title box.

### 13. "Save" in the builder always says "Saved ✓", even when it failed
- Where: `GalleryBuilder.tsx:781-796` flashes success after `onQuickSave()`; `saveDraft` swallows errors (`museum/[galleryId]/page.tsx:726-730`).
- Likelihood: medium. Fix: have save return success or failure and show that.

### 14. "Cancel Changes" almost never cancels anything
- Where: `museum/[galleryId]/page.tsx:1254-1261` with autosave at `:532-536`.
- What you see: everything saves itself about a second after you stop typing, so by the time you reach Cancel there is nothing to cancel. "Save Changes" is similar (disabled almost always).
- Likelihood: high confusion. Fix: remove both buttons, keep the small "Saved" indicator.

### 15. Item page: three controls edit the same fields, one needs a Save press
- Where: header pencil + check (`vault/item/[id]/page.tsx:1122-1165`), ITEM SUMMARY pencil (`:1348-1357`), and the BASIC ITEM RECORD form with "Save basic record" (`:1511-1595`). All share one draft, so a change typed in the form is lost if you do not press the button.
- Likelihood: high. Fix: keep the header edit, delete the BASIC ITEM RECORD section and the summary pencil.

### 16. Vault "Wall" view ignores your search and filters
- Where: `src/app/vault/page.tsx:1877` passes all `items`, not `filteredItems`. The Wall has its own separate search/filter bar (`VaultWallView.tsx:93-130`).
- What you see: type in Search, change universe or sort: the top controls stay lit but the Wall does not react. Two filter bars on one screen.
- Likelihood: high in Wall view. Fix: feed it `filteredItems` and remove its own bar, or hide the top controls in Wall.

### 17. Vault quick-look panel: invented numbers and links that all go to the same page
- Where: `vault/page.tsx:857-859` (Low = 85% and High = 115% of value when no data exists), `:916` ("% this year" is really gain since purchase), `:906` (a decorative "⋮" that is not a button), `:976-996` ("View public page", "Create Listing", "More actions" all open the item page).
- What you see: made-up Low/Median/High under "Value Evidence" and buttons that look different but do the same thing.
- Likelihood: high. Fix: hide the range unless real comps exist; remove or really wire the extra links.

### 18. Layout buttons: GRID / CURATED / TIMELINE vs "Theme: Grid View"
- Where: `GalleryBuilder.tsx:668-687` and the Theme list at `:71-75, 435, 450-465`.
- What you see: two different things both called "grid"; choosing "Grid View" in Theme silently turns off the shelf theme. CURATED and TIMELINE also ignore the shelf positions you arranged (`GuestGalleryRenderer.tsx:506`).
- Likelihood: medium. Fix: separate "Layout" and "Room look" clearly; say so when positions are ignored.

### 19. Exhibit "NOTES" tile is always 0%; item notes cannot be written
- Where: `museum/[galleryId]/page.tsx:585-603` (`updateNote` is never called) and the tile at `:1000-1002`.
- Likelihood: certain, low harm. Fix: remove the tile and the function (or add the editor).

---

## C. Edits that can be lost or never leave the device

### 20. "Generate listing copy" overwrites your private notes
- Where: `vault/item/[id]/page.tsx:1488-1492` (`persist({ ...item, notes: text })`).
- What you see: accept the generated listing text and your internal notes are gone, replaced by sales copy. (Notes also feed the listing exporter, so they are doing two jobs.)
- Likelihood: high for anyone who lists items. Fix: write the copy to `description`, never to `notes`.

### 21. A failed cloud save is silent and never retried
- Where: `museum/[galleryId]/page.tsx:672` marks the draft as clean before the cloud save, `:726-730` shows "saved locally, cloud sync failed", and the message clears after 2.2 seconds (`:464-468`).
- What you see: Save Changes is greyed out, nothing shows the cloud never got it, and nothing retries until you edit again. Public visitors keep the old version.
- Likelihood: medium (flaky phone connection at a show). Fix: keep a visible "not saved to cloud" flag and retry.

### 22. Invite-link permission changes may not sync
- Where: `src/lib/galleryModel.ts:1130-1135` (the sync signature leaves out `permissions`), toggled at `museum/[galleryId]/page.tsx:805-814`.
- What you see: untick "Financial History" on an invite and the cloud copy may stay as it was until some other edit triggers a full save. Revoking access is the risky direction. **Unverified** end to end (I only confirmed the signature omits it).
- Likelihood: medium. Fix: include permissions in the signature.

### 23. Creating or disabling an invite link, or Regenerate, throws away typing from the last second
- Where: `museum/[galleryId]/page.tsx:779-837` replace the draft from storage.
- What you see: type a description and click Create Link within a second, the text vanishes. Regenerate also has no "are you sure" and kills the old public link.
- Likelihood: low-medium. Fix: merge instead of replace; confirm Regenerate.

### 24. Clicking "Public Exhibit" publishes within a second, no confirm
- Where: `museum/[galleryId]/page.tsx:556-558` plus autosave `:532-536`, "published" log at `:674-677`.
- Likelihood: low-medium. Fix: confirm before going public.

### 25. Deleting or reordering a photo can leave a broken image
- Where: `vault/item/[id]/page.tsx:875-890` deletes the stored file first, then saves the item; if the save fails the cloud item still points at a deleted file. Reorder and delete are also not queued for retry (`:839-861`).
- Likelihood: low-medium. Fix: save the item first, delete the file after, and queue failures.

### 26. Museum Builder says "Autosaved" but visitors only see the last Publish
- Where: `src/components/gallery/MuseumBuilder.tsx:1358-1375` (text in a tooltip only).
- What you see: style, rows, shelves, capacity and wallpaper changes look saved but visitors still see the old baked room until you press Publish. Items placed move live while the room does not, so positions can mismatch.
- Likelihood: medium. Fix: show "Draft, not published" until Publish.

### 27. Moving an item in a room loses its link to the vault item
- Where: `src/components/gallery/MuseumRoomPopup.tsx:351` omits `vault_item_id`; the Builder's copy keeps it (`MuseumBuilder.tsx:577`).
- What you see: after Organize, move, the item's "click for info" in that room may fall back to a plain picture.
- Likelihood: medium. Fix: share one move function.

### 28. Inline value edit on a Vault card silently sets $0 if you clear it
- Where: `vault/page.tsx:327-333, 464-472` and `vault/[universe]/page.tsx:302-307, 413-421` (empty input becomes 0).
- Likelihood: low-medium. Fix: ignore empty input.

### 29. `sessionStorage` write can crash the exhibit page
- Where: `museum/[galleryId]/page.tsx:113-122, 486` (no try/catch). **Unverified**: private-mode or full storage could throw inside an effect.
- Likelihood: low. Fix: wrap in try/catch.

---

## D. The same job done two ways (or twice)

### 30. Five different public exhibit viewers
- Where: `/museum/[id]/guest`, `/museum/share/[token]`, `/museum/invite/[token]` (its own card layout), `/gallery/[id]` (old GalleryHero/GalleryLayout), `/museum/virtual-room/guest`.
- Why it bites: each has its own item mapper, so fixes land in one only (the notes fix reached just one, #1; the EMV removal missed the Info popup, #2).
- Fix: one shared public-item mapper and one viewer component.

### 31. Favorited exhibitions of other collectors are dead links
- Where: `src/app/favorites/page.tsx:51` links to `/gallery/[id]`, which only reads this device's own saved exhibitions (`src/app/gallery/[galleryId]/page.tsx:26-29, 62-71`).
- What you see: "This exhibition is private" for anyone else's exhibition. Likelihood: high for favorites. Fix: link to the share page via its public token.

### 32. Two description boxes, two title boxes, two preview areas on the exhibit page
- Where: description at `museum/[galleryId]/page.tsx:955-964` and `:1302-1309`; exhibit title/description inline (`GalleryBuilder.tsx:970-1007`) and in Advanced (`:1291-1319`); inline PREVIEW (`:1252-1259`) plus the "Preview ↗" popup (`:734-740, 1677-1706`).
- Fix: keep one of each.

### 33. Three Save controls plus autosave on the exhibit page
- Where: header "Save Changes" (`page.tsx:1246`), builder "Save" (`GalleryBuilder.tsx:781`), and autosave. Fix: autosave and one status label.

### 34. Repeated stat tiles
- Where: "VIEWS" twice (`page.tsx:972-977` and `:1005`), "ITEMS" three times (`GalleryBuilder.tsx:693-721, 1511-1526`), LAYOUT shown in three places. Fix: show each once.

### 35. "Create Exhibition" uses different words than the exhibit page
- Where: `src/app/museum/new/page.tsx:213-306` (Visibility Public / Invite Only / Locked, Guest View Mode Public/Guest, State Active/Storage) vs four pills on the exhibit page (`museum/[galleryId]/page.tsx:1091-1118`).
- What you see: a different vocabulary for the same setting; "State: Storage" cannot be changed later from the exhibit page. Fix: use the four-pill control in both.

### 36. Vault: universe chips AND an "All Universes" dropdown do the same job
- Where: `vault/page.tsx:1606-1619` and `:1693-1704`. Fix: keep the chips.

### 37. Vault main page and universe page are copy-pasted and have drifted
- Where: `vault/page.tsx` vs `vault/[universe]/page.tsx` (different cards, different view modes, view mode remembered on one only: `[universe]:757-765`; Automotive/Art bug #10 came from this).
- Fix: one shared list component.

### 38. Four different answers to "what is this worth?"
- Where: card shows `currentValue` (`vault/page.tsx:491`); totals and sort use estimated then current (`:334-342`); item page uses median, then estimated, then current (`vault/item/[id]/page.tsx:153-161`); Museum Builder uses `estimatedValue` only (`MuseumBuilder.tsx:1066, 1194`).
- What you see: edit the value on a card and the totals, sort and item page do not move (if an estimate exists). In the museum, the "Show value" checkbox says "no saved value" for items that only have a current value.
- Likelihood: high. Fix: one shared `effectiveMarketValue` function used everywhere.

### 39. Different image lookups give "No image" in some places
- Where: shelf, picker, featured card and builder only read front/back URL (`GalleryShelfScene.tsx:21`, `ItemPickerSheet.tsx:36`, `GalleryBuilder.tsx:139`, `GuestGalleryRenderer.tsx:670`), while cards use `getPrimaryImageUrl`. **Unverified** how many items are affected (most items have a front URL set).
- Fix: use `getPrimaryImageUrl` everywhere.

---

## E. Pickers and lists that cannot reach everything, or struggle

### 40. Item picker draws every item at once
- Where: `ItemPickerSheet.tsx:391-478` (no paging, no lazy images). With about 1,100 items this is slow on phones. Fix: window or page the grid and lazy-load images.

### 41. Picker cannot empty an exhibit
- Where: `ItemPickerSheet.tsx:505` disables Add when nothing is picked. You can only clear via the small remove buttons. Fix: allow confirming with zero.

### 42. 18-item shelf cap is silent in places
- Where: `GalleryShelfScene.tsx:288-299` shows only the first 18 items; `GalleryBuilder.tsx:419-423, 614-636` drops extras from the slot grid, and Done or a drag then saves only the slotted ones. The picker enforces 18, but items added another way (drag, import) can exceed it. **Unverified** which paths can exceed 18.
- Fix: refuse to add past 18 everywhere, and warn.

### 43. Vault lists have no Select All and no sub-category filter
- Where: select mode in `vault/page.tsx:1764-1866` and `vault/[universe]/page.tsx:1274-1397` (tick one by one); universe page filters are only search, Graded, Uncategorized (`:1181-1264`) while the picker already has category and subcategory chips.
- Likelihood: high with 1,100 items. Fix: add "Select all in view" and the category/subcategory chips.

### 44. Public exhibit page downloads the owner's entire public collection
- Where: `guest/page.tsx:132-137` fetches every public item (no filter by exhibit ids, default 1,000-row limit) to show at most a few dozen. Slow, and over 1,000 items the rest come only from the snapshot fallback.
- Fix: fetch only the exhibit's item ids.

### 45. Removing an exhibit hides its items from visitors but they are still counted
- Where: `GalleryBuilder.tsx:1346` removes the exhibit only; renderer shows only items inside exhibits (`GuestGalleryRenderer.tsx:466-473`) but counts all (`:610`). "Selected items not in an exhibit" warning is only inside Advanced (`:1338-1343`).
- Fix: move items to the first exhibit when an exhibit is removed.

### 46. Removing the last item from the Advanced list leaves it in the exhibit
- Where: `GalleryBuilder.tsx:1646` removes from `itemIds` only; `galleryModel.ts:654, 666-668` stops filtering sections when `itemIds` is empty. Edge case. Fix: filter sections even when empty.

---

## F. Smaller things a visitor or owner will notice

### 47. Public grid cards are labelled "GRID ITEM #1, #2..."
- Where: `GuestGalleryRenderer.tsx:137, 749`. Remove the label.

### 48. Cover artwork cannot be removed, and its message is out of date
- Where: `museum/[galleryId]/page.tsx:920-935` only has upload; `:573` says "Click Save to publish it" though autosave does it.

### 49. "Exhibition not found" flashes while the exhibit loads
- Where: `museum/[galleryId]/page.tsx:839-860` (draft is empty on first paint) and the message blames "local storage".

### 50. Vault delete: hover-only on cards, and a different confirm than bulk delete
- Where: `vault/page.tsx:509, 474-483`, `vault/[universe]/page.tsx:446, 423-432` (button only appears on mouse hover, so not on phones; single delete uses `window.confirm`, which the same file's own comment at `[universe]:907-911` says is blocked in installed web apps).
- Fix: use the inline confirm for single delete and a visible delete in the card menu.

### 51. Item page: Cert #, year, brand and edition cannot be edited
- Where: `vault/item/[id]/page.tsx:1366` shows Cert # read-only; edit rows at `:1627-1632` do not include it. Only the certificate scanner can fill it.

### 52. Vault stats count supplies in "Filtered items" but not in value
- Where: `vault/[universe]/page.tsx:1014-1019`. Minor mismatch.

### 53. "Return to Vault" on a sold item writes straight to the cloud, not the retry queue
- Where: `vault/item/[id]/page.tsx:1036-1049`. **Unverified** impact; if the update fails it is "restored locally only" and could be overwritten by the next sync.

### 54. Mass-move menu names: "Sub" is actually Category and "Type" is Subcategory
- Where: `vault/page.tsx:1827, 1839` and `[universe]:1341, 1353`.

---

## Suggested order for tomorrow (if you want it)
1. Items 1, 2, 3, 4, 5 (public data) in one pass, using one shared public-item mapper.
2. Items 20, 21, 22 (lost or unsynced edits).
3. Items 8, 9, 10, 11, 16 (things that look broken).
4. Item 38 (one shared value formula), then the copy-paste clean-ups (30, 32, 33, 34, 36, 37).

---

## Status after the fix pass (2026-10-06)

**Fixed:** 1, 2, 3, 4, 5 (supplies), 6, 7, 8 (sort fixed; year reaches public pages that read live rows, not the saved snapshot), 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 38, 39, 40, 41, 44, 45, 47, 48, 49, 50, 51, 53, 54. Also added Select all (43) and the one shared universe match (the core of 37).

**Not done, on purpose:**
- 5 (Private items already in an exhibit): done as "Hidden Item" on explicit hide only, because almost every item is already marked Private.
- 18: Layout buttons vs "Theme: Grid View" still use two similar words. The buttons now work; the wording is a design call.
- 30 and 37 (full merge of the five public viewers and the two Vault list pages): too large to do safely in one pass. Fixes now go through shared code where it matters (public columns, universe match, value formula, image lookup).
- 35 (Create Exhibition wording), 42 (silent 18-item cap on drag/import paths), 43 (category chips on Vault lists), 46, 52: small or design-dependent, left for a follow-up.

## Second pass (leftovers)

**Fixed:** 18 (layout buttons renamed Standard / Curated / Timeline with a hint; theme option renamed "Plain cards"), 30 (one public item mapper for the exhibit, share and invite pages; the old /gallery/ viewer now redirects to the real public page, which also fixes the Home page and Favorites links), 35 (Create Exhibition uses the same four access choices as the exhibit page), 42 (18-item cap on every add path), 43 (category and subcategory chips on both Vault lists), 52 (count and value agree).

**Still open:**
- 37: the two Vault list pages are still two files. They share the universe rule, value formula and category chips, but a full merge would drop the universe page's move-to-profile, scroll restore and museum/shelf/swipe views.
- 46: removing the last item from the Advanced list can leave it in the saved exhibit. Left alone because the fix touches how saved exhibits are read, which could blank older exhibits.
- The invite-link viewer keeps its own card layout because its permission gates (images, details, financial) are built into it.
