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
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
  wallFaceSign,
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
  // Stall indicator (2026-09-15, EK-reported: still lags entering doors —
  // "if it a loading issue, then check that or make a indication that its
  // happening, don't make it feel like its a bad App"). Toggled
  // imperatively from inside tick() below, same pattern as roomLabelRef,
  // rather than React state — a render-loop hot path is the wrong place
  // to trigger React re-renders every frame.
  const stallIndicatorRef = useRef<HTMLDivElement | null>(null);
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
      // Entry corridor pass (2026-09-14, EK): "add the image of the sky
      // with clouds above" — this was an 8px-wide vertical strip (no room
      // for any horizontal detail) since scene.background renders a plain
      // THREE.Texture as a static full-screen backdrop, not an
      // equirectangular skybox — it never needed width before because it
      // never varied with camera direction. Widened so soft cloud shapes
      // can actually be drawn into it, dimmed to this scene's own
      // dusk-navy palette rather than bright daylight clouds that would
      // clash with the existing fog/lighting.
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, "#1c3352");
      gradient.addColorStop(0.55, "#102240");
      gradient.addColorStop(1, "#081527");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      function cloud(cx: number, cy: number, scale: number, alpha: number) {
        const blobs: [number, number, number][] = [
          [0, 0, 1], [0.6, 0.08, 0.75], [-0.6, 0.1, 0.7], [0.22, -0.14, 0.6], [-0.28, -0.1, 0.55],
        ];
        for (const [dx, dy, s] of blobs) {
          const r = 46 * scale * s;
          const x = cx + dx * 90 * scale;
          const y = cy + dy * 40 * scale;
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
          glow.addColorStop(0, `rgba(214,225,240,${alpha})`);
          glow.addColorStop(1, "rgba(214,225,240,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      cloud(90, 55, 1.15, 0.22);
      cloud(270, 35, 0.85, 0.16);
      cloud(410, 78, 1.3, 0.2);
      cloud(180, 105, 0.6, 0.12);

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

    // Reverted (2026-09-13): a warm-shifted version of this scene-wide
    // ambient was tried here briefly to fix Grand Hall's cool cast, but it's
    // a GLOBAL light (every room, not just HUB) and live-checking it against
    // more than HUB found it turned the corridor and other neutral rooms a
    // muddy olive-brown — a real regression, reverted back to the original
    // values every other room was already tuned against. HUB's own warmth
    // now comes only from HUB-local lights (wallWashSpots/warmFillSpots
    // below in the Grand Hall block), never from a scene-wide change.
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
      // Grand Hall GLB pass (2026-09-13): the shared shell also builds 4
      // thin perimeter trim boxes right at the wall top (buildCeilingAndTrim,
      // campusRoomBuilder.ts) using a material never captured before now —
      // a room replacing its own ceiling with a real asset (currently only
      // HUB) needs to hide these too, or they render in front of it.
      ceilingTrim?: THREE.MeshStandardMaterial;
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
      shellEntry(room.id).ceilingTrim = shell.ceilingTrimMaterial;
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
    // Perf fix (2026-09-13, live lag investigation): these were originally
    // 1254x1254 PNGs at 1.9-2.8MB EACH (12 files) — near-lossless encodes of
    // photographic stone textures, which is massive overkill for a live
    // WebGL texture and was directly responsible for multi-second load
    // stalls (measured via performance.getEntriesByType('resource') against
    // the live page: several individual textures took 3+ real seconds to
    // download+decode). Converted to WebP at the same resolution (basecolor
    // q85, normal q92 since lighting direction is more sensitive to
    // compression there, roughness q85) — total for all 12 files dropped
    // from ~14MB to under 1MB, no visible quality change (spot-checked).
    function buildStoneMaterial(prefix: string, repeatX: number, repeatY: number, metalness: number, normalScale: number): THREE.MeshStandardMaterial {
      const map = loadGrandHallTexture(`${prefix}-basecolor.webp`, THREE.SRGBColorSpace, repeatX, repeatY);
      const normalMap = loadGrandHallTexture(`${prefix}-normal.webp`, THREE.NoColorSpace, repeatX, repeatY);
      const roughnessMap = loadGrandHallTexture(`${prefix}-roughness.webp`, THREE.NoColorSpace, repeatX, repeatY);
      return new THREE.MeshStandardMaterial({
        // EK's correction: explicit neutral white color so the texture's own
        // (confirmed genuinely warm-cream, not gray) basecolor is never
        // multiplied by an unintended tint.
        color: 0xffffff,
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
      // EK's correction (2026-09-13): repeatY was left at 1, so the texture
      // covered the ENTIRE 9.15-unit wall height in one tile — scaleWallPanelU
      // (campusRoomBuilder.ts) only rescales the geometry's U coordinate per
      // wall-box span, never V, so the material's own repeat.y is the only
      // thing governing vertical tiling. Matching the same ~4.2-unit physical
      // tile convention PANEL_WIDTH already uses for the horizontal axis
      // fixes the stretch (previously reading almost like a giant blurred
      // single sample rather than real stone).
      const material = roomId === "HUB"
        ? buildStoneMaterial("ivory-limestone", 1, WALL_HEIGHT / 4.2, 0.02, 0.4)
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

      // --- Materials ---------------------------------------------------
      const marbleFloorMaterial = buildStoneMaterial("warm-ivory-marble", hub.w / 10.5, hub.d / 10.5, 0.03, 0.45);
      const charcoalMaterial = buildStoneMaterial("charcoal-marble", 8, 8, 0.05, 0.4);

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
        // Real bug fix (2026-09-15) — see wallFaceSign()'s own comment in
        // campusLayout.ts: the old `segment.roomA === "HUB" ? -1 : 1` broke
        // for a solo exterior wall (roomB: null) on the geometric "low"
        // side of its boundary. HUB has no such wall today (every side
        // borders a real neighbor), so this had no visible effect here,
        // but it's the same provably-safe fix as the other two sites this
        // pattern was actually broken on (POP_CULTURE's armor/trim).
        const facingSign = wallFaceSign(segment, "HUB");
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

      // --- Ceiling, temporary Blender asset (EK, 2026-09-13): every earlier
      // ceiling treatment (procedural coffers, the stretched atlas image,
      // the first GLB attempt) is replaced with this approved-temporary
      // modeled asset, grand-hall-ceiling-blender-v1.glb — 6 pre-merged
      // meshes with their own embedded materials/textures, already built to
      // the Hall's real 63x78 footprint. Not a final photoreal design, per
      // EK's own framing — just get it installed correctly. No scale
      // change, no material/texture override this time (kept exactly as
      // authored, per EK's explicit "do not redesign or modify the asset").
      // Every one of this GLB's 6 top-level node translations already reads
      // as absolute world-scale coordinates centered on the room's own
      // local origin (e.g. y values of ~9.03-12.8, matching WALL_HEIGHT
      // 9.15 plus a raised skylight ridge above it; x/z offsets up to
      // ~±22.6/±38.65, within HUB's real ±31.5/±39 half-extents) — so the
      // whole scene only needs to be recentered on HUB's real X/Z, with NO
      // additional Y shift (unlike the first GLB, which needed +WALL_HEIGHT
      // because ITS own datum was authored at local Y=0).
      // The shared shell's own flat ceiling plane is still hidden (untouched
      // otherwise, same mechanism as every prior pass) since this model
      // replaces it.
      // Real bug found live (2026-09-13): the shared shell ALSO builds 4
      // thin perimeter trim boxes right at the wall top, in a material
      // never previously captured/hidden — every earlier ceiling pass sat
      // low enough (installed below wallHeight) to physically occlude them
      // by coincidence, but this GLB's own datum installs exactly at
      // wallHeight, at or above where those trim boxes sit, so they were
      // rendering IN FRONT of the new ceiling instead of being hidden
      // behind it — the exact "flat dark ceiling with bright trim lines"
      // look that showed up on the first live check. Hidden the same way.
      const hubCeilingMaterial = roomShellMaterialsByRoomId.get("HUB")?.ceiling;
      const hubCeilingTrimMaterial = roomShellMaterialsByRoomId.get("HUB")?.ceilingTrim;
      if (hubCeilingMaterial || hubCeilingTrimMaterial) {
        scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          if (obj.material === hubCeilingMaterial || obj.material === hubCeilingTrimMaterial) obj.visible = false;
        });
      }

      // Free-floating skylight lights, real root cause (2026-09-14,
      // EK-reported and re-confirmed live after an earlier fix targeted
      // the wrong mesh entirely). The GLB's own meshes are all named
      // GH_Merged_GH_* BufferGeometry objects — none of them are
      // CircleGeometry, so the earlier attempt (hunting for that geometry
      // type inside the loaded GLB's own traverse) silently hid nothing.
      // The actual floating discs are buildNeutralShell()'s generic
      // per-room ceiling-fixture rig (buildLegacyRoomLightRig(),
      // campusRoomBuilder.ts — 6 CircleGeometry discs for HUB, one per
      // row, at wallHeight-0.03), confirmed live via debugMeshesInRegion()
      // to exist not just in HUB but at the same relative height in every
      // other room's own centerline too — a campus-wide fixture, not
      // something baked into this GLB at all. It was never built to sit
      // this low: at a normal ~9.15-high flat ceiling it would sit flush
      // against it, but HUB's real coffered ceiling peaks far higher, so
      // the fixture discs hang in open air well below it. HUB's own
      // shellFixtures group (captured in roomShellMaterialsByRoomId the
      // same way its ceiling material is, right above) is hidden outright
      // — the Grand Hall's own coffer glow/downlight/wall-wash lighting
      // already covers this room, making the generic rig's disc meshes
      // both wrong-looking and redundant here.
      const hubShellFixtures = roomShellMaterialsByRoomId.get("HUB")?.shellFixtures;
      if (hubShellFixtures) hubShellFixtures.visible = false;

      const ceilingGltfLoader = new GLTFLoader();
      ceilingGltfLoader.load(
        "/museum/grand-hall/grand-hall-ceiling-blender-v1.glb",
        (gltf) => {
          if (contentCancelled) return;
          const model = gltf.scene;
          // No scale change. X/Z recentered on HUB's real center; Y left at
          // 0 (no vertical shift) since this asset's own node translations
          // already read as real, already-correct absolute heights — see
          // the comment above this block for the reasoning.
          model.position.set(hubCenter.x, 0, hubCenter.z);
          // Materials/textures kept exactly as embedded in the GLB, per
          // EK's explicit instruction — no traversal, no overrides.
          grandHallGroup.add(model);
          // Choppy-turning fix (2026-09-14, EK-reported: "very slow and
          // choppy when scrolling up and sideways"). Measured live via
          // getWheelDiagnostics()/getSceneStats(): looking up at this GLB's
          // ceiling the first time after page load stalled for 40+ seconds
          // (5 forced renders immediately afterward took 53ms total — fast
          // — confirming a one-time shader-compile stall, not an ongoing
          // per-frame cost; only 7 of the scene's 167 lights are ever
          // active at once per getLightCounts(), ruling out lighting load).
          // populateDynamicContent() below already calls renderer.compile()
          // once to precompile everything precisely to avoid this class of
          // stall — but this GLB loads independently and finishes on its
          // own schedule, so its ~300 materials were never included in
          // that pass. Precompiling them here, the moment they're actually
          // added, closes that gap for the single largest source of
          // never-before-seen materials in the campus.
          renderer.compile(scene, camera);
        }
      );

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

      // --- VLTD outer compass — swapped 2026-09-14 (EK, fully-specified
      // work order, DO-LAST item on the punch list) from the runtime
      // canvas-drawn rings/compass-points below to the real approved
      // artwork, vltd-grand-hall-compass-inlay-v2.png. Same footprint
      // (CircleGeometry(9, 48), same position) and re-sequencing after the
      // marble floor as the canvas version this replaces — only the
      // texture source changed. The seal/logo mesh right after this block
      // is untouched.
      const medallionTexture = new THREE.TextureLoader().load(
        "/museum/grand-hall/vltd-grand-hall-compass-inlay-v2.png"
      );
      medallionTexture.colorSpace = THREE.SRGBColorSpace;
      medallionTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const medallion = new THREE.Mesh(
        new THREE.CircleGeometry(9, 48),
        new THREE.MeshStandardMaterial({
          map: medallionTexture,
          roughness: 0.9,
          transparent: true,
          alphaTest: 0.02,
        })
      );
      medallion.rotation.x = -Math.PI / 2;
      // A hair above the old canvas version's own 0.02 so the new, real
      // artwork and the center logo mesh right after it (still at its own
      // 0.028) don't z-fight, while both stay visually flush with the
      // marble floor beneath (0.01/0.014).
      medallion.position.set(hubCenter.x, 0.022, hubCenter.z);
      scene.add(medallion);

      // The compass was designed with an open center. Place the VLTD seal in
      // that field as a separate, transparent floor inlay so the surrounding
      // rings and eight-point compass remain visible. This is visual only and
      // sits flush enough to avoid affecting movement or collision.
      // Perf fix (2026-09-13, live lag investigation): this PNG was a
      // needlessly heavy 2.4MB for a 1254x1254 image (near-lossless
      // encoding of a mostly-flat graphic) — converted to WebP at the same
      // resolution with alpha preserved, ~372KB, no visible quality change.
      const vltdSealTexture = new THREE.TextureLoader().load(
        "/brand/vltd-museum-floor-medallion-v1.webp"
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

    // Entry corridor pass (2026-09-14, EK): "the museum Entry - Add the
    // same marbles flooring and walls here in the entry point" — PLAZA
    // (the "Corridor" HUD label is its own empty-`label` fallback text;
    // this IS PLAZA) still sat on the plain gray shared-shell finish while
    // HUB's Grand Hall next door got real marble/limestone. Same thin
    // overlay-on-top-of-the-existing-shell technique the Grand Hall pass
    // above uses (buildStoneMaterial, already in scope) — PLAZA's own
    // dimensions/doors/nav targets/camera/every other room are untouched.
    // PLAZA is `noWalls` (builds none of its own), so its "walls" are
    // actually SPOTLIGHT's east face and STORE's west face, built and
    // materialed by THOSE rooms — this only adds a thin skin flush against
    // the inward side of each, the same way HUB's own base-trim overlay
    // sits proud of that room's existing wall without touching
    // campusRoomBuilder.ts's shared wall-building code.
    {
      const plaza = roomById("PLAZA");
      const plazaBounds = roomBounds(plaza);
      const plazaCenter = roomCenter(plaza);
      const plazaGroup = new THREE.Group();
      plazaGroup.name = "plaza-entry-enhancement";
      scene.add(plazaGroup);

      const marbleFloorMaterial = buildStoneMaterial("warm-ivory-marble", plaza.w / 10.5, plaza.d / 10.5, 0.03, 0.45);
      const marbleFloor = new THREE.Mesh(new THREE.PlaneGeometry(plaza.w, plaza.d), marbleFloorMaterial);
      marbleFloor.rotation.x = -Math.PI / 2;
      marbleFloor.position.set(plazaCenter.x, 0.01, plazaCenter.z);
      plazaGroup.add(marbleFloor);

      const limestoneWallMaterial = buildStoneMaterial("ivory-limestone", plaza.d / 4.2, WALL_HEIGHT / 4.2, 0.02, 0.4);
      const wallSkinThickness = 0.05;
      const wallSkinOffset = WALL_THICKNESS / 2 + wallSkinThickness / 2 + 0.006;
      const westSkin = new THREE.Mesh(
        new THREE.BoxGeometry(wallSkinThickness, WALL_HEIGHT, plaza.d),
        limestoneWallMaterial
      );
      westSkin.position.set(plazaBounds.x0 + wallSkinOffset, WALL_HEIGHT / 2, plazaCenter.z);
      plazaGroup.add(westSkin);
      const eastSkin = new THREE.Mesh(
        new THREE.BoxGeometry(wallSkinThickness, WALL_HEIGHT, plaza.d),
        limestoneWallMaterial
      );
      eastSkin.position.set(plazaBounds.x1 - wallSkinOffset, WALL_HEIGHT / 2, plazaCenter.z);
      plazaGroup.add(eastSkin);

      // North wall (shared with HUB, the real museum entrance) — EK's
      // correction (2026-09-14): "side wall are done but not the on in
      // front of me." Missed in the first pass. The west/east skins above
      // walk computeCampusWallSegments()'s own per-boundary segments, but
      // the museum entrance's "restrained wider casing + integrated VLTD
      // MUSEUM header" (built by its own dedicated isMuseumEntrance() path,
      // not the ordinary door-casing system) turned out not to produce a
      // normal solid/door-gap split there — that loop found nothing to
      // skin (confirmed live: zero matching segments). Using the same
      // CAMPUS_DOORS-driven gap exclusion the north-wall item-placement
      // code above already uses instead: two flanking pieces either side
      // of the entrance's own real gapCenter, with extra margin beyond the
      // ordinary DOORWAY_NO_DISPLAY_HALF_WIDTH since this casing is wider
      // than a standard door's.
      const entranceDoor = CAMPUS_DOORS.find(
        (d) => d.wall === "x" && d.at === plazaBounds.z1 && d.rooms.includes("PLAZA")
      );
      const entranceHalfWidth = DOORWAY_NO_DISPLAY_HALF_WIDTH + 1.2;
      const northPieces: { from: number; to: number }[] = entranceDoor
        ? [
            { from: plazaBounds.x0, to: entranceDoor.gapCenter - entranceHalfWidth },
            { from: entranceDoor.gapCenter + entranceHalfWidth, to: plazaBounds.x1 },
          ]
        : [{ from: plazaBounds.x0, to: plazaBounds.x1 }];
      for (const piece of northPieces) {
        const span = piece.to - piece.from;
        if (span <= 0.05) continue;
        const northSkin = new THREE.Mesh(
          new THREE.BoxGeometry(span, WALL_HEIGHT, wallSkinThickness),
          limestoneWallMaterial
        );
        northSkin.position.set((piece.from + piece.to) / 2, WALL_HEIGHT / 2, plazaBounds.z1 - wallSkinOffset);
        plazaGroup.add(northSkin);
      }

      // Wall-wash lighting (2026-09-15, EK-reported: close-up inspection
      // confirmed the marble/limestone textures above are correctly there
      // — real grain, pits, mottling all visible up close — but PLAZA's
      // own ambient light is dim enough that none of it reads at a normal
      // viewing distance, the same real gap HUB's own Grand Hall wall-wash
      // pass already found and fixed for its walls. Same technique
      // (modest warm point lights, mid-wall-height, inset from the wall
      // face) sized to PLAZA's own corridor shape instead of copying
      // HUB's 4-symmetric-sides layout: west/east walls each get one at
      // mid-depth, the north (entrance) wall gets one of its own since
      // that's where the marble floor and compass are most visible: PLAZA
      // has no south wall at all (its true exterior edge, open to the
      // facade), so there's nothing to wash there.
      const plazaWashSpots: { x: number; z: number }[] = [
        { x: plazaBounds.x0 + 2.5, z: plazaCenter.z },
        { x: plazaBounds.x1 - 2.5, z: plazaCenter.z },
        { x: plazaCenter.x, z: plazaBounds.z1 - 2.5 },
      ];
      for (const spot of plazaWashSpots) {
        const wash = new THREE.PointLight(0xffdcae, 0.85, 30, 2);
        wash.position.set(spot.x, WALL_HEIGHT * 0.58, spot.z);
        plazaGroup.add(wash);
      }
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
    shellEntry("POP_CULTURE").ceilingTrim = popCultureLights.ceilingTrimMaterial;
    shellEntry("POP_CULTURE").shellFixtures = popCultureLights.shellFixtures;

    const tcgLights = buildRoomShell(scene, tcgModule);
    const tcgWallSpans = computeUsableWallSpans(tcgModule);
    shellEntry("TCG").floor = tcgLights.floorMaterial;
    shellEntry("TCG").ceiling = tcgLights.ceilingMaterial;
    shellEntry("TCG").ceilingTrim = tcgLights.ceilingTrimMaterial;
    shellEntry("TCG").shellFixtures = tcgLights.shellFixtures;

    const collectionLights = buildRoomShell(scene, collectionModule);
    const collectionWallSpans = computeUsableWallSpans(collectionModule);
    shellEntry("COLLECTION").floor = collectionLights.floorMaterial;
    shellEntry("COLLECTION").ceiling = collectionLights.ceilingMaterial;
    shellEntry("COLLECTION").ceilingTrim = collectionLights.ceilingTrimMaterial;
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
    function placeRoomItems(
      wallSpans: ReturnType<typeof computeUsableWallSpans>,
      lightGroups: RoomLightGroups,
      items: VaultItem[],
      // Frame styles pass (2026-09-14): the room's own chosen style,
      // resolved by the caller (populateDynamicContent, where roomMeta —
      // a local const there, not in scope in this sibling function — is
      // read). Defaults to "classic" so no existing caller changes look.
      frameStyle: "classic" | "gallery" = "classic"
    ) {
      const urls = items.map((item) => ({ url: getPrimaryImageUrl(item) })).filter((it): it is { url: string } => Boolean(it.url));
      placeArtwork(scene, textureLoader, lightGroups, wallSpans, urls, WALL_THICKNESS, EYE_HEIGHT, () => contentCancelled, frameStyle);
    }

    async function populateDynamicContent() {
      const [itemsPerRoom, spotlightPrograms, storeItems, roomMeta] = await Promise.all([
        getItemsPerRoom(),
        getActiveSpotlightPrograms(),
        getEnabledStoreItems(),
        getAllRoomMeta(),
      ]);
      // Frame styles pass (2026-09-14): resolved once here (roomMeta is
      // local to this function) and passed down to placeRoomItems/
      // placeItemsAtSlots, which don't have access to it themselves.
      const frameStyleFor = (roomId: CampusRoomId): "classic" | "gallery" =>
        roomMeta[roomId]?.frame_style === "gallery" ? "gallery" : "classic";
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
        placeItemsAtSlots(scene, textureLoader, groups, [...wallSlots, ...shelfSlots], bySlot, () => contentCancelled, frameStyleFor(roomId));
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
        placeRoomItems(popCultureWallSpans, popCultureLights, popItems, frameStyleFor("POP_CULTURE"));
      }

      if (!curatedItemsByRoom.has("TCG")) {
        const tcgItems = allItems
          .filter((item) => itemUniverse(item) === "TCG")
          .slice(0, itemsPerRoom);
        placeRoomItems(tcgWallSpans, tcgLights, tcgItems, frameStyleFor("TCG"));
      }

      if (!curatedItemsByRoom.has("COLLECTION")) {
        // assignSwingRoomUniverses() always names a universe for COLLECTION,
        // even when every swing universe's real count is tied at zero — only
        // trust that assignment here if it actually has real items behind it.
        const collectionUniverses = (roomUniverses.COLLECTION ?? []).filter(
          (universe) => (universeCounts[universe] ?? 0) > 0
        );
        const collectionItems = selectCollectionItems(allItems, collectionUniverses, itemsPerRoom);
        placeRoomItems(collectionWallSpans, collectionLights, collectionItems, frameStyleFor("COLLECTION"));
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

      // Live-reported bug (2026-09-13, EK): "it gets stuck the first time I
      // enter each room, then it works" — WebGL only compiles a material's
      // shader program the first time it's actually drawn, and this scene
      // adds a lot of new per-room material variants (this async pass's own
      // style-patched wall/floor/ceiling materials, wall armor, display
      // cases/shelves, plus every room's base shell) — walking into a room
      // whose materials were never yet on-screen pays that compile cost as
      // an in-game freeze, exactly matching "first time, then fine".
      // renderer.compile() forces every material currently in the scene
      // graph to compile up front in one pass instead of scattering that
      // cost across each room's first real visit. Not exhaustive — an item
      // image texture that finishes loading later (after this point) still
      // compiles on its own first appearance — but this covers the bulk of
      // it (every room's real wall/floor/ceiling/armor/case material).
      if (!contentCancelled) renderer.compile(scene, camera);

      // Light-count shader-variant fix (2026-09-15, EK-reported: "in this
      // room, spinning around is still lagging, this wasn't an issue a few
      // days ago" — POP_CULTURE specifically, which gained its own real
      // per-room lighting in the 2026-09-13 Vault-parity pass). The
      // compile() call just above only warms whatever shader variant
      // Three.js needs for the light configuration ACTIVE in the scene at
      // the moment it runs — every room's own "full" light group (its
      // real SpotLights/PointLights) is still invisible at this point,
      // since the visitor hasn't walked near any of them yet, so
      // materials lit by those lights get compiled for a "lights off"
      // variant. The first time a room's real lights actually switch on
      // (walking into proximity), WebGL has to compile a fresh variant
      // for the new light count — a stall right on entry, matching
      // "spinning around is lagging in this room." Briefly activating
      // each editable room's own light group, compiling, then restoring
      // its real (still-inactive) state warms the variant that's
      // actually needed at runtime instead of waiting for the visitor to
      // trigger it.
      if (!contentCancelled) {
        for (const styledRoomId of EDITABLE_ROOM_IDS) {
          const groups = roomLightGroups[styledRoomId] ?? ensureRoomLightGroups(styledRoomId);
          const wasVisible = groups.full.visible;
          groups.full.visible = true;
          renderer.compile(scene, camera);
          groups.full.visible = wasVisible;
        }
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

    // Chevron target redesign (2026-09-14, EK): "change these boxes in the
    // doorways to Chevron style arrowing pointing in the direction they
    // will make the view face, the one in the center of the room should
    // have 4 small chevrons pointing in each direction, keep the same size
    // and color." Replaces the old four-corner-bracket square (same glow
    // technique, same colors/line weights, kept below) with (a) one
    // chevron for doorway waypoints, aimed at that waypoint's own real
    // destinationYaw, and (b) four small chevrons — one per cardinal
    // direction — for every room-center waypoint.
    //
    // A chevron is drawn pointing toward the canvas's top edge (apex up,
    // angle 0). With THREE.PlaneGeometry's default UV mapping (v=1 at the
    // plane's local +Y) and CanvasTexture's default flipY (canvas row 0 —
    // the top — becomes v=1), "toward the canvas top" is the plane's local
    // +Y edge. This marker lies flat via rotation.x = -Math.PI/2, which
    // maps local +Y to world -Z (Rx(-90°): y'=z, z'=-y), so a zero-rotation
    // chevron already points world -Z. Doorway markers get one further
    // marker.rotateOnWorldAxis(Y, -waypoint.yaw) — verified against all 4
    // yaw values computeCampusWaypoints() emits (0, PI, ±PI/2) by checking
    // the rotated (-Z) vector matches visitorController.ts's own
    // forward(yaw) = (sin(yaw), 0, -cos(yaw)) in every case.
    function drawChevron(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, angle = 0, legFactor = 0.7) {
      const half = size / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-half, half * legFactor);
      ctx.lineTo(0, -half * legFactor);
      ctx.lineTo(half, half * legFactor);
      ctx.stroke();
      ctx.restore();
    }

    function makeChevronTexture(chevrons: { cx: number; cy: number; size: number; angle?: number; legFactor?: number }[]) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const draw = () => {
        for (const c of chevrons) drawChevron(ctx, c.cx, c.cy, c.size, c.angle ?? 0, c.legFactor ?? 0.7);
      };

      ctx.strokeStyle = "rgba(49,205,255,0.72)";
      ctx.lineWidth = 13;
      ctx.shadowColor = "rgba(25,190,255,0.95)";
      ctx.shadowBlur = 18;
      draw();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#8fe8ff";
      ctx.lineWidth = 6;
      draw();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    // One chevron, centered, pointing "up" (world -Z at zero extra
    // rotation) — doorway markers rotate this to their own real yaw below.
    const doorwayChevronTexture = makeChevronTexture([{ cx: 64, cy: 64, size: 68 }]);
    // Four small chevrons, each pointing outward from the room's own
    // center — same overall footprint as the old four-corner-bracket look.
    // EK's live-review correction (2026-09-14): the first version (wider
    // "0.7 leg factor" chevrons close to the middle) read as one continuous
    // diamond/star outline from directly above, not 4 separate arrows —
    // confirmed live via a top-down screenshot before this fix. Pushed
    // further out toward the marker's own edge and narrowed (0.5 leg
    // factor, a more pointed arrowhead) so each stays visually isolated
    // with real empty space between it and its neighbors, reading as 4
    // distinct outward-pointing arrows instead of one shape.
    const roomCenterChevronTexture = makeChevronTexture([
      { cx: 64, cy: 20, size: 26, angle: 0, legFactor: 0.5 },              // north: points up
      { cx: 64, cy: 108, size: 26, angle: Math.PI, legFactor: 0.5 },       // south: points down
      { cx: 108, cy: 64, size: 26, angle: Math.PI / 2, legFactor: 0.5 },   // east: points right
      { cx: 20, cy: 64, size: 26, angle: -Math.PI / 2, legFactor: 0.5 },   // west: points left
    ]);
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
      const isDoorway = waypoint.kind === "doorway";
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(targetSize, targetSize),
        new THREE.MeshBasicMaterial({
          map: (isDoorway ? doorwayChevronTexture : roomCenterChevronTexture) ?? undefined,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      marker.rotation.x = -Math.PI / 2;
      if (isDoorway && waypoint.yaw !== undefined) {
        marker.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -waypoint.yaw);
      }
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
        if (isWalkable(nextX, nextZ, walkable)) {
          position.x = nextX;
          position.z = nextZ;
          continue;
        }
        // Doorway stuck-collision fix (2026-09-14, EK-reported: "still
        // getting stuck in doorways when scrolling in"). Root cause: a
        // doorway's walkable "bridge" (computeDoorBridges(), campusLayout.ts)
        // is exactly the door's own visual width with no side margin,
        // unlike a room's own floor (inset a full WALKABLE_MARGIN from
        // every wall) — and this loop only ever tried the FULL combined
        // (x,z) step, stopping outright the instant that combined point
        // fell outside walkable ground. onWheel's own scroll-forward delta
        // is built from the camera's raw facing direction (facingDirection
        // (yaw) * step), not snapped to the doorway's own axis, so scrolling
        // in even slightly off-center produces a diagonal step that clips
        // the bridge's exact-width edge and halts completely — reads as
        // stuck right at the threshold. Slide along whichever single axis
        // is still walkable instead of stopping outright, the standard
        // fix for this exact class of narrow-passage collision.
        const xOnlyWalkable = isWalkable(nextX, position.z, walkable);
        const zOnlyWalkable = isWalkable(position.x, nextZ, walkable);
        if (xOnlyWalkable) {
          position.x = nextX;
        } else if (zOnlyWalkable) {
          position.z = nextZ;
        } else {
          break;
        }
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
    // Stall indicator (2026-09-15): a frame whose REAL elapsed time (before
    // the 0.05s movement-smoothing clamp below) is unusually long means the
    // main thread was blocked on something heavy — a new room's uncompiled
    // shaders, a texture still streaming in, GC — the exact class of stall
    // already root-caused for the Grand Hall GLB and precompiled for, but
    // which can still happen anywhere new content enters view for the
    // first time. Flashing a brief "Loading…" hint on any such frame turns
    // an unexplained freeze into visible, expected feedback instead.
    let stallHideTimer: number | null = null;
    const STALL_THRESHOLD_MS = 250;
    const STALL_INDICATOR_HOLD_MS = 700;

    function tick() {
      frameId = window.requestAnimationFrame(tick);
      const rawDt = clock.getDelta();
      if (rawDt * 1000 > STALL_THRESHOLD_MS && stallIndicatorRef.current) {
        stallIndicatorRef.current.style.opacity = "1";
        if (stallHideTimer !== null) window.clearTimeout(stallHideTimer);
        stallHideTimer = window.setTimeout(() => {
          if (stallIndicatorRef.current) stallIndicatorRef.current.style.opacity = "0";
          stallHideTimer = null;
        }, STALL_INDICATOR_HOLD_MS);
      }
      const dt = Math.min(rawDt, 0.05);
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
    // Live-reported bug (2026-09-13, EK): precompile every material already
    // built synchronously above (every room's base shell, all real walls/
    // floors/ceilings) in one pass, behind the loading screen (`ready` stays
    // false until this finishes), instead of paying that WebGL shader-
    // compile cost as an in-game freeze the first time each room's geometry
    // actually comes into view. See the matching renderer.compile() call at
    // the end of populateDynamicContent() above for the async-content half
    // of this same fix.
    renderer.compile(scene, camera);
    tick();
    const readyTimer = window.setTimeout(() => setReady(true), 0);

    // Full Museum Scale handoff, Phase 1: a debug hook for live-verifying
    // the required movement correction, same pattern as the accepted
    // personal room's own window.__vltdDebug.
    (window as unknown as { __vltdCampusMoveDebug?: unknown }).__vltdCampusMoveDebug = {
      // Temporary diagnostic (2026-09-14) — root-causing a wall-ceiling
      // junction trim band spotted live in HUB with the current Grand Hall
      // GLB. Lists every visible mesh in HUB's rough ceiling/wall-top band
      // (x 21-84, z 0-78, y 8-11) with its material name/color, so we can
      // tell whether it's the shared shell's own (should-be-hidden)
      // ceiling-trim material leaking through, or something else (e.g.
      // ordinary door-casing trim) entirely. Remove once root-caused.
      debugHubCeilingBand: () => {
        const hits: Array<{ name: string; matName: string; matColorHex: string; visible: boolean; pos: number[] }> = [];
        scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          const p = obj.getWorldPosition(new THREE.Vector3());
          if (p.x < 21 || p.x > 84 || p.z < 0 || p.z > 78 || p.y < 8 || p.y > 11) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial;
            hits.push({
              name: obj.name || "(unnamed)",
              matName: m.name || "(unnamed material)",
              matColorHex: std.color ? "#" + std.color.getHexString() : "n/a",
              visible: obj.visible,
              pos: [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10],
            });
          }
        });
        return hits;
      },
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
      if (stallHideTimer !== null) window.clearTimeout(stallHideTimer);
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

      {/* Stall indicator (2026-09-15): opacity toggled directly from
          tick() on an unusually slow frame — see stallIndicatorRef above.
          Starts at opacity 0 (not `hidden`, so the CSS transition can
          actually animate it in/out) and never intercepts clicks. */}
      <div
        ref={stallIndicatorRef}
        className="pointer-events-none absolute left-1/2 top-6 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white/85 ring-1 ring-white/15 backdrop-blur transition-opacity duration-300"
        style={{ opacity: 0 }}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        Loading detail…
      </div>

      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
          Building the campus…
        </div>
      ) : null}

    </div>
  );
}
