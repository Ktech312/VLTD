# VLTD — Session Handoff (updated 2026-07-25)

Read this top to bottom, then start on **§2 "What's left."** Prior handoff
history is in git.

---

## 0. How to work here (rules — follow exactly)

**Who you're working with:** EK, the founder. **Non-programmer** — explain in
plain language, never jargon ("state", "props", etc.). Give recommendations,
not option dumps. When something can't be done or is risky, say so plainly.

**Hard product rules (also in auto-memory `MEMORY.md`):**
- **No fake data.** Numbers, descriptions, counts, images come from real
  sources. No invented formulas presented as data, no keyword-guessed stock art
  for real items, no fake "autosaved" claims. (Whole sessions were spent
  ripping fake data out.)
- **No emoji / generic icons in the UI.** Use the themed line-art `Glyph`
  component (`src/components/ui/Glyph.tsx`) or inline stroke SVGs matching the
  nav style. Exceptions that are NOT violations: the `✦` four-point brand star,
  `✓`/`✕` UI affordances, and the user-chosen **avatar-emoji feature**.
- **Background is locked to the site standard.** Never add a per-page
  full-page background/overlay. Card/panel backgrounds are fine.
- **"Curator" = the individual user; "collectors" = the community/market.**
- **Internal ID system is permanent** — `260312-0001-000142`
  (`YYMMDD-account-item`). Don't change the format.
- **When rearranging a screen EK gave pixel notes on: do NOT change pill/frame
  shapes or sizes** unless asked — rearrange and tighten only.

**Deploy / infra:**
- **Vercel auto-deploys on push to `main`.** Never tell EK to redeploy.
  **Deploys are SLOW this period — 3–5 min, and queue behind each other.** Be
  patient; don't declare "live" until you've re-checked the deployed page.
- **Supabase migrations run MANUALLY by EK** (no CI). Write the idempotent
  `.sql`, ask EK to run it, wait for "ran clean." New table columns that don't
  exist yet will make `vault_items` upserts throw — never add a column to the
  cloud row map (`src/lib/vaultCloud.ts`) without the migration.
