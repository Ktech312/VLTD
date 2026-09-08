// A reusable, data-driven builder for a "standard module" campus room —
// extracted from VltdMuseumCampus.tsx's POP_CULTURE-only block per EK's
// review of commit 5820b85: "copying it four more times will make the
// campus fragile... POP_CULTURE should call a shared room builder using
// room and door data. The next room should be a second data entry, not
// another large `if` block." Every visual piece POP_CULTURE proved out
// (real ceiling, doorwayKit.ts frames, two-sided destination headers, a
// neutral finish, and aspect-ratio-preserving item slots) lives here now,
// parameterized by room + door data instead of hardcoded to one room id.
import * as THREE from "three";

import { buildDoorwayFrame } from "./doorwayKit";
import { DOORWAY_HEADER_HEIGHT, DOORWAY_HEADER_Y, DOORWAY_NO_DISPLAY_HALF_WIDTH } from "./museumStandard";
import {
  computeWallSegments,
  DOOR_WIDTH,
  roomBounds,
  type CampusDoor,
  type CampusRoom,
  type CampusRoomId,
  type WallSide,
} from "./campusLayout";
import { createGrainTexture, createStoneFloorTexture } from "../components/gallery/galleryTextures";

export type RoomDoorway = {
  side: WallSide;
  gapCenter: number;
  neighborId: CampusRoomId;
  // The actual wall-gap width this door was cut with (CampusDoor.width ??
  // DOOR_WIDTH in campusLayout.ts) — needed here to size the transom panel
  // that closes the gap above the door header exactly, with no seam against
  // the flanking solid wall segments.
  width: number;
};

// EK's review of 9d7c122: "parameterize finishes so TCG can later gain its
// own identity. Reuse the POP structure, not an identical final color
// scheme for every room." Every color/tone POP_CULTURE's build used is now
// a field here instead of a literal inside the builder functions, so a
// future room can pass its own palette without touching this file's logic.
// TCG this pass reuses the same neutral palette verbatim — this is about
// making a different one possible later, not designing TCG's identity now.
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
// HUB — HUB is adjacent to nearly every room, so enabling "current room's
// neighbors" at full brightness meant a HUB-adjacent bridge could light
// every converted room's complete rig. Each room now owns TWO groups
// instead of one:
//   - full: the real room lighting (downward fixtures, ceiling up-glow,
//     wall washes, featured picture spotlights) — only on when the visitor
//     is actually inside this room or a bridge this room is an endpoint of.
//   - preview: the cheap "don't read as a black box" treatment (currently
//     just the doorway reveal lights) — on whenever this room is merely a
//     graph neighbor of wherever the visitor is, so a room glimpsed through
//     an opening isn't pitch dark without paying for its full rig.
export type RoomLightGroups = { full: THREE.Group; preview: THREE.Group };

export type WallSpan = { wall: WallSide; from: number; to: number; fixed: number; rotationY: number };

// 2026-09-08 architecture reset, defect 1 ("the transom is visibly a
// separate patch"): buildRoomShell built a room's wall material inline as a
// local variable, and the old per-room buildDoorways() built its transom
// from a SEPARATE flat MeshStandardMaterial — same numeric color, but no
// grain map, no bump map, so it responds to light differently and can never
// match. Extracted as one factory so a room's own wall AND anything else
// that needs to read as "this room's wall material" (a connection's transom
// half, see buildDoorConnection below) come from the exact same recipe.
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

/** Room floor, ceiling (with a perimeter trim band), walls (from the
 * campus's own computeWallSegments — the one source of truth for door-gap
 * positions, so this can't drift out of sync with collision), baseboards,
 * and a directional light rig: 2 downward ceiling fixtures plus one
 * wall-wash spotlight per wall (4 total, one per side) — not a flat grid of
 * omnidirectional point lights, and not fewer walls washed than exist. No
 * wall title sprite — the doorway headers carry wayfinding, per EK's
 * review: "Door headers should carry the main wayfinding." Meshes go
 * straight into `scene` (always visible, even from an adjacent room looking
 * through a doorway); every light this room owns goes into the returned
 * THREE.Group instead, so the caller can toggle the whole room's lights on
 * or off as one unit (EK's review of 9d7c122: "make each room's lights
 * controllable as a group... keep lights enabled for the visitor's current
 * room and... immediately connected rooms"). */
