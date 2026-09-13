# Grand Hall (HUB) — approved custom design implementation — 2026-09-13

EK's direct instruction, verbatim requirements below. This replaces the
existing placeholder "Grand Hall enhancement" block in
`src/components/gallery/VltdMuseumCampus.tsx` (currently lines ~541-622 —
find it by its own comment "Grand Hall enhancement — a lit 'skylight'
ceiling accent and a floor medallion") with the real, approved design.

**This is the live, production, walkable public museum — not Museum
Builder, not a preview.** HUB is a real room connected by real doors to
PLAZA/POP_CULTURE/TCG/MISC/COLLECTION/SPORTS (whichever doors it actually
has — read `campusLayout.ts`'s `CAMPUS_DOORS` for HUB's real connections
before doing anything). Treat this with the same care as every other
"do not touch real geometry" constraint elsewhere in this codebase.

## Reference assets (already copied into this repo)

- `public/museum/grand-hall/grand-hall-concept-v1.png` — full hall
  appearance/lighting reference (angled view).
- `public/museum/grand-hall/grand-hall-ceiling-concept-v1.png` —
  straight-up view: this is the actual construction reference for the
  skylight well, coffer grid, trim profile, and concealed lighting.
  **Look at this image directly before writing any ceiling code.** It
  shows a 3x3 coffer grid (3 across, 3 deep) surrounding a long central
  skylight well; each coffer is a deep recessed rectangular panel with a
  glowing warm border (a thin emissive strip running around the panel's
  recessed edge, set into the trim) and one small round recessed downlight
  centered in the panel; the skylight itself has real depth (a well/box,
  not a flat plane) with dark bronze mullions dividing the glass into a
  grid, visible on the glass ceiling plane AND continuing down the
  well's own side faces (the mullion grid keeps going as the well
  recesses upward, not just on the flat top).
- `docs/GRAND-HALL-VISUAL-ASSETS.md` — full material/geometry spec (read
  this in full; it is authoritative alongside this file).
- Texture sets (each has `-basecolor.png`/`-normal.png`/`-roughness.png`),
  all in `public/museum/grand-hall/`:
  - `warm-ivory-marble-*` — floor field.
  - `ivory-limestone-*` — walls.
  - `charcoal-marble-*` — floor perimeter border + wall base trim.
  - `warm-ivory-plaster-*` — coffered ceiling surfaces.
- `public/brand/vltd-museum-floor-medallion-v1.png` — the real VLTD seal
  image, already used by the CURRENT code (see below) — reuse the exact
  same loading/placement approach, don't rebuild it.

## What the current code already does (read before changing it)

The existing block (in `VltdMuseumCampus.tsx`) already:
- Places a compass-rose medallion (procedurally drawn on a canvas: rings
  + an 8-point star, gold-on-charcoal) as a `THREE.CircleGeometry(9, 48)`
  disc at the room's exact center (`roomCenter(hub)`), y=0.02.
- Loads the real VLTD seal (`/brand/vltd-museum-floor-medallion-v1.png`)
  as a separate, smaller (`CircleGeometry(2.7, 96)`), transparent inlay
  layered on top at y=0.028, named `"hub_vltd_floor_seal"`, using
  `alphaTest`/`polygonOffset` so it composites cleanly over the compass
  rose beneath it without z-fighting.
