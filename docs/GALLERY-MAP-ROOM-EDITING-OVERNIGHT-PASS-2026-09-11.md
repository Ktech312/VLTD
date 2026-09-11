# Gallery Map and In-Room Editing — Overnight Work Order — 2026-09-11

## Purpose

Clean up the Gallery Builder's Map view and make it the useful entry point for managing rooms. Remove the duplicate shelf-management UI around the room, enlarge the real campus map to the full space EK marked, and move item placement into the numbered positions already shown by **Organize** inside the 3D room.

This is a complete overnight implementation and production-verification pass. Do not stop after hiding one sidebar, enlarging only the SVG, or wiring a sample slot. Apply the finished shared behavior to every room and every real room slot supported by the Gallery Builder.

## Starting point

- Start from the latest `origin/main`. At the time this brief was written, the known production baseline was `8e2cb7c`.
- Production review route: `https://vltd.vercel.app/museum/virtual-room`
- Gallery Builder component: `src/components/gallery/VirtualGalleryRoom.tsx`
- Data-driven campus map: `src/components/gallery/MuseumCampusOverview.tsx`
- Campus layout source: `src/lib/campusLayout.ts`
- Read `APP_MAP.md`, `HANDOFF.md`, and this file before editing.

The public walkable campus at `/museum/vltd` is a separate surface. Its room geometry, navigation, targets, doorways, lighting, signs, and finishes are outside this work order.

## User-approved product direction

The map itself stays visually clean. Each room shows only high-level information:

- room name;
- occupancy and capacity in the form `25 / 35 items`, meaning 25 occupied positions out of 35 total positions.

Do not fill the map with thumbnails, item lists, collection value, tier labels, wing names, or editing controls. Detailed work happens after selecting a room.

The current **Arrange Shelf Order** sidebar duplicates the room and consumes too much space. Its behavior should move into the real numbered slots displayed inside the 3D room when **Organize** is active.

Desktop remains the primary experience, but every action in this work order must also be usable on tablets and phones.

## Accepted baseline — preserve it

- The real 13-room, 20-door floor plan is generated from `CAMPUS_ROOMS` and `CAMPUS_DOORS`.
- The map is rotated horizontally with the entrance on the left.
- The room and map tabs, Source selection, room style controls, Values, Wallpaper, **Universe Map**, and **Back to Room** work.
- The 3D room's click, drag, item focus, camera movement, and wall-slot ordering currently work.
- Public-campus movement and room-alignment targets have been accepted for now.
- The shared public-campus doorway-sign design is already implemented elsewhere and is outside this pass.

Do not change:

- `/museum/vltd` or `VltdMuseumCampus.tsx`;
- `visitorController.ts`;
- campus room bounds, `CAMPUS_DOORS`, or shared-wall geometry;
- public-campus room themes, lights, doorframes, floor medallion, navigation targets, or controls;
- the meaning of existing saved Hall/exhibition data;
- vault items themselves when removing an item from a room.

## Work order

### 1. Expand the outer Map workspace to EK's marked boundaries

The blue lines in EK's screenshot describe the **outer main room/map workspace**, not merely the SVG inside it.

On desktop, the workspace must:

- begin immediately below the Source/Room controls;
- begin at the content edge beside the left identity/source area;
- extend across the width currently occupied by the map and the right Floorplan sidebar;
- extend down close to the bottom of the visible viewport;
- use that full area for the map without horizontal or vertical scrolling.

Do not keep the old approximately 600px-tall parent and only scale the SVG within it. Fix the parent grid, section sizing, and map component sizing together. The map must visibly have more room to breathe.

The plan remains rotated horizontally with the entrance on the left. Preserve each room's relative geometry and every doorway position; do not stretch individual rooms independently to fill space.

At common desktop sizes, center and scale the full plan to occupy most of the available workspace while retaining a modest internal margin for labels and focus outlines.

### 2. Remove map information that does not help the user

Remove from the Map view:

- the `13 rooms · 20 doors` badge;
- the entire right-side **Floorplan / Universe Rooms** panel;
- Vault Pieces and Vault Value metrics in that panel;
- the Overview / Rooms / Public segmented row;
- the duplicate room list and external-link icons;
- any empty grid column or reserved width left behind by that panel.

