# POP_CULTURE → real Gallery Vault parity — 2026-09-13 (overnight work order)

## Important disclosure up front

EK's overnight instruction says "Use the source-checked POP CULTURE
instructions above." **No such instructions exist anywhere in this
session's transcript** — searched the full session log for "POP CULTURE"
and "source-checked"; nothing prior establishes a specific spec. This may
refer to analysis done in a different chat/tool (there is evidence of a
parallel Codex session touching `museum/` — see `HANDOFF.md` §"First moves
for the new chat", item 1: "confirm who owns `/capture`... re-check the new
not-this-chat's file list... before touching anything under `museum/`").

Rather than block overnight work on a question EK can't answer until
morning, this doc is **my own code-verified interpretation** of her literal
numbered list (make POP_CULTURE match the real personal-Gallery Vault in
capacity/alignment/sizing/shelves/lighting/item interaction). State plainly
in your final report that this interpretation, not a located prior spec, is
what you built against — EK may need to redirect in the morning.

## What already exists (confirmed by reading the code just now — do not rebuild these)

- POP_CULTURE is a **real room** built through `campusRoomBuilder.ts`'s
  `buildRoomShell()` (see `VltdMuseumCampus.tsx` ~line 643-694,
  `popCultureModule`/`popCultureLights`/`popCultureWallSpans`) — not a
  legacy placeholder. Real walls, real doors (east→HUB, south→TCG), real
  floor/ceiling/light-rig group.
- **The real-style patch mechanism already exists and already includes
  POP_CULTURE.** `VltdMuseumCampus.tsx` ~line 979-1032: a loop over
  `EDITABLE_ROOM_IDS` (which includes `POP_CULTURE`) reads
  `roomMeta[roomId]?.room_style`, calls `createStyledRoomFinishes(style)`
  (the SAME `createGalleryFinishes()` used by the personal Gallery Builder
  and by Museum Builder), and if a style is set, overwrites that room's own
  wall/floor/ceiling/baseboard/rail `Material` instances in place via
  `.copy()`, then replaces its generic ceiling-fixture rig with the style's
  real `addLighting()` rig. **This means: if `museum_room_meta.room_style`
  is actually saved as `"vault"` for POP_CULTURE, the real Vault wall/floor/
  ceiling/lighting materials should already apply live today.** Verify this
  is actually true before assuming it needs to be built from scratch:
  1. Check whether migration `20260912_museum_room_style.sql` has actually
     been run against the real database (do NOT assume — this project's
     migrations are only ever run manually by EK, and multiple recent ones
     were still unconfirmed as of the last check). A short read-only script
     using the service-role client (pattern already used earlier this
     session for the MFA fix — `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`)
     can check `information_schema.columns` for `museum_room_meta.room_style`,
     or just attempt a `select room_style from museum_room_meta limit 1` and
     see if it errors. Delete the script after, per convention.
  2. Check whether any row in `museum_room_meta` for `room_id = 'POP_CULTURE'`
     already has `room_style = 'vault'` set. If not, that's likely the
     actual, simple, root gap — not missing code.
  3. If the migration hasn't run: **do not fabricate a workaround column or
     a parallel storage mechanism.** Note it plainly as a blocked item for
     the morning report (per EK's own instruction: "do not label unfinished
     or unviewed work complete") and continue with everything else that
     doesn't depend on it (see below — the furniture/armor gaps are real
     code gaps regardless of whether the migration has run).

## What is genuinely missing (real code gaps, confirmed by reading the code)

The style-patch loop above only ever touches **surface materials + the
ambient light rig**. It does NOT touch:

1. **Wall armor (panels/rivets/ceiling lattice)** — `museumRoomArmor.ts`'s
   `addStyledRoomArmor()` is currently only ever called from
   `MuseumBuilder.tsx` (the admin preview tool), never from
   `VltdMuseumCampus.tsx` (the real walkable campus). For POP_CULTURE to
   actually look like the real Vault (not just have Vault-colored flat
   surfaces), the same `addStyledRoomArmor(scene, room, relevantSegments,
   WALL_HEIGHT, roomStyle, WALL_THICKNESS)` call needs to run for POP_CULTURE
   (and, generically, any EDITABLE_ROOM_IDS room with a saved style) inside
   `VltdMuseumCampus.tsx`'s own style-patch loop — using POP_CULTURE's real
   wall segments (same `computeCampusWallSegments`/`solidWallPieces` inputs
   already available in this file) instead of Museum Builder's.
   - **Known open bug, disclosed, not yet resolved as of this session:**
     even after a math fix to `addVaultPanels`/`addLoftWalls`'s wall-face
     offset (commit `2e20446`), a live check in Museum Builder still showed
     no visible panel dividers/rivets. If you wire this into the live
     campus and see the same symptom, do not silently accept it — dig
     further (candidate causes not yet ruled out: panel-count-per-span
     rounding to 1 for a short span producing zero interior dividers; rivet
     placement landing outside typical camera framing; insufficient color/
     lighting contrast) or report it as still-open, exactly as it was left.
2. **Display cases and shelf boards** — `museumRoomFurniture.ts`'s
   `buildDisplayCase()`/`buildShelfBoard()`/`createShelfMaterial()` are also
   Museum-Builder-only right now. The live walkable POP_CULTURE room's
   curated-item path (`computeRoomPlacementSlots`/`placeItemsAtSlots`,
   `VltdMuseumCampus.tsx` ~line 1052-1060) places wall-hung art only — no
   cases, no shelf boards. The personal Gallery Vault's real capacity is
   **5 display cases** (`CABINET_SPOTS` in `src/lib/galleryRoomSlots.ts`:
   `[-3.4,-3.5], [0,-4.55], [3.4,-3.5], [-2.1,0.45], [2.1,0.45]`) plus back-
   row/side-row shelf boards. For real parity, POP_CULTURE (and eventually
   every editable room) needs its own case/shelf slots computed from its
   REAL room bounds/doors (`roomBounds()`/`computeRoomShelfSpans` already
   exist in `campusRoomBuilder.ts` — reuse, don't reinvent), built with
   `buildDisplayCase`/`buildShelfBoard` using that room's real `styled`
   finishes object (the SAME instance already resolved in the patch loop),
   and an items-in-cases placement pass reusing `placeItemsInCases()`
   (already exported, currently Museum-Builder-only caller) for whichever
   curated items are assigned to a case slot vs. a wall slot.
   - `museum_room_meta` already has `case_capacity`/`shelf_capacity`/
     `item_capacity` columns (migration `20260912_museum_room_capacity_and_background.sql`,
     confirmed run by EK previously) — use these to size the case/shelf
     slot count per room instead of a hardcoded 5, but default toward
     matching the Vault's real 5-case feel when a room has no saved
     capacity yet.
3. **Item interaction** — confirm clicking/hovering a curated item in
   POP_CULTURE (once cases/shelves exist) shows the same info treatment
   (title/description, whatever the personal Gallery's own item interaction
   is) as `VirtualGalleryRoom.tsx`'s own click handling — don't invent a new
   interaction pattern, reuse whatever the live campus's existing wall-item
   click handling already does and extend it to case/shelf items the same
   way.

## Build order (per EK's explicit instruction — do not skip ahead)

1. Wire `addStyledRoomArmor` + case/shelf furniture generically into
   `VltdMuseumCampus.tsx`'s existing style-patch loop (parameterized by
   room, using each room's own real geometry — not a POP_CULTURE-only
   one-off block; the loop already iterates `EDITABLE_ROOM_IDS` generically,
   extend inside it).
2. Prove it specifically on **POP_CULTURE with room_style = "vault"**:
   verify (locally — dev server, or at minimum careful reading + `tsc`)
   that walls/floor/ceiling/armor/cases/shelves/lighting all resolve
   correctly for POP_CULTURE's real 21×26×9.15 geometry and its real two
   doors (HUB east, TCG south), with **zero regression** to POP_CULTURE's
   doors, signage, nav targets, or to TCG/COLLECTION/any other room that
   currently has no saved style (they must render exactly as before —
   `createStyledRoomFinishes()` returns `null` for an unset/unrecognized
   style and must leave those rooms untouched, per the existing comment at
   line 976).
3. **Only after POP_CULTURE is proven working**, the SAME generic loop
   already covers every other `EDITABLE_ROOM_IDS` room automatically the
   moment that room has its own saved `room_style` — there should be no
   need for N separate per-room implementations. Confirm this generically
   (e.g. temporarily/locally simulate a second room with a style set, or
   reason carefully through the code path) rather than assuming it without
   checking.

## Absolute constraints — do not touch

- **HUB / Grand Hall is out of scope for this task and is being worked on
  concurrently by a different background agent tonight** (dispatched
  earlier, `docs/GRAND-HALL-CUSTOM-DESIGN-2026-09-13.md`). Do not edit
  `VltdMuseumCampus.tsx`'s HUB block (~line 541-622 in the version at commit
  `d02c900`) or `HUB_FINISH`/HUB-specific code in `campusRoomBuilder.ts`. If
  you need to touch the same file, **`git pull --rebase` immediately before
  committing/pushing** and resolve any conflict by keeping the other agent's
  HUB-scoped changes untouched alongside your own POP_CULTURE/generic-loop
  changes.
