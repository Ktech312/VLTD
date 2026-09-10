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

Do not describe the museum as finished or accepted. EK's foreground visual and physical-input review remains the acceptance gate.
