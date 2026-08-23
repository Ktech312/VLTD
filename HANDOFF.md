# VLTD — Session Handoff (updated, eighth pass — overnight: lens-switch on zoom (§B11) + Stripe customer-id fix (§2I), NEEDS ONE MIGRATION)

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
  **✅ NO MIGRATIONS PENDING.** `supabase/migrations/20260812_profiles_stripe_customer_id.sql`
  (adds `profiles.stripe_customer_id`, see §2I) — **confirmed run by EK
  2026-08-12.** The webhook can now persist the real customer id;
  cross-device billing (Payment method/Invoices/Cancel) is live, not just
  local-cache. Still not tested against a real Stripe checkout — worth a
  glance at `profiles.stripe_customer_id` after the next real subscribe.
  `supabase/migrations/20260811_lookup_api_guards.sql`
  (generic permanent-cache + daily-budget guard for the upcitemdb/Discogs/
  Metron lookup APIs, see §B10) — **confirmed run by EK 2026-08-11.** The
  cache/budget protection is now actually live, not just fail-open.
  `supabase/migrations/20260811_vault_item_brand.sql` (the Brand/
  Manufacturer/Publisher field, §B9) — **confirmed run by EK 2026-08-11,
  cloud-sync wiring now done too.**
  `supabase/migrations/20260808_bug_report_replies.sql`
  (adds `admin_reply`/`admin_replied_at`/`updated_at` to `bug_reports`, for
  the reporter-notification feature below) — **confirmed run by EK.**
  `supabase/migrations/20260806_vault_item_tags.sql`
  (adds `vault_items.tags text[]` + a GIN index, for the Halls search/tags
  rebuild — see §B5) — **confirmed run by EK.** Tags now persist to Supabase
  for real.
  (`supabase/migrations/20260806_psa_api_guard.sql` — PSA cert-cache +
  daily-call-budget guard, see §B3 — **confirmed run by EK**, that guard is
  live. `20260803_saved_events.sql` and `20260803_profile_identity_fields.sql`
  were both confirmed run by EK on 2026-08-04 night — still fine.)
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
- **As of 2026-08-14/15 — `src/app/museum/virtual-room/` and
  `src/components/gallery/VirtualGalleryRoom.tsx` are THIS chat's now.** EK
  explicitly handed the 3D museum work over ("take over and fix it") — see the
  big dated section below for the full status. `src/app/owner-lab/`,
  `src/components/owner-lab/`, and `src/app/museum/page.tsx`'s non-museum-room
  parts are still not this chat's. EK flagged the `forge/` (3D-printer app)
  placement under `/museum` as likely misplaced/unintended and is asking about
  it separately — don't try to fix or move it, that's EK's call once they've
  looked. `src/app/forge/` and `src/app/vault/forge/` are empty directories
  (no `page.tsx`), harmless, safe to ignore.

**New, as of 2026-08-12 - Virtual Gallery Builder / future VLTD Museum campus**
- Prototype route: `/museum/virtual-room`
  (`src/app/museum/virtual-room/page.tsx` +
  `src/components/gallery/VirtualGalleryRoom.tsx`). This is a future add-on
  concept, not a polished shipped feature.
- Product intent from EK: users build virtual galleries/rooms from their own
  vault items. Longer term this can become a searchable/public "museum campus"
  or convention floor organized by universe/category, e.g. Comics, TCG,
  Sports, Automobile, Music, MTG, Pokemon, etc. Users may eventually pay for
  larger room sizes, premium templates, public convention booths, or featured
  room placement.
- Current implementation:
  - `Room / Map` switch in the Gallery Builder sidebar.
  - 3D room mode with wall shelves, hardwood floor, taller-ceiling hallway
    feel, uploaded wallpaper texture support, movement controls, click-to-focus
    item viewing, and center-room glass cabinet/plinth placeholders.
  - Map mode groups real vault items by `universe`/`category` and shows a rough
    museum-campus floorplan with Store, Elevator, Entrance, rotunda, Main
    Gallery, Gallery A/C/D/E/F/G, Garden Gallery, and a side list of universe
    rooms. Clicking a populated room opens that universe in the 3D room.
- EK feedback on the current visual state: "looking better but needs clean up."
  Screenshot showed the map is conceptually closer, but the cards/panels
  overlap and crowd each other, typography is too large in small room blocks,
  several room tiles are washed-out/too bright against the dark VLTD theme, and
  the overview needs a cleaner real floorplan composition.
- Important behavior requirement: clicking an item in 3D should move the camera
  directly in front of that exact item, head-on, at a natural eye height. Earlier
  attempts selected the item but put the viewer under/beside the shelf; keep
  this in the cleanup checklist until visually confirmed.
- Design inspiration EK supplied: museum floorplan maps, building cutaway,
  classic museum facade, warm gallery room with seating, blue-wall gallery with
  track lights, glass cabinet museum halls, open 3D exhibition floor models, and
  a Sims/theme-park-style overhead campus map. The direction should feel like a
  collector convention/museum, not just a flat dashboard.
- Do not overbuild the full Sims editor first. Recommended product path:
  1) clean 2D overview + clickable universe rooms,
  2) polished 3D room templates with wall shelves and center display cabinets,
  3) public/searchable rooms by universe,
  4) paid room sizes/templates/convention placement,
  5) later freeform room editing if usage justifies it.

---

## ✅ 2026-08-23, later same day — the rebuilt picker above was rendering
completely broken (EK's screenshot: a transparent, mispositioned overlay
sitting mid-page instead of a real full-screen takeover) — REAL ROOT CAUSE
found and fixed, not a patch.

`globals.css` has a global rule `body > * { z-index: 1; position: relative; }`
(a stacking-context reset for top-level page sections), declared **outside**
any Tailwind `@layer` block. Per the CSS Cascade Layers spec, ANY unlayered
rule beats ANY layered rule regardless of selector specificity or source
order — and Tailwind's own utility classes (`.fixed`, `.inset-0`, etc.) live
inside `@layer utilities`. My new picker overlay is `createPortal(...,
document.body)`'d, making it a **direct child of `<body>`** — exactly what
`body > *` targets — so its Tailwind `fixed inset-0 z-[95]` classes lost to
that reset and it rendered `position: relative`, shrink-to-content-height,
wherever it happened to fall in the page's normal flow. Confirmed via
`getComputedStyle` before (`position: "relative"`, a ~394px-tall box) and
after the fix (`position: "fixed"`, exact viewport rect) — not guessed.

`src/components/gallery/ItemPickerSheet.tsx` (a different existing
body-portaled sheet in this same folder) already sidesteps this exact trap
by setting `position`/`top`/`right`/`bottom`/`left`/`zIndex` as an **inline
style** instead of Tailwind classes — inline styles beat any stylesheet rule,
layered or not. Applied the same pattern to the picker's outer div: inline
`style={{ position: "fixed", top:0, right:0, bottom:0, left:0, zIndex: 95,
background: "var(--bg, #060a13)" }}`, Tailwind classes kept only for
`flex flex-col` (unaffected by the reset). Also switched the background
from `bg-[color:var(--bg,...)]` (a `background-color` declaration, invalid
in the dark theme where `--bg` resolves to a multi-layer `--theme-bg`
gradient — invalid values get silently dropped, which was a second reason
the overlay looked transparent) to the `background` shorthand inline, which
accepts either a flat color or a gradient.

**Any other component that portals straight to `document.body` and relies
on Tailwind's `fixed`/`absolute`/`inset-*` classes for positioning has this
same latent bug** — worth a sweep later. `ItemPickerSheet.tsx` is already
safe (inline style). Did not check every other `createPortal(..., document.
body)` call in the app this pass — flagging, not fixing, since it's outside
this feature's scope.

**Separately investigated** (same message, EK circled empty back-wall slots
in yellow with no badge/outline at all): added a temporary `console.debug`
inside the badge-rendering loop and confirmed via the browser console that
all 61 `positions` entries get a badge mesh added unconditionally, with zero
thrown errors — so this is NOT a missing-data bug like the wall-capacity
issue was; the JS/data layer is provably complete. Whatever's causing badges
to not visually appear at those specific slots is a WebGL rendering
question (camera clipping, transparent-object sort order, or something
about that specific viewing angle) that needs real eyes on the live 3D
render to diagnose — this sandboxed browser's tab isn't reliably compositing
WebGL frames when not actively displayed (established earlier this session),
so pixel-level 3D verification here isn't trustworthy. Debug log removed
before this commit. **Needs a fresh screenshot once EK confirms the overlay
fix above actually resolved what they were seeing** — it's possible the
badge gaps were partly an artifact of the broken, mispositioned overlay
sitting on top of the room view in that exact screenshot, not a second bug.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean.

---

## ✅ 2026-08-23, later same day — the "+" picker above was rebuilt from
scratch to match the Vault's real "Wall" view, per EK's direct feedback on
5 screenshots: "This pop up is useless like this... The pop up should look
like the Wall and search option on the Items list located int he Vault."

The previous picker (grouped-by-universe, small thumbnail buttons — see the
section below) was a one-off simplified UI. This one is a structural port of
`src/components/VaultWallView.tsx` (the Vault's own "Wall" tab), not a new
design: search bar, universe filter pills with REAL counts (`All (N)`, per
universe), an A–Z jump bar that only lights up letters actually present,
a size slider that changes grid columns live, and a full-viewport thumbnail
grid grouped by first letter — same `var(--theme-card)`/`var(--theme-border)`
tokens VaultWallView itself uses, so it reads as the same design language,
not a gold-accented reskin (kept the museum's own `#4FD3EE` cyan for
selection state instead of Vault's gold, since that's this feature's
established accent color already).

Kept from the previous version: multi-select with preserved pick order
(first pick → the exact slot that was clicked, rest fill the next empty
slots in order via `fillFromSlot`, unchanged), and the picker only lists
items not already placed somewhere in the room.

New pieces (all in `VirtualGalleryRoom.tsx`, no new files — matches how the
rest of this large single-file component already duplicates small view
constants rather than splitting into micro-modules):
- `PICKER_UNIVERSE_ORDER` / `PICKER_SHORT_LABEL` / `PICKER_LETTERS` — same
  order and short labels as `VaultWallView.tsx`'s own constants.
- `inferPickerUniverse` / `pickerSearchText` — same logic as VaultWallView's
  `inferUniverse`/search-text builder (uppercase + fall back to MISC for
  anything not a real `UniverseKey`).
- `pickerUnplaced` → `pickerUniverseCounts` (counts unaffected by search
  text, same convention as Vault) → `pickerFiltered` (search + universe
  filter) → `pickerGrouped` (by first letter) → `pickerActiveLetters`.
- `pickerQuery` / `pickerUniverses` / `pickerCols` state, reset via
  `openSlotPicker(idx)` each time a "+" is clicked (fresh search/filter,
  size preference persists) — `closeSlotPicker()` used everywhere the modal
  used to inline-reset both picker states.

**Live-verified via real DOM checks** (not pixel-sampling — see the
`⚠ IMPORTANT TOOLING NOTE` section further down for why): `tsc --noEmit` /
`eslint` (0 errors, same 2 pre-existing warnings) / `npm run build` all
clean. Temporarily added a 7th fixture item to the module-level `DEMO_ITEMS`
array to get a real unplaced item to test against (this test account's demo
vault auto-fills every one of its 6 items into "Scratch room" by default,
so the real 6-item fixture alone always shows the picker's "already placed"
empty state) — confirmed via DOM: universe pill counts render correctly
("All (1)", "Pop Culture (1)" for a `POP_CULTURE` item), thumbnail image
renders, search filters the grid down to 0/1 matches correctly, only the
matching A–Z letter is enabled, the size slider live-updates
`grid-template-columns`, selecting an item shows the order badge + updates
the footer to "Add 1", and confirming correctly placed the item at the
exact clicked slot (`data-arrange-idx`) and closed the modal. Removed the
temp fixture item and rebuilt clean before committing — shipped `DEMO_ITEMS`
is back to its original 6 entries.

**Not addressed this pass**: EK's other piece of feedback from the same
5-screenshot message — "You have a few missing spots and they are not
spread out evenly, image 3 is the way the entire room should be spaced" —
about the 3D room's physical item spacing. Re-read `distributeAcrossWalls`
and `wallGridPosition` (below) as a sanity check: the position table they
build is mathematically gapless and deterministic — every wall's own
capacity fills in a fixed row-major order with no skipped cells, by
construction. If there are still visible gaps/unevenness in the live 3D
room, the cause isn't obvious from the code alone (could be a small vault
simply not having enough items to fill every row yet, which is expected and
not a bug), so this needs a fresh screenshot of the current build (post
wall-capacity fix, commit `2ce81fc`) before guessing at a fix — the images
EK originally attached aren't available in this session to compare
against.

---

## ✅ 2026-08-23, later same day — two substantial Arrange-panel features,
EK's own words: "Finish and renumber the wall spaces, there are many not
filled" + "each empty spot should have a plus... a large box should pop
up with all items under each Universe... select multiple items, the
first selected goes to that spot and the rest will fill in, in order."

**1. Wall-slot capacity was genuinely incomplete, not just "mostly
empty."** Checked the actual room generator script
(`scripts/generate-gallery-room-models.py`) rather than guess at 3D
capacity — the shelf boards are single continuous planks with no baked
physical dividers, so "8 columns × 3 rows = 24" for the back wall is a
placement CONVENTION already coded in `wallGridPosition`, not a hard
limit. But the old `MAX_ROOM_ITEMS=32` budget (minus 8 for vault's
front/door wall) only left 24 slots for back+left+right COMBINED, so
the 2:1:1 `WALL_CYCLE` ratio gave back only 12 of its own real 24
positions, and left/right only 6 each — the rest genuinely had no slot
index at all (no badge, no ghost outline, nothing), which is exactly
the gaps EK circled on the back wall. Raised the budget
(`BACK_WALL_CAPACITY=24`, `SIDE_WALL_CAPACITY=12` each, geometry-
checked against Store's own `sideBaseZ`/`sideZStep` to land comfortably
clear of the door-wall items, not guessed) and rewrote
`distributeAcrossWalls` to keep the WALL_CYCLE's deliberate early-spread
behavior (documented in its own comment — a small collection gets
presence on every wall immediately, not just the back wall; preserved
on purpose) while skipping a wall once it's genuinely full instead of
blindly cycling past real capacity.
**Renumbering**: the raw global slot index (kept as the real identity
for drag/drop, badges, everything functional) reads as scattered
non-sequential numbers per wall since WALL_CYCLE interleaves them — Back
Wall showed 1,3,5,7... instead of 1,2,3,4... New `slotDisplayNumber`
map (wall-local position, 1-based) is DISPLAY-ONLY, layered on top
without touching the underlying index at all — every section now reads
as a clean 1..N.

**2. "+" picker on every empty slot.** Opens a modal (portaled to
`document.body`, same pattern as the Share sheet) listing every vault
item NOT already placed in some slot, grouped by universe. Multi-select
(click toggles, order preserved); confirming assigns the first pick to
the exact slot that was clicked, then walks forward through the whole
slot table (wrapping once) placing the rest into the next empty slots in
order — real per-item data throughout, nothing invented.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean.
**Live-verified via real DOM checks this time** (not pixel-sampling,
which turned out unreliable earlier today) — confirmed: Back Wall shows
"3/24" with sequential badges 1-24 (was "3/12" with scattered odd
numbers); freed up 3 items via the plain Items list, opened the picker
on an empty back-wall slot, confirmed it correctly listed only unplaced
items grouped by their real universe ("SPORTS" → Rookie Parallel);
selected 2 items in one picker session and confirmed the first landed
exactly on the clicked slot (global index 8) and the second landed on
the very next empty slot (global index 9) — the fill-in-order logic
working exactly as asked. Zero console errors through the whole
sequence.

---

## ✅ 2026-08-23, later same day — the spine box rebuild above got
approved as a real improvement ("much better look"); one more polish
note plus a separately-flagged site-wide item:

- **"the blue doesn't seem to have the white glow to it that the
  button does."** The button has a genuine `box-shadow` glow
  (`shadow-[0_0_18px_rgba(79,211,238,0.22)]`) around it — a flat unlit
  `MeshBasicMaterial` has no 3D equivalent of that at all. Switched the
  spine's side/edge materials to `MeshStandardMaterial` with
  `color: black` + `emissive`/`emissiveMap` at `emissiveIntensity: 1`
  (still `toneMapped: false`) — emissive light reads as genuinely
  self-lit/glowing rather than just colored, since it isn't dependent on
  external light hitting the surface the way a diffuse map is. Black
  diffuse base means the room's own lights can't reshade it on top of
  that. Updated the put-back disposal to free `emissiveMap` instead of
  `map` (this material no longer sets `map` at all — the earlier code
  would have silently leaked the texture without this).
- **"any blue button like that, site wide, needs darker text color."**
  Checked this file's own one blue-gradient button (Save Room Draft) —
  already correct (`text-[#06171d]`, dark). The site-wide part is
  flagged as its own background task (same reasoning as the toggle-color
  one above) rather than done here.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean. Live-
verified in a browser tab: picked up an item and put it back with the
new emissive materials and the corrected disposal path — zero console
errors either way.

---

## ✅ 2026-08-23, later same day — the held-item spine was rebuilt
properly this pass, after EK caught two real problems with a screenshot:
"this color does not match the button color" and "you did not make the
entire item thicker, you just put a bigger end on it... looks like an
I-Beam."

**Root cause of the I-Beam look**: bolting a separate small box onto
the edge of an otherwise still-flat, zero-depth card produced exactly
that — a thin uniform strip at the edge next to an abruptly-flat
surface everywhere else, with the box's own top/bottom faces catching
the camera at an angle and reading as flared "wings." **Real fix**:
`pickUpItem` now temporarily SWAPS the card's own `geometry`/`material`
to a real `BoxGeometry` for as long as it's held — front and back faces
carry the real photo (front reuses the existing texture directly; back
mirrors it unless a genuine `imageBackUrl` exists), all 4 remaining
faces are the theme blue. One uniformly-thick object, no bolted-on
piece. The original geometry/material are saved on `HeldItem` and
restored exactly in `putBackItem`'s completion, before disposing the
temporary box's own geometry/materials (carefully NOT disposing the
front/back textures, which are shared with the restored material or
cached for reuse). The old front/back texture-swap-on-drag logic (which
operated on a single material) is gone entirely — a real box naturally
shows whichever face points at the camera as it rotates, no swap needed.

**Root cause of the color mismatch**: a lit `MeshStandardMaterial`
never renders a flat CSS hex the same way a 2D button does — the
scene's own lighting and tone-mapping reshade it. Fixed two ways: (1)
the spine's canvas now draws the button's ACTUAL 3-stop gradient
(`#79E7FB`→`#41C6E4`→`#2CB1D1`), not a flat approximation of just its
lighter end; (2) the material is `MeshBasicMaterial` with
`toneMapped: false`, so it renders those exact pixels unlit and
un-reshaded, the same way the button itself does.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean.
Live-verified in a browser tab: picked up an item, dragged to rotate,
released, picked up a SECOND item — zero console errors through the
whole geometry/material swap-and-restore cycle, confirming it's robust
across repeated use, not just a one-shot fix.

---

## ✅ 2026-08-23, later same day — tightened the Share/Export sheet's
layout, EK's direct ask ("Next to tighten up this page"). **This edits
`SocialExportSheet.tsx` and `GenerateCopyPanel.tsx` — shared components
also used on the real item detail page (`vault/item/[id]/page.tsx`), not
museum-only files.** Explicitly authorized by EK, called out here since
it's outside this branch's usual scope.

1. Background label moved inline next to its swatches (was stacked
   above); swatches shrunk `h-8 w-8` → `h-6 w-6`, gap tightened, so
   label + all 6 colors fit one row. Applied to both places this exact
   markup was duplicated (Image tab and Then-vs-Now tab) for
   consistency.
2. "Show value" and "VLTD watermark" combined onto one row. Added an
   opt-in `compact` prop to the shared `Toggle` component (default
   `false` — its third, unrelated usage on the Then-vs-Now tab is
   untouched) that puts the switch immediately next to the label instead
   of pushed to the far edge via `justify-between`.
3. "Preview {format}" and "Generate caption" are now the same size, side
   by side, only while `!preview` (matches EK's screenshot state) —
   `GenerateCopyPanel` gained an explicit `fullWidth` prop for this
   rather than concatenating a `className` override on top of its
   default classes, which would have left conflicting Tailwind
   utilities (`rounded-[7px]` vs `rounded-2xl`, etc.) with no reliable
   way to know which one actually wins in the generated CSS — a real
   fix, not a fragile string-concat shortcut. Kept `GenerateCopyPanel`
   as ONE persistent instance (not two separately-mounted copies for the
   two states) so an in-progress AI caption draft survives toggling
   Preview/Edit.
4. Removed the now-redundant wrapper `<div className="mt-2">` around the
   caption generator — it's a sibling in the same flex row now, so that
   extra vertical space is gone, not just visually hidden.

Deliberately NOT touched: toggle colors (green/red) — that's the
separately-flagged, actually-site-wide task below, not part of this
layout pass.

`tsc --noEmit` (full project, given the shared-component edit) /
`eslint` (0 errors, all warnings pre-existing) / `npm run build` clean.
Verified structurally in a live browser tab: Background row confirmed
`flex items-center gap-3` (inline), both toggles confirmed inside one
shared `.flex.gap-6` row, and — after resetting `preview` state via
Edit — Preview and Generate Caption buttons both confirmed
`flex-1 rounded-2xl py-3 text-sm font-bold`, same parent element.

## 📋 FLAGGED, NOT DONE — site-wide toggle colors (separate from the
above). EK: "All sliders — site wide — need to be like the ones int he
user page, they should be green when on and red when off, make that a
full site scan to follow." This is a main-app, all-of-`src/`-spanning
design change, unrelated to the 3D museum — spawned as a separate
background task (title: "Make all site toggles green/red like the user
page") rather than done here, since it needs to happen on `main` in
whichever session owns the core product, not this branch.

---

## ✅ 2026-08-23, later same day, second correction — the share sheet's
image preview was STILL black. EK, correctly and sharply: "you are
trying to quickly fix things instead of doing them right the first
time." My first attempt (absolutizing `imageFrontUrl` to
`http://localhost:3001/...` at the museum's own call site) was a
band-aid, and it broke a SECOND time in a new way — traced fully this
round instead of guessing again:

- `getPrimaryImageUrl` (shared, `vaultModel.ts`) calls
  `isDirectBrowserImageUrl`, which only recognized `http(s)/blob/data`
  URLs — the museum's `DEMO_ITEMS` use root-relative
  `/collectibles/*.png` paths, so it returned `""` for them. That's the
  real gap.
- My first "fix" absolutized the path to `http://localhost:3001/...` to
  get past that check — which worked for `isDirectBrowserImageUrl`, but
  then `SocialExportSheet`'s own `proxyImageUrl()` helper only skips
  proxying for paths starting with `"/"`; a full `http://` URL routed
  through `/api/image-proxy` instead, which is a deliberate SSRF guard
  that ONLY allows `supabase.co`/`supabase.in` hosts — `localhost` got a
  correct, working-as-designed 400. Two gates, two different
  preferences, my fix satisfied one and broke the other.
- **Real fix**: added `|| lower.startsWith("/")` to
  `isDirectBrowserImageUrl` itself (`vaultCloud.ts`) — a root-relative
  path genuinely IS already directly browser-loadable, which is exactly
  what that function is supposed to recognize; it just never had a case
  for it. Real Supabase storage keys never start with `/`, so this is
  additive only, no behavior change for actual production data. Ran a
  full-project `tsc --noEmit` (not just this file) given how many places
  import this function — clean. Reverted the local absolutize hack in
  `VirtualGalleryRoom.tsx` entirely now that the root cause is fixed
  where it actually lives.

**Verified this time, not assumed**: read the live network requests
after the fix — `/collectibles/vinyl-record.png` etc. now load as plain
200 GETs with zero `/api/image-proxy` calls at all (previously: one
`/api/image-proxy?...localhost...` → 400). Confirms both gates are
satisfied correctly, not just patched around.

---

## ✅ 2026-08-23, later same day — 3 real bugs in the previous pass,
caught from EK's own screenshots within minutes of it shipping:

1. **Cover AND back image both missing — a real regression.** The new
   spine box's face-material array was `[side, side, plain, plain,
   plain, plain]` — but `BoxGeometry`'s face order is `[+X, -X, +Y, -Y,
   +Z, -Z]`, so indices 4/5 (front/back, `±Z`) got an OPAQUE plain-blue
   material sitting at the same local Z as the card's own image plane,
   completely covering it (a solid pale-blue slab with zero image — the
   "cover image and back image are now missing" report). Fixed: indices
   4/5 are now a fully transparent `MeshBasicMaterial` (`opacity: 0,
   depthWrite: false`), so only the thin side edges (0/1) and top/bottom
   (2/3) show blue — the card's real image shows through the front/back
   unobstructed.
2. **Wrong blue, unreadable text.** EK circled the "Save Room Draft"
   button as the actual reference for "theme blue" — traced its real
   colors in code: gradient `#79E7FB`→`#2CB1D1` with dark `#06171d`
   text, not the `#4a9bff`/white I'd guessed twice now. Added
   `THEME_BLUE`/`THEME_BLUE_TEXT` constants from those exact values,
   used for the spine label (dark text on light blue = actually
   readable) and the Description panel's header color.
