// A reusable, data-driven builder for a "standard module" campus room —
// extracted from VltdMuseumCampus.tsx's POP_CULTURE-only block per EK's
// review of commit 5820b85: "copying it four more times will make the
// campus fragile... POP_CULTURE should call a shared room builder using
// room and door data."
//
// Shared-Wall Grid Plan (2026-09-08): walls are no longer a per-room
// concern. buildRoomShell() below now only builds a room's floor, ceiling,
// ceiling trim, and light rig — its walls come from buildSharedWall(),
// called once per campusLayout.ts CampusWallSegment (one physical wall per
// shared boundary, not one per room). This replaces the 2026-09-08
// architecture-reset's buildDoorConnection() (a per-connection enclosed
// vestibule spanning the real coordinate gap between rooms), which EK
// rejected on foreground review: rooms now share an exact boundary
// coordinate, so there's no gap left to enclose, and no vestibule to build.
import * as THREE from "three";

import { DOORWAY_CLEAR_HEIGHT, DOORWAY_NO_DISPLAY_HALF_WIDTH } from "./museumStandard";
import {
  DOOR_WIDTH,
  roomBounds,
  roomById,
  splitSegmentForDoor,
  type CampusRoom,
  type CampusRoomId,
  type CampusWallSegment,
  type WallSide,
} from "./campusLayout";
import { createStoneFloorTexture } from "../components/gallery/galleryTextures";
// Real Gallery Environments pass (2026-09-12): EK's explicit, repeated
// correction — the room editor's style choices must be the actual named
// environments she built and refined in the personal Gallery Builder
// (White/Vault/Arcade/Industrial Loft), using createGalleryFinishes()'s own
// real material/lighting code, not invented museum-only colors. This is the
// ONLY change made to galleryRoomFinishes.ts's own callers here — the
// function itself gained one additive edit (ceiling/charcoal added to its
// return statement) and is otherwise untouched, still used by
// VirtualGalleryRoom.tsx exactly as before.
import { createGalleryFinishes, type GalleryFinishStyle } from "../components/gallery/galleryRoomFinishes";
export type { GalleryFinishStyle };
// Museum Builder row-control fix (2026-09-12): SHELF_ROW_Y/shelfItemY/
// MIN_ITEM_SCALE are the personal Gallery Builder's own hand-tuned fixed
// row heights (src/lib/galleryRoomSlots.ts) — reused directly here, not
// re-derived, per the work order's explicit reuse mandate. campusLayout.ts's
// EYE_HEIGHT (MUSEUM_EYE_HEIGHT, 3.6) is the exact same value as the
// personal room's own `eyeHeight` constant, so these heights need no unit
// conversion to apply to the museum's rooms.
import { MIN_ITEM_SCALE, SHELF_ROW_Y, shelfItemY } from "./galleryRoomSlots";
// Material Quality Parity pass (2026-09-12): the exact same soft
// radial-gradient contact-shadow texture museumRoomFurniture.ts's display
// cases already use — reused here for wall-hung and shelf items too, not a
// new implementation. (museumRoomFurniture.ts imports only TYPES back from
// this file, so this is not a real runtime circular import.)
import { caseShadowTexture } from "./museumRoomFurniture";

export type RoomDoorway = {
  side: WallSide;
  gapCenter: number;
  neighborId: CampusRoomId;
  width: number;
};

// EK's review of 9d7c122: "parameterize finishes so TCG can later gain its
// own identity. Reuse the POP structure, not an identical final color
// scheme for every room."
export type RoomFinish = {
  wallColor: number;
  ceilingColor: number;
  floorJointColor: string;
  baseboardColor: number;
  ceilingTrimColor: number;
  railColor: number;
  frameColor: number;
  transomColor: number;
  lightColor: number;
  // Overnight Polish pass (2026-09-09): floor tint for the neutral shared
  // shell — lets each legacy room keep its own subtle floorColor identity
  // (CAMPUS_ROOMS' existing per-room tint) under the same stone-floor
  // technique, instead of every room reading identically blank. Optional so
  // NEUTRAL_PREVIEW_FINISH's existing rooms (which never set it) keep their
  // current plain-white-tinted floor unchanged.
  floorTintColor?: number;
  // Material Quality Parity pass (2026-09-12): per-finish wall material
  // tuning, matching the personal Gallery Builder's own FinishPalette shape
  // (galleryRoomFinishes.ts's `wallRoughness`/`wallMetalness`) instead of
  // createWallMaterial()'s previous flat 0.85/0 for every room — the same
  // real tuning that makes Gallery's White (0.94/0 matte plaster) read
  // differently from Vault (0.48/0.24 brushed steel) now applies per museum
  // RoomFinish instead of one identical wall character everywhere.
  wallRoughness: number;
  wallMetalness: number;
  // Differentiated trim/rail tuning, same FinishPalette shape
  // (`trimMetalness`/`trimRoughness`) — buildRoomTrim()'s railMaterial used
  // one flat roughness/metalness pair regardless of which RoomFinish/room
  // it was decorating.
  trimMetalness: number;
  trimRoughness: number;
};

// Material Quality Parity pass (2026-09-12): wallColor/railColor here are
// the exact same hex values as Gallery Builder's own "whitebox" palette
// (galleryRoomFinishes.ts's PALETTES.whitebox wallColor 0xe3ddd0 / trimColor
// 0xa68b53) — reusing that palette's own wallRoughness/wallMetalness
// (0.94/0, matte plaster) and trimMetalness/trimRoughness (0.72/0.43, warm
// brushed brass) directly rather than inventing new tuning for a
// same-colored finish.
export const NEUTRAL_PREVIEW_FINISH: RoomFinish = {
  wallColor: 0xe3ddd0,
  ceilingColor: 0xd6d0c1,
  floorJointColor: "#928c7d",
  baseboardColor: 0x454846,
  ceilingTrimColor: 0x3a3a38,
  railColor: 0xa68b53,
  frameColor: 0xdad4c6,
  transomColor: 0xe3ddd0,
  lightColor: 0xfff2d0,
  wallRoughness: 0.94,
  wallMetalness: 0,
  trimMetalness: 0.72,
  trimRoughness: 0.43,
};

// Overnight Polish pass (2026-09-09): "make the campus look like a
// coherent, intentionally unfinished museum shell rather than a collection
// of gray boxes... Unconverted rooms should receive only this neutral
// structural finish... Do not turn [any legacy room] into a new themed
// identity." One shared finish for every legacy room except HUB (which
// keeps its own already-accepted Grand Hall gold, set where it's built) —
// same wall-grain/ceiling/baseboard technique as the converted rooms' own
// finish, just a cooler, plainer palette so nothing reads as a new theme.
// Live-verified fix (2026-09-09): the first pass used a near-black
// ceilingColor (0x1c222c) here, which read as a solid black band through
// every legacy doorway — not a missing mesh (there's a real ceiling plane),
// but a downward-facing surface under this scene's HemisphereLight gets lit
// mostly by its dark "ground" color, not the bright "sky" one, so a dark
// base color reads as near-black. NEUTRAL_PREVIEW_FINISH's own light
// ceiling (0xd6d0c1) already accounts for this; matched here.
// Material Quality Parity pass (2026-09-12): a cooler, plainer wall than
// NEUTRAL_PREVIEW_FINISH's warm plaster — read as a slightly less finished
// architectural shell, so a touch more roughness/less sheen than Gallery's
// own whitebox plaster (0.94/0), between that and Gallery Vault's
// brushed-steel character (0.48/0.24) without going as reflective. railColor
// (0x8a8d87, cool gray) is tuned as a restrained brushed-steel rail, using
// the same trimMetalness/trimRoughness SHAPE Gallery's own palettes use, sat
// between Gallery Vault's 0.42/0.58 and NEUTRAL_PREVIEW_FINISH's
// brass-like 0.72/0.43.
export const NEUTRAL_LEGACY_FINISH: RoomFinish = {
  wallColor: 0xd7d9d6,
  ceilingColor: 0xc9cbc6,
  floorJointColor: "#7c7468",
  baseboardColor: 0x3a3c3a,
  ceilingTrimColor: 0x2c2f2c,
  railColor: 0x8a8d87,
  frameColor: 0xc7c9c4,
  transomColor: 0xd7d9d6,
  lightColor: 0xeef0f2,
  wallRoughness: 0.92,
  wallMetalness: 0.03,
  trimMetalness: 0.5,
  trimRoughness: 0.5,
};

// HUB keeps its existing "Grand Hall enhancement" gold — an already-
// accepted style from an earlier pass, not a new theme introduced by this
// one — but now goes through the same shared shell/trim technique as every
// other room instead of its own bespoke floor/ceiling code, so it gets a
// real ceiling and a restrained (rail-free) baseboard like everything else.
// Material Quality Parity pass (2026-09-12): HUB keeps its own "Grand Hall"
// identity, so its gilt plaster wall reads slightly richer/less chalky than
// the two neutral finishes above (a touch of sheen, still far from Gallery
// Vault's metal), and its rail — already a bright gold (0xc9a24a) — gets a
// genuinely polished-brass tuning (closer to Gallery Vault's own trim
// metalness/roughness ratio, but shinier to match a grand hall's gilt
// hardware rather than Vault's deliberately understated "brushed" bronze).
export const HUB_FINISH: RoomFinish = {
  wallColor: 0xe8b95e,
  ceilingColor: 0xcbb582,
  floorJointColor: "#6b5a3a",
  baseboardColor: 0x3a2f18,
  ceilingTrimColor: 0x2a2015,
  railColor: 0xc9a24a,
  frameColor: 0xdad4c6,
  transomColor: 0xe8b95e,
  lightColor: 0xfff2d0,
  wallRoughness: 0.88,
  wallMetalness: 0.05,
  trimMetalness: 0.75,
  trimRoughness: 0.35,
};

// Real Gallery Environments pass (2026-09-12): replaces the removed
// invented "Background" swatch system (ROOM_BACKGROUND_OPTIONS/
// backgroundWallColorHex/museum_room_meta.background_id — EK, verbatim:
// "These circles, I DO NOT WANT, I NEVER ASKED YOU TO MAKE THEM, REMOVE THEM
// AND GIVE ME THE ONES IN THE 3D GALLERY!!!!!"). The room editor's Style
// control now offers the personal Gallery Builder's own real, named
// environments — the exact same values/labels as VirtualGalleryRoom.tsx's
// own style `<select>` (White/Vault/Arcade/Industrial Loft) — persisted per
// room via museum_room_meta.room_style (src/lib/museumCampusConfig.ts's
// setRoomStyle/getRoomMeta). "Blue" is deliberately not offered: it has no
// createGalleryFinishes() entry (see that file's own header comment) — it's
// hand-built inline in VirtualGalleryRoom.tsx with no GLB/shared function to
// reuse, so porting it is out of scope for this pass.
export const MUSEUM_ROOM_STYLE_OPTIONS: { id: GalleryFinishStyle; label: string }[] = [
  { id: "whitebox", label: "White" },
  { id: "vault", label: "Vault" },
  { id: "arcade", label: "Arcade" },
  { id: "loft", label: "Industrial Loft" },
];

