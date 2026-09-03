// Real floor-plan geometry for the VLTD Museum public campus (the separate,
// not-yet-built "bigger business plan" project — see the Museum Campus
// Blueprint artifact, https://claude.ai/code/artifact/7c87a20a-cb50-4bfb-891d-fb2d111040f0).
//
// Every number below is the blueprint's own real-anchored floor plan
// (measured off the live campus Map view's getBoundingClientRect(), then
// scaled so Gallery C matches the one already-built exhibition room's real
// size) converted 1:1 into Three.js world units — SVG x -> world X, SVG y ->
// world Z. Nothing here is re-invented; it's the same 10-room, 18-door
// layout EK already approved in the blueprint, just given a third
// dimension. If the blueprint's floor plan changes, mirror the change here.
import type { UniverseKey } from "@/lib/taxonomy";

// Exact match to the single room's own wall/ceiling height (9.15, see
// VirtualGalleryRoom.tsx's own ceiling mesh) — EK's ask (2026-09-02):
// "carry over all the rules we made from the first room." Was 8, a guess.
export const WALL_HEIGHT = 9.15;
export const WALL_THICKNESS = 0.3;
export const DOOR_HEIGHT = 6.4;
export const DOOR_WIDTH = 3; // wider than the blueprint's 1.6-unit door marker (2.12 scaled) — a real walkthrough needs a walkable gap, not just a legend dot
export const EYE_HEIGHT = 3.6; // matches the built single room's camera eye height

export type CampusRoomId =
  | "HUB"
  | "POP_CULTURE"
  | "TCG"
  | "MISC"
  | "BUILT_BOTANY"
  | "GAMES"
  | "AUTOMOTIVE"
  | "COLLECTION"
  | "SPORTS"
  | "CARDS"
  | "SPOTLIGHT"
  | "STORE"
  | "PLAZA";

export type CampusRoom = {
  id: CampusRoomId;
  label: string;
  tierLabel: string;
  x: number; // world X of the room's west edge
  z: number; // world Z of the room's north edge
  w: number; // width along X
  d: number; // depth along Z
  floorColor: number;
  // Static content mapping for the 7 rooms with an obvious 1:1 real
  // taxonomy match. Collection and Cards don't have one (the blueprint's
  // own bottom-row naming came partly from filler labels, not measured
  // category data) — left empty here and resolved at runtime by
  // assignSwingRoomUniverses() below, from the signed-in user's own real
  // item counts, instead of a guessed hardcoded split.
  universes: UniverseKey[];
  // PLAZA (the entrance forecourt) is open-air — no wall meshes, just a
  // floor and a walkable rect. Collision still respects its bounds either
  // way; this only skips generating wall geometry for it.
  noWalls?: boolean;
};

// Blueprint's pre-scale (px/8) room rects * 1.3268 scale factor, unrounded.
export const S = 1.3268;

