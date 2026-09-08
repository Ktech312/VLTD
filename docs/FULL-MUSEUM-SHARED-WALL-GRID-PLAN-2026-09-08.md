# Full Museum Shared-Wall Grid Plan — 2026-09-08

## Status and decision

Production baseline reviewed: `d78895c` at `https://vltd.vercel.app/museum/vltd`.

Do not accept the connection-owned vestibule implementation as the final campus architecture. It solved doubled doorway assemblies by enclosing the coordinate gaps, but the gaps still exist and still function as short hallways. EK's foreground review rejects that premise: adjoining museum rooms should share one structural wall, like a real building.

Do not convert or restyle another room while this plan is being reviewed.

Retain these accepted results:

- COLLECTION establishes the smallest-room module: `21 x 26 x 9.15` clear interior units.
- POP_CULTURE, TCG, and COLLECTION content selection, natural artwork aspect ratios, and doorway display exclusions.
- COLLECTION's `c74aee6` real-item selection fix.
- destination-based signs, provided they are rebuilt as part of a real shared-wall opening.

Reject these parts of `1ef4907` / `d78895c` as permanent architecture:

- filling every room-to-room coordinate gap with an enclosed vestibule;
- placing the frame at the midpoint of that vestibule;
- treating both complete room walls as valid and connecting them afterward;
- creating a full unique doorway assembly, materials, canvas signs, and reveal light for every gap regardless of visibility or need;
- direct fixed-distance wheel stepping without a foreground physical-mouse acceptance result.

## Modular floor plan

Use COLLECTION as one module:

- module width: `21`
- module depth: `26`
- room height: `9.15`

Rebuild campus coordinates on exact module boundaries. Adjacent rooms must touch at the same coordinate. There must be zero unowned space between their walls.

| Room | X range | Z range | Size | Module role |
| --- | --- | --- | --- | --- |
| POP_CULTURE | `0..21` | `0..26` | `21 x 26` | smallest room |
| TCG | `0..21` | `26..52` | `21 x 26` | smallest room |
| MISC | `0..21` | `52..104` | `21 x 52` | two modules deep |
| HUB | `21..84` | `0..78` | `63 x 78` | main hall, 3 x 3 modules |
| BUILT_BOTANY | `84..126` | `0..26` | `42 x 26` | two modules wide |
| GAMES | `84..126` | `26..52` | `42 x 26` | two modules wide |
| AUTOMOTIVE | `84..126` | `52..104` | `42 x 52` | four-module large room |
| COLLECTION | `21..42` | `78..104` | `21 x 26` | accepted smallest room |
| SPORTS | `42..63` | `78..104` | `21 x 26` | smallest room |
| CARDS | `63..84` | `78..104` | `21 x 26` | smallest room |
| SPOTLIGHT | `21..42` | `-26..0` | `21 x 26` | entrance wing module |
| PLAZA | `42..63` | `-26..0` | `21 x 26` | open entrance forecourt |
| STORE | `63..84` | `-26..0` | `21 x 26` | entrance wing module |

This layout preserves the campus's overall relationships while making every current door pair geometrically capable of sharing a wall:

- POP_CULTURE ↔ TCG at `z=26`
- TCG ↔ MISC at `z=52`
- POP_CULTURE ↔ HUB at `x=21`
- TCG ↔ HUB at `x=21`
- MISC ↔ COLLECTION at `x=21`
- HUB ↔ BUILT_BOTANY / GAMES / AUTOMOTIVE at `x=84`
- CARDS ↔ AUTOMOTIVE at `x=84`
- HUB ↔ COLLECTION / SPORTS / CARDS at `z=78`
- COLLECTION ↔ SPORTS at `x=42`
- SPORTS ↔ CARDS at `x=63`
- BUILT_BOTANY ↔ GAMES at `z=26`
- GAMES ↔ AUTOMOTIVE at `z=52`
- SPOTLIGHT / PLAZA / STORE ↔ HUB at `z=0`

MISC also touches HUB along `x=21, z=52..78`; leave that shared wall solid unless EK later restores the MISC↔HUB shortcut. Do not add a door merely because the geometry permits one.

## Real shared-wall construction

The building shell must be generated from boundaries, not four independent walls per room.

For each boundary segment:

1. Determine whether it is an exterior boundary or is shared by two rooms.
2. Generate one structural wall volume for that segment.
3. Apply a room-facing finish skin to each side. The skins may use different room themes without duplicating the structural wall.
4. If `CAMPUS_DOORS` contains a door on that shared segment, cut one opening from the one wall.
5. Build one casing/frame assembly inside that cut, spanning the actual wall thickness.
6. Mount one destination sign on each face, each naming the room on the far side.
7. Generate one threshold within the wall thickness only.
8. Derive collision from the same solid wall segments and opening bounds.

