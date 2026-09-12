# Museum Builder — first-round fixes and feature gaps — 2026-09-12

EK tested `/museum/builder` (built in commit `c9a7d55`, nav entry point in
`282787c`) and gave direct, itemized feedback. Read this alongside
`docs/MUSEUM-BUILDER-NEW-PAGE-2026-09-12.md` (the original work order) —
this is a follow-up correction pass on that same page, not a new feature.

Start from the latest `origin/main`. Read `src/components/gallery/MuseumBuilder.tsx`,
`src/lib/museumRoomFurniture.ts`, `src/lib/campusRoomBuilder.ts`, and
`src/lib/galleryRoomSlots.ts` before changing anything.

## 1. Camera: "I still need to be able to scroll around the room"

Museum Builder's camera is currently a single fixed vantage point with
drag-to-look only (ported from `MuseumRoomPopup.tsx`, which is fine for
that smaller popup but not enough here). EK needs to actually move around
the room, not just rotate in place — add real movement (scroll-to-step
forward/back at minimum, ideally WASD too), reusing the real movement/
collision math already built for the walkable museum
(`src/lib/visitorController.ts` — the same module already imported here
for `applyDrag`/`aimCamera`) rather than inventing new movement code.
Keep the camera inside the room (soft collision against its own walls is
fine; this doesn't need doorway-to-doorway campus navigation, just not
clipping through a wall).

## 2. Wall items don't line up or size like the 3D gallery

EK's screenshot of a GAMES room shows two framed items stacked with
mismatched horizontal alignment and inconsistent sizing — nothing like
the neat, evenly-spaced grid the personal Gallery Builder produces. Root
cause to fix: Museum Builder currently positions wall items along a
continuous, proportional-by-span distribution
(`computeRoomPlacementSlots`/`distributeAcrossSpans` in
`campusRoomBuilder.ts`), which is correct for spacing items ALONG a wall
but was never combined with a real, fixed VERTICAL row system — so
stacked items land at whatever height the code happens to compute instead
of a shared, consistent band.

The personal Gallery Builder already has exactly this: `SHELF_ROW_Y` in
`src/lib/galleryRoomSlots.ts` is a hand-tuned array of exactly 3 fixed
row heights (`[4.72, 3.22, 1.72]`, refined over multiple real EK
corrections — read that file's own comments, they explain why these
specific numbers), and `shelfItemY(row, scale)` converts a row index to
an actual Y position. Reuse this — or a value/units-adapted version of
it if the museum's rooms use a different floor-to-eye scale than the
personal Gallery's fixed room dimensions — as the vertical axis for every
wall item, combined with the museum's own per-wall horizontal
distribution (which is correct and room-geometry-aware already; keep
it). The result: every item in the same row sits at the exact same
height as every other item in that row, on every wall, matching the
personal Gallery's own look. Also check and fix item frame sizing
consistency (`maxWidth`/`maxHeight` in `PlacementSlot` and however
`museumRoomFurniture.ts`/`placeItemsAtSlots` use them) — items should be
framed and scaled consistently the way the personal Gallery's items are,
not each sized independently in a way that reads as arbitrary.

## 3. Row count control: Single / Dual / Three row

New control (Museum Builder only, per room): a Single / Dual / Three-row
selector.

- **Single row**: all wall items centered in one row (use the middle
  `SHELF_ROW_Y` height, or an equivalent single centered height).
- **Dual row**: two rows, evenly spaced (e.g. the top and bottom of the
  3-row set, or a re-derived even split — use judgment, but both rows
  must be internally consistent the same way row 2 fixes above requires).
- **Three row**: matches the personal Gallery's own current look (all
  three `SHELF_ROW_Y` heights in use) — this is the current visual
  target EK is asking for as the "looks like the 3D gallery" option.

This choice should regenerate the room's item slot layout live (same
capacity, redistributed into however many rows are selected), independent
of the existing wall/shelf/case item-count sliders — those control HOW
MANY items, this controls how they're arranged into rows.

## 4. Shelves checkbox

A checkbox: when checked, wall items show a physical shelf board beneath
them (reuse the shelf furniture already ported into
`src/lib/museumRoomFurniture.ts` in the original Museum Builder pass —
same board mesh/material, don't rebuild it). When unchecked, items are
mounted flat on the wall with no shelf board at all (frame only,
directly against the wall) — this is a pure visual toggle on the existing
wall-item slots, not a different slot system; it should not be confused
with the separate "Shelf items"/"Case items" capacity sliders that
already exist for actual shelf-resting/case items (those are a different,
already-working feature — leave them alone).

## 5. Remove the invented "Background" color-swatch dropdown; reuse the real Wallpaper feature

EK, after seeing Museum Builder's "BACKGROUND: Neutral (default) / Warm
Ivory / Cool Slate / Charcoal" dropdown: "this entire section should have
carried over, not the strange custom interior colors you created just
for the museum." She's pointing at the personal Gallery Builder's actual
Room panel (Room/Map tabs, Store/Salon/Hero style tabs, the Vault source
dropdown, Values checkbox, Wallpaper button) as what should have been
reused. Some of those concepts don't have a real museum equivalent (a
museum room has one canonical real shell/finish, not selectable
Store/Salon/Hero GLB styles) — don't invent a fake mapping for those; if
a control has no honest equivalent, leave it out and say so in your
report rather than guessing.

What IS unambiguous and must change: delete the invented preset color-
swatch system (`ROOM_BACKGROUND_OPTIONS`/the "BACKGROUND" dropdown UI in
`MuseumBuilder.tsx`) entirely. Keep only the real background mechanism —
a custom wallpaper image upload — and make it look/behave like the
personal Gallery's own actual "Wallpaper" button/flow
(`handleWallpaperUpload`/`fileToRoomWallpaper`/`uploadHallWallpaper` in
`VirtualGalleryRoom.tsx`), not a separate bespoke button. Museum
Builder's own custom-image upload already calls the same
`uploadHallWallpaper()` function into the same Storage bucket — it's the
color-swatch preset system sitting alongside it that needs to go, along
with `setRoomBackground`/`background_id` wherever it's only used for
that now-removed preset list (leave the DB column/migration alone if
already written; just stop offering fake presets through it).

## Do not change

Same constraints as the original work order: the personal Gallery Builder
at `/museum/virtual-room`, `MuseumRoomPopup.tsx`, the walkable public
museum's real geometry/doors/floor targets/lighting/camera-collision, and
`museum_room_items`/`museum_room_meta`'s existing rows and the museum's
own live-display read path. The owner-only gate on `/museum/builder`
stays exactly as built.

## Verification and process

Any new/altered migration: write the file, paste the full SQL in the
report, do not run it. Note: `20260912_museum_room_capacity_and_background.sql`
from the prior pass is still pending — EK has been told to run it but
may not have yet; anything reading its columns must still fail soft.

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed
file, `npm run build` — all clean. Commit and push to `main` once
verified clean. Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry.

In the final report: confirm the Gallery Builder and `MuseumRoomPopup.tsx`
are unaffected (diff-stat), describe exactly what row-height/positioning
logic you reused vs. adapted from `galleryRoomSlots.ts`, confirm the
color-swatch system is fully removed (not just hidden), and give
tsc/eslint/build results plus the exact commit(s). Do not claim live
browser verification. Do not declare this accepted or ready for EK's
test.
