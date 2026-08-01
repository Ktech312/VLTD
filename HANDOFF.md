# VLTD — Session Handoff (updated 2026-07-30)

Read this top to bottom, then start on **§2 "What's LEFT."** This is written so a
brand-new chat can pick up with no prior context.

---

## 0. RULES — follow exactly (this is the source of truth)

Rules also live in the auto-memory index `MEMORY.md` (loaded each session) and the
`memory/*.md` files it points to. If this handoff and a memory ever disagree,
ask EK.

**Who you're working with:** EK, the founder. **Non-programmer.** Explain in plain
language, never jargon. Give a recommendation, not an option-dump. If something
is risky or can't be done, say so plainly.

**Hard product rules:**
- **No fake data.** Numbers/descriptions/counts/images come from real sources.
  No invented data, no stock-art stand-ins, no fake "autosaved" claims.
- **No emoji / generic icons in the UI.** Use the themed `Glyph` component
  (`src/components/ui/Glyph.tsx`) or inline stroke SVGs. NOT violations: the `✦`
  brand star, `✓`/`✕` affordances, and the user-chosen avatar-emoji feature.
- **Background locked to the site standard.** No per-page full backgrounds. Use
  the theme vars (`--bg`, `--surface`, `--border`, `--fg`, `--pill`, `--muted`).
- **"Curator" = the individual user; "collectors" = the community/market.**
- **Internal ID system is permanent** — `260312-0001-000142` (`YYMMDD-account-item`).
- **⚠ ASK BEFORE REMOVING A FEATURE.** EK was (rightly) upset when a pass removed
  the Universe selector to "simplify" without asking. Rearrange/restyle freely;
  **confirm before deleting functionality.**
- When EK gives pixel notes, **don't change pill/frame/button sizes** unless asked.
- **NEVER stretch pills / dropdowns / small buttons to fill width** (no `w-full`/
  `flex-1` when the label is short). Size them to their content (`w-auto`). EK has
  flagged this 20+ times — a "Vivid" dropdown should be ~as wide as the word, not a
  full-row box. Full-width is only for a genuine primary CTA. See [[no-full-width-pills]].

**Deploy / infra:**
- **Vercel auto-deploys on push to `main`.** Never tell EK to redeploy.
  **Deploys are SLOW right now (3–5 min, queue up).** Don't call something "live"
  until you re-checked the deployed page.
- **Supabase migrations run MANUALLY by EK** (no CI). Write idempotent `.sql`,
  ask EK to run it. **Never add a new column to the cloud row map
  (`src/lib/vaultCloud.ts`) without the migration** — unknown columns make the
  `vault_items` upsert throw.
- Live site: `https://vltd.vercel.app`. `vltd.app` intentionally not set up yet.
- **AI vision is LIVE.** `ANTHROPIC_API_KEY` has been set in Vercel for months;
  `/api/ai/analyze-item` (AI Assist, bulk scan, Quick Add scan) all use it. Don't
  tell EK to set it or hedge that it "might not be configured."
- Windows + Git Bash. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Verifying (hard-won — do this):**
- EK does NOT run localhost. Verify on the LIVE site via **Claude in Chrome**
  (`mcp__claude-in-chrome__*`, load via ToolSearch).
- **Screenshots work** (`computer {action:"screenshot"}`). **Verify VISUALLY, not
  just that DOM elements exist** — "elements present" ≠ "looks right." That gap
  cost trust earlier.
- **Mobile:** resize the browser (`resize_window` ~414×896) to see the phone
  layout EK annotates — but the true test (rear camera, etc.) is EK's own phone.
- Iterate fast without waiting on deploys: apply CSS-only tweaks live via
  `javascript_tool` and screenshot to preview a layout fix before committing.
- Always `npx tsc --noEmit` + `npx eslint <files>` + `npm run build` before push.

