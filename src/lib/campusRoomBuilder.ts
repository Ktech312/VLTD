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
  roomBounds,
  roomById,
  type CampusRoom,
  type CampusRoomId,
  type WallSide,
} from "./campusLayout";
import { createGrainTexture } from "../components/gallery/galleryTextures";

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

export type RoomModule = {
  room: CampusRoom;
  doorways: RoomDoorway[];
  wallHeight: number;
  wallThickness: number;
  eyeHeight: number;
};

export type WallSpan = { wall: WallSide; from: number; to: number; fixed: number; rotationY: number };

function wallRotationY(side: WallSide): number {
  switch (side) {
    case "north": return 0;
    case "south": return Math.PI;
    case "west": return Math.PI / 2;
    case "east": return -Math.PI / 2;
  }
}

function oppositeSide(side: WallSide): WallSide {
  switch (side) {
    case "north": return "south";
    case "south": return "north";
    case "west": return "east";
    case "east": return "west";
  }
}

function wallEdgePoint(bounds: ReturnType<typeof roomBounds>, side: WallSide, freeAxisValue: number, inset: number) {
  switch (side) {
    case "north": return { x: freeAxisValue, z: bounds.z0 + inset };
    case "south": return { x: freeAxisValue, z: bounds.z1 - inset };
    case "west": return { x: bounds.x0 + inset, z: freeAxisValue };
    case "east": return { x: bounds.x1 - inset, z: freeAxisValue };
  }
}

// The unit direction a header mounted on this wall must face to be read by
// someone standing inside the room that owns it (see wallRotationY, whose
// rotation produces exactly this normal).
function intoRoomNormal(side: WallSide): { x: number; z: number } {
  switch (side) {
    case "north": return { x: 0, z: 1 };
    case "south": return { x: 0, z: -1 };
    case "west": return { x: 1, z: 0 };
    case "east": return { x: -1, z: 0 };
  }
}

/** Room floor, ceiling (with a perimeter trim band), walls (from the
 * campus's own computeWallSegments — the one source of truth for door-gap
 * positions, so this can't drift out of sync with collision), baseboards,
 * and a directional light rig: 2 downward ceiling fixtures plus one
 * wall-wash spotlight per wall (4 total, one per side) — not a flat grid of
 * omnidirectional point lights, and not fewer walls washed than exist. No
 * wall title sprite — the doorway headers carry wayfinding, per EK's
 * review: "Door headers should carry the main wayfinding." */
export function buildRoomShell(scene: THREE.Scene, module: RoomModule) {
  const { room, wallHeight, wallThickness } = module;
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };

  const wallGrain = createGrainTexture();
  wallGrain.repeat.set(room.w / 5, wallHeight / 3);
  const neutralWallMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3ddd0, map: wallGrain, bumpMap: wallGrain, bumpScale: 0.025, roughness: 0.94, metalness: 0,
  });
  const ceilingGrain = createGrainTexture();
  ceilingGrain.repeat.set(room.w / 5, room.d / 5);
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xcfc9ba, map: ceilingGrain, roughness: 0.98 });
  // EK's review of 5ff3bdc: "a nearly featureless gray floor" — a flat
  // color with no texture at all read as a placeholder. Same grain
  // generator as the walls, tuned lower-roughness so it actually picks up
  // the room's own lights instead of absorbing them flat.
  const floorGrain = createGrainTexture();
  floorGrain.repeat.set(room.w / 3, room.d / 3);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, map: floorGrain, bumpMap: floorGrain, bumpScale: 0.02, roughness: 0.6 });
  const baseboardMaterial = new THREE.MeshStandardMaterial({ color: 0x454846, roughness: 0.85 });
  const ceilingTrimMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.7 });

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
      new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 0.7 })
    );
    fixture.rotation.x = Math.PI / 2;
    fixture.position.set(lx, wallHeight - 0.03, lz);
    scene.add(fixture);
    const down = new THREE.SpotLight(0xfff2d0, 1.1, 14, Math.PI / 4, 0.55, 1.3);
    down.position.set(lx, wallHeight - 0.4, lz);
    down.target.position.set(lx, 0, lz);
    scene.add(down);
    scene.add(down.target);
  }

  const washSpecs: { pos: [number, number, number]; target: [number, number, number] }[] = [
    { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.85], target: [center.x, wallHeight * 0.35, bounds.z0] },
    { pos: [center.x, wallHeight - 1.1, bounds.z0 + room.d * 0.15], target: [center.x, wallHeight * 0.35, bounds.z1] },
    { pos: [bounds.x0 + room.w * 0.85, wallHeight - 1.1, center.z], target: [bounds.x0, wallHeight * 0.35, center.z] },
    { pos: [bounds.x0 + room.w * 0.15, wallHeight - 1.1, center.z], target: [bounds.x1, wallHeight * 0.35, center.z] },
  ];
  for (const wash of washSpecs) {
    const light = new THREE.SpotLight(0xfff2d0, 0.65, 18, Math.PI / 4, 0.7, 1.5);
    light.position.set(...wash.pos);
    light.target.position.set(...wash.target);
    scene.add(light);
    scene.add(light.target);
  }
}

