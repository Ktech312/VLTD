# Help corrections inventory (2026-10-17)

Text inventory only. Nothing was edited, rebuilt, committed or published. Every "app now says" below was read from this worktree's code (commit `7074217` plus two uncommitted edits I did not make: `src/components/CostToSellPanel.tsx` and `docs/ui-verification-2026-10-17/scripts/closeout-checks.cjs`). Nothing was run in a browser. Video frames were not inspected (no ffmpeg or ffprobe here); I opened only three tutorial screenshots and the two in-app poster PNGs.

Paths are relative to the repo root. "Help" here means: `src/app/guide/page.tsx` (Feature guide), `src/app/guide/walkthrough/page.tsx` (Getting started), `public/guide-media/*`, `src/lib/learnContent.ts` (Learn), the Help menu in `src/components/TopNav.tsx`, and the unpublished package in `docs/walkthrough/`. An older inventory exists at `docs/walkthrough/media-ready/HELP-CORRECTION-INVENTORY.md` (2026-10-16). It predates the Verify-sheet, Free-plan, cost-rule and referral changes, and I corrected some of its points below (see section 6).

## 1. Summary

- The in-app Getting started page (`/guide/walkthrough`) is the most out of date, but mostly in the exhibition lesson. The add-item lesson matches `/capture` (Add Item) fairly well. It never mentions Quick Add, the upload choice, Bulk, Import, or that AI only runs when you press a button.
- Exhibition lesson, wrong or stale: "New exhibit", "Save at the bottom of the picker", "Copy Link" (now Share, then Copy link), "Keep it Private" (Free plan cannot choose Private on the create page), "Save your changes" (autosaves), and Organize (needs an exhibit page first).
- Sharing: Help has nothing about the single Share panel, "Share photos" / "Download to device", or "Turn on public sharing?". Item and exhibition sharing are both undocumented.
- Selling, costs, "at cost" values, sign-in/out and profile switching are not in the in-app Help at all. Learn's "Scan & Add Items" and "Export & Sell Anywhere" describe flows that do not exist as written.
- The Feature guide (`/guide`) lists nine features. Two cannot be found in the code as described (Market Pulse on Discover, Goals "Browse vault" and milestone hints). Its footer calls AI cataloging and auction mode "in development". Both exist.
- Both in-app videos (`public/guide-media`) follow the old text. They also say "Start with one favorite piece at V L T D dot app" and "New exhibit".
- Of the unpublished tutorial package (`docs/walkthrough/media-ready`), the whole Add Item menu scene and the share scene are stale. The Vault screens and the guest preview are probably stale. Steps for create, picker, visibility, import and profiles still match current labels.
- On phones, Help is reachable only from the account menu when signed in. A signed-out phone visitor sees no Help link in the top bar or account menu (`TopNav.tsx:413-428`, `:679-697`, `:700-707`).

## 2. Obsolete labels

Current labels quoted from code. "Help says" quotes the Help text.