export function buildRoomShell(scene: THREE.Scene, module: RoomModule): RoomLightGroups {
  const { room, wallHeight, wallThickness, finish } = module;
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const lights = new THREE.Group();
  lights.name = `room-full:${room.id}`;
  scene.add(lights);
  const preview = new THREE.Group();
  preview.name = `room-preview:${room.id}`;
  scene.add(preview);

  // EK's review of d61a885: wall grain/wash were "too subtle to establish
  // material depth" — bump scale roughly doubled and roughness nudged down
  // so the same grain actually catches the wall-wash light instead of
  // absorbing it flat. Baked into createWallMaterial() now (see above) so a
  // connection's transom can reuse the exact same recipe for this room.
  const neutralWallMaterial = createWallMaterial(finish, room, wallHeight);
  const ceilingGrain = createGrainTexture();
  ceilingGrain.repeat.set(room.w / 5, room.d / 5);
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: finish.ceilingColor, map: ceilingGrain, roughness: 0.92 });
  // EK's review of d61a885: the floor's own fine grain-noise texture was
  // "almost invisible at normal visitor distance." Swapped for the shared
  // stone-tile-with-grout-lines generator (galleryTextures.ts,
  // createStoneFloorTexture) — the exact same one the accepted Gallery's
  // own whitebox style installs — at the same repeat(10.5, 13) tuned for
  // that same 21x26 room shell, instead of a fresh, fainter recipe.
  const floorTexture = createStoneFloorTexture(finish.floorJointColor, 10.5, 13);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorTexture, roughness: 0.62 });
  const baseboardMaterial = new THREE.MeshStandardMaterial({ color: finish.baseboardColor, roughness: 0.85 });
  const ceilingTrimMaterial = new THREE.MeshStandardMaterial({ color: finish.ceilingTrimColor, roughness: 0.7 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: finish.railColor, roughness: 0.5, metalness: 0.35 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(center.x, wallHeight, center.z);
  scene.add(ceiling);

  // Ceiling-edge trim — EK's review of 5ff3bdc: the ceiling needed "edge/
  // trim definition" instead of an abrupt flat-plane-meets-wall seam.
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

  const baseboardHeight = 0.22;
  for (const segment of computeWallSegments()) {
    if (segment.room !== room.id) continue;
    const span = segment.to - segment.from;
    if (span <= 0.05) continue;
    const isNS = segment.side === "north" || segment.side === "south";
    const wall = new THREE.Mesh(
      isNS ? new THREE.BoxGeometry(span, wallHeight, wallThickness) : new THREE.BoxGeometry(wallThickness, wallHeight, span),
      neutralWallMaterial
    );
    const facingSign = segment.side === "north" || segment.side === "west" ? 1 : -1;
    if (isNS) wall.position.set((segment.from + segment.to) / 2, wallHeight / 2, segment.fixed);
    else wall.position.set(segment.fixed, wallHeight / 2, (segment.from + segment.to) / 2);
    scene.add(wall);

    const baseboard = new THREE.Mesh(
      isNS ? new THREE.BoxGeometry(span, baseboardHeight, 0.05) : new THREE.BoxGeometry(0.05, baseboardHeight, span),
      baseboardMaterial
    );
    if (isNS) baseboard.position.set((segment.from + segment.to) / 2, baseboardHeight / 2, segment.fixed + (facingSign * wallThickness) / 2);
    else baseboard.position.set(segment.fixed + (facingSign * wallThickness) / 2, baseboardHeight / 2, (segment.from + segment.to) / 2);
    scene.add(baseboard);

    // One restrained picture rail — EK's review of d61a885: "one restrained
    // picture rail or trim datum... Do not add multiple decorative
    // horizontal lines" (the Vault treatment this deliberately avoids
    // repeating). A single band well above the doorway signs (~5.6) and
    // below the ceiling trim, at a consistent height on every wall.
    const railHeight = 0.06;
    const railY = wallHeight - 2.2;
    const rail = new THREE.Mesh(
      isNS ? new THREE.BoxGeometry(span, railHeight, 0.04) : new THREE.BoxGeometry(0.04, railHeight, span),
      railMaterial
    );
    if (isNS) rail.position.set((segment.from + segment.to) / 2, railY, segment.fixed + (facingSign * wallThickness) / 2);
    else rail.position.set(segment.fixed + (facingSign * wallThickness) / 2, railY, (segment.from + segment.to) / 2);
    scene.add(rail);
  }

  // Light rig — EK's review of 5ff3bdc: the comment said "2 downward + 2
  // wall wash" but the code built a 2x2 grid (4 downward) and only washed
  // 2 of the 4 walls, leaving displayed art dark on the other two. Now
  // genuinely 2 downward ceiling fixtures (spread along the room's longer
  // axis) and one wall-wash spotlight per wall (4 total), so every wall
  // gets grazing light instead of just the two that happened to be covered.
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

    // EK's review of d61a885: the ceiling "renders nearly black from
    // inside the room" — it receives almost no light because the downward
    // spotlights point away from it and the scene's own HemisphereLight
    // gives a downward-facing surface mostly its dark ground color. An
    // omnidirectional light near each fixture naturally throws some light
    // upward onto the ceiling's underside too, the way a real flush-mount
    // fixture's housing glow does.
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
    // Intensity roughly doubled from the previous pass — EK's review of
    // d61a885: "the wall washes are too subtle to establish material depth."
    const light = new THREE.SpotLight(finish.lightColor, 1.3, 20, Math.PI / 3.5, 0.65, 1.4);
    light.position.set(...wash.pos);
    light.target.position.set(...wash.target);
    lights.add(light);
    lights.add(light.target);
  }

  return { full: lights, preview };
}