/** Doorway assemblies: the real post+header frame on every opening, a solid
 * transom panel closing the wall from the header up to the ceiling (EK's
 * review of 5ff3bdc: the wall segment cutter removes the FULL wall height
 * for a door gap, which left a floor-to-ceiling hole with a frame floating
 * in it instead of a real doorway cut into a solid wall), a destination
 * sign mounted flush on each face of that transom (readable from whichever
 * room you're approaching from, naming what's on the far side), and a warm
 * reveal light so looking through an opening isn't a black void. */
export function buildDoorways(scene: THREE.Scene, module: RoomModule) {
  const { room, eyeHeight, wallThickness, wallHeight } = module;
  const bounds = roomBounds(room);
  // Toned down from an earlier, more contrasty beige — the posts/header
  // read as a separate scaffold-like structure standing in an open gap
  // when they stood out sharply against the wall; closer to the wall's own
  // tone (with the transom now finishing the opening around them) lets
  // them read as trim on a real doorway instead.
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xdad4c6, roughness: 0.65, metalness: 0.04 });
  const transomMaterial = new THREE.MeshStandardMaterial({ color: 0xe3ddd0, roughness: 0.9, metalness: 0 });
  const transomBottom = DOORWAY_HEADER_Y + DOORWAY_HEADER_HEIGHT / 2 + 0.02;

  function buildHeader(x: number, y: number, z: number, rotationY: number, text: string) {
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
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), material);
    plaque.position.set(x, y, z);
    plaque.rotation.y = rotationY;
    scene.add(plaque);
  }

  for (const doorway of module.doorways) {
    const neighbor = roomById(doorway.neighborId);
    const neighborBounds = roomBounds(neighbor);
    const far = oppositeSide(doorway.side);
    const isNS = doorway.side === "north" || doorway.side === "south";

    const framePos = wallEdgePoint(bounds, doorway.side, doorway.gapCenter, 0);
    const frame = buildDoorwayFrame(frameMaterial);
    frame.rotation.y = isNS ? 0 : Math.PI / 2;
    frame.position.set(framePos.x, 0, framePos.z);
    scene.add(frame);

    // Transom: closes the wall from just above the frame's own header up to
    // the ceiling, exactly as wide as this door's wall gap, so it reads as
    // a doorway cut through a solid wall rather than a full-height opening.
    const transomHeight = wallHeight - transomBottom;
    const transom = new THREE.Mesh(
      isNS
        ? new THREE.BoxGeometry(doorway.width, transomHeight, wallThickness)
        : new THREE.BoxGeometry(wallThickness, transomHeight, doorway.width),
      transomMaterial
    );
    transom.position.set(framePos.x, transomBottom + transomHeight / 2, framePos.z);
    scene.add(transom);

    // Destination signs mount flush on the transom's own two faces (the
    // same wallThickness/2 offset the baseboards use), just above the
    // opening — not floating in the open air of the gap, and not two
    // separate plaques competing with the transom for "the doorway's
    // architecture." Text still names the far side from wherever you are.
    const signY = transomBottom + 0.55;
    const nearNormal = intoRoomNormal(doorway.side);
    buildHeader(
      framePos.x + nearNormal.x * (wallThickness / 2 + 0.02),
      signY,
      framePos.z + nearNormal.z * (wallThickness / 2 + 0.02),
      wallRotationY(doorway.side),
      neighbor.label
    );

    const farNormal = intoRoomNormal(far);
    buildHeader(
      framePos.x + farNormal.x * (wallThickness / 2 + 0.02),
      signY,
      framePos.z + farNormal.z * (wallThickness / 2 + 0.02),
      wallRotationY(far),
      room.label
    );

    const revealFar = wallEdgePoint(neighborBounds, far, doorway.gapCenter, 0);
    const reveal = new THREE.PointLight(0xfff2d0, 0.6, 9, 2);
    reveal.position.set((framePos.x + revealFar.x) / 2, eyeHeight, (framePos.z + revealFar.z) / 2);
    scene.add(reveal);
  }
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
  x: number, y: number, z: number,
  rotationY: number,
  url: string,
  maxW: number, maxH: number,
  isCancelled: () => boolean
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
    const art = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }));
    art.position.set(x + normal.x * 0.02, y, z + normal.z * 0.02);
    art.rotation.y = rotationY;
    scene.add(art);

    // A small accent light per piece — EK's review of 5ff3bdc: "the
    // artwork remains dark" under generic room lighting alone. Mounted out
    // from the wall and slightly above, aimed back at the piece, like a
    // real picture light rather than relying on ambient room spill.
    const pictureLight = new THREE.SpotLight(0xfff4e2, 0.7, 6, Math.PI / 6, 0.5, 1.2);
    pictureLight.position.set(x + normal.x * 1.1, y + artH / 2 + 0.3, z + normal.z * 1.1);
    pictureLight.target.position.set(x, y, z);
    scene.add(pictureLight);
    scene.add(pictureLight.target);
  });
}

/** Places items across the given usable wall spans, proportionally by span
 * length, evenly spaced within each span, sizing each to its natural
 * aspect ratio within a bounded box instead of forcing every image square. */
export function placeArtwork(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
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
      hangArtPreservingAspect(scene, textureLoader, point.x, point.y, point.z, span.rotationY, item.url, maxSlot, 2.2, isCancelled);
    }
  }
}
