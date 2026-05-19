# VLTD — Development Task List
*Competitor-Informed Feature Roadmap · Prioritized by Impact*

> Tasks are organized into three phases. Start at the top — each "Do Now" feature directly strengthens the launch story and marketing content.

---

## 📊 STATUS SNAPSHOT — Last Updated May 2026

| Status | Count |
|--------|-------|
| ✅ Fully complete | 34 |
| 🔶 Partially complete | 0 |
| ⬜ Not started | 7+ (Phase 2 expanded — see below) |

### ✅ Fully Completed
- **Scan Autofill Flow** — scan/barcode/OCR/AI now auto-fills fields directly, low-confidence image scan no longer fills fields (`429fa5e`)
- **Vault Add Header Alignment** — header aligned, redundant buttons removed (`68b0fc7`)
- **Unsaved Changes Guard** — warning now only fires on real draft changes (`a98ade7`)
- **Activity Page** — `/activity` route added with recent vault additions, value updates, sales activity, basic stats (`1375980`)
- **SAFE NEXT 1 — Data Export / Vault Portability** — CSV + JSON export, Export dropdown button in Vault header (`64a2c69`)
- **SAFE NEXT 5 — Portfolio-Level Net Proceeds** — "Net if sold today" panel, platform selector, fee estimate, net gain/loss, ROI (`64a2c69`)
- **SAFE NEXT 2 — Notable / Key Item Detection** — `isNotable()` + `notableReason()`, `NotableBadge` on cards + detail + summary (`ba81722`)
- **SAFE NEXT 4 — Want List Improvements** — universe/category/condition/priority fields, rebuilt card + page, sort + filter (`f5113f3`)
- **SAFE NEXT 3 — Variant / Edition Tracking** — edition/variant/printRun/isFirstEdition on VaultItem, form + chips + isNotable + CSV (`2fcd03c`)
- **SwipeStack — Gallery + Vault integration** — Grid/Swipe toggle in gallery, Shelf/Flip toggle in vault, view mode persists (`4fee450`)
- **TASK 00A — Vault Registry (Phase 1)** — subject field, subjectRankings.ts, SubjectRankingsWidget, subject filter + portfolio widget (`e2e7b78`)
- **TASK 00B — Collection Goals / Completion %** — collectionGoals.ts, /goals route, GoalCard, AddGoalSheet, GoalsProgressWidget (`e2e7b78`)
- **TASK 6 — Multi-Marketplace Price Sources** — value range (low/median/high), comparable sales, per-category marketplace suggestion links, rebuilt PricingMvpCard, portfolio prefers valueMedian, CSV updated (`5302af7`)
- **TASK 1 — AI Condition Grading** — universe-specific grading prompts (PSA/CGC/Goldmine/WATA), conditionReason + conditionSource + conditionConfidence fields, AI data mapped through scan flow, ConditionAssessmentPanel with manual override, grade badge on vault cards, grade quick filters, CSV export (`aa4ee66`)
- **TASK 4 — For Sale Toggle + Listing Polish** — FOR_SALE status, askingPrice field, toggle on item detail, asking price field, For Sale badge on cards, vault filter, listing copy gated behind For Sale, condition-aware listing language, shipping suggestions, eBay item specifics, Whatnot + Discogs listing support (`aa4ee66`)
- **TASK 5 — Auto-Generated Listing Copy** — condition language, shipping suggestions, eBay specifics, variant/edition/askingPrice/universe in listing input, For Sale gate on panel (`aa4ee66`)
- **Museum View Wire-In** — VaultMuseumView committed + wired as third vault view mode alongside Shelf/Flip; Museum is default view; view mode persists; "See all" universe filtering wired into existing vault filters (`dfa2938`)
- **TASK 8 — Stream / Content Mode** — `/vault/item/[id]/present` route, StreamDisplay component, tap-to-reveal with spring animation, blurred background, gold value reveal, aspect controls (Full/9×16/16×9), auto-hiding controls, Reset Reveal, Stream button on item detail (`5e6f55a`)
- **Insurance Documentation PDF Export** — insurancePdf.ts, hidden iframe print flow, cover page + per-item sections with photo/grade/condition/comparables, InsurancePdfButton with options sheet, wired into item detail + Export dropdown (`3c93fbd`)
- **TASK 3 — Haul Mode / Bulk Rapid Scan** — haulSession.ts, HaulReviewSheet, HUD (session name + item count + estimated value), camera auto-reopens after each save, haul shortcut in /vault header, autostart flag, share haul summary, finish clears session + returns to vault (`642bdf4`)
- **Gallery Hero Panel Fix** — compact padding, slim stat chips (Value/ROI/Notes/Views), fits on one screen without scroll (`99bc911`)
- **Museum Carousel UX** — clip fix, uniform card sizes, center-snap, image-no-click/title-navigate, spotlight carousel + dot indicators + Expand button (`029b0d5`)
- **Museum Spotlight + Active Card Fixes** — height 220px fixed, expand button moved to stats row with 4-corner SVG, strong gold active card glow, scroll-position center math, activeIndex -1 on load, gold value pills restored (bundled with carousel work)
- **Enhanced Capture** — TF.js object detection, blur warning, 7 filter presets, adjust sliders, @imgly background removal + 10 creative backgrounds (`feat: enhance capture photo controls`)
- **Per-Item Privacy Toggle** — `is_public` Supabase migration, `isPublic` field in VaultItem type + cloud layer, `ItemVisibilityToggle` component, lock icon on VaultCard, visibility section on item detail, private badge on Museum carousel + Spotlight cards, $0 value display fix on VaultCard
- **Quick Add Redesign** — camera viewfinder card replaces flat button, redundant Home button removed from header, scoped nav/logo shadow cleanup in quick-add-pass.css, outer card wrapper removed for cleaner layout
- **ScanCapturePanel — Auto-Lock Haul Camera** — new fullscreen scan camera: blur-based auto-lock at 700ms stability, frame pills (Card/Book/Jewelry/Art), gold glow corner brackets, Back/OR/Next buttons glow post-snap, "Quick scan only" checkbox disables Back for speed runs, Universe + Category pill rows at bottom, Done → HaulReviewSheet
- **Public Vault URL** — `public_profiles` Supabase table + public read RLS, `vault_items` public read RLS for `is_public = true`, `publicProfile.ts` (syncPublicProfile, fetchPublicVaultItems, getPublicVaultUrl), `/v/[profileId]` public route renders Museum View for any visitor, "Share vault" copy-link button in vault header
- **primary_focus routing** — Focus badge on HomeClient becomes a `<Link>` to collector's universe vault page via `focusToVaultSlug()`; vault/page.tsx caches focus in localStorage, `orderedUniverses` memo floats focus universe to top of grid with "· Your Focus" label
- **Discover filter tabs + search** — discover/page.tsx rewritten: Supabase select expanded to include description + theme_pack, `inferGalleryCategory()` classifies galleries by text match, 8 category tabs (All + 7 universes), combined tab + search filter applied to both Featured Museums grid and Trending Exhibitions row, filtered empty state with "Show All" reset
- **Landing page rewrite** — PublicHomeClient.tsx: hero sharpened, 6 feature cards (+ Stream Mode + Auto-Lock Scanner), Scanner callout section with frame mockup + Haul Mode copy, comparison table expanded 6 → 9 rows with proper header row, 3-stat social proof strip, updated CTA + 3-col footer

