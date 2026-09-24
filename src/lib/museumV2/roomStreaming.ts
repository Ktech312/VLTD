// Museum Runtime V2 (2026-09-23) — room streaming.
// Given a "center" room, keeps exactly that room plus its direct
// adjacentRoomIds() neighbors built in the scene (their own shared walls
// included), and disposes anything outside that set — the actual mechanism
// behind the work order's "preload only rooms directly connected to
// POP_CULTURE... unload and dispose of rooms outside the current room and
// its direct neighbors."
//
// A room with a published bake (museum_room_meta.baked_asset_url) loads
// that .glb directly (assetCache.ts) instead of being built procedurally —
// in this first V2 pass that's POP_CULTURE only, per the work order's own
// "load only the published POP CULTURE room GLB initially... do not convert
// additional rooms during this pass." Every other room in the streamed
// neighborhood (TCG, HUB) is built with the exact same shared, already-
// merged-mesh builder functions the legacy live campus itself calls
// (buildRoomShell/buildRoomTrim/buildSharedWall, campusRoomBuilder.ts;
// addStyledRoomArmor, museumRoomArmor.ts) — real geometry, not a
// simplified stand-in, just scoped down to 3 rooms instead of the whole
// campus. HUB's own bespoke Grand Hall marble/compass/skylight enhancement
// (an inline, unexported ~300-line block in VltdMuseumCampus.tsx, not
// reusable without copying it wholesale) is deliberately NOT reproduced
// here — HUB gets its real dimensions, doors, walls, HUB_FINISH gold
// palette, ceiling, trim, and lighting through the same shared builder
// every room gets, just without that one room's extra custom pass. This is
// a disclosed simplification, not a hidden one — see the V2 verification
// report.
//
// Every room/wall segment this file builds goes into its own THREE.Group,
// added to the real scene, then handed to the shared builder functions IN
// PLACE OF that scene (cast — every builder call this file makes only ever
// calls generic Object3D methods like `.add()` on its `scene` parameter,
// confirmed by reading each one; none touch Scene-only state like
// background/fog). That group is the one and only thing tracked for
// disposal. This matters specifically because item placement
// (dynamicContent.ts -> campusRoomBuilder.ts's placeItemsAtSlots) loads
// each image asynchronously and adds its mesh only once that texture
// finishes downloading — a synchronous "scene.children before/after"
// diff (the technique Museum Builder's own handlePublish() uses to
// exclude walls from a bake) would miss every one of those meshes, since
// they don't exist yet at the moment such a diff would run. Routing them
// through a room-owned group instead means disposing that one group later
// always catches them, however late they land — and if a room is disposed
// before a still-in-flight image finishes loading, dynamicContent.ts's own
// isCancelled() check (backed by this file's per-room load epoch) stops
// that mesh from ever being added in the first place.
//
// Item/label content for TCG and HUB comes from dynamicContent.ts (live
// museum_room_items, fetched fresh — never baked). POP_CULTURE's own item
// content is whatever Museum Builder's Publish pipeline baked into its
// .glb — see loadBakedLikeRoom()'s own comment for why that pipeline
// (built independently of this work) doesn't cleanly separate "item mesh"
// from "furniture mesh," so V2 cannot safely strip and replace just the
// items without first changing that shared pipeline (out of scope here).

import * as THREE from "three";

import {
  adjacentRoomIds,
  computeCampusWallSegments,
  deriveRoomDoorways,
  roomById,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  type CampusRoomId,
  type CampusWallSegment,
} from "@/lib/campusLayout";
import {
  buildRoomShell,
  buildRoomTrim,
  buildSharedWall,
  createStyledRoomFinishes,
  createWallMaterial,
  HUB_FINISH,
  NEUTRAL_PREVIEW_FINISH,
  type ArtworkFrameStyle,
  type RoomFinish,
  type RoomLightGroups,
  type RoomModule,
  type StyledRoomFinishes,
} from "@/lib/campusRoomBuilder";
import { addStyledRoomArmor } from "@/lib/museumRoomArmor";
import { getItemsPerRoom, getRoomMeta, type MuseumRoomMeta } from "@/lib/museumCampusConfig";
import { loadBakedRoom, releaseBakedRoom } from "./assetCache";
import { disposeObject3D } from "./disposal";
import { placeDynamicRoomItems } from "./dynamicContent";

type StreamedRoom = {
  roomId: CampusRoomId;
  group: THREE.Group;
  lightGroups: RoomLightGroups;
  styledFinishes: StyledRoomFinishes | null;
  source: "baked" | "procedural";
  bakedUrl?: string;
};