/** A destination sign plaque — unlit (MeshBasicMaterial, so scene lighting
 * can't darken it, EK's review of d61a885), mounted flush at the given
 * point/rotation, naming whatever's on the far side of an opening from
 * here. Extracted from the old per-room buildDoorways() so a connection
 * (which draws exactly two signs, once, per CAMPUS_DOORS entry) and any
 * future caller share one implementation. */
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

export type ConnectionEndpoint = { room: CampusRoom; wallMaterial: THREE.Material };

/** 2026-09-08 architecture reset — replaces the old per-room buildDoorways().
 * That function built a full frame+transom+signs assembly independently
 * from EACH room module that owned a doorway: for two converted rooms
 * (POP_CULTURE<->TCG) this doubled the whole assembly across the real
 * coordinate gap between them (EK's screenshots 2/3: "complete room walls
 * standing in front of other complete room walls... accidental mini-
 * hallways"); for a converted<->legacy pair (COLLECTION<->MISC) only the
 * converted side got the treatment, leaving the legacy side bare.
 *
 * A physical connection now belongs to CAMPUS_DOORS, not independently to
 * both rooms: this is called exactly ONCE per door, building one enclosed
 * "vestibule" spanning the real coordinate gap between the two rooms —
 * floor, ceiling, and two side-return walls closing it along its depth (the
 * fix for "no exposed wall edge... unexplained narrow passage"), with the
 * frame/transom/signs at its mid-depth. The transom's own ceiling-height
 * infill is split into two halves along the depth axis, each built from
 * that side's own room's wall material (createWallMaterial's factory, or
 * the exact shared instance a legacy room already uses) — the fix for "the
 * transom doesn't read as part of the wall": same recipe, not a flat
 * lookalike color. The vestibule's own interior (its floor/ceiling/sides)
 * stays neutral and deliberate on purpose — it's the connection's own
 * architecture, not either room's identity.
 *
 * Returns the connection's reveal PointLight (already added to `scene`) so
 * the caller can toggle its visibility with the two rooms' own light
 * activation — or null if the two rooms' bounds already meet directly
 * (no gap to fill; not the case for any current campus door, but handled
 * safely rather than assumed away). */
