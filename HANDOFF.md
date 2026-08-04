# VLTD — Session Handoff (updated 2026-08-03, second overnight pass — EK asleep again)

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

### A. Quick Add scanner — needs device re-test after real bugs got fixed
EK tested live and found a real bug: the scanner's Universe dropdown hardcoded a
default of "TCG", so unless manually changed, everything got tagged/AI-hinted as
TCG — comics scanned as "Magic: The Gathering" etc. Fixed 2026-08-03 (see §4).
Still want confirmation the fix actually holds up on a real batch of mixed items.

### B. Barcode / QR not detected on graded slabs — FIX ATTEMPTED, needs device test
Slab QR/Code128 wasn't read on capture. `buildRegions()` in
`src/lib/scanners/barcodeScanner.ts` only scanned bottom-biased crops (tuned for
retail UPCs) plus two low-scale full-frame passes — never enough effective
resolution on a small code near the TOP of a graded holder (where PSA/CGC/BGS/SGC
put their cert QR/Code128). Added mirrored top-of-frame regions at the same scale
factors. Purely additive, can't regress what already worked, but **not yet
confirmed against a real slab + camera** — please test and report back.

### C. DOCUMENTS (capture builder §5 accordion) — make it real
Still a placeholder (`src/app/capture/page.tsx` ~line 1099). EK wants an
**Upload file / Take photo** control, and those document images **private &
locked — never shared** (separate from the item's public photos). Files staged
until Save, persisted with a private flag.

**Investigated 2026-08-03, deliberately not started:** the `images_json` column
(`vaultCloud.ts`) is JSONB, so a new `role: "document"` value on `VaultImage`
needs no migration on its own. BUT the `vault-images` Supabase Storage bucket
is **public** (`vaultCloud.ts` calls `.getPublicUrl()`, never `createSignedUrl`)
— anything uploaded there gets a URL anyone can fetch if they get the link,
regardless of what the UI hides. Uploading a document (receipt, ID, insurance
paperwork) into that same bucket would NOT actually be private — just
UI-hidden, which doesn't match "private & locked." Two real options: (a) a
separate private bucket + signed URLs (real infra change — bucket policy, likely
needs your Supabase dashboard access), or (b) local-only (IndexedDB, never
uploaded, same `localOnly` pattern already used for offline photos) — genuinely
private since it never leaves the device, no migration needed, but not synced
across your devices yet. Didn't pick one for you since it's a privacy-sensitive
call, not just a UI build.

### D. Crop: skippable now, everything else already fine
- DONE (a67af29): crop-stays-small.
- DONE (cc4f29e): multi-photo per item.
- CORRECTED 2026-08-03: auto-crop-to-frame-guide was already wired on every
  capture (`computeGuideCrop()` in `CameraCapturePanel.tsx`), not just after
  background removal — the old note here was stale from the start (predates
  this handoff).
- DONE 2026-08-03: added a **"Use as-is"** button next to Retake/Save so a crop
  step can be skipped in one tap (only shown when the crop isn't already
  full-frame).

### E. Small polish — mostly already done, one item needs your eyes
- CORRECTED 2026-08-03: the "MEDIUM CONFIDENCE" badge was already gated behind
  `identified` (only shows after an actual AI result) — this note was stale.
- The "Syncing…" chip (`src/components/VaultSyncStatusChip.tsx`) — still open,
  **left alone on purpose**: "tidy its header styling" has no specific target,
  and guessing at a redesign risked fighting your actual taste. Point at what
  looks rough and it's a quick fix.

### F. Bigger / later (needs your device or your decision — not started)
- **Background-removal freeze** — `@imgly/background-removal` runs ONNX on the
  main thread (`src/components/capture/captureUtils.ts`). Needs EK's device
  eyeball before picking a fix (lighter model vs. worker offload).
- Events: category is still keyword-guessed (no real DB column), saved events
  are still localStorage-only (not synced) — both need a Supabase migration
  only you can run.
- Two more possible improvements EK raised, not started: (a) AI comic-book ID
  accuracy — added visual-cue guidance to the vision prompt 2026-08-03 (§4),
  needs a real test against the same comics that triggered the original bug;
  (b) a Subcategory-level pre-set pill next to Category on the scanner screen —
  EK asked for "another box" after picking Category; only added the Category
  pill so far (§4), didn't add a 3rd Subcategory pill since it wasn't clear
  that's literally what was meant vs. just wanting the Category pill. Ask
  before building a 3rd cascading pill.

---

## 3. Options / decisions waiting on EK
- **Documents (§2C)** — local-only vs. a real private Supabase bucket.
- **ai/review + ai/drafts cyan color** — NOT a decision anymore: confirmed
  2026-08-03 this is the app's actual primary-CTA standard
  (`.vltd-action-module__block`, 25 files), not an off-brand mistake. No change made.
- **/admin/\* visual skin** — confirmed 2026-08-03 it's a deliberately separate
  internal-tool look (own dark bg, amber accents, emoji icons), not drift. Left
  alone. Say so if you actually want it reskinned to match the main app — bigger
  job, not started.
- Everything else in §2 is a go; just needs building/verifying/a migration.

---

## 4. Done recently (don't redo)
- **Second overnight/late-night pass (2026-08-03), after EK woke up and tested live:**
  - **Rename `/wishlist` → `/watchlist`** (EK's decision) — moved the route,
    fixed the two `href="/wishlist"` links, added a permanent redirect from the
    old path, updated `AddToWishlistButton`'s visible copy. Left the underlying
    `wishlistModel.ts`/`watchlistModel.ts`/`comicWishlistModel.ts` library files
    alone — three genuinely different data sources the Watchlist page merges
    into one list, not a naming collision.
  - **Real bug found + fixed: Quick Add locked items into the wrong Universe.**
    `ScanCapturePanel.tsx`'s Universe dropdown hardcoded a default of "TCG" —
    EK scanned 3 comics, they came back as "Magic: The Gathering..." at low
    confidence, and there was no way to fix the Universe in Verify (only an
    auto-flag that fires when the AI disagrees with itself, which didn't fire
    since the AI was hinted "the collector says this is TCG" and just complied).
    Three fixes: (1) Universe dropdown now remembers your last pick
    (`localStorage`, `SCAN_UNIVERSE_PREF_KEY`) instead of resetting to TCG,
    (2) added a real Universe dropdown to `ScanVerifySheet` so you can always
    fix it manually, (3) softened the AI hint wording to explicitly favor what
    it sees over the stated Universe.
  - **Review sheet (`ScanReviewSheet.tsx`) can now edit Universe/Category
    per item AND has a "Skip AI" checkbox** (opposite the thumbnail) — skipping
    doesn't spend a scan, item stays blank for manual entry. Both wired through
    a new `onPatch` prop that updates the source `capturedItems` state directly.
  - **Added a Category pill next to Universe** on the scanner screen
    (`categoryLabel` state already existed, just had no control) — EK wanted
    the whole batch pre-settable, not just Universe. See §2F for the
    Subcategory-pill follow-up question.
  - **Verify sheet: split Value into Cost ($) + Value ($)** — `purchasePrice`
    was silently dropped before; now threaded through the draft → saved item.
  - **Item Notes: pencil-icon direct edit + Clear button** next to
    Regenerate (`vault/item/[id]/page.tsx`) — `Section` component now takes an
    optional `action` slot for this. Regenerate itself (`generateItemCopy.ts`)
    was already deterministic/field-based, not random — just needed more
    fields filled in for a better result, not a code fix.
  - **Vision prompt: added comic-vs-card visual cues**
    (`api/ai/analyze-item/route.ts`) — cover size, publisher logos, staples —
    and told the model to give an honest vague title instead of a confident
    wrong one when text isn't legible. Prompt-only, needs a real test.
  - **Capture-screen "Auto ID" is now metered** the same as Quick Add
    (1 scan/image, `consumeBulkScans`) — EK's call: "any AI scan should be
    limited" on the free tier. Barcode/UPC lookup stays free (local decode).
  - **Pill sweep, actually finished this time.** ~55 files total across two
    passes: every genuine `rounded-full` straggler (a real action button in the
    wrong shape) app-wide. Confirmed NOT violations and left alone: `/admin/*`
    (separate internal-tool skin), toggles/chips/badges/avatars/icon-only
    buttons, and anything using `vltd-pill-main-glow`/`vltd-primary-button`/
    `.vltd-action-module__block` (verified some of these against their actual
    CSS, not just the class name, before ruling them out).
  - **PillButton-everywhere, actually migrated** (not just shape-matched).
    Extended `src/components/ui/PillButton.tsx` with `href` (renders as
    `next/link`), a `danger` variant, and a `style` passthrough for bespoke
    colors — then migrated every standard-sized (h-10/11/12, text-sm) action
    button/nav-pill onto the literal component across ~20 files. Deliberately
    NOT migrated: glossy gradient primary CTAs (their own established tier),
    the compact toolbar/mass-select-bar tier (~38px, smaller text — forcing
    PillButton's fixed 44/40px in would risk row overflow), and per-item
    micro-chips in dense rows (Review/Verify sheet rows, card action rows).
    These three tiers are already correctly shaped, just not literally
    PillButton, which was never sized for them.
  - Investigated and ruled out two more suspected fake-data bugs: the insurance
    report pages' `DEMO_ITEMS` (via `loadItemsOrSeed()`) only shows demo data to
    logged-out marketing visitors, never a signed-in user's real (possibly
    empty) vault — correctly guarded, not a bug. Same for the "+X% (30D)" stat
    on `/more` — real computed value-history data, not hardcoded.
- **Overnight pass (2026-08-03), while EK slept:**
  - **Field locks on the capture builder** (was §2A) — ported the `/vault/add`
    lock UX onto capture's Identity/Category fields, own storage module
    `src/lib/captureAddState.ts` (kept separate from `bulkAddState.ts` since the
    two screens' "number" field means different things — reusing one map would
    cross-contaminate). Verified end-to-end (lock → reload → value carries over).
  - **Removed dead Quick-Add-toggle code path** in `capture/page.tsx`
    (`handleQuickAddCapture`/`quickAddCountRef`/singular `persistCapturedImage`)
    — unreachable since both `CameraCapturePanel` calls already pass
    `bulkToggle={false}`.
  - **Removed fake AI-draft demo seeding** (`aiCatalogDrafts.ts` seeded
    Jordan/Charizard/Spider-Man drafts for signed-in users) — no-fake-data rule.
    Also deleted `src/_delete-after-testing/seedDemoIfEmpty.ts` +
    `src/lib/demoSeed.ts` (same pattern, already-dead code).
  - **Barcode scan: added top-of-frame regions** for graded-slab QR/Code128 —
    see §2B, needs your device test.
  - **Capture: capped long-edge resolution to 2200px** on high-res camera
    streams (`CameraCapturePanel.tsx`) — keeps filter/crop/upload fast on
    phones that stream past 3000px.
  - **Crop: added "Use as-is"** to skip cropping in one tap.
  - Fixed `SellItemModal.tsx` (solid black box in light mode — theme vars now).
  - Re-verified `REWORK_PUNCHLIST.md` + `EVENTS_PUNCHLIST.md` against current
    code: Events' dead controls + fake stats/fallback events were already fixed
    same-day back on 2026-07-17 (docs just never got updated). Still-open items
    from those two docs folded into §2F above.
  - Corrected two stale "still open" claims in this handoff that were already
    fixed in code (auto-crop-to-guide, MEDIUM CONFIDENCE badge) and one wrong
    claim in `THEME_SWEEP.md` (the cyan CTA color is correct, not off-brand).
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
- Field-lock system: `src/lib/bulkAddState.ts` (`/vault/add`) · `src/lib/captureAddState.ts` (`/capture`, its own module — see §4)
- Barcode: `src/lib/scanners/barcodeScanner.ts` · Crop: `src/lib/scanners/cropImageFile.ts`
- Cloud save (column map): `src/lib/vaultCloud.ts` · Vault model: `src/lib/vaultModel.ts`
- AI vision: `src/lib/ai/openaiVision.ts` · Scan quota: `src/lib/bulkScanQuota.ts`
- Theme vars + `--bottomnav-h`: `src/app/globals.css`
- Approved mockups: `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`

---

## 6. First moves for the new chat
1. Read this + `MEMORY.md`. Confirm with EK **who owns `/capture` right now**
   (this chat vs the parallel Codex edits) before editing capture files.
2. Ask EK what they found testing overnight: did the Universe-lock fix (§2A),
   barcode top-region fix (§2B), and comic-ID prompt fix (§2F) actually hold up
   on real devices/items? None of those three could be verified without a
   device/real API call.
3. Then §2C documents (needs EK's local-only-vs-private-bucket call), or
   whichever §3 decision EK wants to make first.
4. Verify each **visually** on `vltd.vercel.app` (screenshot; resize for mobile).
   `tsc`/`eslint`/`build` before every push. Deploys are slow — preview CSS-only
   tweaks via live JS injection to iterate faster.