3. **Share sheet required scrolling to see the whole thing.** Rendered
   via `createPortal(..., document.body)` instead of inline in the room
   view's own tree — whatever in that tree was constraining `fixed
   inset-0`'s viewport coverage (a `transform` on some ancestor, most
   likely) no longer applies once it's a direct child of `<body>`.
   Confirmed via `el.parentElement === document.body` after opening it.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean. Live-
verified the portal fix structurally (sheet root really is a direct
`document.body` child now). Could not visually re-confirm the image/
color fix on screen this pass — the Browser pane's viewport reported
0×0 during this test (`window.innerWidth/innerHeight` both 0), the same
not-actually-displayed limitation as every prior pass; the face-order
bug and its fix were confirmed by code review, not a screenshot.

---

## ✅ 2026-08-23 — 4 precise, numbered corrections from EK re-reading the
reference image with circles on it, after the previous "side title"
attempt (a floating tag) was itself wrong — EK: "I never asked for a
floating tag, that's not on that image either." Removed that tag
entirely; here's what it actually meant:

1. **Description panel (left)**: widened to `w-[340px]` (was capped at
   260px) and added a real key/value list below the existing notes-or-
   fallback paragraph — `heldVaultItemInfoRows`, built from whichever of
   Universe/Category/Year/Condition/Brand/Edition/comicIssueNumber/
   tcgParallelType/sportsParallelType/vinylPressing actually have real
   values on that specific item, so it naturally varies by whether it's
   a comic, a card, vinyl, etc. without a hardcoded per-universe switch.
2. **Share**: was a bespoke clipboard-copy implementation. Replaced with
   the exact same `SocialExportSheet` component the real item detail
   page (`vault/item/[id]/page.tsx`) already opens for its own Share
   button — same flow everywhere now, nothing reinvented. Button
   shrunk slightly (h-7→h-6).
3. **"Side title, different color"**: this was the actual ask all
   along — the SIDE FACE of the held item itself (like a book/case
   spine), not a floating UI tag. Added a small, fixed-depth
   (`0.16` units) box as a child of the card, created fresh in
   `pickUpItem` and disposed in `putBackItem`'s completion — never
   touches the shelf-resting frame at all. Its two ±X faces get a
   canvas-drawn "spine" texture (theme blue `#4a9bff` background, title
   + universe text rotated to read top-to-bottom); the other 4 faces are
   a plain blue material. Sized `cardWidth + 0.05` / `cardHeight + 0.05`
   — "slightly wider," not a large box, and being a child of the card it
   scales/rotates with it automatically, same trick as the (reverted)
   frame-attach idea, just scoped to a small dedicated mesh instead of
   the wall-mount frame's own (much deeper) geometry.
4. **Back image**: EK's ask ("should be the same as the front unless...
   there's a real second image") — checked, already correct: the card
   material is `DoubleSide` with a single texture, so without a distinct
   `imageBackUrl` the back naturally shows the same (mirrored) image;
   the existing `entry.backTexture` swap only kicks in when a real back
   image exists. No change needed.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean. Live-
verified: picking up an item shows the description panel with real
notes AND the new info rows (confirmed "Universe / Music", "Category /
Vinyl" for First Press Vinyl), zero console errors from the new spine-
box creation, and clicking Share genuinely opens `SocialExportSheet`
(confirmed its own "Instagram Feed"/"Stories" text renders). Did not
independently verify the spine box's on-screen appearance/color or its
cleanup on put-back — same Browser-pane-not-displayed limitation as
before; worth EK's own glance.

---

## ✅ 2026-08-22, later same day, third pass — reverted the frame-attach
"fix" from the previous pass; EK, sharply: "you used to have the image
on the back and now that is gone too. YOU ARE DOING TOO MUCH, only do
the things I ask." Three separate corrections from one message:

1. **Reverted `entry.mesh.attach(entry.frame)` entirely** (the frame
   reparenting from the second pass, described two sections below). EK
   never asked for that fix — it was inferred from an ambiguous
   screenshot — and it caused two real regressions: the wall-mount
   frame's depth (stretched to reach the wall, fine sitting still) now
   scaled up along with the card when held, reading as a "cereal box"
   instead of a flat photo; and it visibly blocked the existing
   front/back texture-swap-on-rotate feature. Removed the `frame` field
   from `itemMeshIndex` entries and `HeldItem`, and both `.attach()`
   calls, back to the pre-existing bare-card pickup. **Lesson: don't
   infer-and-fix a structural bug from an ambiguous screenshot without
   being asked — ask first, or scope it separately.**
2. **Removed the "Hold + drag to turn it around · Click to put it
   back" hint text outright.** EK: "I never asked for directions on how
   to use it." Wasn't part of the original 4-item spec (side tag,
   bottom title/basics/share, left description) — added on my own
   initiative last pass, removed now.
3. **The description box's "hide when there's nothing real to show"
   logic was itself the problem EK was hitting**, not a safety feature
   worth keeping here: the `/museum/virtual-room` "Scratch room" items
   are `DEMO_ITEMS` — this component's own placeholder/preview content,
   not a real user's real vault items, so EK's "this is a fake item you
   created for this, so fill in the information" is a legitimate, direct
   ask, not a no-fake-data violation. Added a real one-line `notes`
   string to each of the 6 `DEMO_ITEMS` entries, and the description box
   now always renders (dropped the conditional hide) so it's actually
   visible to test against, matching the "I want the Description box on
   the side like this" ask. Also nudged the corner tag from `top-5` to
   `top-16` — it was landing directly under/behind the "ROOM" panel
   toggle button, illegible where they overlapped.

`tsc --noEmit` / `eslint` (0 errors) / `npm run build` clean. Confirmed
live via a real browser tab: hint text gone from the rendered page,
description box shows the new real notes text for "First Press Vinyl"
("Original first pressing on the original label...").

---

## ⚠ IMPORTANT TOOLING NOTE for whoever tests this next via the browser
automation tools (not EK's own browser): **if the Browser pane isn't
actually displayed on the human's side, Chrome fully pauses
`requestAnimationFrame` for that tab (`document.hidden` reads `true`,
`document.visibilityState` is `"hidden"`)** — confirmed by installing a
raw `requestAnimationFrame` counter and getting 0 ticks after a full
second of real wait. This app's whole 3D update loop (`render()`,
`updateHeldItem()`, `walkTween`, everything) runs on `requestAnimationFrame`,
so in that state NOTHING animation-gated ever progresses, no matter how
long you `setTimeout`-wait for it. **This cost real time today**: item
pickup still LOOKED like it worked in automated tests because
`setSelectedItemId(...)` fires synchronously the moment you click,
independent of the animation — but put-back (`putBackItem` only clears
`selectedItemId` once `pullAnim.t` reaches 1 inside `updateHeldItem`,
which needs real animation frames) looked permanently stuck across many
different items and multiple different code versions, which briefly
looked like a real regression before the actual cause turned out to be
the tab simply not compositing. `tabs_select` on the tab does NOT fix
this — it only fronts a tab within the pane's own strip, it can't force
the pane itself to be visible in the host UI. If put-back (or anything
else animation-driven) looks stuck in a similar automated test, check
`document.hidden` FIRST before assuming the code is broken.

---

