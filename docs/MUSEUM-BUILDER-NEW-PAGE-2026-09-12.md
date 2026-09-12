# Museum Builder — a separate, owner-only page — 2026-09-12

## Why

EK, after using the in-Gallery-Builder museum room popup: "not all features
have been carried over. Like if i want shelves or all wall hanging, a
slider bar to be able to add more items and they get even distributed...
I think to avoid confusion we should separate the spaces, this might be a
lot of work but as i use it, I realize we should have done this from the
start." Verbatim instruction: "duplicate this page but instead call it
Museum Builder. The view below (the image of the room) will be what we
see in the museum room for the new page. Leave the original Gallery
Builder alone though for now. This museum page should only be on my
Personal account, no other user should have access to it or be able to
see it."

"This page" = the Gallery Builder's whole screen at `/museum/virtual-room`:
the identity card ("Virtual Room / Gallery Builder"), the Source panel,
the Room panel (Room/Map tabs, style tabs, Vault dropdown, Values,
Wallpaper), and the toolbar below it (VLTD ROOM / Exit / Rooms / Organize
/ Save Hall) sitting over the actual 3D room view.

## What to build

A new route, e.g. `/museum/builder` (pick whatever fits existing routing
conventions in `src/app/museum/`), that is a structural duplicate of that
same page shell and toolbar, but every place the Gallery Builder points at
a personal Hall/Exhibition, Museum Builder points at the real shared VLTD
Museum instead:

- **Source panel**: lists the real museum rooms (`CAMPUS_ROOMS` from
  `src/lib/campusLayout.ts` — POP_CULTURE, TCG, MISC, BUILT_BOTANY, GAMES,
  AUTOMOTIVE, COLLECTION, SPORTS, CARDS at minimum; HUB/PLAZA/SPOTLIGHT/
  STORE are out of scope, same as the current room-editor popup) instead of
  a personal Hall dropdown.
- **The 3D view underneath**: the real museum room's actual geometry and
  finish — reuse `src/components/gallery/MuseumRoomPopup.tsx`'s approach
  (real shell via `buildRoomShell`/`buildNeutralShell`/`buildSharedWall`/
  `buildRoomTrim` from `campusRoomBuilder.ts`, fixed camera with drag-to-look
  via `visitorController.ts`, no walking) rather than the Gallery Builder's
  generic per-style box (`buildPositions(roomLayout)` in
  `VirtualGalleryRoom.tsx`). Do not change real campus geometry, doors, or
  dimensions to make this easier — the room must look and measure exactly
  like it does in the live public museum.
- **Organize**: reuse `src/components/gallery/organizeSlots.tsx`
  (`useSlotOrganizer`, `OrganizeSlotOverlay`, `OrganizeMoveMenu`,
  `OrganizeReplaceConfirm`) unchanged — this is already the correct,
  already-extracted shared system (built in the prior consolidation pass,
  commit `a891867`). Do not build a second version of it.
- **Save**: persists to `museum_room_items`/`museum_room_meta` (already
  the live backing store for shared rooms), not a personal Hall. No "Save
  Hall" naming/semantics — adapt labels sensibly for this context (e.g.
  autosave, matching how `MuseumRoomPopup.tsx` already saves per-action,
  or an explicit Save if that fits the duplicated page's own toolbar
  better — use judgment, but do not silently lose changes on navigation).

## Feature parity gaps to close (not carried over into the current popup)

1. **Shelves and display cases, not just wall-hanging.** The Gallery
   Builder's own rooms mix wall-hung frames with items resting on physical
   shelf boards and inside floor display cases (`shelfPos`/`shelfRotY`,
   the case meshes built alongside the room shell in
   `VirtualGalleryRoom.tsx`). The shared museum's rooms today only support
   wall-hanging (`computeRoomPlacementSlots()` in `campusRoomBuilder.ts`
   generates wall spans only). Port the shelf/case furniture and their
   slot generation from `VirtualGalleryRoom.tsx` so a museum room can also
   offer shelf and/or case positions, sized to fit each room's own real
   floor space — reuse the existing furniture-building code and slot data
   shape, don't redesign new furniture meshes. If a room's real floor plan
   doesn't sensibly fit a case (doorway clearance, walking path, existing
   floor targets/logo), skip it there rather than force it in.
