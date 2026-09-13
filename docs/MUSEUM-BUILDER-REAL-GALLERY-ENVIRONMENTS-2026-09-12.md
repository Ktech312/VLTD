# Museum Builder: use the ACTUAL Gallery Builder environments, not invented colors — 2026-09-12

EK, verbatim, after testing the material-quality pass: "nothing looks
different, the rooms look the same and my environments are not there...
These circles, I DO NOT WANT, I NEVER ASKED YOU TO MAKE THEM, REMOVE THEM
AND GIVE ME THE ONES IN THE 3D GALLERY!!!!! LITERALLY ASKED SEVERAL
TIMES. I'M NOT TESTING OR TRYING ANY THING ELSE UNTIL THAT IS DONE."

This supersedes every prior "background" decision this session
(`ROOM_BACKGROUND_OPTIONS` — "Neutral (default)/Warm Ivory/Cool
Slate/Charcoal" — was invented for this project and must be removed
entirely, not kept as an option alongside the real thing). She wants the
actual named environments from the personal Gallery Builder (White,
Vault, Arcade, Industrial Loft — the `<select>` in `VirtualGalleryRoom.tsx`
with `value="whitebox"|"vault"|"arcade"|"loft"|"blue"`) usable in Museum
Builder, using their real material code, not new colors invented for the
museum.

## The exact code to reuse — read before writing anything

`src/components/gallery/galleryRoomFinishes.ts`'s `createGalleryFinishes(style)`
(`style: "whitebox" | "vault" | "arcade" | "loft"`) builds and returns
real, standalone `THREE.Material` instances: `wall`, `floor`, `brass`
(trim), `dark`, plus an `addLighting(scene, ...)` function that installs
that style's actual tuned light rig, and an `apply(model)` method (that
one is GLB-specific — irrelevant here, don't call it; the museum's rooms
aren't built from this GLB). These materials are exactly what shipped
after EK's real, multi-pass correction process (steel wall grain, real
walnut/concrete/stone floor per style, tuned brass, distinct per-style
lighting) — the actual quality bar, not an approximation of it.

Two materials the function builds internally but does not currently
return: `ceiling` and `charcoal` (the back-wall accent). Make a small,
strictly additive edit to `createGalleryFinishes`'s own `return { wall,
floor, brass, dark, apply, addLighting, addCaseDetails, addVaultArmor,
dispose... }` statement (line ~838) to ALSO include `ceiling` and
`charcoal` — do not change anything else in this file, do not touch
`PALETTES`, do not touch any existing behavior for `VirtualGalleryRoom.tsx`'s
own use of this function (adding extra keys to a destructured return is
non-breaking; confirm this with a diff showing only that one line
changed).

"Blue" has no `createGalleryFinishes` entry — its material recipe is
hand-built inline in `VirtualGalleryRoom.tsx` (no GLB, no shared
function). Do not attempt to port Blue in this pass; offer White/Vault/
Arcade/Loft only, and say so plainly in the report as a known, disclosed
gap — do not silently drop it without mentioning it, and do not
half-heartedly approximate Blue's look with guessed values.

## What to build

In `src/lib/campusRoomBuilder.ts` / wherever the museum's room wall,
floor, ceiling, and trim materials currently get created
(`createWallMaterial`, `buildNeutralShell`, `buildRoomShell`,
`buildRoomTrim`, and Museum Builder's/VltdMuseumCampus.tsx's own
material-application code from the last two passes): when a room has a
saved style override, use `createGalleryFinishes(style)`'s real `wall`/
`floor`/`ceiling`/`brass`/`charcoal`/`dark` materials directly for that
room's own real wall/floor/ceiling/trim meshes, and call its
`addLighting()` for that room's own real light rig — instead of this
project's own `createWallMaterial(finish)`/flat-color/generic-rig system.
Do not swap in the Gallery Builder's fixed room GEOMETRY — each museum
room keeps its own real shape, wall lengths, and door positions; only
the MATERIALS and LIGHTING come from the chosen style.

Completely REMOVE (not hide, not keep alongside) the invented
background system:
- `ROOM_BACKGROUND_OPTIONS`, `backgroundWallColorHex`, `setRoomBackground`,
  the "BACKGROUND: Neutral (default)/Warm Ivory/Cool Slate/Charcoal"
  picker UI in `MuseumBuilder.tsx`, and `museum_room_meta.background_id`'s
  reads/writes tied to it. Leave the `background_id` DB column itself
  alone (dropping a column is unnecessary churn) but stop reading/writing
  it anywhere.
- Replace with a "Style" picker offering White / Vault / Arcade /
  Industrial Loft (reusing the exact labels from
  `VirtualGalleryRoom.tsx`'s own style `<select>`), persisted as a new
  `museum_room_meta.room_style` column (migration file, full SQL pasted
  in the report, not run by you). Fails soft if that column doesn't
  exist yet, same pattern as every other optional column in
  `museumCampusConfig.ts`.
- The real custom-image Wallpaper upload feature stays — it is real,
  already correctly built, and independent of this ask.

Apply this to BOTH the live museum (`VltdMuseumCampus.tsx`) and Museum
Builder, since they already share `campusRoomBuilder.ts`'s material code
— a room styled from Museum Builder must look the same way when visited
live.

## Do not change

Real campus geometry, doors, floor targets, navigation targets, camera/
movement/collision, `CAMPUS_ROOMS`/`CAMPUS_DOORS`, the personal Gallery
Builder's own files beyond the one narrow additive edit to
`galleryRoomFinishes.ts`'s return statement described above (do not
touch `VirtualGalleryRoom.tsx`, `galleryTextures.ts`, or anything else in
`galleryRoomFinishes.ts`), Museum Builder's Organize system, item
placement/save logic, the Room/Map toggle, per-item Values.

## Verification and process

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed
file, `npm run build` — all clean. Commit and push to `main` once
verified clean. Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry.

In the final report: confirm the diff to `galleryRoomFinishes.ts` is
exactly the one additive return-statement line (paste the diff), confirm
`VirtualGalleryRoom.tsx`'s own rendering is unaffected, confirm real
campus geometry/doors/navigation/movement are byte-for-byte unchanged,
name exactly which materials/functions were reused for each of
wall/floor/ceiling/trim/lighting, disclose the Blue-style gap plainly,
and give tsc/eslint/build results plus the exact commit(s). Do not claim
live visual verification — the parent session will check this live in a
real browser immediately after deploy and will not accept it as done
until it visibly matches. Do not declare this accepted.