No room-to-room bridge or vestibule is needed when room boundaries share a coordinate. `computeDoorBridges()` should become unnecessary for ordinary interior doors. Keep a separately named exterior/forecourt transition only if the open PLAZA requires it.

Required visual result:

- no double wall;
- no unowned 1–2 unit gap;
- no small hallway between two adjoining rooms;
- no exposed wall back or side edge;
- no frame floating in front of a second wall;
- no full-height black void;
- no patched transom material;
- wall trim, baseboards, rails, and finish skins terminate at the casing.

## Performance correction

The `d78895c` scene now creates connection geometry for all 19 doors, one PointLight per connection, two canvas-texture signs per connection, and multiple unique materials/geometries per connection. The reported `64` scene lights are not all structural: the three converted rooms can still include up to six dynamic artwork spotlights each.

Before judging movement code, reduce avoidable scene work:

- remove the vestibule meshes and connection reveal lights made obsolete by shared walls;
- share frame geometry and materials rather than cloning unique resources per door;
- cache destination-sign textures by label rather than drawing a new canvas for repeated labels;
- share wall finish materials/textures by finish identity;
- replace per-art dynamic SpotLights with the existing emissive/material treatment unless a measured foreground comparison proves a small bounded set is affordable;
- report total meshes, materials, textures, and lights before and after;
- measure frame time in a foreground browser, including after COLLECTION art loads.

## Mouse-wheel correction

EK's production result on `d78895c`: scrolling is worse and remains delayed even in an area with little visible content. Automated synthetic WheelEvents are not acceptance evidence.

Do not make another unmeasured wheel rewrite.

1. Add temporary diagnostics that record physical wheel event arrival time, the next rendered frame time, event count, normalized `deltaY`, camera position before/after, rendered yaw, and current FPS/frame time.
2. Test with EK's normal mouse in foreground Chrome after the shared-wall/performance cleanup.
3. Ensure each physical notch produces one controlled response. Handle high-resolution wheels that emit several small events without turning them into multiple `0.42` jumps.
4. Movement must begin on the next rendered frame and stop when fresh input stops. Do not accumulate a target-position backlog.
5. Use rendered `yaw` for the movement vector.
6. Forward/backward must retrace the same line.
7. Collision may shorten or reject movement and may not redirect it.
8. Keep W/S continuous movement and mouse-drag rotation independent.

If a temporary on-screen diagnostic is needed for EK's physical test, place it behind the existing debug mode and remove or disable it before final production acceptance.

## Safe implementation sequence

1. Start from current `main`, but remove the rejected vestibule implementation locally as part of the same branch. Do not deploy a standalone rollback.
2. Preserve `c74aee6` COLLECTION item selection and later content work.
3. Implement the exact modular coordinates above in one data change.
4. Replace per-room wall generation with boundary-owned shared walls.
5. Replace vestibules/bridges with one opening per shared wall.
6. Recompute usable artwork wall spans and waypoints from the new room bounds.
7. Recompute collision from the same shared-wall/opening data.
8. Remove obsolete meshes, materials, lights, and helper paths.
9. Validate every existing door against the new shared boundary.
10. Run lint, typecheck, and production build.
11. Perform a full local walkthrough before deploying.
12. Deploy one coherent commit and verify the exact production SHA.
13. Stop for EK's foreground scale, architecture, and mouse review. Do not begin final room themes.

## Required evidence

- top-down plan rendered from the actual new coordinates;
- dimensions for every room;
- zero gap distance for both endpoints of every interior door;
- views of every shared opening from both sides;
- close oblique doorway views showing one wall and one casing;
- proof that no art, trim, rail, or baseboard overlaps an opening;
- mesh/material/texture/light counts before and after;
- foreground frame-time measurements at HUB, POP_CULTURE, TCG, COLLECTION, and one large room;
- physical-mouse results supplied by EK kept separate from automation results;
- console errors and warnings;
- exact deployed SHA and Vercel production status.

## Stop conditions

Do not deploy if any of these remains:

- two walls separated by a room-to-room gap;
- a vestibule used to disguise that gap;
- duplicated structural walls on one shared boundary;
- a doorway frame not contained within the shared wall;
- movement delay hidden by larger steps or faster animation;
- COLLECTION content selection lost;
- a new room theme introduced;
- a door fails either visual or collision traversal.