The door count is implementation information and must not be replaced somewhere else.

Keep the useful navigation already over the workspace:

- **Universe Map**;
- **Back to Room**.

The existing map legend may remain only if it still helps once the plan is larger and does not materially reduce the map's usable height. If it is redundant at the final scale, simplify or remove it.

### 3. Make the room cards clean and useful

Every real room shape on the map must remain selectable with mouse, touch, and keyboard.

Each room displays:

- its editable display name;
- one compact occupancy line: `occupied / capacity items`.

Example: `25 / 35 items` means 25 real slots contain items and 10 positions remain open.

Requirements:

- Both values come from the same actual room-slot data used by the 3D room and saved order.
- Do not infer capacity from the number of vault items assigned to a universe.
- Do not count an item twice if the storage model contains stale or repeated references.
- The count updates after a successful add, move, replace, or remove operation.
- Empty/future rooms still show a truthful capacity state when their slot template exists.
- If a room has no editable slot template yet, show a restrained unavailable state rather than inventing a capacity.
- Do not show value, tier, wing, thumbnails, or per-item metadata on the map.

The full room shape is the interaction target. Provide a visible hover/focus state and an accessible label containing the room name and capacity.

### 4. Replace the right panel with a room-focused Edit Room flow

Selecting a real editable room opens a compact **Edit Room** experience that visually belongs to the Gallery Builder. It can occupy the main workspace or use a responsive drawer/sheet, but it must not recreate the removed permanent sidebar.

The first useful version must support:

- editing the room's display name;
- entering its 3D room;
- adding, removing, and moving items using the room's real slots;
- choosing the existing supported wall finish or wallpaper controls;
- a clear **Done** action that saves pending work before returning to the map;
- a small, calm `Saving…`, `Saved`, or actionable error state.

Do not build a second independent wall-layout editor. **Edit Room** must enter or control the same room and same slot state rendered in 3D.

Room names are dynamic data. Do not bake names into map artwork, static textures, or sign assets. A saved name change must update every applicable dynamic label that consumes that room's display name.

If the existing persistence model does not yet have a safe field for per-room custom names, do not improvise a local-only value that disagrees across devices. Document the exact missing persistence path and complete the rest of the editor; clearly mark name editing unavailable until it can save correctly.

### 5. Remove the Arrange Shelf Order sidebar

Remove the complete left **Arrange Shelf Order** section from the normal Gallery Builder layout, including its wall headings, miniature numbered grid, and separate Save Hall placement at the bottom of that tall sidebar.

Do not merely hide it in Map mode. The duplicate shelf-management surface is being retired in favor of in-room organization.

After removal:

- reclaim its desktop width for the main room/map workspace;
- ensure no parent grid still reserves the old approximately 300px column;
- remove dead code only after confirming the in-room replacement covers every existing action;
- retain the existing vault picker and persistence functions where they can be reused by the in-room controls;
- move any still-required explicit save action near **Organize/Done**, unless autosave fully replaces it.

### 6. Make the 3D Organize slots directly interactive

When **Organize** is active, the numbered overlays in the actual 3D room become the source of truth and the primary editing interface.

#### Occupied slot

- Show the normal item and its location number.
- The number remains a location label, not a separate primary button.
- Clicking or tapping the item selects it.
- Selection reveals a small `−` action associated with that item/slot.
- The `−` action removes the item only from the displayed room.
- Removing from a room must never delete the underlying vault item, its media, or its metadata.
- Pressing/holding and dragging the item lets the user move it to another valid numbered slot.

#### Empty slot

- Keep its location number visible.
- Show a clear `+` because no item exists to select.
- Clicking/tapping `+` opens the existing vault-item picker scoped to that exact slot.
- Adding multiple items may fill subsequent valid open positions only when that behavior is clearly explained and preserves the existing picker contract.

#### Moving and replacing