### 🏁 Safe Next Queue — ALL COMPLETE ✅
1. ✅ Data Export / Vault Portability — `64a2c69`
2. ✅ Notable / Key Item Detection — `ba81722`
3. ✅ Variant / Edition Tracking — `2fcd03c`
4. ✅ Want List Improvements — `f5113f3`
5. ✅ Portfolio-Level Net Proceeds — `64a2c69`

### 📋 Handoff Queue — EMPTY ✅
All handoffs shipped. Core loop (scan → vault → share) is complete.

### 🎯 Pre-Launch (next before marketing push)
- **USPTO trademark filing** — file before press coverage starts

### 🎯 Phase 2 — When users exist (Supabase, post-launch)

**Gallery & Image Quality**
- **Vault Registry Global Rankings** — subject column in DB, get_subject_leaderboard RPC, /registry/[subject] public page, rank badge, share card, notifications. Spec in `VLTD-Coder-Handoff-VaultRegistry.md`.
- **Task 7 — Weekly Vault Report Email** — personalized Monday digest, top mover, vault value delta, market alerts, unsubscribe pref
- **Task 10 — Visual Match / Recent Comparable Sales** — eBay Sold API, thumbnail comps panel post-scan, "use this as my value" pin
- **Task 11 — Rarity Intelligence** — PSA/CGC pop report pulls, rarity score, "rarest in your vault" section
- **Task 12 — Offline Capture / Convention Mode** — localStorage scan queue, background sync, "3 items syncing" indicator