export function buildDoorConnection(
  scene: THREE.Scene,
  door: CampusDoor,
  a: ConnectionEndpoint,
  b: ConnectionEndpoint,
  opts: { wallHeight: number; wallThickness: number; eyeHeight: number; installFrame: boolean }
): THREE.PointLight | null {
  const { wallHeight, wallThickness, eyeHeight, installFrame } = opts;
  const boundsA = roomBounds(a.room);
  const boundsB = roomBounds(b.room);
  const half = (door.width ?? DOOR_WIDTH) / 2;
  const isNS = door.wall === "x"; // rooms stacked along Z -> opening cut into north/south walls

  // `near` always ends up the smaller-z (isNS) or smaller-x (!isNS) room,
  // regardless of which of a/b that turns out to be — so `near`'s own
  // doorway is always on its south (isNS) or east (!isNS) wall, and `far`'s
  // is always on its north/west wall. Used below to get sign/transom
  // orientation right without re-deriving it per call site.
  let near: ConnectionEndpoint;
  let far: ConnectionEndpoint;
  let depth0: number;
  let depth1: number;
  if (isNS) {
    if (boundsA.z1 <= boundsB.z0) { near = a; far = b; depth0 = boundsA.z1; depth1 = boundsB.z0; }
    else { near = b; far = a; depth0 = boundsB.z1; depth1 = boundsA.z0; }
  } else {
    if (boundsA.x1 <= boundsB.x0) { near = a; far = b; depth0 = boundsA.x1; depth1 = boundsB.x0; }
    else { near = b; far = a; depth0 = boundsB.x1; depth1 = boundsA.x0; }
  }
  const depth = depth1 - depth0;
  if (depth <= 0.02) return null;

  const freeLo = door.gapCenter - half;
  const freeHi = door.gapCenter + half;
  const openingWidth = freeHi - freeLo;
  const mid = (depth0 + depth1) / 2;

  // point(freeAxisValue, depthAxisValue) -> world {x, z}, whichever axis is
  // "free" (the opening's own width direction) vs "depth" (the direction
  // you walk through the connection) for this door's orientation.
  function point(freeAxisValue: number, depthAxisValue: number) {
    return isNS ? { x: freeAxisValue, z: depthAxisValue } : { x: depthAxisValue, z: freeAxisValue };
  }

  const revealWallMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.wallColor, roughness: 0.85 });
  const revealCeilingMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.ceilingColor, roughness: 0.9 });
  // A deliberately distinct threshold slab, not either room's own floor
  // continued (their tiling/rotation wouldn't line up anyway) and not the
  // old flat navy "accidental gap" patch — EK's review: "without a blue or
  // black uncovered strip unless a deliberately designed threshold material
  // occupies it."
  const thresholdMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8474, roughness: 0.78 });

  // Threshold floor + ceiling, spanning the connection's full real depth —
  // closes "black ceiling void visible through connections."
  const floorCenter = point(door.gapCenter, mid);
  const floorGeom = isNS ? new THREE.PlaneGeometry(openingWidth, depth) : new THREE.PlaneGeometry(depth, openingWidth);
  const floor = new THREE.Mesh(floorGeom, thresholdMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(floorCenter.x, 0.01, floorCenter.z);
  scene.add(floor);

  const ceiling = new THREE.Mesh(floorGeom.clone(), revealCeilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(floorCenter.x, wallHeight, floorCenter.z);
  scene.add(ceiling);

  // Two side-return walls, spanning the connection's full depth, closing
  // off its sides so nothing is visible past the opening's own width —
  // the fix for "exposed wall edge, freestanding slab... unexplained
  // narrow passage."
  const sideGeom = isNS
    ? new THREE.BoxGeometry(wallThickness, wallHeight, depth)
    : new THREE.BoxGeometry(depth, wallHeight, wallThickness);
  const sideLo = point(freeLo, mid);
  const sideLoMesh = new THREE.Mesh(sideGeom, revealWallMaterial);
  sideLoMesh.position.set(sideLo.x, wallHeight / 2, sideLo.z);
  scene.add(sideLoMesh);
  const sideHi = point(freeHi, mid);
  const sideHiMesh = new THREE.Mesh(sideGeom.clone(), revealWallMaterial);
  sideHiMesh.position.set(sideHi.x, wallHeight / 2, sideHi.z);
  scene.add(sideHiMesh);

  if (installFrame) {
    const frameMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.frameColor, roughness: 0.65, metalness: 0.04 });
    const frame = buildDoorwayFrame(frameMaterial);
    frame.rotation.y = isNS ? 0 : Math.PI / 2;
    const framePos = point(door.gapCenter, mid);
    frame.position.set(framePos.x, 0, framePos.z);
    scene.add(frame);

    const transomBottom = DOORWAY_HEADER_Y + DOORWAY_HEADER_HEIGHT / 2 + 0.02;
    const transomHeight = wallHeight - transomBottom;
    const nearDepth = mid - depth0;
    const farDepth = depth1 - mid;

    const nearGeom = isNS
      ? new THREE.BoxGeometry(openingWidth, transomHeight, nearDepth)
      : new THREE.BoxGeometry(nearDepth, transomHeight, openingWidth);
    const nearCenter = point(door.gapCenter, depth0 + nearDepth / 2);
    const nearTransom = new THREE.Mesh(nearGeom, near.wallMaterial);
    nearTransom.position.set(nearCenter.x, transomBottom + transomHeight / 2, nearCenter.z);
    scene.add(nearTransom);

    const farGeom = isNS
      ? new THREE.BoxGeometry(openingWidth, transomHeight, farDepth)
      : new THREE.BoxGeometry(farDepth, transomHeight, openingWidth);
    const farCenter = point(door.gapCenter, mid + farDepth / 2);
    const farTransom = new THREE.Mesh(farGeom, far.wallMaterial);
    farTransom.position.set(farCenter.x, transomBottom + transomHeight / 2, farCenter.z);
    scene.add(farTransom);

    // Signs mount flush at each room's own wall plane, on that room's own
    // INTERIOR side (not floating mid-gap, and not doubled the way two
    // independent per-room calls used to) and name the far side from
    // wherever you're standing. Offset AWAY from the vestibule (near room's
    // interior is z < depth0, far room's is z > depth1) — offsetting INTO
    // the vestibule instead would embed the sign inside the solid transom
    // box built just above, hiding it completely from every angle.
    const signY = transomBottom + 0.55;
    const nearRotation = isNS ? Math.PI : -Math.PI / 2;
    const farRotation = isNS ? 0 : Math.PI / 2;
    const nearSignPos = point(door.gapCenter, depth0 - 0.03);
    buildDestinationSign(scene, nearSignPos.x, signY, nearSignPos.z, nearRotation, far.room.label);
    const farSignPos = point(door.gapCenter, depth1 + 0.03);
    buildDestinationSign(scene, farSignPos.x, signY, farSignPos.z, farRotation, near.room.label);
  }

  const revealCenter = point(door.gapCenter, mid);
  const reveal = new THREE.PointLight(NEUTRAL_PREVIEW_FINISH.lightColor, 0.6, 9, 2);
  reveal.position.set(revealCenter.x, eyeHeight, revealCenter.z);
  scene.add(reveal);
  return reveal;
}