| Help says | Where (file:line) | The app calls it now (file:line) |
|---|---|---|
| "choose ADD ITEM" | `guide/walkthrough/page.tsx:19`, `guide-media/add-item.vtt` cue 1 | Header buttons **Quick Add**, **Add Item**, plus an icon-only menu named "Upload from device" with **Single item** and **Batch** (`AddItemActions.tsx:22-23,27,15-16,34`). On phones the same three float above the bottom bar (`BottomNav.tsx:64-70`). |
| "Enter its item name" | `guide/walkthrough/page.tsx:20` | Add Item (`/capture`): **Item Name \*** (`capture/page.tsx:1198`). Add manually (`/vault/add`): **TITLE** with a "Title required" / "Ready to save" chip (`ScanPanel.tsx:86`; `vault/add/page.tsx:2384-2388`). Quick Add review: placeholder "Item name" (`ScanVerifySheet.tsx:195`). The Help line is right for `/capture` and wrong for `/vault/add`. |
| "Open CATEGORY. Choose a universe, then a category and subcategory" | `guide/walkthrough/page.tsx:21`, `add-item.vtt` cue 2 | `/capture` has numbered sections **Identity**, **Category**, **Location**, **Value**, **Documents** (`capture/page.tsx:1182,1314,1390,1411,1458`). Fields **Universe / Category / Subcategory** (`:1325,1343,1360`). Storage is a field called **Storage location** inside **Location** (`:1395`). Help says "storage" without naming the section. |
| "Choose Save to Vault" | `guide/walkthrough/page.tsx:22`, `add-item.vtt` cue 3 | `/capture`: **Save to Vault** (`capture/page.tsx:1487`). It then opens the Vault by itself (`:811`). `/vault/add`: **Save** (`vault/add/page.tsx:2428`), then "✓ Saved!" (`:2337`). Quick Add: **Save N item(s) to Vault** (`ScanVerifySheet.tsx:305`). |
| "Return to Vault and search for the item" | `guide/walkthrough/page.tsx:22` | After `/capture` Save the Vault opens automatically (`capture/page.tsx:811`). After `/vault/add` Save you stay on the form (`vault/add/page.tsx:2337-2362`). |
| "New exhibit or Create Exhibition" / "choose New exhibit" | `guide/walkthrough/page.tsx:32`, `build-exhibition.vtt` cue 1 | **Create First Exhibition** (empty list, `museum/page.tsx:724`) or **+ Create Exhibition** (`museum/page.tsx:578`). "New exhibit" survives only as the dashed ghost tile in the list (`museum/page.tsx:860`). The create form is headed **Create Exhibition**, fields **Exhibition Title**, **Description**, **Who can see it** (`museum/new/page.tsx:122,175,185,206`). |
| "Theme and display mode" | `guide/walkthrough/page.tsx:32` | **Theme Pack**, **Display Mode** (grid or shelf) (`museum/new/page.tsx:253,268`). On the exhibition page: **Theme:** and **Shelf:** dropdowns (`GalleryBuilder.tsx:980,1000`). |
| "open Edit/Add" | `guide/walkthrough/page.tsx:33`, `build-exhibition.vtt` cue 2 ("Edit Add") | **Edit/Add** or **Edit/Add (n)** (`GalleryBuilder.tsx:1091`). Matches. The caption's "Edit Add" is a spoken form of it. |
| "choose Save at the bottom of the picker" | `guide/walkthrough/page.tsx:33`, `build-exhibition.vtt` cue 2 | One exhibit page: **Add to Exhibit (n)** (`ItemPickerSheet.tsx:275`). Several pages: **Save (n items)** (`:270-271`). Nothing says "Save" alone. The picker also shows "Exhibit is full (18 items max)" (`:281`). |
| "Use Organize to arrange the display" | `guide/walkthrough/page.tsx:34`, `build-exhibition.vtt` cue 3 | **Organize** is always shown. With no exhibit page it opens a notice, "Organize needs an exhibit page", with **Create first exhibit** and **Not now** (`GalleryBuilder.tsx:1096-1115,1744,1759`). While arranging the button reads **Done** (`:1115`). |
| "Save your changes, then open Preview" | `guide/walkthrough/page.tsx:34`, `build-exhibition.vtt` cue 3 | A **Save** pill still exists and shows **Saved ✓** (`GalleryBuilder.tsx:1014`), but changes autosave about a second after the last edit (`museum/[galleryId]/page.tsx:498-499`). The preview button is **Preview ↗** (`GalleryBuilder.tsx:964`). |
| "USER ACCESS MODE ... Keep Private ... Choose Public Exhibit" | `guide/walkthrough/page.tsx:35`, `build-exhibition.vtt` cue 4 | On the exhibition page the heading is **USER ACCESS MODE** with pills **Private / Public Exhibit / Guest View / Registered Users** (`museum/[galleryId]/page.tsx:1093,1138-1160`; `galleryAccess.ts:7-12`). On the create page it is "Who can see it" (`museum/new/page.tsx:206`). The in-page help panel calls the first one "Private Exhibit" (`:1121`), but the pill says "Private". |
| "use Copy Link" | `guide/walkthrough/page.tsx:36`, `build-exhibition.vtt` cue 4 | Owner page has one **Share** button (plus **Regenerate link**) (`museum/[galleryId]/page.tsx:1046-1064`; `ContentActionBar.tsx:179-186`). The panel has a "Share public link" part with **Copy link** (`ShareDialog.tsx:397,440`). The label "Copy Link" (capital L) now exists only for invite tokens (`museum/[galleryId]/page.tsx:1335,1368,1438`). |
| "Open that link in a signed-out browser" | `guide/walkthrough/page.tsx:36` | Still valid. Share links are `/museum/share/<token>` (`galleryModel.ts:2754`) and are public (`routeAccess.ts:33-38`). Item links are `/share/<item id>` (`vault/item/[id]/page.tsx:1156`). |
| "Check individual item visibility if a piece is missing" | `guide/walkthrough/page.tsx:36` | Item toggle reads **Public** / **Private**, and inside an exhibit **Shown in exhibit** / **Hidden in exhibit** (`ItemVisibilityToggle.tsx:103`). |
| "Narrated screen guide" | `guide/walkthrough/page.tsx:60` | The two MP4s do have an audio track (mp4 contains a sound track; content not listened to). The unpublished package has none. |
| "Back to Help" | `guide/walkthrough/page.tsx:44` | `/guide` is titled "VLTD Feature Guide" / "Everything your vault can do." (`guide/page.tsx:339,342`). The nav menu calls it **Feature guide** (`TopNav.tsx:94`). |
| "Open Scan and photograph the item" (Learn "Scan & Add Items") | `learnContent.ts:337` | There is no **Scan** control. Camera entry is **Quick Add** or **Add Item** > Take photo (`capture/page.tsx:1007`). Empty states use "Scan your first item" (`VaultListView.tsx:786`) and "Smart Scan" (`EmptyVault.tsx:45`; `insurance/page.tsx:177`; `InsightsOverview.tsx:769`). All of these open `/capture`, whose header button is **Add Item**. |
| "Review the details it pulls" / "let a photo do the first draft" / "Scan gets you 80% of the way" | `learnContent.ts:335,338,342` | Nothing is pulled in automatically. **Identify with AI** is a button (`capture/page.tsx:972`; `ScanPanel.tsx:224`; `ScanVerifySheet.tsx:263`). |
| "scan a photo or enter it manually" | `learnContent.ts:230` | Fine in spirit. Name the buttons (**Quick Add**, **Add Item**, **Add manually**). |
| "Turn on insurance readiness" | `learnContent.ts:236` | There is no switch. Home and Vault cards **Insurance Ready** and **Needs Review** are buttons that open a list (`VaultListView.tsx:1102`). |
| "Open the item and choose Export" | `learnContent.ts:377` | The item page has **Share** (opens the panel; **Export for social** is inside it, `ShareDialog.tsx:471`). Marketplace text comes from **Listing copy**, then **Copy Listing** while the item is for sale (`vault/item/[id]/page.tsx:1520-1534`; `ExportListingButton.tsx:149`). Vault Tools has **Export CSV**, **Export JSON**, **Insurance PDF**, **Download photos (ZIP)** (`VaultToolsMenu.tsx:29-33`). |
| "Use stream mode when you're showing live" | `learnContent.ts:298` | The item page has a **Stream** button that opens a present screen (`vault/item/[id]/page.tsx:1285`). Not a mode of the scanner. |
| Feature guide: "Social Export Share Button ... Item Detail > Share" | `guide/page.tsx:150-167` | **Export for social** is inside the Share panel (`ShareDialog.tsx:471`). The "Share" button inside the export sheet (`SocialExportSheet.tsx:971`) still exists. "Appears in the social export sheet" is right. |
| Feature guide footer: "AI cataloging, auction mode, and market alerts are all in development" | `guide/page.tsx:410` | **Identify with AI** exists and runs only when pressed. Auction exists on the item page as **Start Auction** / **Manage Auction** (`vault/item/[id]/page.tsx:1301-1304`), and there is an `/auction` route. An alerts bell exists in the top bar (`AlertsBell.tsx`). |
| Feature guide: "Vault / Sold" location, "Sales History" card | `guide/page.tsx:115-149` | Sold page title is **Sold Items** with a **Sales History** button to `/sales` (`vault/sold/page.tsx:498-501`; `sales/page.tsx:239`). Home links to "Sales analytics" at `/vault/sold#sales-analytics` (`HomeClient.tsx:406`). |
| Nav names (any Help text that uses them) | n/a (no Help text names them) | **Home, Vault, Exhibitions, Lounge, Discover** (`primaryNav.ts:21-25`). Learn sits inside Lounge (`:24`; `TopNav.tsx:91`). Vault views are **Wall, Gallery, Flip** (`VaultListView.tsx:2190-2192`). |