export const CAMPUS_ROOMS: CampusRoom[] = [
  { id: "POP_CULTURE", label: "POP_CULTURE", tierLabel: "North Rotunda", x: 0 * S, z: 0 * S, w: 15.4 * S, d: 12.6 * S, floorColor: 0x3a2a1a, universes: ["POP_CULTURE"] },
  { id: "TCG", label: "TCG", tierLabel: "South Rotunda", x: 0 * S, z: 14.1 * S, w: 15.4 * S, d: 12.6 * S, floorColor: 0x1a2a3a, universes: ["TCG"] },
  { id: "MISC", label: "misc", tierLabel: "Gallery A", x: 0 * S, z: 28.1 * S, w: 15.4 * S, d: 26.6 * S, floorColor: 0x2a2a2a, universes: ["MISC"] },
  { id: "HUB", label: "VLTD Museum", tierLabel: "Grand hall", x: 16.9 * S, z: 0 * S, w: 49.1 * S, d: 40.75 * S, floorColor: 0x24211a, universes: [] },
  { id: "BUILT_BOTANY", label: "BUILT_BOTANY", tierLabel: "Gallery D", x: 67.5 * S, z: 0 * S, w: 32.25 * S, d: 12.6 * S, floorColor: 0x1a3323, universes: ["BUILT_BOTANY"] },
  { id: "GAMES", label: "GAMES", tierLabel: "Gallery E", x: 67.5 * S, z: 14.1 * S, w: 32.25 * S, d: 12.6 * S, floorColor: 0x2a1a3a, universes: ["GAMES"] },
  { id: "AUTOMOTIVE", label: "Automobile", tierLabel: "Garden Gallery", x: 67.5 * S, z: 28.1 * S, w: 32.25 * S, d: 26.6 * S, floorColor: 0x3a1a1a, universes: ["AUTOMOTIVE"] },
  { id: "COLLECTION", label: "Collection", tierLabel: "Gallery C · baseline", x: 16.9 * S, z: 42.25 * S, w: 15.4 * S, d: 12.6 * S, floorColor: 0x2a2418, universes: [] },
  { id: "SPORTS", label: "SPORTS", tierLabel: "Gallery F", x: 33.75 * S, z: 42.25 * S, w: 15.4 * S, d: 12.6 * S, floorColor: 0x18242a, universes: ["SPORTS"] },
  { id: "CARDS", label: "Cards", tierLabel: "Gallery G", x: 50.6 * S, z: 42.25 * S, w: 15.4 * S, d: 12.6 * S, floorColor: 0x241a2a, universes: [] },

  // New wings, not in the original blueprint — EK's ask (2026-09-02):
  // build the Spotlight and Store rooms now, flanking the Hub's entrance
  // like a real museum's east/west wings. Content comes from
  // museumCampusConfig.ts (admin-controlled), not vault items, so
  // `universes` stays empty for all three.
  { id: "SPOTLIGHT", label: "Spotlight", tierLabel: "Featured", x: 26, z: -19.5, w: 20, d: 18, floorColor: 0x3a2e18, universes: [] },
  { id: "STORE", label: "Store", tierLabel: "Collector Shop", x: 64, z: -19.5, w: 20, d: 18, floorColor: 0x1a2e28, universes: [] },
  { id: "PLAZA", label: "", tierLabel: "", x: 46, z: -19.5, w: 18, d: 18, floorColor: 0x585858, universes: [], noWalls: true },
];

// The 3 real taxonomy keys with no dedicated room (Collection and Cards
// have no obvious 1:1 match). Resolved at runtime from the signed-in
// user's own real item counts — highest count gets Collection, second
// gets Cards, the leftover folds into misc — rather than a guessed
// hardcoded split. See [[vltd-public-museum-vision]]: sizing/assignment
// should track real data, not be pinned to today's placeholder choice.
export const SWING_UNIVERSES: UniverseKey[] = ["JEWELRY_APPAREL", "MUSIC", "ART"];

export function assignSwingRoomUniverses(
  countByUniverse: Partial<Record<UniverseKey, number>>
): { COLLECTION: UniverseKey[]; CARDS: UniverseKey[]; MISC_EXTRA: UniverseKey[] } {
  const sorted = [...SWING_UNIVERSES].sort(
    (a, b) => (countByUniverse[b] ?? 0) - (countByUniverse[a] ?? 0)
  );
  return { COLLECTION: [sorted[0]], CARDS: [sorted[1]], MISC_EXTRA: [sorted[2]] };
}

export function roomBounds(room: CampusRoom) {
  return { x0: room.x, x1: room.x + room.w, z0: room.z, z1: room.z + room.d };
}

