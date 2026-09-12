# Shared Museum Room Editor — Overnight Work Order — 2026-09-12

## Purpose

Turn the existing Museum Map (`MuseumCampusOverview.tsx`, inside the Gallery
Builder) into the real control center for customizing every room of the
**shared, public** VLTD Museum at `/museum/vltd`. Clicking a room's edit
control must open that room's actual 3D geometry in an editing mode — not a
flat form, not a mock/preview room — where an admin places, moves, and
removes real vault items directly on that room's real walls, the same way
**Organize** already works for a personal Gallery.

This is a complete overnight implementation and production-verification
pass. Do not stop after one room, one wall, or a non-functional preview.
Finish the full flow end-to-end in SPORTS first, verify it there, then
extend the same reusable placement engine to every other room using that
room's own real geometry.

## Starting point

- Start from the latest `origin/main`. At the time this brief was written,
  the known production baseline was commit `748bce1`.
- Production review route for the Map: `https://vltd.vercel.app` → Gallery
  Builder → Map tab.
- Production review route for the shared museum itself:
  `https://vltd.vercel.app/museum/vltd`
- Read `APP_MAP.md`, the newest museum entries in `HANDOFF.md` and
  `CHECKLIST.md`, and this file before editing.

### What already exists — build on this, don't duplicate it

- `src/components/gallery/MuseumCampusOverview.tsx` — the Map. Each real
  gallery room already has a working edit badge that opens
  `RoomEditorModal`.
- `src/components/gallery/RoomEditorModal.tsx` — the current room editor.
  It is a flat popup form today (title/description fields, and an item
  list with manually-typed title + image URL). **This is the piece being
  replaced/upgraded by this work order** — the title/description editing
  can stay as-is or move into the new flow, but "+ Add item" must no
  longer be a plain form; it must open the real 3D room.
- `src/lib/museumCampusConfig.ts` — `getEnabledRoomItems`, `getAllRoomItems`,
  `getRoomMeta`, `getAllRoomMeta`, all reading/writing `museum_room_items`
  and `museum_room_meta` (both live tables, migrations already run by EK).
- `src/lib/campusLayout.ts` — `CAMPUS_ROOMS`/`CAMPUS_DOORS`, the single
  source of truth for every room's real position, dimensions, and doors in
  the shared museum. Also has EK's own doorway-aligned navigation targets —
  **do not touch these**.
- `src/lib/campusRoomBuilder.ts` — `computeUsableWallSpans()`,
  `placeArtwork()`, `hangArtPreservingAspect()`, `buildSharedWall()`,
  `buildNeutralShell()`/`buildRoomShell()`. This is the existing, working,
  aspect-ratio-preserving wall-space/placement math for SPORTS today (an
  automatic focal-wall + supporting-wall layout, not manual placement) —
  **the per-room placement-position model this work order asks for should
  extend/reuse this geometry, not replace it with something disconnected**.
  SPORTS currently reads from `museum_room_items` and lays items out
  automatically via this module; that automatic layout becomes the
  *default* arrangement, and this work order's editor is what lets an
  admin see and override individual positions on top of it.
- `src/components/gallery/VirtualGalleryRoom.tsx` — the **personal** Gallery
  Builder's own room, with a working **Organize** overlay: numbered slots
  drawn over the real 3D room, drag-and-drop placement, explicit per-slot
  assignment. This is the interaction pattern EK wants mirrored for the
  shared museum's own rooms — read how Organize numbers/highlights slots
  and handles drag/drop before designing the shared-room version. Do not
  modify this file's own personal-Gallery behavior.
- `src/app/museum/vltd/page.tsx` / `VltdMuseumCampus.tsx` — the real walkable
  3D shared museum. Already supports a `?room=<CampusRoomId>` query param
  that spawns the camera at that room's center (added 2026-09-12, commit
  `3e878d1`) — the new editor's "start the camera inside the selected room"
  requirement can build on this rather than reinventing spawn logic.

## Accepted baseline — preserve it

- The Map's current layout, room-click-to-view behavior
  (`/museum/vltd?room=<id>`), legend, Universe Map / Back to Room / Enter
  VLTD Museum controls.
- The personal Gallery Builder's own Organize behavior, room/map tabs,
  Source selection, style controls, Values, Wallpaper.
- The shared museum's movement, camera, collision, door positions/sizes,
  room dimensions, floor targets (doorway-aligned navigation targets — do
  not touch), door signs' visual style, existing lighting.