## 3. Obsolete or missing steps

Status: WRONG (contradicts the app), OUTDATED (was true, no longer), MISSING (the app has it, Help does not). "Help sentence" is quoted or marked "none".

### Add an item (Add Item, `/capture`)

| Help sentence / step | Status | Corrected text |
|---|---|---|
| Walkthrough step 1: "In Vault, choose ADD ITEM. Upload a photo or enter the details manually. A photo is optional." (`walkthrough/page.tsx:19`) | OUTDATED | "In Vault or Home, choose Add Item. Take or upload a photo, or skip the photo and type the details. A photo is optional." |
| Step 2: "Add the brand, series, condition and notes you know. Record a certification or grade only when it applies." (`:20`) | OK | Keep. Fields are Brand / Manufacturer / Publisher, Set / Series, Certification Company, Certification # (`capture/page.tsx:1224-1262`). |
| (none) AI | MISSING | "Nothing is identified for you. If you want help filling the details, choose Identify with AI after you add a photo." (`capture/page.tsx:972`; `:1005` says "tap Identify to auto-fill, or just type the details in".) |
| Step 3: "Use the other sections for storage, value and documents" (`:21`) | OUTDATED | "Use Location, Value and Documents for where it is kept, what it cost and what it is worth. Documents and extra photos are added after you save." (`capture/page.tsx:1390,1411,1458,1464-1465`) |
| (none) Cost | MISSING | "Leave Purchase price blank if you do not know it. Enter 0 if it cost nothing. A negative price is refused." (`costInput.ts:1-6`; `capture/page.tsx:753-762`) |
| Step 4: "Choose Save to Vault. Return to Vault and search for the item by name. Your vault item starts private." (`:22`) | OUTDATED (middle sentence) | "Choose Save to Vault. The Vault opens with your new item. It starts private." (`capture/page.tsx:811,1494` "Private - only you can see your vault") |
| (none) The "Item name is required" stop | MISSING | "A name is required. If it is empty, Save asks for it." (`capture/page.tsx:742`) |

### Quick Add (`/vault/quick`)

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none | MISSING | "Quick Add opens the camera. Choose Universe and Category at the top, snap each item, then choose Finished." (`ScanCapturePanel.tsx:771-833`) |
| none | MISSING | "Review your Drop lists the photos. Remove any bad ones, then choose Add N items to Vault." (`ScanReviewSheet.tsx:73,211`) |
| none | MISSING | "Verify your Drop shows each item with a name, Universe, Category and Subcategory, a Cost box and a Value box. Fill them in yourself, or choose Identify with AI." (`ScanVerifySheet.tsx:103,214-262`) |
| none | MISSING | "Leave Cost blank if unknown. Enter 0 if free. Save stays off while any cost is negative." (`ScanVerifySheet.tsx:245,251,298`; `costInput.ts`) |
| none | MISSING | "Identify with AI uses one AI scan per photo, and only when you press it. Save N items to Vault saves them." (`ScanVerifySheet.tsx:292,305`) |

### Import / bulk upload

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none (Learn and Feature guide never mention Import) | MISSING | "In Vault, open Tools, choose Import, then Upload Spreadsheet. Check the summary and column mapping, pick how to handle duplicates, then Review & Confirm Import." (`VaultToolsMenu.tsx:28`; `SpreadsheetImportClient.tsx:407,440,525`) |
| none | MISSING | "To add many photos at once, choose the upload icon, then Batch. Pick a Universe and Category for the batch, add photos, then either Scan with AI to fill details or Skip - I'll fill in by hand, then Add all N to Vault." (`AddItemActions.tsx:16,34`; `vault/bulk/page.tsx:359-361,386,440,523,532,696`) |
| none | MISSING | "In Bulk, an item left without a name is saved as Untitled Item." (`vault/bulk/page.tsx:320,613-614`) |
| none | MISSING | "Scan with AI in Bulk only runs when you press it, and it counts against your AI scans." (`vault/bulk/page.tsx:532`) |

