# Full Museum Architecture Reset — 2026-09-08

## Read this before changing anything

This is a correction pass for the production public museum at:

- `https://vltd.vercel.app/museum/vltd`
- current production baseline: `c74aee6`

Do not ask EK to restate the problem. The three screenshots supplied with this handoff are the visual acceptance references:

1. `docs/assets/museum-doorway-mismatch-2026-09-08.png`
2. `docs/assets/museum-double-wall-corridor-2026-09-08.png`
3. `docs/assets/museum-frame-gap-2026-09-08.png`

The screenshots are room-architecture references and defect evidence. Their yellow markings identify the problem areas; they are not requests to add yellow geometry.

## Overnight objective and decision

This is a full overnight implementation pass, not another one-defect micro-patch. Work autonomously through the complete checklist below, build and deploy one coherent result, verify production, and return one report when finished. Do not stop after the first representative doorway or ask EK to make routine implementation choices while she is asleep.

Freeze all further room-theme conversions. Do not convert SPORTS, CARDS, MISC, AUTOMOTIVE, BUILT_BOTANY, GAMES, HUB, STORE, or SPOTLIGHT to the new standard-room visual theme. They may receive the shared connection geometry needed to make the campus circulation coherent.

POP_CULTURE, TCG, and COLLECTION now contain useful groundwork: standard `21 x 26 x 9.15` room bounds, real ceilings, real vault items, natural image aspect ratios, doorway exclusion zones, and bounded room-light ownership. Retain that groundwork.

The current three-room result is not an acceptable finished prototype. The next pass must repair the shared architecture and movement response before doing more room styling.

## What EK is seeing

### 1. The transom is visibly a separate patch

In screenshot 1, the wall block above the MISC opening does not read as part of the wall. The sign itself may remain a contrasting plaque, but the wall surface behind and around it must be continuous with the surrounding wall.

Source cause: `buildRoomShell()` creates the wall with a grain map, bump map, bump scale, and its own roughness. `buildDoorways()` creates the transom with a separate flat `MeshStandardMaterial`. Even when both use the same numeric color, they respond differently to light and cannot match visually.

Required result:

- Use the exact same wall-surface material instance or the exact same wall material factory for the transom and adjacent wall segments.
- Grain scale, bump, roughness, color space, and light response must continue across the opening.
- The destination plaque may contrast, but it must look mounted on the wall rather than floating on a different wall patch.

### 2. The campus is showing doubled room walls and accidental mini-hallways

Screenshots 2 and 3 show complete room walls standing in front of other complete room walls, with narrow bridge spaces between them. These read as accidental gaps in the model rather than deliberate museum circulation.

This is structural. The layout currently leaves real coordinate gaps between several connected room rectangles, including roughly:

- POP_CULTURE to HUB: `1.42` units
- POP_CULTURE to TCG: `2.00` units
- TCG to MISC: `2.00` units
- COLLECTION to HUB: `1.99` units
- COLLECTION to MISC: `1.99` units
- COLLECTION to SPORTS: `1.36` units

`computeDoorBridges()` makes those gaps walkable, but walkability alone does not make them finished architecture. Meanwhile `buildDoorways()` is called from each converted room module, so a connection between two converted rooms can receive a room-owned assembly at both ends of the bridge rather than one connection-owned architectural opening.

Required design rule:

- A physical connection belongs to `CAMPUS_DOORS`, not independently to both rooms.
- Generate each connection once from one source of geometry.
- A visitor must see one coherent opening, with continuous jambs/returns, a finished ceiling/reveal, a continuous threshold, and correct destination labeling on both approaches.
- No exposed wall edge, freestanding slab, black ceiling void, duplicate frame, or unexplained narrow passage may remain.

For rooms intended to meet directly, reflow their coordinates so the shared boundaries meet and cut one opening through the shared partition. For any gap that must remain because HUB or another preserved footprint cannot move, model that connection as one deliberate, fully enclosed reveal owned by the door: two side returns, a ceiling return, threshold floor, and aligned faces. It must read as doorway depth, not as a tiny hallway between unrelated walls.

