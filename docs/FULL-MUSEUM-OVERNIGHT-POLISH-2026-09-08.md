# Full Museum Overnight Architecture and Usability Pass

**Route:** `https://vltd.vercel.app/museum/vltd`  
**Authorized by EK:** 2026-09-08, for autonomous completion while EK is unavailable  
**Production baseline at handoff:** `407eb90`  
**Purpose:** finish the shared architectural system and neutral museum presentation without converting another room theme

## Authority and working method

EK explicitly authorized a substantial overnight pass and one complete production deployment. Continue through ordinary implementation, lint, build, Git, and Vercel problems without waiting for EK. Do not stop after a source-only check, a diagnostic addition, or one corrected doorway.

Begin from the latest `origin/main`, not from a stale local checkout. Record the exact starting SHA. Read this document together with:

- `docs/FULL-MUSEUM-SHARED-WALL-GRID-PLAN-2026-09-08.md`
- `docs/FULL-MUSEUM-ARCHITECTURE-RESET-2026-09-08.md`
- `docs/GRAND-HALL-CONCEPT.md`
- `APP_MAP.md`
- `HANDOFF.md` section 0

Inspect the current implementation before editing. Several earlier comments and local documents describe superseded vestibule geometry, so live production and current `origin/main` are authoritative.

## Accepted foundation: preserve all of it

The following work is accepted and must remain intact:

1. The exact shared-wall module grid implemented in `3a543a7` and refined afterward.
2. All 13 room bounds and all 19 existing campus doors on true shared boundaries.
3. `COLLECTION` as the accepted `21 x 26 x 9.15` smallest-room reference.
4. `MISC` as `21 x 52`, the large rooms as module multiples, and `HUB` as the planned main hall footprint.
5. One structural wall per shared boundary and one opening/casing assembly per connection.
6. The physically accepted wheel tuning deployed in `0ee7af2`: immediate response, slow and fast scrolling, and movement in the direction the visitor faces.
7. The flat, continuous doorway floors after removal of the three stale entrance-step boxes in `3848075`.
8. The real `COLLECTION` content-selection fix from `c74aee6`.
9. Natural artwork aspect ratios, real user content, and doorway exclusion zones.
10. The bounded full/preview room-light activation architecture.

Do not reintroduce vestibules, connecting mini-hallways, duplicate back-to-back walls, raised thresholds, ramps, platforms, reveal lights, queued movement, or the removed legacy facade geometry.

## Current visitor-visible defects

These are the priority order for the overnight pass.

### 1. Doorway height and proportion

The current shared openings are approximately `8.21` units high in a `9.15`-unit room. In production they read as tall, narrow elevator shafts and expose large areas of dark background above the adjoining room.

- Restore the accepted personal Gallery clear-opening proportion: approximately `4.83` units high. Use the exact shared constant if the accepted Gallery already exposes one.
- Retain the current wall-gap width of approximately `4.1` unless the existing accepted doorway constant differs slightly.
- The structural wall must continue from the top of the opening to the ceiling.
- That upper wall area must be built by the same wall system and receive the correct finish for each face. It must not be a visually separate transom patch, tower, or floating block.
- Update collision/opening calculations from the same doorway data. Do not create a visual opening that disagrees with navigation geometry.

Apply the corrected height to every ordinary campus connection and to the `PLAZA↔HUB` entrance. Do not fix only the spawn entrance.

### 2. Shared casing and header refinement

Ordinary room-to-room openings should read as fitted museum architecture:

- slim jamb and head casing;
- shallow projection from the wall face;
- clean miters or joined corners;
- no duplicate casing on the opposite room;
- no exposed back faces or gaps at oblique angles;
- no decorative columns or pediments;
- a completely flush floor transition.

The `PLAZA↔HUB` entrance may use a modestly wider and deeper version of the same system, with a slightly stronger integrated header. It should still look like part of the wall rather than a freestanding facade.

Use shared geometry, materials, and textures wherever possible. Do not create unique material instances for every jamb or sign.

### 3. Destination signs

- Correct the clipped `VLTD MUSEUM` entrance text. Give the sign canvas adequate top/bottom padding and vertically center the type.
- Mount each sign on the appropriate wall/header face with a small, consistent offset that prevents z-fighting.
- Show the destination room from both approaches.
- Keep ordinary room signs restrained and legible at normal walking distance.
- Eliminate obsolete room-center title sprites and other duplicate wayfinding that appears through several rooms.