### Edit details

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none | MISSING | "Open an item from your Vault. Each section has a small edit button; choose it, change the fields, then Save (Esc cancels)." (`vault/item/[id]/page.tsx:301-302`) |

### Build an exhibition

| Help sentence / step | Status | Corrected text |
|---|---|---|
| "Open Exhibitions and choose New exhibit or Create Exhibition ... Keep it Private while you build" (`walkthrough/page.tsx:32`) | WRONG for Free plan, OUTDATED labels | "Open Exhibitions and choose Create First Exhibition (or + Create Exhibition). Add a title, choose who can see it, then Create Exhibition. On the Free plan an exhibition is always Public Exhibit; Private needs an upgrade." (`museum/page.tsx:578,724`; `museum/new/page.tsx:34,207-214`; `galleryTier.ts:24-27,49-51`) |
| (none) 18+ | MISSING | "Turn on 18+ exhibition if viewers must confirm their age." (`museum/new/page.tsx:228-241`) |
| "In the builder, open Edit/Add. Search or filter your vault, select the pieces ..., then choose Save at the bottom of the picker." (`:33`) | OUTDATED | "Choose Edit/Add, tick the items you want, then choose Add to Exhibit (n). An exhibit page holds at most 18 items." (`ItemPickerSheet.tsx:14,275,281`) |
| "Use Organize to arrange the display. Save your changes, then open Preview." (`:34`) | OUTDATED | "To arrange, choose Organize and drag items; choose Done when finished. Organize needs an exhibit page: if you have none, choose Create first exhibit. Changes save themselves. Choose Preview to see what visitors see." (`GalleryBuilder.tsx:1096-1115,1744-1760`; `museum/[galleryId]/page.tsx:498`) |
| (none) More than 18 items | MISSING | "One exhibit page holds 18 items. Create first exhibit splits a longer list into pages, in the order you picked." (`GalleryBuilder.tsx:49,1751-1754`; `ItemPickerSheet.tsx:14`) |
| "Review USER ACCESS MODE ... Review the other access options" (`:35`) | OK | Keep. Add one line per mode: Private = only you; Public Exhibit = anyone, listed on Home; Guest View = anyone with the link; Registered Users = signed-in people with the link. (`galleryAccess.ts:55-65`) |

### Arrange (drag)

| Help sentence / step | Status | Corrected text |
|---|---|---|
| "Use Organize to arrange the display" | OUTDATED | "Choose Organize, then drag items to new spots on the wall. Choose Done." Drag was only verified with scripted events (`docs/walkthrough/media-ready/README.md`, "Not shown on purpose"). I have not seen it tested with a real mouse or finger. Do not promise it works on phones. |

### Share an item or photos

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none (Learn "Share & Showcase": "Share the link anywhere") (`learnContent.ts:297`) | OUTDATED / MISSING | "On an item, choose Share. Share photos sends only the pictures you pick (through your phone's share sheet, or Download to device if your browser has none). It works for private items too. To share a link, the item has to be public; the panel asks Turn on public sharing? and you choose Yes." (`ShareDialog.tsx:105,351-355,380,385`; `ContentActionBar.tsx:179-186`) |
| none | MISSING | "Share public link shows Copy link and buttons for Messages, Facebook, WhatsApp, X, Email, Reddit, Telegram and Instagram. These only open that app with your link; nothing is posted until you confirm there." (`ShareDialog.tsx:293-300,397,415`) |
| none | MISSING | "Export for social makes a picture or video you save and post yourself." (`ShareDialog.tsx:471-476`) |

### Share an exhibition (Guest View)

| Help sentence / step | Status | Corrected text |
|---|---|---|
| "For a public exhibition, use Copy Link. Open that link in a signed-out browser ..." (`:36`) | OUTDATED | "Choose Share, then Copy link (or pick an app). If you see Turn on public sharing?, choose Yes; this makes it Guest View: anyone with the link can see it, and it is not listed on Home." (`ShareDialog.tsx:105-110`; `museum/[galleryId]/page.tsx:788-790`) |
| none (Guest View) | MISSING | "Guest View: anyone with the shared link can view your exhibition. It is not searchable on Home." (`galleryAccess.ts:57-59`) |
| none (Regenerate) | MISSING | "Regenerate link stops the old link from working." (`museum/[galleryId]/page.tsx:1061-1070`) |
| none (Invite Tokens) | MISSING | "Invite Tokens: create a labelled link for one person or group, copy it, set permissions or expiry, or Disable it." (`museum/[galleryId]/page.tsx:1335,1362,1426-1438`) Say so only if you want it taught. |
| Exhibitions list panel | MISSING / inconsistent | The list's "Exhibition Details" panel has its own "Share link" box with **Copy link** and "View public page" (`museum/page.tsx:975-985`). It is a second place to copy a link, outside the Share panel. It also falls back to a `/gallery/<id>` link when there is no token (`:876`). Help should not call the Share panel the only place until this is decided. |