- During a move, visibly highlight valid destination slots.
- Invalid destinations never accept the drop and never change saved state.
- Dropping on an empty valid slot moves the selected item there.
- Dropping on an occupied valid slot does not silently swap, overwrite, or remove anything.
- Ask: `This position already contains [item]. Replace it?`
- Actions: **Replace** and **Cancel**.
- On Replace, the dragged item takes the destination slot and the replaced item returns to the vault/unassigned pool. It is not deleted.
- On Cancel, the original room arrangement remains unchanged.

All slot numbers, displayed items, picker destinations, drag targets, keyboard destinations, save payloads, and map capacity counts must use the same canonical slot identifiers.

### 7. Autosave and Done behavior

Autosave is preferred for every successful add, move, replace, remove, wallpaper, and name operation.

Requirements:

- Coalesce rapid edits so they do not create overlapping or out-of-order writes.
- Show a small `Saving…` state while a write is pending and `Saved` after it succeeds.
- Do not report `Saved` until the real persistence call succeeds.
- On failure, preserve the user's unsaved arrangement in memory and show a clear retry state.
- **Done** waits for a pending save, confirms success, exits Organize, and returns to the appropriate room/map view.
- Navigating away while a save is pending must not silently discard changes.
- Reuse the current Hall/exhibition save behavior and ownership rules; do not create a conflicting local-only save format.

If manual **Save Hall** is still required for a new scratch room that has never been named, keep that creation step explicit. Once a real Hall exists, normal edits should autosave.

### 8. Keyboard and screen-reader fallback

Every operation must be possible without drag-and-drop:

- Tab to a displayed item or empty slot action.
- Enter/Space selects or opens it.
- Selected occupied items expose **Move** and **Remove from room**.
- **Move** opens a list/grid of valid destination slot numbers using the same canonical IDs.
- Occupied destinations are identified and trigger the same Replace/Cancel confirmation.
- Focus returns predictably after picker, confirmation, save, or cancellation.
- Announce save results and room-only removals with a polite live region.

Avoid relying on hover to reveal the only available action.

### 9. Tablet and phone behavior

Use the same underlying commands on every device; only the presentation changes.

#### Desktop

- Click to select.
- Drag selected items to highlighted slots.
- Keyboard Move/Remove fallback.

#### Tablet and touchscreen laptop

- Tap selects an item or activates an empty `+`.
- A short, intentional press-and-hold starts item dragging.
- Use a movement tolerance so a normal tap does not become a drag.
- Once an item drag begins, it must not rotate the 3D camera or scroll the page.
- Dragging blank room space continues to control the camera.
- Destination hit areas remain usable in portrait and landscape.

#### Phone

- Direct dragging may remain available when it is reliable.
- Always provide the simpler **Move to position…** destination list.
- Picker and confirmation use a bottom sheet or similarly contained responsive surface.

All interactive controls need a minimum effective touch target of approximately 44×44 CSS pixels. Invisible hit-area padding is acceptable as long as adjacent actions do not overlap.

Preserve pending edits and selection sensibly through orientation changes. Do not allow a viewport resize to duplicate or lose an item.

### 10. Keep the implementation shared and data-driven

Before adding new state, trace the existing functions that already manage:

- `selectedIds` and slot ordering;
- slot display numbers;
- `toggleItem`;
- slot picker selection and `fillFromSlot`;
- Hall/exhibition persistence;
- wallpaper persistence;
- owner versus guest behavior.

Extract a small set of shared room-edit commands if necessary, such as add, move, request replacement, confirm replacement, remove-from-room, and save. The desktop drag flow, touch flow, keyboard flow, and old persistence layer must all call these same commands.

Do not maintain separate visual slot arrays for the sidebar, 3D room, keyboard picker, and capacity count.

Guest/read-only rooms must not expose Organize, add, remove, rename, wallpaper, or save controls.

## Required verification before deployment

### Source and automated checks

- TypeScript passes.
- Targeted ESLint passes for every edited file.
- Full production build passes without relying on a concurrently running dev server.
- No dead imports/components remain from the removed sidebar or right map panel.
- Existing saved Hall/exhibition payloads still load.
- Room capacity is derived from the same canonical slots used in the 3D room.
- Removing from a room leaves the vault item intact.
- Replace/Cancel is deterministic and cannot lose either item.
- Guest mode remains read-only.