export type StyledRoomFinishes = ReturnType<typeof createGalleryFinishes>;

/** Resolves a saved `museum_room_meta.room_style` to a real
 * createGalleryFinishes() instance (the SAME wall/floor/ceiling/brass/
 * charcoal/dark materials and addLighting() rig the personal Gallery
 * Builder's own rooms use), or `null` for "no override" — an undefined,
 * null, or unrecognized style all mean the same thing: keep the room's
 * normal per-category RoomFinish, never a broken material (the same safe-
 * default rule the old background system followed). Each call builds a
 * fresh, standalone instance (real THREE.Material/Texture objects) — callers
 * own its lifetime and must call `.dispose()` on it when the room is torn
 * down or re-styled, same as VirtualGalleryRoom.tsx already does for its own
 * `galleryFinishes`. */
export function createStyledRoomFinishes(style: string | null | undefined): StyledRoomFinishes | null {
  if (style === "whitebox" || style === "vault" || style === "arcade" || style === "loft") {
    return createGalleryFinishes(style);
  }
  return null;
}

export type RoomModule = {
  room: CampusRoom;
  doorways: RoomDoorway[];
  wallHeight: number;
  wallThickness: number;
  eyeHeight: number;
  finish: RoomFinish;
};

// EK's review of 9796c72: room-level activation alone doesn't scale through
// HUB. Each room owns TWO light groups: `full` (real room lighting, only on
// while occupied) and `preview` (currently unused now that doorway reveal
// lights are gone — see the Shared-Wall Grid Plan's "remove... connection
// reveal lights made obsolete by shared walls" — kept as an empty group so
// the two-tier activation system in VltdMuseumCampus.tsx doesn't need a
// third code path for "rooms with no preview content").
export type RoomLightGroups = { full: THREE.Group; preview: THREE.Group };

export type WallSpan = { wall: WallSide; from: number; to: number; fixed: number; rotationY: number };

// Visual Overnight Pass (2026-09-10): live review found every campus wall
// reading as flat "game-gray" regardless of room — the shared grain texture
// (galleryTextures.ts, still untouched here and unaffected by this change)
// is real but low-amplitude, tuned for the Gallery's own single 21x26 room,
// and its `repeat` was being scaled by TILE COUNT (room.w / 5): the wider
// the wall, the more that already-subtle noise gets stretched per tile,
// until it's imperceptible on HUB's 63-unit span. A zoomed screenshot of a
// bare HUB/AUTOMOTIVE wall showed literally zero visible variation.
// Campus-only (this file, not galleryTextures.ts, so the accepted personal
// Gallery/prototype rooms are byte-for-byte unaffected) architectural panel
// texture below: one vertical reveal per PANEL_WIDTH of REAL WORLD UNITS,
// not per fixed tile count — a panel reads at the same physical scale on a
// 21-unit room and a 63-unit one, so "enlarge the spacing and rhythm of
// architectural details" for large rooms falls out for free rather than
// needing a second large-room code path.
const PANEL_WIDTH = 4.2; // world units per panel bay

function createArchitecturalPanelTexture(): THREE.CanvasTexture {
  const width = 256;
  const height = 560;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Same fine multiplicative grain formula as the shared texture generator
  // (kept inline rather than imported, so this stays one self-contained
  // campus-only texture) — subtle paint/plaster variation underneath the
  // panel reveal, not the main read on its own.
  let seed = 47;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pixels = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const grain = Math.sin(x * 0.85 + y * 0.31) * 1.1 + Math.sin(x * 0.22 - y * 0.57) * 0.9;
      const tone = 217 + grain + (random() - 0.5) * 8;
      pixels.data.set([tone, tone - 3, tone - 8, 255], i);
    }
  }
  ctx.putImageData(pixels, 0, 0);

  // One vertical reveal, centered in the tile — a soft shadow/highlight
  // pair reading as a shallow architectural panel seam (not a hard line),
  // restrained enough to avoid "busy repeated lines."
  const cx = width / 2;
  const reveal = ctx.createLinearGradient(cx - 11, 0, cx + 11, 0);
  reveal.addColorStop(0, "rgba(0,0,0,0)");
  reveal.addColorStop(0.4, "rgba(18,14,9,0.18)");
  reveal.addColorStop(0.52, "rgba(255,250,240,0.12)");
  reveal.addColorStop(0.64, "rgba(18,14,9,0.12)");
  reveal.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = reveal;
  ctx.fillRect(cx - 11, 0, 22, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// EK's review (2026-09-10): repeat was being scaled by ROOM WIDTH
// (room.w / PANEL_WIDTH) and that ONE material then reused, unchanged, on
// every wall face touching this room — north/south walls really do span
// room.w, but east/west walls span room.d, and any wall split around a
// doorway is shorter than either. On a rectangular room (MISC 21x52,
// AUTOMOTIVE 42x52) or a short doorway-adjacent segment, the panel rhythm
// stretched or compressed away from its real PANEL_WIDTH. The material
// itself no longer sets any repeat at all (stays 1x1) — buildSharedWall()'s
// buildWallBox() below scales the GEOMETRY's own UVs per box, using that
// box's real world-space span, so the same shared material/texture reads
// at the correct physical scale on every wall segment simultaneously,
// regardless of that segment's own length or the room's shape.
// Material Quality Parity pass (2026-09-12): roughness/metalness now read
// from the active RoomFinish (see its wallRoughness/wallMetalness fields)
// instead of a flat 0.85/0 applied to every room regardless of finish — the
// same per-style tuning approach Gallery Builder's own FinishPalette uses.
export function createWallMaterial(finish: RoomFinish): THREE.MeshStandardMaterial {
  const panel = createArchitecturalPanelTexture();
  return new THREE.MeshStandardMaterial({
    color: finish.wallColor, map: panel, bumpMap: panel, bumpScale: 0.05,
    roughness: finish.wallRoughness, metalness: finish.wallMetalness,
  });
}

// BoxGeometry's default UV already runs 0..1 across the face's own U axis
// regardless of that box's actual size — verified directly against
// three/src/geometries/BoxGeometry.js's buildPlane() calls: for a
// BoxGeometry(width, height, depth), the +z/-z faces (index 4/5) map U to
// `width` and the +x/-x faces (index 0/1) map U to `depth`. buildWallBox()
// below always puts the wall's real-world SPAN in exactly that parameter
// (`width` for an NS wall, `depth` for an EW wall) — so face 4/5 (NS) or
// face 0/1 (EW) already have U proportional to the span; multiplying just
// those faces' U by `span / PANEL_WIDTH` converts "0..1 across this one
// box" into "world-space panel-widths across this one box," which is
// exactly what a fixed 1x1 texture.repeat needs to read at a consistent
// physical scale from one box to the next.
function scaleWallPanelU(geometry: THREE.BoxGeometry, isNS: boolean, span: number) {
  const uv = geometry.attributes.uv;
  const uScale = span / PANEL_WIDTH;
  const faces = isNS ? [4, 5] : [0, 1];
  for (const face of faces) {
    for (let i = 0; i < 4; i += 1) {
      const idx = face * 4 + i;
      uv.setX(idx, uv.getX(idx) * uScale);
    }
  }
  uv.needsUpdate = true;
}

function wallRotationY(side: WallSide): number {
  switch (side) {
    case "north": return 0;
    case "south": return Math.PI;
    case "west": return Math.PI / 2;
    case "east": return -Math.PI / 2;
  }
}

/** Room floor, ceiling (with a perimeter trim band), and a directional
 * light rig: 2 downward ceiling fixtures plus one wall-wash spotlight per
 * wall (4 total). Walls, baseboards, and rails are NOT built here anymore —
 * see buildSharedWall() and buildRoomTrim() below, both driven by
 * campusLayout.ts's computeCampusWallSegments() instead of a per-room
 * accounting. */
// Visual Overnight Pass (2026-09-10): ceilings previously read as one flat,
// undecorated plane — no rhythm at any room size, most noticeable in HUB and
// the other large legacy rooms where a single unbroken 63x78 plane has
// nothing to suggest real architecture. `createCeilingBayTexture()` draws
// one restrained seam per bay tile, repeat scaled to THIS room's own span
// (world units, same approach as the wall panel texture above) so a small
// room gets a tight bay rhythm and a large one gets a proportionally wider
// one — "enlarge the spacing and rhythm of architectural details" for large
// rooms, without a separate large-room code path.
//
// buildRoomShell() and buildNeutralShell() previously duplicated this exact
// ceiling+trim block verbatim (drifting only in the removed light-fixture
// code around them) — extracted into one shared function both now call, so
// the ceiling technique can't drift between "converted" and "legacy" rooms
// again, and there's one texture generator to tune instead of two.
const CEILING_BAY_SIZE = 7.8; // world units per ceiling bay

function createCeilingBayTexture(roomWidth: number, roomDepth: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  let seed = 211;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pixels = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const grain = Math.sin(x * 0.6 + y * 0.4) * 1.0 + Math.sin(x * 0.18 - y * 0.5) * 0.8;
      const tone = 222 + grain + (random() - 0.5) * 6;
      pixels.data.set([tone, tone - 2, tone - 6, 255], i);
    }
  }
  ctx.putImageData(pixels, 0, 0);

  // One restrained seam per bay edge — a thin, soft line forming a grid once
  // tiled, not a bold coffer pattern.
  ctx.strokeStyle = "rgba(20,16,10,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 510, 510);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.max(1, Math.round(roomWidth / CEILING_BAY_SIZE)),
    Math.max(1, Math.round(roomDepth / CEILING_BAY_SIZE))
  );
  texture.anisotropy = 4;
  return texture;
}

