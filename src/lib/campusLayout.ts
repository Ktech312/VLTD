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
import { DOORWAY_WALL_GAP, MUSEUM_EYE_HEIGHT, STANDARD_ROOM_DEPTH, STANDARD_ROOM_HEIGHT, STANDARD_ROOM_WIDTH } from "./museumStandard";

// Full Museum Scale handoff (2026-09-06), Phase 1: "put shared values in one
// source of truth; the public campus and personal room must not drift apart
// again." WALL_HEIGHT/EYE_HEIGHT now read from museumStandard.ts (itself
// confirmed against VirtualGalleryRoom.tsx's own source) instead of each
// keeping its own hardcoded copy — same values as before, single owner now.
export const WALL_HEIGHT = STANDARD_ROOM_HEIGHT;
export const WALL_THICKNESS = 0.3;
export const DOOR_HEIGHT = 6.4;
export const DOOR_WIDTH = 3; // wider than the blueprint's 1.6-unit door marker (2.12 scaled) — a real walkthrough needs a walkable gap, not just a legend dot
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

// Next-pass handoff (2026-09-07), corrected per EK's review of 5820b85:
// resize ONLY POP_CULTURE to the exact standard module and stop for review
// before touching the other nominal-standard rooms (TCG/COLLECTION/SPORTS/
// CARDS) or deciding MISC. POP_CULTURE's depth grows from 12.6*S (16.72) to
// STANDARD_ROOM_DEPTH (26), which no longer fits before TCG at its old
// position — TCG and, in turn, MISC shift south by just enough to clear it
// (their own w/d are untouched, this is a position-only reflow). HUB and
// the south row (COLLECTION/SPORTS/CARDS) do NOT grow or move — an earlier
// version of this pass grew HUB's depth by ~22% to keep a straight-line
// door to MISC's new position, which EK correctly flagged as an unreported
// scope violation (the report claimed HUB only shifted position, which was
// false). HUB is restored to its exact pre-pass footprint; the MISC<->HUB
// and MISC<->COLLECTION doors below are recomputed against the real, much
// smaller overlap this creates, instead of growing rooms to preserve the
// old overlap.
export const CAMPUS_ROOMS: CampusRoom[] = [
  { id: "POP_CULTURE", label: "POP_CULTURE", tierLabel: "North Rotunda", x: 0, z: 0, w: STANDARD_ROOM_WIDTH, d: STANDARD_ROOM_DEPTH, floorColor: 0x3a2a1a, universes: ["POP_CULTURE"] },
  { id: "TCG", label: "TCG", tierLabel: "South Rotunda", x: 0 * S, z: 28, w: 15.4 * S, d: 12.6 * S, floorColor: 0x1a2a3a, universes: ["TCG"] },
  { id: "MISC", label: "misc", tierLabel: "Gallery A", x: 0 * S, z: 46.72, w: 15.4 * S, d: 26.6 * S, floorColor: 0x2a2a2a, universes: ["MISC"] },
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

/** Looks up the gapCenter of the door between two rooms, so callers (shelf
 * placement, room-shell doorway data) never have to re-type a value that
 * CAMPUS_DOORS already computes — see the door-derivation comment above
 * CAMPUS_DOORS for why typed-in duplicates of these values are a problem. */
export function doorGapCenter(a: CampusRoomId, b: CampusRoomId): number {
  const door = CAMPUS_DOORS.find(
    (d) => (d.rooms[0] === a && d.rooms[1] === b) || (d.rooms[0] === b && d.rooms[1] === a)
  );
  if (!door) throw new Error(`No door between ${a} and ${b}`);
  return door.gapCenter;
}

export type CampusDoor = {
  // Which wall the gap is cut into: 'x' = a wall running along the X axis
  // (rooms stacked along Z, gap position measured in X); 'z' = a wall
  // running along the Z axis (rooms side by side along X, gap in Z).
  wall: "x" | "z";
  at: number; // the wall's fixed coordinate (z for an 'x' wall, x for a 'z' wall)
  gapCenter: number; // position of the gap's center along the wall's free axis
  rooms: [CampusRoomId, CampusRoomId | null]; // second is null for the building entrance
  // Wall-gap width for this door, if wider than the campus default DOOR_WIDTH
  // — used for the two POP_CULTURE doors now that they install the real
  // doorwayKit.ts frame, which needs DOORWAY_WALL_GAP of clearance so its
  // posts don't clip the solid wall on either side.
  width?: number;
};

// EK's review of 5820b85: "Do not use manually typed values... when they can
// be derived from room bounds... These literals will drift again when the
// next room changes size." Every door below now computes its own gapCenter
// (and, where it means anything physical, its `at`) from the two rooms'
// live CAMPUS_ROOMS entries instead of a typed-in number, so resizing or
// repositioning a room automatically keeps every door touching it correct.
function overlapCenterAlongX(a: CampusRoom, b: CampusRoom): number {
  return (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
}
function overlapCenterAlongZ(a: CampusRoom, b: CampusRoom): number {
  return (Math.max(a.z, b.z) + Math.min(a.z + a.d, b.z + b.d)) / 2;
}
// The wall's fixed coordinate is documentation only (see doorNeighborSide,
// which infers the side from the rooms' relative positions, not from `at`)
// — still derived here, not typed, so it stays accurate as a comment value.
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
  { wall: "x", at: sharedBoundaryAlongZ(roomById("TCG"), roomById("MISC")), gapCenter: overlapCenterAlongX(roomById("TCG"), roomById("MISC")), rooms: ["TCG", "MISC"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("POP_CULTURE"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("POP_CULTURE"), roomById("HUB")), rooms: ["POP_CULTURE", "HUB"], width: DOORWAY_WALL_GAP },
  { wall: "z", at: sharedBoundaryAlongX(roomById("TCG"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("TCG"), roomById("HUB")), rooms: ["TCG", "HUB"] },
  // MISC<->HUB: HUB was NOT grown to keep the old, larger overlap this door
  // used to have — the overlap is now just the narrow band where MISC's
  // (shifted-south) range still reaches into HUB's (unchanged) z-range.
  { wall: "z", at: sharedBoundaryAlongX(roomById("MISC"), roomById("HUB")), gapCenter: overlapCenterAlongZ(roomById("MISC"), roomById("HUB")), rooms: ["MISC", "HUB"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("MISC"), roomById("COLLECTION")), gapCenter: overlapCenterAlongZ(roomById("MISC"), roomById("COLLECTION")), rooms: ["MISC", "COLLECTION"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("BUILT_BOTANY")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("BUILT_BOTANY")), rooms: ["HUB", "BUILT_BOTANY"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("GAMES")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("GAMES")), rooms: ["HUB", "GAMES"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("HUB"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongZ(roomById("HUB"), roomById("AUTOMOTIVE")), rooms: ["HUB", "AUTOMOTIVE"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("CARDS"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongZ(roomById("CARDS"), roomById("AUTOMOTIVE")), rooms: ["CARDS", "AUTOMOTIVE"] },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("COLLECTION")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("COLLECTION")), rooms: ["HUB", "COLLECTION"] },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("SPORTS")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("SPORTS")), rooms: ["HUB", "SPORTS"] },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("HUB"), roomById("CARDS")), gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("CARDS")), rooms: ["HUB", "CARDS"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("COLLECTION"), roomById("SPORTS")), gapCenter: overlapCenterAlongZ(roomById("COLLECTION"), roomById("SPORTS")), rooms: ["COLLECTION", "SPORTS"] },
  { wall: "z", at: sharedBoundaryAlongX(roomById("SPORTS"), roomById("CARDS")), gapCenter: overlapCenterAlongZ(roomById("SPORTS"), roomById("CARDS")), rooms: ["SPORTS", "CARDS"] },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("BUILT_BOTANY"), roomById("GAMES")), gapCenter: overlapCenterAlongX(roomById("BUILT_BOTANY"), roomById("GAMES")), rooms: ["BUILT_BOTANY", "GAMES"] },
  { wall: "x", at: sharedBoundaryAlongZ(roomById("GAMES"), roomById("AUTOMOTIVE")), gapCenter: overlapCenterAlongX(roomById("GAMES"), roomById("AUTOMOTIVE")), rooms: ["GAMES", "AUTOMOTIVE"] },

  // New wings (not in the original blueprint) — see CAMPUS_ROOMS above.
  { wall: "x", at: roomById("HUB").z, gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("SPOTLIGHT")), rooms: ["HUB", "SPOTLIGHT"] },
  { wall: "x", at: roomById("HUB").z, gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("STORE")), rooms: ["HUB", "STORE"] },
  // The Hub's entrance now opens onto a real walkable plaza instead of a void.
  { wall: "x", at: roomById("HUB").z, gapCenter: overlapCenterAlongX(roomById("HUB"), roomById("PLAZA")), rooms: ["HUB", "PLAZA"] },
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
        .map((door) => {
          const half = (door.width ?? DOOR_WIDTH) / 2;
          return { from: door.gapCenter - half, to: door.gapCenter + half };
        })
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

