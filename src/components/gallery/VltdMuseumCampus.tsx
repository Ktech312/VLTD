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
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  CAMPUS_DOORS,
  CAMPUS_ROOMS,
  CAMPUS_SPAWN,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  adjacentRoomIds,
  assignSwingRoomUniverses,
  buildWalkableAreas,
  computeCampusWaypoints,
  computeCampusWallSegments,
  computeDoorBridges,
  doorGapCenter,
  doorWallWidth,
  isWalkable,
  roomBounds,
  roomById,
  type CampusWaypoint,
  type CampusRoom,
  type CampusRoomId,
} from "@/lib/campusLayout";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { getActiveSpotlightPrograms, getEnabledRoomItems, getEnabledStoreItems, getItemsPerRoom } from "@/lib/museumCampusConfig";
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
  computeUsableWallSpans,
  createWallMaterial,
  HUB_FINISH,
  NEUTRAL_LEGACY_FINISH,
  NEUTRAL_PREVIEW_FINISH,
  placeArtwork,
  type RoomFinish,
  type RoomLightGroups,
  type RoomModule,
  type WallSpan,
} from "@/lib/campusRoomBuilder";
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

export default function VltdMuseumCampus() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roomLabelRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

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
    camera.position.set(CAMPUS_SPAWN.x, EYE_HEIGHT, CAMPUS_SPAWN.z);

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
    for (const room of CAMPUS_ROOMS) {
      if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION") continue;
      const finish: RoomFinish = room.id === "HUB"
        ? HUB_FINISH
        : { ...NEUTRAL_LEGACY_FINISH, floorTintColor: lightenedFloorTint(room.floorColor) };
      buildNeutralShell(scene, room, WALL_HEIGHT, finish, room.id !== "PLAZA");
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
    // Wall materials are cached by FINISH IDENTITY, not per room — EK's
    // world-space wall-panel fix (2026-09-10) moved all size-dependent
    // texture scaling onto each wall SEGMENT's own geometry (see
    // buildSharedWall's scaleWallPanelU()), so createWallMaterial() no
    // longer varies by room size at all; two rooms sharing a finish now
    // produce byte-identical materials, so there's no reason to build one
    // per room anymore ("share wall finish materials/textures by finish
    // identity" from the original approved plan's performance-correction
    // section — previously blocked by the old per-room texture scaling,
    // now unblocked by the same fix). Collapses 9 separate
    // NEUTRAL_LEGACY_FINISH materials/textures (one per legacy room) into 1.
    const wallMaterialByFinish = new Map<RoomFinish, THREE.Material>();
    function wallMaterialFor(finish: RoomFinish): THREE.Material {
      const cached = wallMaterialByFinish.get(finish);
      if (cached) return cached;
      const material = createWallMaterial(finish);
      wallMaterialByFinish.set(finish, material);
      return material;
    }
    function roomWallMaterial(roomId: CampusRoomId): THREE.Material {
      if (roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION") {
        return wallMaterialFor(NEUTRAL_PREVIEW_FINISH);
      }
      return wallMaterialFor(roomId === "HUB" ? HUB_FINISH : NEUTRAL_LEGACY_FINISH);
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
      buildRoomTrim(scene, roomById(convertedId), wallSegments, NEUTRAL_PREVIEW_FINISH, WALL_HEIGHT, WALL_THICKNESS);
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
      buildRoomTrim(scene, room, wallSegments, finish, WALL_HEIGHT, WALL_THICKNESS, false);
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

    // Grand Hall enhancement — a lit "skylight" ceiling accent and a floor
    // medallion, so the Hub reads as a real grand hall rather than a plain box.
    {
      const hub = roomById("HUB");
      const hubCenter = roomCenter(hub);

      const skylight = new THREE.Mesh(
        new THREE.PlaneGeometry(hub.w * 0.6, hub.d * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 0.6, roughness: 1 })
      );
      skylight.rotation.x = Math.PI / 2;
      skylight.position.set(hubCenter.x, WALL_HEIGHT - 0.05, hubCenter.z);
      scene.add(skylight);
      const skylightGlow = new THREE.PointLight(0xfff2d0, 0.8, 40, 2);
      skylightGlow.position.set(hubCenter.x, WALL_HEIGHT - 1, hubCenter.z);
      scene.add(skylightGlow);

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

    const tcgLights = buildRoomShell(scene, tcgModule);
    const tcgWallSpans = computeUsableWallSpans(tcgModule);

    const collectionLights = buildRoomShell(scene, collectionModule);
    const collectionWallSpans = computeUsableWallSpans(collectionModule);

    // SPORTS proof-room pass (2026-09-11): first room to get real,
    // admin-curated artwork placed across every usable wall (south wall as
    // the focal wall, since it's the one side with no doorway — see the
    // three doorways below) instead of the generic north-wall-only,
    // forced-square treatment every other legacy room still uses. This is
    // ARTWORK PLACEMENT ONLY — SPORTS's shell (floor/ceiling/walls/trim)
    // deliberately still goes through the exact same buildNeutralShell() +
    // NEUTRAL_LEGACY_FINISH loop every other legacy room uses, below,
    // completely unchanged: "keep its existing neutral finish, no new room
    // theme." sportsModule exists only to feed computeUsableWallSpans() —
    // it is never passed to buildRoomShell, so it never touches SPORTS's
    // actual floor/ceiling/wall materials or adds buildRoomShell's own
    // ambient light rig.
    const sportsModule: RoomModule = {
      room: roomById("SPORTS"),
      wallHeight: WALL_HEIGHT,
      wallThickness: WALL_THICKNESS,
      eyeHeight: EYE_HEIGHT,
      finish: NEUTRAL_LEGACY_FINISH,
      doorways: [
        { side: "north", gapCenter: doorGapCenter("SPORTS", "HUB"), neighborId: "HUB", width: doorWallWidth("SPORTS", "HUB") },
        { side: "west", gapCenter: doorGapCenter("SPORTS", "COLLECTION"), neighborId: "COLLECTION", width: doorWallWidth("SPORTS", "COLLECTION") },
        { side: "east", gapCenter: doorGapCenter("SPORTS", "CARDS"), neighborId: "CARDS", width: doorWallWidth("SPORTS", "CARDS") },
      ],
    };
    const sportsWallSpans = computeUsableWallSpans(sportsModule);
    // A dedicated (but otherwise empty) light group, added only so the new
    // picture lights on SPORTS's real artwork can join the existing
    // full/preview room-occupancy activation system below, the same way the
    // 3 converted rooms' picture lights already do — real photographic
    // items need real light to actually read, unlike the flat ambient wash
    // every other legacy room relies on. Nothing else about SPORTS's
    // lighting changes.
    const sportsLightsFull = new THREE.Group();
    sportsLightsFull.name = "room-full:SPORTS";
    scene.add(sportsLightsFull);
    const sportsLightsPreview = new THREE.Group();
    sportsLightsPreview.name = "room-preview:SPORTS";
    scene.add(sportsLightsPreview);
    const sportsLights: RoomLightGroups = { full: sportsLightsFull, preview: sportsLightsPreview };

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
    const roomLightGroups: Partial<Record<CampusRoomId, RoomLightGroups>> = {
      POP_CULTURE: popCultureLights,
      TCG: tcgLights,
      COLLECTION: collectionLights,
      SPORTS: sportsLights,
    };

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
      const [itemsPerRoom, spotlightPrograms, storeItems, sportsItems] = await Promise.all([
        getItemsPerRoom(),
        getActiveSpotlightPrograms(),
        getEnabledStoreItems(),
        getEnabledRoomItems("SPORTS"),
      ]);
      if (contentCancelled) return;

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
        // other room uses. SPORTS is the new proof room (below,
        // admin-curated content across sportsWallSpans) — also skipped here.
        if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION" || room.id === "SPORTS") continue;
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

      const popItems = allItems
        .filter((item) => itemUniverse(item) === "POP_CULTURE")
        .slice(0, itemsPerRoom);
      placeRoomItems(popCultureWallSpans, popCultureLights, popItems);

      const tcgItems = allItems
        .filter((item) => itemUniverse(item) === "TCG")
        .slice(0, itemsPerRoom);
      placeRoomItems(tcgWallSpans, tcgLights, tcgItems);

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

      // SPORTS — the first proof room for real, admin-curated content
      // (Admin Tools > Museum Campus), not whichever personal vault
      // happens to be signed in. Each item carries its curated title as a
      // compact label under the frame.
      //
      // South is the focal wall (the one side with no doorway); north/
      // west/east each flank a real door (HUB/COLLECTION/CARDS) and are
      // split by computeUsableWallSpans into two shorter segments each.
      // placeArtwork()'s own distribution is proportional purely by RAW
      // SPAN LENGTH with a floor of 1 item per span — with 6 small door-
      // flanking segments plus 1 long south segment, that floor means the
      // 6 short segments collectively soak up most of the items and south
      // ends up a minority, backwards from "south as the main focal wall."
      // Fixed by calling placeArtwork() twice instead of changing it (it's
      // shared with 3 other rooms, unmodified): once for south alone with
      // the majority of items, once for one supporting piece per door wall
      // (its larger flanking segment — the two are equal length here since
      // SPORTS's doors are centered, so "larger" is just a stable pick).
      // Capped to itemsPerRoom (default 8, same admin-configured value every
      // other converted room already caps to) — "limit the first
      // composition to roughly 7-8 pieces." sportsItems is already ordered
      // by the admin's own sort_order, so this keeps whichever items they
      // put first.
      const sportsUrls = sportsItems
        .filter((item) => item.image_url)
        .slice(0, itemsPerRoom)
        .map((item) => ({ url: item.image_url, label: item.title }));
      const sportsSouthSpans = sportsWallSpans.filter((s) => s.wall === "south");
      const sportsSupportingSpans = (["north", "west", "east"] as const)
        .map((side) =>
          sportsWallSpans
            .filter((s) => s.wall === side)
            .sort((a, b) => b.to - b.from - (a.to - a.from))[0]
        )
        .filter((s): s is WallSpan => Boolean(s));
      // Only add supporting pieces once there's enough curated content to
      // spare — with fewer than 5 items, everything stays on the focal wall
      // rather than stranding one lonely piece per door.
      const supportingPerWall = sportsUrls.length >= 5 ? 1 : 0;
      const supportingCount = supportingPerWall * sportsSupportingSpans.length;
      const sportsFocalItems = sportsUrls.slice(0, Math.max(0, sportsUrls.length - supportingCount));
      const sportsSupportingItems = sportsUrls.slice(sportsFocalItems.length);
      placeArtwork(scene, textureLoader, sportsLights, sportsSouthSpans, sportsFocalItems, WALL_THICKNESS, EYE_HEIGHT, () => contentCancelled);
      if (sportsSupportingItems.length > 0) {
        placeArtwork(scene, textureLoader, sportsLights, sportsSupportingSpans, sportsSupportingItems, WALL_THICKNESS, EYE_HEIGHT, () => contentCancelled);
      }
      if (sportsUrls.length === 0) {
        // Honest empty state, same pattern as COLLECTION/Spotlight/Store —
        // never a fake/demo item to make the room look populated. Mounted
        // on SPORTS's own south wall, its one side with no doorway.
        const sportsBounds = roomBounds(roomById("SPORTS"));
        hangPlaque(
          sportsBounds.x0 + (sportsBounds.x1 - sportsBounds.x0) / 2,
          sportsBounds.z1 - WALL_THICKNESS,
          6,
          3,
          "Coming soon",
          "SPORTS items are managed from Admin Tools",
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

    let yaw = CAMPUS_SPAWN.yaw;
    let pitch = 0;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const cameraBody = new THREE.Vector3(CAMPUS_SPAWN.x, EYE_HEIGHT, CAMPUS_SPAWN.z);
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
      const label = room ? room.label : "";
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
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

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