### Selling, marking sold, costs

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none (Feature guide cards for Sales History, Sold filter, Listing Readiness give no how-to) | MISSING | "On an item, turn on Mark for sale. Add an Asking Price. The item then shows Listed for sale and the For Sale tab." (`vault/item/[id]/page.tsx:1457-1468`; `SectionNav.tsx:45`) |
| none | MISSING | "To record a sale, open the For Sale tab and choose Mark sold, or choose Sell on a Vault card. Enter the sale price, then where it sold." Both use simple pop-up prompts, not a form. (`vault/for-sale/page.tsx:282,331-346`; `SellItemButton.tsx:38-44,93-94`; `VaultListView.tsx:615`) |
| none | MISSING | "Sold shows a sold item's Sale price, Profit / Loss and Sold Date under SALE DETAILS, and a Return button puts it back in the Vault." (`vault/item/[id]/page.tsx:1337-1356`; `vault/sold/page.tsx:395,453`) SALE DETAILS only appears for items already sold, not while selling. |
| none | MISSING | "Profit is shown as Unknown if no cost was recorded." (`vault/item/[id]/page.tsx:1346`; `vault/sold/page.tsx:371`) |
| none | MISSING | "Fee amounts are estimates: Sold shows 'about $X in [platform] seller fees' from current fee tables. eBay and Mercari are checked against their own pages; Whatnot and Discogs are only partly confirmed." (`vault/sold/page.tsx:377,384`; `sellerFees.ts:5-17`) |
| none | MISSING | "Cost to Sell on an item shows fees and net after fees and shipping for a marketplace you pick. You can type your own Fee %." (`CostToSellPanel.tsx:96,124,146,154,158`) That file has uncommitted edits in this worktree, so labels may shift. |
| none | MISSING | "Listing copy writes text you copy and paste into a marketplace yourself. Nothing is listed for you." (`vault/item/[id]/page.tsx:1527`) |
| none (blank cost, zero cost, values) | MISSING | "Blank cost = unknown. 0 = recorded as free. A negative cost is refused. An item with no value is shown at its cost, labelled 'at cost'. Home says 'N counted at cost'." (`costInput.ts:1-6`; `HomeClient.tsx:270,467`; `vault/add/page.tsx:2127`) |
| "Scores each FOR_SALE item 0-100 across 6 checks: ..." (Feature guide, `guide/page.tsx:67-72`) | NOT CHECKED | Page exists (`vault/readiness/page.tsx`). I read only the level names Ready / Almost / Needs work (`:12-14`) and the For Sale filter (`:140`). Scoring weights and the "6 checks" were not verified. |

### Profile switching

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none in-app. Package scripts say: "To switch, open the account menu and choose a profile under Switch profile." (`04-.../narration-script.md`) | OK in spirit | The heading in the account menu is "Switch Profile" and appears only when you have 2 or more profiles (`TopNav.tsx:624-627`). Settings has a **Switch profile** dropdown and **+ Add business profile** (`SettingsShell.tsx:106,126`; `account/page.tsx:469`). Choosing a profile reloads the page (`TopNav.tsx:637-639`). |
| none | MISSING | "Business and Personal profiles each keep their own Vault." Consistent with project rules; Help does not state it in-app. |

### Sign-in and sign-out

| Help sentence / step | Status | Corrected text |
|---|---|---|
| none in-app. A separate text topic (not wired) covers password reset (`media-ready/help-guide/reset-your-password.html`) | MISSING in app | "Log in from the top bar or the account menu (Log In / Create Account). Sign out from the account menu (Sign Out)." (`TopNav.tsx:704-707,733`; `login/page.tsx:174,196`). Labels in the reset topic match the code (`forgot-password/page.tsx:89`; `reset-password/page.tsx:138,196`). |
| Help access on phones | MISSING | Phone Help links exist only when signed in, in the account menu (`TopNav.tsx:679-697`). See Open questions. |

### Delete

| Help sentence / step | Status | Corrected text |
|---|---|---|
| Package topic `help-guide/delete-an-item-or-exhibition.html` | OK | Labels match: **Delete item**, **Delete Forever** (`vault/item/[id]/page.tsx:1175,1801`), **Delete exhibition**, **Yes Delete FOREVER** (`museum/page.tsx:799,1098`). Not wired into the app. |

## 4. Screenshots and media inventory

Classes: **AS-IS** = reusable as-is. **CAPTION** = reusable with a caption or voice-over change. **REPLACE** = scene needs replacement. "Not opened" means I did not view the image and judged from its name, its script step and current labels. "Frames not inspected" means video frames were not viewed. Durations come from the MP4 header; sizes from the file system.

### 4a. `public/guide-media/` (used by `/guide/walkthrough`)