function buildCeilingAndTrim(
  scene: THREE.Scene, room: CampusRoom, wallHeight: number, finish: RoomFinish, styled?: StyledRoomFinishes | null
): THREE.MeshStandardMaterial {
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };

  // Live-verified fix (2026-09-09): a downward-facing ceiling plane gets
  // almost no incident light in this scene — the "sun" DirectionalLight
  // shines down onto upward faces only (a downward normal can't receive a
  // downward light), and the HemisphereLight's dim "ground" color is the
  // only ambient contribution — so even a light base color rendered as a
  // solid black band across HUB's ceiling once it (correctly) got a real
  // mesh. A small self-illumination (not a new Light object — no new
  // entries in getSceneStats' light count) keeps every ceiling visibly lit
  // regardless of viewing angle or room size, without adding fixtures.
  // Visual Overnight Pass (2026-09-10), live-verified: the bay texture's
  // lines were invisible in production — `map` only modulates the LIT
  // contribution, which is nearly zero on a downward face for the exact
  // reason above, so the flat, unmodulated `emissive` fill was the only
  // thing actually visible, washing the pattern out completely. Setting
  // `emissiveMap` to the same texture (same technique already used for
  // legacy-room artwork elsewhere in this pass) puts the bay lines into the
  // self-illumination itself, so they're visible regardless of how little
  // real light the ceiling receives.
  let ceilingMaterial: THREE.MeshStandardMaterial;
  if (styled) {
    // Real Gallery Environments pass: the styled ceiling material is the
    // SAME object createGalleryFinishes() built (real color/roughness/map
    // for this style) — reused directly, not recreated. It has no emissive
    // set (the personal Gallery's own scene doesn't need one), so without
    // adding one here it would suffer the exact same "near-black downward
    // face" problem this comment already fixed for every other room's
    // ceiling above, since the campus's own light rig is different from the
    // personal Gallery's. Setting emissive from its own color/texture is
    // the same self-illumination technique, applied to this one extra
    // material instance — not a new invention.
    ceilingMaterial = styled.ceiling;
    ceilingMaterial.emissive = new THREE.Color(ceilingMaterial.color);
    if (ceilingMaterial.map) ceilingMaterial.emissiveMap = ceilingMaterial.map;
    ceilingMaterial.emissiveIntensity = 0.22;
    ceilingMaterial.needsUpdate = true;
  } else {
    const ceilingTexture = createCeilingBayTexture(room.w, room.d);
    ceilingMaterial = new THREE.MeshStandardMaterial({
      color: finish.ceilingColor, map: ceilingTexture, roughness: 0.92,
      emissive: finish.ceilingColor, emissiveMap: ceilingTexture, emissiveIntensity: 0.22,
    });
  }
  const ceilingTrimMaterial = new THREE.MeshStandardMaterial({ color: finish.ceilingTrimColor, roughness: 0.7 });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(center.x, wallHeight, center.z);
  scene.add(ceiling);

  const trimHeight = 0.12;
  const trimNS = new THREE.BoxGeometry(room.w, trimHeight, 0.1);
  const trimEW = new THREE.BoxGeometry(0.1, trimHeight, room.d);
  const trimNorth = new THREE.Mesh(trimNS, ceilingTrimMaterial);
  trimNorth.position.set(center.x, wallHeight - trimHeight / 2, bounds.z0);
  scene.add(trimNorth);
  const trimSouth = new THREE.Mesh(trimNS.clone(), ceilingTrimMaterial);
  trimSouth.position.set(center.x, wallHeight - trimHeight / 2, bounds.z1);
  scene.add(trimSouth);
  const trimWest = new THREE.Mesh(trimEW, ceilingTrimMaterial);
  trimWest.position.set(bounds.x0, wallHeight - trimHeight / 2, center.z);
  scene.add(trimWest);
  const trimEast = new THREE.Mesh(trimEW.clone(), ceilingTrimMaterial);
  trimEast.position.set(bounds.x1, wallHeight - trimHeight / 2, center.z);
  scene.add(trimEast);

  return ceilingMaterial;
}

export function buildRoomShell(
  scene: THREE.Scene, module: RoomModule, styled?: StyledRoomFinishes | null
): RoomLightGroups & { shellFixtures: THREE.Group; floorMaterial: THREE.MeshStandardMaterial; ceilingMaterial: THREE.MeshStandardMaterial } {
  const { room, wallHeight, finish } = module;
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const lights = new THREE.Group();
  lights.name = `room-full:${room.id}`;
  scene.add(lights);
  const preview = new THREE.Group();
  preview.name = `room-preview:${room.id}`;
  scene.add(preview);
  // Real Gallery Environments pass (2026-09-12): every ceiling-fixture mesh
  // this shell builds (below, and in buildLegacyRoomLightRig) now lands in
  // its own per-room group instead of directly on `scene` — same always-
  // visible result (this group is never itself toggled), just a handle a
  // later style change can clear/dispose when swapping in
  // createGalleryFinishes(style)'s own real light rig instead.
  const shellFixtures = new THREE.Group();
  shellFixtures.name = `room-fixtures:${room.id}`;
  scene.add(shellFixtures);

  // Overnight Polish pass: repeat scaled to this room's own size (was a
  // fixed 10.5x13 that only happened to fit POP_CULTURE/TCG/COLLECTION,
  // all 21x26 — "no stretched texture spanning several module bays" once
  // this floor technique is reused for rooms of other sizes below).
  let floorMaterial: THREE.MeshStandardMaterial;
  if (styled) {
    // Real Gallery Environments pass: the room's own real floor material
    // (stone/wood/concrete per style, tuned by createGalleryFinishes),
    // reused directly instead of this file's generic stone-floor recipe.
    floorMaterial = styled.floor;
  } else {
    const floorTexture = createStoneFloorTexture(finish.floorJointColor, room.w / 2, room.d / 2);
    floorMaterial = new THREE.MeshStandardMaterial({ color: finish.floorTintColor ?? 0xffffff, map: floorTexture, roughness: 0.62 });
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  const ceilingMaterial = buildCeilingAndTrim(scene, room, wallHeight, finish, styled);

  if (styled) {
    // Real Gallery Environments pass: this room's own real light rig
    // (createGalleryFinishes(style).addLighting()) instead of the generic
    // ceiling-fixture + wall-wash rig below. `anchor` re-bases addLighting's
    // own local-space light targets (authored around the personal Gallery
    // Builder's own similarly-sized 21x26 room, centered on its own origin)
    // onto this room's real world-space center — the room's own real
    // shape/wall lengths/door positions are untouched, only the lighting
    // (and materials) come from the chosen style, per the work order.
    const anchor = new THREE.Group();
    anchor.position.set(center.x, 0, center.z);
    lights.add(anchor);
    styled.addLighting(anchor);
  } else {
    for (const lz of [bounds.z0 + room.d * 0.3, bounds.z0 + room.d * 0.7]) {
      const lx = center.x;
      const fixture = new THREE.Mesh(
        new THREE.CircleGeometry(0.34, 20),
        new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: finish.lightColor, emissiveIntensity: 0.7 })
      );
      fixture.rotation.x = Math.PI / 2;
      fixture.position.set(lx, wallHeight - 0.03, lz);
      shellFixtures.add(fixture);
      const down = new THREE.SpotLight(finish.lightColor, 1.1, 14, Math.PI / 4, 0.55, 1.3);
      down.position.set(lx, wallHeight - 0.4, lz);
      down.target.position.set(lx, 0, lz);
      lights.add(down);
      lights.add(down.target);

      const upglow = new THREE.PointLight(finish.lightColor, 0.5, 9, 2);
      upglow.position.set(lx, wallHeight - 0.15, lz);
      lights.add(upglow);
    }

    const washSpecs: { pos: [number, number, number]; target: [number, number, number] }[] = [
      { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.85], target: [center.x, wallHeight * 0.35, bounds.z0] },
      { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.15], target: [center.x, wallHeight * 0.35, bounds.z1] },
      { pos: [bounds.x0 + room.w * 0.85, wallHeight - 1.1, center.z], target: [bounds.x0, wallHeight * 0.35, center.z] },
      { pos: [bounds.x0 + room.w * 0.15, wallHeight - 1.1, center.z], target: [bounds.x1, wallHeight * 0.35, center.z] },
    ];
    for (const wash of washSpecs) {
      const light = new THREE.SpotLight(finish.lightColor, 1.3, 20, Math.PI / 3.5, 0.65, 1.4);
      light.position.set(...wash.pos);
      light.target.position.set(...wash.target);
      lights.add(light);
      lights.add(light.target);
    }
  }

  return { full: lights, preview, shellFixtures, floorMaterial, ceilingMaterial };
}

/** Material Quality Parity pass (2026-09-12): the exact same ceiling-fixture
 * + wall-wash SpotLight/PointLight recipe buildRoomShell() above already
 * builds for POP_CULTURE/TCG/COLLECTION (same colors, intensities, cone
 * angles, decay) — buildRoomShell() itself is untouched, its own fixture
 * count/positions stay exactly as EK already approved them. This is a
 * SEPARATE function, used only by buildNeutralShell() below, because the
 * placement needs to adapt to a legacy room's own (often much larger or
 * differently-proportioned) footprint instead of assuming a 21x26 room:
 * the downlight row count scales with room depth (the same CEILING_BAY_SIZE
 * rhythm the ceiling-bay texture already tiles at, capped so even HUB's
 * large hall gets a bounded number of fixtures), while the 4 wall-wash
 * spotlights stay one-per-wall exactly like buildRoomShell's own, their
 * positions already proportional to room.w/room.d so they scale to any
 * room size for free. Lights are added to `lightsTarget` (a per-room group
 * when the caller wants the SAME two-tier occupancy activation every
 * converted room already uses, or the scene itself for a single-room
 * preview with no activation system) — never left permanently-on across the
 * whole campus regardless of where the visitor is standing. */
function buildLegacyRoomLightRig(
  room: CampusRoom, wallHeight: number, finish: RoomFinish, lightsTarget: THREE.Object3D, fixturesTarget: THREE.Object3D
): void {
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: finish.lightColor, emissiveIntensity: 0.7 });

  const rows = Math.max(2, Math.min(6, Math.round(room.d / CEILING_BAY_SIZE) + 1));
  for (let i = 0; i < rows; i += 1) {
    const t = (i + 0.5) / rows;
    const lx = center.x;
    const lz = bounds.z0 + room.d * t;
    const fixture = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), fixtureMaterial);
    fixture.rotation.x = Math.PI / 2;
    fixture.position.set(lx, wallHeight - 0.03, lz);
    fixturesTarget.add(fixture);

    const down = new THREE.SpotLight(finish.lightColor, 1.1, 14, Math.PI / 4, 0.55, 1.3);
    down.position.set(lx, wallHeight - 0.4, lz);
    down.target.position.set(lx, 0, lz);
    lightsTarget.add(down);
    lightsTarget.add(down.target);

    const upglow = new THREE.PointLight(finish.lightColor, 0.5, 9, 2);
    upglow.position.set(lx, wallHeight - 0.15, lz);
    lightsTarget.add(upglow);
  }

  const washSpecs: { pos: [number, number, number]; target: [number, number, number] }[] = [
    { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.85], target: [center.x, wallHeight * 0.35, bounds.z0] },
    { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.15], target: [center.x, wallHeight * 0.35, bounds.z1] },
    { pos: [bounds.x0 + room.w * 0.85, wallHeight - 1.1, center.z], target: [bounds.x0, wallHeight * 0.35, center.z] },
    { pos: [bounds.x0 + room.w * 0.15, wallHeight - 1.1, center.z], target: [bounds.x1, wallHeight * 0.35, center.z] },
  ];
  for (const wash of washSpecs) {
    // Distance scales with the room's own longest dimension (floored at
    // buildRoomShell's own fixed 20) so a wide legacy hall's wash still
    // reaches its target wall instead of falling short at the same fixed
    // range tuned for a 21x26 converted room.
    const distance = Math.max(20, Math.max(room.w, room.d) * 0.4);
    const light = new THREE.SpotLight(finish.lightColor, 1.3, distance, Math.PI / 3.5, 0.65, 1.4);
    light.position.set(...wash.pos);
    light.target.position.set(...wash.target);
    lightsTarget.add(light);
    lightsTarget.add(light.target);
  }
}

