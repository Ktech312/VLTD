// Real floor-plan geometry for the VLTD Museum public campus (the separate,
// not-yet-built "bigger business plan" project — see the Museum Campus
// Blueprint artifact, https://claude.ai/code/artifact/7c87a20a-cb50-4bfb-891d-fb2d111040f0).
//
// Shared-Wall Grid Plan (2026-09-08, EK-approved after rejecting the
// connection-owned vestibule architecture): every room now sits on an exact
// module grid — a 21x26 base module (COLLECTION's own accepted size) — so
// adjacent rooms share the IDENTICAL boundary coordinate. There is no
// coordinate gap between any two adjoining rooms anymore, and therefore no
// vestibule, no bridge-through-empty-space, no double wall. A room's wall on
// a shared boundary IS the neighbor's wall on that boundary — one physical
// structure, not two. See campusRoomBuilder.ts's buildSharedWall() for how
// that one wall gets built, finished on each face, and (where CAMPUS_DOORS
// calls for it) cut into a doorway.
import type { UniverseKey } from "@/lib/taxonomy";
import { DOORWAY_WALL_GAP, MUSEUM_EYE_HEIGHT, STANDARD_ROOM_HEIGHT } from "./museumStandard";

export const WALL_HEIGHT = STANDARD_ROOM_HEIGHT;
export const WALL_THICKNESS = 0.3;
export const DOOR_HEIGHT = 6.4;
export const DOOR_WIDTH = 3; // campus default for any door that doesn't install the real doorwayKit frame (none currently — every door below carries DOORWAY_WALL_GAP)
export const EYE_HEIGHT = MUSEUM_EYE_HEIGHT;

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
  // taxonomy match. Collection and Cards don't have one — resolved at
  // runtime by assignSwingRoomUniverses() below, from the signed-in user's
  // own real item counts, instead of a guessed hardcoded split.
  universes: UniverseKey[];
  // PLAZA (the entrance forecourt) is open-air — no wall meshes on any of
  // its boundaries, including the ones it shares with SPOTLIGHT/STORE/HUB.
  // Collision still respects its bounds either way; this only skips wall
  // generation.
  noWalls?: boolean;
};

// Shared-Wall Grid Plan module unit — every room's w/d is a whole multiple
// of this, and every adjoining pair's shared edge lands on the same exact
// coordinate by construction (verified pairwise for overlap-free tiling
// before this pass shipped).
export const MODULE_WIDTH = 21;
export const MODULE_DEPTH = 26;