| File | Type, size | Used by | Class and reason |
|---|---|---|---|
| `add-item.mp4` | MP4, 29.7 s, 0.5 MB, has an audio track | Walkthrough "Add your first item" (`walkthrough/page.tsx:55-56`) | CAPTION. Frames not inspected. The poster shows the Add Item form (Identity, "ITEM NAME \*"), which matches `/capture`. Captions say "Add Item", "Open Category", "Save to Vault", which also match `/capture`. Gaps: no Quick Add or upload, "Return to your Vault" is no longer needed, and the closing line says "V L T D dot app". The audio is not listened to; if it follows the captions, the voice-over needs the same edits. |
| `add-item.vtt` | WebVTT, 3 cues, ends 0:29.7 | same | CAPTION. Cue 1: "you can upload a photo or add one later". Cue 3: "Return to your Vault and search". |
| `add-item.png` | PNG poster 80 KB (opened) | same (`poster=`) | AS-IS for the screen. Text on the poster reads "Vault > ADD ITEM. Enter the item name ... Photos are optional." Change to "Add Item" if you want to match the button. |
| `build-exhibition.mp4` | MP4, 41.9 s, 0.8 MB, has an audio track | Walkthrough "Build and share an exhibition" | REPLACE. Frames not inspected. The captions ("New exhibit", "Edit Add", "Save at the bottom of the picker", "Organize", "Copy Link") contradict the app in four places (section 2). Poster image shows the create page with Private selected, which is not available on Free. |
| `build-exhibition.vtt` | WebVTT, 4 cues, ends 0:41.8 | same | REPLACE (text). |
| `build-exhibition.png` | PNG poster 114 KB (opened) | same | CAPTION. Create page screen is current. Poster text says "Exhibitions > New exhibit ... Choose Private while you build" (stale; plan-dependent). |

### 4b. `docs/walkthrough/media-ready/` (unpublished package; no voice-over; MP4s 83.5 s / 104.0 s / 76.5 s / 67.5 s / 39.0 s / 32.5 s)

All six tutorial MP4s and `help-guide/` are not linked from the app. The README says the MP4s are kept out of git, but `git ls-files` lists all six of them, so the README is out of date. Per-video frames not inspected. The classes below are for the screenshots, which are what the video scenes were built from. Screenshots marked "(opened)" I viewed; others are not opened.

Video 1: `01-add-your-first-item/add-your-first-item.mp4` (83.5 s, 12.0 MB), `.srt`, `.vtt`, `narration-script.md`, `thumbnail.jpg`, `title-and-description.txt`.

| Screenshot | Step | Class and reason |
|---|---|---|
| `01-open-add-item.jpg` | Open Add Item | REPLACE. Header now has Quick Add, Add Item and the upload icon (`AddItemActions.tsx:22-34`). Not opened. |
| `02-choose-manual-entry.jpg` (opened) | Choose Manual entry | REPLACE. Shows the old Add menu (Scan, Quick Add, Manual entry, Upload photos for one item, Batch upload). That menu no longer exists. Manual entry is now the **Add manually** link (`VaultListView.tsx:793`; `EmptyVault.tsx:51`; `InsightsOverview.tsx:770`). Decide the path to teach first. |
| `03-add-a-photo.jpg` | Add a photo | CAPTION if the path stays Add manually (`/vault/add`). Not opened. Note `/vault/add` crops with "Use This Picture" (`vault/add/page.tsx:2859`). |
| `04-name-your-item.jpg` | Name your item | CAPTION. Labels still match `/vault/add` ("TITLE", "Ready to save", `ScanPanel.tsx:86`; `vault/add/page.tsx:2388`). Not opened. |
| `05-choose-a-category-and-add-details.jpg` | Category | CAPTION. Details follow the chosen category now (older inventory). Not opened. |
| `06-save.jpg` | Save | CAPTION. "Save" and "Ready to save" exist (`vault/add/page.tsx:2428`). The script says "top right"; the code says "Floating Save, always visible while scrolling" (`:2415`). Position not verified. |
| `07-confirmation.jpg` | Saved banner | CAPTION. "✓ Saved!" exists (`vault/add/page.tsx:2337`). Not opened. |
| `08-your-saved-item.jpg` | Vault shows item | REPLACE. Vault opens in Wall view with new summary cards (`VaultListView.tsx:90,2190`). Not opened. |
| `09-open-it-any-time.jpg` | Item page | REPLACE. Item page now has the action bar with **Share**, **Stream**, **Start Auction** and a new DETAILS card (`vault/item/[id]/page.tsx:1285-1304`). Not opened. |

Video 2: `02-build-and-share-an-exhibition/build-and-share-an-exhibition.mp4` (104.0 s, 15.1 MB) plus `.srt/.vtt/narration-script.md/thumbnail.jpg/title-and-description.txt`.

| Screenshot | Step | Class and reason |
|---|---|---|
| `01-create-first-exhibition.jpg` | Create First Exhibition | AS-IS. Label matches (`museum/page.tsx:724`). Not opened. |
| `02-title-and-description.jpg` | Title and description | AS-IS. Labels match (`museum/new/page.tsx:175,185`). Not opened. |
| `03-choose-who-can-see-it.jpg` (opened) | Visibility | CAPTION. Pills and 18+ box match. "Start with Private" is true only on paid plans; Free shows a fixed "Public Exhibit" (`museum/new/page.tsx:207-214`). |
| `04-create-exhibition.jpg` | Create | AS-IS. Button matches (`museum/new/page.tsx:301`). Not opened. |
| `05-your-exhibition-page.jpg` | Owner page | REPLACE. The page gained a Share button and Regenerate link row (`museum/[galleryId]/page.tsx:1046-1064`). Not opened. |
| `06-edit-add.jpg` | Edit/Add | AS-IS. Label matches (`GalleryBuilder.tsx:1091`). Not opened. |
| `07-choose-items.jpg` | Picker | AS-IS. Not opened. |
| `08-add-to-exhibit.jpg` | Add to Exhibit | AS-IS for a single page (`ItemPickerSheet.tsx:275`). Several pages say "Save (n items)". Not opened. |
| `09-review-and-save.jpg` | Review and save | CAPTION. Autosave; Save/Saved ✓ pill still exists (`GalleryBuilder.tsx:1014`). Not opened. |
| `10-preview-as-a-visitor.jpg` | Guest preview | REPLACE. The guest renderer now has the action bar (`GuestGalleryRenderer.tsx:325,633`). Not opened. |
| `11-choose-visibility.jpg` | Public Exhibit and Make public | AS-IS. Label and confirm text match (`museum/[galleryId]/page.tsx:1160-1165`). Not opened. |
| `12-share-it.jpg` (opened) | Share it | REPLACE. Shows the old row: "PUBLIC SHARE LINK", **Copy Link**, **Regenerate**, social icons. The current page has one **Share** button, **Regenerate link**, and Copy link inside the panel. |