- Builds a flat, plain emissive `PlaneGeometry` "skylight" (no depth, no
  mullions, no coffers) and one `PointLight` — this whole approach is
  what's being replaced by real geometry per EK's instruction ("Do not
  place the concept image on the ceiling" and "must be modeled as
  geometry").

**Keep the medallion/seal exactly as it already works** (EK: "restore the
existing VLTD floor medallion at the exact center of the new marble
floor" — the mechanism already exists and already sits at the exact
center; it just needs to keep working correctly once the floor around it
is rebuilt with the new marble/border materials, sitting cleanly on top
without now clipping into a raised marble border or getting z-fought by
new floor geometry). Rebuild everything else in that block.

## Build order

### 1. Floor

Real HUB floor (`room.w` x `room.d`, from `roomById("HUB")` — do not
change these dimensions) as: a `warm-ivory-marble` field texture (using
all three maps: basecolor/normal/roughness, `THREE.TextureLoader`, correct
`colorSpace`/`anisotropy` via `renderer.capabilities.getMaxAnisotropy()`,
matching the existing seal texture's own loading pattern) with a
`charcoal-marble`-textured perimeter border band framing it (a ring of
geometry near the room's real wall edges, not covering the whole floor).
Material intent (from the design doc): marble roughness ~0.34-0.40,
charcoal marble ~0.36-0.44 — controlled low gloss, never mirror-like.
Keep the existing medallion/seal centered on top of this new floor,
unchanged.

**Do not build a new floor mesh that duplicates or conflicts with
whatever the shared shell (`buildNeutralShell`/`buildRoomShell` in
`campusRoomBuilder.ts`) already builds for HUB's actual base floor
plane** — read how the existing floor gets built for HUB today (it uses
`HUB_FINISH`'s own floor color/texture through the standard shell path)
and either replace that floor material specifically for HUB with the new
marble treatment, or add this as a thin overlay/inlay on top (same
approach the medallion/seal already use) — whichever avoids z-fighting
and matches how the rest of this codebase's inlay patterns work. Do not
touch the floor of any other room.

### 2. Walls

Ivory-limestone wall texture (basecolor/normal/roughness) with dark
bronze shadow joints, replacing `HUB_FINISH`'s current flat gold wall
color for HUB specifically (`baseFinishForRoom`/`HUB_FINISH` in
`campusRoomBuilder.ts` — check whether editing `HUB_FINISH` directly is
the right lever, since it's a shared constant already used by HUB's
shell-building call; if a room-specific texture swap needs a different
mechanism than `RoomFinish`'s current flat-color fields, extend it
narrowly rather than forcing textures through a type that doesn't support
them yet). Material intent: honed/diffuse, roughness ~0.68-0.78. Do not
change any other room's wall finish. Do not touch HUB's baseboard/rail
logic beyond what's needed to apply the charcoal-marble base trim
described in the design doc (charcoal marble base trim at the wall
bottom, matching the floor border material).

### 3. Ceiling — skylight + coffers (real geometry, per the design doc's "Geometry and lighting" section)

- A long rectangular skylight centered on the Hall (both axes), sized to
  roughly 45-55% of HUB's length and 30-38% of its width — adjust only as
  needed to preserve real room proportions and doorway axes (never let it
  overlap a door's own head casing/transom).
- Give it a real, deep well: a framed curb (raised/recessed border with
  actual thickness, not a flat rim) and a dark bronze mullion grid
  dividing the glass into a grid (visible on both the flat glass plane
  and continuing down the well's own side faces, per the ceiling
  reference image).
- Symmetrical coffer grid on all four sides around the skylight (match
  the reference image's proportions — broad, deep, calm bays, NOT a dense
  small-tile grid). Each coffer: a recessed rectangular panel in
  `warm-ivory-plaster` (roughness ~0.75-0.85), with a warm emissive strip
  around its recessed inner edge (a thin frame of emissive material, not
  a lit flat panel face) plus one small round downlight fixture centered
  in the panel (a small emissive disc/cylinder, matching the reference's
  tiny centered dot).
- Divide the coffer layout symmetrically around HUB's own real centerline
  and real doorway locations (read `CAMPUS_DOORS`/HUB's actual door walls
  before deciding the grid — the coffer rows/columns must stay
  symmetrical from every approach EK will check, listed below).
- Lighting: warm 2700-3000K color emissive strips (a warm amber/ivory
  hex, not pure white) for the coffer glow and skylight curb, a small
  number of supporting soft point/rect lights (not one per coffer if that
  gets excessive — read the design doc's "limited number of soft
  area/rect lights" instruction), balanced against soft, cooler
  (blue-white) light representing daylight coming through the skylight
  glass itself. Neither should wash out the other — this needs an actual
  balance, not just two light types present.

### 4. Do not change

Real HUB room dimensions, walls' actual position/thickness, doorways,
door frames/casing/transoms, destination signs, navigation/floor targets
(including HUB's own room-center target — the design doc: "let the
existing enlarged center target frame [the medallion] without covering
it" — do not move or resize that target, just make sure the new floor
build doesn't visually conflict with it), camera behavior, movement/
collision, every adjoining room (PLAZA, and whichever other rooms
actually connect to HUB per `CAMPUS_DOORS`). Do not change any other
museum room's finish, geometry, or lighting. Do not touch Museum Builder,
the Gallery Builder, or anything under `src/components/gallery/organizeSlots.tsx`,
`MuseumRoomPopup.tsx`, `MuseumBuilder.tsx`, `museumRoomArmor.ts`,
`museumRoomFurniture.ts` — none of that is in scope for this pass.

## Verification and process

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed
file, `npm run build` — all clean. Commit and push to `main` once
verified clean (standing convention — do not ask for confirmation).
Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry.

**You have no browser/visual verification capability — say so plainly,
do not claim to have seen this render.** The parent session (and EK
directly) will do the required live check afterward: from the main
entrance, every interior doorway, all four corners, the room center, and
straight up — confirming the skylight/coffers/marble border/medallion
stay centered and symmetrical from every one of those approaches, with no
gaps, flicker, clipping, or blown-out brightness. Do not declare this
finished or accepted — that determination happens after that live check,
not from your own report.

In your final report: name exactly which existing code/patterns you
reused (texture-loading pattern, medallion/seal mechanism, any shell-
building conventions from `campusRoomBuilder.ts`) vs. what's newly built
for the coffers/skylight/materials, confirm every "do not change" item
above is untouched (diff-stat against files outside
`VltdMuseumCampus.tsx`/`campusRoomBuilder.ts`, or note precisely which
lines in those two files changed and why), and give tsc/eslint/build
results plus the exact commit(s) pushed.