Do not broadly redesign the approved campus circulation graph. First prove the connection builder locally on these two representative connections:

1. POP_CULTURE ↔ TCG, where both rooms use the shared builder.
2. COLLECTION ↔ MISC, where one room is converted and one remains legacy.

The solution must support both cases without one-off meshes for those room IDs. Once both cases pass locally, apply that same connection-owned architecture to all existing entries in `CAMPUS_DOORS` during this pass. Every current connection should finish with the same construction rules even when one or both adjoining rooms still use legacy finishes.

For all campus connections:

- preserve the current room graph and destination labels unless geometry proves a listed connection invalid;
- generate one connection assembly per `CAMPUS_DOORS` entry;
- remove or bypass every older room-owned doorway assembly that would overlap it;
- enclose every retained gap with side returns, a ceiling return, and a continuous floor threshold;
- use the approaching room's wall finish on each visible outer face, allowing the two sides of one connection to have different finishes when appropriate;
- keep the inside reveal neutral and deliberate;
- ensure signs on both approaches name the destination on the far side;
- keep collision and visual geometry derived from the same connection bounds.

### 3. Door frames have visible gaps and do not seal into the wall

The frame kit uses a `4.10` wall gap around a `3.86` outer frame footprint, intentionally leaving `0.24` total clearance. In the accepted personal room this may be visually harmless against its surrounding geometry. In the campus screenshots it appears as open slivers and detached trim.

Required result:

- Preserve at least `3.54` units of clear walk-through width.
- Add wall returns or casing that closes every visible sliver around the frame.
- The header must meet the posts cleanly.
- The frame/reveal must have enough depth to cover the actual partition or connector depth.
- Inspect from both sides and at oblique angles, not only straight-on.
- Do not solve this by widening solid wall collision into the walking path.

### 4. Mouse-wheel movement is delayed

EK's foreground result is that mouse scrolling now reacts very late. This is not accepted simply because heading math uses rendered `yaw`.

The current wheel handler moves `targetCameraBody` by `0.42`, while the rendered `cameraBody` chases it with a frame-based `0.15` lerp. Repeated wheel events can therefore queue movement behind the visible camera. As the scene becomes heavier, frame-based easing also changes perceived response with frame rate.

Required interaction behavior:

- The first wheel notch must create visible forward/backward movement immediately.
- The movement vector must use the heading currently rendered on screen.
- Repeated wheel notches must not build a long movement queue that continues after the user stops.
- Forward and backward must retrace the same line when the view is unchanged.
- Collision may shorten or stop the requested vector; it may not redirect it sideways.

For this campus pass, apply each wheel step through `moveWithCollision()` to the visible `cameraBody` immediately, then synchronize `targetCameraBody` to it. Keep drag rotation separate from position. If any smoothing remains, make it delta-time based and cap its duration; do not retain an unbounded target-position backlog.

Do not claim that sharing the personal Gallery's constants proves matching usability. The campus has different geometry and a much heavier scene. Match the experienced result in the foreground browser.

## Complete converted-room cleanup

Repair POP_CULTURE, TCG, and COLLECTION as one coherent three-room sample after the global connection builder is in place:

- remove duplicate, hidden, or superseded doorway/transom/frame meshes;
- make wall, transom, baseboard, picture rail, and ceiling trim terminate cleanly at every opening;
- continue floor material cleanly to each threshold without a blue or black uncovered strip unless a deliberately designed threshold material occupies it;
- remove exposed backs or edges of walls visible from any normal walking position;
- remove black ceiling voids visible through connections;
- preserve the accepted `21 x 26 x 9.15` clear room dimensions;
- preserve real COLLECTION content selection from `c74aee6`;
- preserve natural artwork aspect ratios and doorway exclusion zones;
- ensure every artwork faces into its owning room and remains readable under the bounded lighting system;
- make the neutral finish consistent across the three rooms without attempting their final themed identities.

Do not spend this pass on subtle color tuning until all geometry above is clean from both straight and oblique views.

## Performance check and correction before visual polish