Video 3: `03-import-your-collection/import-your-collection.mp4` (76.5 s, 12.3 MB) plus `.srt/.vtt/narration-script.md/thumbnail.jpg/title-and-description.txt`.

| Screenshot | Step | Class and reason |
|---|---|---|
| `01-open-import.jpg` | Tools > Import | CAPTION or REPLACE. Tools > Import is correct (`VaultToolsMenu.tsx:28`), but the header around it now also carries Quick Add / Add Item / upload icon. Not opened. |
| `02-choose-your-spreadsheet.jpg` | Upload Spreadsheet | AS-IS (`SpreadsheetImportClient.tsx:440`). Not opened. |
| `03-check-the-summary.jpg` | Summary | AS-IS ("Import Summary", `:554`). Not opened. |
| `04-review-duplicates-and-warnings.jpg`, `05-check-the-column-mapping.jpg` | Duplicates, mapping | AS-IS. Not opened. Cost handling (blank/0/negative) was changed for importers (`costInput.ts:1-3`), so any warning text about cost should be rechecked. |
| `06-handle-duplicates-and-confirm.jpg` | Review & Confirm | AS-IS (`:525`). Not opened. |
| `07-see-what-was-imported.jpg` | Result | AS-IS if the result message wording is unchanged. Not verified. |
| `08-see-your-items.jpg` | Vault | REPLACE (Wall view, new cards). Not opened. |

Video 4: `04-switch-personal-and-business/switch-personal-and-business.mp4` (67.5 s, 11.0 MB) plus `.srt/.vtt/narration-script.md/thumbnail.jpg/title-and-description.txt`.

| Screenshot | Step | Class and reason |
|---|---|---|
| `01-add-a-business-profile.jpg` | + Add business profile | AS-IS (`account/page.tsx:469`; `SettingsShell.tsx:126`). Not opened. |
| `02-enter-the-details.jpg`, `03-you-are-in-the-business-profile.jpg` | Form, active profile | AS-IS ("Business name", "Business handle", "Create business profile", `account/business/new/page.tsx:62,66,84`). Not opened. |
| `04-a-separate-empty-vault.jpg` | Empty Vault | REPLACE. Empty state now shows "Scan your first item", Quick Add, Add manually, Import (`VaultListView.tsx:786-805`). Not opened. |
| `05-add-items-to-this-profile.jpg` | Add items | REPLACE if it shows the old header or menu. Not opened. |
| `06-switch-profile.jpg` | Account menu | CAPTION. Heading "Switch Profile" and reload behaviour (`TopNav.tsx:626,637-639`). Menu layout not verified. |
| `07-your-personal-vault-is-unchanged.jpg` | Vault | REPLACE (Wall view, new cards). Not opened. |

Social (vertical): `social-vertical/add-it-to-your-vault.mp4` (39.0 s, 2.9 MB) and `turn-your-collection-into-an-exhibition.mp4` (32.5 s, 2.6 MB), each with `.srt/.vtt`, `-script.md`, `-thumbnail.jpg`, `-title-and-description.txt`.

| File | Class and reason |
|---|---|
| `add-it-to-your-vault.mp4` | CAPTION. Frames not inspected. Beats ("Add a photo and a name / Add the details / Choose Save / Saved! / It is in your Vault") fit `/vault/add`. The last two beats show the Vault and likely use stale frames. |
| `turn-your-collection-into-an-exhibition.mp4` | REPLACE. Frames not inspected. Beat 3 "Copy the link" uses the old link row. |
| Thumbnails (6 JPGs, 85-127 KB) | Not opened. Check each one for the stale scenes above before reuse. |

Other files: `README.md`, `CHANGE-REPORT.md`, `HELP-CORRECTION-INVENTORY.md`, `index.html` and `_build/*.cjs` are source and QA files, not user media. `help-guide/index.html`, `delete-an-item-or-exhibition.html` and `reset-your-password.html` are drafts not linked from the app. The delete and reset topics match current labels (section 3). `docs/walkthrough/vltd-setup-walkthrough.html` (660 KB, embeds its screenshots) covers onboarding and profiles; I spot-checked "Save and continue", "Personal only", "Add a business profile", "+ Add business profile", "Business name / handle", "Create business profile", "Settings" (`onboarding/page.tsx:388,466,483-484`; `TopNav.tsx:667`) and they match. I did not check every sentence or image. `docs/walkthrough/2026-10-14-qa/` holds internal QA screenshots, not customer media.

`public/learn/*.jpg` (7 covers: before-you-sell, building-exhibitions, insurance-basics, market-comps, photographing-items, pricing-with-confidence, storage-and-labels): cover art with no text inside the file that I know of (not opened). No change needed for workflow changes.

## 5. Things that must NOT be promised in Help right now