export type CampusShellHandle = {
  scene: THREE.Scene;
  textureLoader: THREE.TextureLoader;
  wallSegments: CampusWallSegment[];
  loadedRooms: Map<CampusRoomId, StreamedRoom>;
  loadedWalls: Map<string, THREE.Group>;
  loadEpoch: Map<CampusRoomId, number>;
  itemsPerRoomDefault: Promise<number>;
  wallMaterialCache: Map<CampusRoomId, { material: THREE.MeshStandardMaterial; styled: StyledRoomFinishes | null }>;
  // Perf fix (2026-09-24, live-measured: a cold V2 load was taking 12-28s
  // against a 2-4s target). Root cause: getRoomMeta(roomId) is a real
  // Supabase round trip every call (no cache in museumCampusConfig.ts
  // itself), and this file was calling it 2-3 SEPARATE times per room
  // (once in resolveRoomWallMaterial, again in loadRoom, again in
  // buildProceduralRoom) — some of those serialized behind a sequential
  // for-await loop (syncWalls), not even run concurrently. metaCache
  // stores the in-flight/resolved promise per room so every call site
  // shares one fetch, and syncNeighborhood now warms every needed room's
  // entry in parallel up front before anything that depends on it runs.
  metaCache: Map<CampusRoomId, Promise<MuseumRoomMeta | null>>;
};

function wallSegmentKey(segment: CampusWallSegment): string {
  return `${segment.wall}:${segment.fixed}:${segment.from}:${segment.to}:${segment.roomA}:${segment.roomB ?? ""}`;
}

function isMuseumEntrance(segment: CampusWallSegment): boolean {
  return (
    (segment.roomA === "PLAZA" && segment.roomB === "HUB") ||
    (segment.roomA === "HUB" && segment.roomB === "PLAZA")
  );
}

function baseFinishForRoom(roomId: CampusRoomId): RoomFinish {
  return roomId === "HUB" ? HUB_FINISH : NEUTRAL_PREVIEW_FINISH;
}

function resolveFrameStyle(meta: MuseumRoomMeta | null): ArtworkFrameStyle {
  return meta?.frame_style === "gallery" || meta?.frame_style === "matted" ? meta.frame_style : "classic";
}

// Every builder call below only ever calls Object3D methods (`.add()`) on
// its "scene" parameter — see this file's header comment. Casting a
// room/segment-owned Group to THREE.Scene here is what lets that shared
// code stay completely unmodified while still landing everything it builds
// inside a group this file can dispose as one unit.
function asSceneTarget(group: THREE.Group): THREE.Scene {
  return group as unknown as THREE.Scene;
}

// Returns immediately — getItemsPerRoom() (one more Supabase round trip) is
// kicked off but not awaited here, so it runs concurrently with whatever
// the caller does next (syncNeighborhood's own meta warm-up) instead of
// serializing in front of it.
export function createCampusShell(scene: THREE.Scene, textureLoader: THREE.TextureLoader): CampusShellHandle {
  return {
    scene,
    textureLoader,
    wallSegments: computeCampusWallSegments(),
    loadedRooms: new Map(),
    loadedWalls: new Map(),
    loadEpoch: new Map(),
    itemsPerRoomDefault: getItemsPerRoom(),
    wallMaterialCache: new Map(),
    metaCache: new Map(),
  };
}

export function neighborhoodFor(roomId: CampusRoomId): CampusRoomId[] {
  return Array.from(new Set<CampusRoomId>([roomId, ...adjacentRoomIds(roomId)]));
}

// Shared across every call site in this file (syncWalls, loadRoom,
// buildProceduralRoom) — see CampusShellHandle.metaCache's own comment.
// Storing the PROMISE (not just the resolved value) means two callers
// racing to resolve the same not-yet-cached room both await the exact same
// single in-flight fetch instead of each starting their own.
function resolveMeta(handle: CampusShellHandle, roomId: CampusRoomId): Promise<MuseumRoomMeta | null> {
  let promise = handle.metaCache.get(roomId);
  if (!promise) {
    promise = getRoomMeta(roomId);
    handle.metaCache.set(roomId, promise);
  }
  return promise;
}

function resolveRoomWallMaterial(
  handle: CampusShellHandle,
  roomId: CampusRoomId,
  meta: MuseumRoomMeta | null
): { material: THREE.MeshStandardMaterial; styled: StyledRoomFinishes | null } {
  const cached = handle.wallMaterialCache.get(roomId);
  if (cached) return cached;
  const styled = createStyledRoomFinishes(meta?.room_style);
  const material = styled ? styled.wall : createWallMaterial(baseFinishForRoom(roomId));
  const entry = { material, styled };
  handle.wallMaterialCache.set(roomId, entry);
  return entry;
}

