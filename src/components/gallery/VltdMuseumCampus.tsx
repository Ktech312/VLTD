"use client";

// First functional pass at the VLTD Museum public campus — the separate
// project from personal exhibition rooms (see the Museum Campus Blueprint
// artifact and src/lib/campusLayout.ts, which is this component's only
// source of geometry). This is a viewer, not a builder: no drag/drop, no
// wallpaper picker, no draft persistence — just a walkable version of the
// blueprint's 10-room, 18-door floor plan, populated with the signed-in
// user's own vault items as placeholder content until there's a real
// cross-user "top items" feed to show instead.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  CAMPUS_DOORS,
  CAMPUS_ROOMS,
  CAMPUS_SPAWN,
  EDITABLE_ROOM_IDS,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  adjacentRoomIds,
  assignSwingRoomUniverses,
  buildWalkableAreas,
  computeCampusWaypoints,
  computeCampusWallSegments,
  computeDoorBridges,
  deriveRoomDoorways,
  doorGapCenter,
  doorWallWidth,
  isWalkable,
  roomBounds,
  roomById,
  splitSegmentForDoor,
  type CampusWaypoint,
  type CampusRoom,
  type CampusRoomId,
} from "@/lib/campusLayout";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import {
  getActiveSpotlightPrograms,
  getAllRoomMeta,
  getEnabledRoomItems,
  getEnabledStoreItems,
  getItemsPerRoom,
  type MuseumRoomItem,
} from "@/lib/museumCampusConfig";
import {
  DOORWAY_NO_DISPLAY_HALF_WIDTH,
  MUSEUM_CAMERA_FOV,
  MUSEUM_PITCH_LIMIT,
  MUSEUM_WALK_SPEED,
  MUSEUM_WALK_SPEED_SLOW,
} from "@/lib/museumStandard";
import {
  buildNeutralShell,
  buildRoomShell,
  buildRoomTrim,
  buildSharedWall,
  computeRoomCaseSlots,
  computeRoomPlacementSlots,
  computeRoomShelfSlots,
  computeRoomShelfSpans,
  computeUsableWallSpans,
  createStyledRoomFinishes,
  createWallMaterial,
  hangCompactLabel,
  HUB_FINISH,
  NEUTRAL_LEGACY_FINISH,
  NEUTRAL_PREVIEW_FINISH,
  placeArtwork,
  placeItemsAtSlots,
  retitleDestinationSign,
  type GalleryFinishStyle,
  type PlacementSlot,
  type RoomFinish,
  type RoomLightGroups,
  type RoomModule,
  type StyledRoomFinishes,
} from "@/lib/campusRoomBuilder";
import { addStyledRoomArmor } from "@/lib/museumRoomArmor";
import { buildDisplayCase, buildShelfBoard, createShelfMaterial, placeItemsInCases } from "@/lib/museumRoomFurniture";
import {
  aimCamera,
  applyDrag,
  buildKeyboardMoveDirection,
  easeTowardTargets,
  facingDirection,
  WHEEL_STEP,
} from "@/lib/visitorController";

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
}

function itemUniverse(item: VaultItem) {
  const raw = typeof item.universe === "string" ? item.universe.trim().toUpperCase() : "";
  return isUniverseKey(raw) ? raw : null;
}

function hasUsableImage(item: VaultItem) {
  return Boolean(getPrimaryImageUrl(item));
}