/** Usable wall spans for item placement — full length on doorless walls,
 * split around each doorway's DOORWAY_NO_DISPLAY_HALF_WIDTH exclusion zone
 * on the others, so no item/rail/panel can cross an opening. Handles
 * multiple doorways on the same wall (unlikely at this room size, but the
 * sweep is general). */
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
    // EK's review of d61a885: "one real THREE.SpotLight plus a target for
    // every item... should not become the permanent campus pattern before
    // measuring performance." Only a capped number of "featured" pieces per
    // room (see placeArtwork) get a real picture spotlight; the rest get a
    // cheap material-level brightness/emissive boost instead of a second
    // dynamic light — visible under the room's own wall-wash light, no
    // extra light object.
    const artMaterial = withRealLight
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.22 });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), artMaterial);
    art.position.set(x + normal.x * 0.02, y, z + normal.z * 0.02);
    art.rotation.y = rotationY;
    scene.add(art);

    if (withRealLight) {
      // A small accent light for featured pieces — mounted out from the
      // wall and slightly above, aimed back at the piece, like a real
      // picture light rather than relying on ambient room spill.
      const pictureLight = new THREE.SpotLight(0xfff4e2, 0.7, 6, Math.PI / 6, 0.5, 1.2);
      pictureLight.position.set(x + normal.x * 1.1, y + artH / 2 + 0.3, z + normal.z * 1.1);
      pictureLight.target.position.set(x, y, z);
      groups.full.add(pictureLight);
      groups.full.add(pictureLight.target);
    }
  });
}

// Real per-item SpotLights are capped per room — beyond this many, items
// get the cheap emissive-boost material instead. Keeps a room's dynamic
// light count bounded as more items/rooms adopt this builder, per EK's
// review of d61a885: "do not copy an unlimited per-item light allocation."
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