### 4. Background and distant floating text

The production view contains a distance-invariant `VLTD Museum` label that appears to float through doorways. It has been identified as a background/skybox element rather than a 3D mesh. Its implementation source does not change the visible defect.

- Remove or suppress this background label on `/museum/vltd`.
- Preserve the normal application header and the correctly mounted doorway signs.
- Inspect long sightlines after removal to ensure no other fixed-size background text or sprites float through rooms.

### 5. Neutral architectural finish across the campus

This pass must make the campus look like a coherent, intentionally unfinished museum shell rather than a collection of gray boxes. It must not assign final themes to additional rooms.

Create or reuse a neutral shared finish system:

- subtle plaster/paint wall variation with correctly scaled texture detail;
- a real ceiling plane in every enclosed room;
- clean wall-to-ceiling junctions;
- restrained baseboards that terminate at openings;
- one coherent neutral floor family with visible scale and controlled roughness;
- no checkerboard developer-looking floor where a finished neutral floor is expected;
- no stretched texture spanning several module bays;
- no broad gold stripes or repeated decorative wall lines;
- no black ceiling voids visible through openings.

Different rooms may retain their existing accepted styles. Unconverted rooms should receive only this neutral structural finish. Do not turn SPORTS, CARDS, MISC, AUTOMOTIVE, BUILT_BOTANY, GAMES, SPOTLIGHT, STORE, PLAZA, or HUB into a new themed identity.

### 6. HUB/Main Hall structural presentation

Use `docs/GRAND-HALL-CONCEPT.md` only for neutral architectural direction. Do not attempt the final model-first Grand Hall theme overnight.

Within the current runtime geometry:

- make the full `HUB` volume read as one intentional large hall composed of repeated `21 x 26` bays;
- keep the accepted `9.15` ceiling height;
- ensure every shared doorway aligns cleanly with a bay and is visible as a real route;
- keep the center open for turning and direct walking;
- remove obsolete labels, disconnected trim, and leftover geometry;
- use repeated ceiling/floor/wall rhythm to provide human scale without adding heavy decorative meshes;
- retain any existing center medallion only if it is flush, correctly centered on the new grid, and visually restrained.

### 7. Artwork and room-content sweep

Across every existing room:

- no artwork may overlap a doorway or its casing;
- artwork must face into its owning room;
- preserve each image's natural aspect ratio;
- remove duplicated, floating, embedded, or back-facing display meshes;
- keep content at believable viewing heights and scales;
- do not invent fallback collection content when real content is available;
- keep `COLLECTION` populated from the accepted real-content selection path.

### 8. Lighting and performance cleanup

Do not add a new light for every architectural detail.

- Remove obsolete or invisible lights tied to deleted vestibules, facade pieces, sprites, or doorway reveals.
- Reuse materials, textures, and geometries where the visual result is identical.
- Prefer bounded room-level lighting and material response over unlimited per-item dynamic lights.
- Keep the accepted full/preview activation behavior.
- Ensure door crossings do not cause a visible blackout or delayed room illumination.
- Avoid wide overlapping spotlights, flicker, heavy bloom, mirror-like floor hotspots, and bright wall reflections with no plausible source.

Record live scene counts before and after: meshes, geometries if exposed, materials, textures, total lights, enabled lights, and draw calls if available.

## Movement lock and regression tests

EK physically accepted the current wheel behavior: it now feels much better, supports slow and fast scrolling, and follows the direction faced. Treat it as locked.

Do not change `visitorController.ts`, wheel constants, decay rates, yaw selection, or the accepted campus call-site override unless a new regression is proven and the fix is necessary. Architectural work must not alter movement feel.

Re-test in a foreground browser after geometry changes:

1. Slow individual wheel notches move promptly and smoothly.
2. A rapid burst produces faster continuous travel without a queued jump.
3. Turn left, then scroll forward: movement follows the rendered view.
4. Turn right, then scroll forward: movement follows the rendered view.
5. Forward and backward retrace approximately the same path.
6. Walls stop travel without sliding or redirecting the visitor sideways.
7. Every doorway crosses in both directions without collision snagging.
8. Manual input cancels waypoint movement immediately.

Automated events and debug hooks may supplement this test but do not replace foreground physical input. Do not call movement accepted on EK's behalf; report only that the already accepted behavior was preserved or that a regression was found.

## Implementation sequence