- Do not alter any room's real dimensions, wall thickness, doorways, door
  frames/casing/signs, navigation/floor targets, camera behavior, movement/
  collision, or the map. Do not change any room's finish/geometry other than
  through the style mechanism described above (which only activates for a
  room with an actual saved `room_style`).
- Do not touch Museum Builder (`MuseumBuilder.tsx`) or the personal Gallery
  Builder (`VirtualGalleryRoom.tsx`) — reuse their exported functions, don't
  modify them.

## Verification (per EK's explicit instructions)

- Test the **complete workflow locally** before expanding to other rooms:
  set POP_CULTURE's `room_style` to `"vault"` (via Museum Builder's own UI
  if the migration has run, or directly in the DB for a local test), load
  the live campus, and confirm cases/shelves/armor/lighting/item
  interaction all actually appear and work — not just that the code
  compiles.
- `npx tsc --noEmit`, targeted `eslint` on every changed file, `npm run
  build` — all clean before pushing.
- **You (the agent) have no browser/visual verification capability** — say
  so plainly. Local verification here means: reading the code path
  carefully, running the dev server and checking console/network for
  errors if you can, and confirming the build succeeds — not claiming to
  have seen a render.
- Authenticated production testing is currently blocked by 2FA on EK's
  account (a known, disclosed issue — see `MfaChallengeGate.tsx`) — per
  EK's instruction, continue all independent implementation and local
  verification regardless; leave the authenticated live check for morning/
  the parent session.
- Commit and push once verified clean — standing convention, no need to
  ask. Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry describing
  exactly what changed, what was verified locally, and what's still
  genuinely open (the wall-armor visibility bug, the migration-not-run
  possibility, anything else).

## Final report — be exact, not optimistic

State clearly: what you changed, what you verified locally and how, what
you could NOT verify (auth-gated production, actual visual render), and any
genuinely open/blocked item. Do not call POP_CULTURE parity or the
room-system rollout "done" or "matching the Vault" unless you have actual
evidence (a passing build is not evidence of a correct visual result) — the
parent session and EK will do the real visual check.