Add focused tests only where they protect real data behavior: slot command semantics, occupied replacement confirmation, room-only removal, capacity calculation, and write ordering. Do not add shallow tests that simply duplicate JSX.

### Desktop visual review

At the production route, verify with a real signed-in room:

- The outer workspace reaches the blue-line boundaries: below the controls, beside the left edge, before the former right panel edge, and near the viewport bottom.
- The map is visibly larger, horizontally oriented, entrance on the left, fully visible without page-internal horizontal or vertical scrolling.
- No width remains reserved for either removed sidebar.
- The `13 rooms · 20 doors` badge is gone.
- The right Floorplan/Universe Rooms panel is gone.
- Room names and occupancy/capacity are readable without visual clutter.
- Clicking several differently sized rooms opens the correct room/editor.
- The map returns from Edit Room with updated counts.
- Normal Room mode remains visually intact.

### Functional data review

Use real vault items and record before/after evidence for:

1. Add an item to an empty numbered slot.
2. Move it to another empty valid slot.
3. Attempt an invalid destination and confirm nothing changes.
4. Drop onto an occupied slot, choose Cancel, and confirm both items remain in place.
5. Repeat, choose Replace, and confirm the replaced item still exists in the vault.
6. Remove an item with `−` and confirm it disappears only from the room.
7. Reload the page and confirm the final arrangement persists.
8. Confirm the map's occupied/capacity count matches the reloaded room.
9. Confirm a guest/read-only view exposes none of the editing actions.

### Responsive review

Verify at minimum:

- desktop mouse and keyboard;
- touchscreen-laptop or tablet-sized pointer behavior;
- tablet portrait and landscape layouts;
- phone layout with the Move-to-position fallback;
- orientation/viewport resize while an unsaved or pending edit exists.

If genuine touch hardware is unavailable, separate code/viewport verification from touch acceptance in the report. Do not claim touch gestures as physically verified from synthetic mouse events.

### Console and performance

- No new console errors.
- No repeated React key, state-update, or hydration warnings.
- No save request loop or duplicate write caused by autosave.
- Opening Organize and the picker remains responsive after real artwork loads.
- Dragging an item does not cause the camera to move.

## Deployment rules

- Complete the full shared implementation before deploying; do not deploy a partially removed layout with no in-room replacement.
- Fix ordinary code, merge, build, and deployment issues autonomously.
- Check `origin/main` immediately before integration because another programming chat may push concurrently.
- Rebase or integrate cleanly without overwriting newer work.
- Deploy one consolidated production result.
- Confirm Vercel success for the exact deployed SHA before reporting it live.
- Run production verification against that exact deployment.

Do not call the pass accepted. EK's own review remains the final acceptance gate.

## Stop conditions

Stop and report rather than improvising only if:

- safe room-name persistence requires a schema change or irreversible migration not already authorized;
- the existing persistence contract cannot distinguish removing from a room from deleting a vault item;
- current `origin/main` has incompatible concurrent edits that cannot be integrated without choosing between two user-visible designs;
- production authentication prevents all meaningful signed-in verification.

A blocked custom-name field does not block the map enlargement, removals, capacity display, or in-room item organization. Complete all independent work first.

## Required morning report

Return one consolidated report containing:

- production URL;
- deployed SHA and Vercel status for that exact SHA;
- files changed;
- clear before/after layout description;
- confirmation that both old side panels and the room/door badge are removed;
- exact map workspace dimensions at the tested viewport and confirmation of no internal scrollbars;
- room capacity calculation source and examples from at least three rooms;
- results of every functional data review step above;
- desktop, tablet, phone, keyboard, and touch coverage stated separately;
- save/autosave behavior and failure behavior;
- console and build results;
- anything blocked, locally verified only, production verified, or still requiring EK's physical acceptance;
- screenshots of the full Map view, selected-room Edit Room view, in-room Organize state, occupied replacement prompt, and phone/tablet fallback.

Do not describe source inspection, a passing build, or synthetic input as live user acceptance.