**⚠ PARALLEL EDITING.** Another tool (Codex) edits some files outside the chat.
Confirmed edited by it: `src/app/community-board/page.tsx` (rewritten into a "VLT
LOUNGE clubhouse" — leave it alone). **Re-read any file before editing it, and
confirm with EK who owns a screen.** EK is aware of this.
- **`/capture` (normal Add) is THIS chat's now** — EK confirmed 2026-07-31 that
  Codex isn't on it; this chat added multi-photo + crop-zoom there. Still re-read
  before editing in case that changes.

---

## 1. Where things stand (screens)

- **Add / Capture (`src/app/capture/page.tsx`)** — currently **camera-first**
  ("New Vault Item" with an inline live camera, Quick Add, builder form below).
  This chat's earlier "builder-first" version was overwritten by the parallel
  editor — **re-read the file before editing.** Approved mockups live at
  `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
  (`vltd-concept-19-capture-desktop.png` = the builder/review layout).
- **Quick Add scanner (`src/components/ScanCapturePanel.tsx`)** — REBUILT to EK's
  spec (see §4). Opens from the capture screen's Quick Add. Manual fast camera.
  **Finish → metered AI fill → verify sheet → Save** (see §4, the locked flow).
- **Review sheet (`src/components/ScanReviewSheet.tsx`)** — top-anchored, ~5
  scrollable items, controlled removals; **removed items sink to the bottom**
  (Undo kept); tap a thumbnail to enlarge.
- **Verify sheet (`src/components/ScanVerifySheet.tsx`)** — the AI-fill review
  grid the scanner lands on after Finish (name/category/subcategory/value per
  item, per-item Rescan, confidence chip, scan ticker).
- **Bulk upload (`src/app/vault/bulk/page.tsx`)** — DONE (device + camera → one
  Universe → optional AI, metered → review grid → Add all).
- **Admin → Scan Limits (`src/app/admin/scan-limits/page.tsx`)** — DONE (per-tier
  + per-user AI-scan limits). Migration `supabase/migrations/20260723_bulk_scan_quota.sql`
  (EK ran it). Lib: `src/lib/bulkScanQuota.ts`.
- **VLT Lounge (`src/app/community-board/page.tsx`)** — clubhouse redesign by the
  parallel editor; not this chat's.

---

## 2. What's LEFT to do (prioritized)

### A. Field "locks" on the capture builder ← NEXT (EK's #5, not started)
Let a user **lock a field's value so it carries to the next item** (entering many
items that share info). EK marked these fields: Item Name, Alternate Name,
Set/Series, Certification Company, Category, etc. **The lock system already
exists** — `src/lib/bulkAddState.ts` + the `/vault/add` manual screen use it
(look for `toggleBulkAddLock` / `BulkAddLocks`). Port that pattern onto the
capture builder's Identity/Category fields (a small lock toggle per field).

### B. Quick Add scanner — final device verification + any tweaks
Rebuilt to spec and iterated (§4). EK is testing on their phone. Likely-remaining
polish surfaces as EK tests: 5-item review height, flash timing, corner boldness,
spacing. Verify removal-persistence + camera-returns-after-review on a real device.

### C. Barcode / QR not detected (BUG)
Slab QR/Code128 still not read on capture. Investigate
`src/lib/scanners/barcodeScanner.ts` (`scanBarcodeFromVideoFrame`,
`scanBarcodeFromFile`) and how the capture flow calls it.

### D. DOCUMENTS (capture builder §5 accordion) — make it real
Currently a placeholder. EK wants an **Upload file / Take photo** control, and
those document images **private & locked — never shared** (separate from the
item's public photos). Files staged until Save, persisted with a private flag.

### E. Crop bugs
- DONE (a67af29): crop-stays-small — the shared `ScanCropEditor` now opens
  **zoomed into the selection (phone-style)** so the item fills the view;
  full-photo crop still lands at zoom 1. Verify on-device across frames.
- DONE (cc4f29e): normal Add "new photo overwrote the old one" — `/capture` now
  supports **multi-photo per item** (cover + angles); AI reads only the cover.
- STILL OPEN: auto-crop only works AFTER background removal (`computeSubjectCrop`
  reads alpha in `src/lib/scanners/cropImageFile.ts`); on a normal photo it keeps
  the whole frame. The camera's detected object box is NOT wired to crop. Fix:
  use the detected card box to auto-crop on capture.

### F. Single-item AI metering — DECIDED (Quick Add) / capture screen still open
**Quick Add scanner AI is now metered at 1 scan per image** (`consume_bulk_scan`),
same quota as bulk. Manual/typed **Add stays free** (slower by design). Still open:
the capture-screen "Auto ID" single button — apply the same metering there too.

### G. Small polish
- Capture Identity header shows "MEDIUM CONFIDENCE" on a blank form — hide the
  badge until there's an actual AI result.
- The "Syncing…" chip EK circled = `src/components/VaultSyncStatusChip.tsx` (vault
  cloud-backup status). Legit; tidy its header styling if EK wants.

### H. Bigger / later
- **Background-removal freeze** — `@imgly/background-removal` runs ONNX on the
  main thread (`src/components/capture/captureUtils.ts`). Options: simplest is
  `removeBackground(file, { model: 'isnet_quint8' })`. Needs EK's device eyeball.
- **Watchlist vs Wishlist naming** — EK to pick before renaming (route `/wishlist`
  vs `watchlistModel`).

---

## 3. Options / decisions waiting on EK
- **Capture-screen "Auto ID" metering** (2F): apply the same 1-scan/image metering
  to the capture screen's single Auto ID button (Quick Add is already decided/done).
- **Watchlist vs Wishlist** name (2H).
- Everything else in §2 is a go; just needs building/verifying.

---

## 4. Done recently (don't redo)
- **Capture panel tighten** (`CameraCapturePanel.tsx`): remembers last-used camera
  (localStorage); description → info "i"; removed "Retry"; "File" → "Upload";
  Upload/Quick Add/camera-picker moved into one compact top row with squared pills.
- **Perf:** turned OFF the live object-detection ML (TF.js + coco-ssd) that ran
  every ~900ms in `CameraCapturePanel.tsx` (flag `ENABLE_OBJECT_DETECTION=false`).
  The fixed frame guide + barcode scan are unaffected.
- **Quick Add scanner rebuilt to EK's spec** (`ScanCapturePanel.tsx`, full rewrite):
  manual-only shutter (removed auto-lock + Front/Back/Next + Quick/Bulk); **3
  squared dropdown pills — Universe / Frame / Camera** (titles stay constant,
  pick highlights in the menu); **Done → Finished** (brushed look); removed the
  upload icon; **rear-camera default + Camera picker** (fixes stuck-on-front);
  **top-left ghost counter**; **last-shot thumbnail on the LEFT, tap it = Review**;
  **light-blue frame corners** (bold, dark outline so they don't wash out on
  holo cards) that brighten on capture; **soft ghost-green capture flash**;
  panel sits **above the bottom nav** (`100dvh − var(--bottomnav-h)`);
  **app-theme background** (`--bg/--surface/--border/--fg`).
- **Review sheet** (`ScanReviewSheet.tsx`): top-anchored above the nav; ~5 items
  then scrolls; **removals persist** (state lifted to the scanner; sheet is now
  controlled via `removed/onRemove/onUndo`); camera stays live behind it (review
  is an overlay) so closing it (X) returns to the camera to keep adding.
  **Removed items now sink to the bottom** (Undo kept, stable "Item N" number);
  **tap a thumbnail to enlarge** (front + back).
- **Quick Add AI-fill + verify flow (LOCKED)** — `ScanCapturePanel` + `ScanVerifySheet`.
  Flow: capture many → review/remove → **"Add N to Vault"** (this is the commit
  point — AI ONLY runs here, not during capture) → **AI identifies each kept photo
  (metered: 1 scan/image, per-plan quota via `getBulkScanStatus`/`consumeBulkScans`)**
  → progress overlay → **verify sheet** (compact rows: name/category/subcategory/
  value, per-item Rescan, confidence chip, ticker, tap-thumb to enlarge) →
  **"Save N to Vault"** commits (IndexedDb + sync queue) and **routes to `/vault`**.
  **No camera after saving; the group is LOCKED once you hit Add** — to add more you
  start a new group (no append-after-commit, by EK's decision).
  - Category mapping: curator's chosen Universe wins; AI category matched within it,
    and the game/type the AI calls a "category" is matched into the **Subcategory**
    (e.g. TCG has one category "TCG / CCG"; Pokemon/Magic/etc. are subcategories) —
    `visionToDraftPatch` never wipes a valid category to blank. If AI clearly detects
    a *different* Universe it shows an amber **flag** ("AI thinks this is X — tap to
    switch"), it doesn't silently discard it.
  - Full AI result rides on the draft (`vision`) and is saved onto the item
    (subtitle/number/year/grade/condition/certNumber, `notes`=AI description) so the
    item page is populated like a normal single scan.
  - Camera-page counters (ghost badge, `Finished (N)`, thumb) read the **kept** count.
  - Hardening (32b479b): 60s timeout per AI call (stall → manual entry), items saved
    with `status:"COLLECTION"`, `parseValue()` strips $/commas, verify sheet won't
    close on a backdrop tap (drafts cost scans). NOTE: `vaultCloud` is an allow-list —
    AI `year`/`condition`/`conditionReason` are NOT columns, so they stay local-only
    (grade/subtitle/number/cert/notes/category/value/status DO sync). No upsert throw.
  - **Legacy manual Quick Add form DELETED.** `src/app/vault/quick/QuickAddClient.tsx`
    is now a ~25-line launcher that just mounts the scanner and routes to `/vault`
    on close (cancel or after save). The old "Image first. Save fast." hand-entry
    form / Recent Saves / crop editor / AI-Assist that used to live there is gone —
    it was orphaned once the scanner replaced it. File uploads live in Bulk (`/vault/bulk`).
- Bulk upload + scan quota (migration + admin + lib + `/vault/bulk`) — verified live.
- Emoji→glyph on user-facing pages (Discover/Goals/AutoShare/Patreon).

---

## 5. Key files
- Capture screen: `src/app/capture/page.tsx`
- Inline camera panel: `src/components/CameraCapturePanel.tsx`
- Quick Add fast scanner: `src/components/ScanCapturePanel.tsx`
- Scan review sheet: `src/components/ScanReviewSheet.tsx`
- Field-lock system to port: `src/lib/bulkAddState.ts` (used by `src/app/vault/add/page.tsx`)
- Barcode: `src/lib/scanners/barcodeScanner.ts` · Crop: `src/lib/scanners/cropImageFile.ts`
- Cloud save (column map): `src/lib/vaultCloud.ts` · Vault model: `src/lib/vaultModel.ts`
- AI vision: `src/lib/ai/openaiVision.ts` · Scan quota: `src/lib/bulkScanQuota.ts`
- Theme vars + `--bottomnav-h`: `src/app/globals.css`
- Approved mockups: `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`

---

## 6. First moves for the new chat
1. Read this + `MEMORY.md`. Confirm with EK **who owns `/capture` right now**
   (this chat vs the parallel Codex edits) before editing capture files.
2. Start on **§2A — field locks** (port `bulkAddState` locks onto the capture
   builder fields). Then §2C barcode, §2D documents, §2E crop.
3. Verify each **visually** on `vltd.vercel.app` (screenshot; resize for mobile).
   `tsc`/`eslint`/`build` before every push. Deploys are slow — preview CSS-only
   tweaks via live JS injection to iterate faster.