// Synchronous — every room this function touches must already have its
// resolveMeta() promise resolved (syncNeighborhood warms the whole needed
// set in parallel before calling this), so building every wall segment for
// a streaming cycle is now a single fast synchronous pass instead of a
// chain of per-segment network round trips.
function syncWalls(handle: CampusShellHandle, needed: Set<CampusRoomId>, metaByRoom: Map<CampusRoomId, MuseumRoomMeta | null>): void {
  const neededSegments = handle.wallSegments.filter(
    (s) => needed.has(s.roomA) || (s.roomB && needed.has(s.roomB))
  );
  const neededKeys = new Set(neededSegments.map(wallSegmentKey));

  for (const [key, group] of handle.loadedWalls) {
    if (!neededKeys.has(key)) {
      disposeObject3D(group);
      handle.loadedWalls.delete(key);
    }
  }

  const frameMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.frameColor, roughness: 0.65, metalness: 0.04 });
  for (const segment of neededSegments) {
    const key = wallSegmentKey(segment);
    if (handle.loadedWalls.has(key)) continue;
    const materialA = resolveRoomWallMaterial(handle, segment.roomA, metaByRoom.get(segment.roomA) ?? null).material;
    const materialB = segment.roomB ? resolveRoomWallMaterial(handle, segment.roomB, metaByRoom.get(segment.roomB) ?? null).material : null;
    const segGroup = new THREE.Group();
    segGroup.name = `v2-wall:${key}`;
    handle.scene.add(segGroup);
    buildSharedWall(asSceneTarget(segGroup), segment, materialA, materialB, frameMaterial, {
      wallHeight: WALL_HEIGHT,
      wallThickness: WALL_THICKNESS,
      style: isMuseumEntrance(segment) ? "entrance" : "ordinary",
    });
    handle.loadedWalls.set(key, segGroup);
  }
}

function makeLightGroups(scene: THREE.Scene, roomId: CampusRoomId): RoomLightGroups {
  const full = new THREE.Group();
  full.name = `v2-room-full:${roomId}`;
  scene.add(full);
  const preview = new THREE.Group();
  preview.name = `v2-room-preview:${roomId}`;
  scene.add(preview);
  return { full, preview };
}

// POP_CULTURE (or any room with a baked_asset_url): the published .glb
// already contains this room's real floor/ceiling/trim/furniture/style at
// its real campus world coordinates (Museum Builder builds its preview
// scene from the same roomById() position the live campus uses) — added to
// the scene as-is, no repositioning. Its own boundary walls are NOT in the
// bake (Museum Builder's handlePublish() hides wallsGroupRef before
// exporting — see museumRoomBake.ts) and come from syncWalls() above, same
// as every other room. Its item content is whatever was placed in Museum
// Builder's preview at the moment it was last Published, since the bake
// has no marker distinguishing an item mesh from a furniture mesh for V2
// to strip and re-place dynamically.
async function loadBakedLikeRoom(handle: CampusShellHandle, roomId: CampusRoomId, bakedUrl: string): Promise<StreamedRoom | null> {
  const epoch = handle.loadEpoch.get(roomId) ?? 0;
  const loaded = await loadBakedRoom(bakedUrl);
  if ((handle.loadEpoch.get(roomId) ?? 0) !== epoch) {
    disposeObject3D(loaded);
    releaseBakedRoom(bakedUrl);
    return null;
  }
  const group = new THREE.Group();
  group.name = `v2-room-baked:${roomId}`;
  group.add(loaded);
  handle.scene.add(group);
  const lightGroups = makeLightGroups(handle.scene, roomId);
  return { roomId, group, lightGroups, styledFinishes: null, source: "baked", bakedUrl };
}