export const CAMPUS_ROOMS: CampusRoom[] = [
  { id: "POP_CULTURE", label: "POP_CULTURE", tierLabel: "North Rotunda", x: 0, z: 0, w: 21, d: 26, floorColor: 0x3a2a1a, universes: ["POP_CULTURE"] },
  { id: "TCG", label: "TCG", tierLabel: "South Rotunda", x: 0, z: 26, w: 21, d: 26, floorColor: 0x1a2a3a, universes: ["TCG"] },
  { id: "MISC", label: "misc", tierLabel: "Gallery A", x: 0, z: 52, w: 21, d: 52, floorColor: 0x2a2a2a, universes: ["MISC"] },
  { id: "HUB", label: "VLTD Museum", tierLabel: "Grand hall", x: 21, z: 0, w: 63, d: 78, floorColor: 0x24211a, universes: [] },
  { id: "BUILT_BOTANY", label: "BUILT_BOTANY", tierLabel: "Gallery D", x: 84, z: 0, w: 42, d: 26, floorColor: 0x1a3323, universes: ["BUILT_BOTANY"] },
  { id: "GAMES", label: "GAMES", tierLabel: "Gallery E", x: 84, z: 26, w: 42, d: 26, floorColor: 0x2a1a3a, universes: ["GAMES"] },
  { id: "AUTOMOTIVE", label: "Automobile", tierLabel: "Garden Gallery", x: 84, z: 52, w: 42, d: 52, floorColor: 0x3a1a1a, universes: ["AUTOMOTIVE"] },
  { id: "COLLECTION", label: "Collection", tierLabel: "Gallery C · baseline", x: 21, z: 78, w: 21, d: 26, floorColor: 0x2a2418, universes: [] },
  { id: "SPORTS", label: "SPORTS", tierLabel: "Gallery F", x: 42, z: 78, w: 21, d: 26, floorColor: 0x18242a, universes: ["SPORTS"] },
  { id: "CARDS", label: "Cards", tierLabel: "Gallery G", x: 63, z: 78, w: 21, d: 26, floorColor: 0x241a2a, universes: [] },
  { id: "SPOTLIGHT", label: "Spotlight", tierLabel: "Featured", x: 21, z: -26, w: 21, d: 26, floorColor: 0x3a2e18, universes: [] },
  { id: "PLAZA", label: "", tierLabel: "", x: 42, z: -26, w: 21, d: 26, floorColor: 0x585858, universes: [], noWalls: true },
  { id: "STORE", label: "Store", tierLabel: "Collector Shop", x: 63, z: -26, w: 21, d: 26, floorColor: 0x1a2e28, universes: [] },
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

/** Looks up the gapCenter of the door between two rooms, so callers (room
 * doorway data, item placement) never have to re-type a value CAMPUS_DOORS
 * already computes. */
export function doorGapCenter(a: CampusRoomId, b: CampusRoomId): number {
  const door = CAMPUS_DOORS.find(
    (d) => (d.rooms[0] === a && d.rooms[1] === b) || (d.rooms[0] === b && d.rooms[1] === a)
  );
  if (!door) throw new Error(`No door between ${a} and ${b}`);
  return door.gapCenter;
}

/** The actual wall-gap width a door was cut with (its own `width`, or the
 * campus default DOOR_WIDTH). */
export function doorWallWidth(a: CampusRoomId, b: CampusRoomId): number {
  const door = CAMPUS_DOORS.find(
    (d) => (d.rooms[0] === a && d.rooms[1] === b) || (d.rooms[0] === b && d.rooms[1] === a)
  );
  if (!door) throw new Error(`No door between ${a} and ${b}`);
  return door.width ?? DOOR_WIDTH;
}

/** Every room directly connected to `id` by a door — used to decide which
 * rooms' lights should stay on (the visitor's current room plus its direct
 * neighbors). Pure graph lookup over CAMPUS_DOORS. */
export function adjacentRoomIds(id: CampusRoomId): CampusRoomId[] {
  const neighbors: CampusRoomId[] = [];
  for (const door of CAMPUS_DOORS) {
    const [a, b] = door.rooms;
    if (a === id && b) neighbors.push(b);
    else if (b === id) neighbors.push(a);
  }
  return neighbors;
}

export type CampusDoor = {
  // Which wall the gap is cut into: 'x' = a wall running along the X axis
  // (rooms stacked along Z, gap position measured in X); 'z' = a wall
  // running along the Z axis (rooms side by side along X, gap in Z).
  wall: "x" | "z";
  at: number; // the wall's fixed coordinate (z for an 'x' wall, x for a 'z' wall) — now the two rooms' real, exactly-shared boundary
  gapCenter: number; // position of the gap's center along the wall's free axis
  rooms: [CampusRoomId, CampusRoomId | null]; // second is null for the building entrance
  width?: number; // wall-gap width, if wider than the campus default DOOR_WIDTH
};

// Every door's gapCenter (and `at`) is still derived from the two rooms'
// live CAMPUS_ROOMS entries, not typed in — EK's review of 5820b85, still
// the rule. Under the shared-wall grid, `at` (sharedBoundaryAlongX/Z below)
// is no longer just documentation: it's the exact coordinate of the one
// wall both rooms share, and it's what buildSharedWall() actually cuts.
function overlapCenterAlongX(a: CampusRoom, b: CampusRoom): number {
  return (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
}
function overlapCenterAlongZ(a: CampusRoom, b: CampusRoom): number {
  return (Math.max(a.z, b.z) + Math.min(a.z + a.d, b.z + b.d)) / 2;
}
function sharedBoundaryAlongX(a: CampusRoom, b: CampusRoom): number {
  const [west, east] = a.x <= b.x ? [a, b] : [b, a];
  return (west.x + west.w + east.x) / 2;
}
function sharedBoundaryAlongZ(a: CampusRoom, b: CampusRoom): number {
  const [north, south] = a.z <= b.z ? [a, b] : [b, a];
  return (north.z + north.d + south.z) / 2;
}

export const CAMPUS_DOORS: CampusDoor[] = [
  { wall: "x", at: sharedBoundaryAlongZ(roomById("POP_CULTURE"), roomById("TCG")), gapCenter: overlapCenterAlongX(roomById("POP_CULTURE"), roomById("TCG")), rooms: ["POP_CULTURE", "TCG"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("TCG"), roomById("MISC")), gapCenter: overlapCenterAlongX(roomById("TCG"), roomById("MISC")), rooms: ["TCG", "MISC"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("POP_CULTURE"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("POP_CULTURE"), roomById("HUB")), rooms: ["POP_CULTURE", "HUB"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("TCG"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("TCG"), roomById("HUB")), rooms: ["TCG", "HUB"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("MISC"), roomById("COLLECTION")), gapCenter: overlapCenterAlongZ(roomById("MISC"), roomById("COLLECTION")), rooms: ["MISC", "COLLECTION"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("BUILT_BOTANY")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("BUILT_BOTANY")), rooms: ["HUB", "BUILT_BOTANY"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("GAMES")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("GAMES")), rooms: ["HUB", "GAMES"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("AUTOMOTIVE")), rooms: ["HUB", "AUTOMOTIVE"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("CARDS"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongZ(roomById("CARDS"), roomById("AUTOMOTIVE")), rooms: ["CARDS", "AUTOMOTIVE"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("COLLECTION")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("COLLECTION")), rooms: ["HUB", "COLLECTION"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("SPORTS")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("SPORTS")), rooms: ["HUB", "SPORTS"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("CARDS")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("CARDS")), rooms: ["HUB", "CARDS"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("COLLECTION"), roomById("SPORTS")), gapCenter: overlapCenterAlongZ(roomById("COLLECTION"), roomById("SPORTS")), rooms: ["COLLECTION", "SPORTS"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("SPORTS"), roomById("CARDS")), gapCenter: overlapCenterAlongZ(roomById("SPORTS"), roomById("CARDS")), rooms: ["SPORTS", "CARDS"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("BUILT_BOTANY"), roomById("GAMES")), gapCenter: overlapCenterAlongX(roomById("BUILT_BOTANY"), roomById("GAMES")), rooms: ["BUILT_BOTANY", "GAMES"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("GAMES"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongX(roomById("GAMES"), roomById("AUTOMOTIVE")), rooms: ["GAMES", "AUTOMOTIVE"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("SPOTLIGHT"), roomById("HUB")), gapCenter: overlapCenterAlongX(roomById("SPOTLIGHT"), roomById("HUB")), rooms: ["SPOTLIGHT", "HUB"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("PLAZA"), roomById("HUB")), gapCenter: overlapCenterAlongX(roomById("PLAZA"), roomById("HUB")), rooms: ["PLAZA", "HUB"], width: DOORWAY_WALL_GAP },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("STORE"), roomById("HUB")), gapCenter: overlapCenterAlongX(roomById("STORE"), roomById("HUB")), rooms: ["STORE", "HUB"], width: DOORWAY_WALL_GAP },
  // EK's ask (2026-09-10), restoring the MISC<->HUB shortcut the earlier
  // plan left for her to decide on: same computed-not-hardcoded pattern as
  // every other door above, no special-casing. Its gapCenter lands at
  // z=65 by the exact same overlapCenterAlongZ() math every other door
  // uses — which happens to be the same z as the HUB<->AUTOMOTIVE door
  // (door 7 below), since MISC and AUTOMOTIVE share the identical z=52..104
  // span. That's what puts it "in line with Automobile across the way," not
  // a hand-picked coordinate.
  { wall: "z", at: sharedBoundaryAlongX(roomById("MISC"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("MISC"), roomById("HUB")), rooms: ["MISC", "HUB"], width: DOORWAY_WALL_GAP },
];

// Shared boundaries with no door — the wall is still real and still built
// (one structural wall, finished on each face), it just has no opening cut
// into it. SPOTLIGHT<->PLAZA and PLAZA<->STORE are touching boundaries with
// no door, but PLAZA is `noWalls` — computeCampusWallSegments() below skips
// wall generation on any segment touching a noWalls room entirely, so
// those two need no entry here. MISC<->HUB (the one shared boundary that
// used to be listed here) now has a real door — see CAMPUS_DOORS above.
export const CAMPUS_SOLID_ADJACENCIES: [CampusRoomId, CampusRoomId][] = [];

// Spawn in the plaza, facing the entrance facade — EK's ask (2026-09-02).
export const CAMPUS_SPAWN = { x: roomById("PLAZA").x + roomById("PLAZA").w / 2, z: roomById("PLAZA").z + roomById("PLAZA").d / 2, yaw: Math.PI };

export type WallSide = "north" | "south" | "east" | "west";

/** One physical wall segment, owned by the shared boundary it sits on, not
 * by either room individually. `roomA` is the room on the smaller-Z (for an
 * 'x' wall) or smaller-X (for a 'z' wall) side; `roomB` is the room on the
 * other side, or null if this segment faces open exterior space (campus
 * boundary, or a neighbor that turned out to be a `noWalls` room). Replaces
 * the old per-room WallSegment/computeWallSegments — a shared boundary now
 * produces exactly ONE segment here, not one from each adjoining room's own
 * accounting. */
export type CampusWallSegment = {
  wall: "x" | "z";
  fixed: number;
  from: number;
  to: number;
  roomA: CampusRoomId;
  roomB: CampusRoomId | null;
};

function findDoor(a: CampusRoomId, b: CampusRoomId): CampusDoor | undefined {
  return CAMPUS_DOORS.find(
    (d) => (d.rooms[0] === a && d.rooms[1] === b) || (d.rooms[0] === b && d.rooms[1] === a)
  );
}

/** Every wall boundary in the campus, computed once from room bounds —
 * shared segments where two rooms' edges coincide, exterior segments where
 * they don't, and door gaps cut wherever CAMPUS_DOORS calls for one. A room
 * whose edge borders MULTIPLE neighbors along its length (HUB borders
 * POP_CULTURE, TCG, and MISC along its whole west edge) is split at each
 * neighbor's own boundary, not treated as one continuous wall — the
 * partition below adds every touching room's own edge coordinates as break
 * points before grouping, so this falls out automatically instead of being
 * hand-curated per room. */
export function computeCampusWallSegments(): CampusWallSegment[] {
  const segments: CampusWallSegment[] = [];

  function processAxis(wall: "x" | "z") {
    const lines = new Set<number>();
    for (const room of CAMPUS_ROOMS) {
      const b = roomBounds(room);
      if (wall === "x") { lines.add(b.z0); lines.add(b.z1); }
      else { lines.add(b.x0); lines.add(b.x1); }
    }

    for (const fixed of lines) {
      // "high" = rooms whose far edge sits on this line (north/west side of
      // the line, for an 'x'/'z' wall respectively); "low" = rooms whose
      // near edge sits on this line (south/east side).
      const highSide = CAMPUS_ROOMS.filter((r) => { const b = roomBounds(r); return wall === "x" ? b.z1 === fixed : b.x1 === fixed; });
      const lowSide = CAMPUS_ROOMS.filter((r) => { const b = roomBounds(r); return wall === "x" ? b.z0 === fixed : b.x0 === fixed; });
      if (highSide.length === 0 && lowSide.length === 0) continue;

      const breakpoints = new Set<number>();
      for (const r of [...highSide, ...lowSide]) {
        const b = roomBounds(r);
        breakpoints.add(wall === "x" ? b.x0 : b.z0);
        breakpoints.add(wall === "x" ? b.x1 : b.z1);
      }
      const sorted = [...breakpoints].sort((a, b) => a - b);

      for (let i = 0; i < sorted.length - 1; i += 1) {
        const from = sorted[i];
        const to = sorted[i + 1];
        if (to - from < 1e-6) continue;
        const mid = (from + to) / 2;
        const inSpan = (r: CampusRoom) => {
          const b = roomBounds(r);
          const lo = wall === "x" ? b.x0 : b.z0;
          const hi = wall === "x" ? b.x1 : b.z1;
          return mid > lo && mid < hi;
        };
        const high = highSide.find(inSpan);
        const low = lowSide.find(inSpan);
        if (!high && !low) continue;

        if (high && low) {
          // A `noWalls` room (PLAZA) still gets a normal shared wall
          // wherever it borders a REAL room — noWalls only ever means "this
          // room doesn't generate a wall of its own reaching into a shared
          // boundary," never "leave the neighbor's own enclosure open."
          // SPOTLIGHT and STORE keep their own full enclosure (one door
          // each, to HUB) exactly as before; their plaza-facing sides are
          // solid, just built once, on their own account, rather than
          // independently by each room. HUB<->PLAZA (the real entrance)
          // gets the same real wall+door treatment as any other door.
          segments.push({ wall, fixed, from, to, roomA: high.id, roomB: low.id });
          continue;
        }

        const only = high ?? low!;
        if (only.noWalls) continue; // PLAZA's true exterior edge (no neighbor at all, facing the facade): open
        segments.push({ wall, fixed, from, to, roomA: only.id, roomB: null });
      }
    }
  }

  processAxis("x");
  processAxis("z");
  return segments;
}

/** Cuts a door's gap (if any) out of a shared-wall segment, returning the
 * solid piece(s) that remain. A segment can carry at most one door, since
 * CAMPUS_DOORS only ever lists one connection per room pair. */
export function splitSegmentForDoor(segment: CampusWallSegment): { solid: { from: number; to: number }[]; door: CampusDoor | null } {
  if (!segment.roomB) return { solid: [{ from: segment.from, to: segment.to }], door: null };
  const door = findDoor(segment.roomA, segment.roomB);
  if (!door) return { solid: [{ from: segment.from, to: segment.to }], door: null };

  const half = (door.width ?? DOOR_WIDTH) / 2;
  const gapFrom = door.gapCenter - half;
  const gapTo = door.gapCenter + half;
  const solid: { from: number; to: number }[] = [];
  if (gapFrom > segment.from) solid.push({ from: segment.from, to: Math.min(gapFrom, segment.to) });
  if (gapTo < segment.to) solid.push({ from: Math.max(gapTo, segment.from), to: segment.to });
  return { solid, door };
}

export type DoorBridge = { doorIndex: number; x0: number; x1: number; z0: number; z1: number };

const WALKABLE_MARGIN = 0.9; // keeps the camera from clipping into walls

/** A small walkable strip spanning a doorway threshold, so the two rooms'
 * own margin-inset walkable rects (each stopping WALKABLE_MARGIN short of
 * the real, now-shared wall) actually connect. Under the shared-wall grid
 * there's no real coordinate gap between rooms anymore — this bridge only
 * needs to cross the margin insets themselves (2*WALKABLE_MARGIN deep,
 * centered exactly on the shared boundary), not a real room-to-room gap
 * plus margin the way the old vestibule-era bridges did. */
export function computeDoorBridges(): DoorBridge[] {
  const bridges: DoorBridge[] = [];

  CAMPUS_DOORS.forEach((door, doorIndex) => {
    const [, bId] = door.rooms;
    if (!bId) return;
    const half = (door.width ?? DOOR_WIDTH) / 2;

    if (door.wall === "x") {
      bridges.push({
        doorIndex,
        x0: door.gapCenter - half,
        x1: door.gapCenter + half,
        z0: door.at - WALKABLE_MARGIN,
        z1: door.at + WALKABLE_MARGIN,
      });
    } else {
      bridges.push({
        doorIndex,
        x0: door.at - WALKABLE_MARGIN,
        x1: door.at + WALKABLE_MARGIN,
        z0: door.gapCenter - half,
        z1: door.gapCenter + half,
      });
    }
  });

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

// Room-center targets: one calm, predictable destination per named room.
// The renderer gives these the original four-corner target appearance; the
// layout layer owns only their exact room-center positions.
export type CampusWaypoint = { id: string; roomId: CampusRoomId; x: number; z: number };

export function computeCampusWaypoints(): CampusWaypoint[] {
  // EK's ask (2026-09-10): "most [rooms] have them" — every room gets a
  // target, including PLAZA. PLAZA was the one room this used to skip,
  // purely because its `label` is empty (it has no destination-sign
  // identity of its own) — but the target here never displays that label,
  // so there was no real reason to exclude it. PLAZA's floor and center
  // are already walkable like any other room's.
  return CAMPUS_ROOMS.map((room) => ({
    id: `room:${room.id}`,
    roomId: room.id,
    x: room.x + room.w / 2,
    z: room.z + room.d / 2,
  }));
}

// A validator that rejects a door unless (a) its gap center lies inside
// both rooms' shared wall span, (b) the two rooms are actually adjacent on
// the axis the door claims, and (c) its bridge overlaps both rooms' own
// margin-inset walkable rects. Every campus door must pass this with zero
// issues before a deploy — run as part of the pre-push check, the same way
// tsc/eslint/build already are.
export type DoorValidationIssue = { doorIndex: number; rooms: string; message: string };

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.max(a0, b0) < Math.min(a1, b1);
}

// The bridge/inset-rect check wants "touching or overlapping," not strict
// interior overlap: a bridge is deliberately built to expand by exactly
// WALKABLE_MARGIN — the same margin the room's own inset rect is shrunk by
// — so a correctly-built bridge lands EXACTLY tangent to the room's inset
// edge, not strictly past it.
function rangesConnect(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.max(a0, b0) <= Math.min(a1, b1);
}

export function validateCampusDoors(): DoorValidationIssue[] {
  const issues: DoorValidationIssue[] = [];
  const clearance = 0.05;

  CAMPUS_DOORS.forEach((door, doorIndex) => {
    const [aId, bId] = door.rooms;
    const a = roomById(aId);
    const label = `${aId}<->${bId ?? "entrance"}`;
    if (!bId) return;

    const b = roomById(bId);
    const half = (door.width ?? DOOR_WIDTH) / 2;

    if (door.wall === "x") {
      if (rangesOverlap(a.z, a.z + a.d, b.z, b.z + b.d)) {
        issues.push({ doorIndex, rooms: label, message: "wall:x door but the two rooms overlap in Z instead of being stacked" });
      }
      if (a.z + a.d !== b.z && b.z + b.d !== a.z) {
        issues.push({ doorIndex, rooms: label, message: `wall:x door but the rooms' edges don't coincide (expected a shared boundary, not a gap or overlap)` });
      }
      const lo = Math.max(a.x, b.x);
      const hi = Math.min(a.x + a.w, b.x + b.w);
      if (lo >= hi) {
        issues.push({ doorIndex, rooms: label, message: "wall:x door but the rooms have no X overlap at all" });
      } else if (door.gapCenter - half < lo + clearance || door.gapCenter + half > hi - clearance) {
        issues.push({ doorIndex, rooms: label, message: `gapCenter ${door.gapCenter.toFixed(2)} +-${half.toFixed(2)} doesn't fit inside the shared X span [${lo.toFixed(2)}, ${hi.toFixed(2)}]` });
      }
    } else {
      if (rangesOverlap(a.x, a.x + a.w, b.x, b.x + b.w)) {
        issues.push({ doorIndex, rooms: label, message: "wall:z door but the two rooms overlap in X instead of being side by side" });
      }
      if (a.x + a.w !== b.x && b.x + b.w !== a.x) {
        issues.push({ doorIndex, rooms: label, message: `wall:z door but the rooms' edges don't coincide (expected a shared boundary, not a gap or overlap)` });
      }
      const lo = Math.max(a.z, b.z);
      const hi = Math.min(a.z + a.d, b.z + b.d);
      if (lo >= hi) {
        issues.push({ doorIndex, rooms: label, message: "wall:z door but the rooms have no Z overlap at all" });
      } else if (door.gapCenter - half < lo + clearance || door.gapCenter + half > hi - clearance) {
        issues.push({ doorIndex, rooms: label, message: `gapCenter ${door.gapCenter.toFixed(2)} +-${half.toFixed(2)} doesn't fit inside the shared Z span [${lo.toFixed(2)}, ${hi.toFixed(2)}]` });
      }
    }
  });

  const areas = buildWalkableAreas();
  computeDoorBridges().forEach((bridge) => {
    const door = CAMPUS_DOORS[bridge.doorIndex];
    const [aId, bId] = door.rooms;
    const label = `${aId}<->${bId ?? "entrance"}`;
    const aIndex = CAMPUS_ROOMS.findIndex((r) => r.id === aId);
    const bIndex = bId ? CAMPUS_ROOMS.findIndex((r) => r.id === bId) : -1;
    const aInset = areas.rooms[aIndex];
    const bInset = bIndex >= 0 ? areas.rooms[bIndex] : null;

    if (!(rangesConnect(bridge.x0, bridge.x1, aInset.x0, aInset.x1) && rangesConnect(bridge.z0, bridge.z1, aInset.z0, aInset.z1))) {
      issues.push({ doorIndex: bridge.doorIndex, rooms: label, message: `bridge does not reach ${aId}'s inset walkable rect (dead-strip risk)` });
    }
    if (bInset && !(rangesConnect(bridge.x0, bridge.x1, bInset.x0, bInset.x1) && rangesConnect(bridge.z0, bridge.z1, bInset.z0, bInset.z1))) {
      issues.push({ doorIndex: bridge.doorIndex, rooms: label, message: `bridge does not reach ${bId}'s inset walkable rect (dead-strip risk)` });
    }
  });

  // Grid-tiling check: no two rooms may overlap in both axes at once
  // (a genuine overlap, not a shared edge — touching is fine and expected).
  for (let i = 0; i < CAMPUS_ROOMS.length; i += 1) {
    for (let j = i + 1; j < CAMPUS_ROOMS.length; j += 1) {
      const a = roomBounds(CAMPUS_ROOMS[i]);
      const b = roomBounds(CAMPUS_ROOMS[j]);
      const overlapsX = a.x0 < b.x1 && b.x0 < a.x1;
      const overlapsZ = a.z0 < b.z1 && b.z0 < a.z1;
      if (overlapsX && overlapsZ) {
        issues.push({ doorIndex: -1, rooms: `${CAMPUS_ROOMS[i].id}<->${CAMPUS_ROOMS[j].id}`, message: "rooms overlap in both axes — invalid grid tiling" });
      }
    }
  }

  return issues;
}
