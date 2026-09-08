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

import { buildDoorwayFrame } from "./doorwayKit";
import { DOORWAY_HEADER_HEIGHT, DOORWAY_HEADER_Y, DOORWAY_NO_DISPLAY_HALF_WIDTH } from "./museumStandard";
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
import { createGrainTexture, createStoneFloorTexture } from "../components/gallery/galleryTextures";

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

// 2026-09-08: one factory for "this room's own wall material," used both by
// its own wall faces and reused by name for continuity — no separate flat
// lookalike material anywhere a wall face needs to read as this room's wall.
export function createWallMaterial(finish: RoomFinish, room: CampusRoom, wallHeight: number): THREE.MeshStandardMaterial {
  const grain = createGrainTexture();
  grain.repeat.set(room.w / 5, wallHeight / 3);
  return new THREE.MeshStandardMaterial({
    color: finish.wallColor, map: grain, bumpMap: grain, bumpScale: 0.045, roughness: 0.88, metalness: 0,
  });
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

  const ceilingGrain = createGrainTexture();
  ceilingGrain.repeat.set(room.w / 5, room.d / 5);
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: finish.ceilingColor, map: ceilingGrain, roughness: 0.92 });
  const floorTexture = createStoneFloorTexture(finish.floorJointColor, 10.5, 13);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorTexture, roughness: 0.62 });
  const ceilingTrimMaterial = new THREE.MeshStandardMaterial({ color: finish.ceilingTrimColor, roughness: 0.7 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

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

/** A destination sign plaque — unlit (MeshBasicMaterial, so scene lighting
 * can't darken it), mounted flush at the given point/rotation, naming
 * whatever's on the far side of an opening from here. */
export function buildDestinationSign(scene: THREE.Scene, x: number, y: number, z: number, rotationY: number, text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#20242a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f2ead9";
  ctx.font = "700 50px Archivo, sans-serif";
  ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), material);
  plaque.position.set(x, y, z);
  plaque.rotation.y = rotationY;
  scene.add(plaque);
}

/** Shared-Wall Grid Plan: builds ONE physical wall for a campusLayout.ts
 * CampusWallSegment — the segment's roomA face gets `materialA`, its roomB
 * face (if any) gets `materialB`; an exterior segment (`segment.roomB ===
 * null`) uses `materialA` on both the interior and outward faces. If
 * CAMPUS_DOORS has a door on this segment, cuts the gap, then builds one
 * casing/frame (shared `frameMaterial`, passed in so every door reuses the
 * same geometry/material rather than cloning one per door), one transom
 * infill spanning header-top to ceiling (same per-face materials as the
 * rest of the wall — the fix for "the transom doesn't read as part of the
 * wall" carries over unchanged, just now sized to the wall's own thickness
 * instead of a vestibule's), one threshold contained within the wall
 * thickness, and one destination sign per face. No reveal light — ordinary
 * room lighting reaches a same-wall opening the way it does in the accepted
 * personal room. */
export function buildSharedWall(
  scene: THREE.Scene,
  segment: CampusWallSegment,
  materialA: THREE.Material,
  materialB: THREE.Material | null,
  frameMaterial: THREE.Material,
  opts: { wallHeight: number; wallThickness: number }
): void {
  const { wallHeight, wallThickness } = opts;
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
    const wall = new THREE.Mesh(geometry, materials);
    if (isNS) wall.position.set((from + to) / 2, wallHeight / 2, segment.fixed);
    else wall.position.set(segment.fixed, wallHeight / 2, (from + to) / 2);
    scene.add(wall);
  }

  const { solid, door } = splitSegmentForDoor(segment);
  for (const piece of solid) buildWallBox(piece.from, piece.to);

  if (!door || !segment.roomB) return;

  const roomA = roomById(segment.roomA);
  const roomB = roomById(segment.roomB);
  const half = (door.width ?? DOOR_WIDTH) / 2;
  const openingWidth = half * 2;

  function point(freeAxisValue: number, offsetOnFixedAxis: number) {
    return isNS
      ? { x: freeAxisValue, z: segment.fixed + offsetOnFixedAxis }
      : { x: segment.fixed + offsetOnFixedAxis, z: freeAxisValue };
  }

  const frame = buildDoorwayFrame(frameMaterial);
  frame.rotation.y = isNS ? 0 : Math.PI / 2;
  const framePos = point(door.gapCenter, 0);
  frame.position.set(framePos.x, 0, framePos.z);
  scene.add(frame);

  // Transom infill: closes the gap from the header's top to the ceiling,
  // using the SAME per-face materials as the rest of this wall — reads as
  // a continuation of the wall, not a patch.
  const transomBottom = DOORWAY_HEADER_Y + DOORWAY_HEADER_HEIGHT / 2 + 0.02;
  const transomHeight = wallHeight - transomBottom;
  if (transomHeight > 0.02) {
    const transomGeom = isNS
      ? new THREE.BoxGeometry(openingWidth, transomHeight, wallThickness)
      : new THREE.BoxGeometry(wallThickness, transomHeight, openingWidth);
    const transom = new THREE.Mesh(transomGeom, materials);
    transom.position.set(framePos.x, transomBottom + transomHeight / 2, framePos.z);
    scene.add(transom);
  }

  // Threshold — contained within the wall's own thickness, not spanning any
  // vestibule depth (there isn't one anymore).
  const thresholdMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8474, roughness: 0.78 });
  const thresholdGeom = isNS
    ? new THREE.PlaneGeometry(openingWidth, wallThickness)
    : new THREE.PlaneGeometry(wallThickness, openingWidth);
  const threshold = new THREE.Mesh(thresholdGeom, thresholdMaterial);
  threshold.rotation.x = -Math.PI / 2;
  threshold.position.set(framePos.x, 0.01, framePos.z);
  scene.add(threshold);

  // Signs: one per face, each naming the room on the OTHER side. Skipped on
  // whichever face would otherwise name an unlabeled room (PLAZA, the one
  // noWalls room that still gets a real door here — HUB's entrance) rather
  // than mount a blank plaque.
  const signY = transomBottom + 0.55;
  const rotationTowardA = isNS ? Math.PI : -Math.PI / 2;
  const rotationTowardB = isNS ? 0 : Math.PI / 2;
  if (roomB.label) {
    const faceAPos = point(door.gapCenter, -(wallThickness / 2 + 0.02));
    buildDestinationSign(scene, faceAPos.x, signY, faceAPos.z, rotationTowardA, roomB.label);
  }
  if (roomA.label) {
    const faceBPos = point(door.gapCenter, wallThickness / 2 + 0.02);
    buildDestinationSign(scene, faceBPos.x, signY, faceBPos.z, rotationTowardB, roomA.label);
  }
}

/** A room's own baseboard + picture rail along every wall segment that
 * touches it (on its own face), terminating at each door casing exactly
 * like the wall itself does — still per-room decoration, not shared
 * structure, since two adjoining rooms can carry different finishes. */
export function buildRoomTrim(
  scene: THREE.Scene,
  room: CampusRoom,
  segments: CampusWallSegment[],
  finish: RoomFinish,
  wallHeight: number,
  wallThickness: number
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
