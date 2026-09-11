# Full Museum Visual Overnight Pass — 2026-09-10

## Purpose

Move the public VLTD Museum from a functional architectural shell toward a coherent, believable museum without changing the accepted navigation behavior or converting another room into a finished theme.

The live review target is:

- `https://vltd.vercel.app/museum/vltd`
- Component: `src/components/gallery/VltdMuseumCampus.tsx`
- Shared room and doorway construction: `src/lib/campusRoomBuilder.ts`
- Layout and adjacency data: `src/lib/campusLayout.ts`

Start from the latest `origin/main`. Do not work from an older museum branch or a stale browser tab.

## Accepted baseline — preserve it

The following behavior is working well enough to move on. It may need tuning later, but it is not part of this pass:

- Glowing square navigation targets help the visitor line up and move through the museum.
- Clicking a target recenters and aligns the visitor smoothly.
- Slow and fast physical mouse-wheel scrolling both work.
- Left/right turning and forward travel are usable.
- The HUB target is larger than the other targets and frames the VLTD floor medallion.
- The shared-wall grid, flush floors, current room dimensions, door openings, collision, camera height, field of view, and movement easing remain unchanged.

Do not edit these areas:

- `src/lib/visitorController.ts`
- wheel, keyboard, pointer-drag, yaw, pitch, collision, click-to-walk, or target-duration logic in `VltdMuseumCampus.tsx`
- `computeCampusWaypoints()` or target geometry/sizing
- room bounds or `CAMPUS_DOORS`
- the accepted floor medallion asset or its placement

If a visual change appears to require a control or layout change, record it in the final report instead of changing it.

## New doorway-sign system — preserve and verify

The starting revision includes a shared medallion-inspired doorway sign system in `buildDestinationSign()`:

- Static sign face: charcoal field, aged-brass double border, corner bosses, and short vault-dial register marks.
- Dynamic label: a separate transparent canvas texture generated from the current room data.
- Room names are not baked into the static sign artwork. Changing a room label later must update the text without replacing the sign design.
- The visitor-facing cleanup rules remain data-driven (`BUILT_BOTANY` displays as `BOTANY`; underscores display as spaces).

Verify this system from both sides of representative ordinary doors and at the main entrance. Fix only actual sign defects such as clipping, poor contrast, reversed text, stretched proportions, or placement outside the transom. Do not replace the system with a flat black rectangle or bake room names into image files.

## Work order

### 1. Establish a real visual baseline

Before changing visuals, capture a consistent screenshot set at normal visitor eye height:

- HUB center facing each connected doorway.
- Center of every named room, covering all four walls where possible.
- Both sides of every doorway, with special attention to door-frame corners and transom seams.
- At least one view after real artwork has loaded.

Create a short defect table grouped by:

- visible geometry gaps, overlaps, z-fighting, or flicker;
- flat or implausible wall, ceiling, and floor materials;
- lighting hotspots, dark artwork, or inconsistent exposure;
- artwork scale, aspect ratio, spacing, or doorway overlap;
- wayfinding and sign readability;
- details that make a room feel smaller or larger than its real dimensions.

Use this inventory to guide the work. Do not count source review alone as visual verification.

### 2. Repair remaining architectural finish defects campus-wide

Apply shared fixes across every existing connection when the cause is shared. Do not stop after repairing one or two proof doors.

Required checks:

- No gaps between jambs, headers, transoms, and wall faces.
- No coplanar or intersecting front faces that shimmer while moving.
- No doubled wall, casing, baseboard, ceiling-trim, or sign geometry.
- Floors remain continuous and flush through every opening.
- Baseboards and ceiling trim terminate cleanly at openings and corners.
- Door frames read as fitted trim within one shared wall, not freestanding posts or a second wall.

Use world-space bounding-box inspection when a suspicious object cannot be identified reliably by name.

### 3. Give every unfinished room a coherent neutral museum shell

The goal is a better visual foundation, not a new room theme.

Use COLLECTION as the reference for the smallest standard room's perceived scale. Preserve every room's existing physical dimensions, then improve visual scale through finishes and proportion:

- Walls: subtle painted-plaster or fine architectural-panel variation; avoid flat game-gray and avoid busy repeated lines.
- Ceilings: a complete, believable surface with restrained seams or bays at a scale appropriate to the room.
- Floors: a consistent museum-grade stone or polished concrete language with visible but restrained joints and enough roughness to avoid a mirror-like glare.
- Corners and junctions: clean wall-to-floor and wall-to-ceiling transitions.
- Large rooms: enlarge the spacing and rhythm of architectural details instead of repeating small-room details many more times.