## ✅ 2026-08-22, later same day, second pass — the held item's frame
was left behind on the shelf the whole time an item was held, plus 3
smaller polish fixes EK caught on the FIRST pass's actual live result
(that pass's own numbers/color choice below are superseded by this one).

**The real structural bug, found while chasing EK's "bottom of the item
is back in the shelf" + "paper thin, no title on the side" reports**:
`pickUpItem` only ever moved `mesh` (the flat photo card) — the matted
picture-frame box built alongside it in the main mount effect was a
completely separate mesh, never referenced anywhere in the pickup/
put-back code, so it just stayed glued to its shelf position the whole
time an item was held. A held item was therefore a bare, borderless
photo floating in front of camera (the actual "paper thin, no title on
the side" cause — there was never a frame around it once lifted), while
its real frame sat empty back on the shelf (most likely explanation for
the shelf-overlap screenshot too — probably caught mid pull-animation,
card already moving, frame still exactly where it started). **Fix**:
`itemMeshIndex` entries and `HeldItem` both now carry a `frame:
THREE.Mesh | null` reference; `pickUpItem` calls
`entry.mesh.attach(entry.frame)` (Three.js's `Object3D.attach` reparents
while preserving world transform) so the frame inherits every position/
rotation/scale change made to the card for free — no separate animation
math needed. `putBackItem`'s completion (inside `updateHeldItem`, once
`mesh` is back at its exact shelf pose) calls `roomGroup.attach(heldItem.frame)`
to hand it back to the room at that same now-correct resting transform.
Flat/display-case items never had a frame to begin with (`entry.frame`
is `null` there) — untouched.

**Other 3 fixes from EK's first live look:**
1. **Held item was oversized/cropped despite already being shrunk once.**
   Root cause: `INSPECT_SCALE` was a flat multiplier stacked on top of
   `pos.scale`, which already varies hugely by layout (Salon ~0.58,
   Store ~0.78, Hero ~1.2) — a Store-scaled item at the previous
   `INSPECT_SCALE=1.5` came out to `1.54*0.78*1.5 ≈ 1.80` units tall
   against a ~1.91-unit visible-height budget at the fixed 2.2-unit
   focal distance (47deg vertical FOV) — 94% of the frame, matching "even
   bigger now ... cropped top and bottom." Replaced the flat constant
   with a per-item `inspectScale` computed in `pickUpItem` from a new
   `naturalHeight` stored on each `itemMeshIndex` entry
   (`1.54 * pos.scale`, the card's real built height) against a single
   `TARGET_HELD_HEIGHT = 1.15` — every held item now lands at the SAME
   absolute size regardless of its shelf scale, instead of a flat
   multiplier compounding on whatever that item already was.
2. **The corner "side tag" was there but invisible.** First attempt used
   `bg-cyan-400/90`, which rendered as a near-transparent pale gray. Tried
   `var(--accent)` next, thinking the Tailwind color was the problem —
   turned out `--accent` genuinely resolves to a real, legitimate
   near-neutral `#C8CDD2` in this context (not a bug, just not "vivid"),
   so it read as just as invisible against the Vault room's own steel
   tones. Settled on a hardcoded `#4a9bff` (the same blue already used
   elsewhere in this file for the frame-guide corner brackets) — a fixed
   color guaranteed to actually stand out, not dependent on theme state.
3. **"No description" on items with nothing typed into `notes`.** Rather
   than leave the box empty, added a real fallback line built from other
   fields that actually exist on the item (`subject`, `brand`,
   `edition`/`variant`, `conditionReason`) — never invented text, just a
   different real combination when `notes` itself is blank.
4. **Share silently did nothing.** `navigator.clipboard.writeText` can
   throw `NotAllowedError` in some focus states and the catch block
   swallowed it with zero feedback either way — added a legacy
   `execCommand("copy")` fallback before giving up, and a visible
   "Couldn't copy link" message if even that fails, so a real failure is
   never silent again.

**Verified**: `tsc --noEmit` / `eslint` (0 errors) / `npm run build` all
clean. Confirmed live in a browser tab: the corner tag now reads
`rgb(74, 155, 255)` (the real hardcoded blue, not gray), share's
clipboard-copy path executes without throwing. **Could NOT verify the
frame now visually travels with the card, nor time the put-back
release, live this pass** — see the tooling note directly above; the
Browser pane wasn't actually displayed, so nothing animation-gated could
be observed completing, regardless of how long a wait was used. The
`attach()` reparenting logic was reviewed carefully by hand (Three.js's
`attach()` is the standard, documented way to reparent while preserving
world transform) but a real look on an actual visible browser — EK's own
or a properly-displayed pane — is genuinely needed to confirm this one
looks right, not just that it doesn't throw.

---

## ✅ 2026-08-22, later same day — 4 more real bugs/asks EK caught live
off actual screenshots, all fixed and code/build-verified (see each
item for how). Read this block first — it supersedes the walnut-brown
color numbers in the block directly below (EK looked at the live result
and asked for a different direction, same day).

1. **Click-to-walk still landed too close to a wall/corner.** The
   previous "roomier minimum" pass (see `clampWalkDestination`'s own
   history, further below) only pulled the destination back to a ~4-unit
   margin — EK's screenshots showed that's nowhere near enough; landing
   nose-to-wall with zero floor/ceiling visible. EK: "much further
   back... I need to see floor to ceiling... never any closer, that is
   what zoom is for." Worked out the actual geometry: camera is
   `PerspectiveCamera(47deg)` (vertical FOV) at `eyeHeight=3.6`, ceiling
   at `y=9.15` — seeing literal floor-to-ceiling looking level at a flat
   wall needs `D >= (9.15-3.6)/tan(23.5deg) ≈ 12.8` units, which is most
   of the room. Rather than chase that exactly (it would barely let you
   approach a corner at all), pulled `clampWalkDestination` in hard to a
   generous room-interior stop — `x: [-3.5, 3.5]`, `z: [-4.6, 1.8]` (was
   `x: [-6.2, 6.2]`, `z: [-7.8, 4.2]`) — in
   `src/components/gallery/VirtualGalleryRoom.tsx`. Zoom (scroll wheel,
   still governed by the separate, looser `clampPosition`) is how you
   actually get close now, matching what EK asked for.
2. **Item-inspect spun on every mouse move, not just while dragging.**
   The bingebrowse-sourced "passive parallax" (cursor position feeding a
   spring-damper tilt even with the mouse button up) read as
   uncontrolled spinning, not a subtle tilt. EK: "only allow it to spin
   when being held down or when clicked." Removed that branch from
   `onPointerMove` entirely — the spring still exists and settles the
   item after pickup, it just never gets re-driven by bare mouse
   movement anymore. An actual drag (button held) still free-rotates the
   item exactly as before, via `heldDragYaw`.
3. **Held item sized slightly too large.** `INSPECT_SCALE` was `1.7`,
   dropped to `1.5` per EK's "shrink it slightly... its just slight
   larger."
4. **Item-inspect had zero info panel — built one from a reference
   screenshot EK provided.** Previously just a one-line "Drag to rotate"
   hint with no other feedback. Added, all from real per-item
   `VaultItem` fields (never invented text): a small colored corner tag
   (universe/category), a bottom bar with the item's real title + real
   basics (year / grade-or-condition / category) + a working Share
   button (`navigator.share` where available, clipboard-copy fallback,
   linking to the item's real `/vault/item/[id]` page), and a left-side
   "Description" panel that only renders when the item actually has
   `notes` (no fake filler when it doesn't). New `heldVaultItem` /
   `heldVaultItemBasics` memos look the held item up from the component's
   real `items` state by `selectedItemId` — the 3D effect's own
   `heldItem` lives in a closure React can't read directly.
   **Known pre-existing gap, not introduced here:** display-case ("flat")
   item clicks also set `selectedItemId` (a separate, older code path,
   camera-focus only, no real pickup), so this same panel — including
   the "hold + drag / click to put back" hint — shows for those too even
   though they don't actually support drag-rotate or click-to-release.
   The original one-line hint had the identical ambiguity before this
   pass; flagging it here rather than scope-creeping a fix into this
   round.

**Verified**: `tsc --noEmit` / `eslint` (0 errors) / `npm run build` all
clean. Live-tested against a real production build in a browser tab:
switched to White, dispatched real `PointerEvent`s to click-to-walk a
corner and to pick up a wall item — zero console errors through dozens
of interactions. Confirmed the new panel renders with genuine data by
reading the live DOM: side tag "COMICS", title "Signed Variant Comic",
basics "COMIC BOOKS", hint text exactly as written, and — correctly —
no Description block for that item since its `notes` field is empty.
**Not independently re-verified by pixel screenshot this pass** — the
Browser pane wasn't displayed on EK's side during this session, so
`computer{action:"screenshot"}` couldn't composite a frame; verification
above is DOM/console-based instead. Worth EK's own visual glance next
time to confirm the walk distance and inspect panel actually look right,
not just that they don't crash.

---

## ✅ 2026-08-22 — White room shelf/floor warmed to walnut-brown, the
one item left on the list from the §SESSION STATE block below. EK: "it
could have been done 2 days ago." `style_mats()` in
`scripts/generate-gallery-room-models.py` (whitebox branch) had the trim
and floor_tones colors shifted warmer/redder (more R, less B — a hue
shift, not a flat darken) instead of the grayish-tan they were: trim
`(0.30,0.25,0.19)` -> `(0.34,0.21,0.12)`, floor_tones `(0.50,0.36,0.22)/
(0.58,0.42,0.25)/(0.42,0.29,0.18)/(0.62,0.47,0.30)` ->
`(0.52,0.33,0.17)/(0.60,0.38,0.20)/(0.38,0.22,0.11)/(0.64,0.42,0.22)`.
Deliberately kept luminance close to the old values (a hue shift, not a
brightness change) so the exposure/hemisphere/spot light values EK
already confirmed good for "no longer washed out" don't get undone by
this pass. Regenerated only `whitebox-room.glb` via `blender
--background --python scripts/generate-gallery-room-models.py --
whitebox` (vault/arcade untouched, no ask to change those). Bumped only
whitebox's `ROOM_MODEL_URLS` cache-bust to `walnut-warm-2026-08-22`
(vault/arcade left on `shelf-headroom-2026-08-22`, unchanged).
**Verified**: parsed the exported GLB's material JSON directly — baked
`baseColorFactor` values match the intended numbers exactly — and loaded
whitebox live in a real browser tab (switched the room-style select to
`whitebox` via a real DOM event), zero console errors. `tsc --noEmit` /
`npm run build` clean.

**⚠ Superseded same day** — EK looked at this live and called it too
tan; see the block above (dated the same day, listed first) for the
off-white/greige correction. Trim/floor are now `(0.62,0.60,0.55)` /
`(0.60,0.58,0.53)`-family, not the walnut numbers just above.

---

## ✅ 2026-08-23, second overnight pass — 2 more real bugs EK caught in
the morning-after screenshots, both fixed and LIVE-VERIFIED. Read this
block first, then the one below it for the original 3-task pass.

**1. Hero's frame was overlapping the shelf board above it.** EK: "the
shelf design has to be custom for the Hero Frame. do not make the frame
bigger, do not move the frame or change the size at all. The top shelf
have to be redone from scratch to stop just before the hero image." Root
cause: moving Hero to the middle row's height (previous fix) never
checked collision against the physical TOP-ROW SHELF BOARD — items are
column-discrete (Hero's x sits between regular columns, so no item-vs-
item collision), but shelf boards are one continuous run across the
WHOLE wall regardless of column, so Hero's taller frame reached straight
up into the top board's own space. Fixed with a real notch, not a
position/size change to Hero at all: `addBackRowBoard`/`addSideRowBoard`
(shell/"Blue" style) and a post-GLTFLoad `getObjectByName("<wall>_shelf_
0")` hide-and-replace (Vault/White/Arcade, since the notch can't be baked
into a GLB shared by every layout) now build the top row as TWO segments
with a `HERO_NOTCH_HALF=0.9` gap centered on Hero's own position, only
when `roomLayout === "spotlight"` AND that specific wall actually has a
populated Hero slot (`selectedItems.length >= 1/2/3` for back/left/
right — mirrors `allHeroSlots`' own fill order). Store/Salon and any
under-filled Hero wall keep the original unbroken board. GLB replacement
segments reuse the FOUND mesh's own material so they match whatever that
room style baked, not a guessed color. **Live-verified**: switched to
Hero on Vault, zoomed on the feature piece — clean gap on both sides now,
board no longer visibly crosses the frame.

**2. Click-to-walk forced a final turn that shoved you into the wall.**
EK: "it spins you to the position it thinks you want and puts you up
close to the wall... it should not reposition the camera at the end."
The walk itself (turn-to-face-destination, then walk) was fine per EK
("the walk through work well") — the problem was a 3rd phase I'd added
that then forced a FURTHER turn to face whichever wall was nearest the
clicked point, landing you staring straight into it right as you arrived
close to it. Removed that 3rd phase entirely — `startWalkTween` no longer
takes a `finalYaw` param, `journeyDuration` is just `firstTurnDuration +
moveDuration`, and the walk now settles facing the same direction you
were already walking in. **Live-verified**: clicked to a floor spot,
camera walked there and stopped at the travel-facing angle — no snap to
stare at a wall.

`tsc`/`eslint`/`npm run build` all clean after both fixes.

---

## ✅ 2026-08-22/23 OVERNIGHT — all 3 researched tasks IMPLEMENTED and
LIVE-VERIFIED while EK slept ("do all 3 tasks... cross our fingers you
get us 80% of the way there"). Read this block first for current status.

**1. Three-phase click-to-walk** — replaced the old plain continuous lerp
with `walkTween` (declared near the top of the big mount effect, right
after `cameraBody`): turn-to-face-destination, walk-in-a-straight-line,
turn-to-final-aim, each phase individually smoothstepped, exact
timing/rate constants from bingebrowse.net's own source (see the 🔬
research section further below for the full formula). `startWalkTween()`
builds the tween; `render()` drives yaw/pitch/cameraBody from it each
frame when one is active, falling back to the original continuous lerp
otherwise (WASD/mouse-look untouched — matches the reference, which has
no tween on those either). Any click, WASD press, or real mouse-drag
cancels an in-progress walk. **Live-verified**: clicked the floor,
watched the camera turn-then-travel smoothly over ~1-2 seconds instead of
snapping.

**2. Item pickup/inspect** — wall-mounted items (display-case items
intentionally excluded, scope cut) now lift off the shelf into a held/
inspect view instead of just moving the camera. `itemMeshIndex` (Map,
built alongside the item meshes) tracks each item's shelf transform +
front/back textures. `pickUpItem`/`putBackItem`/`updateHeldItem` do the
two-phase pull animation (0.6s, easeOutCubic, split at eased-progress
0.45 — exact shape from their `updateInspectAnim`), then a spring-damper
idle parallax (`INSPECT_STIFF=100`/`INSPECT_DAMP=19`, their exact
constants) driven by plain mouse movement, plus free drag-to-rotate
(`heldDragYaw`) that swaps to `imageBackUrl` past the edge-on point if
one exists. Camera movement (WASD/wheel-zoom/click-to-walk) is disabled
while holding; Escape or any click releases. A minimal "Drag to rotate ·
Click to put back" hint (gated on `selectedItemId`, reused from the
existing pickup/release wiring) is the only feedback UI — no synopsis/
metadata side panels, no next/prev browsing between held items, no touch/
pinch support, all explicitly out of scope for this pass.
**Bug found and fixed during live verification, not before**: the first
version had the item's "face the camera" rotation formula wrong
(`frozenYaw + Math.PI` instead of the correct `-frozenYaw`, worked out
from how Three.js's rotation.y actually transforms a plane's local
normal) — depending on which way the camera happened to be facing at
pickup, this could land the lifted item edge-on to the camera, reading as
the item vanishing when clicked. Live-verified end to end after the fix:
picked an item off the shelf (visibly grew, centered, frame left empty on
the wall), dragged it to rotate (visibly turned), clicked to release
(animated back onto the shelf, texture and position restored exactly).
**Not done, flag if asked:** display-case items, front/back swap wasn't
exercised live (no test item had `imageBackUrl` set), multi-item
carousel browsing.

**3. Hero repositioning** — was `y=5.96`, wedged into the gap between the
top shelf row and the wall rail; the math showed that gap (~1.23 units)
is smaller than Hero's own frame height at scale 1.2 (~2.0 units), so no
number up there could ever fully clear both boundaries. Moved to
`shelfItemY(1, 1.2)` — the middle shelf row's own height — which is
already collision-safe (regular items sit there without issue on every
layout) and lands much closer to eye level (deviation from `eyeHeight=
3.6` dropped from +2.36 to +0.594). Hero's x positions (0, ±10.22) sit
between the regular grid's own column positions, so there's no actual
horizontal collision despite the vertical range now overlapping where
row-0/row-2 items would be. Spotlight target Y updated to match.
**Live-verified**: switched to Hero layout, the feature piece now sits
visibly at mid-wall height instead of crammed near the ceiling.

`tsc`/`eslint`/`npm run build` all clean after every change above,
verified fresh each time (not just after the first pass — re-verified
after the rotation-formula fix too).

---

## ⚠⚠⚠⚠ 2026-08-22 — four more real bugs EK caught live, all fixed and
LIVE-VERIFIED (screenshotted via claude-in-chrome against a fresh
production build):

1. **Item headroom** — `SHELF_ROW_Y` had exactly zero clearance between an
   item's own top edge and the shelf board mounted above it (1.25 spacing
   = item height (1.2) + board half-thickness (0.05), no margin at all).
   EK: "the middle shelf doesn't give enough space on top of the items to
   fit." Fixed WITHOUT changing item size, per EK's explicit instruction —
   top row (4.72) untouched, middle/bottom dropped 0.25 each: `[4.72,
   3.22, 1.72]` (was `[4.72, 3.47, 2.22]`). Same GLB-regen-and-verify
   process as every SHELF_ROW_Y change — `shelf_y` in the generator script
   updated to match, GLBs regenerated, baked values confirmed via the
   byte-parse technique. Cache-bust now `shelf-headroom-2026-08-22`.
2. **Builder page forced a scroll** — `roomView`'s non-guest section was
   sized `min-h-[calc(100svh-116px)]`, guessing the toolbar above it was
   116px tall. When the toolbar grows (Hero's expanded pills, the Guest
   button added 2026-08-21), the guess falls short and the whole page
   exceeds one screen. Changed to a fixed `min-h-[600px]` — can't ever
   force that overflow, whatever the toolbar's real height is.
3. **Item frame sinking into the shelf, plus frame/shelf color blending**
   — two related bugs EK caught together ("I would have been able to tell
   earlier" if the colors weren't the same). (a) The frame mesh reused
   `trimMaterial` — literally the same color as the shelf boards and wall
   trim, which is why the geometry bug below went unnoticed. Gave frames
   their own dedicated `frameMaterial` (off-white matte matting,
   `0xf2eee3`) that reads as a picture frame against any room style.
   (b) The frame's matting used to extend symmetrically above AND below
   the card — but the card's clearance above its shelf board is a fixed
   0.05 units that doesn't scale with item size, while the frame's
   overhang does, so at normal item scale the frame's bottom edge sank
   into the board. Matting now only extends on top and the sides; the
   frame's bottom is flush with the card's own bottom edge, so it
   physically cannot dip into the shelf regardless of scale. Pure JS
   change (frames aren't baked into the GLB) — no regen needed.
4. **Guest view was a dead-end loop** — Exit only went guest-room -> map,
   and the map had no link back to the actual builder/setup page at
   `/museum/virtual-room` — a guest visitor (or EK checking guest view)
   could only bounce between room and map forever. Added a "Builder" link
   in the guest-mode top-left overlay, shown only when `guest` is true.
5. **PWA install banner kept reappearing after a real install** —
   `PWAInstallBanner.tsx`'s `install()` was *clearing* the dismiss-cooldown
   key on success instead of recording a permanent "installed" flag, so
   there was nothing stopping the banner from showing again (e.g. next
   time `beforeinstallprompt` fires, or on a load that isn't in standalone
   display mode even on an installed device). Added `INSTALLED_KEY`,
   checked first before anything else; also listens for the browser's own
   `appinstalled` event so it catches installs that didn't go through this
   banner's own button.

`tsc`/`eslint`/`npm run build` all clean after every fix above.

---

## 🔬 IMPLEMENTATION-READY RESEARCH, 2026-08-22 — read before starting the
walking-pattern or item-inspect work. EK: "I don't want to sit around
tomorrow for 6 hours waiting for you to do these things" — this is that
research, done in full, so the next session can start writing code
immediately instead of re-investigating. Everything below is pulled
directly from bingebrowse.net's own bundle (fetched + grepped live, not
guessed) — exact constants, exact formulas, not approximations.

### A. The walking pattern (EK's biggest open complaint: "you never
change the walking pattern like the other app")

**WASD/arrow-key movement** (`updateMovement(dt)`):
- Direct velocity, no acceleration curve — position += direction * speed
  * dt, every frame. Starts and stops instantly; the "smoothness" comes
  from elsewhere (below), not from easing the walk itself.
- `speed = 1.25` units/sec normally, `0.85` units/sec while Shift is
  held.
- **Shift is a crouch, not a sprint** — it also eases the camera's eye
  height down to `1.02` (from `EYE=1.30`) via `y += (target - y) *
  min(1, dt*8)` — an exponential ease, ~1/8s time constant. We have
  nothing like this at all; worth considering as a cheap, high-value
  addition (a "duck down to see a low shelf" moment), separate from the
  main walking-pattern fix.
- Position is clamped to the room bounds every frame (same pattern our
  `clampPosition` already uses).

**Click-to-walk ("the stepping squares," our biggest gap from this)** —
this is the real answer to EK's complaint. It is NOT a single continuous
lerp toward a destination (which is what our current click-to-walk does,
in `onPointerUp`'s floor-plane branch). It's a deliberate **three-phase
tween**, comment verbatim: *"Search journeys move like a person: face the
destination, travel with a steady view, stop, then turn to the exact
film. Each phase is speed-bounded, so crossing the store cannot become a
faster animation."*

Phase 1 — **turn in place** to face the direction of travel (position
frozen, only yaw/pitch animate).
Phase 2 — **move** in a straight line at that fixed facing (position
lerps, yaw/pitch frozen at the travel angle — you don't reorient while
walking).
Phase 3 — **turn** from the travel-facing to the precise final aim at the
destination (position frozen again).

Exact formulas (`THREE.MathUtils.clamp`, `angleDelta` = shortest-path
angle difference):
```
travelDistance = camera.position.distanceTo(destination)
travelYaw = yaw + angleDelta(yaw, angleToward(destination))
firstTurnDuration = clamp(max(|travelYaw - yaw|, |travelPitch - pitch| * 1.4) / 2.2, 0.18, 1.25)  // seconds
moveDuration       = clamp(travelDistance / 4.8, 0.34, 1.65)                                      // seconds
finalTurnDuration  = clamp(max(|finalYaw - travelYaw|, |wantPitch - travelPitch| * 1.4) / 2.2, 0.18, 1.25)
journeyDuration = firstTurnDuration + moveDuration + finalTurnDuration
```
Note the travel speed baked into `moveDuration` (~4.8 units/sec) is
**~3.8x faster than the WASD walk speed (1.25 units/sec)** — click-to-walk
reads as a deliberate "fast travel," not a real-time walk pace. Turn rate
is ~2.2 rad/sec for both turn phases, each individually clamped to
0.18-1.25s so neither a tiny nudge nor a huge cross-room turn feels wrong.

Per-frame tween application (each phase gets its own **smoothstep**
easing, `k = q*q*(3-2*q)` where `q` is that phase's own 0-1 progress —
NOT one easing curve stretched across the whole journey):
```
tween.t += dt * (1 / journeyDuration)     // advances 0→1 across the WHOLE journey
firstTurnEnd = firstTurnDuration / journeyDuration
moveEnd      = (firstTurnDuration + moveDuration) / journeyDuration
if t < firstTurnEnd:      q = t / firstTurnEnd;                    lerp(yaw/pitch, fromYaw/Pitch → travelYaw/Pitch, smoothstep(q)); position = fromPos (frozen)
elif t < moveEnd:         q = (t - firstTurnEnd) / (moveEnd - firstTurnEnd); yaw/pitch = travelYaw/Pitch (frozen); position = lerp(fromPos → toPos, smoothstep(q))
else:                     q = (t - moveEnd) / (1 - moveEnd);       lerp(yaw/pitch, travelYaw/Pitch → toYaw/Pitch, smoothstep(q)); position = toPos (frozen)
```
A simpler variant (no distinct phases — used for e.g. `aimAtBook`, just
turning to face something without walking) uses a single easeOutCubic:
`k = 1 - (1-t)^3`, applied directly to yaw/pitch/position over the same
kind of duration-clamped tween.

**Where this plugs into our file:** our `onPointerUp` floor-click branch
(`VirtualGalleryRoom.tsx`, search `floorHit` / `clampPosition(floorHit)`)
currently just sets `targetCameraBody`/`targetYaw` once and lets the
existing per-frame lerp (`cameraBody.lerp(targetCameraBody, 0.15)` /
`yaw += (targetYaw-yaw)*0.12` in `render()`) ease toward it continuously
— that's the "single continuous lerp" this whole section says to
replace. Implementing the above means: on a floor click, instead of just
setting targets, construct a `tween` object (or equivalent local state)
with the three phase boundaries and durations computed as above, and
drive `render()`'s camera update from that tween's `t` instead of the
constant-rate lerp, for click-to-walk specifically (WASD/mouse-look can
keep using the existing continuous lerp — this replacement is scoped to
destination travel only, matching the reference exactly).

### B. Item pickup/inspect animation (Phase 2 of the interaction plan)

**The pull animation** (`updateInspectAnim(dt)`): total duration **0.6
seconds**, `easeOutCubic` (`e = 1 - (1-t)^3`), advancing via `t += dt /
0.6`. Two phases split at `e = 0.45` (not a time split — an EASED-PROGRESS
split, so the transition itself is smooth even though the two phases
have different motion):
- **e 0 → 0.45** ("pulling off the shelf"): item mesh lerps from its
  shelf position to an intermediate **waypoint** (a point pulled straight
  out from the shelf, before it starts heading toward center-screen).
  Orientation and scale stay locked at shelf values during this phase —
  the item doesn't grow or turn yet, it just slides straight out.
- **e 0.45 → 1.0** ("settling into view"): item lerps from the waypoint
  to its final held position (screen-center-ish focal point), rotates
  from its shelf orientation to the camera-facing orientation
  (`slerpQuaternions`), and grows from shelf-size to the final on-screen
  inspect size, all simultaneously over this second sub-range.
- On arrival (t=1): for their thin DVD-case items, the case additionally
  "squashes" in depth to reveal the flat cover face (their spine-to-cover
  flip). Our items are already flat cards, so this specific step doesn't
  map over — the two-phase pull-then-settle STRUCTURE is the reusable
  part, not this depth-squash detail.

**Held-item parallax while inspecting** (mouse-follow tilt, EK's earlier
"nice description" / "pick up and rotates" observation): a genuine
**spring-damper simulation** chasing the cursor, not a direct 1:1 mapping
or a simple lerp — comment: *"the held case is a spring chasing a
cursor-driven target, with a velocity kick on fast flicks so the case
swings with the cursor's acceleration (the 'wow' of the inspect view)."*
Exact constants: `INSPECT_STIFF = 100, INSPECT_DAMP = 19` (their own
comment: "near-critically damped: follows fast, barely overshoots"),
`INSPECT_RANGE_YAW = 0.95` radians (max yaw the parallax responds within
— it doesn't chase the cursor infinitely, it's range-limited). Formula,
run every frame while an item is held:
```
damp = exp(-INSPECT_DAMP * dt)
velocity = (velocity + (targetAngle - currentAngle) * INSPECT_STIFF * dt) * damp
currentAngle += velocity * dt
```
This is a standard semi-implicit spring-damper — same shape for both yaw
and pitch, each with their own velocity/target/current triplet. This is
almost certainly want gives their "pick up and rotates" its expensive,
tactile feel — worth implementing exactly, not approximating with a
plain lerp, since a lerp reads noticeably stiffer/cheaper than a real
spring for this kind of cursor-follow interaction.

**Where this plugs into our file:** this is entirely new state/behavior
— nothing in `VirtualGalleryRoom.tsx` currently lifts an item off the
shelf at all (`onPointerUp`'s item-hit branch only moves the CAMERA to
face the item in place, per the existing "Selected Piece" click-to-focus
flow — see the file's own `standDistance`/`focusCamera` logic in that
branch). Building this means: on item click, instead of (or in addition
to) moving the camera, animate the ITEM mesh itself using the two-phase
pull above, then on `pointermove` while an item is "held," drive its
tilt via the spring formula above, and on drag (reusing the existing
`isDragging`/`didDrag` tracking from `onPointerDown`/`onPointerMove`)
rotate it fully to reveal `imageBackUrl` past a rotation threshold — this
last part (front/back swap point) was already scoped in the original
2026-08-20 interaction plan further below and doesn't need re-deriving.

### C. Hero positioning (EK's older, still-open "not centered/eye-level"
complaint) — no external research needed here, this is a room-geometry
constraint, not a behavior to reverse-engineer:

Hero's 3 feature slots sit at `y=5.96` (`buildWallPositions`, the
`allHeroSlots` array) specifically because that's the only gap that
existed between the (old) top shelf row and the wall rail above it — see
that array's own comment for the full "huge box" bug history. Since then,
`SHELF_ROW_Y`'s top row is still `4.72` (unchanged through every
correction today) and items on it now have real headroom (fix #1 above),
so the geometry hasn't shifted enough to free up a lower gap for Hero on
its own. Bringing Hero down toward actual eye level (rather than
"whatever gap happens to exist above the shelf grid") likely means either
(a) giving Hero its own dedicated wall real estate that ISN'T sandwiched
between the shelf grid and the rail — e.g. reserving the CENTER of the
back wall at eye height and routing normal shelf items around it instead
of stacking Hero above them, or (b) accepting Hero sits above the grid as
now but pulling it down as close to the top shelf row's clearance as
geometry allows and no further. This needs an actual layout decision from
EK (which tradeoff), not just a number — flag it back rather than picking
one silently, same principle as every other fix today.

---

## ⚠⚠⚠ CORRECTION, 2026-08-21 LATE — the eye-height fix below (item #3)
was WRONG and has been REVERTED. Read this before touching eyeHeight or
SHELF_ROW_Y again.

EK reported the "live-verified" fix still felt broken — "I feel like a 5
year old kid." Root cause: the entire `3.6 → 1.7` eyeHeight change was
based on assuming this room's units are 1:1 meters, which was NEVER
actually verified against anything in the room. Cross-checked against the
one real-world anchor that exists in the baked geometry — the entrance
door frame, 4.95 units tall (`add_standard_door()` in the generator
script). A real grand-entrance door runs ~7-9 feet, putting 1 unit at
roughly **0.43-0.55m, not 1m**. Redone with that scale: the ORIGINAL 3.6
works out to ~5'1"-5'7" (normal adult), and the "fix" of 1.7 works out to
~2'4"-3'0" (a toddler) — the opposite of the intended effect.

**Current, correct state:**
- `eyeHeight` reverted to `3.6` (its original value).
- `SHELF_ROW_Y` reverted to `[4.72, 3.47, 2.22]` — the ORIGINAL top 3 rows
  from the pre-session `[4.72, 3.47, 2.22, 0.97]` table, with ONLY the
  genuinely-too-low bottom row (`0.97`) dropped. Two earlier attempts
  wrongly reshuffled the whole band around the bad 1.7 number instead of
  just removing the one bad row — both reverted.
- `scripts/generate-gallery-room-models.py`'s `shelf_y` matches
  (`[4.72, 3.47, 2.22]`), GLBs regenerated a third time and re-verified
  byte-level (see technique below) — final baked values confirmed
  `[0, 4.72, -11.62]`, `[0, 3.47, -11.62]`, `[0, 2.22, -11.62]` in all
  three files. `ROOM_MODEL_URLS` cache-bust bumped to
  `eyeheight-revert-2026-08-21c`.
- `tsc`/`eslint`/`npm run build` all clean after the revert.

**What's NOT confirmed:** whether this actually resolves EK's complaint.
The door-height math is solid, but EK hasn't seen this specific version
yet as of this note — don't claim it's fixed until they confirm. If it's
STILL wrong after this, the eyeHeight number probably isn't the real
issue at all (see EK's own words below).

**The bigger, still-completely-untouched issue:** EK, verbatim: "You
never change the walking pattern like the other app... literally nothing
good has happened." This is telling us the core disappointment isn't
shelf/eye-height numbers — it's that the actual MOVEMENT FEEL (pacing,
camera behavior while walking, acceleration/deceleration, possibly camera
bob or FOV behavior while moving) still doesn't resemble
bingebrowse.net's, and nothing this session has touched that. Do NOT
attempt another numeric guess at this — it needs the same kind of direct
source-code investigation that worked for the image-size and room-scale
questions (fetch their bundle, grep for the actual movement/update
function, read the real acceleration/easing values) before changing
anything. This is the most likely next real ask.

---

## ⚠⚠ SESSION STATE as of 2026-08-21 (evening pass) — SUPERSEDED BY THE
CORRECTION ABOVE for eyeHeight/SHELF_ROW_Y specifically — kept for
everything else in this block, which is still accurate and still done.

**Everything below is DONE and LIVE-VERIFIED** — not just `tsc`/`eslint`/
`build` clean, but actually seen rendering real data. EK's own dev-server
login had blocked browser verification all session; broke through it by
using the `claude-in-chrome` MCP (EK's real, already-authenticated Chrome,
not the sandboxed Browser pane) against a real `npm run build` + `npm run
start` production server — sidesteps both the login wall AND a Turbopack
dev-route flake that was intermittently 404/500-ing `/museum/virtual-room`
(unrelated to this session's edits — a known flaky pattern, see tooling
note further down). Screenshotted the actual room with EK's own 12-item
"Scratch room" data, walked it with click-to-walk, and opened the actual
`/museum/virtual-room/guest` route.

**1. Item texture rework** (`drawItemTexture`): photo fills ~86% of the
object's own canvas (was ~49%), fit-inside not cropped (a crop chopped
real content off graded-slab photos — EK caught this live, reverted same
round), zero baked-in title/price text (already in the old "Selected
Piece" panel, since removed — see #4).

**2. `MIN_ITEM_SCALE = 0.78` floor**: every non-hero item placement —
Store, Salon, Hero's supporting items, Vault's front-wall row. Display-
case items alone stay smaller (0.58, physically capped by the case's
baked glass size, 1.3×1.0 units — bigger clips through the glass).

**3. Eye height + shelf rows — the "giant in the room" fix, corrected
twice, now right.** EK: "you made the human inside the room much larger,
that's why items feel small and it feels cramped at once" — confirmed
correct. `eyeHeight`: `3.6` (~11'10" if 1 unit ≈ 1m) → `1.7` (~5'7", a
real adult eye height — explicitly NOT bingebrowse.net's own deliberately
-lowered `1.30`/~4'3" "chest-height browse" — EK does not want that
cramped-store feel, wants correct human perspective in the SAME grand
room, not a smaller one). `SHELF_ROW_Y`: first pass kept 4 rows shifted
down to `[3.95, 2.7, 1.45, 0.2]` — wrong, the bottom row (item-Y ~0.85)
was exactly the near-floor row EK explicitly said not to copy from the
reference ("I don't want a row on the floor like they do"). **Corrected
to 3 rows: `[2.95, 1.7, 0.45]`** — bottom row (item-Y ~1.1) sits at a real
hip-height shelf, clearly off the floor; whole band centers much closer
to the 1.7 eye height with one fewer row to fit. `wallGridPosition`'s row/
depth math was hardcoded to assume exactly 4 rows (`% 4`, `/ 4`) — changed
to derive from `SHELF_ROW_Y.length` so a future row-count change can't
silently desync again the way this one almost did.
- **Duplicated in `scripts/generate-gallery-room-models.py`** (`shelf_y`,
  in `add_wall_panels()`) for the baked GLB shelf-board mesh in vault/
  whitebox/arcade — kept in sync, regenerated TWICE (once for each shelf-
  row correction) via `"C:\Program Files\Blender Foundation\Blender
  5.2\blender.exe" --background --python
  scripts/generate-gallery-room-models.py -- vault whitebox arcade`, run
  from the worktree root. **Verified directly both times** — parsed each
  `.glb`'s JSON chunk (byte offset 12 = JSON length) and read
  `back_shelf_0..2` translations back out: final values are
  `[0, 2.95, -11.62]`, `[0, 1.70, -11.62]`, `[0, 0.45, -11.62]` in all
  three files, matching the JS exactly. `ROOM_MODEL_URLS` cache-bust
  bumped to `3row-2026-08-21b`. Blue unaffected (shell-only, no GLB,
  reads the JS constant directly).
- **Live-confirmed:** walked the actual room via click-to-walk — ceiling,
  all 3 shelf rows, and floor all sit comfortably in one natural camera
  frame with no extreme up/down tilt and nothing hugging the floor. Real
  photo items rendered correctly on the shelves.

**4. Removed the bottom move/rotate control pad (`FloorMoveControls`) and
the "Selected Piece" info bar** — EK: "I said remove both of these a long
time ago and they are still here" (a request from earlier in the session
that got missed). Deleted both entirely, not just from guest view — the
whole component, its `sendMoveCommand`/`onMoveCommand`/`"vltd-room-move"`
event-dispatch plumbing (now unreferenced by anything), the now-dead
`selectedItem` derived value, and the now-unused `RotateCcw`/`RotateCw`/
`ChevronLeft`/`ChevronRight` icon imports. Click-to-walk + drag-look are
now the only navigation, matching the reference site.

**5. Guest view**: `<VirtualGalleryRoom guest />` prop, route at
`/museum/virtual-room/guest`, full-bleed below the header (no builder
sidebar/toolbar), reachable via a "Guest" button in the builder's Virtual
Room card. `NavShell.tsx` bypasses `BottomNav`/`PullToRefresh` for that
route. **Bug found and fixed same round:** landing in map/overview mode
had NO way back into the room at all (the "Exit" button only existed
going room→map, nothing went map→room) — worst in guest view where
there's no sidebar/Rooms-dropdown fallback. Added a "Back to Room" button
in the same top-left overlay slot when `viewMode === "overview"`.
Live-confirmed: guest route loads full-bleed, Exit→map→Back to Room→room
round-trip all work.

**Still open, unrelated to this pass, don't conflate:** Hero's 3 dedicated
feature slots sit at `y=5.96`, clearing the new top shelf row but still
well above the 1.7 eye height — EK's earlier "hero is way up high, not
centered" complaint is unresolved, flagged in its own comment in
`buildWallPositions`. Also: even at 3 rows, the top row still needs a
mild upward glance (~1.9 above eye level) — better than 4 rows' ~2.9, not
literally zero; a real tradeoff of legibility-sized items in this room,
named to EK, not hidden.

**Tooling note:** `/museum/virtual-room` intermittently 404'd or 500'd on
the Turbopack DEV server this round, unrelated to any code change —
symptoms matched a known flaky pattern already noted below (route
manifest not picking up a new file/subfolder cleanly). Deleting `.next`
and restarting sometimes fixed it, sometimes didn't; **the reliable fix
was `npm run build && npm run start`** — a real production server, immune
to dev-route flakiness, which is what actually got used for the live
verification above.

---

## ⚠ SESSION STATE as of 2026-08-20, latest pass — read this block first,
it supersedes specific numbers further down this section that are now
stale (kept below for the reasoning trail, not as current values).

**Confirmed good by EK, don't re-touch without being asked:**
- Vault — look and materials confirmed good. Do not change `roomStyle
  === "vault"` branches (or "blue", which mirrors vault) without an
  explicit ask.
- White room lighting/contrast — EK confirmed "overall looks good" after
  two rounds of darkening trim/floor + cutting exposure/hemi/spot/point
  light values specifically for whitebox. `toneMappingExposure = 0.68`,
  hemisphere `1.5`, key spotlight `1.7`, warm point light `0.35` (all
  whitebox-specific, in `VirtualGalleryRoom.tsx`'s big mount effect) —
  untouched, don't re-touch without being asked. **Shelf/floor color
  warmed to walnut-brown 2026-08-22** (see the dated section right after
  the rules block above) — trim base now `(0.34, 0.21, 0.12)`, floor
  tones now `(0.52,0.33,0.17)/(0.60,0.38,0.20)/(0.38,0.22,0.11)/
  (0.64,0.42,0.22)`, GLB regenerated and live-verified. This was EK's
  last open ask on White — nothing else queued for this room.
- Corner-trim gap — fixed via a solid corner post (not fragile width-
  matching), verified with a direct Blender render. Confirmed via EK's own
  screenshot to no longer show as a black gap/hole.
- Glass transparency (was "whited out," worst in White) — real bug, not
  lighting: `make_mat()` in the generator script wasn't setting the
  Principled BSDF's Alpha socket, so every "glass" material exported fully
  opaque regardless of the alpha specified in Python. Fixed, confirmed by
  reading the exported material JSON, confirmed live by EK's screenshot
  showing genuinely transparent case glass.
- Display-case items were floating 0.13 units ABOVE the case's own glass
  cap (resting on top of the closed case, not inside it) — fixed, moved to
  y=0.85, also made double-sided.

**In progress right now — Store/Salon/Hero layout, EK's direct ask:**
EK: "I don't really see much of a difference between Store, Salon and
Hero... the names don't make sense," then after a first attempt: "for
hero... now its a huge box, which looks really bad" and "Salon and store
still look the same to me... [smaller items] make them way too hard to
see." Two real bugs found and being fixed:
1. **Hero's "huge box" bug**: the wall-mounted item frame mesh
   (`VirtualGalleryRoom.tsx`, the `frame` BoxGeometry right after the card
   `PlaneGeometry`) stretches its own depth to reach the actual wall,
   assuming items sit close to it (`frameDepth = wallGap - frontOffset +
   backOverlap`). The first Hero redesign positioned the 3 feature items
   0.55–2.45 units off their walls for "presence" — with that much gap,
   frameDepth blew up to as much as ~2.5 units, producing an actual box,
   and because that box's depth spans back to the wall, it occupies the
   same space as the shelf boards mounted there (EK's earlier "rails
   crossing the picture" observation on the back-wall hero was the same
   root cause). **Fix in progress:** hero items moved back to flush
   wall-mount positions (z=-11.78 back, x=±10.22 sides, matching how
   normal items sit) and repositioned to y=5.96 — dedicated headroom
   between the top shelf row (y=4.72) and the top wall rail (y=7.2), so
   nothing crosses the frame at all. Scale dropped from 1.7 to 1.2 to fit
   that gap. **NOT YET DONE:** the three hero spotlights (added in the
   previous pass, aimed at the OLD y=3.85 / z=-9.55/-3.2 / x=∓9.95
   positions) still need their target coordinates updated to match — until
   that's fixed the lights point at empty space, not the relocated items.
2. **Salon/Store contrast**: original attempt only shrank Salon's scale
   (0.48) with tighter spacing (1.55 step) — with few actual items in a
   real collection, tighter spacing along the wall barely shows (not
   enough items to fill even one row), so shrinking was the only visible
   change, and it just made items hard to see rather than reading as
   "densely packed." Rebalanced: Salon's scale brought back up to 0.58
   (still smaller than Store, but legible) with the tight 1.5 step kept;
   Store pushed the OTHER direction — bigger (0.78 side scale, up from
   0.66) and much more spread out (3.0 step, up from 2.35) — so the
   contrast comes from both ends instead of Salon alone trying to look
   different. This part is done and should be visually distinct now.

**Plan / next steps for whoever picks this up (or continues right now):**
1. Fix the hero spotlight target coordinates (see above — mechanical,
   just needs the same y=5.96/z=-11.78/x=±10.22 values the item positions
   already use).
2. `npx tsc --noEmit`, `npx eslint`, `npm run build` — all clean before
   committing (has been the pattern all session, keep it up).
3. Commit + push to `claude/museum-map-doorways`. No GLB regeneration
   needed for this round — it's pure `VirtualGalleryRoom.tsx` item-
   placement/lighting logic, not baked geometry.
4. Ask EK to check Hero (all 3 walls, confirm no box/crossing-rails) and
   Salon vs. Store (confirm they now read as visibly different) live —
   this session's browser screenshot tool has been unreliable for direct
   verification (see tooling note further down); EK's own screenshots are
   the working feedback loop right now.
5. ~~Still open: EK's ask that White's shelf/floor color lean closer to
   the Blender reference render's warmer walnut tone.~~ **Done
   2026-08-22** — see the dated section right after the rules block.

---

## 📋 REFERENCE PLAN — interaction/navigation upgrade (2026-08-20)

**Not started. Documented here first per EK's explicit ask, before any
building.** EK pointed to `https://bingebrowse.net` (a live, unrelated
product — "your streaming services as a 3D video store") as a reference
for how the room should *feel to move through and interact with* —
**explicitly not** a request to copy its theme/walls/colors ("I'm not
saying to change our format and walls, but this flows and moves better").
I actually walked through the live site (Browser pane) to capture this
accurately rather than go on a description alone.

### What EK wants carried over (interaction patterns, not visuals)

**1. Click-to-walk floor navigation ("the stepping squares").** Clicking a
distant shelf section highlights a destination zone on the floor (a
translucent purple outline of the walkable area) with a tooltip ("Click to
walk to CULT CLASSICS BAY"); clicking it smoothly walks the camera there
and lines it up facing the shelf. This is a genuinely new feature for us —
we currently only have manual drag-look + directional move buttons, no
point-and-click destination navigation at all.

**2. Item pickup/inspect, not just a camera nudge.** This is the big one —
EK: "do you see how the item pick up and rotates, has a nice description."
Clicking an item on the shelf does NOT just move the camera to face it in
place. It:
- Lifts the item off the shelf and floats it centered on screen, at a
  slight 3D angle showing real depth (cover + spine visible).
- Responds to mouse movement with a subtle tilt (parallax).
- **Drag rotates it fully around** — shown UI hint: "hold + drag to turn
  it around" — this is how you see the BACK of the item, not a separate
  toggle/button.
- Click again (hint: "click to put it back") returns it to the shelf.
- While lifted, side panels appear: left = synopsis/description +
  metadata table (year, runtime, age guide, country, genre, a flavor
  "rental number"); right = action buttons (stream/watch-trailer links,
  add-to-list); bottom = title card (platform icon, title, byline, year,
  rating, share icon). Left/right arrows let you browse to the next/prev
  item on the same shelf without backing out to the wall view first.

**3. Item density / room scale.** BingeBrowse packs a large catalog edge-
to-edge on the shelves and the room reads as human-scaled (ceiling height,
aisle width, shelf depth all feel walkable/real) — EK: "the size of the
room, the height, it all feels real." A personal vault will always have
far fewer items than a video store's full catalog, so exact packing
density isn't a fair 1:1 target, but "items read as legible and well-
proportioned, room feels like a real space" carries over regardless of
count.

### How this maps onto what we already have

- **We already have click-to-focus** (`onPointerUp`'s raycast handling,
  `VirtualGalleryRoom.tsx`) — clicking an item moves the camera to face it
  level-on. That's the foundation for #2 above, but it stops at "camera
  moves," it doesn't lift/rotate the item or show a rich panel.
- **We already have a detail panel** — `selectedItem` renders a "Selected
  Piece" card (image, title, value, universe) — but it's a sidebar element
  in the regular page layout, not an overlay tied to the 3D view. Moving
  this into an in-scene overlay near the lifted item is a much smaller
  lift than building the panel from scratch.
- **Front/back images and description already exist on the data model** —
  confirmed in `src/lib/vaultModel.ts`: `imageFrontUrl`, `imageBackUrl`,
  `subtitle`, `notes` are all real fields on `VaultItem` today. EK's own
  point: "this might not work for every item, but it should with front and
  back images and the description is already there for them to fill out"
  — i.e., items with both images get the full rotate-to-see-back
  treatment; items with only a front image can still lift/tilt, just
  without a meaningful "back" to rotate to.
- **Click-to-walk floor navigation is genuinely new** — no existing
  equivalent, would need its own build (raycasting the floor plane,
  computing a walkable-zone highlight, animating the camera to the
  clicked destination).

### Adjacent idea EK floated, capture only — not scoped

"Could also work for a virtual comic and card store, browse, pick packs,
buy next week comics or book, toys etc." — a bigger product direction
(an actual storefront/commerce experience built on this same 3D
interaction model, not just a personal vault viewer). Noted for whoever
picks up product direction later; no design or scope work done on this
yet, purely captured as a "the interaction model could extend beyond just
viewing your own vault" idea.

### Suggested phasing (not yet agreed with EK — propose, don't assume)

1. Move the existing "Selected Piece" info out of the sidebar into an
   in-3D overlay tied to the clicked item (small, reuses data already
   flowing today).
2. Add the lift-off-shelf + tilt-with-mouse + drag-to-rotate interaction
   for the item mesh itself (front image today; back image on rotation
   past 90° for items that have `imageBackUrl`).
3. Click-to-walk floor navigation — the largest, most separable piece;
   could ship independently of #1/#2.

### Room scale — the actual root cause of "images look small" (2026-08-21)

EK called this out directly after the item-size patches weren't enough:
"I mention the ceiling height and size of the room, again nothing." Went
back into the bundle and pulled it — this is a bigger finding than the
item-texture fix, and explains why no amount of item scaling alone would
fully fix legibility.

**BingeBrowse's real room (source-confirmed constants):**
- `RX = 3.65` (half-width) / `RZ = 4.65` (half-depth) → floor is **7.3m ×
  9.3m total** — small, a real single retail-shop footprint.
- `STORE_H = 3.05` — explicitly commented "low commercial ceiling."
- `EYE = 1.30` — comment: "chest/rack-height browse: covers meet the eye
  instead of being surveyed from above." **Deliberately lower than a real
  adult's eye height** so shelf art sits right at eye level, not above it.
- Movement clamp: `CLAMP = { xmin: -RX+0.42, xmax: RX-0.42, zmin:
  -RZ+0.46, zmax: RZ-0.32 }` → the camera can get within **~0.42-0.46m**
  of any wall. Genuinely nose-to-shelf close.
- `GONDOLA_ROW_PITCH = 2.30` — aisle spacing between gondola rows.

**Ours, for comparison:** `eyeHeight = 3.6` (our own code) — more than
**2.7x** their deliberately-lowered eye height, and taller than a real
adult even without the "lowered for legibility" trick. Room footprint
(back wall z=-11.78, side walls x=±10.22) is roughly **20m × 17m** —
call it 2-3x theirs in every linear dimension. `clampPosition` keeps the
camera at least **~2.7-2.8 units** from any wall — about **6x** their
minimum approach distance. Camera FOV is fixed at 47°, no dynamic
narrowing like their 75°→58° "settled" zoom.

**Why this matters more than item scale:** all three gaps (bigger room,
taller eye height, farther minimum approach) compound multiplicatively —
each one alone shrinks everything on the walls, and there are three of
them stacked. The `MIN_ITEM_SCALE` fix (below) raises the item's own
world-size, but it's fighting a room/camera setup that's fundamentally
built at 2-3x the scale of the reference the legibility target came from.

**This is a real creative-direction fork, not a bug fix — flagged, not
decided:** our room was deliberately built "grand hall / museum" scale
earlier this session (tall ceilings, wide floor) as EK's own explicit
direction away from a cramped video-game feel. Shrinking the room and
eye height to BingeBrowse's intimate proportions would directly fix
legibility but is a real aesthetic reversal of that earlier call, and
touches baked GLB geometry (regen required, and the room's baked
geometry includes shared code paths — see "don't touch vault" above).
**Needs EK's explicit direction before any room/eye-height/clamp change
is made** — not something to patch unilaterally after the vault incident.
A non-destructive middle path exists and is worth naming: keep the room
grand, but let the camera clamp get much closer to a wall specifically
while an item is in focus/inspect (mirroring their FOV-narrowing trick)
without touching the baked room geometry at all.

### Click-to-walk floor navigation — BUILT (2026-08-21)

No longer just documented — implemented in `onPointerUp`'s `else` branch
(fires when a click hits neither an item nor a doorway): raycasts the
click against a `y=0` floor plane, clamps the hit point through the same
`clampPosition` every other camera move already respects, sets
`targetCameraBody.x/z` and a `targetYaw` that faces whichever wall
(back/left/right) the destination is nearest to, and lets the existing
per-frame lerp in `render()` carry the camera there — no new animation
system, matches BingeBrowse's own confirmed UX exactly: their hint text
reads "Click a shelf area to move · Click a nearby film to inspect it" —
a single click, not a hover-then-confirm, which is why this reuses the
same `didDrag` gate every other click here already used to tell a tap
from a look-drag, instead of a separate two-step confirm state.
**Not yet visually verified live** — `/museum/virtual-room` is behind
EK's login; verified via `tsc`/`eslint`/`build` only.

### Item pop-up / lift-and-rotate inspect — still NOT built

This is Phase 2 from the plan below (lift off shelf, tilt-with-mouse,
drag-to-rotate to reveal `imageBackUrl`, side info panels). Genuinely
not started — don't imply otherwise. The click-to-walk fallback above
occupies the `else` branch of the SAME `onPointerUp` handler where this
would eventually also need to branch in (item click → lift, not just
camera-refocus, once built).

### Confirmed tech stack (2026-08-20, verified live via Browser pane)

**BingeBrowse runs on vanilla Three.js — same core library we already
use.** Verified directly, not assumed:
- Top-level `bingebrowse.net` page has no canvas/WebGL of its own — the 3D
  store is embedded via `<iframe id="store-frame" src="https://
  bingebrowse.net/closet/index-bingebrowse.html?embed=1&roomv=br9&cc=US&
  sr=US">`. Had to navigate directly into that iframe URL to inspect it.
- Inside the iframe: two canvases — `ov-logo3d` (394×246, a small 3D logo
  render) and an unnamed 365×910 canvas (the main room view). The main
  canvas's context is `canvas.getContext('webgl2')`, confirmed via
  `gl.getParameter(gl.VERSION)` → `"WebGL 2.0 (OpenGL ES 3.0 Chromium)"`.
- Fetched the main bundle (`main-bingebrowse.deploy-b82c57b6bb23.js`,
  ~775K chars) as text and grepped it directly: contains the literal
  strings `"THREE.WebGLRenderer"` and `"PerspectiveCamera"`. **No
  `@react-three`/`r3f` markers anywhere** — this rules out React Three
  Fiber; it's Three.js used directly (imperative API), the same pattern
  `VirtualGalleryRoom.tsx` already uses, not a declarative React wrapper.
- Nothing is exposed on `window` (`THREE`, `BABYLON`, `PIXI` all
  `undefined` at the top level) — expected for a production Vercel bundle,
  tree-shaken/scoped inside the bundle closure, not evidence of a
  different engine.
- Script bundle naming (`<name>.deploy-<hash>.js?dpl=dpl_<id>`) matches
  Vercel's deployment-artifact convention — separate bundles per concern:
  `main-bingebrowse...js` (app/render logic), several
  `catalog-vhs-2005*.js` files (catalog/content data, loaded separately
  from render code), `streaming-commerce.js`, `streaming-trailers.js`,
  `blockbuster-trailers.js`, `filters.js`, `lists.js`, `palette-lab.js`.
  Read as: the 3D shelf-browsing UI and the "what's on the shelf" data are
  intentionally decoupled bundles, not one monolith.

**What this means for us:** nothing about what EK saw on BingeBrowse
requires a new library, a framework swap, or a rewrite. Item pickup/
rotation, floor raycasting for click-to-walk, and HTML/CSS overlay panels
on top of a WebGL canvas are all things vanilla Three.js does natively —
`VirtualGalleryRoom.tsx` already has a raycaster, a render loop, and
DOM-overlay panels rendered alongside the canvas (see below). This is an
extension of the existing file's patterns, not new infrastructure.

### Implementation-ready detail per phase (file/line references, 2026-08-20)

All line numbers below are from `VirtualGalleryRoom.tsx` as of this
session — re-grep the anchor strings if they've drifted (`function
onPointerUp`, `function moveCamera`, `Selected Piece`, etc.) since exact
line numbers shift as the file is edited.

**Existing scene-loop primitives to hook into (don't rebuild these):**
- `const raycaster = new THREE.Raycaster();` and `const pointer = new
  THREE.Vector2();` (~line 1758) — already set up once per mount effect,
  reused inside `onPointerUp`.
- `let yaw`, `pitch`, `targetYaw`, `targetPitch` (~1772-1775) — smoothed
  camera look direction. `cameraBody`/`targetCameraBody` (~1777-1778) —
  smoothed camera position, lerped each frame in `render()` (~1843,
  `cameraBody.lerp(targetCameraBody, 0.15)`, `yaw +=
  (targetYaw-yaw)*0.12`). Any camera-move animation (walk-to-point,
  focus-on-item) works by setting `targetCameraBody`/`targetYaw`/
  `targetPitch` and letting the existing per-frame lerp ease into it —
  don't hand-roll a separate tween system, this one's already there and
  already smooth.
- `function clampPosition(position)` (~1795) — hard bounds `x: [-7.5,
  7.5]`, `z: [-9, 4.72]`. Any new destination (click-to-walk target,
  item-focus position) MUST go through this or the equivalent room-bounds
  logic, or the camera can walk into/through a wall.
- `function moveCamera(command, amount)` (~1814) — forward/back/left/
  right/turn-left/turn-right, all relative to `facingDirection()`/
  `strafeDirection()` (~1806-1812, yaw-based unit vectors). Reference
  implementation for "move camera smoothly toward a computed target."
- `function onPointerUp(event)` (~1878) — **this is where click-to-focus
  already lives and where all 3 phases attach.** Current flow: build
  `pointer` from click coords → `raycaster.setFromCamera(pointer, camera)`
  → `raycaster.intersectObjects([...meshesRef.current,
  ...doorwayMeshesRef.current], false)[0]` → branches on
  `hit.object.userData.doorwayTarget` (room navigation) vs.
  `hit.object.userData.itemId` (item focus, ~1898-1929). The item-focus
  branch already computes a `standDistance`/`focusCamera` position and
  sets `targetCameraBody`/`targetYaw`/`targetPitch` — this is the exact
  spot phase 2's "lift and rotate" replaces/extends, and the pattern
  (raycast → branch on `userData` → drive camera state) is exactly what
  phase 3's floor click-to-walk reuses against a new floor-plane target
  instead of a mesh.
- `meshesRef.current` — the flat array of all clickable item meshes,
  already carries `userData.itemId` and `userData.flat` (display-case vs.
  wall-mounted) per mesh. Item meshes are built in the big mount effect
  (search `new THREE.PlaneGeometry(1.12 * pos.scale` for the item `card`
  mesh, and the `frame` BoxGeometry immediately after it for the
  wall-mount trim). Any new mesh-side interaction (lift animation, rotate
  handle) operates on these same objects — no new mesh registry needed.

**Phase 1 — in-3D overlay panel (smallest, do first):**
- Current "Selected Piece" panel: search `Selected Piece` in
  `VirtualGalleryRoom.tsx` (~2632-2653) — a `selectedItem ?
  (<div>...</div>) : (...)` block rendered in the sidebar's normal
  document flow, using `itemImage(selectedItem)`, `selectedItem.title`,
  `itemSubtitle(selectedItem) || selectedItem.notes ||
  selectedItem.universe`, `formatMoney(selectedItem.currentValue)`,
  `selectedItem.universe || selectedItem.category`. `selectedItem` itself
  is derived state (~866-869): `selectedItems.find(item => item.id ===
  selectedItemId) ?? selectedItems[0]`, and `selectedItemId` is set by
  `onPointerUp`'s `setSelectedItemId(itemId)` call — this wiring already
  exists end to end, only the JSX's *position* needs to change.
- To move it into an overlay: keep the exact same JSX/data, just render it
  as a CSS-positioned `<div>` (`position: absolute`, layered over the
  `<canvas>` inside the same relatively-positioned container the canvas
  mounts into — find where `renderer.domElement` gets appended to
  `container` in the mount effect) instead of inside the sidebar's normal
  flow. Gate its visibility on `selectedItemId` being non-empty AND
  `viewMode === "room"` (don't show it in "overview"/map mode). This is
  pure JSX/CSS relocation, zero new state.

**Phase 2 — lift/tilt/drag-rotate the item mesh:**
- Trigger point: `onPointerUp`'s `hit.object.userData.itemId` branch
  (~1898). Currently this only moves the CAMERA to face the item
  (`focusCamera`/`targetCameraBody`, ~1926-1929). To "lift" the item
  instead (or in addition), animate the item's own mesh — read its
  current `mesh.position`/`mesh.rotation` at click time, tween toward a
  fixed "presentation slot" in front of the camera (e.g. a point computed
  each frame as `camera.position + facingDirection() * 2.2`, offset
  slightly down from screen center) using the same lerp-toward-target
  pattern already used for `cameraBody`/`targetCameraBody` — add a
  `liftedItemMesh` ref + `liftTargetPosition`/`liftTargetRotation`
  Vector3/Euler that get lerped in `render()` alongside the existing
  camera lerp.
- Mouse-parallax tilt: in the existing `onPointerMove` handler
  (~1866-1876, currently only drives `targetYaw`/`targetPitch` for
  camera-look-drag), when an item is lifted, ALSO nudge the lifted mesh's
  `rotation.x`/`rotation.y` by a small fraction of pointer offset from
  screen center — same input, a second small effect, gated on `if
  (liftedItemMesh)`.
- Drag-to-rotate for front/back: reuse `isDragging`/`didDrag`/`startX`/
  `startY` (already tracked, ~1779-1782, ~1859-1876) — when an item is
  lifted, a drag updates the lifted mesh's `rotation.y` directly
  (proportional to `dx`) instead of `targetYaw` (camera look). At
  `rotation.y` crossing `Math.PI/2` (90°, the point where the plane's
  edge-on to the camera and the back would start becoming visible), swap
  the `card` mesh's material `map` texture from `itemImage(item)`
  (front — already exists) to a back-image accessor using
  `item.imageBackUrl` from `src/lib/vaultModel.ts`'s `VaultItem` type
  (confirmed present: `imageFrontUrl?: string` line 64,
  `imageBackUrl?: string` line 65). For items without `imageBackUrl`,
  either clamp rotation short of 90° or show the front texture on both
  sides (EK's own framing: "this might not work for every item... it
  should with front and back images").
- Click again to "put it back": same `onPointerUp` handler — if
  `liftedItemMesh` is already set and the click doesn't hit a NEW item,
  clear it (`liftedItemMesh = null`) and let the mesh lerp back to its
  original shelf `position`/`rotation` (store those on lift so there's a
  return target).
- Left/right arrow to browse same-wall items without backing out: needs a
  "what wall/slot is the current item on, what's next" lookup — the
  slot/wall data already exists per item (`pos.wall`, see
  `wallGridPosition`/`distributeAcrossWalls`), so this is a matter of
  finding the current item's index within its wall's slot list and
  re-triggering the same lift flow on the neighbor, not new geometry.

**Phase 3 — click-to-walk floor navigation (largest, most separable):**
- Needs a floor plane mesh to raycast against distinctly from item/
  doorway meshes — either reuse the existing floor mesh (search
  `add_floor_planks`-equivalent in the room-building code / the shell's
  floor mesh) tagged with its own `userData` marker, or add a thin
  invisible raycast-only plane at y≈0 sized to the room's walkable bounds
  (same `[-7.5,7.5] x [-9,4.72]` bounds as `clampPosition`, ~1795-1799 —
  reuse those exact numbers so the walkable-zone highlight can't ever
  suggest walking somewhere `clampPosition` would then reject).
- In `onPointerUp` (~1878), add a raycast branch against this floor plane
  (alongside the existing item/doorway raycast) — on hit, don't move the
  camera immediately; first show a destination-highlight decal (a flat
  translucent circle/ring mesh, or a CSS-overlay ring projected via
  `camera.project()` from the 3D hit point to screen space) at the hit
  point, matching BingeBrowse's "highlight then click again" two-step
  (hover/first-click = preview, confirm = walk) rather than instant
  teleport, since instant teleport on every incidental floor click would
  make normal look-around dragging accidentally trigger walks — needs a
  deliberate confirm step, not just any floor click.
- The actual walk: same pattern as `moveCamera` — set
  `targetCameraBody` to the clamped destination point (keep
  `y = eyeHeight`, the existing constant ~1763) and let the existing
  per-frame lerp (~1846) carry the camera there smoothly; no new
  animation system needed. Optionally also set `targetYaw` to face the
  nearest wall/shelf at arrival (compute yaw from destination → nearest
  wall's inward normal), matching BingeBrowse's "lines you up" behavior
  EK called out specifically.
- Distinguishing a floor click (walk) from a drag-to-look (camera pan)
  from an item click (focus/lift): the existing `didDrag` flag
  (~1780, ~1870) already solves "was this a click or a drag" — floor-walk
  should only fire on `!didDrag` clicks that hit the floor plane and miss
  every item/doorway mesh first (raycast items/doorways first, as today,
  then floor as a fallback branch).

---

## ⚠ CURRENT ARCHITECTURE (2026-08-20+) — read this before the "Big update
2026-08-14/15" section below, which describes an approach that's been
**replaced**. Kept for history, not current.

**The room is no longer hand-coded Three.js geometry. It's baked GLB models.**
EK's explicit call, after seeing both side by side: the old hand-coded
Three.js room (procedurally-built walls/shelves/floor, all colored via JS
material properties) read as "fake, 1980s-video-game." A separate AI
session (not this chat) built a parallel pipeline that bakes each room in
Blender and loads the result as a `.glb` — that's the one EK wants. Do not
revert to hand-coding geometry as "the fix" for a look problem; the fix
lives in either the Blender/generator script or the material-override code
that recolors the loaded GLB.

**Terms, so a fresh chat doesn't have to reverse-engineer them:**
- **"Shell" / "fallback shell"** — the OLD hand-coded room, still fully
  present in `VirtualGalleryRoom.tsx` (walls, floor planks, shelves,
  baseboards, the vault door). It's built on every mount, added to a
  `fallbackShell` THREE.Group, and tracked mesh-by-mesh in a `shellObjects[]`
  array via an `addShell()` helper. **It is not dead code** — see "blue"
  below.
- **"GLB model" / "baked model"** — the real room, generated in Blender by
  `scripts/generate-gallery-room-models.py` (run *inside* Blender via `bpy`,
  not a standalone Python script — `blender --background --python
  scripts/generate-gallery-room-models.py -- vault whitebox arcade`), output
  to `public/models/gallery-rooms/{style}-room.glb`. Loaded client-side via
  `GLTFLoader` inside the big mount effect.
- **The swap:** on mount, the shell renders immediately (it's cheap, no
  network fetch). The GLTFLoader fetch+parse for the matching `.glb` takes
  roughly a second; when it resolves, every `shellObjects[]` mesh gets
  `.visible = false` and the loaded GLB model is added on top. **This is why
  refreshing the room shows the shell for about a second before the GLB
  "takes over."** If the GLB fetch errors, `fallbackShell.visible = true` is
  the safety net (shell stays up instead of an empty room).
- **`RoomStyle`** = `"vault" | "whitebox" | "arcade" | "blue"`. First three
  each have a `.glb` and get the swap above. **`"blue"` is new (2026-08-20)
  — it has no GLB entry in `ROOM_MODEL_URLS` (that constant is now
  `Partial<Record<RoomStyle, string>>`), so the loader gate (`if (!inHub &&
  modelUrl)`) skips it entirely and the shell just stays up permanently.**
  Every shell-coloring conditional that used to check only
  `roomStyle === "vault"` now checks `(roomStyle === "vault" || roomStyle
  === "blue")` — "blue" is deliberately just "vault, but shell-only,
  forever" — same navy/brass/walnut palette, same hand-coded vault door.
  Selectable from the Room-style `<select>` in the toolbar (was a 3-way
  `Segmented` pill row; changed to a native dropdown to fit a 4th option —
  EK asked for "a drop down with the white room").

**Why "blue" exists at all:** EK's exact words — the shell (the thing that
flashes for ~1 second before being covered) *is* the version they like;
the GLB that replaces it is what read as washed out / "filters on top of
old work." Rather than argue about which one is "correct," both are now
live, selectable options. Don't collapse them back into one without being
asked.

**⚠ DO NOT TOUCH VAULT'S LOOK WITHOUT BEING EXPLICITLY ASKED.** This was
learned the hard way this session: a real, defensible fix (swapping
Three.js's stock `RoomEnvironment` PMREM source, which has its own blue
demo-accent panel, for a neutral one) got built, pushed, and then reverted
in full at EK's direction — not because the reasoning was wrong, but
because EK never asked for vault to be touched at all, and changing it
without asking cost real trust. **Current vault code is confirmed good by
EK as of 2026-08-20 — leave `roomStyle === "vault"` branches alone unless
EK specifically asks for a vault change.** `RoomEnvironment` (the stock,
colorful demo PMREM scene from `three/examples/jsm/environments/
RoomEnvironment.js`) is back in place, unmodified, global to every style.

**White room — fixed, NOT visually verified (see tooling note below):**
Unlike vault, the `whitebox` GLB never had a color-override block at all
(the `if (roomStyle === "vault") { ...material.color.setHex(...)... }`
block only branches for vault — whitebox materials render exactly as
Blender baked them, which on inspection are reasonable warm creams/tans,
not the problem). The actual cause: `renderer.toneMappingExposure` (was
`1.08` for whitebox) and the `HemisphereLight` intensity (was `4.8` for
whitebox) were both tuned in an earlier pass for the *old shell's* material
response, not the GLB's already-bright baked materials (base values ~0.72–
0.9). Stacked with `ACESFilmicToneMapping`, that overexposed the room —
white has far less headroom before clipping to blown-out than vault's dark
navy did, which is why the same tuning read fine on vault and "too white"
on whitebox. Dropped whitebox's exposure to `0.92` (matches vault) and
hemisphere intensity to `2.4` (was `4.8`) — **reasoned from the numbers,
not confirmed by eye. Ask EK to check it.**

**Arcade — reviewed, not touched.** Its GLB's baked material colors (deep
purple-black walls, bronze trim, cyan glass) are coherent and look
intentional for the aesthetic; no evidence of a whitebox-style bug. Nobody
has reported it broken. Left alone.

**Corner-trim gap — real geometry bug, fixed and regenerated.** EK
screenshotted it directly on Arcade/White/Vault: the back wall's horizontal
decorative trim line stopped visibly short of the corner instead of
meeting the side walls' vertical trim. Root cause in
`scripts/generate-gallery-room-models.py`'s `add_wall_panels()`:
`back_panel_rail` was built at width `20.0` (half-width 10.0) while the
side walls' own panel posts sit at x=±10.36 — a 0.36-unit gap on every
style, every corner, since `add_wall_panels()` is shared code (this is why
it showed up on Arcade *and* White *and* Vault, but not Blue — Blue has no
GLB). Fixed to `20.72`, matching exactly where the side posts are —
verified against the regenerated GLB's actual mesh bounds (not eyeballed):
`back_panel_rail` now spans x ∈ [-10.36, 10.36] precisely. Regenerated all
three GLBs via `blender --background --python
scripts/generate-gallery-room-models.py -- vault whitebox arcade` and
bumped `ROOM_MODEL_URLS` cache-busting query params to `corner-trim-fix-1`
so browsers actually fetch the new files instead of a cached old GLB.
**Blender is installed** at `C:\Program Files\Blender Foundation\Blender
5.2\blender.exe` — needed for any future GLB regeneration.

EK also circled item-frame spacing looking uneven on Arcade/White vs. the
clean grid on Blue — **not independently investigated or fixed.** Item
placement (`wallGridPosition`/`distributeAcrossWalls` in
`VirtualGalleryRoom.tsx`) is 100% shared JS code across every style, so if
it looks right on Blue it's mathematically identical on Arcade/White — the
apparent unevenness in those screenshots may just be the corner-gap issue
distracting the eye, or a genuine per-style depth/perspective artifact.
Worth a fresh look with working screenshots before assuming it's fixed by
the corner-trim change alone.

**⚠ Browser screenshot tooling was unreliable/frozen for a long stretch of
this session** — repeated live mutations (material color, camera movement,
tone mapping) produced byte-identical captures across many fresh tabs and
long waits, meaning verification wasn't trustworthy. If you hit the same
thing: don't trust a capture that doesn't change after an obvious action
(camera turn, color swap) — closing every tab and starting a genuinely new
`preview_start` sometimes clears it, but not reliably. When in doubt, ask
EK to look at their own browser rather than trust a stuck automation tab.

---

**Big update, 2026-08-14/15 — a full session on this feature. SUPERSEDED —
describes the hand-coded-geometry approach before the GLB pipeline
existed. Read the section above first. Kept below for historical context
only (the vault-door/shelf-alignment bug-hunting is still accurate
*about the shell*, since the shell is still live code, just not the
primary room anymore).**

**⚠ Branch state — READ FIRST:** all of this work lives on branch
`claude/museum-map-doorways`, pushed to GitHub, **NOT merged to `main`.**
Reason it's not merged yet: EK is still actively iterating (see the open
color/lighting problem below) and didn't want unfinished work auto-deployed
to the live site. If you're a fresh chat picking this up, check out that
branch — `main` does not have any of this.

**⚠ Also: a dedicated git worktree exists specifically because the shared
`C:\Users\EK\VLTD` checkout kept getting switched to `main` by another active
session mid-work, three separate times, silently breaking the museum page
each time (Turbopack resolves `/museum/virtual-room` to the wrong route when
the file's simply missing from whatever branch is checked out).** To avoid a
fourth time: there is now a **separate, isolated worktree** at
`C:\Users\EK\VLTD-museum-doorways`, permanently checked out to
`claude/museum-map-doorways`, with its own `node_modules` and its own dev
server on **port 3010** (not 3000). Do your museum work there, not in the
shared `C:\Users\EK\VLTD` folder. `git worktree list` from either directory
shows all active worktrees.

**What got built/fixed this session (all verified live, not just by
reading code — see each commit message on the branch for exactly how each
one was tested):**
- Map floorplan rebuilt on a real CSS grid — the old absolute-% version had
  real overlapping tiles (Gallery D/E overlapped Main Gallery).
- Side walls now populate proportionally from item #1 (was back-wall-first,
  leaving small rooms with two bare side walls).
- Click-to-focus fixed **twice**: first pass over-corrected into tilting the
  camera up/down to center tall/short items (read as "looking up at" the
  item — EK caught this from a screenshot); second pass fixed it properly by
  matching the camera's own height to the item's height for a true level,
  face-on shot instead of tilting.
- Main Gallery is a real intentional empty "Grand Hall" (not secretly
  opening your biggest room like the first version did).
- Doorways connect rooms with signs — **found and fixed a genuine raycaster
  bug** here: the invisible hit-target planes used `material.visible = false`,
  which makes Three.js skip them for raycasting entirely (not just hide
  them), *and* they were never rotated so they showed their back face to a
  default `FrontSide`-only material. Both fixed (transparent+opacity:0,
  `side: THREE.DoubleSide`). This was the actual reason doorway clicks did
  nothing — verified with a direct `raycaster.intersectObject` call before/
  after (0 hits → hits) before touching anything else.
- Shelf/item vertical alignment unified into one `SHELF_ROW_Y` table (was two
  independently hand-tuned numbers that had drifted apart — items floated
  above their shelf).
- **Full explicit-slot arrangement system** (matches how the exhibition
  builder's shelf slots already work): `selectedIds` is always exactly
  `TOTAL_SLOT_COUNT` (37 = 32 wall slots + 5 display-case slots) long, one
  entry per physical slot, `""` = empty. An "Organize" toggle turns the Items
  panel into a real drag-and-drop grid grouped by wall (Back/Left/Right/
  Display Cases), every slot numbered 1-37 (matches numbered badges that also
  render floating in the actual 3D room during Organize, not just the
  sidebar), drag any piece onto any square — filled or empty — to place it
  exactly there.
- Display cases are real assignable slots now — items render lying flat in
  them instead of wall-mounted, with a different "look down into the case"
  focus shot than wall items get.
- Camera position/framing now persists across an Organize drag (was
  silently resetting to the default spawn on every single item move, which
  is why one drag used to throw you back to the entrance) — entering a
  genuinely different room still correctly resets it.
- Wallpaper save bug fixed — was embedded in the same small JSON blob as
  everything else, so a large image could quietly blow the whole save past
  localStorage's quota and silently drop the ENTIRE draft, not just the
  wallpaper. Now saved under its own key with its own error handling.
  Ceiling no longer inherits the wallpaper texture (it was sharing the
  wall's material).
- Always-visible "Exit" button (top-left) → jumps straight to the campus
  map regardless of which room you're in — added after EK got stuck in the
  Grand Hall with no obvious way out (the only exit was a doorway behind the
  spawn point, easy to not realize is there).
- "Rooms" dropdown (also top-left) → lists every populated universe room by
  name + item count, click one to jump straight there. Added because
  precisely clicking a small 3D archway with a real mouse is inherently
  fiddly — this is a reliable, DOM-click alternative, not a replacement for
  the archways (which do work, verified directly).
- X button to dismiss the Grand Hall's "coming soon" card.
- Room settings panel (Store/Salon/Hero, Vault/White/Arcade, Values,
  Wallpaper) auto-collapses when Organize is on, freeing vertical space so
  the 3D view doesn't get scrolled out of reach — manual collapse toggle too.
- A shallow dim "vestibule" beyond the entrance doorway, because removing
  the old solid black door-fill (so the opening wouldn't read as "closed")
  left it showing flat `scene.background` through the gap with nothing
  beyond — which read as a broken/blank texture, not an open passage.

**⚠ UNRESOLVED — the actual current blocker, EK's words: "all of these
colors are washed out, i don't see any of the inspiration and real colors i
sent you."** This is the real next task, not the stuff above.

Context: EK sent 5 real reference photos partway through this session —
(1) a dark, moodily-spotlit museum hall with pedestal sculptures for the
Grand Hall's own look, (2)-(4) an actual bank-vault-door photo (a real
"Weapons Vault" museum exhibit — thick riveted circular door swung open,
navy walls, plain wood floor) as the reference for the "Vault" room style,
and (5) a bright white classical gallery (the Susquehanna Art Museum —
cream walls with painted panel molding, warm wood/parquet floor, tall
windows) as the reference for the "White" room style. EK's explicit call:
Vault becomes this bank-vault look, White becomes this bright-gallery look,
Grand Hall gets its own dark look independent of whichever style is picked.

**What was actually built, and why EK's right that it doesn't match:** this
whole pass was done by picking hex colors and Three.js material params
(roughness/metalness) purely by reasoning about the reference photos in
text — **no screenshot tool was available this session** (the Browser
pane's screenshot action failed with "pane is not displayed" every time it
was tried, all session, on both the shared checkout and this worktree).
Every visual claim in this file's commit messages before this note was
verified via things that don't need pixels — `raycaster.intersectObject`
hit counts, DOM text/state checks, console-error absence, scene-graph
introspection (mesh counts/colors read back via a temporary
`window.__vltdDebug` hook, then removed). That's solid for confirming
*mechanics* work (doorways navigate, drag-and-drop places items, camera
math is exactly right) but it is **not sufficient for tuning how a
lit 3D scene actually looks** — lighting, fog, material response, and
color all interact in ways a hex value alone doesn't predict. Two rounds of
"pick a hex color close to the photo" have now visibly not worked (EK's
first review: "needs refinement" on a beige/washed White pass; second
review: openly rejected, still washed out, still doesn't match).

**Do not do a third blind color pass.** The next chat working on this
needs an actual way to see the rendered result — screenshots working (try
the Browser pane fresh; it may just have needed to be manually opened on
EK's end), or EK screen-sharing/pasting a fresh screenshot after each
material change, or some other way of closing the loop. Guessing a fourth
set of hex values without seeing them render is very unlikely to land
better than the first two attempts did.

**Where the color logic currently lives, for whoever picks this up:**
`getRoomPalette()` (wall/floor/trim/glow per style) and the inline
`wallMaterial`/`floorMaterial`/`trimMaterial`/`baseboardMaterial`/
`doorSideMaterial`/`ceilingMaterial` construction inside the big
`useEffect` in `VirtualGalleryRoom.tsx` (search for `roomStyle ===
"vault"` / `"whitebox"` / `"arcade"` — every material branches on it).
The Grand Hall's own dark override is the `inHub` boolean, computed once
near the top of that same effect and reused throughout (there was a real
duplicate-`const inHub` bug from an earlier pass in this file's history —
already fixed, don't reintroduce a second declaration).

**Update — 2026-08-16, commit `4b71b77`:** fixed the two concrete geometry
bugs EK flagged with red-circle screenshots ("why is this image floating
and not on wall and why the shelves not just lined up") — separate from
the color issue above, and root-caused precisely rather than guessed, by
reading back real mesh coordinates through the same `window.__vltdDebug`
scene-introspection hook (added, used, then removed again per the pattern
above).
1. **Items floating off the wall.** The wall-mount frame trim was a fixed
   thin box offset a constant 0.045 behind the card, regardless of the
   actual wall's distance. Confirmed against the real wall planes (back
   wall z=-12, left x=-10.5, right x=10.5) that this left a real 0.15-0.2
   unit air gap between the frame and the wall for every wall-mounted item
   — it wasn't a lighting/angle illusion, the frame genuinely never
   touched the wall. Frame depth now stretches to actually meet (and
   embed slightly into) the wall; free-standing "center"/spotlight items
   keep the old small offset since they aren't wall-mounted.
2. **Gapped shelf corners (first pass, later superseded).** Original fix
   added small corner-cap boxes to bridge the sliver at each back corner.
   EK then sent a wider screenshot showing the real problem was bigger:
   **every shelf board — back and both sides — was 0.55 thick centered
   0.245 units clear of the real wall along its ENTIRE length**, not just
   at the corners; wall texture was visible above/behind the board the
   whole way down. Corner caps only patched a few inches of that. Fixed
   properly in a follow-up commit: board depth/width increased to 0.845
   (front face held in place, back face extended to embed 0.05 into the
   actual wall) for all 4 rows, all 3 walls — which also closes the corner
   gap on its own, so the standalone corner-cap boxes were removed as
   redundant.
Both verified by re-querying mesh positions after each fix (frame back
face and every shelf board's back face land exactly at wall + 0.05
embed) — not by eyeballing a screenshot, since none was available this
pass either. **Lesson for next time:** a screenshot that looks like "the
corner is wrong" may actually mean "the whole edge is wrong and the
corner is just where it's most visible" — check the full run, not only
the spot circled.

**Also fixed, same session — vault door didn't match its opening
(asked about 4 times before this, and the first attempt below still
missed):** the entrance passage was always rectangular even in Vault
style, with the round riveted door bolted onto the SIDE wall as pure
decoration — a previous pass's comment explicitly says it gave up
trying to hinge a round door into a square hole.

*First attempt this session:* cut a full CIRCLE hole in the wall
(`THREE.Shape` + `THREE.Path.absarc`, full 360°) and hinge-rotated the
door open via a pivot group. Looked correct on paper (verified the
disc's world position algebraically), but EK sent the actual reference
photo side by side with a screenshot and the gap was real, not a
nitpick: the reference opening is a floor-to-ceiling **arch** (straight
sides, rounded top), not a circle, and the door in the photo stands
**fully clear** off to the side on a heavy hinge column with its whole
face visible — not mid-swing. Redoing the pivot math after the fact
showed the "112° open" rotation still left the disc's footprint
overlapping the hole by ~0.17 units, which is exactly the half-covered
look EK's screenshot showed.

*Second attempt, matches the reference:* wall opening rebuilt as an
actual arch shape (`moveTo`/`lineTo`/`absarc` tracing straight sides up
to y=3.25 then a semicircular top, `archHalfWidth` 1.7) with a riveted
architrave (two posts + a half-torus top + a thicker hinge column)
around it. The door is no longer hinge-rotated in place — it's placed
directly at its open resting position, grounded near the floor beside
the hinge column, with only a slight turn (not a full swing) so the
riveted face stays visible. Placement math guarantees the door's
center-minus-radius never reaches the arch's opening at all (a real
margin, not a near-miss). Verified via raycasting straight through the
wall mesh at five points (arch center, floor level, near the edge, and
two points that should still be solid wall) — confirmed the hole is
genuinely open where it should be and solid everywhere else, not just
visually close. Non-vault styles are untouched, still rectangular.

**Lesson for next time:** when a fix is verified only by math/geometry
reads (no screenshot tool), "the numbers check out" is not the same as
"it matches the reference" — get the actual reference photo next to the
result before calling it done, the way EK's side-by-side did here.

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

### B. Barcode / QR live detection — REBUILT 2026-08-10 as tap-to-scan, native detector + JS fallback. Needs a real-device test.
**STATUS 2026-08-10: rebuilt, not yet device-tested.** Was fully OFF since
2026-08-07 (`ENABLE_LIVE_BARCODE = false`, both camera panels) after ~8 rounds
of the JS/ZXing decode loop (a) never reliably reading a code and (b)
overheating the phone by pinning the CPU continuously for the whole time the
camera was open. EK's own steer at the time: a normal camera app scans without
heating up because it hands the work to the OS, not a JS loop.

**What changed:** new `src/lib/scanners/onDemandBarcodeScan.ts`. Two real fixes,
independent of each other:
1. **Engine** — tries the browser-native `BarcodeDetector` API first
   (`window.BarcodeDetector`, feature-detected at runtime). Where it's
   supported, the OS does the decoding, not JS — near-zero CPU cost. Where
   it isn't, falls back to the existing ZXing JS loop
   (`liveBarcodeReader.ts`). **Checked live on the deployed site 2026-08-10:
   Windows desktop Chrome does NOT have `BarcodeDetector`** (confirmed via
   `'BarcodeDetector' in window` → `false` in a real Chrome-148 browser) —
   per current browser-support data, it's Android Chrome and macOS
   Chrome/Safari only, NOT Windows or iOS. So on EK's iPhone (Safari) and any
   Windows desktop testing, this always runs the JS fallback, same as
   before — the engine choice alone was never going to fix Safari.
2. **On-demand, not always-on** — THIS is what actually fixes the heat/
   battery complaint on every platform, including Safari where the JS engine
   still runs. A new "Scan" button (Glyph icon, both `CameraCapturePanel.tsx`
   and `ScanCapturePanel.tsx`) starts one bounded ~8-second burst per tap;
   nothing decodes at all until it's tapped, and the burst stops itself on a
   match or after 8s ("no code found" message). Total JS-loop runtime per
   session dropped from "however long you spend framing a photo" to one
   short, deliberate window — that's the real fix, independent of which
   decoder is running underneath.

**Also fixed in the same pass, found while auditing the pipeline (not
something EK reported directly, but plausibly the actual explanation for
"wasn't scanning anything but burning up my credits with PSA"):**
`vault/add/page.tsx`'s generic Identify path (`handleIdentifyCurrentScan`,
used whenever `scanType` isn't already pinned to book/comic/graded_card/card)
tried a PSA cert lookup **FIRST** on any bare 7-10 digit barcode decode,
before UPC/book/comic/vinyl ever got a chance. EAN-8 — a completely ordinary
retail barcode format — is exactly 8 digits, so it collided head-on with the
"looks like a PSA cert" heuristic: scanning a normal product could silently
burn a real, metered PSA API call (and overwrite Universe/Category to Sports
Cards) before the correct, free UPC lookup ever ran. Fixed: PSA is now tried
**last**, only after UPC/book/comic/vinyl have all failed, and only for
barcode formats that are structurally plausible for a slab's cert code (QR/
Code128/Code39/DataMatrix/unknown) — UPC/EAN-format codes are excluded
outright since they can never legitimately be a PSA cert, not just
deprioritized.

`tsc --noEmit` / `eslint` / `npm run build` all clean. **Not yet tested on a
real device — please do, this is genuinely new code, not a re-test of the old
broken version:**
- Tap Scan on both the regular Add camera and Quick Add, on your iPhone.
- If you have an Android phone with Chrome, test there too — that's the one
  platform that should get the fast native path.
- Point at a real barcode/QR, confirm it decodes and roughly how fast.
- Do several scan bursts in a row and check the phone doesn't warm up the way
  it did before — this is the main thing that needs confirming.
- Confirm the "no code found" message shows if you let a scan run with
  nothing in frame.
- Ask EK: PSA credit spend should now be visibly lower / not spent on
  everyday product scans at all — worth a spot-check if PSA lookups are used
  again for anything.

**Update, same night, after a third real device test + a deeper fix:** EK
reported the timeout message "disappears too fast" to even screenshot — the
2.5s auto-clear on the "no code found" message was genuinely too fast for a
human to read on a phone. Removed the auto-clear entirely in both camera
panels; the message now just stays up until the next Scan tap (which
already resets it), no timer needed.

More importantly: **swapped the fallback decoder from `@zxing/library`
(unmaintained) to `zxing-wasm`** (WebAssembly build of the actively-
maintained zxing-cpp engine — reported faster AND more accurate on
real-world images). Two different approaches built on the OLD library both
failed on the same clearly-legible QR code tonight (whole-frame decode: 9
tries/6.7s, region-cropped decode: presumably similar) — that's not a tuning
problem, the underlying engine itself is the ceiling. Implementation:
- `src/lib/scanners/zxingWasmSetup.ts` — one-time init pointed at a
  self-hosted `.wasm` binary (`public/zxing_reader.wasm`) instead of the
  library's default CDN fetch. `scripts/copy-zxing-wasm.js` copies it from
  `node_modules` on `npm install` (wired via a new `postinstall` script) so
  a fresh Vercel build always has it; the current copy is also committed
  directly as a belt-and-suspenders safety net for the very first deploy.
- `onDemandBarcodeScan.ts`'s fallback engine now tries 4 crops per tick
  (full frame, center, top band for slab labels, bottom band for retail
  UPCs) via `readBarcodes()`. **If wasm fails to load for any reason, each
  tick falls back to the older, already-proven `scanBarcodeFromVideoFrame`
  JS decoder** instead of the feature going completely dark — worse
  accuracy, but still working. This matters because none of this could be
  verified live before pushing (EK was asleep) — the fallback-within-the-
  fallback is the safety net for that.
- Added `normalizeWasmFormat()` — real, silent-bug-shaped gotcha caught
  before shipping: zxing-wasm's format names ("UPCA", "EAN13") don't use
  the underscored convention the existing `normalizeFormatName()` matches
  on ("UPC_A", "EAN_13"). Without a dedicated mapper, every wasm-decoded
  barcode's format would've silently come back "UNKNOWN" — which would have
  quietly defeated the PSA auto-fire format-exclusion fix from earlier
  tonight for every code read through this new engine (UPC/EAN formats are
  specifically excluded from ever reaching a PSA lookup; "UNKNOWN" isn't
  excluded).
- Camera panels now call `warmupZXingWasm()` on mount (not on first Scan
  tap) so the ~1MB wasm binary is already loading by the time someone taps
  Scan, rather than eating a cold-load delay inside the 8s burst.
- `ScanCapturePanel.tsx`'s `getUserMedia` had **no resolution constraint at
  all** (a real gap, unlike `CameraCapturePanel.tsx`) — aligned it to that
  file's own already-settled `width: {ideal: 1280}` rather than inventing a
  new number. **Deliberately did NOT bump resolution further in either
  file** — `CameraCapturePanel.tsx`'s own comments record two earlier
  rounds of raising it not helping sharpness and even making capture
  slower; no reason to re-litigate that here.

**CONFIRMED WORKING 2026-08-11 morning** — EK's first test after waking up:
the exact same CGC slab that failed twice the night before (whole-frame
decode, then region-cropped decode, both on the old unmaintained library)
now decoded clean on the first try — green "QR code read: 3905790037795"
badge, regular Add's camera. The wasm asset was also independently verified
serving correctly in production before this test (200, `application/wasm`,
byte-exact size match) via a direct fetch from a live browser session, so
both the infrastructure risk (self-hosted binary actually serving on
Vercel) and the accuracy problem (the engine swap itself) are confirmed
resolved, not just "should work."

**Not yet tried, worth a quick check next:**
- The horizontal linear barcode under the QR on that same slab (confirms
  linear/1D formats decode too, not just QR/matrix).
- Quick Add's camera (`ScanCapturePanel.tsx`) — only the regular Add camera
  (`CameraCapturePanel.tsx`) has been tested so far; both go through the
  same `onDemandBarcodeScan.ts`, so this should work, but hasn't been seen.
- A genuine retail UPC/EAN on an ordinary product (this test was a slab
  QR, not a linear retail code).
- Whether it still runs cool over several repeated bursts — heat was the
  ORIGINAL complaint that started this whole rebuild; decode accuracy is
  now confirmed, heat hasn't been re-checked since the engine swap.

PSA lookups are still paused (`ENABLE_PSA_LOOKUP = false`, §B3) — this was
a CGC slab, so this test didn't touch that path. Still needs EK's explicit
go-ahead before flipping it back on.

**Update, same day, after two real device tests:** the "Scanning" banner is
confirmed visible on a real phone (EK sent screenshots showing "Scanning…
(11 tries, 5.0s)" and "(7 tries, 3.1s)") — the earlier "I don't see it even
flicker" report was a genuine UI-visibility gap, now fixed, not a
session-never-ran bug. A first real decode attempt on a CGC-slab QR+barcode
came back "js-fallback, 9 tries in 6.7s" — a real burst, real attempts,
still no match, on a code that was clearly legible on screen. Diagnosed:
the fallback engine was decoding the WHOLE video frame at once (ZXing's
`decodeContinuously`), which loses too much relative resolution on a code
that's small against the full frame -- the exact problem the OLD hand-rolled
region-cropping scanner existed to solve. Swapped the fallback to a new
`startRegionScan()` (still in `onDemandBarcodeScan.ts`) driving the existing
`scanBarcodeFromVideoFrame()` region-crop+upscale+contrast-variant decoder,
still bounded to the same on-demand burst so the heat fix holds. **Not yet
confirmed whether this actually decodes better — that result hasn't come
back in yet.**

**PSA lookups fully PAUSED, EK's explicit request:** while decode accuracy
is being tested, no PSA lookup should spend real quota. Added
`ENABLE_PSA_LOOKUP = false` inside `runPSALookupForCode`
(`vault/add/page.tsx`) — short-circuits before any network call, covers all
three paths that reach it (auto graded_card flow, generic auto-Identify
fallback, manual "Look up" button), shows a clear status message instead of
silently no-oping. **Flip back to `true` once decode reliability is
confirmed** — if a future session sees PSA "not working," check this flag
before assuming something broke.

`BarcodeScanCamera.tsx` (a separate, older always-on scanner used by
`vault/add/page.tsx`'s `isBarcodeScanOpen` state) was found dead/unreachable
while auditing this — nothing in the app ever sets that state to `true`, so
it can never actually open. Flagged as a spawned task, not touched here
(deleting it or wiring a real entry point on the new on-demand system is a
separate, smaller decision for EK). ~~Original notes:~~
EK tested the previous fix live: **still didn't work, on both Quick Add AND
regular Add.** That confirmed the digits-gate bug (real, and still worth
having fixed) wasn't the whole story. Two more real things found:

1. **Quick Add (`ScanCapturePanel.tsx`) never had ANY barcode detection code
   at all** — grepped the file, zero matches. So "either way it doesn't
   work" was literally true for Quick Add: there was no badge to fire,
   period. **Added it tonight**, matching the regular Add camera's badge.
2. **The regular Add camera's mechanism itself was the deeper problem.**
   `CameraCapturePanel.tsx`/`BarcodeScanCamera.tsx` both hand-rolled their own
   loop: crop 10 regions of the video frame to a canvas every ~450ms tick,
   try 3 contrast variants on each. That's the thing that went through THREE
   rounds of tuning this week (bottom-only region → added top regions →
   round-robin throttle) and apparently still didn't reliably decode a real
   frame even with the digits-gate bug fixed. Rather than guess-tune a fourth
   time, **replaced it with ZXing's own supported continuous-video-decode
   API** (`BrowserMultiFormatReader.decodeContinuously` — new
   `src/lib/scanners/liveBarcodeReader.ts`), which decodes the WHOLE frame
   each attempt using the library's own internal canvas/pacing instead of our
   bespoke region system. This is the standard way this library expects live
   video to be scanned; worth trying as a different mechanism before tuning
   the old one a fourth time.
   - Gotcha found and worked around: ZXing's higher-level
     `decodeFromVideoElementContinuously()` wrapper waits for the video's
     `'playing'` event before starting — which **never fires** for a video
     that was already playing before the reader attaches (our case, always —
     the camera panel starts its own stream first). That would have silently
     hung forever. Used the low-level `decodeContinuously()` instead, which
     starts immediately with no such wait.
   - Also fixed a real, separate, previously-unnoticed bug while in here:
     `BarcodeFormat` is a numeric enum (`QR_CODE = 11`), so the old
     `normalizeFormatName()`'s `String(rawFormat).includes("QR")` was
     stringifying the *number* (`"11"`) — that check could never match
     anything, so the `.format` field was silently always `"UNKNOWN"` on
     every real scan, ever. Fixed to reverse-index into the enum properly.
   - `CameraCapturePanel.tsx`, `BarcodeScanCamera.tsx`, and the new Quick Add
     badge all now go through this shared module. The old per-tick region
     system (`scanBarcodeFromVideoFrame` in `barcodeScanner.ts`) is
     untouched and still used for the STILL-IMAGE paths (`scanBarcodeFromFile`
     — after a photo's already taken, comics' addon-code decode, etc.) —
     those aren't what was reported broken and don't have the same
     already-playing-video timing issue.
   - **Not yet confirmed on a real device — please test again.** This is a
     bigger, more fundamental change than the digits-gate fix, so it needs a
     fresh real test, not an assumption the previous "fixed" note still
     holds.

**Please test again once the deploy finishes (3-5 min after push):**
- Quick Add AND regular Add, aim at a real QR/barcode (slab, retail UPC,
  random QR) — does the badge pop up now, and roughly how fast?
- If it's *still* broken, the next thing to check (not yet tried) is whether
  it's a camera-permissions/resolution issue specific to your phone, since
  the scanning mechanism itself has now been swapped for the library's own
  supported path rather than our bespoke one — say exactly what you see
  (nothing at all vs. a delay vs. an error) so the next pass doesn't have to
  guess between "still not firing" and "a new, different problem."

### B2. Cards auto-fill — real bug found + fixed: Pokemon match wasn't setting Category/Subcategory
EK tested: **it read the title, matched a real card, correctly put the match
info in the description — but never set Category/Subcategory to "Pokemon."**
Real cause: the lookup was gated on Subcategory **already being exactly**
"Magic: The Gathering" or "Pokemon" *before* scanning — which defeats the
point of Identify (you're scanning *because* you don't know what it is yet).
Since that gate was never satisfied, the DB match's own fields (which never
included Category/Subcategory in the first place) never got a chance to
correct anything.
**Fixed both:**
- Gate is now just **Universe = TCG** (no exact-subcategory requirement).
  `runTcgCardLookupForFile` (`vault/add/page.tsx`) and `lookupTcgCardFromFile`
  (`capture/page.tsx`) now try **both** Magic (Scryfall) and Pokemon (Pokemon
  TCG API) off the same OCR'd title/number — cheap since both APIs are
  free/keyless — and use whichever one actually matches.
- On a match, Category/Subcategory now get **explicitly set** to `"TCG / CCG"`
  / `"Magic: The Gathering"` or `"Pokemon"` (not just filled if blank — same
  "confirmed match corrects a wrong/blank pick" rule the comic scanner
  already uses), so the dropdowns actually update instead of only the notes
  text mentioning it.
- **Rarity field**: EK also couldn't find a Rarity field on `/capture` at
  all. Real reason: `/capture`'s builder form has **no per-universe fields
  whatsoever** (unlike `/vault/add`, which has full TCG/Sports/etc. sections)
  — every universe just gets the same generic title/subtitle/number/grade
  fields, so a matched card's rarity only ever landed in the description
  text, never in its own field. **Added one** — a plain text input labeled
  "Rarity," shown only when Universe=TCG, right next to
  Subcategory. Wired to save via `VaultItem.tcgRarity` (already a real,
  existing, local-only field — same one `/vault/add` uses — no migration
  needed since it was never a synced Supabase column to begin with).
- **Not yet retested — please test again**: scan a real Magic or Pokemon
  card via either Add flow with Universe=TCG selected (Subcategory can be
  blank or wrong now, that's the point), confirm Category/Subcategory both
  update to the real match, and that the Rarity field on `/capture` shows up
  and holds a value.

### B3. PSA graded-card lookup — REAL CAUSE: daily API quota exhausted, NOT a bad token (previous notes below were a wrong diagnosis)
EK: "if this isn't free, then we don't have it yet or it doesn't work" — hit
`/api/psa-lookup` directly, got a `403`. **First guess (wrong): assumed
403 = bad/expired token,** since that's a common convention — sent EK to
regenerate a fresh `PSA_TOKEN` from https://www.psacard.com/publicapi and
update Vercel. **Still failed after a real redeploy with the fresh token.**
Had EK test PSA's API directly (their own curl/PowerShell sample, bypassing
our app) to isolate the problem — that returned PSA's actual error text for
the first time:
> `"API calls quota exceeded! maximum admitted 100 per Day. Please contact collectors-apis@collectors.com"`

**The token was never bad.** PSA's account has a hard 100-calls/day cap, and
it was exhausted — almost certainly by this session's own repeated live
testing (direct curl checks + a couple of polling loops used to verify the
earlier "fixed" deploys), not by EK (confirmed: "I haven't tested anything
today or in the last month"). The original `/api/psa-lookup` code only ever
checked `res.status` and GUESSED what it meant (401/403 = bad token) instead
of reading PSA's actual response body — which is also flatly wrong per PSA's
own documented error codes (https://www.psacard.com/publicapi): **500**
usually means bad credentials, **4xx** usually means the request
path/format itself is invalid, neither is "401/403 = token." That wrong
guess is what sent EK on a pointless "regenerate the token" detour.
**Fixed properly this time:**
- `/api/psa-lookup/route.ts` now reads PSA's actual response body text on
  any non-OK status and surfaces it directly, instead of guessing from the
  status code alone. A quota message gets its own clear callout (resets on
  PSA's own daily schedule, or email `collectors-apis@collectors.com` to
  raise the limit); anything else states PSA's exact wording rather than a
  made-up explanation. Falls back to a **status-code-accurate** guess (per
  PSA's real docs, not the old assumption) only if PSA's body is empty.
- Added a `204` (empty request) case so that doesn't crash trying to parse
  an empty body as JSON.
- `lookupPSACert()` (client wrapper) still throws the real message through
  instead of silently swallowing every error into `null` (from the earlier
  pass) — now that message is actually accurate.
- **⚠ A live PSA token was pasted into this chat session** (EK ran the
  direct-test command with the real value substituted, and it echoed back
  in the terminal paste). Flagged to EK as exposed; recommended treating it
  as compromised. **If the next chat sees PSA lookups failing again, check
  whether that token was ever rotated after this — it should be.**
- **Retested once, deliberately (not a loop), after EK confirmed the quota
  had reset and the guard migration (§B3b) was run. Got a THIRD, different
  rejection:** `"Access to this API is limited to approved customers."` Not
  a bad token, not quota-exceeded — PSA is saying the account itself isn't
  approved for API access at all, even with a syntactically valid, freshly
  generated token. Generating a token via PSA's portal apparently doesn't
  by itself grant usable API access. **This needs PSA support directly**
  (`collectors-apis@collectors.com`) to clarify what "approved customer"
  status requires and whether this account has/had it — not a token refresh
  or redeploy problem. **EK's action item now.**

### B3b. PSA quota guard — built same night, so this can't happen again (migration confirmed run)
Two real gaps this exposed, both fixed now:
1. **Nothing was caching cert lookups.** A PSA cert's grade/subject/etc.
   never changes once issued — every repeat lookup of the same cert
   (someone re-scanning, two users with the same card, or diagnostic
   testing) was a wasted real PSA call. Added a **permanent** cache
   (`psa_cert_cache` table) — once any cert has been looked up once, ever,
   it never touches PSA again.
2. **Nothing stopped the app before PSA had to say no.** Added a hard
   internal daily budget (`psa_api_usage` table + `psa_usage_try_reserve()`)
   capped at **90** (leaving real headroom under PSA's actual 100), checked
   *before* every PSA call. The moment PSA itself does reject a call as
   quota-exceeded, `psa_usage_mark_exhausted()` flips a flag so every other
   call the rest of that day short-circuits instantly with a friendly
   "paused for today" message instead of spending another real call (and
   getting another rejection) to find out the same thing again.
   Both live in `supabase/migrations/20260806_psa_api_guard.sql`.
   **✅ RUN — confirmed by EK.** The cert cache + 90/day budget guard are now
   live and protecting every `/api/psa-lookup` call.

**⚠ Bigger, unsolved problem — flagged, not fixed:** PSA's public API is
explicitly a developer/test tier (100 calls/day, shared across the WHOLE
app, not per-user). **This does not scale to a real subscriber base** — even
a few dozen active users scanning graded slabs would exhaust it same-day,
guard or no guard; the guard only stops today's diagnostic-testing failure
mode from recurring, it doesn't create real capacity. Getting graded-slab
lookup to actually work for paying subscribers needs EK to contact PSA about
their commercial/paid API tier (higher volume) — that's a cost/business
decision for EK to make with PSA directly, not something the next chat can
code around. Worth raising proactively if EK hasn't brought it up.

### B4. Regular Add camera should visually match Quick Add's — DONE 2026-08-08/09 (this heading was stale)
EK's own instruction, explicit ordering: fix barcode/Cards first, THEN
make the regular Add camera visually match Quick Add's. **Corrected
2026-08-11/12: this note said "not started" but the work actually
shipped 2026-08-08/09** — see the full writeup under §4's "2026-08-08/09
— Regular Add's camera, rebuilt to actually match Quick Add" entry
(embedded live camera removed in favor of a full-screen popup matching
Quick Add's structure, corner-bracket guide, shared `DropdownPill`,
letterbox-bar fix, drag-to-reorder thumbnails). Leaving this pointer here
so a future pass doesn't restart already-finished work a second time.

### B5. Vault Halls — a dead-session draft got replaced with EK's actual spec; new cross-category search + real tags built
A previous session died mid-work on `src/app/vault/halls/` — found it
uncommitted, asked EK what direction it was going. The draft: a hardcoded
list of ~40 pop-culture franchises (Marvel, DC, Star Wars, etc.), auto-
tagging items by keyword match, raw emoji as hall icons (fixed the page
chrome's emoji first, then EK clarified the REAL spec was different and
bigger — read it back twice to confirm before building):

**EK's actual spec:** pick your own search terms; each term's matches get
ADDED to a working result set (OR, not a narrowing AND) — search "Marvel"
then "Spiderman" and both sets show up together, even a non-Marvel-branded
Spider-Man item. Everything found is selected by default; deselect what you
don't want; name and save the rest. Has to work for every universe (Music,
plants, bar items, everything), not just pop-culture. "Spider-Man"/"Spider
Man"/"Spiderman" need to match as one term automatically, no manual
spelling list. Hashtags matter for BOTH this search AND social sharing (EK's
original spec) — confirmed hashtags already existed for sharing
(`SocialExportSheet.tsx` generates them fresh each export) but never as a
saved, searchable field.

**Built:**
- `src/lib/vaultSearch.ts` — the search engine. Normalizes text (strips
  punctuation/case) so spelling variants match without a curated list;
  searches title/subtitle/subject/category/universe/every manufacturer-ish
  field per universe (comic publisher, toy brand, vinyl label, watch brand,
  sports team, etc.)/tags. Universe+Category filter narrows (AND) on top of
  the OR'd terms.
- `src/app/vault/halls/page.tsx` — full rewrite. Term-chip search box, live
  results (all pre-selected, tap to deselect), Universe/Category dropdowns,
  name + "Save as Hall" → reuses the existing gallery/exhibition system (a
  saved Hall is a real private gallery, shareable later the same way any
  exhibition is). **Deleted** the old franchise-registry version, the
  `[franchise]` detail route, and `src/lib/franchiseDetect.ts` — viewing a
  saved Hall is just the existing `/museum/[galleryId]` page now, no
  separate route needed.
- **Real `tags` field added to `VaultItem`**, synced to Supabase
  (`supabase/migrations/20260806_vault_item_tags.sql` — **confirmed run by
  EK**) with the same graceful-fallback-if-column-missing pattern
  `vaultCloud.ts` already uses for other optional columns (belt-and-
  suspenders now that it's live).
- `src/lib/generateHashtags.ts` — extracted `SocialExportSheet`'s
  universe/category/title-keyword hashtag suggestion logic into a shared
  module (was duplicated nowhere else, but would have started drifting the
  moment a second consumer needed it). New items now auto-save a few of
  these as real tags on creation (`/capture` and `/vault/add` both) — so
  Halls search has real data from day one instead of depending on everyone
  remembering to tag manually.
- Added a Tags editor (chips + one-tap suggestions pulled from the same
  generator) to the item detail page, for editing tags on any item —
  including the entire existing vault, which has zero tags today since this
  field didn't exist before tonight.
- `tsc`/`eslint`/`npm run build` all clean; verified via local dev server
  that `/vault/halls` compiles and server-renders without error. **Not
  tested with a real login at all** — the whole flow (search behavior,
  save-as-Hall, tag editor) needs a real device/account test.
- **Since built:** a "browse existing tags" chip row in the search bar
  (most-used tags across the vault, tap to add as a search term), and an
  "Auto-tag my collection" button on `/vault/halls` that backfills tags on
  every item that predates this feature. Both were "suggested, not started"
  as of the last handoff pass — now done, still needs a real login to test.

### B6. Overnight cleanup pass — a real data-loss bug fix + dead-code/fake-data/emoji/pill sweeps
EK asked, after the Halls work: "what else can you work on over night" →
"do 1-4 and any other clean sweeps you can do to clean up any code." Ran
four sweeps, all verified with `tsc`/`eslint`/`npm run build` after each:

1. **Real data-loss bug, found while reviewing the tags work, now fixed.**
   `normalizeOne()` in `vaultModel.ts` is a strict allow-list — any
   `VaultItem` field missing from its return object gets silently dropped
   the next time the vault reloads, and `loadRawItems()` immediately
   persists that stripped copy back to storage (so it's not just a display
   glitch, it's permanent). Confirmed four real fields hitting this by
   programmatically diffing every type field against what `normalizeOne`
   actually returns, rather than eyeballing 700+ lines:
   - `itemType`/`itemAttributes` — the "Type" dropdown + "Attributes"
     checkboxes on `/vault/add` (`getTypeOptions`/`getCheckboxOptions`,
     real active UI) saved correctly, then vanished the very next time the
     vault loaded (navigate away and back, refresh). No sync path exists
     for these either — once dropped, gone for good, not recoverable from
     Supabase.
   - `videoClip` — same local bug, though `vaultCloud.ts`'s sync already
     handled this one correctly, so a Supabase-connected user's video
     *could* recover on the next sync (not before, and not for local-only
     use).
   - `itemCode` — the permanent, server-assigned tracking code (explicitly
     documented "never edited by the client") gets set via a cloud-sync
     merge, then dropped by the very next local normalize pass before
     another sync could reconfirm it. `mergeById()` calls `normalizeOne()`
     directly, so this hit the sync-merge path too, not just page reloads.
   All four fixed by adding them to `normalizeOne`'s return object.
2. **Dead-code sweep**: 11 more files deleted (early AI-integration stubs,
   a chained dead pair, a duplicate metrics/theme system, a superseded
   sell-item helper). Delegated discovery to an Explore agent, verified its
   findings myself before deleting, `tsc` clean after.
3. **Fake-data sweep**: found the same bug shape as prior rounds (hardcoded
   value sitting next to real data) in `watchlist/page.tsx` (fake per-item
   value-history chart + dead non-clickable time-range tabs),
   `goals/page.tsx` (fake "Goal Value Impact" chart), `more/page.tsx`
   (hardcoded "1 year" tenure for every account), and `HomeClient.tsx` (the
   home dashboard's "Collection Value" chart showed the exact same fixed
   path to every user regardless of real history). Fixed all four — the
   home dashboard one now uses real data from `valueHistory.ts` (already
   built, already used elsewhere, just never wired in here); the other
   three had no real per-item/per-goal history to chart, so got an honest
   message instead of a fabricated one, matching this app's own established
   pattern elsewhere on the same pages.
   **Found but NOT touched**: `community-board/page.tsx` has the identical
   fake-mini-chart pattern next to real "Market Pulse"/"Volume" numbers —
   that file is explicitly Codex's per §0's parallel-editing note, flagging
   for whoever owns it rather than editing across that boundary.
4. **Pill sweep**: one real violation — `museum/page.tsx`'s "Exhibit
   Status" modal had two `w-full` dropdowns for one-word options,
   inconsistent with the same file's own correctly-sized toolbar filters
   just above them. Fixed to `w-auto`.
5. **Emoji sweep**: addressed the specific sites this handoff had
   previously deferred as needing real visual judgment rather than a
   mechanical swap — `kickstarter/page.tsx`, `shop.tsx` (category chips +
   empty state only; the ~34 individual product icons need their own
   per-item judgment call, left alone rather than guessed), 
   `v/[profileId]/page.tsx` (replaced a local emoji map with the shared
   `universeGlyphName()` helper that already existed for this exact
   purpose), and `HomeClient.tsx` (social-platform icons, an upload
   button, a decorative sparkle). Added 4 new icons to the shared `Glyph`
   component (rocket, globe, book, wrench). **Deliberately left alone**:
   `SeasonalBanner.tsx`'s falling snowflake/ball/leaf/pumpkin particle
   animation (an intentional decorative effect, not icon substitution) and
   the user-chosen avatar-preset emoji (explicitly exempted already).
- **Nothing in this pass has been visually verified in a real browser** —
  everything compiles/builds/server-renders clean, but several are real,
  user-visible UI changes (a chart, icons, a dropdown width). Worth a look
  next time EK is in the app, especially the home dashboard and `/shop`.

### B7. Fresh iPhone bug report — all 3 issues FIXED
EK tested live on an iPhone (Safari, `vltd.vercel.app`, system set to Light
Mode), reported with a screenshot. All three fixed and pushed:

1. **Hero card text was low-contrast.** Root cause: `HomeClient.tsx`'s local
   `C.muted`/`C.muted2` design tokens were a hardcoded `#61656B` — only
   ~2.5:1 contrast against the hero/gallery cards' own hardcoded dark
   panel background (that panel is intentionally always-dark, a "premium
   console" look, and never switches with site theme — so this wasn't
   actually a light/dark-switching bug, it was a real contrast bug that's
   been there in both modes, just more noticeable next to a light-mode page).
   Fixed: bumped to `#9BA0A6` (the app's own `deep-vault` theme's
   `textSecondary` value — not invented, already used elsewhere) — ~6:1
   contrast, fixes both modes since the panel itself doesn't change.
2. **VLTD logo washed out in Light Mode.** Root cause: `TopNav.tsx` applied
   a hardcoded `grayscale(1) brightness(1.4) contrast(1.05)` CSS filter to
   the logo image, tuned to brighten it for a dark navbar — against a light
   navbar the same +40% brightness filter washed it out. Fixed: removed the
   filter entirely. The logo's own dark+gold artwork is legible against
   either navbar color on its own; no filter or theme-detection needed.
3. **"Add to Home Screen" prompt did nothing on tap.** Root cause:
   `PWAInstallBanner.tsx`'s iOS branch was pure static text with no tap
   handler at all — styled like a button, wasn't one. (iOS Safari has no
   `beforeinstallprompt` API, so there's no way to trigger the native
   install dialog from JS — confirmed, not a bug to "fix" by finding a
   missing handler.) Fixed: made the banner body tappable — it now expands
   to show the actual two-step instructions ("Tap the Share icon in
   Safari's toolbar, then Add to Home Screen") instead of silently no-oping.

### B8. Barcode scans connected to real lookups (2026-08-11) — /capture, /vault/add, Quick Add. Partially device-tested; one path unconfirmed.
EK's real question after the scanning rebuild (§B) worked: "what can
scanning a barcode do at this point?" Honest answer at the time: nothing.
It confirmed the read (green badge) and stopped there — the actual lookups
only ran later, inside the after-a-photo Identify pipeline, and even then
silently auto-filled fields with no confirmation screen. EK also asked two
concrete questions that shaped this: (1) does taking one photo of a comic
that also has a barcode already combine both signals smartly? — checked
the code, answer is genuinely yes, `capture/page.tsx`'s `runAiIdentify`
already runs vision + barcode + comic-OCR in parallel and merges them (has
for a while, independent of §B's scanner work) as long as Universe/
Category are already set to Pop Culture/Comics. (2) scan 10 barcodes in
Quick Add then batch it — how would you know it worked? Checked: it
wouldn't, at all — `CapturedItem` had no barcode field, the scan result was
thrown away the instant the checkmark faded. Researched how real batch
scanners (Scandit, CLZ) solve this: live per-scan feedback, a visible
running list/count as you go, never a silent wait to the end.

**Built**, per EK's "build all 3, we'll see if it's fast enough":
- New `src/lib/scanners/barcodeLookup.ts` — the missing link. Given just
  the decoded digits (no photo), tries comic (Metron then GCD), vinyl
  (Discogs), then the generic UPC/book lookup, in that order (narrower/more
  specific DBs first) since a comic/vinyl hit is always more useful than
  the generic product-title lookup would return for the same code.
  Deliberately excludes PSA (metered/paused per §B3) and AI vision
  (metered, needs a real photo) — this is the free-lookup layer only.
- `CameraCapturePanel.tsx` gained a new `onLiveBarcodeScan` prop, fired
  once the lookup settles for a scanned code.
- **`/capture` + `/vault/add`**: wired to the new prop, filling only BLANK
  fields (a confirmed database match is treated as MORE trustworthy than a
  later AI vision guess, deliberately not using `runAiIdentify`'s own
  "vision wins if non-empty" merge rule for this). `/vault/add` reuses its
  existing `scanSession`/`applyScanFieldsToEmpty` machinery (plus a direct
  `setValues` pass for comicPublisher/vinylLabel-style fields that have no
  slot in the shared `ScanSessionFields` shape) rather than inventing a new
  UI.
- **Quick Add (`ScanCapturePanel.tsx` + `ScanReviewSheet.tsx`)** — the real
  answer to "will I waste time." The lookup starts the instant a scan
  succeeds (not on capture), attaches to whichever item gets shot right
  after, and the review sheet shows a live tag per item — "Matched: X" /
  "No barcode match — AI will identify" / "Looking up..." — **before**
  Finished is ever tapped. A confident match pre-fills that item's draft
  via the same `visionToDraftPatch` taxonomy-matching path AI results use
  (via a new `barcodeMatchToVision()` synthesizer) and **skips the metered
  AI scan for that item entirely**.

**Real bug found on first test, fixed same session:** EK scanned
immediately — code read fine, "nothing visible happened." The confirmation
card lived on the PAGE; `CameraCapturePanel` is a full-screen modal ON TOP
of that page, so the card was firing and filling fields correctly the whole
time on a layer EK literally could not see without closing the camera
first. **Fixed:** moved the lookup call AND its result display into
`CameraCapturePanel` itself — it now runs `lookupByBarcodeOnly()` directly
and shows "Looking up…" / "Found: X" / "No match" right in the camera view,
below the existing green checkmark badge. `onLiveBarcodeScan` now hands the
parent the already-resolved match instead of each parent re-running its
own lookup (fixed a duplicate-network-call inefficiency in the same move).

**Second test, after the visibility fix:** scanned the same CGC slab again
— correctly showed "No match found," which is the RIGHT answer (CGC isn't
in any of the wired-up databases; no CGC lookup exists at all, same gap as
PSA — see below). EK's question: could it say something more useful than a
flat "no match" that reads like a failure? **Built `guessWhyNoBarcodeMatch()`**
(`barcodeLookup.ts`): if the raw scanned text contains a known grading
company's own domain (CGC/PSA/Beckett/SGC all put their verify URL in the
QR), names the exact service confidently; if it's just a QR with no
recognizable domain that matched nothing, says it might be "a
grading-company certificate" — softer, since retail UPC/EAN codes are
essentially never QR-encoded in practice but this can't name WHICH service
without the domain signal. A genuinely unrecognized linear barcode still
gets the honest generic "no match" message.

`tsc --noEmit` / `eslint` (zero new warnings) / `npm run build` all clean
throughout. **Status as of the last real test:**
- ✅ Scanning mechanism itself: confirmed working (§B).
- ✅ "No match" path: confirmed correct and now informative (this section).
- ⬜ **"Found: X" success path: NOT yet confirmed** — every device test so
  far has been against a graded slab's cert QR, which structurally can
  never match (no cert-lookup DB is wired up). **Needs a scan of something
  that SHOULD match** — a comic's own barcode, a vinyl record, or a plain
  retail product — to prove the actual lookup-and-fill works, not just that
  it correctly says no when there's nothing to find.
- ⬜ Quick Add's live per-item tags: not yet seen on a real device at all.
- ⬜ Whether scanning still stays cool over repeated bursts: not re-checked
  since the `zxing-wasm` engine swap (§B) — the original complaint that
  started this whole thread.

**CGC lookup — confirmed still fully unaddressed.** No CGC API integration
exists anywhere in the app (same status as before tonight). If EK wants
this built, it would mirror the PSA cert-lookup work (§B3/§B3b) — a new,
separate effort, not started, and not something the "connect existing
lookups" work above touches.

**Third real test, 2026-08-11: a Nintendo Switch game's real retail UPC
(`0810148574819`) correctly decoded but found no match.** Not a bug in the
decode or lookup logic — genuinely a coverage gap, and it surfaced a real
risk worth flagging clearly:
- **No video-game-specific barcode database is wired in.** `lookupUpcItem`
  only hits upcitemdb (general retail) + OpenLibrary (ISBNs) — neither
  specializes in games, and this specific title just wasn't in upcitemdb's
  free-tier catalog. Real options exist (ScanDex combines barcode+IGDB
  metadata; GameUPC has a REST API) if EK wants a dedicated games lookup
  added to the cascade, same pattern as comics (Metron+GCD) and vinyl
  (Discogs) — not started.
- **Bigger, more urgent finding: upcitemdb's free tier is capped at 100
  requests/DAY, shared across the whole app** — the exact same shape of
  problem PSA had before the quota guard was built (§B3b), and there's
  currently **no cache, no budget guard, nothing** protecting this one.
  Before tonight, UPC lookups only fired during a full photo-based Identify
  (relatively rare per session). Tonight's live-scan feature (§B8) now ALSO
  fires a UPC lookup on every single scan across `/capture`, `/vault/add`,
  AND every Quick Add item — meaningfully more call volume through the
  exact same free tier. **Worth building the same cert-cache + daily-budget
  pattern used for PSA before this becomes a real outage, not a hypothetical
  one.** Flagged to EK, not yet built — needs a decision on priority.
- **Confirmed: no live zoom control while framing a shot.** Checked both
  camera panels directly — neither has any `zoom`/`MediaStreamTrack`
  constraint code at all. The AFTER-capture crop/review step
  (`ScanCropEditor.tsx`) DOES already have real pinch/scroll zoom (the
  "Pinch or scroll to zoom" hint is genuine, already shipped) — EK's
  question was about the LIVE camera view before capture, which has none.
  Browser `getUserMedia`/`MediaStreamTrack.applyConstraints({zoom})` can do
  this on supporting hardware/browsers, similar to the focus-constraint
  research from §B — not started, real feature request if EK wants it.

### B9. Real Brand/Manufacturer/Publisher field added (2026-08-11) — was computed, then silently discarded
Same test that found the video-game UPC gap above also surfaced this: AI
Identify correctly named the game (Contra Operation Galuga), category, and
notes — but there was nowhere for "Nintendo" itself to go, and EK pointed
out the identical gap applies to a comic's publisher (Marvel/DC) or a
card's manufacturer (Topps). Checked the code before building anything:
this wasn't a missing-feature gap so much as a missing-FIELD one — AI
vision's response already includes a `brand` field on every Identify call,
and the generic UPC lookup already returns one too (upcitemdb genuinely
has "Nintendo" on file for this exact game) — both were computed and then
thrown away because nothing existed to hold them.

**Built:**
- `vaultModel.ts`: new `brand?: string` on `VaultItem`, distinct from the
  existing `subject` field (who/what an item is ABOUT — a player,
  character, artist; used for the vinyl "artist" and the Registry
  leaderboard) — brand is who MADE it. Added to `normalizeOne()`'s
  allow-list too, so it doesn't repeat the exact "silently dropped on next
  reload" bug class fixed earlier this week for other fields.
- New migration `supabase/migrations/20260811_vault_item_brand.sql` for the
  matching `vault_items.brand` column — **not yet run.** Deliberately did
  NOT touch `vaultCloud.ts`'s row map yet (an unknown column throws on
  every synced item's upsert, not just this field) — that's the next step,
  only after EK confirms the migration ran.
- `capture/page.tsx`: new "Brand / Manufacturer / Publisher" field in the
  Identity accordion (same lock/remembered-value support as Item Name),
  wired into the vision+UPC merge.
- `barcodeLookup.ts`: comic publisher and vinyl label now also populate
  this same universal field in addition to their existing specific ones —
  a live barcode scan fills Brand too, not just notes text.

**Scoped to `/capture` only** (where EK demonstrated the gap) — `/vault/add`
already has narrower per-universe equivalents (`comicPublisher`,
`vinylLabel`) that work correctly, just aren't unified under one generic
name; extending it there too is a smaller, separate fast-follow if EK wants
consistency across both screens.

`tsc`/`eslint`/`build` all clean (one build attempt hit a transient Google
Fonts network fetch failure unrelated to this change — clean on retry, not
a real problem, just noting it in case a future build hiccups the same way
for no code-related reason).

**DONE 2026-08-11:** EK ran the migration ("Success. No rows returned"),
so `vaultCloud.ts`'s row map is now wired both ways (plus the same
missing-column fallback pattern already used for `tags`/video/etc., kept
as belt-and-suspenders even though the migration is confirmed). Brand now
syncs to Supabase for real, not just local-only.

### B10. Safety guards built for every metered QR/barcode lookup API — 2026-08-11, needs one migration run
EK's ask, after §B8's upcitemdb-quota-risk flag: "Build all the safeties
that can be used for QR readers." Built the same permanent-cache +
daily-budget pattern PSA already has (§B3b), generalized this time
instead of copy-pasted per provider — new
`supabase/migrations/20260811_lookup_api_guards.sql` (`lookup_api_cache`
+ `lookup_api_usage` tables, provider-keyed) + a shared server helper
(`src/lib/server/lookupApiGuard.ts`).

**Applied precisely, not uniformly — the three providers don't actually
have the same failure mode, so they don't get the same guard:**
- **upcitemdb** — confirmed hard 100/day cap, same shape as PSA's. Gets
  the FULL guard: permanent cache + daily budget (safe cap 90). This
  also required moving the call server-side for the first time — it used
  to `fetch()` upcitemdb directly from the BROWSER
  (`src/lib/upcLookup.ts`), which meant nothing server-side could ever
  gate it no matter what guard existed. New `/api/upc-lookup` route now
  does the actual fetch; `upcLookup.ts` is now a thin client wrapper that
  calls that route (same exported function signature, so no caller
  needed to change). ISBN/book codes route through the same endpoint to
  OpenLibrary/Google Books — cached, but deliberately NOT daily-budget
  gated, since neither has a confirmed hard cap; inventing one would just
  block real lookups for no reason.
- **Discogs** (vinyl) and **Metron** (comics) — both are per-MINUTE rate
  limits per their own docs (Discogs 60/min authenticated, Metron ~30/min),
  not daily caps. Gave both the permanent cache (a real, big win — a
  repeat scan of the same barcode/release/issue never re-hits the API
  again) but deliberately did NOT invent a fake daily-budget pause for
  either — that would be dishonest given neither actually has one. Instead
  added real 429 handling: a clear "rate-limiting right now, wait a few
  seconds" message instead of the previous generic error.
- **GCD** (comics) — no guard needed or added; it's self-hosted data in
  this app's own Supabase (`gcd_comic_search`), not a rate-limited
  third-party call at all.

`tsc`/`eslint`/`npm run build` all clean (only pre-existing, unrelated
warnings — the React Compiler try/finally advisories already documented
elsewhere in this file, and one pre-existing `stopCameraStream` missing-
dep warning in `CameraCapturePanel.tsx` that predates this change).

**DONE 2026-08-11:** EK ran the migration ("Success. No rows returned").
The cache + daily-budget guard is now actually live for upcitemdb/
Discogs/Metron, not just fail-open. Not yet observed in action on a real
scan (no way to tell from the migration alone whether a cache hit or a
budget reservation has actually fired) — first real multi-scan session
is worth a glance at the `lookup_api_cache`/`lookup_api_usage` tables to
confirm rows are actually accumulating.

### B11. Live zoom on the camera preview (before capture) — 2026-08-11, feature-detected, needs a real device to confirm
EK's question: the zoom EK meant was on the LIVE camera view while
framing a shot, not the after-capture crop step (`ScanCropEditor.tsx`
already has real pinch/scroll zoom there, confirmed working — that one
was never in question). Checked what's actually possible: browsers expose
an optional `zoom` capability on a camera's `MediaStreamTrack`
(`track.getCapabilities().zoom` / `track.applyConstraints({zoom})`) —
but it's NOT part of the base `getUserMedia` spec, it's a capture-
extensions addition each browser opts into individually, similar in
spirit to the `BarcodeDetector` feature-detection this app already did
for native barcode scanning (§B). **Honest expectation: per current
browser-support data this is Android Chrome (and some other Chromium
browsers) on supporting hardware — iOS Safari and most desktop
browsers/webcams expose no `zoom` capability at all, and there's no
software way to fake real optical/driver zoom from JS.** On your iPhone,
this most likely will NOT show a zoom control at all — that's a real
platform limitation, not a bug to chase further.

**Built:** new `src/hooks/useCameraZoom.ts` — feature-detects the
capability the moment a stream's video track attaches, exposes a small
vertical slider (bottom-right of the camera frame, only rendered when
actually supported) AND real two-finger pinch-to-zoom over the whole
live camera view. Wired into both `CameraCapturePanel.tsx` and
`ScanCapturePanel.tsx` — one shared hook, not two separate
implementations, same reasoning as `DropdownPill` being extracted
earlier this week.

**Update 2026-08-11, same night:** EK tested on desktop with a mouse —
correctly reported no zoom control at all, confirming the prediction
above (desktop webcams essentially never expose hardware zoom) but that
turned out to be too big a gap to leave as "expected": with the
hardware-only first version, the control was invisible everywhere except
one specific browser/hardware combo. **Added a universal digital
fallback** so a zoom control now exists on every platform: CSS-scales
the live preview and — this is the part that actually matters, not just
a cosmetic zoom-looking effect — crops the captured frame to match at
the moment of capture (`getCaptureCrop()` in the hook, wired into both
`captureFrame()` in `ScanCapturePanel.tsx` and `handleCapture()` in
`CameraCapturePanel.tsx`) so what you see zoomed is actually what gets
saved, not a zoomed-looking preview that silently captures the full
unzoomed frame. Driven by scroll wheel on desktop and pinch on touch;
hardware zoom is still preferred and used automatically on the
Android-Chrome-class devices that actually expose it — digital only
kicks in where hardware doesn't exist.

**Still not yet confirmed on a real device** (only the earlier absence
was tested, not this fix) — worth checking: the slider/scroll now shows
up and works on desktop, scroll wheel doesn't fight page scroll behind
the camera, pinch works on a phone, and a zoomed-in capture actually
looks zoomed in the saved photo (not just the live preview).

**Update, same night — lens-switching (EK's follow-up question).** EK
asked directly: on mobile, does zooming use the phone's multiple rear
cameras (ultra-wide/main/telephoto), or just one? Honest answer at the
time: no, nothing did that — hardware zoom only ever adjusted the SAME
active camera's own driver-level zoom, and digital zoom is a pure crop
of that same single feed. Neither ever switches physical lenses.

Researched what's actually possible here, since there's no standard Web
API to ask "which lens is this" (no focal length/FOV capability exposed):
- Many phones (especially ones with camera-HAL-level multi-camera fusion)
  already expose their whole lens set as ONE logical back camera —
  `enumerateDevices()` only ever shows one entry, and the OS silently
  switches/blends between physical lenses internally as the existing
  hardware `zoom` capability moves through its range. **Nothing needed
  building for these phones — they already get real lens-switching for
  free through the zoom work already shipped.**
- Some phones DO expose each physical rear lens as a separate device.
  For those, **built** `src/lib/scanners/cameraLenses.ts` —
  `classifyBackCameras()`, a best-effort label-text classifier (there's
  no other signal available) that picks an ultra-wide camera out of the
  device list. Wired into both camera panels: scrolling/pinching out
  past the current camera's own zoom floor now switches to that ultra-
  wide device (reusing each panel's existing camera-restart machinery,
  not a new stream path); zooming back in switches back to the main
  camera. A small "Wide" badge replaces the numeric zoom label while on
  it.
- Deliberately scoped to ultra-wide only, not telephoto — digital zoom
  already covers "zoom in further" reasonably within a single lens's own
  quality ceiling, whereas ultra-wide is the one direction digital zoom
  fundamentally can't fake (can't invent a wider field of view from a
  narrower one). Telephoto-lens label detection is also far less
  standardized across OEMs than ultra-wide's — lower value for the
  added guesswork.
- iOS Safari never exposes multiple rear lenses this way at all
  (consistent with the zoom feature's own platform split) — this is
  Android-only in practice, and even there, only on phones that don't
  already fuse their lenses at the OS level.

**Explicitly NOT verified on real hardware** — label-based lens
classification cannot be confirmed without an actual multi-lens Android
phone to test against; a mislabeled device would misclassify silently.
Worth a real test: does a phone with separate ultra-wide/main entries
actually get detected and switched correctly, does the switch feel
reasonably smooth (a brief reconnect blip is expected and fine, a long
freeze or wrong-lens-forever would not be), and does a phone with fused
lenses correctly show nothing extra (no `ultraWideId` found, silent
no-op, existing zoom behavior unchanged).

### C. DOCUMENTS (capture builder §5 accordion) — DONE 2026-08-03
EK's answer: "everything should be private unless shared" — that's a
clear enough steer to build, not a decision that needed your dashboard. Built
it **local-only**: new `src/lib/vaultDocuments.ts` stores files in this
browser's IndexedDB + a localStorage index, completely separate from
`VaultItem.images` — never uploaded to Supabase, never synced, never
touches the (public) `vault-images` bucket, so none of the existing photo
carousels/exports/public share pages can ever surface one. New "DOCUMENTS"
section on the item page (`src/app/vault/item/[id]/page.tsx`, via new
`src/components/DocumentsSection.tsx`) with **Upload file** / **Take photo**
buttons, a list with View/Remove. Genuinely private since it never leaves
the device — the one tradeoff is it doesn't sync across your devices yet;
say so if you actually want cross-device sync (that would need the private
Supabase bucket + your dashboard access after all).

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
- The "Syncing…" chip styling ask is dropped — EK doesn't have a specific
  target for this and said so twice; not re-raising it.

### G. Profile/avatar sync bug — FIXED tonight (EK confirmed the fix direction)
Was: `src/lib/publicProfile.ts` `syncPublicProfile()` wrote the
`public_profiles.display_name` shown to OTHER users (Lounge, `/u/[username]`,
museum pages) from the local-only `/user/profile` store instead of the real
`profiles.display_name` set on `/account` — so a user who only ever used
`/account` had the wrong name shown publicly. **Fixed:** `syncPublicProfile()`
now reads `display_name`/`avatar_emoji` straight off the real `profiles` row
it already fetches, instead of the stale local copy. Removed the now-unused
`getProfileSafe` import from `publicProfile.ts`.

### H. `/user/profile` merged into `/account`, real email-change flow added — DONE (2026-08-04 night, both migrations confirmed RUN by EK)
EK's call (given twice): (1) build DOB/age-verification/marketing-opt-in as
real, saved fields (self-declared age check — user types their birthdate,
same kind of gate most consumer sites use; **not** government ID
verification, flagged that distinction to EK); (2) yes, merge the two
settings pages into one, and build a real email-change flow. Both migrations
(`20260803_saved_events.sql`, `20260803_profile_identity_fields.sql`) came
back "Successful" from EK directly — no longer pending, the ⚠ note in §0 is
stale as of this pass, safe to ignore/remove next time this file is edited.

Shipped:
- `updateProfile()`'s allow-list (`src/lib/auth.ts`) now accepts
  `avatar_emoji`/`date_of_birth`/`age_verified`/`marketing_opt_in`.
- **`/account` is now the one real settings page.** Added three sections
  merged from the old `/user/profile`: **Avatar** (emoji is real/synced via
  `avatar_emoji`; image upload stays local-only/device-only, no storage
  bucket wired yet — said so in the UI), **Identity & Security** (DOB + Verify
  Age button + marketing opt-in checkbox, one combined save calling
  `updateProfile()` + `syncPublicProfile()`), and **Data Controls** (Export
  Vault JSON, Clear Local Cache). All load real values from
  `getOnboardingStatus()` on mount, same pattern the rest of the page
  already used for display name/username/bio/contact info.
- **`/user/profile` is now a redirect to `/account`** (`router.replace`,
  not deleted outright) — so a bookmarked or externally-linked
  `/user/profile` URL still lands somewhere real instead of 404ing. Updated
  the two "Edit public profile" links on `/more` to point at `/account`.
- **Real email-change flow, added to `/account/security`** (not `/account`
  itself — matches where the existing password-reset flow already lives,
  under "Login credentials"). Click "Change" on the Email row → type a new
  address → "Send confirmation" calls `supabase.auth.updateUser({ email })`
  → Supabase emails a confirmation link to the new address; the login email
  does NOT change until that link is clicked. No new secrets/services
  needed — this is Supabase Auth's own built-in flow, same mechanism the
  password-reset email already used.
- Removed the top-level "Reset" button that used to reset the *entire*
  profile (including cloud-synced fields) to defaults in one click — real
  data-loss risk once these fields went live. The avatar-image-specific
  "Remove" button (inside Avatar) still covers the one thing that's
  genuinely local-only.
- "Clear Local Demo Data" became "Clear Local Cache" and stopped wiping the
  local vault-items cache (`vltd_items_v2`) — that was never actually demo
  data for a signed-in user.
- Reworded all "demo"/"in a real app this would..." copy — the fields
  behind it are real now.

**Not done, still open:** avatar image upload has no backend (device-only,
said so honestly in the UI) — would need a real storage bucket + upload
flow, a separate ask if EK wants it. Two-factor auth card on `/account/security`
(`TwoFactorAuthCard`) wasn't touched/audited this pass.

### I. Billing plan — smaller fix than expected, SHIPPED tonight
`/account/billing` was hardcoding `currentPlan = "free"` for every user, with
a comment claiming the Stripe webhook wasn't built. **That comment was
stale — the webhook (`src/app/api/billing/webhook/route.ts`) already exists
and already keeps `profiles.tier` in sync**, and `src/lib/subscription.ts`
(`getTierSafe()`) already mirrors that real tier locally — it's used
elsewhere (scan quotas). Fixed: the billing page now reads the real tier via
`getOnboardingStatus()` + `getTierSafe()` instead of a hardcoded literal. No
migration needed, nothing new to configure.
**Gap FIXED 2026-08-12 (overnight, while EK slept):** the Stripe
`customerId` used to only be cached in that device's `localStorage`
(`billingClient.ts`), never persisted server-side — a real paying user
opening billing on a NEW device would see the correct plan (tier is
server-synced) but the Payment method/Invoice history/Cancel sections
stayed hidden. Added `profiles.stripe_customer_id`
(`supabase/migrations/20260812_profiles_stripe_customer_id.sql` —
**confirmed run by EK 2026-08-12**) and the webhook now writes it on
`checkout.session.completed` and `customer.subscription.updated` (same
events that already sync tier), with a graceful fallback that was only
needed pre-migration. `/account/billing` now reads the customer id from
the profile as the source of truth, falling back to the local cache only
for an instant no-flash first paint.
**Not tested against a real Stripe checkout** — the webhook logic was
verified by reading, not by triggering an actual `checkout.session.completed`
event; worth confirming the column actually gets populated after a real
subscribe.

### F. Bigger / later (needs your device or your decision — not started)
- **Events saved-list sync — DONE 2026-08-03 (night), needs your migration run.**
  Saved events (`/events`) were localStorage-only (per-device). Added
  `supabase/migrations/20260803_saved_events.sql` (owner-only RLS, mirrors the
  wishlist/watchlist convention) + `src/lib/savedEventsModel.ts` (same
  local-cache + best-effort-sync pattern as wishlistModel.ts) and wired
  `/events` to it. **Please run `20260803_saved_events.sql` in Supabase** —
  until you do, saves still work (falls back to local-only, same as every
  other model here before its migration lands), they just won't sync across
  devices yet.
  Event **category is still keyword-guessed** (`categoryFor()` in
  `events/page.tsx` — guesses from real event name/description text). Left
  this alone: it's a real classification of real events, not fabricated data,
  and a real "category" column would need someone to actually assign correct
  categories to existing events (a content/ops task, not just a schema
  change) — didn't want to guess at that data blind. Also left
  `savedSuggestionIds` (saved *search results* from the Google Events/SerpApi
  lookup, key `vltd_event_search_saved_v1`) local-only — those aren't real DB
  rows, syncing them would need storing a full snapshot per save (like
  watchlist does for external items), lower priority than the curated-events
  list above.
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
- **Profile/avatar sync bug** (2G) — DONE 2026-08-03 night, no longer open.
- **`/user/profile` real DOB/age/marketing fields, merge into `/account`,
  real email-change flow** (2H) — ALL DONE 2026-08-04 night, no longer open.
  Both migrations confirmed run by EK. Only leftover: avatar image upload
  is still device-only (no storage bucket wired) — separate ask if wanted.
- **Capture-screen "Auto ID" metering** — DONE 2026-08-03 (see §4), no longer open.
- **Watchlist vs Wishlist** name — DONE 2026-08-03, renamed to `/watchlist`, no longer open.
- **PillButton-everywhere migration** (2F) — landed on `main` via "Pill sweep"/
  "PillButton everywhere" commits from elsewhere; no longer open, check
  current code rather than assuming a green-light is still needed.
- **ai/review + ai/drafts cyan color** — NOT a decision anymore: confirmed
  2026-08-03 this is the app's actual primary-CTA standard
  (`.vltd-action-module__block`, 25 files), not an off-brand mistake. No change made.
- **/admin/\* visual skin** — confirmed 2026-08-03 it's a deliberately separate
  internal-tool look (own dark bg, amber accents, emoji icons), not drift. Left
  alone. Say so if you actually want it reskinned to match the main app — bigger
  job, not started.
- **~55 orphaned component/lib files found 2026-08-05 — FULLY RESOLVED same
  night, per EK's "do all A/B/C" then "delete the rest" calls:**
  - **Comic barcode/OCR scanner** — real feature, finished wiring it in.
    **Not yet tested against a real comic cover — do that first.** See §4.
  - **Multi-workspace switching** — confirmed dead/superseded, deleted. See §4.
  - **Dashboard chart widgets** (PortfolioIntelligencePanel,
    CollectionValuationScoreCard, GoalsProgressWidget, SubjectRankingsWidget)
    — real, all reading data already live elsewhere; placed on `/portfolio`
    Insights. See §4.
  - **Everything else (~55 more files, including the analytics/repo-
    abstraction layer)** — deleted. `tsc` clean. See §4's "D." entry.
  - **No more open dead-code items from this sweep.**
- Everything else in §2 is a go; just needs building/verifying/a migration.

---

## 4. Done recently (don't redo)
- **2026-08-12 overnight, while EK slept — lens-switch on zoom (§B11) +
  Stripe customer-id persistence (§2I).** EK asked whether zoom uses a
  phone's multiple cameras; it didn't, so built best-effort ultra-wide
  lens detection/switching (`src/lib/scanners/cameraLenses.ts`) wired
  into both camera panels' existing zoom gesture — Android-only in
  practice, unverified on real multi-lens hardware. Also fixed the
  billing gap flagged a few passes back: Stripe customer id now persists
  to `profiles.stripe_customer_id` via the webhook instead of only living
  in one device's localStorage — migration not yet run. Also corrected a
  stale §B4 note that still said the regular-Add-camera visual-match work
  "hadn't started" when it shipped back on 2026-08-08/09.
- **2026-08-11 — Lookup-API safety guards (upcitemdb/Discogs/Metron) + live
  camera zoom.** Full detail in §B10/§B11. Generic permanent-cache +
  daily-budget guard (same shape as PSA's), applied only where a real
  daily cap exists (upcitemdb); Discogs/Metron get the cache plus honest
  429 handling instead of an invented quota. Migration
  `20260811_lookup_api_guards.sql` — **not yet run**, fails open until
  then. Also: feature-detected live pinch/slider zoom on the camera
  preview before capture (`src/hooks/useCameraZoom.ts`), expected to work
  on Android Chrome only — don't be surprised if it shows nothing on an
  iPhone, that's the honest platform limit, not a bug. Same pass also
  finished wiring the Brand field's cloud sync (§B9) now that its
  migration is confirmed run.
- **2026-08-10 — Barcode/QR scanning rebuilt as tap-to-scan (native detector +
  JS fallback), PSA auto-fire bug fixed.** Full detail in §2B above — don't
  re-litigate the engine choice or re-add an always-on effect; the "on-demand,
  bounded burst" design is deliberate, not a placeholder. Confirmed working on
  a real device the same night, after also swapping the fallback decoder to
  `zxing-wasm` — see §2B for the full saga.
- **2026-08-11 — Barcode scans now connect to real lookups** (comic/vinyl/
  UPC/book) across `/capture`, `/vault/add`, and Quick Add, instead of just
  confirming a code was read. Full detail in §2B8 — includes a real
  visibility bug (fixed) and a "no match" message that now names what an
  unmatched code probably is (CGC/PSA-style certificate) instead of reading
  like a failure. The actual "found a real match" success path is still
  unconfirmed on a real device — don't assume it works without checking §2B8's
  open items first.
- **2026-08-08/09 — Regular Add's camera, rebuilt to actually match Quick
  Add** (many rounds — EK's patience on this one is worth documenting so
  the reasoning doesn't get re-litigated from scratch):
  - **Removed the embedded live camera entirely** from the Add screen. It
    used to sit permanently inline next to the builder form (in TWO places:
    a dead "idle" phase nobody could reach, and the default "review" phase
    view before any photo existed) — deleted both, plus the whole dead
    idle/loading/error `phase` state machine that one of them lived in
    (confirmed unreachable: nothing ever set `phase` to anything but
    `"review"` except a button inside the equally-unreachable error
    branch). The Add screen now shows a plain static "Add a photo" tile;
    tapping it opens the camera as its own full-screen popup — the same
    self-contained screen Quick Add uses, never live-embedded in the page.
  - **The popup's actual visual structure now matches Quick Add's, not just
    its behavior**: one header row (was two stacked), no padding/rounded
    corners on the panel itself (header/video/footer each own their edge
    instead), video edge-to-edge (was sitting in its own padded card),
    corner-bracket guide instead of a ring outline, front-facing cameras
    filtered out of the picker (device labels reliably say "facing
    front"/"facing back"). Extracted `DropdownPill` out of
    `ScanCapturePanel.tsx` into `src/components/ui/DropdownPill.tsx` so
    both screens render the literal same dropdown component, not two
    versions that can drift apart — added a Frame picker using it (that
    state already existed in `CameraCapturePanel.tsx`, just had no UI).
  - **Fixed the letterbox bars two different ways before landing on the
    right one.** First tried switching the video to `object-cover`
    (crop-to-fill, like Quick Add) — this broke capture accuracy: a
    capture always grabs the camera's full native frame regardless of how
    it's displayed, so the live preview started showing a tighter crop
    than what actually got saved. Reverted that. Landed on the real fix:
    once the camera's actual aspect ratio is known
    (`videoWidth`/`videoHeight` on `canplay`), the video's own *container*
    is shaped to match it via CSS `aspect-ratio`, instead of sitting in an
    arbitrary flex-sized rectangle — `object-contain` then shows ~zero
    bars because the box already matches the footage, with no cropping
    happening anywhere and therefore no preview/capture mismatch possible.
  - **Confirmed with EK: the remaining small gap when testing is a desktop-
    webcam artifact, not a bug** — a landscape webcam (16:9) squeezed into
    a portrait-shaped popup can't fill it without cropping something,
    full stop. A real phone's rear camera already outputs video shaped to
    match how it's held, so this shouldn't show up there. **Explained why
    Quick Add and Add's camera intentionally use different object-fit
    (`cover` vs `contain`)** — not inconsistent code, two different real
    needs: Quick Add never lets you crop afterward (straight into a batch),
    so cropping the live view costs nothing; Add always has a crop-editing
    step after the photo, where the live view has to show the whole,
    uncropped frame for the crop tool to be trustworthy. **Added this
    explanation as a permanent Guide entry** (`src/app/guide/page.tsx`,
    "Why Add's camera looks different from Quick Add's") so it's answered
    for any user who asks, not just tribal knowledge from this thread.
  - **Added drag-to-reorder to the thumbnail rail** (press, hold, drag any
    photo onto any slot — dragging onto the first slot makes it the cover).
    Generalized the old `makeCover` (front-only) into `reorderImages(from,
    to)`. Pointer events, not native HTML5 drag-and-drop (poor/inconsistent
    touch support) — a plain tap still selects the thumbnail; a press that
    moves past an 8px threshold becomes a drag, with a live green
    drop-target highlight.
  - Also fixed along the way: the "Add a photo — optional" empty-state tile
    was forced into a 4:5 aspect-ratio box sized for showing an actual
    photo, even with nothing to show — now only applies that ratio once a
    photo exists.
- **2026-08-08 — bug-report two-way communication.** EK: resolving a bug
  report should tell the reporter, and EK should be able to reply, not just
  flip a status pill. Built in-app only (EK's explicit call — email would
  need a new third-party service, deferred for now, may revisit later).
  Migration `20260808_bug_report_replies.sql` (confirmed run by EK) adds
  `admin_reply`/`admin_replied_at`/`updated_at` to `bug_reports`. Admin bugs
  page (`/admin/bugs`) now shows any existing reply + a reply composer per
  report. `notificationFeed.ts` gained a new source that reads the
  *reporter's own* rows (RLS already allowed this — `user_id = auth.uid()`,
  wasn't being used) and surfaces a "resolved" or "reply" alert via the
  existing Alerts bell once you resolve or reply.
- **Follow-up (2026-08-05 night), after EK reviewed the orphaned-files report
  and said "do all A/B/C":**
  - **A. Comic barcode/OCR scanner wired in** — `runAiIdentify()` in
    `capture/page.tsx` now runs `scanComicRegionsFromFile()` (from
    `comicBarcode.ts`) in parallel with the existing vision+barcode calls,
    gated on Universe=Pop Culture + Category=Comics already being selected
    (the OCR pass is real CPU cost, shouldn't run on every capture). Results
    merge additively -- comic-derived title/issue number only fill blank
    fields, never overwrite vision's answer; the parsed issue/cover/printing
    breakdown always gets appended to notes. **Not verified against a real
    comic cover** -- please test and report back on accuracy.
  - **B. Dead multi-workspace-switching code removed** — `workspaces.ts`
    trimmed to just `getRoleDefaults` (the one real, used piece);
    `WorkspaceMembersPanel.tsx` + `MemberRoleBadge.tsx` deleted (both fake
    data, zero other importers, confirmed by `tsc` staying clean).
  - **C. Analytics widgets placed on `/portfolio` Insights** — added a new
    "Collection Intelligence" section at the bottom of
    `InsightsOverview.tsx`: `PortfolioIntelligencePanel` +
    `CollectionValuationScoreCard` (both driven by the same `metrics` object
    the page already computes), `GoalsProgressWidget` (added a `goals` state
    + `syncGoalsFromSupabase()` load, this page never touched goals before),
    `SubjectRankingsWidget` (computed straight from the page's existing real
    `items`). All 4 already handle their own empty states.
  - **D. Everything else deleted too** — EK's follow-up call ("just delete
    all of them, same logic as workspace cleanup"): removed the remaining
    ~55 files from the original orphan sweep, including
    `src/lib/analytics/portfolio.ts` and `src/lib/repo/vaultRepo.ts` (the
    "still open" pair above). Before deleting, re-verified the list against
    the CURRENT repo state (not the stale pre-A/B/C sweep) so nothing from
    A/C got caught by mistake, and caught 7 false-positive "still
    referenced" hits from an initial basename grep (generic words like
    "index"/"tokens"/"portfolio" matching unrelated code, not real imports)
    — re-verified each with a precise import-path grep before touching
    anything. Also found one more genuine orphan the original sweep only
    mentioned in passing (`VirtualizedVaultGrid.tsx`). `tsc --noEmit`
    stayed clean after all 55 deletions — nothing referenced any of them.
    **This closes out the entire dead-code review from tonight — nothing
    left flagged.**
- **Third overnight pass (2026-08-05 night), while EK slept — camera fixes,
  pill sweep #2, dead-code cleanup:**
  - **Camera capture (`CameraCapturePanel.tsx`, `capture/page.tsx`,
    `barcodeScanner.ts`, `ScanCropEditor.tsx`)** — a long back-and-forth with
    EK over several rounds (their phone vs. the app's camera, side-by-side
    screenshots). Landed on: (1) throttled the live barcode-scan loop from
    checking all 10 regions x 3 decode variants EVERY ~450ms tick down to a
    round-robin of 2 regions/tick (this was almost certainly the "everything
    feels slow" cause — up to 30 synchronous ZXing decodes every half-second,
    continuously, while the camera was open); (2) found and fixed a real
    regression I introduced earlier the same night: a `deviceId: {exact:...}`
    hard constraint in `getUserMedia()` that could hang for seconds on a
    stale device id before falling back — switched everything to soft
    `ideal` constraints; (3) reverted an ill-advised resolution bump (tried
    1080p then ~4K "ideal" — neither measurably helped sharpness and the 4K
    attempt likely caused a reported "longer than wide" aspect issue by
    requesting an explicit landscape pair); (4) added a dedicated "Take Real
    Photo" button (separate from "Upload", which stayed a plain file/drive
    picker) that hands off to the phone's actual native camera app via
    `capture="environment"`, then routes the result through the same
    ScanCropEditor crop step the in-app camera gets — this is the *honest*
    answer to "why does the photo look worse than my phone's camera": web
    `getUserMedia` structurally cannot reach HDR/multi-frame processing a
    native camera app uses, no constraint tuning closes that; (5) removed the
    7-preset Filter dropdown (all ~5-10% CSS tweaks, indistinguishable from
    each other — confirmed real, just too subtle) and replaced it with one
    real one-tap "Brighten" toggle (sun icon, meaningfully brighter, next to
    the existing background-removal button); Fine Tune sliders stay for
    manual control; (6) fixed the multi-photo thumbnail rail in
    `capture/page.tsx` — tapping a non-cover photo used to do nothing but
    show a tiny "Set cover" button; now tapping ANY thumbnail previews it
    big above with a glowing border, and "Make Cover" is its own explicit
    action shown only when a non-cover photo is selected; (7) trimmed
    repeated "still have to scroll" complaints across several rounds:
    removed the page subtitle entirely, removed CameraCapturePanel's
    duplicate internal header when inline, tightened header-to-content
    margins. Left a temporary on-screen capture-timing readout
    (`captureTiming` state in `CameraCapturePanel.tsx`) in case the ~10s
    complaint isn't actually fully resolved — remove once confirmed fixed.
  - **Pill sweep #2** — ran a fresh Explore-agent sweep (the "finished"
    claims from earlier same-night work + a concurrent session's own "Pill
    sweep"/"PillButton-everywhere" commits were both wrong). Verified before
    touching: confirmed `vltd-primary-button` + `rounded-full` combos
    (login/signup/PublicHomeClient/BugReporter) are NOT bugs -- `vltd-
    primary-button`'s `border-radius:4px` lives in an unlayered stylesheet
    (`vltd-design.css`, plain `import` in `layout.tsx`, not routed through
    Tailwind's `@layer`), which always wins over Tailwind's layered
    `rounded-full` utility per the CSS cascade-layers spec regardless of
    source order -- those already render squared. Fixed 4 real ones: two
    "Close" buttons in `CameraCapturePanel.tsx` (missed by the same night's
    earlier Retake/Save fix), the new "Make Cover" button, 4 Link-styled
    CTAs in `insurance/page.tsx` ("Smart Scan"/"Add manually"/"Back to
    Vault"/"Portfolio"), and 2 in `ai/review/page.tsx` ("View vault"/"Back
    to queue"). If a THIRD sweep ever seems needed, don't just re-trust
    whatever the last "done" claim says -- grep it yourself.
  - **Dead-code cleanup** — ran an Explore-agent sweep for orphaned files
    (zero import references anywhere in the repo) under `src/components/**`
    and `src/lib/**`. It found ~65 candidates and claimed 5 were "old code
    superseded by a live replacement" -- I verified each claim myself before
    deleting anything, and 2 of the 5 turned out to be **wrong**: the
    claimed "live replacement" (`src/lib/analytics/portfolio.ts` and
    `src/lib/repo/vaultRepo.ts`) had zero importers either, so those weren't
    simple old-vs-new swaps. Only deleted what I could personally confirm
    had a real, currently-used replacement:
    - `src/lib/vaultIntelligence.ts` (real replacement: `itemIntelligence.ts`,
      confirmed used in 8+ files)
    - `src/lib/vaultBackup.ts` (real replacement: `RestoreVaultButton.tsx`/
      `VaultExportButton.tsx`, confirmed used in vault pages)
    - `src/lib/sellItem.ts` (real replacement: `vaultActions.ts`/
      `salesModel.ts`, confirmed used in `activity`/`sales`/drop-review flows)
    - `src/lib/vaultRepo.ts`, `vaultRepo.local.ts`, `vaultRepo.api.ts`,
      `vaultRepo.index.ts` (a self-contained 4-file cluster that only
      referenced each other, zero external callers -- deleted the whole
      cluster together; did NOT delete `src/lib/portfolioAnalytics.ts` or
      `src/lib/repo/vaultRepo.ts` since their "replacements" turned out to
      also be unused, so calling either direction "superseded" wasn't
      actually true)
    `npx tsc --noEmit` stayed clean after every deletion -- a real safety
    net here: if any of these had a live importer I'd missed, the build
    would have failed immediately with "cannot find module."
    **NOT deleted, flagged for EK's decision (see §3):** ~55 more orphaned
    files the sweep found, plus a short list of unused exported functions
    inside otherwise-live files (`signUpWithPassword` in `auth.ts`,
    `redeemReferralCode` in `referral.ts`, `removeSaleById` in
    `salesModel.ts`, `getPublicVaultUrl` in `publicProfile.ts`,
    `effectivePricingValue` in `pricingMvp.ts`, and the entire
    multi-workspace-switching surface in `workspaces.ts` which nothing calls
    except `getRoleDefaults`). Several of the orphaned files read as
    scaffolded, never-wired features rather than leftover cruft --
    `comicBarcode.ts` (~380 lines, a whole comic-barcode-scan pipeline),
    `workspaces.ts`'s switching UI, a cluster of dashboard chart/widget
    components (`NeonBarChart`, `NeonDonut`, `MiniSparklines`, `TiltCard`,
    `SubjectRankingsWidget`, `CollectionValuationScoreCard`,
    `PortfolioIntelligencePanel`, etc.) -- didn't want to guess whether these
    are intentional WIP or genuinely abandoned, so left them alone per the
    "ask before removing a feature" rule rather than assume either way.
- **Second overnight pass (2026-08-03 night), while EK slept — production-readiness
  fake-data sweep, prompted by EK asking to check the whole app:**
  - Watchlist "7d change" (`-$2,340`, always shown even empty) — removed, no
    value-history tracking exists for watchlist items.
  - `/more` StatStrip — `"+12.6% (30D)"` and `"276"` followers were static
    literals on every visit (both desktop + mobile stat strips). Now real:
    30D change from `valueHistory.ts` (same fallback pattern
    `InsightsOverview.tsx` uses), followers from `lib/follows.getFollowerCount`.
  - VLT Lounge (`community-board/page.tsx`) — `"128 online"` + the "Lounge
    Live"/"Hot Threads" mock arrays were static, shown to every signed-in user
    with zero backend behind them. Replaced with honest empty states.
  - `goals/page.tsx` — GoalRow "due dates" (`"Due Aug 31, 2025"` etc.) were
    assigned by array index; `GoalProgress` has no due-date field. Removed.
  - `InsightsOverview.tsx` (`/portfolio`) — removed a fake, non-functional
    date-range button (`"Apr 18, 2024 - May 18, 2026"`, no onClick) next to
    the real KPIs; fixed the Total Vault Value card's sub-stat, which
    hardcoded a `+`/green regardless of actual ROI sign and mislabeled
    all-time ROI as "vs last 30 days."
  - `VaultInner.tsx` — reworded a leftover "Existing demo items may not have
    subcategories yet" tip shown to real users with real (non-demo) vaults.
  - `/account/billing` — fixed the hardcoded Free-plan display; see §2I.
  - Ran a parallel Explore-agent sweep across every route in the app (~46
    directories) for the same two bug shapes (hardcoded stat/list literal
    next to real data; demo-seed calls bypassing the `getActiveProfileId()`
    guard). Confirmed clean elsewhere — see git commit messages for the
    full per-directory rundown if you want it.
  - Investigated but deliberately NOT fixed — see §2G, §2H, and the
    `stripe_customer_id` gap noted in §2I. All three need your decision, not
    a guess, before touching them.
  - Verified insurance report/packet/item pages (EK flagged via a suggested-
    task chip) — already correctly guarded, false alarm, no change needed.
  - **Events saved-list sync** (§2F) — added the `saved_events` migration +
    `savedEventsModel.ts` + wired `/events`. Migration not yet run — see the
    ⚠ note in §0.
  - **`/user/profile` real identity fields + display-name sync bug fix** (§2G,
    §2H) — EK confirmed: real self-declared age verification, not ID
    verification. Added the `profiles.date_of_birth`/`age_verified`/
    `marketing_opt_in` migration (not yet run — §0 ⚠), wired `/user/profile`
    to load/save through the real `profiles` row (`updateProfile()` +
    `syncPublicProfile()`), fixed `syncPublicProfile()` to read the real
    display name/avatar emoji instead of the stale local copy, made the fake
    editable email field an honest read-only display of the real login
    email, removed the "Reset to defaults" button (was one click away from
    wiping real cloud-synced fields once they went live), and renamed/scoped
    down "Clear Local Demo Data" so it no longer touches the local vault
    cache under a false "demo" label.
  - Merged `main` in twice mid-session (other work landed on `main` while
    this ran: a "Vision prompt" commit, then a 3-commit "Pill sweep"/
    "PillButton everywhere" migration) — both merges were clean fast-forwards
    with no conflicts, `tsc` verified after each.
- **Follow-up (2026-08-04 night), after EK ran both pending migrations and
  said yes to merging the profile pages + building real email-change:** see
  the rewritten §2H above for full detail — `/user/profile` merged into
  `/account` (Avatar/Identity & Security/Data Controls sections added),
  `/user/profile` now redirects to `/account`, real email-change flow added
  to `/account/security` via `supabase.auth.updateUser({ email })`. `tsc` +
  `eslint` clean (only pre-existing React Compiler try/finally advisories,
  same shape already present elsewhere in these files). Also matched the
  concurrent emoji-sweep pass below: swapped the one "Verified ✅" chip
  copied into `/account`'s new Age Verification section for the themed
  `Glyph` (`check`) treatment.
- **Third overnight pass (2026-08-03, after the above two), EK asleep again —
  emoji sweep + Documents feature:**
  - **Emoji sweep**: replaced raw emoji glyphs with the themed `Glyph`
    component across `UniverseRail.tsx`, `account/page.tsx`,
    `onboarding/page.tsx` (the three remaining raw `UNIVERSE_ICON[key]`
    sites), `ai/drafts`/`ai/review` missing-fields warning chip, the museum
    Announce button, `ThemeToggle`, `CameraCapturePanel`'s soft-image
    warning, the auction countdown chip, the public profile's
    vault-not-found lock icon, `vault/readiness` (missing-thumbnail + empty-
    state icons), `TopNav`'s museum nav-card icon, the public `share/[itemId]`
    missing-image placeholder, `account/billing`'s plan-star icon,
    `ScanVerifySheet`'s AI-disagreement flag, `user/profile`'s two "age
    verified ✅" chips, and `vault/item/[id]`'s Export-for-Social/
    Start-Auction/Registry-collector-count icons (+ updated `guide/page.tsx`'s
    doc text that quoted the old raw emoji). Deliberately left alone:
    `vault/frames/page.tsx`'s "⭐ Key Item"/"🔥 HOT" stickers — that screen
    rasterizes the live DOM to a downloadable PNG via html2canvas, so
    swapping to an SVG glyph risks a compositing regression in the exported
    image I can't verify without opening a browser; needs a visual pass, not
    a blind edit. Also not touched: `kickstarter/page.tsx`'s 🚀 (no themed
    glyph is a good semantic match for "rocket" yet), and the longer tail of
    more speculative/design-heavy sites (shop.tsx's ~34 product icons,
    HomeClient's social-platform brand icons, SeasonalBanner's decorative
    seasonal icons, v/[profileId]'s expanded UNIVERSE_EMOJI map) — all need
    real visual judgment, not a mechanical swap.
  - **Documents (§2C) — built, see that section.** EK's answer ("everything
    should be private unless shared") was a clear enough steer to build
    local-only rather than a decision that needed a Supabase dashboard call.
  - Dropped two recurring asks per EK's explicit feedback: the
    background-removal-freeze device check and the "Syncing…" chip styling
    ask — EK said twice they don't know what these mean; not re-raising them.
  - **Full-width pill/dropdown sweep — the 4 known offenders, fixed:**
    `EventTypeSelect` (`events/page.tsx`) was stretched via a
    `grid-cols-[minmax(0,1fr)_170px]` container next to the fixed-width
    "Saved Events" button — switched the container to `flex flex-wrap` and
    the select to `w-auto`. `WishlistCard`'s "Move to Vault" and
    `GoalCard`'s "Add N to Want List" both had `flex-1` while their sibling
    buttons didn't — dropped `flex-1`, added matching padding. Checked and
    ruled out a 5th suspected site: `VaultWallView.tsx`'s Advanced-filters
    Status `<select>` — its `w-full` matches every sibling text input in
    the same filter grid (Grade/Category/Storage/Source), a genuine
    uniform filter-form pattern, not a stretched pill. Left alone.
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
- **`CHECKLIST.md`** (repo root) — scannable done/pending list of everything
  from the 55-file dead-code sweep through tonight's barcode/Cards/PSA/
  Discogs work, plus a clear "what needs EK's action right now" list at the
  bottom. Update this alongside HANDOFF when a checklist item's status
  changes — it's meant to stay a quick scan, not prose.
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
- **`GRADING_AND_PRICING_APIS.md`** (repo root) — living reference (not a
  handoff note, keep it updated) for which grading companies/categories have
  a real cert-lookup or pricing API wired in vs. free-text-only, and what's
  being explored (CardHedge for cards) vs. ruled out (CGC's own dealer-only
  API, Apify scrapers). **CGC-graded comics are explicitly unaddressed** —
  don't let that get lost; PSA never covered comics to begin with (they
  don't grade comics), so it's not something the PSA work already solved.

---

## 6. First moves for the new chat
1. Read this + `MEMORY.md`. Confirm with EK **who owns `/capture` right now**
   (this chat vs the parallel Codex edits) before editing capture files. Also
   re-check the new not-this-chat's file list in §0 (Aug 11) before touching
   anything under `museum/`, `owner-lab/`, or the repo-root `marketing/`/
   `product/` folders.
2. No migrations pending — the Stripe customer-id migration (§2I) and the
   lookup-API guard migration (§B10) are both confirmed run. Cross-device
   billing (Payment method/Invoices/Cancel) is live; worth a glance at
   `profiles.stripe_customer_id` after the next real Stripe checkout to
   confirm it's actually populating (webhook logic was verified by
   reading, not by triggering a real checkout event).
3. Ask EK what they found testing overnight: does the digital-zoom
   fallback work on desktop/iOS now (§B11)? Does zooming out actually
   switch to a real ultra-wide lens on any Android phone that has one
   (§B11's newest addition, `cameraLenses.ts` — completely unverified on
   real multi-lens hardware, watch for a misclassified/wrong-lens report)?
   Did a real barcode/UPC/vinyl/comic scan actually fill fields (§B8's
   still-open "found a match" success path)? Does scanning stay cool over
   repeated bursts since the zxing-wasm swap (§B)?
4. Then whichever open §3 decision or §2 item EK wants to pick up next —
   PSA's "approved customer" block (§B3, needs EK emailing PSA directly) and
   a CGC lookup (confirmed still fully unbuilt) are the two biggest gaps on
   the grading-lookup side if EK asks what's left there.
5. Verify each **visually** on `vltd.vercel.app` (screenshot; resize for mobile).
   `tsc`/`eslint`/`build` before every push. Deploys are slow — preview CSS-only
   tweaks via live JS injection to iterate faster.