/** Overnight Polish pass (2026-09-09): floor, ceiling, and a wall-to-ceiling
 * trim band for a room that is NOT going through the full buildRoomShell
 * rig — every unconverted legacy room plus HUB. `includeCeiling` defaults
 * true; PLAZA (the one intentionally open-air forecourt, `noWalls` on its
 * true exterior edge) passes false to keep its existing open-sky character
 * instead of capping it like every fully enclosed room. Fixes the two
 * structural gaps EK's review found: no ceiling at all above these rooms
 * (visible as a black void through any opening into one), and a
 * checkerboard floor where "one coherent neutral floor family" was called
 * for.
 *
 * Material Quality Parity pass (2026-09-12): the 2026-09-09 decision above
 * deliberately withheld any dynamic light rig from these rooms ("do not add
 * a new light for every architectural detail... prefer bounded room-level
 * lighting", to avoid giving all 10 of them their own 8-light activation rig
 * just to reach parity with the 3 converted rooms). EK's current ask
 * explicitly supersedes that for LIGHTING QUALITY (not theme): every legacy
 * room now gets buildLegacyRoomLightRig()'s real fixture/spotlight rig too,
 * same recipe buildRoomShell()'s converted rooms already use. `lights`
 * is optional — when the caller supplies its own per-room group (wired into
 * the same occupancy on/off system every converted room already uses, see
 * VltdMuseumCampus.tsx), the rig only lights up while that room is actually
 * occupied; when omitted (a single-room preview scene with no occupancy
 * system, e.g. MuseumBuilder.tsx/MuseumRoomPopup.tsx), it goes straight onto
 * the scene, always on, since that scene only ever shows the one room. */
export function buildNeutralShell(
  scene: THREE.Scene, room: CampusRoom, wallHeight: number, finish: RoomFinish, includeCeiling = true, lights?: THREE.Object3D,
  styled?: StyledRoomFinishes | null
): { shellFixtures: THREE.Group; floorMaterial: THREE.MeshStandardMaterial; ceilingMaterial?: THREE.MeshStandardMaterial } {
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };

  let floorMaterial: THREE.MeshStandardMaterial;
  if (styled) {
    // Real Gallery Environments pass: reuse the style's own real floor
    // material directly, same as buildRoomShell() above.
    floorMaterial = styled.floor;
  } else {
    const floorTexture = createStoneFloorTexture(finish.floorJointColor, room.w / 2, room.d / 2);
    floorMaterial = new THREE.MeshStandardMaterial({ color: finish.floorTintColor ?? 0xffffff, map: floorTexture, roughness: 0.68 });
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  // Real Gallery Environments pass: same per-room fixture-mesh group as
  // buildRoomShell() above, so a later style change can clear/dispose this
  // room's generic ceiling-fixture meshes when swapping in
  // createGalleryFinishes(style)'s own real light rig.
  const shellFixtures = new THREE.Group();
  shellFixtures.name = `room-fixtures:${room.id}`;
  scene.add(shellFixtures);

  if (!includeCeiling) return { shellFixtures, floorMaterial };
  const ceilingMaterial = buildCeilingAndTrim(scene, room, wallHeight, finish, styled);
  if (styled) {
    const anchor = new THREE.Group();
    anchor.position.set(center.x, 0, center.z);
    (lights ?? scene).add(anchor);
    styled.addLighting(anchor);
  } else {
    buildLegacyRoomLightRig(room, wallHeight, finish, lights ?? scene, shellFixtures);
  }
  return { shellFixtures, floorMaterial, ceilingMaterial };
}

const destinationSignFaceTextures = new WeakMap<THREE.Scene, THREE.Texture>();