- **Referral or invitation rewards.** The invite page says "Invitation rewards are not available right now." (`account/invite/page.tsx:225`). Current Help and Learn contain no reward text (searched `learnContent.ts`, `guide/`, the package scripts and `help-guide/`: none). Keep it that way. The Exhibitions page still holds code for bonus exhibitions from referrals (`museum/page.tsx:372`); do not describe it.
- **Anything automatic with AI.** AI runs only from **Identify with AI** (`capture/page.tsx:972`; `ScanPanel.tsx:224`; `ScanVerifySheet.tsx:263`), **Identify N with AI**, **Scan with AI to fill details** (`vault/bulk/page.tsx:532`), and **Scan certificate with AI** (`CoaScanButton.tsx:99`). Do not write "scan and it fills in the details", "photo does the first draft" or "gets you 80% of the way" (`learnContent.ts:335-342`). Say each use counts against your AI scans.
- **AI values.** The AI value is only a hint in the Value box and is saved only if the person types it (`ScanVerifySheet.tsx:255-257`). Do not say AI sets a value.
- **Private exhibitions for everyone.** Free plan cannot choose Private on the create page (`museum/new/page.tsx:207-214`). Say "on paid plans".
- **A tested drag or phone-arranging flow.** Dragging was verified only with scripted events (`media-ready/README.md`). Camera capture was never verified on a real device.
- **Automatic posting.** Share destinations only open the other app with your link (`ShareDialog.tsx:415`). Export for social and Listing copy post nothing.
- **Fee figures as exact.** Estimates only; Whatnot and Discogs are "partly" confirmed (`sellerFees.ts:5-17`).
- **Market Pulse on Discover, goal "Browse vault" button, milestone hints, "Almost there"** (`guide/page.tsx:41-57,76-94`). I did not find Market Pulse on Discover (only "Market Pulse (7D)" in the Lounge, `community-board/page.tsx:683`), nor "Browse vault" or the "to 50%" hint in `goals/page.tsx`. The goals page shows "Find N more", "View set", "Review items", and says "Milestones will appear here after goal due dates are added to the goal model." (`:122,426`). "Almost there" exists only in `GoalsProgressWidget.tsx`. Remove or re-verify before keeping.
- **Auction, Learn "Stream mode", "insurance readiness switch"** as described in `learnContent.ts:236,298`. Auction exists, stream is a presenter screen, readiness is a card, not a setting.
- **Item count or storage promises.** Free plan: 50 items, 4 public exhibitions, 1 in storage (`galleryTier.ts:20-27,48,55-60`). Image quality differs by plan (`:63-67`). If Help names limits, take the numbers from there, not from older text.

## 6. Open questions for the product owner

1. Which entry should the "Add your first item" lesson teach first: Add Item (`/capture`, has the photo area, Identify with AI, **Save to Vault**) or Add manually (`/vault/add`, **TITLE**, **Save**)? The old tutorial scenes assume a menu that is gone.
2. Should Help say Private is a paid-plan choice? On Free, exhibitions are public (`museum/new/page.tsx:34,207`). The owner page access pills do not check plan (`museum/[galleryId]/page.tsx:550-558` has no tier test). I could not confirm whether a Free user can switch to Private there.
3. Do you want the Exhibitions-list "Share link / Copy link" box (`museum/page.tsx:975-985`) kept? It is a second place to copy a link and uses `/gallery/<id>` when no token exists. Help currently cannot say "one Share panel" without it being untrue.
4. Should signed-out phone visitors see Help? Today they do not (`TopNav.tsx:413-428,679-697`, and the Log In block at `:700-707` has no Help link).
5. Should Help teach Invite Tokens (`museum/[galleryId]/page.tsx:1335-1438`) and "Regenerate link", or leave them out?
6. Do you want the Learn playbooks (Getting Started, Share & Showcase, Sell Anywhere) and quick guides (Scan & Add Items, Export & Sell Anywhere) rewritten to the real buttons, or kept as general advice with the workflow lines removed? Articles under `/learn/articles` come from the CMS and I did not read them (`src/app/learn/articles/[slug]/page.tsx`).
7. Should the two in-app MP4s be replaced (they have audio and the build-exhibition one contradicts the app) or taken down until replaced? Does the audio match the captions? I could not listen.
8. The older inventory (`media-ready/HELP-CORRECTION-INVENTORY.md`) says the add-item field is "Title" and the Save is "Save". That is true only for `/vault/add`. `/capture` says **Item Name \*** and **Save to Vault**. Which of those two screens is the "Add Item" you want taught?
9. Stale labels on the same `/capture` entry: header says **Add Item**, empty Vault says "Scan your first item" (`VaultListView.tsx:786`), other empty states say "Smart Scan" (`EmptyVault.tsx:45`, `insurance/page.tsx:177`, `InsightsOverview.tsx:769`, `vault/sync/page.tsx:256`). Pick one name before Help names it.
10. The worktree has two uncommitted edits (`CostToSellPanel.tsx`, `closeout-checks.cjs`) that I did not make. If `CostToSellPanel.tsx` is changing labels, re-check the Cost to Sell lines above.

## What I could not verify

- Any video frames (none of the 10 MP4s). Audio content of the two in-app MP4s (a sound track exists; I did not listen).
- Any behaviour in a browser; everything is from reading code.
- 33 of 36 tutorial screenshots, all six thumbnails, and `public/learn` images were not opened.
- Learn articles served from the CMS.
- Goals and Market Pulse behaviour beyond a text search; Listing Readiness scoring weights.
- Whether a Free-plan owner can switch an exhibition to Private after creating it.
