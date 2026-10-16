# Help and video correction inventory (2026-10-16)

Status: **inventory only.** Nothing was re-rendered, replaced or published. The original MP4s, captions, screenshots and build scripts (`_build/`) are untouched and are the starting point for any rebuild. The v1 archive is at `C:\Users\EK\VLTD-media-archive\`.

Compared: the 2026-10-14 package (captured against production at commit `75b59aa`) and the in-app Help text, against the app as of commit `74d1757` (2026-10-16).

Verification note: every "now shows" below is read from the current code or from the 2026-10-15/16 live checks (QA data). Items marked **re-check** need a fresh capture before any script is written. Phone layouts and the camera were never part of these videos.

## What changed in the app since the videos were captured

1. **Add Item entry.** The five-option Add Item menu is gone. Vault and Home headers (and the phone bar) now show **Quick Add**, **Add Item** and an upload choice (**Single item / Batch**). Manual entry is only reached from empty states and "Add manually" links.
2. **AI is manual.** Nothing is identified automatically on upload, crop or save. The only AI actions are the plainly named buttons (**Identify with AI**, **Identify N with AI**, **Scan with AI to fill details**, **Scan certificate with AI**).
3. **Vault views.** Shelf and Museum are removed. The Vault has **Wall** (default), **Gallery** and **Flip**.
4. **Vault summary cards.** Total Value, Items, Insurance Ready and Needs Review are now buttons that open what they count; Insurance Ready / Needs Review now mean "has / is missing a photo, a value, a purchase price, an identifying detail" (they used to rank by value). Filters show as removable chips with Clear all.
5. **Item page.** The DETAILS card now lists fields that fit the item's universe / category / subcategory (six main, the rest under More details, "Other saved details" when an item moved category). The row of share icons and "Export for Social" is replaced by one action bar (Share).
6. **Sharing.** One **Share** panel (preview, labelled destination tiles, visible link, **Copy link**, Export for social for owners). Follow / Vibe / Save / report are on the action bar of public items and exhibitions. Report is under the ••• menu.
7. **Saving.** The status pill now says "Saved on this device, not in your account yet" when an upload is waiting; edits survive leaving the page.

## Inventory by asset

Legend: **Keep** (still true), **Fix text** (caption / script wording only), **Re-capture** (screenshot or screen must be replaced), **Rework** (the steps themselves change).

### Video 1: Add your first item (1:24)

| Step | What it says / shows | Current app | Action |
|---|---|---|---|
| 1 Open Add Item | "In your Vault, choose ADD ITEM." Header screenshot with one Add Item button | Header has Quick Add, Add Item and an upload button | Re-capture, Fix text |
| 2 Choose Manual entry | "Pick Manual entry" from the Add Item menu (screenshot `f1-01-add-item-menu`) | **That menu no longer exists.** Manual entry is reached from "Add manually" / empty states | **Rework** (decide the path to teach first) |
| 3 Add a photo | Upload; thumbnail in the photo strip | Upload then a crop step ("Use This Picture"); nothing is identified until Identify with AI is pressed | Re-capture, add one line about the optional AI button |
| 4 Name your item | Field and "Ready to save" | Field labelled **Title**; the page shows "Title required" until filled. Re-check the exact "ready" wording | Re-capture, re-check |
| 5 Category and details | Universe, Category, Series, grade, etc. | Details now follow the chosen category (main fields + More details) | Re-capture, Fix text |
| 6 Save | Save button, green "Saved!" banner | Save and "✓ Saved!" still exist; may add "specialist details are on this device only" if the database is not ready | Keep, re-check banner |
| 7 Your saved item | Vault with cards and values | Vault opens in Wall view with new summary cards and filter chips | **Re-capture** |
| 8 Open it any time | Old item page (DETAILS rows, share icon row) | New DETAILS card and action bar | **Re-capture** |

Retain: the structure (add → name → category → save → reopen), the zoom/ring styling, the narration tone, the captions pipeline.

### Video 2: Build and share an exhibition (1:44)

| Step | Current app | Action |
|---|---|---|
| Create First Exhibition / create form / visibility / created page | Unchanged by recent work. **Re-check** labels once (Create First Exhibition, + Create Exhibition) | Keep, re-check |
| Edit/Add, picker, "Add to Exhibit (n)", shelf, Save | Unchanged by recent work. **Re-check**; the Help page's "choose Save at the bottom of the picker" was already wrong (button is **Add to Exhibit (n)**) | Keep, Fix text |
| Preview as a visitor (guest page) | Guest page now has the action bar (collector + Follow, Share, Save, •••) under the title | **Re-capture** |
| Choose visibility (Public Exhibit → Make public) | Unchanged. Re-check | Keep, re-check |
| Share it: "Choose Copy Link, or use a share button" (screenshot `f2-07-share`) | **Replaced.** The owner page shows one **Share** button and **Regenerate link**; Copy link and the destinations are inside the Share panel | **Rework** this step; Re-capture |

Not in the video and still unverified: arranging by dragging (scripted events only; real pointer test is on the queue).

### Video 3: Import your collection (1:17)

Steps (Tools → Import, Upload Spreadsheet, summary, duplicates/warnings, column mapping, result) were not touched by recent work. Only the last screenshot (`t3-07-vault-imported`, the Vault after import) is out of date (Wall view, new summary cards). **Re-check** Tools → Import labels. Action: Keep, Re-capture one screenshot.

### Video 4: Switch between Personal and Business (1:08)

Settings → + Add business profile, form, active profile, account-menu "Switch profile": not changed by recent work (re-check once). The three Vault screenshots (`t4-05`, `t4-06`, `t4-08`) show the old Vault layout. Action: Keep steps, Re-capture three screenshots.

### Social 1: Add it to your Vault (0:39)

Uses the same screenshots as video 1 steps 3 to 8: Re-capture, Fix text where video 1 changes. "1 Add a photo and a name / 2 Add the details / 3 Choose Save / 4 Saved! / 5 It is in your Vault" can stay as the five beats.

### Social 2: Turn your collection into an exhibition (0:33)

Beat 3 "Copy the link" shows the old row. Rework to "Choose Share, then Copy link" and re-capture. Beats 1 and 2 re-check.

### Existing Help text in the app

| Where | Text now | Problem | Action |
|---|---|---|---|
| `/guide/walkthrough` (Add your first item) | "In Vault, choose ADD ITEM. Upload a photo or enter the details manually." | Entry changed (Quick Add / Add Item / upload) | Fix text |
| same | "Enter its item name." | The field is **Title** | Fix text |
| same | "Open CATEGORY ... choose Save to Vault." | **Universe / Category / Subcategory** are shown on the form; the button is **Save** | Fix text |
| same (Exhibition) | "New exhibit or Create Exhibition" | **Create First Exhibition** / **+ Create Exhibition** | Fix text |
| same | "choose Save at the bottom of the picker" | **Add to Exhibit (n)** | Fix text |
| same | "Use Organize to arrange the display" | **Organize** only appears once an exhibition has an exhibit page (reorder also under Advanced → Selected Items). Discoverability change pending your decision | Fix text after decision |
| same | "use Copy Link" | Now **Share → Copy link** | Fix text |
| `src/lib/learnContent.ts` slug `scan-and-add` ("Scan & Add Items") | "Open Scan and photograph the item. Review the details it pulls... Scan gets you 80% of the way" | Implies automatic identification. Now manual: photograph, then press **Identify with AI** if you want help | Fix text |
| `src/lib/learnContent.ts` playbook | "Add your first item: scan a photo or enter it manually." | Close enough; re-check wording against the entry buttons | Re-check |
| `src/app/guide/page.tsx` feature "Social Export Share Button" | Location "Item Detail → Share" | Still roughly true (Export for social is in the Share panel). Re-check | Re-check |
| `help-guide/index.html` (not wired into the app) | Numbered screenshots of videos 1 to 4 | Same screens as above | Re-capture with the videos |

## What can be retained as is

- All caption timing structure, the burned-in caption style, the VTT/SRT format, the narration scripts' structure, the build pipeline (`_build/`).
- Steps of videos 2 (create, pick items, save, visibility), 3 (all steps) and 4 (all steps), subject to the one-time label re-check.
- The two separate text-only Help topics (delete an item or exhibition, reset your password) pending a re-check of the delete flow wording.

## What needs replacement before anything is published

1. Video 1 steps 1 to 2 (new entry, no menu) and the screenshots of steps 3 to 8.
2. Video 2 step "Share it" and the guest preview screenshot.
3. The Vault screenshots in videos 3 and 4 and both social videos' matching beats.
4. The in-app Help text and the "Scan & Add Items" article (list above).

## Not done, on purpose

No screenshots captured, no scripts rewritten, no MP4 rendered, nothing uploaded or linked from the app. Camera capture and arranging by dragging stay out of the videos until each is verified (real hardware / real pointer).