- `museum_room_items` / `museum_room_meta` and everything currently reading
  them (the museum's own live display of SPORTS content).

Do not change:

- Museum movement, scrolling, camera behavior, or collision.
- Door positions, sizes, or `CAMPUS_DOORS`/`CAMPUS_ROOMS` geometry.
- Existing lighting.
- The personal Gallery's own Organize behavior or its data model.
- Museum Map sizing or layout.
- Personal Hall-to-museum linking must **not** return in any form — every
  shared room's content is admin-curated and identical for every visitor,
  never account-dependent. (See `HANDOFF.md`'s 2026-09-11 entry on why this
  was reverted once already — commit `fe56c33`/`3b61120`.)

## User flow

1. Open the Museum Map.
2. Click a room's edit control (the existing edit badge).
3. A small room-editing area appears (can be the existing `RoomEditorModal`,
   extended, or a lighter launcher) showing:
   - Room name
   - Current item count/capacity (e.g. "5 / 8")
   - **Add Items / Edit Room** control
   - **Background** control
   - **Enter Museum** link
4. Clicking **Add Items / Edit Room** opens that actual 3D room in an
   editing mode — the real `/museum/vltd` room, not a mock/preview,
   similar in spirit to Organize in the personal Gallery.
5. The admin places and moves items while looking at the real room.
6. **Done** saves and returns to the Map.

## The 3D room editor

Must use the real shared museum room, not a generic preview or separate
mock room.

- Start the camera inside the selected room (reuse the existing
  `?room=` spawn logic in `VltdMuseumCampus.tsx`).
- Show available placement positions on the room's actual walls.
- Empty positions show a numbered **+** control.
- Occupied positions show the item and a numbered **−** control.
- Clicking **+** opens a visual item picker (see below).
- Selecting an item places it into that exact position.
- Clicking **−** removes it from the museum room only — it must never
  delete the underlying vault item.
- Items can be moved between valid positions.
- Dropping onto an occupied position asks before replacing or swapping.
- Invalid positions cannot accept an item.
- Long-press and drag must work on tablets and phones.
- Provide keyboard-accessible move controls (this is a public-facing admin
  tool, not just mouse-only).
- Autosave changes and show **Saving**, **Saved**, or **Save failed**.
- **Done** finishes editing and returns to the Map.

## Per-room placement position model

Do not hardcode one wall layout and reuse it for every room. Generate
placement positions from each room's real geometry:

- Actual wall lengths and orientation.
- Doorway locations and widths.
- Corners.
- Signs and trim.
- Existing floor targets.
- Protected logos and focal features (e.g. the HUB medallion).
- Required walking clearance.

Placement positions must never overlap:

- Doors or door trim.
- Room signs.
- The VLTD floor logo.
- Navigation targets.
- Corners.
- Other artwork.
- Reserved walking paths.

Use the **same** placement-position data for both the editor and the
museum's own displayed layout, so the two can never disagree — this likely
means extending `computeUsableWallSpans()`/the SPORTS placement logic in
`campusRoomBuilder.ts` into a shared, numbered-position generator rather
than keeping the editor's math separate from the display's math.

Support the appropriate walls in every room, including rooms with multiple
doors or unusual dimensions — every room's real shape comes from
`CAMPUS_ROOMS`/`CAMPUS_DOORS` already; use that, not a copy.

## Item picker

Use real items available to the administrator through the existing
vault/item source (however admin item lookup already works elsewhere in
this codebase — do not build a second, parallel item source).

- Show thumbnails and titles.
- Include search and useful filters.
- Do not require manually pasting image URLs.
- Selecting a vault item adds it to the shared museum configuration
  (`museum_room_items`, or its evolved schema if this work order needs to
  extend that table — e.g. adding a `position_id`/slot reference).
- Museum content must remain the same for every visitor — never fill a
  room automatically from the current visitor's own vault.
- Do not create placeholder or synthetic items.

## Room backgrounds

Add the same background/wallpaper selection concept already used by the
personal 3D Gallery page (`VirtualGalleryRoom.tsx`'s own Wallpaper
control) — reuse that system's assets/pattern, don't invent a second one.

From the selected room's editor:

- Open **Background**.
- Show the existing available wall/background designs visually.
- Preview the selection in the actual 3D room.
- Save the choice independently for that museum room.
- Changing SPORTS must not change COLLECTION, CARDS, HUB, or any other
  room.
- Include a safe default and a reset-to-default option.
- Preserve doors, signs, trim, lighting, floors, and ceilings unless the
  selected existing background system already controls them.

## Room names

Allow an administrator to edit the displayed room name from the selected
room's editing area (this already partly exists via `museum_room_meta` /
`RoomEditorModal`'s title field — extend it, don't duplicate it).

The updated name must appear consistently on:

- The Museum Map.
- The sign over the door.
- The room editor.
- Any room title shown inside the museum.

Do not change stable internal room IDs (`CampusRoomId`) when the displayed
name changes — `museum_room_meta.room_id` stays the stable key; only the
display title changes.

## Database migrations

Any new/altered tables (e.g. a slot/position table, a per-room background
selection column or table) must be written as a migration file under
`supabase/migrations/` **and** pasted inline in the morning report — EK
runs every migration by hand and must see the exact SQL, not just a file
path. Do not assume a migration has run; gate any feature that depends on
a new column/table so its absence fails soft (same pattern already used
throughout `museumCampusConfig.ts`).

## Implementation order

1. Confirm production and source are on the same current commit before
   starting.
2. Preserve the current Map and personal Gallery behavior.
3. Build the reusable room-placement model from actual campus geometry.
4. Complete the entire editing flow in SPORTS first.
5. Verify SPORTS from all three doors (HUB, COLLECTION, CARDS) and the
   room center.
6. Once SPORTS works, enable the same editor for the remaining rooms using
   their own geometry.
7. Add room-specific backgrounds.
8. Add editable display names (extending the existing `museum_room_meta`
   flow).
9. Test desktop, tablet, and phone.
10. Push, deploy, and confirm the production deployment is **Ready**
    before ending the pass.

## Do not change

- Museum movement or scrolling.
- Camera behavior.
- Collision.
- Door positions or sizes.
- Room dimensions.
- Floor targets (EK's doorway-aligned navigation targets).
- Door signs or their visual style (beyond the room-name text itself
  updating when an admin renames a room).
- Existing lighting.
- The personal Gallery's Organize behavior.
- Museum Map sizing or layout.
- Personal Hall-to-museum linking must not return in any form.

## Required morning report

Report separately:

- Implemented.
- Verified locally.
- Verified in production.
- Rooms fully enabled.
- Rooms still pending.
- Any blockers.
- Production commit and deployment status.

Do not report a feature as live unless its Vercel production deployment
shows **Ready** and the production page was opened afterward to confirm.