1. Fetch latest `origin/main`; record starting SHA and confirm it contains production baseline `407eb90` or a newer intentional commit.
2. Inventory the current wall, opening, casing, sign, floor, ceiling, background-label, artwork, and light creation paths.
3. Establish shared doorway dimensions and one authoritative opening definition.
4. Correct doorway height, upper-wall construction, casing, header, and signs in the shared builder.
5. Prove the shared output locally at `PLAZA↔HUB`, `POP_CULTURE↔TCG`, `COLLECTION↔MISC`, and one legacy-to-legacy connection.
6. Apply the shared correction across all 19 connections.
7. Remove the floating background label and obsolete room-center sprites.
8. Apply the neutral structural finish and ceiling/floor cleanup across all unconverted rooms without adding themes.
9. Clean HUB's repeated-bay presentation and long sightlines.
10. Sweep artwork placement and wall/opening terminations across the full connected route.
11. Remove obsolete geometry, materials, textures, and lights; measure the resulting scene.
12. Run layout/door validators, typecheck, lint, and one production build.
13. Walk the entire connected campus locally in both principal directions. Fix defects found during that walkthrough.
14. Deploy one coherent production result. If the normal Git-triggered deployment does not appear, use Vercel's Create Deployment for the exact pushed `main` SHA.
15. Verify the exact production SHA at `/museum/vltd`, repeat the walkthrough, and return one consolidated report.

## Required validation

### Geometry and layout

- all 13 room bounds match the approved grid;
- zero room overlaps and zero unexplained gaps;
- all 19 connections lie on true shared boundaries;
- `MISC↔HUB` remains a solid shared wall with no door;
- one structural wall and one casing assembly per connection;
- all floors meet at `y=0` with no steps or slabs;
- all enclosed rooms have ceilings at the accepted height;
- no exposed wall ends, double walls, black voids, or hallway remnants from normal walking positions.

Use world-space bounds for geometry audits: update world matrices and calculate `THREE.Box3().setFromObject(...)`. Do not rely only on mesh names or local `position` values. Temporary unique debug colors and visibility toggles are encouraged for identifying unexpected geometry.

### Visual proof

Capture production screenshots at minimum:

1. Initial Corridor/PLAZA view facing the `VLTD MUSEUM` entrance.
2. The entrance from inside HUB looking back.
3. An oblique close view of the entrance casing and flush floor.
4. `POP_CULTURE↔TCG` from both sides.
5. `COLLECTION↔MISC` from both sides.
6. One legacy-to-legacy doorway from both sides.
7. HUB center looking north, south, east, and west.
8. One full-room view each of POP_CULTURE, TCG, and COLLECTION.
9. A long sightline showing that floating background text and obsolete sprites are gone.

Screenshots must be judged visually. A mesh count or world-bound report does not prove that something looks correct.

### Performance and console

- measure foreground stationary and moving frame time for at least 15 seconds at HUB, POP_CULTURE, TCG, COLLECTION after art loads, and one multi-room sightline;
- report the measurement environment and distinguish foreground results from background-throttled automation;
- report console errors and warnings;
- do not hide performance problems by increasing movement speed or travel distance.

## Stop conditions

Do not deploy if any of the following remain:

- a doorway is still nearly ceiling-height or visibly out of proportion;
- the upper wall looks like a mismatched patch or detached tower;
- a sign is clipped, backward, embedded, duplicated, or shows the wrong destination;
- a raised threshold, step, ramp, or offset floor slab is visible;
- background or room-center text floats through long sightlines;
- any door is built twice or any mini-hallway reappears;
- any existing room becomes unreachable;
- movement no longer matches the physically accepted behavior;
- another room theme is introduced;
- the deployed production SHA cannot be confirmed.

If one item cannot be completed without a true product decision, finish every independent item first, preserve the working production baseline, and report the exact blocker. Ordinary aesthetic and implementation choices described in this document are already authorized.

## Consolidated production report

Return one report containing:

- starting SHA, final commit SHA, and confirmed Vercel production status;
- a concise before/after description centered on visitor-visible behavior;
- all required production screenshots;
- a 19-connection doorway audit with height, width, signs on both faces, collision result, and visual result;
- room/grid validation results;
- artwork-placement audit results;
- scene-resource and light counts before/after;
- foreground movement regression results;
- foreground performance measurements;
- console output;
- remaining visible limitations ranked by visitor impact.

Clearly distinguish source inspection, validator output, automated input, static screenshots, foreground physical testing, and EK acceptance.

