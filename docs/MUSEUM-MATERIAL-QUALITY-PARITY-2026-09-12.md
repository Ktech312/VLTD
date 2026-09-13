# Museum rooms: match the Gallery Builder's polished material quality — 2026-09-12

EK, verbatim: "why will you not give me the room i took days and days
getting to look good, for this reason alone and you create different
one, wasted my time in the paste and now." The shared museum's rooms
(built in `src/lib/campusRoomBuilder.ts`, used by both the live
`/museum/vltd` and the new Museum Builder) read flatter/plainer than the
personal Gallery Builder's own rooms (`VirtualGalleryRoom.tsx` +
`src/components/gallery/galleryRoomFinishes.ts`), which got many real
correction passes to reach a "believable materials, grounded contact
shadows, distinct trim" quality bar EK explicitly approved.

## What this is and is not

This is a MATERIAL/LIGHTING QUALITY upgrade only. Every real museum
room's own actual geometry — its footprint, wall lengths, door
positions/widths, floor targets, navigation, EK's doorway-aligned
targets, the transom fix, camera/movement/collision — is completely
out of scope and must not change. Do not swap in the Gallery Builder's
generic fixed-box room shape. The goal is: the SAME real, individually-
shaped museum rooms, finished to the SAME quality bar as the personal
rooms, using the actual proven material-generation code from
`galleryRoomFinishes.ts`/`galleryTextures.ts` — not new, unproven
textures invented for this pass.

Because `/museum/vltd` (the live public museum) and Museum Builder both
render rooms through the same `createWallMaterial`/`buildNeutralShell`/
`buildRoomShell`/`buildRoomTrim` functions in `campusRoomBuilder.ts`,
improving those functions' material quality improves both surfaces at
once — that is correct and intended, not scope creep; EK has repeatedly
asked for the two to stay visually consistent with each other.

## What to actually change, and what's already fine

Read `src/components/gallery/galleryRoomFinishes.ts` (the approved
material recipes: `PALETTES`, `createGalleryFinishes()`) and
`src/components/gallery/galleryTextures.ts` (`createGrainTexture`,
`createHardwoodTexture`, `createStoneFloorTexture`, `shadeHex`,
`mulberry32`) before touching anything in `campusRoomBuilder.ts`.

Already shared and fine, confirmed by reading the current code — do not
rebuild these:
- The museum's floor already calls the SAME `createStoneFloorTexture()`
  Gallery Builder's White room uses (`campusRoomBuilder.ts` line ~431/498).
- Display cases already have a contact-shadow technique
  (`campusRoomBuilder.ts`, the glass-case furniture builder around line
  ~1263) — the "grounded contact shadows" quality bar is partially met.

What actually reads as a lower quality bar, and needs the polish pass:
1. **Wall texture and material tuning.** `createWallMaterial()` uses its
   own `createArchitecturalPanelTexture()` with flat, uniform roughness/
   metalness (0.85/0) regardless of which `RoomFinish` is active — every
   legacy room (`NEUTRAL_LEGACY_FINISH`) and every "converted" room
   (`NEUTRAL_PREVIEW_FINISH`) gets the exact same wall material
   character. Gallery Builder's own palettes vary wall roughness/
   metalness meaningfully per style (e.g. Vault's 0.48/0.24 brushed-metal
   read vs. White's 0.94/0 matte plaster) — bring that same kind of real
   tuning to `RoomFinish` (extend the type with roughness/metalness
   fields, matching `FinishPalette`'s shape) so museum walls stop
   reading as one uniform material regardless of room.
2. **Contact shadows under wall-hung and shelf items**, not just display
   cases. Port the actual technique already used for cases to
   `hangArtPreservingAspect()`/the shelf-furniture placement in
   `museumRoomFurniture.ts` — a soft shadow blob/plane grounding each
   frame and shelf item, same as Gallery Builder's own items already
   have.
3. **Trim/rail material realism.** Compare `railMaterial`
   (`campusRoomBuilder.ts` ~line 905, currently a flat
   roughness/metalness pair reused for every finish) against Gallery
   Builder's own per-style trim tuning (`trimMetalness`/`trimRoughness`
   in `FinishPalette`) and bring differentiated, tuned trim per
   `RoomFinish` the same way.
4. **Lighting character.** `buildRoomShell()` (used by "converted" rooms
   POP_CULTURE/TCG/COLLECTION) already gets a real dynamic light rig;
   `buildNeutralShell()` (every other legacy room) does not, by an
   earlier deliberate decision ("Overnight Polish pass, 2026-09-09:
   unconverted rooms should receive only this neutral structural
   finish... do not turn into a new themed identity" — read that
   comment in `campusRoomBuilder.ts` before changing this). EK's current
   ask supersedes that earlier constraint: bring believable lighting to
   every real museum room, not just the three "converted" ones — reuse
   the SAME light-rig technique `buildRoomShell()`/Gallery Builder's own
   `addLighting()` already use, adapted to each room's real size, rather
   than inventing new lighting code.

## Do not change

Real campus geometry, doors, floor targets, navigation targets, camera/
movement/collision, `CAMPUS_ROOMS`/`CAMPUS_DOORS`, the personal Gallery
Builder's own files (`VirtualGalleryRoom.tsx`, `galleryRoomFinishes.ts`,
`galleryTextures.ts` — read from, never modified), Museum Builder's
Organize system, item placement/save logic, the Room/Map toggle, the
background-color-swatch feature, per-item Values — none of that
changes; this pass only touches material/lighting quality inside
`campusRoomBuilder.ts` (and `museumRoomFurniture.ts` if item contact
shadows need it).

## Verification and process

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed
file, `npm run build` — all clean. Commit and push to `main` once
verified clean. Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry.

In the final report: name exactly which Gallery Builder material/
texture code was reused vs. adapted for each of the 4 items above,
confirm real campus geometry/doors/navigation/movement are
byte-for-byte unchanged (diff-stat or explicit note), and give
tsc/eslint/build results plus the exact commit(s) pushed. Do not claim
live visual verification — you have no reliable way to judge "does this
actually look as good as the personal rooms" from code alone; say so
plainly. The parent session will look at this live in a real browser
and iterate further if it doesn't hold up — this pass should get the
material/lighting code genuinely reusing the approved recipes, not
promise a finished visual result.