**Advanced Image Studio (Phase 2)**
- **Decorative Export Frames** — collector-themed frame art around the item photo for social exports: glass case frame, comic panel border, PSA slab frame, vintage poster frame, neon display case. User picks a frame, item photo composited inside, exported as 1080×1080 or 1080×1920. Built on Canvas API — no external service.
- **Stickers + Overlays** — in-edit sticker sheet: grade badges (PSA 10 / CGC 9.8 etc.), "Key Item" stars, "For Sale" banners, "SOLD" stamps, "🔥 HOT" tags, numbered edition stamps. Draggable, resizable on the canvas before saving. Targeted at sharing and haul content creation.
- **Local Adjustments (U Points)** — tap a region of the photo and adjust brightness/saturation only in that area (like Snapseed's U Points). Implemented via canvas masking. Lets users brighten a dark grade label without overexposing the image.
- **AI Image Enhancement / Upscale** — run a lightweight super-resolution model (ESRGAN via ONNX/WASM) to upscale old blurry phone photos of items to near-print quality. One-tap "Enhance" button on item detail and in the edit sheet.
- **Batch Photo Edit** — apply the same filter/adjust preset to all selected items in the vault. "Apply to collection" option in filter studio. Key for users who want a consistent aesthetic across their museum view.
- **Multi-Angle Capture (360° feel)** — guided "rotate around your item" flow in Haul Mode and standard capture: prompts user to shoot front, back, detail close-up, grade cert. Auto-groups into an ordered image set. Displayed as a swipeable stack on item detail and a mini-carousel in Museum view.

**Social & Sharing (Phase 2)**
- **Social-Ready Export** — redesigned share flow (replaces the removed Share Image section): pick export format (1:1 for Instagram, 9:16 for TikTok/Reels, 4:5 for portrait feed, 16:9 for YouTube thumbnail). Pick a creative background or keep transparent. Watermark auto-applied for free users, removable for paid. Financials never included — value shown only as a blurred/locked overlay that the user can optionally reveal.
- **Feed Planner / Photo Grid Preview** — show the user how their vault items look laid out as an Instagram-style grid before they post. Let them reorder, select which items to include, preview the grid aesthetic. Export as individual images or a collage strip.
- **Signature Watermark** — user can set a custom handle or logo that gets composited into their export images. Free tier: "via VLTD" text. Paid tier: custom text or uploaded logo mark. Distinct from the app watermark.
- **Story / Reel Template Pack** — pre-built 9:16 templates for "haul reveal," "just graded," "sold," "want list," "collection milestone." User fills in their item photo + stats, one-tap export. Linked to Haul Mode and Stream Mode.

**Auction & Sales (Phase 2)**
- **VLTD Marketplace Listings** — in-app listing board where for-sale items are publicly visible at `/market`. Buyers can browse by universe/category/price. Sellers set price and condition, buyer contacts via profile. No payment processing in Phase 2 — contact-only. Foundation for full marketplace later.
- **Auction Mode** — per-item auction setup: reserve price, auction duration (1 / 3 / 7 days), auto-close timer, optional "Buy It Now" price. Auction countdown displayed on item card and detail page. Integrated with Stream Mode — stream your live auction reveal directly from the item's `/present` page.
- **Bid History + Notifications** — buyers can bid on auctioned items, seller sees bid log, both parties get push/email notifications on new bids, outbids, auction close. Requires Supabase realtime.
- **eBay / Whatnot / Discogs Auto-Push** — one-click push of the item's VLTD listing copy + photos directly to eBay (via eBay API), Whatnot (via link + copy), or Discogs (via Discogs API). Avoids re-entry. Currently listing copy is generated but user pastes it manually.
- **Sold Analytics Dashboard** — full-circle sales tracking: what sold, at what price, compared to estimated value at time of sale, profit/loss trend over time, best-performing universe, average time-to-sell. `/portfolio/sales` route with charts.
- **Offer / Counter-Offer Flow** — buyers can submit private offers on For Sale items. Seller gets notification, can accept / decline / counter. All in-app, no external messaging needed. Builds trust vs. random DM negotiation.

**Collector Community (Phase 3 — needs real user base)**
- **Public Collector Profiles** — `/collector/[handle]` public page: display name, bio, featured vault items, total value (optional), trade/sell badge, recent activity. Privacy controls let users show/hide specific universes.
- **Trade Board** — collectors list items "open to trade." Browse by universe/category. Propose trades in-app (offer your item for their item). Accept/decline flow. No money changes hands.
- **Vault Compare** — two users can compare their collections side-by-side: shared universes, value gap, notable items each has that the other wants. Social/bragging feature.
- **Follow + Feed** — follow other collectors, see their new additions in a feed (similar to Activity page but community-wide). "New to [collector]'s vault" cards with item photo, title, estimated value.
- **Collection Challenges** — community-set goals: "Complete the 1994 Upper Deck set," "Own all 7 original Pokémon starters graded PSA 10." Users who complete a challenge get a badge on their profile. Drives engagement and repeat opens.

---

---

## ✅ PHASE 1 — DO NOW
*High impact, buildable before launch, directly feeds marketing*

---

### TASK 00A: Vault Registry — Collector Rankings ("Bragging Rights")
**Borrowed from:** TCDB
**Why it's priority:** TCDB's single most powerful engagement mechanic. Free, social, shareable, and drives obsessive daily use. No other VLTD competitor has this. It's a retention engine and a viral acquisition loop in one.

- [ ] Design the "Vault Registry" system — global rankings per collectible subject
- [ ] Define rankable subjects per category:
  - Sports cards: by player name
  - TCG: by set name, character, expansion
  - Comics: by title/series, character, publisher
  - Vinyl: by artist, label, era
  - Games: by franchise, platform, publisher
  - Toys/Figures: by character, line, manufacturer
- [ ] Ranking metric: number of unique items owned per subject (not duplicates)
- [ ] Secondary ranking metric: collection completion % (for set-based subjects)
- [ ] Build public leaderboard page per subject: "Top Collectors of Shohei Ohtani" → shows top 25 globally with username, item count, and vault link
- [ ] Show collector's own rankings on their vault dashboard: "You are #12 globally for Pokémon Base Set"
- [ ] Rankings update in real time as items are added/removed
- [ ] Share mechanic: one-tap share card "I just hit #1 for [subject] on VLTD"
- [ ] Display top ranking on public gallery header: "Ranked #4 globally · Dwight Gooden Collection"
- [ ] Email/push notification: "You just moved to #8 globally for [subject]" or "Someone is catching up to your #1 ranking"

---

### TASK 00B: Collection Completion Percentage
**Borrowed from:** TCDB
**Why it's priority:** The single most powerful daily-return mechanic in the collector space. A completion % creates a goal, and a goal creates return visits.

- [ ] For every set/series in the VLTD catalog, calculate and display completion %
- [ ] UI: progress bar on set/series view — "47 of 102 · 46% complete"
- [ ] Show top incomplete sets on vault dashboard: "Your closest to complete sets"
- [ ] "Missing pieces" button: shows all items in the set not yet in vault → one-tap add to want list
- [ ] "Almost there" threshold alerts (90%+ complete): push notification + dashboard badge
- [ ] Allow completion % to display on public gallery: "96% complete Pokémon Base Set · 98/102 cards"
- [ ] Onboarding flow: after first scan, show "You own X% of [set] — want to track your completion?"
- [ ] Custom sets: collectors can define their own set targets (e.g., "All [Player] rookies pre-2000")

---

### TASK 0A: Data Export / Vault Portability
**Borrowed from:** Beckett Organize (counter-feature — they don't have it, VLTD should lead with it)
**Why now:** Beckett won't let collectors export their own data. This is a known community pain point. Making export prominent and easy removes the #1 switching objection and builds trust immediately.

- [ ] Build full vault export from user settings:
  - **CSV export** — all items with fields: title, category, condition, cost basis, current value, date added, notes
  - **JSON export** — full structured data for technical users
  - **PDF export** — formatted collection report (human-readable, printable)
  - **Photo export** — zip file of all item images
- [ ] Add "Export Your Vault" button prominently in Settings (not buried)
- [ ] Export should include: all vault items, all galleries, wishlist, sold items history
- [ ] On the marketing/landing page: explicitly state "Your data is always yours — export anytime, in any format"
- [ ] Consider: import from competitors (CSV import from Beckett, CollX, CLZ) — make switching easy

---

### TASK 0B: Set / Checklist Completion Tracking
**Borrowed from:** Beckett Organize (their best feature)
**Why now:** Completion tracking is one of the most powerful retention hooks in any collector app. It creates daily return visits and turns the vault into a living goal tracker.

- [ ] Build "Sets" as a first-class concept in VLTD alongside individual items
- [ ] Define sets per category:
  - **TCG:** Expansion sets (Base Set, Jungle, etc.) — pulled from database
  - **Sports Cards:** Team sets, player rainbows, year sets
  - **Comics:** Issue runs by title/series
  - **Games:** Franchise series (all Zelda titles, all Mario titles, etc.)
  - **Vinyl:** Artist discography
- [ ] Completion tracker UI: "Base Set: 98/102 cards (96% complete)"
- [ ] Show completion progress on vault dashboard as a widget
- [ ] "Missing pieces" auto-populate the Want List (Task 0C below)
- [ ] "Almost complete" notification: "You're 3 cards away from completing Base Set"
- [ ] Surface set completion in the public gallery: "Complete Sets" section
- [ ] Allow collectors to manually define custom sets (for niche collections not in database)

---

### TASK 0C: Want List
**Borrowed from:** Beckett Organize
**Why now:** Want lists create engagement loops — collectors come back daily to check if someone has what they need. Feeds directly into the future trade network.

- [ ] Add "Want List" tab to vault (alongside vault, gallery, portfolio)
- [ ] Collectors can add any item to their want list:
  - From a scan/search result: "Add to Want List"
  - From another user's public gallery: "Add to Want List"
  - From set completion: missing items auto-add
- [ ] Want list items show: target price (what they're willing to pay), condition preference, notes
- [ ] Public want list option: allow other VLTD users to see your want list
- [ ] "Wanted by X collectors" counter on item details — social proof for sellers
- [ ] Match want lists against "For Trade" / "For Sale" items (groundwork for trade network)
- [ ] Email alert: "Someone listed an item on your want list" (future)

---

### TASK 1: AI Condition Grading
**Borrowed from:** ToyzieAI, ComicSnap
**Why now:** Feeds insurance documentation directly. Makes every scan more valuable. No other free multi-category app does this.

- [ ] Extend the scan result screen to include a condition assessment section
- [ ] Define grading scales per category:
  - Cards (sports + TCG): PSA 1–10 scale
  - Comics: CGC 0.5–10 / named grades (Poor → Near Mint)
  - Toys/Figures: AFA/CGA-inspired (C10, C9, C8, etc.)
  - Vinyl: Goldmine scale (M, NM, VG+, VG, G+, G, F, P)
  - Games: WATA / VGA inspired (sealed) or standard condition (CIB, loose)
- [ ] AI analyzes scan image for: surface, edges, corners, spine/creases, packaging integrity
- [ ] Output: named grade + numeric range + short reasoning ("Minor corner wear noted")
- [ ] Add manual override — collector can set their own grade if they disagree
- [ ] Store condition as a structured field on each vault item (not just a text note)
- [ ] Feed stored condition into insurance packet generator (condition = value modifier)
- [ ] Display condition badge on vault item cards and gallery tiles
- [ ] Add condition filter to vault search ("Show all Near Mint items")

---

### TASK 2: Notable / Key Item Detection
**Borrowed from:** ComicSnap (Key Issue Finder)
**Why now:** Single biggest "wow" moment for collectors. Extremely shareable. Hero feature for the public gallery.

- [ ] Build "Notable Items" detector that flags items in the vault:
  - **Comics:** First appearances, origin issues, death issues, key variants, 1st prints
  - **Sports Cards:** Rookie cards, autographs, numbered parallels (/10, /25, /100), 1/1s, printing plates
  - **TCG:** 1st Edition, Shadowless, holographic errors, misprints, illustration rares
  - **Games:** Sealed, black label, Greatest Hits, 1st print regional variants
  - **Toys:** Production samples, error figures, limited runs, convention exclusives
- [ ] AI evaluates item metadata + title + variant field at time of scan
- [ ] Flag notable items with a ⭐ badge in the vault list view
- [ ] Add "Notable Items" dedicated section to the vault dashboard
- [ ] Surface notable items as heroes in the public gallery ("Key Pieces" section)
- [ ] Send a push notification when a newly scanned item is detected as notable:
  - "Nice find — your [Item] is flagged as a key issue / rookie card / 1st edition"
- [ ] Add "Notable" filter to vault search

---

### TASK 3: Bulk / Rapid Scan Mode ("Haul Mode")
**Borrowed from:** HobbyScan
**Why now:** Biggest onboarding friction reducer. Collectors with 200+ items will not manually confirm each scan. This is what turns signups into active vaults.

- [ ] Add "Haul Mode" button to the scan screen (separate from standard single-scan flow)
- [ ] In Haul Mode: camera stays open after each scan — no full confirmation screen between items
- [ ] Items queue up in a "pending" state during the haul session
- [ ] Show a persistent HUD during scanning:
  - Items scanned: 12
  - Session value: $847
  - Tap to review
- [ ] End-of-session review screen: show all queued items as a batch
  - Collector can confirm, edit, or remove individual items before committing to vault
- [ ] "Share your haul" prompt at end of session — one-tap post to social or gallery
- [ ] Save haul sessions as a named collection group automatically ("May 12 Haul")
- [ ] Add Haul Mode to onboarding flow — first thing new users do after signup

---

### TASK 4: Profit / Net Proceeds Calculator 🔶 PARTIALLY COMPLETE
**Borrowed from:** Gemli
**Commit:** `4edd272 feat: surface net proceeds calculator on item detail`

- [x] Audited `CostToSellPanel.tsx`
- [x] Added sale price input + shipping cost input
- [x] Added platform fee presets: eBay, Mercari, Whatnot, PWCC, Discogs, Custom %
- [x] Added net proceeds + net gain/loss vs. cost basis calculation
- [x] Added category-based platform suggestions
- [x] Surfaced calculator on every vault item detail page under market summary
- [ ] Add formal "Mark for Sale" toggle on each item
- [ ] Add dedicated "For Sale" view
- [ ] Show portfolio-level net proceeds: "If you sold everything today, you'd net: $X"
- [ ] Improve platform suggestions with more marketplace-specific logic
- [ ] Add compact version in vault cards / dashboard
- [ ] Eventually: connect actual listing/sale workflows

---

### TASK 5: Auto-Generated Listing Copy 🔶 PARTIALLY COMPLETE
**Borrowed from:** Valuable App
**Commit:** `1469ffb feat: add marketplace listing copy panel`

- [x] Upgraded `listingGenerator.ts` from basic JSON to rich listing generation
- [x] Generates: marketplace title, description, suggested price, category, social caption
- [x] Added marketplace formats: eBay, Etsy, Icona
- [x] Rebuilt `ExportListingButton.tsx` into full listing-copy panel
- [x] One-tap copy to clipboard
- [x] Surfaced listing copy panel on vault item detail (after net proceeds calculator)
- [x] Tightened type safety in marketplace wrapper component
- [ ] Add AI-generated copy using item image + richer context
- [ ] Add condition-specific listing language
- [ ] Add shipping suggestions by item type
- [ ] Add eBay-specific item specifics format
- [ ] Gate panel behind "For Sale" toggle once that exists
- [ ] Optional later: direct marketplace API publishing

---

### TASK 6: Multi-Marketplace Price Sources
**Borrowed from:** CovrPrice
**Why now:** Insurance documentation credibility. Single-source (eBay only) valuations are easily disputed. Multi-source valuations are defensible.

- [ ] Audit current valuation data sources in the codebase — confirm which APIs/sources are used
- [ ] Add secondary marketplace sources per category:
  - Cards: eBay sold + MySlabs + PWCC recent auction results
  - Comics: eBay sold + MyComicShop + Heritage + Comic Connect
  - Vinyl: eBay sold + Discogs
  - Games: eBay sold + PriceCharting
  - Toys: eBay sold + recent auction data
- [ ] Display valuation with source attribution: "Based on 14 recent sales across eBay and Discogs"
- [ ] Show value range (low / median / high) not just a single number
- [ ] In insurance packet: list the specific comparable sales used to justify the stated value
- [ ] Add "Last updated" timestamp to all valuations so insurance companies can see recency

---

## 🎯 SAFE NEXT — Recommended Immediate Targets
*Low external dependency, buildable in UI/local logic, high marketing value*

---

### NEXT 1: Data Export / Vault Portability ✅ SHIPPED `64a2c69`
**What shipped:** CSV export, JSON export, Export dropdown button in Vault header. Files: `src/lib/vaultExport.ts`, `src/components/VaultExportButton.tsx`, `src/app/vault/page.tsx`.

**Still on the roadmap (future):**
- [ ] PDF export — formatted printable collection report
- [ ] Photo/image export — zip of all item images
- [ ] Insurance packet PDF export (if not already standalone)
- [ ] Add "Your data is always yours — export anytime, in any format" to landing page copy
- [ ] Consider: CSV import from Beckett, CollX, or spreadsheet to ease switching

---

### NEXT 2: Notable / Key Item Detection ✅ SHIPPED `ba81722`
**What shipped:** `isNotable()` + `notableReason()` in `itemIntelligence.ts`, `NotableBadge` component, badge on VaultCard and item detail page header + summary. Cleaned `any` types in VaultCard while touching it. 5 files, +334/-66.

**Still on the roadmap (future):**
- [ ] Add "Notable Items" section / filter to vault search
- [ ] Surface Notable badge in the public gallery
- [ ] Plan: upgrade to AI-powered detection (Task 2 in main list) once external data is available

---

### NEXT 3: Variant / Edition Tracking — First-Pass Fields ⬜ NOT STARTED
**Why do this:** Pure UI work — add structured fields that already exist conceptually in the data model. Feeds into listing copy, insurance docs, and the Notable detector above.

- [ ] Audit current item schema — confirm what variant/edition fields exist vs. what needs adding
- [ ] Add structured fields to the item detail form:
  - **Universal:** Edition (1st, 2nd, Limited), Variant type (free text), Numbered (e.g., /100, /10, 1/1), Signed (yes/no), Cert number
  - **Cards:** Parallel type (Base, Holo, Refractor, Prizm, Superfractor), Print run
  - **Comics:** Printing, Cover variant (A/B/C/D), Newsstand vs. Direct
  - **Games:** Completeness (Sealed, CIB, Loose, Manual only), Region (NTSC/PAL/JP), Label variant
  - **Vinyl:** Pressing details, Label name, Matrix/runout, Color variant
- [ ] Surface variant fields on vault item cards (subtitle line)
- [ ] Include variant data in auto-generated listing copy (Task 5)
- [ ] Include variant in insurance packet
- [ ] Add variant filter to vault search

---

### NEXT 4: Want List Improvements ⬜ NOT STARTED
**Why do this:** Existing wishlist model already in codebase. Add depth fields only — minimal new infrastructure. Feeds into the future trade/swap network and set completion tracker.

- [ ] Audit existing wishlist/want list model and UI
- [ ] Add fields to each want list item:
  - Target price (max willing to pay)
  - Condition preference (raw, PSA 8+, any, etc.)
  - Notes (e.g., "must be 1st edition", "prefer graded")
  - Priority (low/medium/high)
- [ ] "Add to Want List" button visible on:
  - Other users' public gallery items
  - Vault item detail (for duplicates collector wants more of)
  - Set completion view (missing pieces)
- [ ] Show "Wanted by X collectors" count on item details (social proof)
- [ ] Want List tab visible in vault nav

---

### NEXT 5: Portfolio-Level Net Proceeds ✅ SHIPPED `64a2c69`
**What shipped:** `PortfolioNetProceedsPanel` on Portfolio page — platform selector (eBay/Mercari/Whatnot/PWCC/Discogs), estimated fees, $5/item shipping estimate, net proceeds, net gain/loss, ROI %. Files: `src/components/PortfolioNetProceedsPanel.tsx`, `src/lib/portfolioMetrics.ts`, `src/app/portfolio/PortfolioClient.tsx`.

**Still on the roadmap (future):**
- [ ] Allow user to set a persistent "primary sell platform" preference
- [ ] Shareable: "My vault would net $X if sold today" card for social sharing
- [ ] Best estimated platform per category breakdown

---

## 🔨 PHASE 2 — BUILD NEXT
*High value, more complex, target post-launch v2*

---

### TASK 7: Weekly "Vault Report" Email
**Borrowed from:** CovrPrice (Shaker Report)
**Target:** Post-launch, once there's an active user base to send to

- [ ] Build automated weekly digest email triggered every Monday morning
- [ ] Personalized per user vault:
  - "Your top mover this week: [Item] is up 18%"
  - "Your vault gained $X in value this week"
  - "Market alert: [Category] is trending up this week"
  - "You have [X] items that haven't been valued in 30+ days — refresh?"
- [ ] Include a "Notable Deals" section: items similar to what they collect that are underpriced
- [ ] Use `BiggestMoversPanel.tsx` data as the source for personalized moves
- [ ] A/B test subject lines: "Your vault grew $X this week 🏆" vs. "Weekly vault report — [date]"
- [ ] Add unsubscribe preference to user settings

---

### TASK 8: Content / Stream Mode
**Borrowed from:** HobbyScan
**Target:** Post-launch, once creator community is being targeted

- [ ] Add "Content Mode" toggle in settings or scan screen
- [ ] Content Mode changes the UI:
  - Fullscreen, clean, minimal chrome
  - Large item display with title, grade, and value prominently shown
  - Optimized for screen recording aspect ratios (16:9 landscape and 9:16 portrait)
- [ ] "Haul Reveal" animation: newly scanned items slide in with value reveal
- [ ] "Running Total" overlay: live updating total collection value as items are added
- [ ] "Pack Opening Mode": designed for TCG pack reveals — shows each card dramatically
- [ ] Add "Share this scan session" to export a highlight reel of the haul (video or still grid)

---

### TASK 9: Variant / Edition Tracking (Deep Fields)
**Borrowed from:** CLZ Comics
**Target:** Post-launch, as part of the "Serious Collector" depth push

- [ ] Audit current item fields — confirm variant/edition is a first-class field
- [ ] Add category-specific variant fields:
  - **Comics:** Printing (1st, 2nd, 3rd), edition (newsstand, direct, cover price), variant cover (A, B, C), foil/embossed
  - **Cards:** Parallel type (base, holo, refractor, prizm), numbered edition (/10, /25, /100, 1/1), auto, relic/patch
  - **TCG:** Set, edition (1st, unlimited), language, foil type, grade/cert number
  - **Games:** Region (NTSC/PAL/JP), completeness (sealed, CIB, loose), label variant (black label, Greatest Hits)
  - **Vinyl:** Pressing info (1st press, reissue), label, matrix/runout, country of origin, color variant
- [ ] Make these fields filterable in vault search
- [ ] Include variant data in AI-generated listing copy
- [ ] Surface variant in gallery tile subtitle

---

### TASK 10: Visual Match — Recent Comparable Sales
**Borrowed from:** Gemli
**Target:** Post-launch, strengthens valuation trust

- [ ] After scanning, show a "Recent Sales" panel below the valuation:
  - Thumbnail images of sold listings
  - Sale price, condition, date, platform
  - Filtered to match the scanned item's category and condition
- [ ] Pull from: eBay Sold Listings API (primary), supplement with other sources
- [ ] Allow collector to filter by condition and format (raw vs. graded)
- [ ] "Use this sale as my value" option — collector can pin a specific comparable as their insurance reference
- [ ] In insurance packet: include top 3 comparable sales as supporting evidence

---

### TASK 11: Rarity Intelligence
**Borrowed from:** ToyzieAI
**Target:** Post-launch, v2 feature

- [ ] Build rarity scoring system per category:
  - Pull from PSA/BGS population reports for graded cards (total graded copies)
  - Pull from CGC census for graded comics
  - Use print run data + sales velocity for ungraded items
  - Use AI estimate for items with no population data
- [ ] Display rarity signal on item detail: "Rare — fewer than 250 known graded copies (PSA)"
- [ ] Add "Rarest in your vault" section to dashboard
- [ ] Surface rarity prominently in public gallery: "One of fewer than 100 known copies"
- [ ] Use rarity as an input to insurance valuation (rare = higher value justification)

---

### TASK 12: Offline Capture + Auto-Sync
**Borrowed from:** Valuable App
**Target:** Post-launch, significant technical lift but high value for convention users

- [ ] Build offline capture queue — items can be scanned and stored locally without internet
- [ ] Local storage: save photo + basic user-entered fields (title, category, notes)
- [ ] AI identification and valuation run when connection is restored (background sync)
- [ ] Show "Pending sync" badge on items awaiting processing
- [ ] Show sync status indicator in the top nav: "3 items syncing..."
- [ ] Full vault access (browse, edit) available offline — only AI processing requires connection
- [ ] Market this as "Convention Mode" — specifically for shows, flea markets, storage units

---

## 🔭 PHASE 3 — LONGER TERM
*Major features, significant infrastructure, plan now but build after traction*

---

### TASK 13: Multi-Platform Listing Export
**Borrowed from:** CrystalCommerce
**Target:** v3 or Pro tier

- [ ] One-click publish to multiple platforms simultaneously:
  - eBay (via API)
  - Mercari (via API or deep link)
  - Facebook Marketplace (via Share API)
  - Whatnot (for live selling)
- [ ] Track listing status per item (listed, sold, relisted)
- [ ] Auto-update vault when item sells (move to "Sold" section, record sale price)
- [ ] Calculate final net gain including platform fees on actual sale

---

### TASK 14: Trade / Swap Network
**Borrowed from:** CollX
**Target:** v3, requires critical mass of users

- [ ] "Available for Trade" toggle on vault items
- [ ] Public discovery page: browse what VLTD users have listed for trade
- [ ] Filter by category, condition, value range
- [ ] Trade offer system: propose a trade, other party accepts/counters/declines
- [ ] "Trade value" matching: suggest fair trades based on market value of offered items
- [ ] Build on top of existing public gallery infrastructure

---

### TASK 15: Beneficiary / Estate Access Mode
**Borrowed from:** Valuable App
**Target:** Pro tier feature

- [ ] Allow user to designate a "Vault Beneficiary" — a trusted contact
- [ ] Beneficiary gets a read-only access link stored securely
- [ ] Read-only view shows: all items, valuations, insurance documentation, total value
- [ ] Does NOT require beneficiary to create a VLTD account to access
- [ ] Vault owner can revoke access at any time
- [ ] Market in insurance documentation section: "Store your vault access with your estate attorney"

---

### TASK 16: Pre-Populated Product Catalog (2M+ Items)
**Borrowed from:** CrystalCommerce
**Target:** Ongoing data infrastructure investment

- [ ] Phase 1: TCG cards (partner with or scrape TCGPlayer/Scryfall/Pokémon TCG API)
- [ ] Phase 2: Sports cards (partner with or use Beckett/PSA database)
- [ ] Phase 3: Comics (CBDB, Grand Comics Database)
- [ ] Phase 4: Vinyl (Discogs API)
- [ ] Phase 5: Games (IGDB, PriceCharting)
- [ ] Build "Quick Add" search that auto-populates all fields from catalog
- [ ] Allow community corrections/additions to improve catalog over time

---

## Quick Reference: Feature → Marketing Connection

| Feature | Marketing Hook | Best Channel |
|---|---|---|
| AI Condition Grading | "AI grades your collection instantly" | TikTok demo, Reddit |
| Notable / Key Detection | "I found out I had a key issue" | Reddit, Twitter |
| Bulk / Haul Mode | "Scanned 200 cards in 10 minutes" | TikTok, YouTube |
| Profit Calculator | "Here's what my collection nets if I sell today" | Reddit, Twitter |
| Auto Listing Copy | "One tap — full eBay listing, done" | TikTok, Reddit |
| Multi-Source Pricing | "Insurance-grade valuation from 3 marketplaces" | Blog, Reddit |
| Weekly Vault Report | "My collection went up $340 this week" | Email, Twitter |
| Offline / Convention Mode | "I catalogued my entire haul at the show" | TikTok, YouTube |
| Rarity Intelligence | "One of fewer than 250 known copies" | Gallery, social |
| Trade Network | "Find trades inside your own community" | Reddit, Discord |

---

*Last updated: May 2026 · Review and reprioritize monthly based on user feedback*
