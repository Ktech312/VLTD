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
};

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
};

// HUB keeps its existing "Grand Hall enhancement" gold — an already-
// accepted style from an earlier pass, not a new theme introduced by this
// one — but now goes through the same shared shell/trim technique as every
// other room instead of its own bespoke floor/ceiling code, so it gets a
// real ceiling and a restrained (rail-free) baseboard like everything else.
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
};

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
export function createWallMaterial(finish: RoomFinish): THREE.MeshStandardMaterial {
  const panel = createArchitecturalPanelTexture();
  return new THREE.MeshStandardMaterial({
    color: finish.wallColor, map: panel, bumpMap: panel, bumpScale: 0.05, roughness: 0.85, metalness: 0,
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

function buildCeilingAndTrim(scene: THREE.Scene, room: CampusRoom, wallHeight: number, finish: RoomFinish): void {
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
  const ceilingTexture = createCeilingBayTexture(room.w, room.d);
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: finish.ceilingColor, map: ceilingTexture, roughness: 0.92,
    emissive: finish.ceilingColor, emissiveMap: ceilingTexture, emissiveIntensity: 0.22,
  });
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
}

export function buildRoomShell(scene: THREE.Scene, module: RoomModule): RoomLightGroups {
  const { room, wallHeight, finish } = module;
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const lights = new THREE.Group();
  lights.name = `room-full:${room.id}`;
  scene.add(lights);
  const preview = new THREE.Group();
  preview.name = `room-preview:${room.id}`;
  scene.add(preview);

  // Overnight Polish pass: repeat scaled to this room's own size (was a
  // fixed 10.5x13 that only happened to fit POP_CULTURE/TCG/COLLECTION,
  // all 21x26 — "no stretched texture spanning several module bays" once
  // this floor technique is reused for rooms of other sizes below).
  const floorTexture = createStoneFloorTexture(finish.floorJointColor, room.w / 2, room.d / 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: finish.floorTintColor ?? 0xffffff, map: floorTexture, roughness: 0.62 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  buildCeilingAndTrim(scene, room, wallHeight, finish);

  for (const lz of [bounds.z0 + room.d * 0.3, bounds.z0 + room.d * 0.7]) {
    const lx = center.x;
    const fixture = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 20),
      new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: finish.lightColor, emissiveIntensity: 0.7 })
    );
    fixture.rotation.x = Math.PI / 2;
    fixture.position.set(lx, wallHeight - 0.03, lz);
    scene.add(fixture);
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

  return { full: lights, preview };
}

/** Overnight Polish pass (2026-09-09): floor, ceiling, and a wall-to-ceiling
 * trim band for a room that is NOT going through the full buildRoomShell
 * rig — every unconverted legacy room plus HUB. Deliberately does not add
 * any dynamic lights: these rooms already read fine under the scene's
 * always-on ambient/directional lighting (no full/preview activation gap to
 * fill), and "do not add a new light for every architectural detail...
 * prefer bounded room-level lighting" argues against giving all 10 of them
 * their own 8-light activation rig just to reach parity with the 3
 * converted rooms. Fixes the two structural gaps EK's review found: no
 * ceiling at all above these rooms (visible as a black void through any
 * opening into one), and a checkerboard floor where "one coherent neutral
 * floor family" was called for. `includeCeiling` defaults true; PLAZA (the
 * one intentionally open-air forecourt, `noWalls` on its true exterior
 * edge) passes false to keep its existing open-sky character instead of
 * capping it like every fully enclosed room. */
export function buildNeutralShell(
  scene: THREE.Scene, room: CampusRoom, wallHeight: number, finish: RoomFinish, includeCeiling = true
): void {
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };

  const floorTexture = createStoneFloorTexture(finish.floorJointColor, room.w / 2, room.d / 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: finish.floorTintColor ?? 0xffffff, map: floorTexture, roughness: 0.68 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  if (!includeCeiling) return;
  buildCeilingAndTrim(scene, room, wallHeight, finish);
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
export function buildDestinationSign(
  scene: THREE.Scene, x: number, y: number, z: number, rotationY: number, text: string,
  width = 2.8, height = 0.56
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

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMaterial);
  plaque.userData.kind = "museum-destination-sign-face";
  group.add(plaque);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = canvasWidth;
  labelCanvas.height = canvasHeight;
  const ctx = labelCanvas.getContext("2d");
  if (!ctx) return;

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

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
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
  group.add(labelPlane);

  scene.add(group);
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
    buildDestinationSign(scene, faceAPos.x, signY, faceAPos.z, rotationTowardA, visitorFacingRoomName(roomB.label), ORDINARY_SIGN_WIDTH, ORDINARY_SIGN_HEIGHT);
  }
  if (roomA.label) {
    const faceBPos = point(door.gapCenter, wallThickness / 2 + 0.01);
    buildDestinationSign(scene, faceBPos.x, signY, faceBPos.z, rotationTowardB, visitorFacingRoomName(roomA.label), ORDINARY_SIGN_WIDTH, ORDINARY_SIGN_HEIGHT);
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
  includeRail = true
): void {
  const baseboardMaterial = new THREE.MeshStandardMaterial({ color: finish.baseboardColor, roughness: 0.85 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: finish.railColor, roughness: 0.5, metalness: 0.35 });
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

      if (!includeRail) continue;
      const rail = new THREE.Mesh(
        isNS ? new THREE.BoxGeometry(span, railHeight, 0.04) : new THREE.BoxGeometry(0.04, railHeight, span),
        railMaterial
      );
      if (isNS) rail.position.set((piece.from + piece.to) / 2, railY, segment.fixed + (facingSign * wallThickness) / 2);
      else rail.position.set(segment.fixed + (facingSign * wallThickness) / 2, railY, (piece.from + piece.to) / 2);
      scene.add(rail);
    }
  }
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

function hangArtPreservingAspect(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  groups: RoomLightGroups,
  x: number, y: number, z: number,
  rotationY: number,
  url: string,
  maxW: number, maxH: number,
  isCancelled: () => boolean,
  withRealLight: boolean
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
  items: { url: string }[],
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
      hangArtPreservingAspect(scene, textureLoader, groups, point.x, point.y, point.z, span.rotationY, item.url, maxSlot, 2.2, isCancelled, withRealLight);
    }
  }
}