async function buildProceduralRoom(handle: CampusShellHandle, roomId: CampusRoomId, meta: MuseumRoomMeta | null): Promise<StreamedRoom | null> {
  const epoch = handle.loadEpoch.get(roomId) ?? 0;
  const isCancelled = () => (handle.loadEpoch.get(roomId) ?? 0) !== epoch;
  if (isCancelled()) return null;

  const group = new THREE.Group();
  group.name = `v2-room-procedural:${roomId}`;
  handle.scene.add(group);
  const lightGroups = makeLightGroups(handle.scene, roomId);

  const styled = createStyledRoomFinishes(meta?.room_style);
  const doorways = deriveRoomDoorways(roomId);
  const roomModule: RoomModule = {
    room: roomById(roomId),
    doorways,
    wallHeight: WALL_HEIGHT,
    wallThickness: WALL_THICKNESS,
    eyeHeight: EYE_HEIGHT,
    finish: baseFinishForRoom(roomId),
  };

  buildRoomShell(asSceneTarget(group), roomModule, styled);
  buildRoomTrim(asSceneTarget(group), roomById(roomId), handle.wallSegments, baseFinishForRoom(roomId), WALL_HEIGHT, WALL_THICKNESS, true, styled);

  const roomSegments = handle.wallSegments.filter((s) => s.roomA === roomId || s.roomB === roomId);
  addStyledRoomArmor(
    asSceneTarget(group),
    roomById(roomId),
    roomSegments,
    WALL_HEIGHT,
    meta?.room_style === "vault" || meta?.room_style === "loft" ? meta.room_style : null,
    WALL_THICKNESS
  );

  if (styled) {
    const anchor = new THREE.Group();
    const room = roomById(roomId);
    anchor.position.set(room.x + room.w / 2, 0, room.z + room.d / 2);
    lightGroups.full.add(anchor);
    styled.addLighting(anchor);
  }

  const itemCapacity = meta?.item_capacity ?? (await handle.itemsPerRoomDefault);
  await placeDynamicRoomItems(
    asSceneTarget(group),
    handle.textureLoader,
    lightGroups,
    roomId,
    WALL_THICKNESS,
    EYE_HEIGHT,
    itemCapacity,
    isCancelled,
    resolveFrameStyle(meta)
  );

  if (isCancelled()) {
    disposeObject3D(group);
    disposeObject3D(lightGroups.full);
    disposeObject3D(lightGroups.preview);
    styled?.dispose();
    return null;
  }

  return { roomId, group, lightGroups, styledFinishes: styled, source: "procedural" };
}

async function loadRoom(handle: CampusShellHandle, roomId: CampusRoomId, meta: MuseumRoomMeta | null): Promise<void> {
  handle.loadEpoch.set(roomId, (handle.loadEpoch.get(roomId) ?? 0) + 1);
  const streamed = meta?.baked_asset_url
    ? await loadBakedLikeRoom(handle, roomId, meta.baked_asset_url)
    : await buildProceduralRoom(handle, roomId, meta);
  if (streamed) handle.loadedRooms.set(roomId, streamed);
}

function disposeStreamedRoom(handle: CampusShellHandle, roomId: CampusRoomId): void {
  handle.loadEpoch.set(roomId, (handle.loadEpoch.get(roomId) ?? 0) + 1);
  const room = handle.loadedRooms.get(roomId);
  if (!room) return;
  disposeObject3D(room.group);
  disposeObject3D(room.lightGroups.full);
  disposeObject3D(room.lightGroups.preview);
  room.styledFinishes?.dispose();
  if (room.bakedUrl) releaseBakedRoom(room.bakedUrl);
  handle.loadedRooms.delete(roomId);
  // Wall material cache entries are intentionally NOT cleared here — a
  // boundary wall this room shares with a still-loaded neighbor keeps using
  // that exact material instance until syncWalls() itself removes that
  // wall segment. Cleared campus-wide only on full teardown, below.
}

/** Brings the loaded scene in line with `centerRoomId`'s neighborhood
 * (itself + adjacentRoomIds()) — disposes anything outside it, builds
 * anything missing. Safe to call repeatedly as the visitor moves; an
 * already-current neighborhood is a fast no-op for every already-loaded
 * room (no re-fetch, no re-build). */
export async function syncNeighborhood(handle: CampusShellHandle, centerRoomId: CampusRoomId): Promise<void> {
  const needed = new Set(neighborhoodFor(centerRoomId));

  for (const roomId of Array.from(handle.loadedRooms.keys())) {
    if (!needed.has(roomId)) disposeStreamedRoom(handle, roomId);
  }

  // Warm every needed room's meta in parallel up front — this is the one
  // round trip per room the whole streaming cycle pays; syncWalls and
  // loadRoom below both read from the now-resolved metaCache instead of
  // fetching again.
  const neededList = Array.from(needed);
  const metaEntries = await Promise.all(neededList.map(async (id) => [id, await resolveMeta(handle, id)] as const));
  const metaByRoom = new Map(metaEntries);

  syncWalls(handle, needed, metaByRoom);

  const toLoad = neededList.filter((id) => !handle.loadedRooms.has(id));
  await Promise.all(toLoad.map((id) => loadRoom(handle, id, metaByRoom.get(id) ?? null)));
}

/** Full teardown — call on unmount. */
export function disposeCampusShell(handle: CampusShellHandle): void {
  for (const roomId of Array.from(handle.loadedRooms.keys())) disposeStreamedRoom(handle, roomId);
  for (const group of handle.loadedWalls.values()) disposeObject3D(group);
  handle.loadedWalls.clear();
  for (const entry of handle.wallMaterialCache.values()) entry.styled?.dispose();
  handle.wallMaterialCache.clear();
}