export type DoorBridge = { doorIndex: number; x0: number; x1: number; z0: number; z1: number };

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

  CAMPUS_DOORS.forEach((door, doorIndex) => {
    const [aId, bId] = door.rooms;
    if (!bId) return;
    const a = roomById(aId);
    const b = roomById(bId);
    const half = (door.width ?? DOOR_WIDTH) / 2;

    if (door.wall === "x") {
      const z0 = Math.min(a.z + a.d, b.z + b.d);
      const z1 = Math.max(a.z, b.z);
      bridges.push({
        doorIndex,
        x0: door.gapCenter - half,
        x1: door.gapCenter + half,
        z0: Math.min(z0, z1) - WALKABLE_MARGIN,
        z1: Math.max(z0, z1) + WALKABLE_MARGIN,
      });
    } else {
      const x0 = Math.min(a.x + a.w, b.x + b.w);
      const x1 = Math.max(a.x, b.x);
      bridges.push({
        doorIndex,
        x0: Math.min(x0, x1) - WALKABLE_MARGIN,
        x1: Math.max(x0, x1) + WALKABLE_MARGIN,
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

// EK's ask (2026-09-02), after watching bingebrowse.net's real behavior
// with her: it doesn't let you click anywhere on the floor — it has
// fixed, marked waypoints (small square floor markers that highlight on
// hover, "these little squares are helpful to know where you can go and
// look when you hover over them") that you click to glide between. A
// raycast-anywhere click-to-walk landed on unpredictable, sometimes
// awkward points; a curated waypoint always has a sensible spot to stand.
// One per room center plus one per door bridge — walking WASD/arrows
// still works freely in between, this only replaces "click empty floor."
export type CampusWaypoint = { id: string; x: number; z: number };

export function computeCampusWaypoints(): CampusWaypoint[] {
  const waypoints: CampusWaypoint[] = [];

  for (const room of CAMPUS_ROOMS) {
    if (!room.label) continue; // PLAZA has no label; a plaza waypoint is added separately below via its doors
    waypoints.push({ id: `room:${room.id}`, x: room.x + room.w / 2, z: room.z + room.d / 2 });
  }

  computeDoorBridges().forEach((bridge, index) => {
    waypoints.push({
      id: `door:${index}`,
      x: (bridge.x0 + bridge.x1) / 2,
      z: (bridge.z0 + bridge.z1) / 2,
    });
  });

  return waypoints;
}

// EK's review of 5820b85, required layout correction item 8: a validator
// that rejects a door unless (a) its gap center lies inside both rooms'
// shared wall span, (b) the two rooms are actually adjacent on the axis the
// door claims (not overlapping, not disjoint on the wrong axis), and (c)
// its bridge overlaps both rooms' own margin-inset walkable rects (the
// exact dead-strip failure mode a real live-tested run hit once already —
// see the computeDoorBridges comment above). Every campus door must pass
// this with zero issues before a deploy; run it as part of the pre-push
// check, the same way tsc/eslint/build already are.
export type DoorValidationIssue = { doorIndex: number; rooms: string; message: string };

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.max(a0, b0) < Math.min(a1, b1);
}

// The bridge/inset-rect check below wants "touching or overlapping," not
// strict interior overlap: a bridge is deliberately built to expand by
// exactly WALKABLE_MARGIN — the same margin the room's own inset rect is
// shrunk by — so a correctly-built bridge lands EXACTLY tangent to the
// room's inset edge, not strictly past it. isWalkable() itself uses
// inclusive >=/<= comparisons, so a tangent bridge already walks fine in
// the real app; using strict rangesOverlap here would flag every
// correctly-built door as broken (confirmed by running this validator and
// finding all 20 doors "failing," including ones that have worked in
// production for weeks).
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
    if (!bId) return; // building-entrance doors have no second room to check against

    const b = roomById(bId);
    const half = (door.width ?? DOOR_WIDTH) / 2;

    if (door.wall === "x") {
      if (rangesOverlap(a.z, a.z + a.d, b.z, b.z + b.d)) {
        issues.push({ doorIndex, rooms: label, message: "wall:x door but the two rooms overlap in Z instead of being stacked" });
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

  return issues;
}