function destinationSignFaceTexture(scene: THREE.Scene): THREE.Texture {
  const cached = destinationSignFaceTextures.get(scene);
  if (cached) return cached;

  const texture = new THREE.TextureLoader().load("/brand/vltd-museum-door-sign-face-v1.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Image generation returned the exact 5:1 plaque centered inside a taller
  // transparent canvas. Sample only that authored plaque area so the brass
  // circles and borders keep their intended proportions on the 5:1 mesh.
  texture.repeat.set(1, 0.604);
  texture.offset.set(0, 0.178);
  destinationSignFaceTextures.set(scene, texture);
  return texture;
}

/**
 * Build one medallion-inspired doorway sign from two independent layers:
 *
 * 1. a static charcoal/brass architectural face, shared visually by every
 *    doorway; and
 * 2. a transparent label texture generated from the current room data.
 *
 * Keeping the label off the decorative face is intentional. Room names can
 * change later without redesigning or replacing the sign itself. Both layers
 * use unlit materials so the lettering remains readable in rooms whose light
 * groups are currently in preview mode.
 */
// Extracted from buildDestinationSign() (2026-09-12, Shared Museum Room
// Editor pass) so a sign's label can be regenerated later — from
// retitleDestinationSign() below — with the exact same rendering the sign
// was built with, once an admin's museum_room_meta title override loads in
// (asynchronously, after every sign has already been built synchronously
// during the scene's initial construction).
function renderDestinationSignLabelTexture(text: string, canvasWidth: number, canvasHeight: number): THREE.CanvasTexture {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = canvasWidth;
  labelCanvas.height = canvasHeight;
  const ctx = labelCanvas.getContext("2d")!;

  const label = text.toUpperCase();
  const paddingX = canvasWidth * 0.16;
  const paddingY = canvasHeight * 0.25;
  const maxTextWidth = canvasWidth - paddingX * 2;
  const maxTextHeight = canvasHeight - paddingY * 2;
  let fontSize = maxTextHeight;
  ctx.font = `700 ${fontSize}px Archivo, sans-serif`;
  while (fontSize > 8 && ctx.measureText(label).width > maxTextWidth) {
    fontSize -= 2;
    ctx.font = `700 ${fontSize}px Archivo, sans-serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = Math.max(2, canvasHeight * 0.025);
  ctx.shadowOffsetY = Math.max(1, canvasHeight * 0.01);
  ctx.fillStyle = "#f3d78e";
  ctx.fillText(label, canvasWidth / 2, canvasHeight / 2);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildDestinationSign(
  scene: THREE.Scene, x: number, y: number, z: number, rotationY: number, text: string,
  width = 2.8, height = 0.56,
  // Shared Museum Room Editor pass (2026-09-12): the STABLE room id this
  // sign names (the room on the far side of the doorway) — undefined for
  // the one entrance sign, which never gets an admin-renamed title. Tagged
  // on the group's userData so retitleDestinationSign() can find every
  // sign naming a given room later, without re-deriving it from the
  // (possibly already-renamed) label text.
  roomId?: string
) {
  const canvasHeight = 256;
  const canvasWidth = Math.max(64, Math.round(canvasHeight * (width / height)));
  const faceMaterial = new THREE.MeshBasicMaterial({
    map: destinationSignFaceTexture(scene),
    transparent: true,
    alphaTest: 0.02,
  });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  group.userData.kind = "museum-destination-sign";
  group.userData.label = text;
  group.userData.roomId = roomId;

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMaterial);
  plaque.userData.kind = "museum-destination-sign-face";
  group.add(plaque);

  const labelTexture = renderDestinationSignLabelTexture(text, canvasWidth, canvasHeight);
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    depthWrite: false,
  });
  const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), labelMaterial);
  labelPlane.position.z = 0.006;
  labelPlane.renderOrder = 2;
  labelPlane.userData.kind = "museum-destination-sign-label";
  labelPlane.userData.label = text;
  labelPlane.userData.canvasWidth = canvasWidth;
  labelPlane.userData.canvasHeight = canvasHeight;
  group.add(labelPlane);

  scene.add(group);
}

/** Shared Museum Room Editor pass (2026-09-12): regenerates one destination
 * sign's label texture in place — used once an admin's museum_room_meta
 * title override loads in, after every sign has already been built
 * synchronously. Disposes the old CanvasTexture (same cleanup discipline
 * the rest of this file already follows for generated textures) before
 * swapping in the new one. No-op if the group doesn't carry the expected
 * label child (defensive — should never happen for a real sign group). */
export function retitleDestinationSign(signGroup: THREE.Object3D, newText: string): void {
  const labelMesh = signGroup.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.userData.kind === "museum-destination-sign-label"
  );
  if (!labelMesh) return;
  const material = labelMesh.material as THREE.MeshBasicMaterial;
  const oldTexture = material.map;
  const canvasWidth = (labelMesh.userData.canvasWidth as number) ?? 256;
  const canvasHeight = (labelMesh.userData.canvasHeight as number) ?? 256;
  material.map = renderDestinationSignLabelTexture(newText, canvasWidth, canvasHeight);
  material.needsUpdate = true;
  oldTexture?.dispose();
  labelMesh.userData.label = newText;
  signGroup.userData.label = newText;
}

// Doorway casing (2026-09-08 redesign): EK's foreground review of the first
// shared-wall rollout rejected the reused doorwayKit.ts frame for ordinary
// campus openings — "raised plinth/step layers," a "large projecting
// tower-like transom block," and posts/header reading as "columns." These
// constants define a campus-only thin casing instead: a jamb+head trim that
// hugs the opening (covering the wall/opening seam rather than standing off
// from it), a short transom band using the wall's own materials so it reads
// as the wall continuing rather than a block, and no separate threshold —
// the two rooms' floor planes already meet flush at the shared coordinate.
// doorwayKit.ts itself is untouched; it still serves the protected personal
// room/prototype unchanged.
const CASING_TRIM_WIDTH = 0.1;
const CASING_TRIM_DEPTH = 0.04; // projection past each wall face — subtle trim, not a post depth
const CASING_HEAD_HEIGHT = 0.12;
// Overnight Polish pass (2026-09-09): EK's foreground review of the first
// shared-wall doorway rollout: "The current shared openings are
// approximately 8.21 units high in a 9.15-unit room. In production they
// read as tall, narrow elevator shafts... Restore the accepted personal
// Gallery clear-opening proportion: approximately 4.83 units high. Use the
// exact shared constant." DOORWAY_CLEAR_HEIGHT (museumStandard.ts) IS that
// constant — the same 4.83 the accepted personal room and prototype room
// both build to. Using it directly here (instead of a headroom-from-
// ceiling offset) means the opening's actual height matches the accepted
// room regardless of wallHeight, and the transom above it grows to fill
// whatever's left up to the ceiling — still built by the same wall system
// (the `materials` array, not a separate patch), just taller now.

// PLAZA<->HUB entrance (2026-09-09 doorway-refinement pass): EK split
// doorways into two kinds — every ordinary connection keeps the thin kit
// above unchanged, but the one campus entrance gets its own restrained
// treatment: "a slightly wider, more substantial casing and integrated
// header," "VLTD MUSEUM" as the entrance identity built into that header,
// no freestanding columns/pediment ("build the entrance from the shared
// opening itself"). Still the same jamb+head+transom shape as the ordinary
// kit below, just larger and carrying one identity sign instead of the
// usual per-room destination plaques — "restrained... the final Main Hall
// theme has not been designed yet."
const ENTRANCE_CASING_TRIM_WIDTH = 0.22;
const ENTRANCE_CASING_TRIM_DEPTH = 0.07;
const ENTRANCE_CASING_HEAD_HEIGHT = 0.34;
const ENTRANCE_LABEL = "VLTD MUSEUM";

export type DoorwayStyle = "ordinary" | "entrance";

/** Shared-Wall Grid Plan: builds ONE physical wall for a campusLayout.ts
 * CampusWallSegment — the segment's roomA face gets `materialA`, its roomB
 * face (if any) gets `materialB`; an exterior segment (`segment.roomB ===
 * null`) uses `materialA` on both the interior and outward faces. If
 * CAMPUS_DOORS has a door on this segment, cuts the gap, then builds a thin
 * jamb+head casing (shared `frameMaterial`, passed in so every door reuses
 * the same material rather than cloning one per door), a short transom
 * infill above the casing using the SAME per-face materials as the rest of
 * the wall (reads as a continuation of the wall, not a patch), and one
 * destination sign per face mounted into the transom band. No threshold
 * mesh and no reveal light — the floors already meet flush, and ordinary
 * room lighting reaches a same-wall opening the way it does in the accepted
 * personal room. */
export function buildSharedWall(
  scene: THREE.Scene,
  segment: CampusWallSegment,
  materialA: THREE.Material,
  materialB: THREE.Material | null,
  frameMaterial: THREE.Material,
  opts: { wallHeight: number; wallThickness: number; style?: DoorwayStyle }
): void {
  const { wallHeight, wallThickness } = opts;
  const isEntrance = opts.style === "entrance";
  const trimWidth = isEntrance ? ENTRANCE_CASING_TRIM_WIDTH : CASING_TRIM_WIDTH;
  const trimDepth = isEntrance ? ENTRANCE_CASING_TRIM_DEPTH : CASING_TRIM_DEPTH;
  const headHeight = isEntrance ? ENTRANCE_CASING_HEAD_HEIGHT : CASING_HEAD_HEIGHT;
  const isNS = segment.wall === "x";
  const faceB = materialB ?? materialA;
  // BoxGeometry face order: [+x,-x,+y,-y,+z,-z]. For an 'x' wall (fixed Z),
  // the two large faces are +z/-z; roomA's interior is toward -Z, roomB's
  // toward +Z. For a 'z' wall (fixed X), the large faces are +x/-x; roomA's
  // interior is toward -X, roomB's toward +X.
  const materials = isNS
    ? [materialA, materialA, materialA, materialA, faceB, materialA]
    : [faceB, materialA, materialA, materialA, materialA, materialA];

  function buildWallBox(from: number, to: number) {
    const span = to - from;
    if (span <= 0.02) return;
    const geometry = isNS
      ? new THREE.BoxGeometry(span, wallHeight, wallThickness)
      : new THREE.BoxGeometry(wallThickness, wallHeight, span);
    scaleWallPanelU(geometry, isNS, span);
    const wall = new THREE.Mesh(geometry, materials);
    if (isNS) wall.position.set((from + to) / 2, wallHeight / 2, segment.fixed);
    else wall.position.set(segment.fixed, wallHeight / 2, (from + to) / 2);
    scene.add(wall);
  }

  const { solid, door } = splitSegmentForDoor(segment);
  // EK's live report (2026-09-10, screenshots with the flicker marked in
  // blue at door jambs, plus a wavy wall-trim line near a head): the jamb
  // and head casing boxes below are deliberately centered ON the seam
  // between the solid wall and the cut opening, so each one's FOOTPRINT
  // (trimWidth wide, running the casing's own casingDepth — wider than the
  // wall's own wallThickness) sat entirely inside the adjacent solid wall
  // piece's own volume, which still extended the full width right up to the
  // door gap. Two opaque boxes occupying the exact same space, one only
  // ~0.04-0.07 units proud of the other's face (trimDepth), is textbook
  // z-fighting — visible as flicker/shimmer at both jambs and at the head,
  // worse at oblique angles (i.e., from most real standing positions, not
  // straight-on) and easy to miss in a single static screenshot. Fix: trim
  // the solid piece back by trimWidth wherever its own edge sits exactly on
  // the door gap, so the casing's footprint is carved OUT of the wall
  // rather than layered on top of it — the two now meet edge-to-edge with
  // zero overlapping volume.
  const doorHalfWidth = door ? (door.width ?? DOOR_WIDTH) / 2 : 0;
  const gapFrom = door ? door.gapCenter - doorHalfWidth : 0;
  const gapTo = door ? door.gapCenter + doorHalfWidth : 0;
  for (const piece of solid) {
    let { from, to } = piece;
    if (door) {
      if (Math.abs(to - gapFrom) < 1e-6) to -= trimWidth;
      if (Math.abs(from - gapTo) < 1e-6) from += trimWidth;
    }
    buildWallBox(from, to);
  }

  if (!door || !segment.roomB) return;

  const roomA = roomById(segment.roomA);
  const roomB = roomById(segment.roomB);
  const half = doorHalfWidth;
  const openingWidth = half * 2;

  function point(freeAxisValue: number, offsetOnFixedAxis: number) {
    return isNS
      ? { x: freeAxisValue, z: segment.fixed + offsetOnFixedAxis }
      : { x: segment.fixed + offsetOnFixedAxis, z: freeAxisValue };
  }

  // Thin jamb+head casing, centered on the seam between the solid wall and
  // the cut opening so it covers that seam instead of standing off from it —
  // "fitted architectural casing," not the old thick freestanding posts.
  // The one entrance door uses larger trimWidth/trimDepth/headHeight
  // (resolved above) but the exact same construction — "build the entrance
  // from the shared opening itself," not a separate structure.
  const framePos = point(door.gapCenter, 0);
  const openingClearHeight = DOORWAY_CLEAR_HEIGHT;
  // End the jambs exactly at the header. The earlier extra half-header of
  // height made the jamb and head occupy the same front/back surface at
  // both upper corners, which could shimmer as the camera moved.
  const jambHeight = openingClearHeight;
  const casingDepth = wallThickness + trimDepth * 2;
  const jambGeom = isNS
    ? new THREE.BoxGeometry(trimWidth, jambHeight, casingDepth)
    : new THREE.BoxGeometry(casingDepth, jambHeight, trimWidth);
  for (const side of [-1, 1]) {
    const jamb = new THREE.Mesh(jambGeom.clone(), frameMaterial);
    const jambPos = point(door.gapCenter + side * (half + trimWidth / 2), 0);
    jamb.position.set(jambPos.x, jambHeight / 2, jambPos.z);
    scene.add(jamb);
  }
  const headWidth = openingWidth + trimWidth * 2;
  const headGeom = isNS
    ? new THREE.BoxGeometry(headWidth, headHeight, casingDepth)
    : new THREE.BoxGeometry(casingDepth, headHeight, headWidth);
  const head = new THREE.Mesh(headGeom, frameMaterial);
  head.position.set(framePos.x, openingClearHeight + headHeight / 2, framePos.z);
  scene.add(head);

  // Transom: closes the gap from the casing head to the ceiling using the
  // SAME per-face materials as the rest of this wall — a short band that
  // reads as the wall continuing over the door, not a separate block.
  // Width must match headWidth (openingWidth + trimWidth*2), not the bare
  // opening width: the solid wall pieces above are trimmed back by
  // trimWidth on each side for their full height (the 4a0cb01 anti-flicker
  // fix), so a transom only as wide as the opening itself left a
  // trimWidth-wide vertical strip open on each side, above the head casing,
  // all the way to the ceiling. The head casing already used the correct
  // (wider) span; the transom just hadn't matched it.
  const transomBottom = openingClearHeight + headHeight;
  const transomHeight = wallHeight - transomBottom;
  if (transomHeight > 0.02) {
    const transomGeom = isNS
      ? new THREE.BoxGeometry(headWidth, transomHeight, wallThickness)
      : new THREE.BoxGeometry(wallThickness, transomHeight, headWidth);
    const transom = new THREE.Mesh(transomGeom, materials);
    transom.position.set(framePos.x, transomBottom + transomHeight / 2, framePos.z);
    scene.add(transom);
  }

  // No threshold mesh — the two rooms' own floor planes already meet flush
  // at this exact shared-wall coordinate, so there's nothing to insert.

  const rotationTowardA = isNS ? Math.PI : -Math.PI / 2;
  const rotationTowardB = isNS ? 0 : Math.PI / 2;

  if (isEntrance) {
    // One identity sign per face, mounted on the transom directly above the
    // fitted header. Both the approach from PLAZA and the view back from HUB
    // carry the same "VLTD MUSEUM" identity.
    const signWidth = Math.min(headWidth * 0.72, 3.4);
    const signHeight = signWidth / 5;
    const entranceSignY = transomBottom + signHeight / 2 + 0.12;
    const faceAPos = point(door.gapCenter, -(casingDepth / 2 + 0.02));
    buildDestinationSign(scene, faceAPos.x, entranceSignY, faceAPos.z, rotationTowardA, ENTRANCE_LABEL, signWidth, signHeight);
    const faceBPos = point(door.gapCenter, casingDepth / 2 + 0.02);
    buildDestinationSign(scene, faceBPos.x, entranceSignY, faceBPos.z, rotationTowardB, ENTRANCE_LABEL, signWidth, signHeight);
    return;
  }

  // Signs: one per face, integrated into the transom band, each naming the
  // room on the OTHER side. Skipped on whichever face would otherwise name
  // an unlabeled room (PLAZA, the one noWalls room that still gets a real
  // door here — HUB's entrance) rather than mount a blank plaque.
  //
  // Overnight Polish pass, wayfinding addition (2026-09-09): "enlarge
  // ordinary destination signs so they can be read from across HUB and
  // from normal room-center distance... roughly 1.6-1.8x... smaller than
  // the main VLTD MUSEUM entrance sign." The 2.8-wide ordinary sign stays
  // smaller than the entrance sign (up to 3.4 wide). The 5:1 plaque keeps
  // the medallion-derived border and bosses in their authored proportions,
  // and its bottom clears the casing head.
  const ORDINARY_SIGN_WIDTH = 2.8;
  const ORDINARY_SIGN_HEIGHT = ORDINARY_SIGN_WIDTH / 5;
  const signY = transomBottom + ORDINARY_SIGN_HEIGHT / 2 + 0.12;
  if (roomB.label) {
    const faceAPos = point(door.gapCenter, -(wallThickness / 2 + 0.01));
    buildDestinationSign(scene, faceAPos.x, signY, faceAPos.z, rotationTowardA, visitorFacingRoomName(roomB.label), ORDINARY_SIGN_WIDTH, ORDINARY_SIGN_HEIGHT, roomB.id);
  }
  if (roomA.label) {
    const faceBPos = point(door.gapCenter, wallThickness / 2 + 0.01);
    buildDestinationSign(scene, faceBPos.x, signY, faceBPos.z, rotationTowardB, visitorFacingRoomName(roomA.label), ORDINARY_SIGN_WIDTH, ORDINARY_SIGN_HEIGHT, roomA.id);
  }
}

// EK: "Display visitor-facing names: replace underscores with spaces and
// show BUILT_BOTANY as BOTANY; do not expose internal identifiers." Applies
// only to destination-sign TEXT — room.label itself (used for the top-of-
// screen overlay, adjacency lookups, etc.) is untouched.
export function visitorFacingRoomName(label: string): string {
  if (label === "BUILT_BOTANY") return "BOTANY";
  return label.replace(/_/g, " ");
}

/** A room's own baseboard + (optionally) picture rail along every wall
 * segment that touches it (on its own face), terminating at each door
 * casing exactly like the wall itself does — still per-room decoration,
 * not shared structure, since two adjoining rooms can carry different
 * finishes. `includeRail` defaults true for the converted rooms' own call
 * sites (unchanged); Overnight Polish pass (2026-09-09) calls this with
 * `false` for every legacy room and HUB — "restrained baseboards" without
 * a rail line, replacing their old two-height gold rail-lattice loop
 * ("no broad gold stripes or repeated decorative wall lines"). */
export function buildRoomTrim(
  scene: THREE.Scene,
  room: CampusRoom,
  segments: CampusWallSegment[],
  finish: RoomFinish,
  wallHeight: number,
  wallThickness: number,
  includeRail = true,
  styled?: StyledRoomFinishes | null
): { baseboardMaterial: THREE.MeshStandardMaterial; railMaterial: THREE.MeshStandardMaterial | null } {
  // Real Gallery Environments pass: this room's own real trim materials
  // (createGalleryFinishes' charcoal/brass) reused directly for baseboard/
  // rail instead of this file's generic flat-color trim, when a style is
  // saved for this room.
  const baseboardMaterial = styled ? styled.charcoal : new THREE.MeshStandardMaterial({ color: finish.baseboardColor, roughness: 0.85 });
  // Material Quality Parity pass (2026-09-12): per-finish trim tuning
  // (finish.trimMetalness/trimRoughness) instead of one flat 0.5/0.35 rail
  // material reused for every RoomFinish — the same trimMetalness/
  // trimRoughness approach Gallery Builder's own FinishPalette uses.
  const railMaterial = includeRail
    ? (styled ? styled.brass : new THREE.MeshStandardMaterial({ color: finish.railColor, roughness: finish.trimRoughness, metalness: finish.trimMetalness }))
    : null;
  const baseboardHeight = 0.22;
  const railHeight = 0.06;
  const railY = wallHeight - 2.2;

  for (const segment of segments) {
    if (segment.roomA !== room.id && segment.roomB !== room.id) continue;
    const isNS = segment.wall === "x";
    const facingSign = segment.roomA === room.id ? -1 : 1;
    const { solid } = splitSegmentForDoor(segment);
    for (const piece of solid) {
      const span = piece.to - piece.from;
      if (span <= 0.05) continue;

      const baseboard = new THREE.Mesh(
        isNS ? new THREE.BoxGeometry(span, baseboardHeight, 0.05) : new THREE.BoxGeometry(0.05, baseboardHeight, span),
        baseboardMaterial
      );
      if (isNS) baseboard.position.set((piece.from + piece.to) / 2, baseboardHeight / 2, segment.fixed + (facingSign * wallThickness) / 2);
      else baseboard.position.set(segment.fixed + (facingSign * wallThickness) / 2, baseboardHeight / 2, (piece.from + piece.to) / 2);
      scene.add(baseboard);

      if (!includeRail || !railMaterial) continue;
      const rail = new THREE.Mesh(
        isNS ? new THREE.BoxGeometry(span, railHeight, 0.04) : new THREE.BoxGeometry(0.04, railHeight, span),
        railMaterial
      );
      if (isNS) rail.position.set((piece.from + piece.to) / 2, railY, segment.fixed + (facingSign * wallThickness) / 2);
      else rail.position.set(segment.fixed + (facingSign * wallThickness) / 2, railY, (piece.from + piece.to) / 2);
      scene.add(rail);
    }
  }

  return { baseboardMaterial, railMaterial };
}

/** Usable wall spans for item placement — full length on doorless walls,
 * split around each doorway's DOORWAY_NO_DISPLAY_HALF_WIDTH exclusion zone
 * on the others, so no item/rail/panel can cross an opening. */
export function computeUsableWallSpans(module: RoomModule): WallSpan[] {
  const bounds = roomBounds(module.room);
  const sides: { side: WallSide; from: number; to: number; fixed: number }[] = [
    { side: "north", from: bounds.x0, to: bounds.x1, fixed: bounds.z0 },
    { side: "south", from: bounds.x0, to: bounds.x1, fixed: bounds.z1 },
    { side: "west", from: bounds.z0, to: bounds.z1, fixed: bounds.x0 },
    { side: "east", from: bounds.z0, to: bounds.z1, fixed: bounds.x1 },
  ];

  const spans: WallSpan[] = [];
  for (const s of sides) {
    const gaps = module.doorways
      .filter((d) => d.side === s.side)
      .map((d) => ({ from: d.gapCenter - DOORWAY_NO_DISPLAY_HALF_WIDTH, to: d.gapCenter + DOORWAY_NO_DISPLAY_HALF_WIDTH }))
      .sort((a, b) => a.from - b.from);

    let cursor = s.from;
    for (const g of gaps) {
      if (g.from > cursor) spans.push({ wall: s.side, from: cursor, to: g.from, fixed: s.fixed, rotationY: wallRotationY(s.side) });
      cursor = Math.max(cursor, g.to);
    }
    if (cursor < s.to) spans.push({ wall: s.side, from: cursor, to: s.to, fixed: s.fixed, rotationY: wallRotationY(s.side) });
  }
  return spans.filter((s) => s.to - s.from > 1);
}

// Shared Museum Room Editor pass (2026-09-12): a STABLE, numbered set of
// placement positions generated from a room's real geometry — the exact
// same usable-wall-span walk placeArtwork() itself uses (so a doorway,
// its casing, and every other exclusion computeUsableWallSpans() already
// respects are respected here too), just distributed as a FIXED layout
// sized to `capacity` instead of to however many items currently exist.
// This is the one function both the new in-3D room editor (numbered +/-
// overlay) and the museum's own display consult, so the two can never
// disagree about where "position #4 on SPORTS's south wall" physically is.
// Slot ids are stable — `{roomId}#{wall}#{index}` — as long as `capacity`
// and the room's own doors/dimensions don't change.
export type PlacementSlot = {
  id: string;
  wall: WallSide;
  index: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  maxWidth: number;
  maxHeight: number;
  // Museum Builder pass (2026-09-12): which furniture kind this slot sits
  // on. Undefined/omitted always means "wall" — every slot
  // computeRoomPlacementSlots() has ever produced, and everything
  // placeItemsAtSlots()/the live museum display already consume, is
  // completely unchanged by adding this optional field. "shelf"/"case" are
  // new, additive kinds produced by computeRoomShelfSlots()/
  // computeRoomCaseSlots() below, for Museum Builder's own furniture-aware
  // placement — placeItemsAtSlots() itself is untouched and is never called
  // with a "case" slot (see museumRoomFurniture.ts's own placeItemsInCases).
  kind?: "wall" | "shelf" | "case";
};

// Same proportional-by-span-length distribution placeArtwork() itself uses
// (a floor of 1 slot per span so no usable span goes completely unused),
// just returning per-span COUNTS instead of hanging anything. Exported
// (2026-09-12, Museum Builder pass) so computeRoomShelfSlots() below can
// reuse the exact same distribution math instead of a second copy.
export function distributeAcrossSpans(spans: WallSpan[], count: number): number[] {
  const totalLength = spans.reduce((sum, s) => sum + (s.to - s.from), 0);
  const counts: number[] = [];
  let used = 0;
  if (totalLength <= 0) return spans.map(() => 0);
  for (const span of spans) {
    const share = Math.max(1, Math.round(((span.to - span.from) / totalLength) * count));
    const c = Math.max(0, Math.min(share, count - used));
    counts.push(c);
    used += c;
  }
  return counts;
}

// Museum Builder row-control fix (2026-09-12): EK's Single/Dual/Three-row
// ask. Row HEIGHTS themselves are never re-derived — every one of these maps
// straight onto SHELF_ROW_Y's 3 hand-tuned entries ([4.72, 3.22, 1.72] —
// read that file's own comments for why those specific numbers), so a room
// built at "Three row" looks pixel-for-pixel like the personal Gallery's own
// current 3-row wall. "Single" reuses the MIDDLE height alone (the same
// height the personal Gallery's own spotlight/Hero layout already treats as
// its one centered feature row — see galleryRoomSlots.ts's `HERO_Y =
// shelfItemY(1, ...)`); "Dual" reuses the top+bottom of that same table.
export type RoomRowCount = 1 | 2 | 3;

const WALL_ROW_INDEX_SETS: Record<RoomRowCount, number[]> = {
  1: [1],
  2: [0, 2],
  3: [0, 1, 2],
};

// Every wall item's vertical position, regardless of whether the new
// Shelves checkbox is drawing a board underneath it — a representative
// MIN_ITEM_SCALE (the personal Gallery's own floor scale for ordinary wall
// items) stands in for shelfItemY()'s per-item `scale` argument, since a
// museum wall item's real render scale comes from its own image's aspect
// ratio (hangArtPreservingAspect below), not one fixed number the way the
// personal room's own grid items use. This only affects the row BAND every
// item in that row shares, not that item's own final on-screen size.
function wallRowItemHeights(rowCount: RoomRowCount): number[] {
  return WALL_ROW_INDEX_SETS[rowCount].map((row) => shelfItemY(row, MIN_ITEM_SCALE));
}

/** The same rows' RAW shelf-board heights — SHELF_ROW_Y itself, before
 * shelfItemY()'s "item resting on top of the board" offset — for
 * MuseumBuilder.tsx's new Shelves checkbox, which draws one physical board
 * (museumRoomFurniture.ts's buildShelfBoard, unchanged) directly under each
 * row of wall items currently in use. */
export function wallRowBoardHeights(rowCount: RoomRowCount): number[] {
  return WALL_ROW_INDEX_SETS[rowCount].map((row) => SHELF_ROW_Y[row] ?? SHELF_ROW_Y[SHELF_ROW_Y.length - 1]);
}

// A tighter maxHeight the more rows are stacked into the same wall span, so
// neighboring rows can never visually overlap — Three-row's own bands sit
// only 1.5 units apart (SHELF_ROW_Y's own spacing), so an item is capped
// well under that; Dual's bands are twice as far apart (3.0), and Single has
// no neighboring row to clash with at all.
const WALL_ROW_MAX_HEIGHT: Record<RoomRowCount, number> = { 1: 2.2, 2: 1.9, 3: 1.3 };

export function computeRoomPlacementSlots(
  roomId: CampusRoomId,
  doorways: RoomDoorway[],
  wallThickness: number,
  eyeHeight: number,
  capacity: number,
  // Optional dedicated "main" wall (SPORTS's south wall today: the one side
  // with no doorway) that should get the bulk of the room's capacity rather
  // than an even proportional split. Ported from SPORTS's own hand-tuned
  // fix (2026-09-11): a flat per-span proportional split, floored to a
  // minimum of 1 slot per span, lets several short door-flanking spans
  // collectively outweigh one long, doorless focal wall. Mirrors SPORTS's
  // exact existing rule (a supporting slot per flanking span only once
  // there's enough capacity to spare one) so this generalizes SPORTS's
  // proof-room layout into the shared engine instead of discarding it.
  focalWall?: WallSide,
  // Museum Builder row-control fix (2026-09-12): Single/Dual/Three-row
  // control, MuseumBuilder.tsx ONLY. Deliberately left undefined (not
  // defaulted to 3) so every OTHER existing caller — VltdMuseumCampus.tsx's
  // real live museum display and MuseumRoomPopup.tsx, neither of which this
  // work order allows touching — keeps this function's exact original
  // single-height-per-wall output, byte for byte, since neither passes this
  // new argument. Only when a caller actually supplies a row count does the
  // row-grid math below activate at all.
  rowCount?: RoomRowCount
): PlacementSlot[] {
  if (capacity <= 0) return [];
  const roomModule: RoomModule = {
    room: roomById(roomId),
    doorways,
    wallHeight: 0, // unused by computeUsableWallSpans — only room+doorways matter here
    wallThickness,
    eyeHeight,
    finish: NEUTRAL_LEGACY_FINISH,
  };
  const spans = computeUsableWallSpans(roomModule);
  if (spans.length === 0) return [];

  const focal = focalWall ? spans.filter((s) => s.wall === focalWall) : [];
  const supporting = focalWall ? spans.filter((s) => s.wall !== focalWall) : [];
  const useFocalSplit = focalWall !== undefined && focal.length > 0 && supporting.length > 0;

  const groups: { spans: WallSpan[]; capacity: number }[] = useFocalSplit
    ? (() => {
        const perSupporting = capacity >= 5 ? 1 : 0;
        const supportingCapacity = Math.min(perSupporting * supporting.length, Math.max(0, capacity - 1));
        return [
          { spans: focal, capacity: capacity - supportingCapacity },
          { spans: supporting, capacity: supportingCapacity },
        ];
      })()
    : [{ spans, capacity }];

  // Legacy no-row-argument path reproduces the original behavior exactly:
  // one row at the caller's own `eyeHeight`, `maxHeight` 2.2 — untouched for
  // VltdMuseumCampus.tsx/MuseumRoomPopup.tsx.
  const rowYs = rowCount ? wallRowItemHeights(rowCount) : [eyeHeight];
  const rowMaxHeight = rowCount ? WALL_ROW_MAX_HEIGHT[rowCount] : 2.2;
  const margin = 0.9;
  const slots: PlacementSlot[] = [];
  // Continuous per-WALL-SIDE counter for stable ids — a wall side can carry
  // MULTIPLE spans (e.g. "north" split into two shorter pieces flanking a
  // doorway); indexing must run across all of that side's spans, not reset
  // per span, or two different spans on the same side would both mint id
  // `#north#0`.
  const sideCounters = new Map<WallSide, number>();

  for (const group of groups) {
    const counts = distributeAcrossSpans(group.spans, group.capacity);
    group.spans.forEach((span, spanIdx) => {
      const count = counts[spanIdx];
      if (count <= 0) return;
      const spanLength = span.to - span.from;
      const usable = spanLength - margin * 2;
      // Row-aligned grid fix (2026-09-12): items used to be laid out in one
      // continuous horizontal run at a single fixed height (`eyeHeight`) —
      // the existing per-wall distribution (`count` per span, computed
      // above) is correct and untouched, but with no real vertical row
      // system it was the ONLY axis, so a room with more items than fit
      // comfortably in one row just crowded them sideways instead of
      // wrapping into a second/third row the way the personal Gallery's own
      // wallGridPosition (col = slot % columns, row = floor(slot / columns))
      // already does. Same row-major fill here: `columns` narrows to
      // however many COLUMNS this span's own `count` needs across
      // `rowYs.length` rows, and the horizontal step is now sized off that
      // column count, not the raw item count — so items sharing a column
      // stack at the exact same shared row heights (`rowYs`) instead of one
      // long single-height run.
      const columns = Math.max(1, Math.ceil(count / rowYs.length));
      const step = usable / columns;
      const maxSlot = Math.min(2.6, step * 0.8);
      for (let i = 0; i < count; i += 1) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const t = span.from + margin + step * (col + 0.5);
        const wallInset = wallThickness / 2 + 0.04;
        const point = span.wall === "north" || span.wall === "south"
          ? { x: t, z: span.fixed + (span.wall === "north" ? 1 : -1) * wallInset }
          : { x: span.fixed + (span.wall === "west" ? 1 : -1) * wallInset, z: t };
        const sideIndex = sideCounters.get(span.wall) ?? 0;
        sideCounters.set(span.wall, sideIndex + 1);
        slots.push({
          id: `${roomId}#${span.wall}#${sideIndex}`,
          wall: span.wall,
          index: sideIndex,
          x: point.x,
          y: rowYs[row] ?? rowYs[rowYs.length - 1],
          z: point.z,
          rotationY: span.rotationY,
          maxWidth: maxSlot,
          maxHeight: rowMaxHeight,
        });
      }
    });
  }
  return slots;
}

// Museum Builder pass (2026-09-12): shelf-slot generator — EK's feature-
// parity ask ("shelves... a slider... evenly distributed") ported from
// VirtualGalleryRoom.tsx's own shelf system (physical boards resting items
// at a lower height than eye-level wall art), generalized to any real
// campus room's own usable wall spans instead of the personal room's fixed
// -12/±10.5 coordinates. Reuses the exact same computeUsableWallSpans() +
// distributeAcrossSpans() the wall-slot generator above uses — same
// proportional-by-span-length distribution, just at shelf height instead of
// eye height — and returns its own `kind: "shelf"` slots so a caller can
// draw shelf-board furniture under them (museumRoomFurniture.ts) without
// touching computeRoomPlacementSlots/placeItemsAtSlots at all.
const SHELF_HEIGHT_FRACTION = 0.42; // fraction of eyeHeight — a low resting shelf, not another picture rail
export const SHELF_ITEM_MAX = 1.6;
const SHELF_WALL_OUTSET = 0.46; // wall-face-to-board-center distance — matches museumRoomFurniture.ts's own board depth/2

export function computeRoomShelfSlots(
  roomId: CampusRoomId,
  doorways: RoomDoorway[],
  wallThickness: number,
  eyeHeight: number,
  capacity: number
): PlacementSlot[] {
  if (capacity <= 0) return [];
  const roomModule: RoomModule = {
    room: roomById(roomId), doorways, wallHeight: 0, wallThickness, eyeHeight, finish: NEUTRAL_LEGACY_FINISH,
  };
  const spans = computeUsableWallSpans(roomModule);
  if (spans.length === 0) return [];

  const counts = distributeAcrossSpans(spans, capacity);
  const margin = 0.9;
  const shelfY = eyeHeight * SHELF_HEIGHT_FRACTION;
  const slots: PlacementSlot[] = [];
  const sideCounters = new Map<WallSide, number>();

  spans.forEach((span, spanIdx) => {
    const count = counts[spanIdx];
    if (count <= 0) return;
    const spanLength = span.to - span.from;
    const usable = spanLength - margin * 2;
    const step = usable / count;
    const maxSlot = Math.min(SHELF_ITEM_MAX, step * 0.8);
    for (let i = 0; i < count; i += 1) {
      const t = span.from + margin + step * (i + 0.5);
      const wallInset = wallThickness / 2 + SHELF_WALL_OUTSET;
      const point = span.wall === "north" || span.wall === "south"
        ? { x: t, z: span.fixed + (span.wall === "north" ? 1 : -1) * wallInset }
        : { x: span.fixed + (span.wall === "west" ? 1 : -1) * wallInset, z: t };
      const sideIndex = sideCounters.get(span.wall) ?? 0;
      sideCounters.set(span.wall, sideIndex + 1);
      slots.push({
        id: `${roomId}#shelf-${span.wall}#${sideIndex}`,
        wall: span.wall,
        index: sideIndex,
        x: point.x,
        y: shelfY,
        z: point.z,
        rotationY: span.rotationY,
        maxWidth: maxSlot,
        maxHeight: 1.3,
        kind: "shelf",
      });
    }
  });
  return slots;
}

/** The same usable wall spans computeRoomShelfSlots() places items along,
 * exposed separately so a caller can draw exactly one shelf board per
 * contributing span (museumRoomFurniture.ts's buildShelfBoard) without
 * re-deriving the wall-span walk itself. */
export function computeRoomShelfSpans(
  roomId: CampusRoomId, doorways: RoomDoorway[], wallThickness: number, eyeHeight: number
): WallSpan[] {
  const roomModule: RoomModule = { room: roomById(roomId), doorways, wallHeight: 0, wallThickness, eyeHeight, finish: NEUTRAL_LEGACY_FINISH };
  return computeUsableWallSpans(roomModule);
}

// Museum Builder pass (2026-09-12): floor display-case slots — EK's other
// feature-parity ask. Ported from VirtualGalleryRoom.tsx's own CABINET_SPOTS/
// glass-case furniture (cabinet base + glass box + a soft contact-shadow
// plane — see museumRoomFurniture.ts's buildDisplayCase, the literal port of
// that mesh recipe), but a real campus room's floor plan varies per room
// (doorways, floor targets/logo) where the personal room's 4 fixed spots
// never had to account for any of that — so placement here is a
// conservative, geometry-driven eligibility check rather than a fixed spot
// table: a room only gets cases at all if it has at least one FULLY SOLID
// wall (no doorway anywhere along it — a doorless wall produces exactly one
// usable span equal to the room's own full width/depth) large enough
// (`CASE_MIN_ROOM_SPAN`) for a case row centered in front of that wall to
// clear real walking/doorway space on the other walls. Rooms that don't
// clear this bar simply get no case slots — "skip it there rather than
// force it in," per the work order — instead of guessing a placement that
// might collide with a real doorway or floor target.
const CASE_MIN_ROOM_SPAN = 20; // world units — below this, there's no safe walking clearance for a freestanding case run
const CASE_ROW_OFFSET = 3.2; // distance the case row sits out from its solid back wall
export const CASE_ITEM_MAX = 1.1;

export function computeRoomCaseSlots(
  roomId: CampusRoomId,
  doorways: RoomDoorway[],
  wallThickness: number,
  capacity: number
): PlacementSlot[] {
  if (capacity <= 0) return [];
  const room = roomById(roomId);
  if (room.w < CASE_MIN_ROOM_SPAN || room.d < CASE_MIN_ROOM_SPAN) return [];
  const roomModule: RoomModule = { room, doorways, wallHeight: 0, wallThickness, eyeHeight: 0, finish: NEUTRAL_LEGACY_FINISH };
  const spans = computeUsableWallSpans(roomModule);
  const bounds = roomBounds(room);

  const spansBySide = new Map<WallSide, WallSpan[]>();
  for (const span of spans) spansBySide.set(span.wall, [...(spansBySide.get(span.wall) ?? []), span]);
  const solidWall = (["north", "south", "east", "west"] as WallSide[]).find(
    (side) => (spansBySide.get(side)?.length ?? 0) === 1
  );
  if (!solidWall) return [];

  const margin = 2.2;
  const runLength = solidWall === "north" || solidWall === "south" ? room.w : room.d;
  const usable = runLength - margin * 2;
  if (usable <= 0) return [];
  const step = usable / capacity;
  const slots: PlacementSlot[] = [];
  for (let i = 0; i < capacity; i += 1) {
    const t = (solidWall === "north" || solidWall === "south" ? bounds.x0 : bounds.z0) + margin + step * (i + 0.5);
    const point =
      solidWall === "north" ? { x: t, z: bounds.z0 + CASE_ROW_OFFSET }
      : solidWall === "south" ? { x: t, z: bounds.z1 - CASE_ROW_OFFSET }
      : solidWall === "west" ? { x: bounds.x0 + CASE_ROW_OFFSET, z: t }
      : { x: bounds.x1 - CASE_ROW_OFFSET, z: t };
    slots.push({
      id: `${roomId}#case#${i}`,
      wall: solidWall,
      index: i,
      x: point.x,
      y: 1.25,
      z: point.z,
      rotationY: 0,
      maxWidth: CASE_ITEM_MAX,
      maxHeight: CASE_ITEM_MAX,
      kind: "case",
    });
  }
  return slots;
}

/** Places a room's curated items at their explicitly assigned slots (from
 * computeRoomPlacementSlots), instead of placeArtwork()'s proportional
 * auto-fill — used once an admin has assigned at least one slot via the new
 * room editor. Any slot with no assigned item is simply left empty (the
 * editor is what shows an empty slot's numbered "+" — the live museum
 * display just doesn't render anything there). */
export function placeItemsAtSlots(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  groups: RoomLightGroups,
  slots: PlacementSlot[],
  itemsBySlot: Map<string, { url: string; label?: string }>,
  isCancelled: () => boolean
): void {
  let lit = 0;
  for (const slot of slots) {
    const item = itemsBySlot.get(slot.id);
    if (!item) continue;
    const withRealLight = lit < MAX_PICTURE_LIGHTS_PER_ROOM;
    lit += 1;
    hangArtPreservingAspect(
      scene, textureLoader, groups,
      slot.x, slot.y, slot.z, slot.rotationY,
      item.url, slot.maxWidth, slot.maxHeight,
      isCancelled, withRealLight, item.label,
      slot.kind === "shelf" ? "shelf" : "wall"
    );
  }
}

// Compact museum-placard label under a piece of artwork — deliberately its
// own small, neutral (cream/charcoal) plaque rather than reusing
// VltdMuseumCampus.tsx's blue Spotlight/Store hangPlaque(), which is styled
// for that room pair, not for sitting under real framed art in a neutral
// room. Kept tiny (one line, truncated) — "compact labels," not a second
// plaque.
function hangCompactLabel(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  rotationY: number,
  title: string,
  maxWidth: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2a2a28";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 40px Archivo, sans-serif";
  const truncated = title.length > 28 ? `${title.slice(0, 27)}…` : title;
  ctx.fillText(truncated, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const width = Math.min(maxWidth, 1.7);
  const height = width * (canvas.height / canvas.width);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 })
  );
  const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, rotationY, 0));
  plaque.position.set(x + normal.x * 0.021, y, z + normal.z * 0.021);
  plaque.rotation.y = rotationY;
  scene.add(plaque);
}

