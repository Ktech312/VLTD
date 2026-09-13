# Museum rooms: finish the White/Vault/Arcade/Loft parity — furniture + decorative details — 2026-09-12

Follow-up to `docs/MUSEUM-BUILDER-REAL-GALLERY-ENVIRONMENTS-2026-09-12.md`
(shipped as commit `bf92a5d`). EK live-tested Vault and said, correctly:
"Vault does not look anything like the vault in the 3d gallery." Verified
directly by comparing the real `/museum/virtual-room` Vault room against
Museum Builder's Vault-styled room side by side, then reading the code.
Two concrete, confirmed gaps — fix these, don't guess at more:

## 1. Display case and shelf materials ignore the chosen style

`src/lib/museumRoomFurniture.ts`'s `buildDisplayCase()` hardcodes its own
cabinet/glass colors (`0x2b3037`, `0xbceeff`) and `createShelfMaterial()`
likely does something similarly fixed — read it before changing anything.
These never received the `createGalleryFinishes(style)` materials the
previous pass wired into walls/floor/ceiling/rail. Fix: when a room has a
saved `room_style`, build cases/shelves using that style's real `brass`
(case trim/shelf hardware) and `dark` (cabinet base) materials from
`createGalleryFinishes(style)` — the same materials already resolved for
that room's walls — instead of the hardcoded ones. Keep the existing
fallback (today's hardcoded colors) for rooms with no style set. Glass
stays functionally similar across styles (it's meant to read as glass),
but check whether Vault's own `glass` material (from
`createGalleryFinishes`) should replace the fixed one too — probably yes,
for consistency; use judgment but say what you did.

## 2. Vault's decorative identity geometry was never ported

`createGalleryFinishes()`'s `addVaultArmor(room)` (and Loft's own
`addLoftArmor`) build real 3D geometry — structural rib panels, rivets,
and (for Vault, via the ceiling handling elsewhere in that file) a
recessed light-grid ceiling detail — the actual visual signature that
makes Vault read as "a vault" rather than just "a dark room." Read
`addVaultArmor`/`addLoftArmor`/`addCaseDetails` fully before writing
anything: their position math is hardcoded to the personal Gallery
room's own fixed dimensions (e.g. `WALL_TOP = 8.9`, specific x/z rib
positions) — calling them unmodified against an arbitrary, differently-
sized real museum room would place geometry in the wrong spots or
clip through walls.

Adapt (don't literally reuse unmodified) this geometry-generation logic
so it scales to each real museum room's own actual wall lengths/height
(available from the same room data `campusRoomBuilder.ts` already uses
for wall-building) — same visual language (rib spacing/rivet placement
logic, same materials), parameterized by real room size instead of one
fixed constant. Wire the result in for Vault- and Loft-styled museum
rooms specifically (White/Arcade don't use this armor system in the
personal Gallery either — confirm this by reading
`createGalleryFinishes()`'s own `apply()`/where `addVaultArmor` gets
called there, and match that same style-conditional logic here).

## What NOT to do

Do not touch real campus geometry, doors, floor targets, navigation
targets, camera/movement/collision, `CAMPUS_ROOMS`/`CAMPUS_DOORS`, the
personal Gallery Builder's own files (read-only again this pass — no
edits to `galleryRoomFinishes.ts` should be needed this time; if one
genuinely is, it must be as narrowly additive as the last pass's single
line, and disclosed the same way), Museum Builder's Organize system, item
placement/save logic, Room/Map toggle, per-item Values, the wall/floor/
ceiling/rail material wiring already shipped in `bf92a5d` (extend it,
don't redo it).

## Verification and process

Before pushing: `npx tsc --noEmit`, targeted `eslint` on every changed
file, `npm run build` — all clean. Commit and push to `main` once
verified clean. Update `HANDOFF.md`/`CHECKLIST.md` with a dated entry.

In the final report: name exactly which materials/geometry-generation
logic was reused vs. adapted (and why adaptation was necessary — the
fixed-dimension problem above), confirm real campus geometry/doors/
navigation/movement and Gallery Builder's own files are unchanged (diff-
stat), and give tsc/eslint/build results plus the exact commit(s). Do not
claim live visual verification. The parent session will compare this
directly against the real Vault room in a live browser afterward, the
same way this gap was originally found, and will not accept it until it
visibly holds up to that comparison.