2. **A slider to set how many items this room shows, evenly distributed.**
   `computeRoomPlacementSlots()` already does proportional-by-span
   distribution across a room's usable wall length for a given capacity
   number (the same mechanism as the existing "items per room" admin
   setting) — that distribution math is correct and should be reused
   as-is. What's missing is a live, per-room control in Museum Builder
   itself: a slider (or equivalent stepper) that lets EK pick this room's
   own item capacity and see slots regenerate/redistribute immediately,
   instead of only a single global default set from Admin Tools. Persist
   the per-room capacity somewhere sensible (a new column on
   `museum_room_meta`, or reuse the existing global default per-room if
   EK doesn't override it) — write any new migration as a file AND paste
   the full SQL in the final report; do not run it.

## Shared features — must not fork into two copies

EK: "the Museum and the 3D gallery are Separate, BUT the features need to
be linked. Example - If i add a new background to one, the other should
also be able to access it." Concretely: wherever Museum Builder needs a
background/wallpaper choice, it must read from and write to the SAME
catalog the Gallery Builder's own Wallpaper feature uses — find that
existing system (search for how `VirtualGalleryRoom.tsx`'s Wallpaper
button and its options are implemented/stored) and extend/share it rather
than building a second, museum-only background list. A background added
from either builder must show up as an option in the other.

## Access control — the one hard requirement

"This museum page should only be on my Personal account, no other user
should have access to it or be able to see it." `src/lib/adminAuth.ts`
already distinguishes an `"owner"` role (matched against
`NEXT_PUBLIC_OWNER_EMAIL`, one specific account) from the general
`"admin"` role stored in `user_roles` — `getMyAdminRole()` returns
`"owner" | "admin" | null`. Gate this new route/page on
`role === "owner"` specifically, not merely `role !== null` (which is
what the existing Map/`/museum/vltd` admin gates use, and would let any
other admin in too). Follow the same pattern as
`src/components/gallery/VltdMuseumAdminGate.tsx` (a small client wrapper
checking the role before rendering anything), adapted to the stricter
owner-only check. Show a plain "Not authorized" state for anyone else,
same as that existing gate — do not reveal the page exists via a
different error, redirect message, or route listing.

## Do not change

- The existing Gallery Builder at `/museum/virtual-room` — leave it and
  its whole personal-Hall flow completely alone, per EK's explicit
  instruction. This is a new, separate page, not a modification of that
  one.
- The in-context room-editor popup shipped in commits `b42af71` through
  `9996861` (`MuseumRoomPopup.tsx`, reached from the Gallery Builder Map's
  edit badge) — leave it working as-is; Museum Builder is an additional,
  separate entry point, not a replacement, unless EK says otherwise later.
- Real campus geometry, doors, floor targets, lighting, camera/movement/
  collision in the walkable public museum at `/museum/vltd`.
- `museum_room_items`/`museum_room_meta`'s existing rows and the museum's
  own live-display read path (`getEnabledRoomItems`, `placeItemsAtSlots`).

## Verification and process

Any new/altered Supabase tables or columns: write a migration file under
`supabase/migrations/` AND paste the full SQL in the final report — EK
runs every migration by hand; do not run it yourself, and gate any
feature that depends on a new column so its absence fails soft.

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed/new
file, `npm run build` — all clean. Commit and push to `main` once
verified clean (standing project convention). Update `HANDOFF.md` and
`CHECKLIST.md` with a dated entry matching existing tone/format.

In the final report: confirm the Gallery Builder itself is byte-for-byte
unaffected (a diff-stat showing it untouched, or an explicit note if a
genuinely shared file needed a small, careful change and why); name
exactly what was reused vs. newly built for the shelf/case system and the
background catalog; confirm the owner-only gate was implemented against
`role === "owner"` and describe how you'd verify a non-owner admin is
correctly blocked (even without live browser access); give
tsc/eslint/build results and the exact commit(s) pushed. Do not claim any
live/authenticated browser verification — there is no session for any
admin-gated route from this environment; that check happens separately.
Do not declare this accepted or ready for EK's test.