function hangArtPreservingAspect(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  groups: RoomLightGroups,
  x: number, y: number, z: number,
  rotationY: number,
  url: string,
  maxW: number, maxH: number,
  isCancelled: () => boolean,
  withRealLight: boolean,
  label?: string,
  // Material Quality Parity pass (2026-09-12): "wall" (default, every
  // existing caller's behavior unchanged) vs "shelf" — which surface this
  // item is actually grounded against, so the contact shadow below reads
  // correctly either way.
  slotKind: "wall" | "shelf" = "wall"
) {
  textureLoader.load(url, (texture) => {
    if (isCancelled()) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    const naturalW = texture.image?.width || 1;
    const naturalH = texture.image?.height || 1;
    const scale = Math.min(maxW / naturalW, maxH / naturalH);
    const artW = naturalW * scale;
    const artH = naturalH * scale;

    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(artW + 0.12, artH + 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    mat.position.set(x, y, z);
    mat.rotation.y = rotationY;
    scene.add(mat);

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, rotationY, 0));

    // Contact shadow (Material Quality Parity pass, 2026-09-12): the exact
    // same soft radial-gradient shadow technique museumRoomFurniture.ts's
    // display cases already use (caseShadowTexture), reused here rather than
    // a new implementation — grounds each frame/shelf item against the
    // surface it actually hangs or rests on, instead of it reading as
    // floating flat in front of/on top of that surface.
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: caseShadowTexture(), transparent: true, depthWrite: false, toneMapped: false,
    });
    if (slotKind === "shelf") {
      // Shelf items rest ON a physical board (museumRoomFurniture.ts's
      // buildShelfBoard) at this same y — a horizontal grounding shadow
      // directly beneath the item's own footprint, same orientation/
      // technique as a display case's floor shadow, sized to this item
      // instead of the case's fixed size.
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(artW * 1.3, 0.9), Math.max(artH * 0.9, 0.7)),
        shadowMaterial
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, y - 0.05, z);
      scene.add(shadow);
    } else {
      // Wall-hung frames: a soft shadow behind and slightly below the frame,
      // parallel to the wall — positioned just BEHIND the opaque mat plane
      // (a hair closer to the real wall surface) so it only shows in the
      // ring beyond the mat's own silhouette, reading as the frame casting a
      // soft shadow onto the wall around it, instead of floating in front
      // of a bare wall.
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(artW + 0.5, artH + 0.35), shadowMaterial);
      shadow.position.set(x - normal.x * 0.005, y - artH * 0.08, z - normal.z * 0.005);
      shadow.rotation.y = rotationY;
      scene.add(shadow);
    }

    const artMaterial = withRealLight
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.22 });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), artMaterial);
    art.position.set(x + normal.x * 0.02, y, z + normal.z * 0.02);
    art.rotation.y = rotationY;
    scene.add(art);

    if (withRealLight) {
      const pictureLight = new THREE.SpotLight(0xfff4e2, 0.7, 6, Math.PI / 6, 0.5, 1.2);
      pictureLight.position.set(x + normal.x * 1.1, y + artH / 2 + 0.3, z + normal.z * 1.1);
      pictureLight.target.position.set(x, y, z);
      groups.full.add(pictureLight);
      groups.full.add(pictureLight.target);
    }

    if (label) {
      hangCompactLabel(scene, x, y - artH / 2 - 0.26, z, rotationY, label, Math.max(artW, 1.2));
    }
  });
}