export function roomById(id: CampusRoomId) {
  const room = CAMPUS_ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown campus room: ${id}`);
  return room;
}

export type CampusDoor = {
  // Which wall the gap is cut into: 'x' = a wall running along the X axis
  // (rooms stacked along Z, gap position measured in X); 'z' = a wall
  // running along the Z axis (rooms side by side along X, gap in Z).
  wall: "x" | "z";
  at: number; // the wall's fixed coordinate (z for an 'x' wall, x for a 'z' wall)
  gapCenter: number; // position of the gap's center along the wall's free axis
  rooms: [CampusRoomId, CampusRoomId | null]; // second is null for the building entrance
};

export const CAMPUS_DOORS: CampusDoor[] = [
  { wall: "x", at: 13.35 * S, gapCenter: 7.7 * S, rooms: ["POP_CULTURE", "TCG"] },
  { wall: "x", at: 27.4 * S, gapCenter: 7.7 * S, rooms: ["TCG", "MISC"] },
  { wall: "z", at: 16.15 * S, gapCenter: 6.3 * S, rooms: ["POP_CULTURE", "HUB"] },
  { wall: "z", at: 16.15 * S, gapCenter: 20.4 * S, rooms: ["TCG", "HUB"] },
  { wall: "z", at: 16.15 * S, gapCenter: 34.425 * S, rooms: ["MISC", "HUB"] },
  { wall: "z", at: 16.15 * S, gapCenter: 48.475 * S, rooms: ["MISC", "COLLECTION"] },
  { wall: "z", at: 65.95 * S, gapCenter: 6.3 * S, rooms: ["HUB", "BUILT_BOTANY"] },
  { wall: "z", at: 65.95 * S, gapCenter: 20.4 * S, rooms: ["HUB", "GAMES"] },
  { wall: "z", at: 65.95 * S, gapCenter: 34.4 * S, rooms: ["HUB", "AUTOMOTIVE"] },
  { wall: "z", at: 65.95 * S, gapCenter: 47.675 * S, rooms: ["CARDS", "AUTOMOTIVE"] },
  { wall: "x", at: 40.7 * S, gapCenter: 24.6 * S, rooms: ["HUB", "COLLECTION"] },
  { wall: "x", at: 40.7 * S, gapCenter: 41.45 * S, rooms: ["HUB", "SPORTS"] },
  { wall: "x", at: 40.7 * S, gapCenter: 58.3 * S, rooms: ["HUB", "CARDS"] },
  { wall: "z", at: 32.2 * S, gapCenter: 48.55 * S, rooms: ["COLLECTION", "SPORTS"] },
  { wall: "z", at: 49.05 * S, gapCenter: 48.55 * S, rooms: ["SPORTS", "CARDS"] },
  { wall: "x", at: 12.55 * S, gapCenter: 83.625 * S, rooms: ["BUILT_BOTANY", "GAMES"] },
  { wall: "x", at: 26.6 * S, gapCenter: 83.625 * S, rooms: ["GAMES", "AUTOMOTIVE"] },

  // New wings (not in the original blueprint) — see CAMPUS_ROOMS above.
  { wall: "x", at: 0, gapCenter: 36, rooms: ["HUB", "SPOTLIGHT"] },
  { wall: "x", at: 0, gapCenter: 74, rooms: ["HUB", "STORE"] },
  // The Hub's entrance now opens onto a real walkable plaza instead of a void.
  { wall: "x", at: 0, gapCenter: 40.65 * S, rooms: ["HUB", "PLAZA"] },
];

// Spawn out in the plaza, facing the entrance facade — EK's ask
// (2026-09-02) was for the exterior to be "some visual fun," so the
// walkthrough now opens on it instead of starting already inside.
export const CAMPUS_SPAWN = { x: 55, z: -15, yaw: Math.PI };

export type WallSide = "north" | "south" | "east" | "west";
export type WallSegment = {
  room: CampusRoomId;
  side: WallSide;
  fixed: number; // the wall's fixed coordinate (z for north/south, x for east/west)
  from: number; // span start along the wall's free axis
  to: number; // span end along the wall's free axis
};

function doorNeighborSide(door: CampusDoor, room: CampusRoom): WallSide {
  const neighborId = door.rooms[0] === room.id ? door.rooms[1] : door.rooms[0];
  if (door.wall === "x") {
    // rooms stacked along Z: neighbor's z tells us if this is the room's
    // north (smaller z) or south (larger z) wall. No neighbor (entrance) ->
    // compare the door's own recorded z against this room's edges.
    const neighborZ = neighborId ? roomById(neighborId).z : door.at;
    return neighborZ >= room.z + room.d / 2 ? "south" : "north";
  }
  const neighborX = door.rooms[1] === null || door.rooms[1] === undefined
    ? door.at
    : roomById(door.rooms[0] === room.id ? door.rooms[1]! : door.rooms[0]).x;
  return neighborX >= room.x + room.w / 2 ? "east" : "west";
}

/** Every room's 4 walls, split into segments that leave a DOOR_WIDTH gap
 * wherever a door touches that wall. A room side with no doors comes back
 * as a single full-length segment (a solid exterior/interior wall). */
export function computeWallSegments(): WallSegment[] {
  const segments: WallSegment[] = [];

  for (const room of CAMPUS_ROOMS) {
    if (room.noWalls) continue;
    const bounds = roomBounds(room);
    const sides: { side: WallSide; fixed: number; from: number; to: number }[] = [
      { side: "north", fixed: bounds.z0, from: bounds.x0, to: bounds.x1 },
      { side: "south", fixed: bounds.z1, from: bounds.x0, to: bounds.x1 },
      { side: "west", fixed: bounds.x0, from: bounds.z0, to: bounds.z1 },
      { side: "east", fixed: bounds.x1, from: bounds.z0, to: bounds.z1 },
    ];

    for (const wallSide of sides) {
      const wallAxis = wallSide.side === "north" || wallSide.side === "south" ? "x" : "z";
      const gaps = CAMPUS_DOORS
        .filter((door) => door.wall === wallAxis && door.rooms.includes(room.id))
        .filter((door) => doorNeighborSide(door, room) === wallSide.side)
        .map((door) => ({ from: door.gapCenter - DOOR_WIDTH / 2, to: door.gapCenter + DOOR_WIDTH / 2 }))
        .sort((a, b) => a.from - b.from);

      let cursor = wallSide.from;
      for (const gap of gaps) {
        if (gap.from > cursor) {
          segments.push({ room: room.id, side: wallSide.side, fixed: wallSide.fixed, from: cursor, to: gap.from });
        }
        cursor = Math.max(cursor, gap.to);
      }
      if (cursor < wallSide.to) {
        segments.push({ room: room.id, side: wallSide.side, fixed: wallSide.fixed, from: cursor, to: wallSide.to });
      }
    }
  }

  return segments;
}

export type DoorBridge = { x0: number; x1: number; z0: number; z1: number };

const WALKABLE_MARGIN = 0.9; // keeps the camera from clipping into walls

/** A small walkable floor patch spanning the physical gap between two
 * adjacent rooms at each door, so the corridor between two room rects
 * (they don't literally touch) is actually crossable. Skips the building
 * entrance (no room on the other side). Extended by WALKABLE_MARGIN past
 * each room's true edge so it overlaps that room's own margin-inset
 * walkable rect — without this, a real live-tested run found the camera
 * getting stuck in a dead strip right at the threshold (the inset rect
 * stopped short of the bridge, and the bridge stopped short of the inset
 * rect, with neither overlapping the other). */
export function computeDoorBridges(): DoorBridge[] {
  const bridges: DoorBridge[] = [];

  for (const door of CAMPUS_DOORS) {
    const [aId, bId] = door.rooms;
    if (!bId) continue;
    const a = roomById(aId);
    const b = roomById(bId);
    const half = DOOR_WIDTH / 2;

    if (door.wall === "x") {
      const z0 = Math.min(a.z + a.d, b.z + b.d);
      const z1 = Math.max(a.z, b.z);
      bridges.push({
        x0: door.gapCenter - half,
        x1: door.gapCenter + half,
        z0: Math.min(z0, z1) - WALKABLE_MARGIN,
        z1: Math.max(z0, z1) + WALKABLE_MARGIN,
      });
    } else {
      const x0 = Math.min(a.x + a.w, b.x + b.w);
      const x1 = Math.max(a.x, b.x);
      bridges.push({
        x0: Math.min(x0, x1) - WALKABLE_MARGIN,
        x1: Math.max(x0, x1) + WALKABLE_MARGIN,
        z0: door.gapCenter - half,
        z1: door.gapCenter + half,
      });
    }
  }

  return bridges;
}

export function buildWalkableAreas() {
  const rooms = CAMPUS_ROOMS.map((room) => {
    const b = roomBounds(room);
    return { x0: b.x0 + WALKABLE_MARGIN, x1: b.x1 - WALKABLE_MARGIN, z0: b.z0 + WALKABLE_MARGIN, z1: b.z1 - WALKABLE_MARGIN };
  });
  const bridges = computeDoorBridges();
  return { rooms, bridges };
}

export function isWalkable(
  x: number,
  z: number,
  areas: ReturnType<typeof buildWalkableAreas>
): boolean {
  for (const r of areas.rooms) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  for (const br of areas.bridges) {
    if (x >= br.x0 && x <= br.x1 && z >= br.z0 && z <= br.z1) return true;
  }
  return false;
}