The current converted rooms can enable structural spotlights, up-glow point lights, wall washes, doorway reveal lights, and up to six real picture spotlights per room. This may contribute to poor response, but do not guess.

Measure the production route in a foreground browser at:

- HUB center
- POP_CULTURE center
- TCG center
- COLLECTION center after its real art loads
- one converted-room bridge

Report frame time or FPS over at least 15 seconds while stationary and while scrolling. If performance drops materially as full room lights activate, correct it in this pass: replace per-art dynamic spotlights with a bounded cheaper treatment, reuse geometry/materials/textures where practical, and remove duplicate or invisible meshes/lights left by the old per-room doorway path. Do not increase light counts during this correction.

Target a stable foreground experience with no obvious input-to-render pause. Do not hide a slow frame rate by increasing movement distance or animation speed.

## Full work order

1. Record the exact `origin/main` and production SHA.
2. Reproduce EK's three screenshot angles on production.
3. Inventory every wall, room-owned doorway mesh, connection, bridge, threshold, sign, and light creation path before editing. Record which paths will be removed or replaced.
4. Refactor doorway geometry so one `CAMPUS_DOORS` connection owns one coherent assembly.
5. Prove the new assembly on POP_CULTURE ↔ TCG and COLLECTION ↔ MISC locally.
6. Apply it to all current campus connections, including converted-to-converted, converted-to-legacy, legacy-to-legacy, HUB, and entrance cases.
7. Fix transom/wall material continuity and all wall/baseboard/rail/trim terminations.
8. Close all frame, wall, threshold, and reveal slivers throughout the campus.
9. Clean POP_CULTURE, TCG, and COLLECTION as the coherent three-room visual sample described above.
10. Make mouse-wheel motion visibly immediate with no queued glide. Re-run drag, W/S, reverse-path, wall-collision, and waypoint-cancellation checks.
11. Measure foreground performance, eliminate duplicate geometry/lights, and apply the bounded performance corrections described above if needed.
12. Run `validateCampusDoors()`, relevant focused checks, lint, and one production build after implementation is complete.
13. Walk the full connected route locally. Fix defects found during that walkthrough before deploying.
14. Deploy one coherent commit. If the Git-triggered Vercel deployment does not appear after a reasonable wait, use Vercel's **Create Deployment** action with the exact `main` SHA rather than asking EK to troubleshoot it.
15. Verify the exact SHA on `https://vltd.vercel.app/museum/vltd` and repeat the production walkthrough.
16. Return one consolidated report. Do not convert another room theme.

Continue through ordinary build, lint, geometry, and implementation failures autonomously. A failed first approach is not a reason to stop. Preserve the last known production deployment until the complete local result passes its checks.

## Required production evidence

Return one report containing:

- exact deployed SHA and Vercel production status;
- the same three camera angles as the supplied screenshots;
- close oblique views of POP_CULTURE ↔ TCG and COLLECTION ↔ MISC from both approaches;
- a doorway audit table covering every `CAMPUS_DOORS` entry, with connection type, visual result, collision result, and destination labels from both sides;
- proof that every visible frame gap and exposed wall edge is closed throughout the connected route;
- proof that the wall surface continues across the transom;
- ten individual forward wheel notches with position recorded after each input and after the user stops;
- immediate right-turn then forward-scroll, and left-turn then forward-scroll;
- forward/back retrace test;
- stationary and moving performance observations at the five locations above, with before/after light and mesh counts if performance work was required;
- console errors and warnings.

Also include a short list of remaining visual limitations, ranked by how strongly a normal visitor will notice them. Do not bury visible defects beneath implementation details.

The report must distinguish source inspection, automated coordinate checks, static screenshots, and foreground physical-mouse experience. Do not mark movement accepted without EK's own test.

## Stop conditions

Stop rather than deploy if:

- any new room is converted;
- a doorway is still constructed twice from separate room modules;
- a mini-hallway remains as an unexplained open gap anywhere on the connected route;
- a frame or transom visibly floats away from the wall;
- the wheel continues moving after input has stopped because prior notches remain queued;
- collision redirects a forward step sideways;
- the production SHA cannot be confirmed.