const MAX_PICTURE_LIGHTS_PER_ROOM = 6;

/** Places items across the given usable wall spans, proportionally by span
 * length, evenly spaced within each span, sizing each to its natural
 * aspect ratio within a bounded box instead of forcing every image square. */
export function placeArtwork(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  groups: RoomLightGroups,
  spans: WallSpan[],
  items: { url: string; label?: string }[],
  wallThickness: number,
  eyeHeight: number,
  isCancelled: () => boolean
) {
  const totalLength = spans.reduce((sum, s) => sum + (s.to - s.from), 0);
  if (totalLength <= 0 || items.length === 0) return;
  const margin = 0.9;
  let itemIndex = 0;
  for (const span of spans) {
    const spanLength = span.to - span.from;
    const share = Math.max(1, Math.round((spanLength / totalLength) * items.length));
    const count = Math.min(share, items.length - itemIndex);
    if (count <= 0) continue;
    const usable = spanLength - margin * 2;
    const step = usable / count;
    for (let i = 0; i < count && itemIndex < items.length; i += 1, itemIndex += 1) {
      const item = items[itemIndex];
      const t = span.from + margin + step * (i + 0.5);
      const wallInset = wallThickness / 2 + 0.04;
      const point = span.wall === "north" || span.wall === "south"
        ? { x: t, y: eyeHeight, z: span.fixed + (span.wall === "north" ? 1 : -1) * wallInset }
        : { x: span.fixed + (span.wall === "west" ? 1 : -1) * wallInset, y: eyeHeight, z: t };
      const maxSlot = Math.min(2.6, step * 0.8);
      const withRealLight = itemIndex < MAX_PICTURE_LIGHTS_PER_ROOM;
      hangArtPreservingAspect(scene, textureLoader, groups, point.x, point.y, point.z, span.rotationY, item.url, maxSlot, 2.2, isCancelled, withRealLight, item.label);
    }
  }
}