// Round-robins items across their universes so one dominant category can't
// crowd out the rest of a fill-in pass (used only for COLLECTION's "whatever
// doesn't have a slot yet" tier below).
function balancedByUniverse(items: VaultItem[]): VaultItem[] {
  const groups = new Map<string, VaultItem[]>();
  for (const item of items) {
    const key = itemUniverse(item) ?? "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  const buckets = [...groups.values()];
  const out: VaultItem[] = [];
  for (let i = 0; out.length < items.length; i++) {
    let addedAny = false;
    for (const bucket of buckets) {
      if (i < bucket.length) {
        out.push(bucket[i]);
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }
  return out;
}

// COLLECTION has no dedicated universe of its own — it's the campus's
// general room for whatever doesn't have one. Priority order: uncategorized
// real items first (they have nowhere else to go), then COLLECTION's
// assigned swing universe (caller has already dropped it if that universe's
// real count is zero — assignSwingRoomUniverses() always names one even
// when every swing count is tied), then a balanced fill from everything
// else. Dedupes by item id, never counts an image-less item toward
// itemsPerRoom, and never substitutes seed/demo art.
function selectCollectionItems(
  allItems: VaultItem[],
  collectionUniverses: UniverseKey[],
  itemsPerRoom: number
): VaultItem[] {
  const seen = new Set<string>();
  const picked: VaultItem[] = [];
  function addAll(candidates: VaultItem[]) {
    for (const item of candidates) {
      if (picked.length >= itemsPerRoom) return;
      if (seen.has(item.id) || !hasUsableImage(item)) continue;
      seen.add(item.id);
      picked.push(item);
    }
  }
  addAll(allItems.filter((item) => itemUniverse(item) === null));
  if (picked.length < itemsPerRoom) {
    addAll(
      allItems.filter((item) => {
        const universe = itemUniverse(item);
        return universe !== null && collectionUniverses.includes(universe);
      })
    );
  }
  if (picked.length < itemsPerRoom) {
    addAll(balancedByUniverse(allItems.filter((item) => itemUniverse(item) !== null)));
  }
  return picked;
}

// makeLabelSprite() (a 9x2.25-unit room-center billboard sprite) is removed
// — Overnight Polish pass (2026-09-09): "Eliminate obsolete room-center
// title sprites and other duplicate wayfinding that appears through
// several rooms" and "The production view contains a distance-invariant
// 'VLTD Museum' label that appears to float through doorways." Investigated
// live: it was this sprite, called for every legacy room including HUB
// (whose own `label` IS "VLTD Museum") — a large always-camera-facing
// billboard near the ceiling read as "floating" through long sightlines
// regardless of how far away it was. Doorway destination signs (built into
// each shared wall) plus the top-of-screen room-label overlay now cover
// wayfinding without a second, competing, oversized in-scene label.

function roomCenter(room: CampusRoom) {
  return { x: room.x + room.w / 2, z: room.z + room.d / 2 };
}

// Shared Museum Room Editor pass (2026-09-12): merges a room's curated
// museum_room_items into its full set of generated placement slots — an
// item explicitly pinned to a slot (slot_id) always keeps that exact
// position; anything else (older rows saved before this pass, or simply
// more curated items than assigned slots) auto-fills whatever slots are
// still empty, in slot order. This is what makes "the automatic layout is
// the default arrangement, and the editor lets an admin override individual
// positions on top of it" literally true — both this function and the
// room editor overlay below read the exact same slot list.
function buildSlotAssignments(
  slots: PlacementSlot[],
  items: MuseumRoomItem[]
): Map<string, { url: string; label?: string }> {
  const validIds = new Set(slots.map((s) => s.id));
  const bySlot = new Map<string, { url: string; label?: string }>();
  const unassigned: MuseumRoomItem[] = [];
  for (const item of items) {
    if (item.slot_id && validIds.has(item.slot_id) && !bySlot.has(item.slot_id)) {
      bySlot.set(item.slot_id, { url: item.image_url, label: item.title });
    } else {
      unassigned.push(item);
    }
  }
  let cursor = 0;
  for (const slot of slots) {
    if (bySlot.has(slot.id)) continue;
    if (cursor >= unassigned.length) break;
    bySlot.set(slot.id, { url: unassigned[cursor].image_url, label: unassigned[cursor].title });
    cursor += 1;
  }
  return bySlot;
}

// The 9 rooms EDITABLE_ROOM_IDS lists; SPORTS alone keeps its own
// hand-tuned "south wall is the focal wall" weighting (see
// computeRoomPlacementSlots' focalWall param) — its south wall is the one
// side with no doorway, exactly the case that rule was built for. No other
// current room has an equivalent single doorless wall worth favoring yet.
function focalWallFor(roomId: CampusRoomId) {
  return roomId === "SPORTS" ? ("south" as const) : undefined;
}

// POP_CULTURE Vault-parity pass (2026-09-13): validates a raw
// museum_room_meta.room_style string against createStyledRoomFinishes()'s
// own recognized set, so museumRoomArmor.ts's addStyledRoomArmor() (which
// takes the real GalleryFinishStyle union, not a bare string) can be called
// with the same value the style-patch loop below already resolves via
// createStyledRoomFinishes() — one validated value, two consumers, instead
// of a second, separately-typed guess.
function resolveGalleryFinishStyle(raw: string | null | undefined): GalleryFinishStyle | null {
  return raw === "whitebox" || raw === "vault" || raw === "arcade" || raw === "loft" ? raw : null;
}

// POP_CULTURE Vault-parity pass (2026-09-13): the personal Gallery Vault's
// own real case count (CABINET_SPOTS, src/lib/galleryRoomSlots.ts) — the
// "5-case feel" a room with a saved style should default toward ONLY when
// its own museum_room_meta.case_capacity has never actually been set
// (column genuinely null/undefined). A stored 0 still means "cases off for
// this room," unchanged from 20260912_museum_room_capacity_and_background
// .sql's own documented meaning for that column — this default never
// overrides an explicit choice, it only fills in a true gap.
const DEFAULT_CASE_CAPACITY_FOR_STYLED_ROOM = 5;

export default function VltdMuseumCampus() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roomLabelRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // EK's ask (2026-09-12): clicking a room on the Gallery Map should spawn
  // in that room, not always at the entrance. This only changes WHERE the
  // visitor starts standing — CAMPUS_SPAWN itself, room geometry, doors,
  // movement, and every other accepted behavior are untouched. Falls back
  // to the normal PLAZA entrance spawn for a plain /museum/vltd visit or an
  // unrecognized ?room= value.
  const searchParams = useSearchParams();
  // Shared Museum Room Editor consolidation pass (2026-09-12): the old
  // `?edit=<roomId>` full-page editor mode is retired — "Add Items / Edit
  // Room" now opens an in-page popup (RoomEditorModal.tsx ->
  // MuseumRoomPopup.tsx) showing just that one room, instead of navigating
  // here into the whole walkable campus. `?room=` (plain spawn-in-room, no
  // editing) is untouched.
  const requestedRoomId = searchParams.get("room") ?? undefined;
  const spawnRoom = requestedRoomId ? CAMPUS_ROOMS.find((room) => room.id === requestedRoomId) : undefined;
  const spawn = spawnRoom
    ? { x: spawnRoom.x + spawnRoom.w / 2, z: spawnRoom.z + spawnRoom.d / 2, yaw: CAMPUS_SPAWN.yaw }
    : CAMPUS_SPAWN;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Visual Overnight Pass (2026-09-10): a flat scene.background color read
    // as a solid dark panel wherever it was actually visible — most
    // noticeably standing in HUB facing the PLAZA entrance, since PLAZA is
    // the one intentionally open-air room (no ceiling): with nothing above
    // its floor but this flat fill, the "open forecourt" reads as a wall of
    // solid navy blocking the doorway rather than open sky. A cheap gradient
    // texture (no skybox mesh, no new geometry) gives it atmospheric depth
    // instead — the bottom stop matches the existing fog color exactly so
    // distant geometry still fades seamlessly into it.
    function createSkyGradientTexture(): THREE.CanvasTexture {
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, "#1c3352");
      gradient.addColorStop(0.55, "#102240");
      gradient.addColorStop(1, "#081527");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 8, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const scene = new THREE.Scene();
    scene.background = createSkyGradientTexture();
    scene.fog = new THREE.Fog(0x081527, 40, 140);

    // Size off window.innerWidth/Height, not mount.clientWidth/Height: a
    // transformed ancestor (framer-motion page transitions, etc.) can make
    // `fixed inset-0` + `h-full` resolve to a 0-height box, which silently
    // zeroes the canvas and renders nothing with no console error.
    //
    // FOV matches the single room's own camera exactly (47deg, not a
    // wider guess) — EK's ask (2026-09-02): "carry over all the rules we
    // made from the first room." A wider FOV was making identically-
    // dimensioned rooms look and feel smaller (classic wide-angle
    // distortion) and made the same drag-look sensitivity feel faster
    // than intended.
    const camera = new THREE.PerspectiveCamera(MUSEUM_CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.rotation.order = "YXZ";
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbcd6ef, 0x12294a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.6);
    sun.position.set(40, 60, 20);
    scene.add(sun);

    // Overnight Polish pass (2026-09-09), neutral architectural finish:
    // "make the campus look like a coherent, intentionally unfinished
    // museum shell rather than a collection of gray boxes... a real
    // ceiling plane in every enclosed room... one coherent neutral floor
    // family... no checkerboard developer-looking floor." Replaces the old
    // per-room checkerboard-floor-only loop (no ceiling at all, hence the
    // black voids visible through every legacy doorway) with the same
    // stone-floor/ceiling/trim technique the 3 converted rooms already use
    // — buildNeutralShell() below, campus-wide, each room keeping its own
    // existing floorColor as a subtle tint rather than a bold checker tone.
    // HUB keeps its own already-accepted gold finish (HUB_FINISH) instead
    // of the shared neutral one — "different rooms may retain their
    // existing accepted styles" — but goes through the exact same builder
    // so it also gets a real ceiling and restrained trim instead of its own
    // bespoke gap. PLAZA (the one intentionally open-air room) skips the
    // ceiling to keep its open-sky forecourt character.
    // Live-verified fix: each room's floorColor was picked years ago as a
    // CHECKERBOARD base tone (dark tiles alternating with slightly lighter
    // ones), which reads fine as a two-tone pattern but goes near-black
    // when reused as a flat multiplicative tint over the new stone floor
    // texture — confirmed live in MISC (floorColor 0x2a2a2a, ~16% gray).
    // Lightened 65% toward white here so every room keeps a whisper of its
    // own color identity without losing the floor to darkness.
    function lightenedFloorTint(hex: number): number {
      return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.65).getHex();
    }
    // Material Quality Parity pass (2026-09-12): every legacy room now gets
    // its own real light rig too (buildNeutralShell's new optional `lights`
    // group), not just the 3 converted rooms — EK's material/lighting-
    // quality ask explicitly supersedes the 2026-09-09 "no dynamic light rig
    // for unconverted rooms" decision (see buildNeutralShell's own comment).
    // Each room's rig lands in its own full/preview group, same shape as
    // every converted room's RoomLightGroups, collected here so the
    // roomLightGroups dictionary below (and ensureRoomLightGroups) can wire
    // them into the SAME two-tier occupancy activation system instead of
    // leaving ~10 more rooms' fixture rigs always on regardless of where the
    // visitor actually is.
    // SPORTS already gets its own dedicated full/preview light group further
    // below (so its picture lights join the two-tier occupancy activation
    // system) — declared here instead, ahead of the legacy shell loop, so
    // this SAME pair of groups can also receive SPORTS's own new ambient
    // shell-light rig immediately below, rather than that rig ending up in a
    // second, never-toggled group of its own.
    const sportsLightsFull = new THREE.Group();
    sportsLightsFull.name = "room-full:SPORTS";
    scene.add(sportsLightsFull);
    const sportsLightsPreview = new THREE.Group();
    sportsLightsPreview.name = "room-preview:SPORTS";
    scene.add(sportsLightsPreview);
    const sportsLights: RoomLightGroups = { full: sportsLightsFull, preview: sportsLightsPreview };

    // Real Gallery Environments pass (2026-09-12): tracks the real material
    // instances actually built for each room's own wall/floor/ceiling/
    // baseboard/rail meshes, and the group holding its generic ceiling-
    // fixture meshes — so that once a room's saved museum_room_meta.
    // room_style loads (async, see populateDynamicContent below),
    // createGalleryFinishes(style)'s own real materials/light rig can be
    // patched onto this SAME room, in place, with zero effect on any other
    // room. Only EDITABLE_ROOM_IDS ever get entries read out of this map;
    // every room's shell still builds and renders its normal default finish
    // synchronously first, exactly as before, so there's no wait on network
    // before the campus first paints.
    type RoomShellMaterialsEntry = {
      wall?: THREE.MeshStandardMaterial;
      floor?: THREE.MeshStandardMaterial;
      ceiling?: THREE.MeshStandardMaterial;
      baseboard?: THREE.MeshStandardMaterial;
      rail?: THREE.MeshStandardMaterial | null;
      shellFixtures?: THREE.Group;
    };
    const roomShellMaterialsByRoomId = new Map<CampusRoomId, RoomShellMaterialsEntry>();
    function shellEntry(id: CampusRoomId): RoomShellMaterialsEntry {
      const existing = roomShellMaterialsByRoomId.get(id);
      if (existing) return existing;
      const created: RoomShellMaterialsEntry = {};
      roomShellMaterialsByRoomId.set(id, created);
      return created;
    }
    // Every createGalleryFinishes() instance built below (one per styled
    // room) needs its own `.dispose()` call on unmount — collected here so
    // the cleanup function at the bottom of this effect can release them
    // without needing to know which rooms ended up styled.
    const styledFinishesForDisposal: StyledRoomFinishes[] = [];

    // POP_CULTURE Vault-parity pass (2026-09-13): the display-case/shelf
    // PlacementSlots actually built for each EDITABLE_ROOM_IDS room (below,
    // alongside the style-patch loop) — the curated-item placement pass
    // further down needs this exact same slot list (not a second,
    // independently recomputed one) so an item's slot_id assignment and its
    // physical case/shelf furniture can never disagree about where a slot
    // actually sits.
    const roomFurnitureSlotsByRoomId = new Map<CampusRoomId, { caseSlots: PlacementSlot[]; shelfSlots: PlacementSlot[] }>();

    const legacyLightGroups = new Map<CampusRoomId, RoomLightGroups>();
    for (const room of CAMPUS_ROOMS) {
      if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION") continue;
      const finish: RoomFinish = room.id === "HUB"
        ? HUB_FINISH
        : { ...NEUTRAL_LEGACY_FINISH, floorTintColor: lightenedFloorTint(room.floorColor) };
      let full: THREE.Group;
      let preview: THREE.Group;
      if (room.id === "SPORTS") {
        // Reuse SPORTS's own pre-existing dedicated group (declared just
        // above) instead of creating a second, orphaned one — its ambient
        // shell lighting and its curated picture lights end up in the exact
        // same group, toggled together by the one occupancy system.
        full = sportsLightsFull;
        preview = sportsLightsPreview;
      } else {
        full = new THREE.Group();
        full.name = `room-full:${room.id}`;
        scene.add(full);
        preview = new THREE.Group();
        preview.name = `room-preview:${room.id}`;
        scene.add(preview);
        legacyLightGroups.set(room.id, { full, preview });
      }
      const shell = buildNeutralShell(scene, room, WALL_HEIGHT, finish, room.id !== "PLAZA", full);
      shellEntry(room.id).floor = shell.floorMaterial;
      shellEntry(room.id).ceiling = shell.ceilingMaterial;
      shellEntry(room.id).shellFixtures = shell.shellFixtures;
    }

    // Shared-Wall Grid Plan (2026-09-08, replacing the rejected connection-
    // owned vestibule architecture): every room now sits on an exact module
    // grid, so adjacent rooms share the identical boundary coordinate —
    // computeCampusWallSegments() returns exactly ONE physical wall per
    // shared boundary (not one per room, not a vestibule spanning a
    // coordinate gap that no longer exists). buildSharedWall() below builds
    // that one wall, finished on each face with whichever room's material
    // faces it, and — wherever CAMPUS_DOORS calls for it — cuts one opening
    // with one casing, contained entirely within the wall's own thickness.
    //
    // Shared Museum Room Editor pass (2026-09-12), style-application fix:
    // wall materials USED TO be cached by FINISH IDENTITY (one shared
    // Material per RoomFinish object — NEUTRAL_LEGACY_FINISH, HUB_FINISH,
    // NEUTRAL_PREVIEW_FINISH), a real EK-approved memory optimization once
    // EK's world-space wall-panel fix (2026-09-10) made createWallMaterial()
    // byte-identical across any two rooms sharing a finish. That's exactly
    // why a saved per-room style couldn't be wired in without breaking
    // "changing SPORTS must not change COLLECTION/CARDS/HUB": recoloring the
    // shared instance would have recolored every OTHER room still pointing
    // at that same object. Keyed per ROOM ID instead — every room gets its
    // own Material/texture instance (same createWallMaterial() call, same
    // visual result, just not object-shared) — trades a few extra small
    // canvas textures (well under a dozen rooms total) for the per-room
    // independence correctness now requires. See the room_style patch loop
    // inside populateDynamicContent() below for where a saved
    // createGalleryFinishes(style) actually gets applied onto this room's
    // own material instances (via roomShellMaterialsByRoomId, declared
    // above).
    const wallMaterialByRoomId = new Map<CampusRoomId, THREE.MeshStandardMaterial>();
    function baseFinishForRoom(roomId: CampusRoomId): RoomFinish {
      if (roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION") return NEUTRAL_PREVIEW_FINISH;
      if (roomId === "HUB") return HUB_FINISH;
      return NEUTRAL_LEGACY_FINISH;
    }
    // Grand Hall custom design (2026-09-13): every new PBR texture this pass
    // loads (walls here, plus floor/border/ceiling further below in the
    // Grand Hall enhancement block) shares this one loader — the exact same
    // THREE.TextureLoader + colorSpace + renderer.capabilities.
    // getMaxAnisotropy() pattern the existing VLTD floor-seal texture already
    // uses, just factored out since this pass loads many more textures than
    // that one seal did.
    function loadGrandHallTexture(file: string, colorSpace: THREE.ColorSpace, repeatX: number, repeatY: number): THREE.Texture {
      const texture = new THREE.TextureLoader().load(`/museum/grand-hall/${file}`);
      texture.colorSpace = colorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    }
    // Same basecolor/normal/roughness recipe for every Grand Hall stone
    // finish (docs/GRAND-HALL-VISUAL-ASSETS.md) — roughness stays a 1.0
    // passthrough so each surface's own roughness MAP (already tuned near
    // that doc's target ranges, confirmed by inspecting the actual PNGs)
    // drives the real value, rather than guessing a second scalar on top of
    // an unknown map.
    function buildStoneMaterial(prefix: string, repeatX: number, repeatY: number, metalness: number, normalScale: number): THREE.MeshStandardMaterial {
      const map = loadGrandHallTexture(`${prefix}-basecolor.png`, THREE.SRGBColorSpace, repeatX, repeatY);
      const normalMap = loadGrandHallTexture(`${prefix}-normal.png`, THREE.NoColorSpace, repeatX, repeatY);
      const roughnessMap = loadGrandHallTexture(`${prefix}-roughness.png`, THREE.NoColorSpace, repeatX, repeatY);
      return new THREE.MeshStandardMaterial({
        map, normalMap, roughnessMap, metalness, roughness: 1,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        // Root-cause fix (live check, second pass): HUB is far larger
        // (63x78) than every other room the scene's shared `THREE.Fog(...,
        // 40, 140)` was tuned against (every legacy/converted room's own
        // longest dimension is well under that 40-unit near-fog distance,
        // so they never visibly fog) — HUB's far walls/coffers/floor
        // routinely sit beyond 40 units from a normal viewing position and
        // were reading washed toward the fog's own dark navy color
        // (0x081527) regardless of any material or light tuning, which is
        // why the earlier wall-wash-light fix produced no visible change.
        // Exempting only these new Grand Hall stone materials from fog
        // (every other room's fog behavior, and the scene-wide Fog object
        // itself, are completely untouched) is the correct fix, not another
        // blind lighting guess.
        fog: false,
      });
    }
    function roomWallMaterial(roomId: CampusRoomId): THREE.MeshStandardMaterial {
      const cached = wallMaterialByRoomId.get(roomId);
      if (cached) return cached;
      // Grand Hall custom design: HUB's wall gets the real ivory-limestone
      // PBR texture instead of createWallMaterial()'s flat-tinted canvas
      // panel — every other room's material is completely untouched, still
      // built by createWallMaterial(baseFinishForRoom(roomId)) exactly as
      // before. buildSharedWall() already rescales whatever material it's
      // given per wall box via scaleWallPanelU (campusRoomBuilder.ts, keyed
      // off PANEL_WIDTH, not this material's own .repeat), so leaving repeat
      // at 1x1 here and letting that existing mechanism govern the physical
      // tiling is the same convention createWallMaterial's own canvas
      // texture already relies on, just pointed at a photographic texture.
      const material = roomId === "HUB"
        ? buildStoneMaterial("ivory-limestone", 1, 1, 0.02, 0.4)
        : createWallMaterial(baseFinishForRoom(roomId));
      wallMaterialByRoomId.set(roomId, material);
      shellEntry(roomId).wall = material;
      return material;
    }

    // One shared casing material for every door — "share frame geometry and
    // materials rather than cloning unique resources per door." Campus doors
    // build their own thin casing in campusRoomBuilder.ts's buildSharedWall()
    // now (2026-09-08 doorway redesign); doorwayKit.ts's thicker frame is
    // untouched and still serves the protected personal room/prototype.
    const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.frameColor, roughness: 0.65, metalness: 0.04 });

    // EK's doorway-refinement pass (2026-09-09): the campus has exactly one
    // "museum entrance" — PLAZA<->HUB — which gets its own restrained,
    // wider casing + integrated "VLTD MUSEUM" header instead of the
    // ordinary per-room destination-sign kit every other connection uses.
    function isMuseumEntrance(segment: { roomA: CampusRoomId; roomB: CampusRoomId | null }): boolean {
      return (
        (segment.roomA === "PLAZA" && segment.roomB === "HUB") ||
        (segment.roomA === "HUB" && segment.roomB === "PLAZA")
      );
    }

    const wallSegments = computeCampusWallSegments();
    for (const segment of wallSegments) {
      const materialA = roomWallMaterial(segment.roomA);
      const materialB = segment.roomB ? roomWallMaterial(segment.roomB) : null;
      buildSharedWall(scene, segment, materialA, materialB, doorFrameMaterial, {
        wallHeight: WALL_HEIGHT,
        wallThickness: WALL_THICKNESS,
        style: isMuseumEntrance(segment) ? "entrance" : "ordinary",
      });
    }

    // Baseboard + picture rail for the three converted rooms (their own
    // finish, still per-room decoration even though the wall itself is now
    // shared structure).
    for (const convertedId of ["POP_CULTURE", "TCG", "COLLECTION"] as const) {
      const trim = buildRoomTrim(scene, roomById(convertedId), wallSegments, NEUTRAL_PREVIEW_FINISH, WALL_HEIGHT, WALL_THICKNESS);
      shellEntry(convertedId).baseboard = trim.baseboardMaterial;
      shellEntry(convertedId).rail = trim.railMaterial;
    }

    // Overnight Polish pass (2026-09-09): every legacy room's old two-height
    // gold rail-lattice trim is gone — "no broad gold stripes or repeated
    // decorative wall lines... restrained baseboards that terminate at
    // openings." Same buildRoomTrim() the 3 converted rooms use, with
    // `includeRail: false` (baseboard only), applied to every enclosed
    // legacy room and to HUB (its own finish, still rail-free). PLAZA keeps
    // its existing exemption — an open forecourt, not a decorated room.
    for (const room of CAMPUS_ROOMS) {
      if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION" || room.noWalls) continue;
      const finish = room.id === "HUB" ? HUB_FINISH : NEUTRAL_LEGACY_FINISH;
      const trim = buildRoomTrim(scene, room, wallSegments, finish, WALL_HEIGHT, WALL_THICKNESS, false);
      shellEntry(room.id).baseboard = trim.baseboardMaterial;
      shellEntry(room.id).rail = trim.railMaterial;
    }

    // Glowing room-center and doorway targets are generated further below once the
    // walkable areas exist. They restore the simple four-corner target
    // appearance and keep doorway openings visually clear.

    // The freestanding exterior facade (6 columns/capitals + pediment, EK's
    // "just some visual fun" ask from 2026-09-02, recentered 2026-09-09) is
    // removed entirely — EK's doorway-refinement pass: "Remove the two
    // widely separated legacy columns. They currently read as unrelated
    // leftover geometry. Build the entrance from the shared opening itself."
    // The PLAZA-HUB entrance's identity ("VLTD MUSEUM") now comes from that
    // door's own casing/header — see buildSharedWall's `style: "entrance"`
    // call below — not a separate structure standing apart from the wall.

    // Grand Hall custom design (2026-09-13) — replaces the previous flat
    // emissive "skylight" plane + canvas-drawn medallion placeholder with
    // real geometry per docs/GRAND-HALL-CUSTOM-DESIGN-2026-09-13.md and
    // docs/GRAND-HALL-VISUAL-ASSETS.md (both authoritative; read in full
    // before touching this block again). HUB's real room dimensions, walls,
    // doors, signs, targets, camera, and every other room are untouched —
    // everything below is new geometry sized off `hub`/`hubBounds`/
    // `hubCenter` (this room's own real, unmodified data) or a thin overlay
    // layered on top of the shared shell's existing (now-hidden) floor/
    // ceiling, the same inlay technique the VLTD seal below already uses
    // against the compass medallion beneath it.
    {
      const hub = roomById("HUB");
      const hubBounds = roomBounds(hub);
      const hubCenter = roomCenter(hub);
      const grandHallGroup = new THREE.Group();
      grandHallGroup.name = "grand-hall-enhancement";
      scene.add(grandHallGroup);

      type Rect = { x0: number; x1: number; z0: number; z1: number };

      // A flat rectangular "picture frame" — 4 non-overlapping planes tiling
      // the area between `outer` and `inner` — reused for the floor's
      // charcoal border, every coffer's own flat trim lip, and the
      // skylight's curb.
      function buildFrameRing(outer: Rect, inner: Rect, y: number, material: THREE.Material, faceUp: boolean) {
        const pieces: Rect[] = [
          { x0: outer.x0, x1: outer.x1, z0: outer.z0, z1: inner.z0 },
          { x0: outer.x0, x1: outer.x1, z0: inner.z1, z1: outer.z1 },
          { x0: outer.x0, x1: inner.x0, z0: inner.z0, z1: inner.z1 },
          { x0: inner.x1, x1: outer.x1, z0: inner.z0, z1: inner.z1 },
        ];
        for (const p of pieces) {
          const w = p.x1 - p.x0;
          const d = p.z1 - p.z0;
          if (w <= 0.01 || d <= 0.01) continue;
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
          mesh.rotation.x = faceUp ? -Math.PI / 2 : Math.PI / 2;
          mesh.position.set((p.x0 + p.x1) / 2, y, (p.z0 + p.z1) / 2);
          grandHallGroup.add(mesh);
        }
      }

      // The thin emissive "reveal" connecting a coffer's flat trim lip (at
      // `yLow`) up to its recessed panel (at `yHigh`) — four vertical strips
      // forming the glowing frame around the panel's own recessed edge, per
      // the ceiling reference image.
      function buildRevealWalls(panel: Rect, yLow: number, yHigh: number, material: THREE.Material) {
        const h = yHigh - yLow;
        if (h <= 0.01) return;
        const midY = (yLow + yHigh) / 2;
        const nsGeom = new THREE.BoxGeometry(panel.x1 - panel.x0, h, 0.08);
        const north = new THREE.Mesh(nsGeom, material);
        north.position.set((panel.x0 + panel.x1) / 2, midY, panel.z0);
        grandHallGroup.add(north);
        const south = new THREE.Mesh(nsGeom, material);
        south.position.set((panel.x0 + panel.x1) / 2, midY, panel.z1);
        grandHallGroup.add(south);
        const ewGeom = new THREE.BoxGeometry(0.08, h, panel.z1 - panel.z0);
        const west = new THREE.Mesh(ewGeom, material);
        west.position.set(panel.x0, midY, (panel.z0 + panel.z1) / 2);
        grandHallGroup.add(west);
        const east = new THREE.Mesh(ewGeom, material);
        east.position.set(panel.x1, midY, (panel.z0 + panel.z1) / 2);
        grandHallGroup.add(east);
      }

      // --- Materials ---------------------------------------------------
      const marbleFloorMaterial = buildStoneMaterial("warm-ivory-marble", hub.w / 10.5, hub.d / 10.5, 0.03, 0.45);
      const charcoalMaterial = buildStoneMaterial("charcoal-marble", 8, 8, 0.05, 0.4);
      const plasterMaterial = buildStoneMaterial("warm-ivory-plaster", 3, 2, 0, 0.3);
      // fog: false on every material below — same root-cause fix as
      // buildStoneMaterial above: HUB's own new geometry routinely sits
      // beyond the scene's shared Fog's 40-unit near distance, which was
      // washing all of it toward the fog's dark navy color regardless of
      // material color or added light. Only these Grand-Hall-specific
      // material instances are exempted; the scene-wide Fog object and every
      // other room's own materials are untouched.
      const bronzeMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2013, metalness: 0.65, roughness: 0.38, fog: false });
      // Warm 2700-3000K glow for every coffer's recessed-edge strip and the
      // skylight curb — a thin frame of emissive material, not a lit flat
      // panel face (docs/GRAND-HALL-CUSTOM-DESIGN-2026-09-13.md).
      const cofferGlowMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1c10, emissive: 0xffb877, emissiveIntensity: 1.5, roughness: 0.6, fog: false });
      const downlightMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff0c2, emissiveIntensity: 2, roughness: 0.4, fog: false });
      // Soft cool "sky" glow standing in for real daylight through the
      // skylight glass and down the well's own side faces — there's no real
      // skybox above the room to render, so this reads as bright overcast
      // sky rather than a literal view out.
      const skyGlassMaterial = new THREE.MeshStandardMaterial({ color: 0xcfe6f6, emissive: 0xbfe0f7, emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide, fog: false });

      // --- Floor: marble field + charcoal perimeter border --------------
      const marbleFloor = new THREE.Mesh(new THREE.PlaneGeometry(hub.w, hub.d), marbleFloorMaterial);
      marbleFloor.rotation.x = -Math.PI / 2;
      marbleFloor.position.set(hubCenter.x, 0.01, hubCenter.z);
      grandHallGroup.add(marbleFloor);

      const FLOOR_BORDER_WIDTH = 3;
      const floorBorderInner: Rect = {
        x0: hubBounds.x0 + FLOOR_BORDER_WIDTH, x1: hubBounds.x1 - FLOOR_BORDER_WIDTH,
        z0: hubBounds.z0 + FLOOR_BORDER_WIDTH, z1: hubBounds.z1 - FLOOR_BORDER_WIDTH,
      };
      buildFrameRing(hubBounds, floorBorderInner, 0.014, charcoalMaterial, true);

      // --- Wall base trim: charcoal marble, overlaid on the shared shell's
      // existing flat baseboard so it sits correctly without touching that
      // shared per-room baseboard loop (buildRoomTrim, campusRoomBuilder.ts)
      // used by every other room. Same wall-segment walk that loop already
      // does (computeCampusWallSegments()/splitSegmentForDoor(), both
      // already used above to build HUB's real walls/doors), just for HUB's
      // own segments, at a hair's-width proud of the wall face so it fully
      // covers (rather than z-fights with) the original.
      const baseTrimHeight = 0.24;
      for (const segment of wallSegments) {
        if (segment.roomA !== "HUB" && segment.roomB !== "HUB") continue;
        const isNS = segment.wall === "x";
        const facingSign = segment.roomA === "HUB" ? -1 : 1;
        const { solid } = splitSegmentForDoor(segment);
        for (const piece of solid) {
          const span = piece.to - piece.from;
          if (span <= 0.05) continue;
          const geometry = isNS
            ? new THREE.BoxGeometry(span, baseTrimHeight, 0.07)
            : new THREE.BoxGeometry(0.07, baseTrimHeight, span);
          const trim = new THREE.Mesh(geometry, charcoalMaterial);
          const offset = WALL_THICKNESS / 2 + 0.006;
          if (isNS) trim.position.set((piece.from + piece.to) / 2, baseTrimHeight / 2, segment.fixed + facingSign * offset);
          else trim.position.set(segment.fixed + facingSign * offset, baseTrimHeight / 2, (piece.from + piece.to) / 2);
          grandHallGroup.add(trim);
        }
      }

      // --- Ceiling: hide the shared shell's flat plane, build the real
      // skylight + coffered ceiling in its place. The shared plane itself is
      // left in the scene (untouched, same object buildNeutralShell already
      // built for every legacy room) — just switched invisible, since it has
      // no holes of its own and would otherwise occlude everything recessed
      // or raised above it.
      const hubCeilingMaterial = roomShellMaterialsByRoomId.get("HUB")?.ceiling;
      if (hubCeilingMaterial) {
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material === hubCeilingMaterial) obj.visible = false;
        });
      }

      const Y_CEIL_BASE = WALL_HEIGHT - 0.25; // flat trim/rings — clear of the shared shell's own ceiling-edge trim boxes just above
      const Y_PANEL = Y_CEIL_BASE + 0.42; // each coffer's recessed plaster panel
      const Y_WELL_TOP = Y_CEIL_BASE + 3.6; // skylight glass — a real deep well, not a flat plane

      // Skylight sized per the design doc: ~45-55% of the Hall's length
      // (its longer axis, Z at 78) and ~30-38% of its width (X at 63) —
      // expressed as fractions of the room's own real dimensions so this
      // stays correctly proportioned if either ever changes, and centered on
      // both of HUB's real axes by construction (hubCenter is exactly the
      // room's own center).
      const skyHalfW = (hub.w * 0.35) / 2;
      const skyHalfL = (hub.d * 0.51) / 2;
      const sky: Rect = {
        x0: hubCenter.x - skyHalfW, x1: hubCenter.x + skyHalfW,
        z0: hubCenter.z - skyHalfL, z1: hubCenter.z + skyHalfL,
      };

      // Coffer field: a margin in from the real walls, then a symmetrical
      // 3x3 grid (3 across, 3 deep, per the ceiling reference) centered on
      // HUB's own real centerline — the skylight IS the center cell, the
      // other 8 are the coffers, so this can never fall out of sync with
      // HUB's real doorway axes the way a hand-picked layout could.
      const CEIL_MARGIN = 3;
      const field: Rect = {
        x0: hubBounds.x0 + CEIL_MARGIN, x1: hubBounds.x1 - CEIL_MARGIN,
        z0: hubBounds.z0 + CEIL_MARGIN, z1: hubBounds.z1 - CEIL_MARGIN,
      };
      buildFrameRing(hubBounds, field, Y_CEIL_BASE, plasterMaterial, false);

      const cofferCells: Rect[] = [
        { x0: field.x0, x1: sky.x0, z0: field.z0, z1: sky.z0 },
        { x0: field.x0, x1: sky.x0, z0: sky.z0, z1: sky.z1 },
        { x0: field.x0, x1: sky.x0, z0: sky.z1, z1: field.z1 },
        { x0: sky.x1, x1: field.x1, z0: field.z0, z1: sky.z0 },
        { x0: sky.x1, x1: field.x1, z0: sky.z0, z1: sky.z1 },
        { x0: sky.x1, x1: field.x1, z0: sky.z1, z1: field.z1 },
        { x0: sky.x0, x1: sky.x1, z0: field.z0, z1: sky.z0 },
        { x0: sky.x0, x1: sky.x1, z0: sky.z1, z1: field.z1 },
      ];

      const COFFER_INSET = 1.15;
      for (const cell of cofferCells) {
        const panel: Rect = {
          x0: cell.x0 + COFFER_INSET, x1: cell.x1 - COFFER_INSET,
          z0: cell.z0 + COFFER_INSET, z1: cell.z1 - COFFER_INSET,
        };
        if (panel.x1 <= panel.x0 || panel.z1 <= panel.z0) continue;
        buildFrameRing(cell, panel, Y_CEIL_BASE, plasterMaterial, false);
        buildRevealWalls(panel, Y_CEIL_BASE, Y_PANEL, cofferGlowMaterial);
        const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(panel.x1 - panel.x0, panel.z1 - panel.z0), plasterMaterial);
        panelMesh.rotation.x = Math.PI / 2;
        panelMesh.position.set((panel.x0 + panel.x1) / 2, Y_PANEL, (panel.z0 + panel.z1) / 2);
        grandHallGroup.add(panelMesh);
        const downlight = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), downlightMaterial);
        downlight.rotation.x = Math.PI / 2;
        downlight.position.set((panel.x0 + panel.x1) / 2, Y_PANEL - 0.01, (panel.z0 + panel.z1) / 2);
        grandHallGroup.add(downlight);
      }

      // Skylight: a substantial framed bronze curb at the ceiling plane,
      // then a real deep well (side walls + glass top, not a flat plane)
      // with a dark bronze mullion grid that continues down the well's own
      // side faces, not just across the flat glass top.
      const CURB_INSET = 1.5;
      const glass: Rect = {
        x0: sky.x0 + CURB_INSET, x1: sky.x1 - CURB_INSET,
        z0: sky.z0 + CURB_INSET, z1: sky.z1 - CURB_INSET,
      };
      buildFrameRing(sky, glass, Y_CEIL_BASE, bronzeMaterial, false);

      const wellHeight = Y_WELL_TOP - Y_CEIL_BASE;
      const wellMidY = (Y_CEIL_BASE + Y_WELL_TOP) / 2;
      const wellWallThickness = 0.1;
      const glassW = glass.x1 - glass.x0;
      const glassL = glass.z1 - glass.z0;
      const wellNorth = new THREE.Mesh(new THREE.BoxGeometry(glassW, wellHeight, wellWallThickness), skyGlassMaterial);
      wellNorth.position.set((glass.x0 + glass.x1) / 2, wellMidY, glass.z0);
      grandHallGroup.add(wellNorth);
      const wellSouth = new THREE.Mesh(new THREE.BoxGeometry(glassW, wellHeight, wellWallThickness), skyGlassMaterial);
      wellSouth.position.set((glass.x0 + glass.x1) / 2, wellMidY, glass.z1);
      grandHallGroup.add(wellSouth);
      const wellWest = new THREE.Mesh(new THREE.BoxGeometry(wellWallThickness, wellHeight, glassL), skyGlassMaterial);
      wellWest.position.set(glass.x0, wellMidY, (glass.z0 + glass.z1) / 2);
      grandHallGroup.add(wellWest);
      const wellEast = new THREE.Mesh(new THREE.BoxGeometry(wellWallThickness, wellHeight, glassL), skyGlassMaterial);
      wellEast.position.set(glass.x1, wellMidY, (glass.z0 + glass.z1) / 2);
      grandHallGroup.add(wellEast);

      const glassTop = new THREE.Mesh(new THREE.PlaneGeometry(glassW, glassL), skyGlassMaterial);
      glassTop.rotation.x = Math.PI / 2;
      glassTop.position.set((glass.x0 + glass.x1) / 2, Y_WELL_TOP, (glass.z0 + glass.z1) / 2);
      grandHallGroup.add(glassTop);

      const MULLION_TILE = 3.2;
      const mullionCols = Math.max(2, Math.round(glassW / MULLION_TILE));
      const mullionRows = Math.max(2, Math.round(glassL / MULLION_TILE));
      const mullionWidth = 0.09;
      for (let i = 1; i < mullionCols; i += 1) {
        const x = glass.x0 + (glassW * i) / mullionCols;
        const topBar = new THREE.Mesh(new THREE.BoxGeometry(mullionWidth, 0.05, glassL), bronzeMaterial);
        topBar.position.set(x, Y_WELL_TOP + 0.03, (glass.z0 + glass.z1) / 2);
        grandHallGroup.add(topBar);
        const sideBarN = new THREE.Mesh(new THREE.BoxGeometry(mullionWidth, wellHeight, 0.03), bronzeMaterial);
        sideBarN.position.set(x, wellMidY, glass.z0 - wellWallThickness / 2 - 0.02);
        grandHallGroup.add(sideBarN);
        const sideBarS = new THREE.Mesh(new THREE.BoxGeometry(mullionWidth, wellHeight, 0.03), bronzeMaterial);
        sideBarS.position.set(x, wellMidY, glass.z1 + wellWallThickness / 2 + 0.02);
        grandHallGroup.add(sideBarS);
      }
      for (let i = 1; i < mullionRows; i += 1) {
        const z = glass.z0 + (glassL * i) / mullionRows;
        const rowBar = new THREE.Mesh(new THREE.BoxGeometry(glassW, 0.05, mullionWidth), bronzeMaterial);
        rowBar.position.set((glass.x0 + glass.x1) / 2, Y_WELL_TOP + 0.03, z);
        grandHallGroup.add(rowBar);
        const sideBarW = new THREE.Mesh(new THREE.BoxGeometry(0.03, wellHeight, mullionWidth), bronzeMaterial);
        sideBarW.position.set(glass.x0 - wellWallThickness / 2 - 0.02, wellMidY, z);
        grandHallGroup.add(sideBarW);
        const sideBarE = new THREE.Mesh(new THREE.BoxGeometry(0.03, wellHeight, mullionWidth), bronzeMaterial);
        sideBarE.position.set(glass.x1 + wellWallThickness / 2 + 0.02, wellMidY, z);
        grandHallGroup.add(sideBarE);
      }

      // --- Lighting: a limited number of soft supporting lights, not one
      // per coffer — the coffer glow itself comes from the emissive strips/
      // downlight discs above. One cool point light stands in for daylight
      // through the well; four warm ones spread across the coffer ring so
      // neither the warm coffer glow nor the cool skylight washes the other
      // out.
      const skylightGlow = new THREE.PointLight(0xbfe0f7, 1, 60, 2);
      skylightGlow.position.set(hubCenter.x, Y_WELL_TOP - 0.6, hubCenter.z);
      grandHallGroup.add(skylightGlow);

      const warmFillSpots: { x: number; z: number }[] = [
        { x: (field.x0 + sky.x0) / 2, z: hubCenter.z },
        { x: (sky.x1 + field.x1) / 2, z: hubCenter.z },
        { x: hubCenter.x, z: (field.z0 + sky.z0) / 2 },
        { x: hubCenter.x, z: (sky.z1 + field.z1) / 2 },
      ];
      for (const spot of warmFillSpots) {
        const light = new THREE.PointLight(0xffc98a, 0.5, 28, 2);
        light.position.set(spot.x, Y_CEIL_BASE - 0.6, spot.z);
        grandHallGroup.add(light);
      }

      // Restrained wall washing (docs/GRAND-HALL-VISUAL-ASSETS.md: "combine
      // ... with restrained wall washing") — its own lighting layer, distinct
      // from the coffer glow/skylight above. A live check after the initial
      // build found the new ivory-limestone walls reading flat and cool: the
      // coffer-ring fills above sit at ceiling height aimed at the coffers,
      // not down at the walls, so the walls had only HUB's pre-existing
      // legacy fixture rig (buildLegacyRoomLightRig/HUB_FINISH, tuned for the
      // old flat gold ceiling, not this room's much taller coffered one) to
      // read by. One soft warm point light per wall, at mid-wall-height,
      // inset from the wall face — a real, if modest, wash rather than
      // relying on ambient falloff from the ceiling fixtures alone.
      const wallWashSpots: { x: number; z: number }[] = [
        { x: hubCenter.x, z: hubBounds.z0 + 2.5 },
        { x: hubCenter.x, z: hubBounds.z1 - 2.5 },
        { x: hubBounds.x0 + 2.5, z: hubCenter.z },
        { x: hubBounds.x1 - 2.5, z: hubCenter.z },
      ];
      for (const spot of wallWashSpots) {
        const wash = new THREE.PointLight(0xffdcae, 0.85, 42, 2);
        wash.position.set(spot.x, WALL_HEIGHT * 0.58, spot.z);
        grandHallGroup.add(wash);
      }

      // --- VLTD medallion/seal — UNCHANGED mechanism, just re-sequenced to
      // run after the new marble floor so it sits correctly on top of it
      // instead of the old stone floor. Every line below this comment is the
      // same code the prior "Grand Hall enhancement" block already had.
      const medallionCanvas = document.createElement("canvas");
      medallionCanvas.width = 512;
      medallionCanvas.height = 512;
      const mctx = medallionCanvas.getContext("2d");
      if (mctx) {
        mctx.fillStyle = "#24211a";
        mctx.fillRect(0, 0, 512, 512);
        mctx.translate(256, 256);
        for (let ring = 0; ring < 4; ring++) {
          mctx.beginPath();
          mctx.arc(0, 0, 230 - ring * 50, 0, Math.PI * 2);
          mctx.strokeStyle = "rgba(232,185,94,0.55)";
          mctx.lineWidth = 3;
          mctx.stroke();
        }
        mctx.rotate(Math.PI / 8);
        for (let i = 0; i < 8; i++) {
          mctx.rotate(Math.PI / 4);
          mctx.beginPath();
          mctx.moveTo(0, -230);
          mctx.lineTo(14, -170);
          mctx.lineTo(0, -110);
          mctx.lineTo(-14, -170);
          mctx.closePath();
          mctx.fillStyle = "rgba(232,185,94,0.35)";
          mctx.fill();
        }
      }
      const medallionTexture = new THREE.CanvasTexture(medallionCanvas);
      medallionTexture.colorSpace = THREE.SRGBColorSpace;
      const medallion = new THREE.Mesh(
        new THREE.CircleGeometry(9, 48),
        new THREE.MeshStandardMaterial({ map: medallionTexture, roughness: 0.9 })
      );
      medallion.rotation.x = -Math.PI / 2;
      medallion.position.set(hubCenter.x, 0.02, hubCenter.z);
      scene.add(medallion);

      // The compass was designed with an open center. Place the VLTD seal in
      // that field as a separate, transparent floor inlay so the surrounding
      // rings and eight-point compass remain visible. This is visual only and
      // sits flush enough to avoid affecting movement or collision.
      const vltdSealTexture = new THREE.TextureLoader().load(
        "/brand/vltd-museum-floor-medallion-v1.png"
      );
      vltdSealTexture.colorSpace = THREE.SRGBColorSpace;
      vltdSealTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const vltdSeal = new THREE.Mesh(
        new THREE.CircleGeometry(2.7, 96),
        new THREE.MeshStandardMaterial({
          map: vltdSealTexture,
          transparent: true,
          alphaTest: 0.02,
          roughness: 0.82,
          metalness: 0.08,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      vltdSeal.name = "hub_vltd_floor_seal";
      vltdSeal.rotation.x = -Math.PI / 2;
      vltdSeal.position.set(hubCenter.x, 0.028, hubCenter.z);
      scene.add(vltdSeal);
    }

    // Display shelves flanking a doorway (EK's ask, 2026-09-02) are gone —
    // every campus door, including SPORTS/CARDS/BUILT_BOTANY/GAMES's own
    // HUB connections, now carries the thin campus casing + transom + signs
    // from the shared-wall pass above instead of a plain gap with a
    // decorative shelf pair either side of it.

    // Next-pass handoff (2026-09-07), corrected per EK's review of 5820b85:
    // POP_CULTURE is the first real campus room built to the exact standard
    // module, but now through the reusable src/lib/campusRoomBuilder.ts
    // module instead of a one-off inline block — "copying it four more
    // times will make the campus fragile... the next room should be a
    // second data entry, not another large `if` block." TCG pass
    // (2026-09-07): TCG is the second room through the same builder, proving
    // it as a real second data entry rather than a copy-pasted block. TCG
    // has three real campus doors (POP_CULTURE, MISC, HUB), not the
    // two-door module's usual two — all three get the same real doorway
    // treatment for consistency rather than leaving one plain. Every other
    // room keeps its current plain-gap/checkerboard/shelf-pair treatment
    // until EK approves this pass too.
    const popCultureModule: RoomModule = {
      room: roomById("POP_CULTURE"),
      wallHeight: WALL_HEIGHT,
      wallThickness: WALL_THICKNESS,
      eyeHeight: EYE_HEIGHT,
      finish: NEUTRAL_PREVIEW_FINISH,
      doorways: [
        { side: "east", gapCenter: doorGapCenter("POP_CULTURE", "HUB"), neighborId: "HUB", width: doorWallWidth("POP_CULTURE", "HUB") },
        { side: "south", gapCenter: doorGapCenter("POP_CULTURE", "TCG"), neighborId: "TCG", width: doorWallWidth("POP_CULTURE", "TCG") },
      ],
    };
    const tcgModule: RoomModule = {
      room: roomById("TCG"),
      wallHeight: WALL_HEIGHT,
      wallThickness: WALL_THICKNESS,
      eyeHeight: EYE_HEIGHT,
      finish: NEUTRAL_PREVIEW_FINISH,
      doorways: [
        { side: "north", gapCenter: doorGapCenter("TCG", "POP_CULTURE"), neighborId: "POP_CULTURE", width: doorWallWidth("TCG", "POP_CULTURE") },
        { side: "south", gapCenter: doorGapCenter("TCG", "MISC"), neighborId: "MISC", width: doorWallWidth("TCG", "MISC") },
        { side: "east", gapCenter: doorGapCenter("TCG", "HUB"), neighborId: "HUB", width: doorWallWidth("TCG", "HUB") },
      ],
    };
    // COLLECTION pass (2026-09-07): the third room through the same
    // builder, resized in place from its own north-west anchor (see
    // campusLayout.ts) — no other room moved. Its three real connections
    // (HUB north, MISC west, SPORTS east) all get the same real doorway
    // treatment, matching TCG's three-door precedent rather than leaving
    // one plain.
    const collectionModule: RoomModule = {
      room: roomById("COLLECTION"),
      wallHeight: WALL_HEIGHT,
      wallThickness: WALL_THICKNESS,
      eyeHeight: EYE_HEIGHT,
      finish: NEUTRAL_PREVIEW_FINISH,
      doorways: [
        { side: "north", gapCenter: doorGapCenter("COLLECTION", "HUB"), neighborId: "HUB", width: doorWallWidth("COLLECTION", "HUB") },
        { side: "west", gapCenter: doorGapCenter("COLLECTION", "MISC"), neighborId: "MISC", width: doorWallWidth("COLLECTION", "MISC") },
        { side: "east", gapCenter: doorGapCenter("COLLECTION", "SPORTS"), neighborId: "SPORTS", width: doorWallWidth("COLLECTION", "SPORTS") },
      ],
    };

    // The shared-wall pass above already built every doorway (POP_CULTURE's,
    // TCG's, and COLLECTION's included) exactly once each, as part of the
    // wall segment that carries it. These three still call buildRoomShell
    // for their own floor/ceiling/light rig, and still need their own
    // usable wall spans for item placement.
    const popCultureLights = buildRoomShell(scene, popCultureModule);
    const popCultureWallSpans = computeUsableWallSpans(popCultureModule);
    shellEntry("POP_CULTURE").floor = popCultureLights.floorMaterial;
    shellEntry("POP_CULTURE").ceiling = popCultureLights.ceilingMaterial;
    shellEntry("POP_CULTURE").shellFixtures = popCultureLights.shellFixtures;

    const tcgLights = buildRoomShell(scene, tcgModule);
    const tcgWallSpans = computeUsableWallSpans(tcgModule);
    shellEntry("TCG").floor = tcgLights.floorMaterial;
    shellEntry("TCG").ceiling = tcgLights.ceilingMaterial;
    shellEntry("TCG").shellFixtures = tcgLights.shellFixtures;

    const collectionLights = buildRoomShell(scene, collectionModule);
    const collectionWallSpans = computeUsableWallSpans(collectionModule);
    shellEntry("COLLECTION").floor = collectionLights.floorMaterial;
    shellEntry("COLLECTION").ceiling = collectionLights.ceilingMaterial;
    shellEntry("COLLECTION").shellFixtures = collectionLights.shellFixtures;

    // SPORTS proof-room pass (2026-09-11): first room to get real,
    // admin-curated artwork placed across every usable wall (south wall as
    // the focal wall, since it's the one side with no doorway) instead of
    // the generic north-wall-only, forced-square treatment every other
    // legacy room still uses. This is ARTWORK PLACEMENT ONLY — SPORTS's
    // shell (floor/ceiling/walls/trim) deliberately still goes through the
    // exact same buildNeutralShell() + NEUTRAL_LEGACY_FINISH loop every
    // other legacy room uses, below, completely unchanged: "keep its
    // existing neutral finish, no new room theme."
    //
    // Shared Museum Room Editor pass (2026-09-12): the placement math itself
    // (south-focal-wall weighting + usable-wall-span computation) moved into
    // the shared, reusable computeRoomPlacementSlots()/deriveRoomDoorways()
    // (campusRoomBuilder.ts / campusLayout.ts) — the same generator the new
    // room editor's numbered overlay uses — so this file no longer needs its
    // own one-off sportsModule/sportsWallSpans. SPORTS's dedicated light
    // group (sportsLights, declared earlier above the legacy shell loop so
    // its ambient rig and its picture lights share one group) stays — still
    // needed so its picture lights join the two-tier room-occupancy
    // activation system below, same as every converted room's.

    // Two-tier room light activation — EK's review of 9796c72: room-level
    // activation alone doesn't scale through HUB, since HUB is adjacent to
    // nearly every room — enabling "current room's neighbors" at FULL
    // brightness meant a HUB-adjacent bridge could eventually light every
    // converted room's complete rig. Each converted room now owns two
    // groups (RoomLightGroups from campusRoomBuilder.ts):
    //   - full: the real room lighting — on only when the visitor is
    //     actually inside this room, or inside a bridge this room is an
    //     endpoint of.
    //   - preview: the cheap "don't read as black" doorway-reveal lights —
    //     on whenever this room is a graph neighbor of the visitor's
    //     current room/bridge endpoints, in addition to whenever full is on.
    // Material Quality Parity pass (2026-09-12): every OTHER legacy room's
    // own new shell light rig (legacyLightGroups, built above alongside
    // buildNeutralShell — SPORTS excluded, since it already reuses
    // sportsLights below for exactly this) joins the same dictionary so its
    // lights get the same occupancy-based on/off treatment every converted
    // room already gets, instead of running always-on campus-wide.
    const roomLightGroups: Partial<Record<CampusRoomId, RoomLightGroups>> = {
      ...Object.fromEntries(legacyLightGroups),
      POP_CULTURE: popCultureLights,
      TCG: tcgLights,
      COLLECTION: collectionLights,
      SPORTS: sportsLights,
    };

    // Shared Museum Room Editor pass (2026-09-12): any OTHER gallery room
    // that gets admin-curated content for the first time (via the new room
    // editor) needs its own full/preview light pair too, so its picture
    // lights join the same two-tier occupancy activation every converted
    // room already uses — created on demand, the first time
    // populateDynamicContent below finds curated items for a room with no
    // group yet, rather than pre-building 5 more always-present-but-usually-
    // empty groups up front.
    function ensureRoomLightGroups(roomId: CampusRoomId): RoomLightGroups {
      const existing = roomLightGroups[roomId];
      if (existing) return existing;
      const full = new THREE.Group();
      full.name = `room-full:${roomId}`;
      scene.add(full);
      const preview = new THREE.Group();
      preview.name = `room-preview:${roomId}`;
      scene.add(preview);
      const created: RoomLightGroups = { full, preview };
      roomLightGroups[roomId] = created;
      return created;
    }

    // EK's review of 751361a: the room-only check went blank (every light
    // group off) whenever the visitor was in a door bridge — a real,
    // legitimately walkable spot between two room rects that belongs to no
    // room. Bridges are a first-class location: standing in one puts BOTH
    // endpoint rooms in the "full" set. A true "none" — outside every room
    // and every bridge, which shouldn't happen during normal collision-
    // bounded movement — keeps whatever was last active instead of
    // blanking everything.
    type LightLocation =
      | { kind: "room"; roomId: CampusRoomId }
      | { kind: "bridge"; doorIndex: number; rooms: [CampusRoomId, CampusRoomId] }
      | { kind: "none" };

    function resolveLightLocation(x: number, z: number): LightLocation {
      const room = CAMPUS_ROOMS.find((r) => {
        const b = roomBounds(r);
        return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
      });
      if (room) return { kind: "room", roomId: room.id };

      for (const bridge of computeDoorBridges()) {
        if (x >= bridge.x0 && x <= bridge.x1 && z >= bridge.z0 && z <= bridge.z1) {
          const [a, b] = CAMPUS_DOORS[bridge.doorIndex].rooms;
          if (a && b) return { kind: "bridge", doorIndex: bridge.doorIndex, rooms: [a, b] };
        }
      }
      return { kind: "none" };
    }

    let lastLightLocation: LightLocation = { kind: "none" };
    let lastFullRoomIds: CampusRoomId[] = [];
    let lastPreviewRoomIds: CampusRoomId[] = [];
    function updateRoomLightActivation(x: number, z: number) {
      const location = resolveLightLocation(x, z);
      if (location.kind === "none") return;

      const unchanged =
        (location.kind === "room" && lastLightLocation.kind === "room" && location.roomId === lastLightLocation.roomId) ||
        (location.kind === "bridge" && lastLightLocation.kind === "bridge" && location.doorIndex === lastLightLocation.doorIndex);
      if (unchanged) return;
      lastLightLocation = location;

      // fullSet: the room(s) the visitor is actually standing in (or, in a
      // bridge, both endpoints). previewSet: everything one hop out from
      // fullSet — never promoted to full merely for being a neighbor of a
      // neighbor (e.g. HUB), which is exactly the scaling problem this
      // corrects.
      const fullSet = new Set<CampusRoomId>(
        location.kind === "room" ? [location.roomId] : [location.rooms[0], location.rooms[1]]
      );
      const previewSet = new Set<CampusRoomId>();
      for (const roomId of fullSet) {
        for (const neighbor of adjacentRoomIds(roomId)) previewSet.add(neighbor);
      }

      lastFullRoomIds = [...fullSet];
      lastPreviewRoomIds = [...previewSet].filter((id) => !fullSet.has(id));
      for (const [roomId, groups] of Object.entries(roomLightGroups) as [CampusRoomId, RoomLightGroups][]) {
        const full = fullSet.has(roomId);
        groups.full.visible = full;
        groups.preview.visible = full || previewSet.has(roomId);
      }
      // No per-connection reveal light to toggle anymore — the Shared-Wall
      // Grid Plan removed it entirely ("remove... connection reveal lights
      // made obsolete by shared walls"); ordinary room lighting reaches a
      // same-wall opening the way it does in the accepted personal room.
    }

    // Content is async (vault items are sync, but items-per-room, Spotlight
    // programs and Store items all come from Supabase now), so it's
    // populated after the room shells are already up and rendering rather
    // than blocking the first frame — matches how item textures already
    // load in after their frame appears.
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    let contentCancelled = false;

    function hangFrame(x: number, z: number, size: number, url: string, yOffset = 0) {
      const y = EYE_HEIGHT + yOffset;
      const geometry = new THREE.PlaneGeometry(size, size);
      const material = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const frame = new THREE.Mesh(geometry, material);
      frame.position.set(x, y, z + 0.03);
      scene.add(frame);
      textureLoader.load(url, (texture) => {
        if (contentCancelled) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        // Visual Overnight Pass (2026-09-10): every legacy room's artwork
        // goes through this function, and none of it has ever had a
        // dedicated picture light — only whatever ambient/hemisphere light
        // reaches that wall. campusRoomBuilder.ts's own placeArtwork()
        // (the 3 converted rooms) already has an accepted fallback for
        // exactly this case (`withRealLight: false`): a modest emissive
        // self-lift keyed off the artwork's own texture, not a new Light
        // object — "remove overlapping or redundant lights where material
        // emissive lift can do the same job" applies just as well in the
        // other direction here, where there was no light to begin with.
        const artMaterial = new THREE.MeshStandardMaterial({
          map: texture, roughness: 0.6,
          emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.2,
        });
        const art = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.88, size * 0.88), artMaterial);
        art.position.set(x, y, z + 0.05);
        scene.add(art);
      });
    }

    function hangPlaque(
      x: number,
      z: number,
      width: number,
      height: number,
      title: string,
      sub?: string,
      yOffset = 0,
      rotationY = 0,
      depthSign = 1
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#12294a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#eaf2fb";
      ctx.font = "700 34px Archivo, sans-serif";
      wrapText(ctx, title, canvas.width / 2, 100, 460, 40);
      if (sub) {
        ctx.fillStyle = "#93b0cc";
        ctx.font = "500 22px 'IBM Plex Mono', monospace";
        wrapText(ctx, sub, canvas.width / 2, 170, 460, 28);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      plaque.position.set(x, EYE_HEIGHT + yOffset, z + depthSign * 0.03);
      plaque.rotation.y = rotationY;
      scene.add(plaque);
    }

    // POP_CULTURE and TCG only: places art at natural aspect ratio (bounded
    // within a max box) instead of forcing every image onto a square plane,
    // spaced across the room's real usable wall spans (from the shared
    // campusRoomBuilder module — already excludes every doorway's
    // no-display zone) instead of the generic north-wall-only strip every
    // other room still uses. Each room's picture lights join that room's
    // own light group so they turn off with the rest of the room's lights
    // when the visitor is elsewhere.
    function placeRoomItems(wallSpans: ReturnType<typeof computeUsableWallSpans>, lightGroups: RoomLightGroups, items: VaultItem[]) {
      const urls = items.map((item) => ({ url: getPrimaryImageUrl(item) })).filter((it): it is { url: string } => Boolean(it.url));
      placeArtwork(scene, textureLoader, lightGroups, wallSpans, urls, WALL_THICKNESS, EYE_HEIGHT, () => contentCancelled);
    }

    async function populateDynamicContent() {
      const [itemsPerRoom, spotlightPrograms, storeItems, roomMeta] = await Promise.all([
        getItemsPerRoom(),
        getActiveSpotlightPrograms(),
        getEnabledStoreItems(),
        getAllRoomMeta(),
      ]);
      if (contentCancelled) return;

      // Shared Museum Room Editor pass (2026-09-12): an admin-renamed room
      // (museum_room_meta.title) updates the top-of-screen room label (via
      // roomTitleOverrides, read every frame in tick() below) and every
      // destination sign naming that room — each sign was tagged with the
      // stable room id it names at build time (buildSharedWall's
      // buildDestinationSign calls), so this finds and retitles them
      // without re-deriving anything from the (possibly stale) label text
      // already baked into their texture.
      const titleOverrides: Record<string, string> = {};
      for (const [roomId, meta] of Object.entries(roomMeta)) {
        if (meta.title) titleOverrides[roomId] = meta.title;
      }
      roomTitleOverrides = titleOverrides;
      if (Object.keys(titleOverrides).length > 0) {
        scene.traverse((obj) => {
          if (obj.userData?.kind !== "museum-destination-sign") return;
          const roomId = obj.userData.roomId as string | undefined;
          const override = roomId ? titleOverrides[roomId] : undefined;
          if (override) retitleDestinationSign(obj, override);
        });
      }

      // Real Gallery Environments pass (2026-09-12): apply each editable
      // room's saved museum_room_meta.room_style — the personal Gallery
      // Builder's own real White/Vault/Arcade/Industrial Loft environments
      // (createGalleryFinishes(), reused directly, not an invented museum
      // color) — onto that room's OWN wall/floor/ceiling/baseboard/rail
      // Material instances (roomShellMaterialsByRoomId, keyed per room id
      // exactly like roomWallMaterial() above, so this can only ever touch
      // `roomId`'s own materials, never a neighbor's), and swap that room's
      // generic ceiling-fixture/wash-light rig for the style's own real
      // addLighting() rig. Only EDITABLE_ROOM_IDS are looped — the room
      // editor's Style control only renders for those rooms, so
      // HUB/SPOTLIGHT/STORE/PLAZA never carry a style override in the first
      // place. A missing or unrecognized room_style resolves to `null` from
      // createStyledRoomFinishes() and leaves that room's normal
      // per-category finish untouched — the required safe default / reset.
      for (const roomId of EDITABLE_ROOM_IDS) {
        const roomStyleValue = roomMeta[roomId]?.room_style;
        const styled = createStyledRoomFinishes(roomStyleValue);

        // POP_CULTURE Vault-parity pass (2026-09-13): the real Vault/Loft
        // decorative wall armor (structural rib panels, corner rivets,
        // Vault's own diagonal glowing ceiling-light lattice / Loft's own
        // ceiling arrows) — museumRoomArmor.ts's addStyledRoomArmor(),
        // already proven in MuseumBuilder.tsx, wired into the real live
        // walkable campus for the first time here. Called for every
        // EDITABLE_ROOM_IDS room unconditionally: its own internal
        // style-conditional dispatcher already no-ops for anything other
        // than "vault"/"loft" (White/Arcade never got this armor system in
        // the personal Gallery either), so a room with no style, or an
        // unrecognized one, is completely unaffected — no new geometry, no
        // change from today.
        const roomWallSegments = wallSegments.filter(
          (segment) => segment.roomA === roomId || segment.roomB === roomId
        );
        addStyledRoomArmor(
          scene, roomById(roomId), roomWallSegments, WALL_HEIGHT, resolveGalleryFinishStyle(roomStyleValue), WALL_THICKNESS
        );

        if (styled) {
          const shell = roomShellMaterialsByRoomId.get(roomId);
          if (!shell?.wall || !shell.floor || !shell.ceiling || !shell.baseboard) {
            // Fails soft: this room's shell materials weren't tracked
            // (should never happen for an EDITABLE_ROOM_IDS room, but never
            // break the campus over it) — leave the room at its normal
            // default finish.
            styled.dispose();
          } else {
            shell.wall.copy(styled.wall);
            shell.wall.needsUpdate = true;
            shell.floor.copy(styled.floor);
            shell.floor.needsUpdate = true;
            shell.ceiling.copy(styled.ceiling);
            // Re-apply the same downward-facing-ceiling self-illumination
            // fix createStyledRoomFinishes' caller already set on the
            // SOURCE material (see buildCeilingAndTrim) — .copy() above
            // just overwrote it with the copy's own (correctly emissive)
            // values, so this is actually redundant right now, but kept
            // explicit here in case a future edit changes what gets copied.
            shell.ceiling.emissive.copy(shell.ceiling.color);
            shell.ceiling.emissiveIntensity = 0.22;
            shell.ceiling.needsUpdate = true;
            shell.baseboard.copy(styled.charcoal);
            shell.baseboard.needsUpdate = true;
            if (shell.rail) {
              shell.rail.copy(styled.brass);
              shell.rail.needsUpdate = true;
            }

            // Swap the generic ceiling-fixture/wash-light rig this room was
            // built with for the style's own real light rig.
            const groups = roomLightGroups[roomId] ?? ensureRoomLightGroups(roomId);
            for (const child of [...groups.full.children]) groups.full.remove(child);
            if (shell.shellFixtures) {
              for (const child of [...shell.shellFixtures.children]) {
                if (child instanceof THREE.Mesh) {
                  child.geometry.dispose();
                  const material = child.material;
                  if (Array.isArray(material)) material.forEach((m) => m.dispose());
                  else material.dispose();
                }
                shell.shellFixtures.remove(child);
              }
            }
            const styledRoom = roomById(roomId);
            const anchor = new THREE.Group();
            anchor.position.set(styledRoom.x + styledRoom.w / 2, 0, styledRoom.z + styledRoom.d / 2);
            groups.full.add(anchor);
            styled.addLighting(anchor);
            styledFinishesForDisposal.push(styled);
          }
        }

        // POP_CULTURE Vault-parity pass (2026-09-13): display cases + shelf
        // boards — museumRoomFurniture.ts's buildDisplayCase/
        // buildShelfBoard/createShelfMaterial, already proven in
        // MuseumBuilder.tsx, wired into the live campus for the first time
        // here — sized from this room's own real museum_room_meta
        // case_capacity/shelf_capacity (Museum Builder's existing capacity
        // sliders) instead of a hardcoded number. Independent of
        // room_style: a room with no style still gets its own real
        // furniture, using createShelfMaterial()/buildDisplayCase()'s
        // existing plain-material fallback for `styled: null` — the same
        // safe default Museum Builder itself already relies on.
        //
        // shelf_capacity: null/undefined OR an explicit 0 both mean "off"
        // here — the exact meaning
        // 20260912_museum_room_capacity_and_background.sql's own comment
        // gives this column ("null or 0 means that furniture kind is off
        // for this room"). case_capacity gets one additional default on top
        // of that same rule (DEFAULT_CASE_CAPACITY_FOR_STYLED_ROOM, above):
        // a room that DOES have its own saved room_style but has never had
        // case_capacity set at all (column genuinely null/undefined, not a
        // stored 0 — a stored 0 still means off, unchanged) defaults toward
        // the personal Gallery Vault's own real 5-case layout instead of
        // silently showing none. Gated on `styled` (not just any
        // EDITABLE_ROOM_IDS room) so a room with no saved style and no
        // capacity row at all — e.g. TCG/COLLECTION today — stays at zero
        // cases, matching "any other room that currently has no saved style
        // must render exactly as before."
        const meta = roomMeta[roomId];
        const shelfCapacity = meta?.shelf_capacity ?? 0;
        const caseCapacity = meta?.case_capacity ?? (styled ? DEFAULT_CASE_CAPACITY_FOR_STYLED_ROOM : 0);
        if (shelfCapacity > 0 || caseCapacity > 0) {
          const furnitureDoorways = deriveRoomDoorways(roomId);
          const caseEligible =
            caseCapacity > 0 && computeRoomCaseSlots(roomId, furnitureDoorways, WALL_THICKNESS, 1).length > 0;
          const caseSlots = caseEligible
            ? computeRoomCaseSlots(roomId, furnitureDoorways, WALL_THICKNESS, caseCapacity)
            : [];
          const shelfSlots =
            shelfCapacity > 0
              ? computeRoomShelfSlots(roomId, furnitureDoorways, WALL_THICKNESS, EYE_HEIGHT, shelfCapacity)
              : [];
          if (shelfSlots.length > 0) {
            const shelfMaterial = createShelfMaterial(styled);
            const shelfY = EYE_HEIGHT * 0.42;
            for (const span of computeRoomShelfSpans(roomId, furnitureDoorways, WALL_THICKNESS, EYE_HEIGHT)) {
              buildShelfBoard(scene, span, shelfY, WALL_THICKNESS, shelfMaterial);
            }
          }
          for (const slot of caseSlots) buildDisplayCase(scene, slot.x, slot.z, styled);
          if (caseSlots.length > 0 || shelfSlots.length > 0) {
            roomFurnitureSlotsByRoomId.set(roomId, { caseSlots, shelfSlots });
          }
        }
      }

      // Shared Museum Room Editor pass (2026-09-12): fetch every gallery
      // room's admin-curated content once, generically — replacing the old
      // SPORTS-only special case. A room with zero enabled
      // museum_room_items rows keeps today's vault-placeholder fallback
      // below completely unchanged; a room with at least one is rendered at
      // its exact numbered slot positions instead
      // (computeRoomPlacementSlots/placeItemsAtSlots) — the SAME engine the
      // new in-3D room editor's overlay uses, so the two can never
      // disagree about where a curated item actually sits.
      const curatedItemsByRoom = new Map<CampusRoomId, MuseumRoomItem[]>();
      await Promise.all(
        EDITABLE_ROOM_IDS.map(async (id) => {
          const roomItems = await getEnabledRoomItems(id);
          if (roomItems.length > 0) curatedItemsByRoom.set(id, roomItems);
        })
      );
      if (contentCancelled) return;

      for (const roomId of EDITABLE_ROOM_IDS) {
        const curated = curatedItemsByRoom.get(roomId);
        if (!curated) continue;
        const doorways = deriveRoomDoorways(roomId);
        const wallSlots = computeRoomPlacementSlots(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT, itemsPerRoom, focalWallFor(roomId));
        // POP_CULTURE Vault-parity pass (2026-09-13): fold in this room's
        // own case/shelf slots (built above, alongside the style-patch
        // loop) so a curated item explicitly pinned to a case/shelf slot_id
        // lands there, and any UNPINNED item can also auto-fill a case/
        // shelf slot once every wall slot is already taken — wall slots
        // stay FIRST in this combined list, in the exact same order as
        // before, so an existing room's wall-only assignment (today, every
        // EDITABLE_ROOM_IDS room) is completely unaffected; case/shelf
        // slots only ever pick up items that would otherwise have gone
        // unplaced.
        const furniture = roomFurnitureSlotsByRoomId.get(roomId);
        const shelfSlots = furniture?.shelfSlots ?? [];
        const caseSlots = furniture?.caseSlots ?? [];
        const groups = ensureRoomLightGroups(roomId);
        const bySlot = buildSlotAssignments([...wallSlots, ...shelfSlots, ...caseSlots], curated);
        placeItemsAtSlots(scene, textureLoader, groups, [...wallSlots, ...shelfSlots], bySlot, () => contentCancelled);
        if (caseSlots.length > 0) {
          placeItemsInCases(scene, textureLoader, caseSlots, bySlot, () => contentCancelled, (x, y, z, rotationY, label, maxWidth) =>
            hangCompactLabel(scene, x, y, z, rotationY, label, maxWidth)
          );
        }
      }
      // Newly-created light groups (any room curated here for the first
      // time) need their visibility resolved against the visitor's CURRENT
      // position — the per-frame activation check only re-runs on a
      // location CHANGE, which already happened before this async content
      // arrived.
      lastLightLocation = { kind: "none" };
      updateRoomLightActivation(cameraBody.x, cameraBody.z);

      // Vault-item category rooms — the signed-in user's own items,
      // grouped by universe, as placeholder content until a real
      // cross-user "top items" feed exists.
      const allItems = loadItems();
      const universeCounts: Partial<Record<UniverseKey, number>> = {};
      for (const item of allItems) {
        const universe = itemUniverse(item);
        if (universe) universeCounts[universe] = (universeCounts[universe] ?? 0) + 1;
      }
      const swing = assignSwingRoomUniverses(universeCounts);
      const roomUniverses: Partial<Record<CampusRoom["id"], UniverseKey[]>> = {
        COLLECTION: swing.COLLECTION,
        CARDS: swing.CARDS,
        MISC: ["MISC", ...swing.MISC_EXTRA],
      };

      for (const room of CAMPUS_ROOMS) {
        // POP_CULTURE, TCG, and COLLECTION place their own items with
        // aspect-ratio-preserving slots (see placeRoomItems below) instead
        // of the generic north-wall-only, forced-square treatment every
        // other room uses. SPORTS has never had a vault-placeholder path at
        // all. Any OTHER room the admin has already curated above
        // (curatedItemsByRoom) is also skipped here — its display now comes
        // entirely from the curated slot pass, not the vault placeholder.
        if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION" || room.id === "SPORTS") continue;
        if (curatedItemsByRoom.has(room.id)) continue;
        const universes = roomUniverses[room.id] ?? room.universes;
        if (universes.length === 0) continue;
        const items = allItems.filter((item) => {
          const universe = itemUniverse(item);
          return universe !== null && universes.includes(universe);
        }).slice(0, itemsPerRoom);
        if (items.length === 0) continue;

        const bounds = roomBounds(room);
        // Live-verified fix (2026-09-09): this loop used to space items
        // evenly across the room's FULL north-wall width regardless of a
        // door sitting on it — caught hanging artwork directly across the
        // GAMES<->BUILT_BOTANY opening ("no artwork may overlap a doorway
        // or its casing"). Exclude any door's DOORWAY_NO_DISPLAY_HALF_WIDTH
        // zone on this wall first, then distribute items only within the
        // remaining safe segments (same margin/exclusion technique
        // computeUsableWallSpans already uses for the 3 converted rooms).
        const northDoorGaps = CAMPUS_DOORS
          .filter((d) => d.wall === "x" && d.at === bounds.z0 && d.rooms.includes(room.id))
          .map((d) => ({ from: d.gapCenter - DOORWAY_NO_DISPLAY_HALF_WIDTH, to: d.gapCenter + DOORWAY_NO_DISPLAY_HALF_WIDTH }))
          .sort((a, b) => a.from - b.from);

        const margin = 1.5;
        const rawSegments: { from: number; to: number }[] = [];
        let cursor = bounds.x0 + margin;
        for (const gap of northDoorGaps) {
          if (gap.from > cursor) rawSegments.push({ from: cursor, to: Math.min(gap.from, bounds.x1 - margin) });
          cursor = Math.max(cursor, gap.to);
        }
        if (cursor < bounds.x1 - margin) rawSegments.push({ from: cursor, to: bounds.x1 - margin });
        const usableSegments = rawSegments.filter((s) => s.to - s.from > 0.5);
        const totalWidth = usableSegments.reduce((sum, s) => sum + (s.to - s.from), 0);
        if (totalWidth <= 0) continue;

        let itemIndex = 0;
        for (const segment of usableSegments) {
          const segWidth = segment.to - segment.from;
          const share = Math.max(1, Math.round((segWidth / totalWidth) * items.length));
          const count = Math.min(share, items.length - itemIndex);
          if (count <= 0) continue;
          const step = segWidth / count;
          const frameSize = Math.min(2.6, step * 0.72);
          for (let i = 0; i < count && itemIndex < items.length; i += 1, itemIndex += 1) {
            const url = getPrimaryImageUrl(items[itemIndex]);
            if (!url) continue;
            hangFrame(segment.from + step * (i + 0.5), bounds.z0 + WALL_THICKNESS, frameSize, url);
          }
        }
      }

      if (!curatedItemsByRoom.has("POP_CULTURE")) {
        const popItems = allItems
          .filter((item) => itemUniverse(item) === "POP_CULTURE")
          .slice(0, itemsPerRoom);
        placeRoomItems(popCultureWallSpans, popCultureLights, popItems);
      }

      if (!curatedItemsByRoom.has("TCG")) {
        const tcgItems = allItems
          .filter((item) => itemUniverse(item) === "TCG")
          .slice(0, itemsPerRoom);
        placeRoomItems(tcgWallSpans, tcgLights, tcgItems);
      }

      if (!curatedItemsByRoom.has("COLLECTION")) {
        // assignSwingRoomUniverses() always names a universe for COLLECTION,
        // even when every swing universe's real count is tied at zero — only
        // trust that assignment here if it actually has real items behind it.
        const collectionUniverses = (roomUniverses.COLLECTION ?? []).filter(
          (universe) => (universeCounts[universe] ?? 0) > 0
        );
        const collectionItems = selectCollectionItems(allItems, collectionUniverses, itemsPerRoom);
        placeRoomItems(collectionWallSpans, collectionLights, collectionItems);
        if (collectionItems.length === 0) {
          // No usable image-bearing items anywhere in the signed-in vault —
          // an honest empty-state instead of a silent blank room. Mounted on
          // COLLECTION's south wall, the one side with no doorway.
          const collectionBounds = roomBounds(roomById("COLLECTION"));
          hangPlaque(
            collectionBounds.x0 + (collectionBounds.x1 - collectionBounds.x0) / 2,
            collectionBounds.z1 - WALL_THICKNESS,
            6,
            3,
            "Collection fills from your vault",
            "Add real items with photos to your vault to see them displayed here.",
            0,
            Math.PI,
            -1
          );
        }
      }

      if (!curatedItemsByRoom.has("SPORTS")) {
        // SPORTS has never had a vault-placeholder fallback (it's the first
        // room built for admin-curated content only) — an honest empty
        // state, same pattern as COLLECTION/Spotlight/Store, mounted on its
        // south wall (the one side with no doorway), until the Museum Map's
        // room editor has at least one item placed.
        const sportsBounds = roomBounds(roomById("SPORTS"));
        hangPlaque(
          sportsBounds.x0 + (sportsBounds.x1 - sportsBounds.x0) / 2,
          sportsBounds.z1 - WALL_THICKNESS,
          6,
          3,
          "Coming soon",
          "SPORTS items are curated from the Museum Map",
          0,
          Math.PI,
          -1
        );
      }

      // Spotlight room — admin-controlled rotating programs.
      const spotlightBounds = roomBounds(roomById("SPOTLIGHT"));
      if (spotlightPrograms.length === 0) {
        hangPlaque(
          spotlightBounds.x0 + (spotlightBounds.x1 - spotlightBounds.x0) / 2,
          spotlightBounds.z0 + WALL_THICKNESS,
          6,
          3,
          "Coming soon",
          "Spotlight programs are managed from Admin Tools"
        );
      } else {
        const usableWidth = 20 - 3;
        const step = usableWidth / spotlightPrograms.length;
        spotlightPrograms.forEach((program, index) => {
          hangPlaque(
            spotlightBounds.x0 + 1.5 + step * (index + 0.5),
            spotlightBounds.z0 + WALL_THICKNESS,
            Math.min(4.2, step * 0.85),
            2.4,
            program.title,
            program.description ?? undefined
          );
        });
      }

      // Store room — admin-controlled physical products.
      const storeBounds = roomBounds(roomById("STORE"));
      if (storeItems.length === 0) {
        hangPlaque(storeBounds.x0 + (storeBounds.x1 - storeBounds.x0) / 2, storeBounds.z0 + WALL_THICKNESS, 6, 3, "Coming soon", "Store items are managed from Admin Tools");
      } else {
        const usableWidth = 20 - 3;
        const step = usableWidth / storeItems.length;
        const frameSize = Math.min(2.6, step * 0.72);
        storeItems.forEach((item, index) => {
          const x = storeBounds.x0 + 1.5 + step * (index + 0.5);
          const z = storeBounds.z0 + WALL_THICKNESS;
          if (item.image_url) {
            hangFrame(x, z, frameSize, item.image_url, frameSize * 0.35);
          }
          hangPlaque(x, z, frameSize + 0.4, 1.1, item.name, item.price_label ?? undefined, item.image_url ? -frameSize * 0.55 : 0);
        });
      }
    }
    void populateDynamicContent();

    // --- Movement: WASD + arrow-key walk, drag-to-look, click-a-waypoint-
    // to-walk, and scroll-to-nudge. Walk/turn speeds, drag-vs-click
    // threshold, and drag-look sensitivity are ported exactly from
    // VirtualGalleryRoom.tsx (itself researched directly from
    // bingebrowse.net's live bundle, not guessed). Click-to-walk's own
    // shape is NOT a straight port — EK watched bingebrowse.net directly
    // and found it uses fixed marked waypoints, not raycast-anywhere; see
    // the waypoint-marker comment above. The single room's own on-screen
    // touch pad was deliberately never added for guests either (see that
    // file's "no bottom move/rotate pad" comment) — clicking a waypoint
    // covers touch fine on its own, so this component doesn't have one.
    const walkable = buildWalkableAreas();
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    // The original target language was a compact set of four corner
    // brackets. Draw a soft cyan halo underneath the crisp strokes so the
    // marker reads against both pale and dark floors without a backing
    // plate, arrow, or destination label.
    function makeRoomTargetTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const margin = 20;
      const length = 28;
      const corners: [number, number, number, number][] = [
        [margin, margin, 1, 1],
        [128 - margin, margin, -1, 1],
        [margin, 128 - margin, 1, -1],
        [128 - margin, 128 - margin, -1, -1],
      ];
      const drawCorners = () => {
        for (const [cx, cy, sx, sy] of corners) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + length * sy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + length * sx, cy);
          ctx.stroke();
        }
      };

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(49,205,255,0.72)";
      ctx.lineWidth = 13;
      ctx.shadowColor = "rgba(25,190,255,0.95)";
      ctx.shadowBlur = 18;
      drawCorners();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#8fe8ff";
      ctx.lineWidth = 6;
      drawCorners();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const roomTargetTexture = makeRoomTargetTexture();
    const waypointMeshes: THREE.Mesh[] = [];
    // HUB's room-center target sits exactly on the Grand Hall's VLTD floor
    // seal (a 2.7-radius medallion centered on the same point) — the
    // standard 2.2-unit target's corner brackets land inside that circle
    // and cover part of the logo. Sized up just for this one target so its
    // brackets clear the seal's edge and frame it instead of sitting on
    // top of it; every other room keeps the standard size.
    const HUB_TARGET_SIZE = 6.4;
    for (const waypoint of computeCampusWaypoints()) {
      if (!isWalkable(waypoint.x, waypoint.z, walkable)) {
        console.warn(`Room target ${waypoint.id} lands outside the walkable area — skipped`, waypoint);
        continue;
      }
      const targetSize = waypoint.enlarged ? HUB_TARGET_SIZE : 2.2;
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(targetSize, targetSize),
        new THREE.MeshBasicMaterial({
          map: roomTargetTexture ?? undefined,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(waypoint.x, 0.03, waypoint.z);
      marker.userData.waypoint = waypoint;
      scene.add(marker);
      waypointMeshes.push(marker);
    }

    let hoveredMarker: THREE.Mesh | null = null;
    function setMarkerHover(marker: THREE.Mesh | null) {
      if (hoveredMarker === marker) return;
      if (hoveredMarker) {
        hoveredMarker.scale.set(1, 1, 1);
        (hoveredMarker.material as THREE.MeshBasicMaterial).opacity = 0.72;
      }
      if (marker) {
        marker.scale.set(1.3, 1.3, 1);
        (marker.material as THREE.MeshBasicMaterial).opacity = 1;
      }
      hoveredMarker = marker;
      renderer.domElement.style.cursor = marker ? "pointer" : "";
    }

    const WALK_SPEED = MUSEUM_WALK_SPEED;
    const WALK_SPEED_SLOW = MUSEUM_WALK_SPEED_SLOW;
    const TURN_RATE = 1.7; // rad/sec, Left/Right arrow turning
    const PITCH_LIMIT = MUSEUM_PITCH_LIMIT;

    // EK's physical mouse test, 2026-09-09: real wheel-event diagnostics
    // showed every notch applying immediately with no queue/backlog
    // (sub-15ms first-frame latency, steady 60fps) — the "stop, then a
    // jump" she still felt is POSITION_EASE_RATE (0.15/frame) itself: a
    // single notch's motion is ~95% decayed within ~300ms, so her actual
    // notch spacing (real gaps measured at 100-140ms) reads as the camera
    // settling before the next notch kicks it again. Keyboard/walkTween
    // never lag behind a target on the campus (see the comments above
    // updateKeyboardMovement/tick), so wheel-driven position easing is the
    // ONLY thing this rate governs here — safe to slow it without touching
    // the shared POSITION_EASE_RATE the Gallery/prototype still use.
    // Chosen so a notch's motion is still ~95% resolved by ~600ms (roughly
    // double the shared rate's ~300ms), so consecutive notches up to
    // ~150ms apart overlap into continuous motion instead of visibly
    // settling between them. First-frame response is unchanged — this only
    // stretches how long each notch's motion stays visible, never how soon
    // it starts.
    const WHEEL_POSITION_EASE_RATE = 0.08;

    let yaw = spawn.yaw;
    let pitch = 0;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const cameraBody = new THREE.Vector3(spawn.x, EYE_HEIGHT, spawn.z);
    const targetCameraBody = cameraBody.clone();

    const pressedKeys = new Set<string>();
    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;

    // Next-pass handoff (2026-09-07), Stage 1: the campus (not the accepted
    // personal room) computes wheel/keyboard movement direction from the
    // currently RENDERED `yaw` — the same heading `aimCamera()` used to draw
    // the frame you're looking at — not `targetYaw`. Right after a drag,
    // `targetYaw` can be ahead of what's still easing into view; the campus
    // is large and fast enough (2.55 units/sec, big open rooms) that acting
    // on that not-yet-visible target reads as "forward travels right of
    // center." The accepted Gallery keeps its own `targetYaw` basis
    // unchanged (src/lib/visitorController.ts itself is untouched, and
    // VirtualGalleryRoom.tsx's call sites still pass `targetYaw`) — this is
    // a campus-only call-site change, not a second controller.
    //
    // Collision must shorten or stop the requested motion, never redirect
    // it — the old tryMove() retried a blocked move's world-X and world-Z
    // components separately, which could turn a blocked forward/backward
    // press into sideways sliding along a wall. Substeps (instead of one
    // big jump) stop a fast wheel nudge from tunneling across a thin
    // doorway threshold. Reusable for both the continuous WASD path
    // (mutates `cameraBody` directly, same as the accepted room) and the
    // discrete wheel path (mutates `targetCameraBody`, same as the accepted
    // room's own moveCamera) — the position mutated is the caller's choice,
    // matching whichever one the accepted room itself moves for that input.
    function moveWithCollision(position: THREE.Vector3, delta: THREE.Vector3) {
      const distance = delta.length();
      if (distance === 0) return;

      const direction = delta.clone().normalize();
      const maxSubstep = 0.14;
      const steps = Math.max(1, Math.ceil(distance / maxSubstep));
      const step = direction.multiplyScalar(distance / steps);

      for (let index = 0; index < steps; index += 1) {
        const nextX = position.x + step.x;
        const nextZ = position.z + step.z;
        if (!isWalkable(nextX, nextZ, walkable)) break;
        position.x = nextX;
        position.z = nextZ;
      }
    }

    function updateKeyboardMovement(dt: number) {
      if (pressedKeys.size === 0) return;
      walkTween = null; // a held movement/turn key interrupts click-to-walk (view is never touched by the tween, so nothing else to reset)
      const speed = pressedKeys.has("shift") ? WALK_SPEED_SLOW : WALK_SPEED;
      const move = buildKeyboardMoveDirection(
        {
          forward: pressedKeys.has("forward"),
          back: pressedKeys.has("back"),
          left: pressedKeys.has("left"),
          right: pressedKeys.has("right"),
        },
        yaw
      );
      if (move.lengthSq() > 0) {
        move.multiplyScalar(speed * dt);
        moveWithCollision(cameraBody, move);
        cameraBody.y = EYE_HEIGHT;
        targetCameraBody.copy(cameraBody);
      }
      let turn = 0;
      if (pressedKeys.has("turn-left")) turn += 1;
      if (pressedKeys.has("turn-right")) turn -= 1;
      if (turn !== 0) {
        yaw += turn * TURN_RATE * dt;
        targetYaw = yaw;
      }
    }

    function movementKeyToken(e: KeyboardEvent): string | null {
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") return "forward";
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") return "back";
      if (e.key.toLowerCase() === "a") return "left";
      if (e.key.toLowerCase() === "d") return "right";
      if (e.key === "ArrowLeft") return "turn-left";
      if (e.key === "ArrowRight") return "turn-right";
      if (e.key === "Shift") return "shift";
      return null;
    }
    function onKeyDown(e: KeyboardEvent) {
      const token = movementKeyToken(e);
      if (token) {
        e.preventDefault();
        pressedKeys.add(token);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      const token = movementKeyToken(e);
      if (token) pressedKeys.delete(token);
    }
    // A held key's keyup can be missed if focus leaves the window while
    // it's down (alt-tab, clicking browser chrome) — without this it
    // would read as permanently "held."
    function onWindowBlur() {
      pressedKeys.clear();
    }

    function smoothstep(q: number) {
      return q * q * (3 - 2 * q);
    }

    // A center target aims along its travel path. A doorway target uses the
    // cardinal yaw authored from that door's real shared-wall coordinates,
    // lining the camera up with the opening. Free dragging, wheel input, and
    // WASD remain untouched and never snap or rotate on their own.
    type PadAlignTween = {
      fromPos: THREE.Vector3; toPos: THREE.Vector3;
      fromYaw: number; toYaw: number;
      fromPitch: number; toPitch: number;
      t: number; duration: number;
    };
    let walkTween: PadAlignTween | null = null;

    // Interpolates yaw the short way around the circle — otherwise a tween
    // could spin the long way just because the raw yaw values happen to
    // straddle a +-PI wrap.
    function shortestYawDelta(from: number, to: number): number {
      let delta = (to - from) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      return delta;
    }

    // EK's physical report (2026-09-09): target-click movement felt
    // "choppy" — specifically a brief freeze then a jump partway, not a
    // glide the whole way. Root cause: duration was sized ONLY from travel
    // distance, never from how much the view had to turn. A target clicked
    // from nearby (an explicitly supported recenter/realign — "click a pad
    // you're already standing near") could still require close to a full
    // 180-degree turn, and that turn was being squeezed into the SAME
    // ~0.4s floor meant for a barely-moving click. smoothstep's eased
    // start is slow by design; compressed into ~0.4s a big turn spends
    // most of that time barely moving, then most of the rotation happens
    // in the last few frames — which reads exactly as "pause, then jump."
    // Duration now also scales with the actual turn size, so a big
    // reorientation always gets time proportional to how far it turns.
    const ALIGN_TURN_SPEED = Math.PI / 1.1; // rad/sec — a full 180-degree turn takes ~1.1s

    function startWalkTween(destination: THREE.Vector3, destinationYaw: number) {
      const fromPos = cameraBody.clone();
      const travelDistance = fromPos.distanceTo(destination);
      const yawDelta = shortestYawDelta(yaw, destinationYaw);
      const toYaw = yaw + yawDelta;
      const turnAmount = Math.abs(yawDelta) + Math.abs(pitch - 0);
      // Minimum duration is deliberately not ~0 even for a same-spot,
      // no-turn click ("click a pad while already standing near it...
      // recenter and realign" — EK's requirement (7)): the realignment
      // should always be visibly smooth, never an instant unexplained snap.
      const duration = THREE.MathUtils.clamp(
        Math.max(travelDistance / 4.8, turnAmount / ALIGN_TURN_SPEED),
        0.45,
        2.2
      );
      walkTween = {
        fromPos, toPos: destination.clone(),
        fromYaw: yaw, toYaw,
        fromPitch: pitch, toPitch: 0, // level pitch centers the doorway vertically
        t: 0, duration,
      };
      targetCameraBody.copy(destination);
      targetYaw = toYaw;
      targetPitch = 0;
    }

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      didDrag = false;
      startX = e.clientX;
      startY = e.clientY;
    }
    function updateWaypointHover(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObjects(waypointMeshes, false)[0];
      setMarkerHover((hit?.object as THREE.Mesh | undefined) ?? null);
    }

    function onPointerMove(e: PointerEvent) {
      // Hover highlight runs regardless of dragging, same as real hover
      // anywhere else on the page — this is what tells the player which
      // squares are clickable before they click one.
      updateWaypointHover(e.clientX, e.clientY);

      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        didDrag = true;
        walkTween = null; // a real manual look-drag interrupts an in-progress auto-walk
      }
      // Museum Controls Correction Addendum (2026-09-06): this used to
      // have its own invented sign/sensitivity (`+= dx * 0.0008`), which
      // both pointed the wrong way and was ~23% as sensitive as the
      // accepted room's real drag. Now the same shared applyDrag() the
      // personal room itself uses — same sign (`-=`), same sensitivity.
      const dragged = applyDrag(dx, dy, targetYaw, targetPitch, PITCH_LIMIT);
      targetYaw = dragged.targetYaw;
      targetPitch = dragged.targetPitch;
      startX = e.clientX;
      startY = e.clientY;
    }
    // Deliberately on `window`, not the canvas, so a look-drag that
    // started on the canvas still completes if the pointer drifts off it
    // — but gated on `isDragging` (only ever set true by the canvas's OWN
    // pointerdown) so a click elsewhere on the page (Exit link, etc.)
    // can't fall through into a raycast from that element's position.
    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      if (didDrag) return;

      // Click-to-walk only responds to a visible target, never an arbitrary
      // floor point.
      if (!hoveredMarker) return;
      const waypoint = hoveredMarker.userData.waypoint as CampusWaypoint;

      // "Clear all prior waypoint, drag, and movement state" (EK's
      // requirement (4)) — a pad click is a clean reset, not a blend with
      // whatever was happening before it.
      pressedKeys.clear();
      didDrag = false;

      const destination = new THREE.Vector3(waypoint.x, EYE_HEIGHT, waypoint.z);
      const dx = destination.x - cameraBody.x;
      const dz = destination.z - cameraBody.z;
      const destinationYaw = waypoint.kind === "doorway" && waypoint.yaw !== undefined
        ? waypoint.yaw
        : Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, -dz) : yaw;
      startWalkTween(destination, destinationYaw);
    }
    // EK's foreground rejection of the frame-accumulated version of this
    // fix: "Synthetic WheelEvent accumulation does not establish usability
    // ... Remove the behavior where wheel input waits, accumulates, and
    // then arrives as a capped jump ... Compare the campus controller
    // directly with the accepted 3D Gallery controller, including event
    // registration, delta normalization, animation timing, damping, frame
    // updates, and collision application." The prior two attempts
    // (mutating `cameraBody` directly per raw event, then accumulating a
    // capped distance and applying it once per frame) both diverged from
    // what the accepted room (VirtualGalleryRoom.tsx) actually does. Its
    // moveCamera(): (1) is called once per raw wheel event, no
    // accumulation/queue/cap of any kind; (2) does NOT scale by the event's
    // deltaY magnitude at all — it's a fixed WHEEL_STEP per event, sign only
    // (`event.deltaY > 0 ? "back" : "forward"`); (3) mutates
    // `targetCameraBody` immediately and synchronously inside the handler,
    // never `cameraBody`; (4) clamps that target with a simple synchronous
    // bounds check; (5) leaves the RENDERED `cameraBody` untouched — the
    // existing per-frame easeTowardTargets() (already running unconditionally
    // in tick()'s `else` branch below) is what visibly moves the camera,
    // chasing whatever `targetCameraBody` currently is.
    //
    // This is now that same model, one-for-one: onWheel mutates
    // `targetCameraBody` directly, once per raw event, with a fixed
    // WHEEL_STEP magnitude and no accumulation/cap/queue. The one deliberate
    // campus-specific difference (kept, not something to "fix" here) is
    // using `moveWithCollision` — a room-graph substep sweep — in place of
    // the Gallery's simple box `clampPosition`, since the campus's walkable
    // area isn't one rectangle; and using the rendered `yaw` for direction
    // instead of `targetYaw`, per the Stage 1 comment above
    // updateKeyboardMovement (a prior, already-accepted correction — not
    // "merely the calculated direction," but the actual basis the Gallery
    // itself doesn't need to diverge on since its single room has no
    // multi-room heading lag to worry about). Because the mutation is
    // immediate and synchronous, no input is ever queued or released later:
    // each event's motion begins easing on the very next rendered frame from
    // the position that event immediately advanced.
    //
    // Live diagnostics for EK's own physical foreground test — per her
    // instruction, these exist so SHE can see the experienced behavior
    // measured, not as a substitute for her testing it. One entry per raw
    // wheel event (below) plus one entry per rendered frame (pushed in
    // tick()), so "time until the first changed camera frame," "distance
    // applied per frame," and "queued movement remaining" are all real
    // measurements off the live scene graph, not estimates.
    type WheelEventLogEntry = {
      eventTimestamp: number; rawDeltaY: number; normalizedDelta: number;
      requestedDistance: number; appliedDistance: number; collisionAdjustment: number;
      yawAtEvent: number; firstChangedFrameLatencyMs: number | null;
    };
    const wheelEventLog: WheelEventLogEntry[] = [];
    const pendingLatencyProbes: { eventTimestamp: number; beforeCameraBody: THREE.Vector3 }[] = [];

    type FrameLogEntry = { frameTime: number; frameDeltaMs: number; distanceApplied: number; queuedMovementRemaining: number };
    const frameLog: FrameLogEntry[] = [];

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      walkTween = null;
      const eventTimestamp = performance.now();
      const requestedDistance = WHEEL_STEP;
      const signedStep = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      const beforeTarget = targetCameraBody.clone();
      const delta = facingDirection(yaw).multiplyScalar(signedStep);
      moveWithCollision(targetCameraBody, delta);
      targetCameraBody.y = EYE_HEIGHT;
      const appliedDistance = beforeTarget.distanceTo(targetCameraBody);

      wheelEventLog.push({
        eventTimestamp,
        rawDeltaY: e.deltaY,
        normalizedDelta: signedStep,
        requestedDistance,
        appliedDistance,
        collisionAdjustment: requestedDistance - appliedDistance,
        yawAtEvent: yaw,
        firstChangedFrameLatencyMs: null,
      });
      if (wheelEventLog.length > 40) wheelEventLog.shift();
      pendingLatencyProbes.push({ eventTimestamp, beforeCameraBody: cameraBody.clone() });
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // Shared Museum Room Editor pass (2026-09-12): admin-renamed room
    // titles (museum_room_meta.title, fetched inside populateDynamicContent
    // below) — read by the top-of-screen room-label overlay so a rename
    // shows up there too, not just on the Map. Starts empty (every room
    // keeps its normal static label until the async fetch resolves).
    let roomTitleOverrides: Record<string, string> = {};

    // A sentinel that can't equal any real room label (including the
    // empty-string PLAZA/corridor case) — spawning in an unlabeled area
    // otherwise leaves the overlay stuck on its initial "Loading…" text
    // forever, since "" !== "" never trips the update below.
    let lastRoomLabel = "__unset__";
    function currentRoom(x: number, z: number): CampusRoom | undefined {
      return CAMPUS_ROOMS.find((r) => {
        const b = roomBounds(r);
        return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
      });
    }

    const clock = new THREE.Clock();
    let frameId = 0;

    function tick() {
      frameId = window.requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const frameStartBody = cameraBody.clone();

      updateKeyboardMovement(dt);

      if (walkTween) {
        // Position and yaw/pitch ease together toward the selected room
        // center — a target click is the one input allowed to move the view;
        // every other input path
        // (drag, WASD) is untouched and still never rotates on its own.
        walkTween.t = Math.min(1, walkTween.t + dt / walkTween.duration);
        const k = smoothstep(walkTween.t);
        cameraBody.lerpVectors(walkTween.fromPos, walkTween.toPos, k);
        yaw = walkTween.fromYaw + (walkTween.toYaw - walkTween.fromYaw) * k;
        pitch = walkTween.fromPitch + (walkTween.toPitch - walkTween.fromPitch) * k;
        if (walkTween.t >= 1) {
          cameraBody.copy(walkTween.toPos);
          // "At completion, set both yaw and targetYaw to that exact
          // value" (EK's requirement (3)) — exact, not just close after
          // the eased interpolation above.
          yaw = walkTween.toYaw;
          pitch = walkTween.toPitch;
          targetYaw = walkTween.toYaw;
          targetPitch = walkTween.toPitch;
          walkTween = null;
        }
      } else {
        const eased = easeTowardTargets(yaw, targetYaw, pitch, targetPitch, cameraBody, targetCameraBody, false, WHEEL_POSITION_EASE_RATE);
        yaw = eased.yaw;
        pitch = eased.pitch;
      }
      cameraBody.y = EYE_HEIGHT;

      // Diagnostics: one record per rendered frame — "frame delta,"
      // "distance applied per frame" (however it happened: keyboard step or
      // wheel-driven easing), and "queued movement remaining" (how far the
      // rendered body still trails whatever the wheel/keyboard target is).
      const frameTime = performance.now();
      frameLog.push({
        frameTime,
        frameDeltaMs: dt * 1000,
        distanceApplied: cameraBody.distanceTo(frameStartBody),
        queuedMovementRemaining: cameraBody.distanceTo(targetCameraBody),
      });
      if (frameLog.length > 120) frameLog.shift();

      // Resolve "time until the first changed camera frame" for any wheel
      // event still waiting on one: the first tick where the rendered body
      // actually differs from what it was the instant that event fired.
      for (let i = pendingLatencyProbes.length - 1; i >= 0; i -= 1) {
        const probe = pendingLatencyProbes[i];
        if (cameraBody.equals(probe.beforeCameraBody)) continue;
        const entry = wheelEventLog.find((w) => w.eventTimestamp === probe.eventTimestamp);
        if (entry) entry.firstChangedFrameLatencyMs = frameTime - probe.eventTimestamp;
        pendingLatencyProbes.splice(i, 1);
      }

      // Museum Controls Correction Addendum: the accepted room aims its
      // camera via a calculated lookDirection + camera.lookAt(), never a
      // direct rotation assignment — same shared aimCamera() now.
      aimCamera(camera, cameraBody, yaw, pitch);

      const room = currentRoom(cameraBody.x, cameraBody.z);
      const label = room ? (roomTitleOverrides[room.id] || room.label) : "";
      if (label !== lastRoomLabel) {
        lastRoomLabel = label;
        if (roomLabelRef.current) roomLabelRef.current.textContent = label || "Corridor";
      }
      updateRoomLightActivation(cameraBody.x, cameraBody.z);

      renderer.render(scene, camera);
    }
    tick();
    const readyTimer = window.setTimeout(() => setReady(true), 0);

    // Full Museum Scale handoff, Phase 1: a debug hook for live-verifying
    // the required movement correction, same pattern as the accepted
    // personal room's own window.__vltdDebug.
    (window as unknown as { __vltdCampusMoveDebug?: unknown }).__vltdCampusMoveDebug = {
      getCameraBody: () => cameraBody.clone(),
      getYawPitch: () => ({ yaw, pitch, targetYaw, targetPitch }),
      hasActiveWalkTween: () => walkTween !== null,
      triggerWalkTween: (x: number, z: number, destYaw?: number) =>
        startWalkTween(new THREE.Vector3(x, EYE_HEIGHT, z), destYaw ?? yaw),
      getRoomWaypoints: () =>
        waypointMeshes.map((m) => ({ ...(m.userData.waypoint as CampusWaypoint) })),
      triggerWaypointAlign: (waypointId: string) => {
        const waypoint = waypointMeshes.find(
          (m) => (m.userData.waypoint as CampusWaypoint).id === waypointId
        )?.userData.waypoint as CampusWaypoint | undefined;
        if (!waypoint) return false;
        pressedKeys.clear();
        didDrag = false;
        const destination = new THREE.Vector3(waypoint.x, EYE_HEIGHT, waypoint.z);
        const dx = destination.x - cameraBody.x;
        const dz = destination.z - cameraBody.z;
        const destinationYaw = waypoint.kind === "doorway" && waypoint.yaw !== undefined
          ? waypoint.yaw
          : Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, -dz) : yaw;
        startWalkTween(destination, destinationYaw);
        return true;
      },
      setCameraBody: (x: number, z: number, newYaw?: number, newPitch?: number) => {
        walkTween = null;
        cameraBody.set(x, EYE_HEIGHT, z);
        targetCameraBody.copy(cameraBody);
        if (typeof newYaw === "number") {
          yaw = newYaw;
          targetYaw = newYaw;
        }
        if (typeof newPitch === "number") {
          pitch = newPitch;
          targetPitch = newPitch;
        }
      },
      // Verification-only: forces one synchronous repaint, bypassing
      // requestAnimationFrame entirely. A backgrounded automation tab can
      // have rAF throttled to near-zero (documented above the movement
      // code in this file), which otherwise leaves a screenshot showing a
      // stale frame no matter how long the test waits after a debug call.
      forceRender: () => {
        aimCamera(camera, cameraBody, yaw, pitch);
        renderer.render(scene, camera);
      },
      // EK's review of 9d7c122, 751361a, and 9796c72: total/enabled scene
      // lights, each converted room's FULL and PREVIEW group counts and
      // active state separately, deduplicated active-room-id lists (the
      // previous version pushed duplicates before building a Set — didn't
      // change behavior, but made the evidence harder to read), and the
      // current room-or-bridge location — all queryable live, not a
      // source-code estimate.
      getLightCounts: () => {
        function isAncestorVisible(o: THREE.Object3D): boolean {
          let node: THREE.Object3D | null = o;
          while (node) {
            if (!node.visible) return false;
            node = node.parent;
          }
          return true;
        }
        function countLights(root: THREE.Object3D): number {
          let count = 0;
          root.traverse((obj) => {
            if ((obj as THREE.Light).isLight) count += 1;
          });
          return count;
        }
        let totalLights = 0;
        let enabledLights = 0;
        scene.traverse((obj) => {
          if (!(obj as THREE.Light).isLight) return;
          totalLights += 1;
          if (isAncestorVisible(obj)) enabledLights += 1;
        });
        const perRoom: Record<string, {
          full: { lightCount: number; active: boolean };
          preview: { lightCount: number; active: boolean };
        }> = {};
        for (const [roomId, groups] of Object.entries(roomLightGroups) as [CampusRoomId, RoomLightGroups][]) {
          perRoom[roomId] = {
            full: { lightCount: countLights(groups.full), active: groups.full.visible },
            preview: { lightCount: countLights(groups.preview), active: groups.preview.visible },
          };
        }
        return {
          totalLights,
          enabledLights,
          perRoom,
          // Shared-Wall Grid Plan: no more per-connection reveal lights to
          // report separately — every door opening is lit by ordinary room
          // lighting now, same as the accepted personal room.
          location: lastLightLocation,
          fullRoomIds: lastFullRoomIds,
          previewRoomIds: lastPreviewRoomIds,
        };
      },
      // EK's foreground rejection: "The acceptance test is the experienced
      // behavior, not successful synthetic event dispatch." These are for
      // HER own physical mouse test, not a substitute for it — event
      // timestamp, normalized delta, time until the first changed camera
      // frame, distance applied per frame, queued movement remaining, frame
      // delta, and collision adjustment, all measured off the live scene
      // graph as they actually happened.
      getWheelDiagnostics: () => {
        const recentFrames = frameLog.slice(-60);
        const avgFrameMs = recentFrames.length
          ? recentFrames.reduce((sum, f) => sum + f.frameDeltaMs, 0) / recentFrames.length
          : 0;
        return {
          wheelEvents: wheelEventLog.slice(-20),
          recentFrames,
          avgFrameMs,
          avgFps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
        };
      },
      // EK's review of the "three gray tiers at the entrance" report: "Your
      // audit based on local position.y and expected mesh names is
      // insufficient. Inspect every rendered mesh... using world-space
      // bounding boxes." This is exactly that — updateWorldMatrix + Box3 per
      // mesh, filtered to whatever region is passed in, so the offending
      // geometry is identified by where it actually renders, not by what it
      // was named when it was built.
      debugMeshesInRegion: (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
        const results: { name: string; geometry: string; color: string | null; min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[] = [];
        scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.updateWorldMatrix(true, false);
          const box = new THREE.Box3().setFromObject(obj);
          if (box.max.x < x0 || box.min.x > x1) return;
          if (box.max.y < y0 || box.min.y > y1) return;
          if (box.max.z < z0 || box.min.z > z1) return;
          const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
          const color = mat && "color" in mat ? `#${(mat as THREE.MeshStandardMaterial).color.getHexString()}` : null;
          results.push({
            name: obj.name || "(unnamed)",
            geometry: obj.geometry.type,
            color,
            min: { x: box.min.x, y: box.min.y, z: box.min.z },
            max: { x: box.max.x, y: box.max.y, z: box.max.z },
          });
        });
        return results;
      },
      // Shared-Wall Grid Plan, required evidence: "mesh, material, texture,
      // and light counts before and after." Walks the live scene graph
      // directly rather than estimating from source, since materials/
      // textures can be shared instances (counted once) or per-mesh
      // (counted per mesh) depending on the call site.
      getSceneStats: () => {
        let meshCount = 0;
        let lightCount = 0;
        const materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>();
        let geometryCount = 0;
        scene.traverse((obj) => {
          if ((obj as THREE.Light).isLight) lightCount += 1;
          if (obj instanceof THREE.Mesh) {
            meshCount += 1;
            geometryCount += 1;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              materials.add(m);
              for (const key of ["map", "bumpMap", "emissiveMap"] as const) {
                const tex = (m as THREE.MeshStandardMaterial)[key as keyof THREE.MeshStandardMaterial];
                if (tex instanceof THREE.Texture) textures.add(tex);
              }
            }
          }
        });
        return { meshCount, geometryCount, materialCount: materials.size, textureCount: textures.size, lightCount };
      },
    };

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      contentCancelled = true;
      window.clearTimeout(readyTimer);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      pressedKeys.clear();
      // Visual Overnight Pass (2026-09-10): every room material here carries
      // at least one generated CanvasTexture (wall panels, ceiling bays,
      // floor stone, sign faces/labels, artwork) — material.dispose() alone
      // does not release the textures assigned to it, only the material
      // object itself. Disposing every known texture slot alongside each
      // material closes that gap.
      function disposeMaterialTextures(material: THREE.Material) {
        const maps = material as Partial<
          Record<"map" | "bumpMap" | "emissiveMap" | "alphaMap" | "roughnessMap" | "metalnessMap" | "normalMap", THREE.Texture | null>
        >;
        maps.map?.dispose();
        maps.bumpMap?.dispose();
        maps.emissiveMap?.dispose();
        maps.alphaMap?.dispose();
        maps.roughnessMap?.dispose();
        maps.metalnessMap?.dispose();
        maps.normalMap?.dispose();
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => { disposeMaterialTextures(m); m.dispose(); });
          else { disposeMaterialTextures(material); material.dispose(); }
        }
      });
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      // Real Gallery Environments pass: releases every createGalleryFinishes()
      // instance built for a styled room's materials/lighting above — its own
      // dispose() releases any of its textures/materials not already caught
      // by the generic scene.traverse pass just above (e.g. any left
      // unattached to a visible mesh).
      styledFinishesForDisposal.forEach((finishes) => finishes.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    // Deliberately mount-only — `spawn` is read once to place the camera;
    // re-running this multi-second scene-build effect on every searchParams
    // change would rebuild the entire campus, which is never the intent
    // here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared Museum Room Editor consolidation pass (2026-09-12): the numbered
  // placement-slot overlay/projection/drag system that used to live here
  // (its own rAF projection loop, window-level pointer drag handling,
  // click-to-arm state, and JSX) is gone — "Add Items / Edit Room" now
  // opens MuseumRoomPopup.tsx instead, which runs the shared Organize
  // system from organizeSlots.tsx (the same one VirtualGalleryRoom.tsx
  // uses) in its own small, focused scene. This walkable campus view no
  // longer has an editing mode of its own.

  return (
    <div className="fixed inset-0 bg-[#081527]">
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />

      {/* Center aiming reticle (EK's directional-pad spec, item 2): subtle,
          fixed regardless of look direction — shows exactly where the
          camera is aimed, so a pad's authored yaw landing dead-center is
          visibly confirmable, not just assumed. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full border border-white/35" />
        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <Link
            href="/museum"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70"
          >
            ← Exit to Exhibitions
          </Link>
          <div className="rounded-full bg-black/55 px-4 py-2 text-right ring-1 ring-white/15 backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">VLTD Museum — preview</div>
            <div ref={roomLabelRef} className="text-sm font-semibold text-white">Loading…</div>
          </div>
        </div>

        <div className="mx-auto rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white/75 ring-1 ring-white/15 backdrop-blur">
          Click a glowing target to align or move to a room center · drag to look around · scroll to step
        </div>
      </div>

      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
          Building the campus…
        </div>
      ) : null}

    </div>
  );
}