Do not introduce a final themed identity for SPORTS, CARDS, MISC, AUTOMOTIVE, GAMES, BOTANY, STORE, SPOTLIGHT, or HUB. Keep their identity neutral and reversible.

### 4. Improve the HUB as a readable main hall

The HUB should feel intentionally larger than a standard room while staying part of the same building.

- Preserve the VLTD medallion and keep its surrounding navigation target unobstructed.
- Establish a clear ceiling rhythm appropriate to the HUB's larger span.
- Use wall bays, pilasters, or shallow reveals only where they clarify scale and doorway grouping; keep them flush and sparse.
- Keep open sightlines to destination signs.
- Avoid freestanding facade pieces, decorative stairs, thresholds, or columns that duplicate the shared-wall structure.
- Keep this a neutral architectural pass. Do not invent the final Grand Hall theme.

### 5. Normalize artwork presentation in unfinished rooms

Extend the existing good presentation rules without inventing content:

- Use the signed-in user's real items and existing room assignments.
- Preserve each image's natural aspect ratio.
- Exclude the real doorway no-display zones on every wall.
- Keep artwork centers, bottom clearances, and spacing consistent at human scale.
- Size works relative to the wall and room, avoiding tiny postage-stamp art in large halls and oversized art crowding standard rooms.
- Keep frames and display supports visually consistent with the neutral shell.
- Do not add fallback/demo items to make a room look populated.

### 6. Refine lighting without increasing instability

- Give items enough local light to read without obvious bright circles painted across the walls.
- Keep ambient room light sufficient for navigation.
- Remove overlapping or redundant lights where material emissive lift can do the same job.
- Avoid lights or reflective settings that make cases flicker as the visitor moves.
- Keep the existing full/preview room-light activation policy intact.
- Do not increase the number of active lights at HUB center beyond the current bounded policy without before/after measurements and a clear reason.

Check the scene after real artwork textures load, not only in an empty shell.

### 7. Performance cleanup tied to this visual pass

Only optimize resources touched or clearly implicated by this work:

- Reuse geometries, materials, and static textures where lifecycle-safe.
- Dispose generated textures and materials on scene teardown.
- Remove duplicate visual-only meshes found during the architecture sweep.
- Confirm there is no new console error or repeated texture/light allocation loop.

Do not use lower visual quality as the first performance fix. Find duplicated or unnecessary work first.

## Verification gates

Run before pushing:

1. `npx tsc --noEmit`
2. ESLint on every changed TypeScript/TSX file
3. `npm run build -- --webpack`
4. `validateCampusDoors()` reports zero geometry issues

After deployment, verify the exact production commit and then review the live production URL.

Minimum live visual evidence:

- HUB overview showing the medallion, larger square target, ceiling treatment, and several readable destination signs.
- One standard-room panorama using COLLECTION as the scale reference.
- One large-room panorama showing appropriately enlarged architectural rhythm.
- Both sides of at least six representative doors covering north, south, east, west, ordinary, and entrance cases.
- Close views of the redesigned ordinary sign and the VLTD MUSEUM entrance sign.
- At least two rooms after real artwork loads.
- A moving-camera check for casing/sign flicker.

Minimum functional regression check with a physical mouse if available:

- Click a square target, allow it to align, then scroll through the intended doorway.
- Turn left and right, then scroll forward.
- Cross several ordinary doors and the main entrance.
- Confirm slow and fast scrolling still feel like the accepted baseline.

Automation or teleport checks can support geometry findings, but they do not replace the physical-input acceptance check. If physical input is unavailable, say so plainly.

## Deployment rule

Work through ordinary code, build, rebase, and deployment problems without waiting for EK. Keep local checkpoints as needed, but deploy one consolidated production result after the full pass instead of a sequence of partially reviewed visual experiments.

Do not deploy if the accepted movement system, room dimensions, or target layout has changed. Revert that unintended scope before proceeding.

## Morning report

Return one consolidated report containing:

- Production URL and exact deployed commit.
- What visibly changed, grouped by architecture, materials, lighting, artwork, signs, and performance.
- Before/after screenshots or paired descriptions from matching camera positions.
- All rooms and doorway directions reviewed.
- Tests run and their results.
- Scene mesh/material/texture/light counts before and after, if the debug hook supports them.
- Items verified only in source or automation.
- Items verified live.
- Items requiring EK's physical mouse or visual judgment.
- Any remaining defects, with exact room/door locations.

---

## STATUS ADDENDUM (written 2026-09-10 evening, for a new chat picking this up)

**Not accepted yet.** EK has not done her own physical-input pass. Everything
below is this session's own live verification, which caught real mistakes of
its own along the way — read the "self-corrections" list, not just the
"shipped" list, before assuming any approach here is settled.

**Deployed commit:** `1546288` on `main` (production:
`https://vltd.vercel.app/museum/vltd`). Five commits, in order:
`35b7fe9` → `af3a0f3` → `0cecd8a` → `4a0cb01` → `1546288`.

### What shipped, in order

1. **`35b7fe9` — first pass at this work order.** Campus-only architectural
   wall panel texture (`createArchitecturalPanelTexture()` in
   `campusRoomBuilder.ts` — the shared `galleryTextures.ts` used by the
   accepted personal Gallery/prototype is untouched), a ceiling bay texture,
   a gradient sky background (`scene.background`, fixes PLAZA reading as a
   flat solid-navy wall instead of open sky), and an emissive self-lift on
   every legacy room's artwork (`hangFrame()` in `VltdMuseumCampus.tsx`,
   which previously had zero dedicated light).
2. **`af3a0f3` — self-caught bug from (1).** The ceiling bay lines were
   invisible in production: `MeshStandardMaterial.emissive` is NOT modulated
   by `map`, so the flat emissive fill (needed because a downward-facing
   ceiling gets almost no real light in this scene) completely washed out
   the pattern. Fixed with `emissiveMap` on the same texture. Also added
   texture disposal in the scene teardown (`material.dispose()` doesn't
   cascade to its textures — was a real, pre-existing gap, not new).
3. **`0cecd8a` — EK-reported bug, real one.** The wall panel texture from
   (1) scaled its repeat from `room.w` and reused ONE material across every
   wall face of a room — badly stretched on rectangular rooms (MISC 21×52,
   AUTOMOTIVE 42×52) since their east/west walls actually span `room.d`, not
   `room.w`. **Root fix, not a band-aid:** moved the scaling onto each wall
   *segment's own geometry* (`scaleWallPanelU()`), verified directly against
   `BoxGeometry`'s own UV generation in the Three.js source, not guessed.
   Verified with a throwaway offline script (raw UV buffer values) before
   ever deploying, then live at the exact same camera position before/after.
   Side effect: `createWallMaterial()` no longer depends on room size at
   all, so wall materials are now cached by **finish identity** instead of
   per room — collapsed 9 duplicate materials/textures into 1 (confirmed via
   `getSceneStats()`: 219→211 materials, 108→100 textures).
   **If you're re-touching wall materials: do NOT go back to `room.w`-based
   texture.repeat scaling — that's the exact bug this fixed.**
4. **`4a0cb01` — EK-reported bug, sent as screenshots with the flicker
   marked in blue at door jambs.** Real z-fighting, not caught by this
   session's own earlier static screenshots (z-fighting is a per-frame
   depth-buffer phenomenon; a still image can miss it entirely, or show it
   as faint noise instead of the flicker a moving camera actually sees —
   **lesson for next time: a single screenshot from a fixed pose is not a
   moving-camera check, however many times you retake it**). Root cause:
   `buildSharedWall()`'s jamb/head casing boxes are deliberately centered ON
   the seam between the solid wall and the door opening (so the casing
   "covers the seam"), but the adjacent solid wall piece was never
   shortened to make room — two opaque boxes occupied the identical
   footprint, one only 0.04–0.07 units proud of the other. Fixed by
   trimming the solid wall piece back by the casing's own `trimWidth`
   wherever its edge sits exactly on the door gap. Verified by querying the
   actual mesh bounding boxes live (`debugMeshesInRegion`), not just a
   screenshot: wall and jamb now meet at the identical coordinate, zero
   overlap.