- Live site: `https://vltd.vercel.app` (EK's test site). `vltd.app` intentionally
  not set up yet.
- Windows + Git Bash.

**Verifying (do this — hard-won):**
- EK does NOT run localhost. Verify on the LIVE site via **Claude in Chrome**
  (`mcp__claude-in-chrome__*`, load via ToolSearch).
- **SCREENSHOTS WORK** via `mcp__claude-in-chrome__computer` `{action:"screenshot"}`
  (optionally `save_to_disk:true`). They were timing out earlier in the session,
  then started working — always try. **Verify VISUALLY, not just by checking DOM
  elements exist.** "The elements are present" ≠ "it looks like the mockup." EK
  lost trust because structure-checks were reported as visual confirmation.
- **Iterate fast without waiting for deploys:** apply CSS-only changes live via
  `javascript_tool` (set styles / gridTemplateColumns on the real page) and
  screenshot to preview a layout fix before committing.
- To reach the capture **review/builder with data** for a screenshot without a
  real card: on `/capture`, build a canvas image in-page, wrap in a File, set it
  on the hidden `input[type=file]` via DataTransfer, dispatch `change` → the AI
  runs and fills the builder. Nothing saves until "Save to Vault."
- Always `npx tsc --noEmit` + `npx eslint <files>` + `npm run build` before push.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**⚠ PARALLEL EDITING — important.** Another tool (Codex) is editing some files
outside this chat. Confirmed: **`src/app/community-board/page.tsx`** was rewritten
into a "VLT LOUNGE clubhouse" (mock data, 3-column) — NOT this chat's work; leave
it alone unless EK says otherwise. The **capture panel** also shows text/buttons
this chat didn't write (an inline camera + "Quick Add"). **Re-read any file
before editing it, and confirm with EK who owns a screen, so the two agents don't
clobber each other.** The FULL tier color was also changed to silver `#C8CDD2`
(seen in `admin/scan-limits`).

---

## 1. Where things stand (screens)

- **Add / Capture (`/capture`)** — this chat made it **builder-first**: opens as
  the form + an image panel ("Add a photo — optional / Take photo / Upload"),
  photo optional, camera on demand (modal), AI runs on capture with an in-panel
  spinner. Layout matches the approved mockup `concept-19` (serif "New Vault
  Item", full-width, Auto ID / Scan Barcode / Import / Clear, image viewer,
  Identity card, gold Save bar). **BUT a parallel edit has changed this screen**
  (EK's latest screenshots show an inline camera + "Quick Add" + different copy).
  **Re-read `src/app/capture/page.tsx` before touching it.** Mockups live at
  `C:\Users\EK\.codex\generated_images\019e6d3a-5dd3-7ed1-be13-942347ebb5c9\`
  (`vltd-concept-19-capture-desktop.png`, etc.).
- **Bulk upload (`/vault/bulk`)** — DONE: pick photos OR camera → one Universe →
  optional AI (metered, live ticker) → review grid (per-card Scan/Rescan) → Add
  all. Drag-drop supported. `src/lib/bulkScanQuota.ts` + migration
  `supabase/migrations/20260723_bulk_scan_quota.sql` (EK ran it).
- **Admin → Scan Limits (`/admin/scan-limits`)** — DONE: per-tier limits +
  per-user overrides. In the admin hub (`/admin/characters`).
- **VLT Lounge (`/community-board`)** — rewritten by the parallel editor into a
  clubhouse. Not this chat's.

---

## 2. What's LEFT to do (prioritized)

### A. Capture panel — tighten & rearrange (EK's Image 2/3 notes, 2026-07-25)
Mobile capture is too bulky. **Rearrange only — do NOT change pill/frame shapes
or sizes.** Re-read the current file first (parallel-edited).
1. The descriptive line ("Point at the item and snap — or switch to Quick Add
   to capture many and sort later") → collapse into an **info "i" icon next to
   "Add Item"** (frees top space). (There's an `Info()` pattern in
   `community-board/page.tsx` for reference styling.)
2. **Camera selector** (the "Webcam (…)" dropdown): shrink to as small as
   possible, move to the **top**, and **persist the last-used camera**
   (localStorage) so it doesn't reset every photo. Switching cameras each shot
   is the pain point.
3. **Delete "Retry"** from that row — there's no photo yet to retry.
4. **Move "Quick Add"** to the **top, centered, just under "Add Item."**
5. **"File"** button: we don't use the word "File" elsewhere — switch to
   **"Upload"** or the file icon; move it **top-left, just under "Add Item."**
6. Once the top is cleared, **move the "Add photo(s)/video" tile next to the
   camera (shutter) button** (see Image 3).

### B. Barcode / QR not detected (BUG)
Slab QR/Code128 barcodes still aren't being read on capture. Investigate
`src/lib/scanners/barcodeScanner.ts` (`scanBarcodeFromVideoFrame`,
`scanBarcodeFromFile`) and how `/capture` calls them. Test with the Pokémon slab
in EK's screenshots (has a QR + a Code128).

### C. DOCUMENTS (Identity accordion §5) — make it real
Currently a placeholder ("after saving, open the item…"). EK wants it functional:
an **Upload file** and **Take photo** control, and those document images default
to **private & locked — never shared** (separate from the item's public photos).
Needs the files staged until Save, then persisted with a private flag.

### D. Crop bugs
- **Auto-crop only works after background removal** — `computeSubjectCrop`
  (`src/lib/scanners/cropImageFile.ts`) reads the alpha channel, so on a normal
  photo it keeps the whole frame. The camera DOES detect the card (coco-ssd
  `detectionBox` in `CameraCapturePanel.tsx`) but that box is only a visual
  guide — it's **not wired to crop.** Fix: use the detected card box to
  auto-crop on capture.
- **Manual crop "didn't stick"** — reproduce the exact camera → crop → save path
  and confirm where the crop is dropped before claiming a fix.

### E. Single-item AI metering — DECISION NEEDED
Single-item "Auto ID" on `/capture` is **currently UNMETERED** (unlimited); only
the bulk flow counts scans. EK asked "what happens when they run out of credits?"
— today, nothing. **Decision:** meter single captures against the same monthly
quota (`consume_bulk_scan`), grey out Auto ID when out (manual entry stays free)?
Waiting on EK yes/no.

### F. Small polish
- Identity header shows "MEDIUM CONFIDENCE" on a blank form (from the default
  `confidence 0.45`). Hide the badge until there's an actual AI result.

---

## 3. Options / decisions pending from EK
- **Single-capture metering** (2E): yes / no.
- **"File" label** (2A.5): "Upload" text vs file icon — EK leaning either.
- Everything else in §2 is a go; just needs building.

---

## 4. Locked designs / specs (don't re-litigate)
- **Bulk upload + scan quota** — built; monthly per tier, resets on each user's
  signup-anniversary day; per-tier AND per-user overrides. See
  `bulk-upload-scan-quota` memory.
- **Capture screen target** = mockup `concept-19` (builder layout), plus EK's
  builder-first + tightening notes above.
- Cert Company + Set/Series on capture currently map onto existing fields (cert
  company folds into `grade` as "PSA 9"; Set/Series → `number`) to avoid a
  migration. If EK wants them as separate saved fields, that's a small migration.

---

## 5. Done this session (don't redo)
- Bulk scan quota: migration + `/admin/scan-limits` + `bulkScanQuota.ts`
  (per-tier + per-user; verified live).
- Bulk upload `/vault/bulk`: Path B (upload) + Path A (camera) + review grid +
  per-card Scan/Rescan + live ticker + drag-drop. Verified live (render + quota);
  NOT exercised through a real commit (would add test items) — EK to try on phone.
- Emoji → themed glyphs on user-facing pages: Discover swipe, Goals "Complete"
  badge, auto-share prompt, Patreon. (Lounge was later rewritten by the parallel
  editor.)
- Capture rebuilt to match `concept-19` (serif title, top action buttons, framed
  image viewer, Identity fields incl. Certification Company dropdown + Confidence
  segmented, gold Save bar), then made **full-width** (removed the boxed wrapper),
  then **builder-first** (form + optional photo, camera on demand). Retired the
  dead "Bulk Add" toggle on `/capture` and `/vault/add`.
- Background-removal freeze root-caused (`@imgly/background-removal` runs ONNX on
  the main thread) — options written up here previously; not shipped (needs EK's
  device eyeball). Simplest: pass `{ model: 'isnet_quint8' }`.

---

## 6. First moves for the next session
1. Read this + confirm with EK **who owns `/capture` right now** (this chat vs the
   parallel Codex edits) before editing it — avoid clobbering.
2. Re-read `src/app/capture/page.tsx` fresh (it's been edited outside this chat).
3. Do §2A capture tightening (rearrange only, keep sizes), then §2B barcode,
   §2C documents, §2D crop. Verify each VISUALLY on `vltd.vercel.app` (screenshot),
   not just by DOM checks. `tsc`/`eslint`/`build` before push. Deploys are slow —
   preview CSS-only tweaks via live JS injection to iterate.