5. **`1546288` — EK's own map review, two small additions, nothing else
   touched.** A new MISC↔HUB door (using the *exact same* computed formula
   as every other `CAMPUS_DOORS` entry — no hand-picked coordinates; its
   `gapCenter` lands at z=65 by that formula alone, which happens to exactly
   match the HUB↔AUTOMOTIVE door's own z=65, giving the straight sightline
   EK asked for "in line with Automobile across the way" — confirmed live
   from both directions in HUB). And `computeCampusWaypoints()` was skipping
   PLAZA's room-center target solely because PLAZA's `label` field is empty
   — that field isn't used for anything else in the function, so there was
   no real reason to exclude it. Every room has a target now.

### Self-corrections this session made on its own work (read before trusting anything above blindly)

- Wall panel scaling: shipped wrong in (1), EK caught it, root-caused and
  fixed properly in (3) — see the warning above.
- Ceiling bay texture: shipped invisible in (1), caught by this session's
  own live re-check (not EK) before it was ever reported, fixed in (2).
- Door jamb/head z-fighting: this is the one that should have been caught
  earlier. It's a pre-existing defect from the original 2026-09-08 doorway
  casing design (`buildSharedWall`), not something introduced this session
  — but this session's "moving camera check" for it (2 static screenshots
  from slightly different angles) was NOT actually adequate to catch
  z-fighting, and said so. EK caught it for real with an annotated
  screenshot. **If asked to verify flicker/shimmer again: query mesh
  bounding boxes directly (`debugMeshesInRegion`) for overlapping volumes,
  don't rely on screenshots at all** — that's the reliable method now.

### Interactive overview map

Built twice in-chat via the `visualize` MCP tool (an inline SVG floor-plan
diagram, room rects + a colored box per doorway) to help EK point at
specific connections. **This is an ephemeral chat widget, not saved
anywhere in the repo or as a durable artifact.** If a future session needs
it again: regenerate from `CAMPUS_ROOMS`/`CAMPUS_DOORS` in
`src/lib/campusLayout.ts` (a small tsx script can print exact screen
coordinates — see the git history of this session's scratch scripts under
`scripts/` for the pattern, though the scratch files themselves were
deleted after use since they duplicated layout logic rather than importing
it long-term).

### Verified this session (live, this round)

- All 20 doors (19 + the new MISC↔HUB one), both sides — no gaps, doubled
  surfaces, clipping, wrong signs, or finish mismatches found, after the
  jamb/head fix.
- All 13 rooms visited live at least once.
- Wall panel scale correct on both short and long walls of MISC and
  AUTOMOTIVE specifically (the two rooms EK named).
- Corner seams (checked one, AUTOMOTIVE's NW corner) — clean, no gap or
  overlap.
- `validateCampusDoors()`: 0 issues, 13 rooms, 20 doors.
- `tsc --noEmit` / ESLint / `next build --webpack`: clean on every commit
  above.
- No console errors live (one pre-existing, unrelated `THREE.Clock`
  deprecation warning only).
- Scene stats stayed sane throughout (mesh/geometry/light counts unchanged
  except the expected −8/−8 material/texture drop from finish-identity
  sharing).

### Still needs EK, or a future session, to check

- **The physical-input acceptance test itself** — click a target, scroll
  through a doorway, turn, cross the new MISC↔HUB door. Not re-run with
  real input by this session since the movement code was never touched.
- Whether the panel/ceiling texture contrast and scale actually look right
  to EK on her own display — tuned by eye against this session's own
  screenshots (`PANEL_WIDTH = 4.2`, `CEILING_BAY_SIZE = 7.8` in
  `campusRoomBuilder.ts` if it needs a numeric tweak).
- One unrelated, out-of-scope, not-fixed observation: BUILT_BOTANY's
  top-of-screen room label shows the raw internal id `"BUILT_BOTANY"`
  instead of a display name, because `CAMPUS_ROOMS`'s `label` field for that
  room was never given a human-friendly value (unlike e.g. `AUTOMOTIVE`,
  whose `label` is `"Automobile"`). Purely a data/copy fix if EK wants it —
  one line in `campusLayout.ts`.
- The doorway/room checklist above is real coverage from this session, but
  it was reactive (kept expanding because EK kept finding gaps in earlier,
  smaller sweeps) — don't assume "19/19 confirmed clean" from an earlier
  round in this same day means the CURRENT deployed commit is still clean
  without a fresh look, since more fixes landed after that claim.

Do not describe the museum as finished or accepted. EK's foreground visual and physical-input review remains the acceptance gate.
