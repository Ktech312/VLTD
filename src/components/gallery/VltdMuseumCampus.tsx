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
  DOOR_WIDTH,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  adjacentRoomIds,
  assignSwingRoomUniverses,
  buildWalkableAreas,
  computeCampusWaypoints,
  computeDoorBridges,
  computeWallSegments,
  doorGapCenter,
  doorWallWidth,
  isWalkable,
  roomBounds,
  roomById,
  type CampusRoom,
  type CampusRoomId,
} from "@/lib/campusLayout";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { getActiveSpotlightPrograms, getEnabledStoreItems, getItemsPerRoom } from "@/lib/museumCampusConfig";
import {
  MUSEUM_CAMERA_FOV,
  MUSEUM_PITCH_LIMIT,
  MUSEUM_WALK_SPEED,
  MUSEUM_WALK_SPEED_SLOW,
} from "@/lib/museumStandard";
import {
  buildDoorConnection,
  buildRoomShell,
  computeUsableWallSpans,
  createWallMaterial,
  NEUTRAL_PREVIEW_FINISH,
  placeArtwork,
  type ConnectionEndpoint,
  type RoomLightGroups,
  type RoomModule,
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

function makeLabelSprite(text: string, sub?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(234,242,251,0.92)";
  ctx.font = "700 46px Archivo, sans-serif";
  ctx.fillText(text, canvas.width / 2, sub ? 56 : 76);
  if (sub) {
    ctx.fillStyle = "rgba(147,176,204,0.85)";
    ctx.font = "600 26px 'IBM Plex Mono', monospace";
    ctx.fillText(sub, canvas.width / 2, 96);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(9, 2.25, 1);
  return sprite;
}

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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081527);
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

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xeef5fc, roughness: 0.85, metalness: 0.02 });
    const hubWallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b95e, roughness: 0.7, metalness: 0.05 });

    // Floors
    // EK's ask (2026-09-04): "the room are still nowhere near the size
    // visually and functionally as the First 3D room we built... stop
    // patching this and redo what needs to be done." Compared this
    // component's rooms directly against the single room's real guest
    // view (VirtualGalleryRoom.tsx, /museum/virtual-room/guest) and found
    // the gap isn't really a camera number anymore (FOV/wall-height
    // already matched) — it's that the single room has real material
    // detail (a gold shelf-rail lattice on every wall, a tiled floor,
    // glowing pedestals) giving strong scale cues that a flat single-
    // color box never gives, no matter how correct its literal
    // dimensions are. Adding the same kind of detail here: a tiled floor
    // texture and gold rail trim on every wall.
    function makeFloorTexture(baseHex: number) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const base = new THREE.Color(baseHex);
      ctx.fillStyle = `#${base.getHexString()}`;
      ctx.fillRect(0, 0, 256, 256);
      const light = base.clone().offsetHSL(0, 0, 0.05);
      const dark = base.clone().offsetHSL(0, 0, -0.06);
      const tile = 32;
      for (let row = 0; row < 256 / tile; row++) {
        for (let col = 0; col < 256 / tile; col++) {
          ctx.fillStyle = `#${((row + col) % 2 === 0 ? light : dark).getHexString()}`;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(col * tile, row * tile, tile - 2, tile - 2);
        }
      }
      ctx.globalAlpha = 1;
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    for (const room of CAMPUS_ROOMS) {
      // POP_CULTURE, TCG, and COLLECTION get their own neutral-finish shell
      // (floor, ceiling, walls, doorways) below instead of the generic
      // checkerboard-floor + center-name-sprite treatment every other room
      // still uses this pass.
      if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION") continue;

      const { x, z } = roomCenter(room);
      const floorTexture = makeFloorTexture(room.floorColor);
      if (floorTexture) floorTexture.repeat.set(room.w / 4, room.d / 4);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w, room.d),
        new THREE.MeshStandardMaterial({
          color: floorTexture ? 0xffffff : room.floorColor,
          map: floorTexture,
          roughness: 0.95,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(x, 0, z);
      scene.add(floor);

      if (room.label) {
        const label = makeLabelSprite(room.label, room.id === "HUB" ? undefined : room.tierLabel);
        if (label) {
          label.position.set(x, WALL_HEIGHT - 1.4, z);
          scene.add(label);
        }
      }
    }

    // 2026-09-08 architecture reset: the flat navy floor patch that used to
    // stand in for "the physical gap between adjacent rooms" is gone —
    // buildDoorConnection() below builds a real enclosed vestibule (floor,
    // ceiling, side returns, frame/transom/signs) once per CAMPUS_DOORS
    // entry instead. See the connection-building loop after the wall
    // segments below, which needs `wallMaterial`/`hubWallMaterial` (defined
    // above) already in scope.

    // Walls, split around door gaps, with the same gold rail trim the
    // single room's own walls use (its shelf-rail lattice) — this is the
    // single biggest thing missing that made identically-dimensioned
    // rooms read as smaller/flatter than the original.
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.5, metalness: 0.25 });
    const trimHeights = [2.4, 5.2]; // rail heights, roughly matching the single room's own two visible rails
    const trimDepth = 0.06;
    const trimThickness = 0.12;

    for (const segment of computeWallSegments()) {
      // POP_CULTURE and TCG build their own 4 walls each (neutral finish +
      // real doorway frames) below — their other neighbors (HUB, MISC)
      // still get their normal wall segment on their own side of each
      // shared boundary here.
      if (segment.room === "POP_CULTURE" || segment.room === "TCG" || segment.room === "COLLECTION") continue;
      const span = segment.to - segment.from;
      if (span <= 0.05) continue;
      const material = segment.room === "HUB" ? hubWallMaterial : wallMaterial;
      let geometry: THREE.BoxGeometry;
      let position: [number, number, number];
      if (segment.side === "north" || segment.side === "south") {
        geometry = new THREE.BoxGeometry(span, WALL_HEIGHT, WALL_THICKNESS);
        position = [(segment.from + segment.to) / 2, WALL_HEIGHT / 2, segment.fixed];
      } else {
        geometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, span);
        position = [segment.fixed, WALL_HEIGHT / 2, (segment.from + segment.to) / 2];
      }
      const wall = new THREE.Mesh(geometry, material);
      wall.position.set(...position);
      scene.add(wall);

      const facingSign = segment.side === "north" || segment.side === "west" ? 1 : -1;
      for (const h of trimHeights) {
        if (h >= WALL_HEIGHT - 0.5) continue;
        const rail =
          segment.side === "north" || segment.side === "south"
            ? new THREE.Mesh(new THREE.BoxGeometry(span, trimThickness, trimDepth), trimMaterial)
            : new THREE.Mesh(new THREE.BoxGeometry(trimDepth, trimThickness, span), trimMaterial);
        if (segment.side === "north" || segment.side === "south") {
          rail.position.set((segment.from + segment.to) / 2, h, segment.fixed + (facingSign * WALL_THICKNESS) / 2);
        } else {
          rail.position.set(segment.fixed + (facingSign * WALL_THICKNESS) / 2, h, (segment.from + segment.to) / 2);
        }
        scene.add(rail);
      }
    }

    // Connection-owned doorway architecture (2026-09-08 architecture
    // reset): every CAMPUS_DOORS entry is now built exactly ONCE here,
    // regardless of whether either room it connects has been converted to
    // the standard-module builder — replacing the old approach where each
    // converted room's own module called buildDoorways() independently,
    // doubling the assembly across a real gap for two converted rooms and
    // leaving the legacy side bare for a converted<->legacy pair. See
    // buildDoorConnection() in campusRoomBuilder.ts for the full design.
    //
    // Each endpoint supplies the wall material a visitor would see if they
    // were standing in ITS room looking at the shared wall — the exact
    // same factory a converted room's own buildRoomShell used
    // (createWallMaterial), or the exact same shared instance a legacy room
    // already uses (wallMaterial/hubWallMaterial, defined above) — so the
    // connection's transom reads as a continuation of that wall, not a
    // separate flat-colored patch.
    function connectionWallMaterial(roomId: CampusRoomId): THREE.Material {
      if (roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION") {
        return createWallMaterial(NEUTRAL_PREVIEW_FINISH, roomById(roomId), WALL_HEIGHT);
      }
      return roomId === "HUB" ? hubWallMaterial : wallMaterial;
    }

    const connectionReveals: { rooms: [CampusRoomId, CampusRoomId]; light: THREE.PointLight }[] = [];
    CAMPUS_DOORS.forEach((door) => {
      const [aId, bId] = door.rooms;
      if (!bId) return; // no second room to connect to (unused today, kept safe)
      const a: ConnectionEndpoint = { room: roomById(aId), wallMaterial: connectionWallMaterial(aId) };
      const b: ConnectionEndpoint = { room: roomById(bId), wallMaterial: connectionWallMaterial(bId) };
      const reveal = buildDoorConnection(scene, door, a, b, {
        wallHeight: WALL_HEIGHT,
        wallThickness: WALL_THICKNESS,
        eyeHeight: EYE_HEIGHT,
        installFrame: true,
      });
      if (reveal) connectionReveals.push({ rooms: [aId, bId], light: reveal });
    });

    // Waypoint markers — EK watched bingebrowse.net with the walkthrough
    // open and pointed out its floor markers directly: "these little
    // squares are helpful to know where you can go and look when you
    // hover over them." Click-to-walk is no longer "raycast wherever the
    // floor was clicked" — it only responds to these curated spots (one
    // per room, one per doorway), each with a sensible place to stand.
    // Highlighted (bigger + brighter) on hover so it's clear what's
    // clickable before you click it.
    function makeWaypointTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.strokeStyle = "#8fe0e6";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      const m = 20;
      const len = 28;
      const corners: [number, number, number, number][] = [
        [m, m, 1, 1],
        [128 - m, m, -1, 1],
        [m, 128 - m, 1, -1],
        [128 - m, 128 - m, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + len * sy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + len * sx, cy);
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    }

    const waypointTexture = makeWaypointTexture();
    const waypointMeshes: THREE.Mesh[] = [];
    for (const wp of computeCampusWaypoints()) {
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({
          map: waypointTexture,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(wp.x, 0.03, wp.z);
      marker.userData.waypointX = wp.x;
      marker.userData.waypointZ = wp.z;
      scene.add(marker);
      waypointMeshes.push(marker);
    }
    let hoveredMarker: THREE.Mesh | null = null;
    function setMarkerHover(marker: THREE.Mesh | null) {
      if (hoveredMarker === marker) return;
      if (hoveredMarker) {
        hoveredMarker.scale.set(1, 1, 1);
        (hoveredMarker.material as THREE.MeshBasicMaterial).opacity = 0.55;
      }
      if (marker) {
        marker.scale.set(1.35, 1.35, 1);
        (marker.material as THREE.MeshBasicMaterial).opacity = 0.95;
      }
      hoveredMarker = marker;
      renderer.domElement.style.cursor = marker ? "pointer" : "";
    }

    // Exterior facade + entrance steps — EK's ask (2026-09-02), "just some
    // visual fun," inspired by classical museum architecture (columns,
    // pediment, stone steps) but NOT copying any specific real museum's
    // exact look. Purely decorative: the camera's Y never changes, so the
    // steps don't need real elevation collision, and the facade sits just
    // outside the Hub's real north wall rather than replacing it.
    {
      const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d0bd, roughness: 0.75 });
      const facadeZ = -0.9;
      const columnXs = [30, 38, 46, 62, 70, 78];
      for (const x of columnXs) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, WALL_HEIGHT, 12), stoneMaterial);
        column.position.set(x, WALL_HEIGHT / 2, facadeZ);
        scene.add(column);
        const capital = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5), stoneMaterial);
        capital.position.set(x, WALL_HEIGHT + 0.15, facadeZ);
        scene.add(capital);
      }

      const pedimentShape = new THREE.Shape();
      pedimentShape.moveTo(-13, 0);
      pedimentShape.lineTo(13, 0);
      pedimentShape.lineTo(0, 4);
      pedimentShape.closePath();
      const pediment = new THREE.Mesh(
        new THREE.ExtrudeGeometry(pedimentShape, { depth: 1.3, bevelEnabled: false }),
        stoneMaterial
      );
      pediment.position.set(54.99, WALL_HEIGHT + 0.3, facadeZ - 0.65);
      scene.add(pediment);

      const stepSpecs = [
        { width: 9, z: -2.6 },
        { width: 6.5, z: -1.6 },
        { width: 4, z: -0.6 },
      ];
      let stepY = 0;
      for (const step of stepSpecs) {
        const height = 0.16;
        stepY += height;
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(step.width, height, 1.1), stoneMaterial);
        stepMesh.position.set(54.99, stepY - height / 2, step.z);
        scene.add(stepMesh);
      }
    }

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
    }

    // Display shelves flanking the Hub door — EK's ask (2026-09-02): "for
    // some of the rooms that match in size, add the shelves around the
    // new Door." The two size-matched groups (five rooms at 20.4x16.8:
    // POP_CULTURE/TCG/COLLECTION/SPORTS/CARDS, and two at 42.8x16.8:
    // BUILT_BOTANY/GAMES) each get a pair of shelves just inside their
    // Hub-facing doorway, one on each side. First pass — plain shelf +
    // a placeholder object, not real vault items yet.
    {
      const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5636, roughness: 0.8 });
      const pieceMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b95e, roughness: 0.4, metalness: 0.3 });

      function addShelfPair(
        roomId: Parameters<typeof roomById>[0],
        wall: "north" | "south" | "east" | "west",
        gapCenter: number
      ) {
        const bounds = roomBounds(roomById(roomId));
        const offset = DOOR_WIDTH / 2 + 1.3;
        const positions: [number, number][] =
          wall === "north" || wall === "south"
            ? [[gapCenter - offset, wall === "north" ? bounds.z0 : bounds.z1], [gapCenter + offset, wall === "north" ? bounds.z0 : bounds.z1]]
            : [[wall === "west" ? bounds.x0 : bounds.x1, gapCenter - offset], [wall === "west" ? bounds.x0 : bounds.x1, gapCenter + offset]];
        const facingX = wall === "north" || wall === "south";

        for (const [x, z] of positions) {
          const depth = 0.6;
          const zOffset = wall === "north" ? depth / 2 + WALL_THICKNESS / 2 : wall === "south" ? -(depth / 2 + WALL_THICKNESS / 2) : 0;
          const xOffset = wall === "west" ? depth / 2 + WALL_THICKNESS / 2 : wall === "east" ? -(depth / 2 + WALL_THICKNESS / 2) : 0;
          const shelfGeom = facingX
            ? new THREE.BoxGeometry(1.6, 0.08, depth)
            : new THREE.BoxGeometry(depth, 0.08, 1.6);
          const shelf = new THREE.Mesh(shelfGeom, shelfMaterial);
          shelf.position.set(x + xOffset, 1.4, z + zOffset);
          scene.add(shelf);

          const piece = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), pieceMaterial);
          piece.position.set(x + xOffset, 1.4 + 0.08 + 0.22, z + zOffset);
          scene.add(piece);
        }
      }

      // POP_CULTURE and TCG no longer get a generic shelf pair — all of
      // their doorways now carry the real doorwayKit.ts frame + header
      // instead (see the room-shell blocks below). Every gapCenter here
      // comes from the door data itself (doorGapCenter), not a re-typed
      // copy of it, so a future resize can't leave a shelf pair floating
      // away from its actual doorway. COLLECTION dropped too — its three
      // doorways now carry the real frame/transom/sign treatment instead.
      addShelfPair("SPORTS", "north", doorGapCenter("SPORTS", "HUB"));
      addShelfPair("CARDS", "north", doorGapCenter("CARDS", "HUB"));
      addShelfPair("BUILT_BOTANY", "west", doorGapCenter("BUILT_BOTANY", "HUB"));
      addShelfPair("GAMES", "west", doorGapCenter("GAMES", "HUB"));
    }

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

    // buildDoorways() per room is gone — the connection loop above already
    // built every doorway (POP_CULTURE's, TCG's, and COLLECTION's included)
    // exactly once each. These three still call buildRoomShell for their
    // own floor/ceiling/walls/baseboards/light rig, and still need their
    // own usable wall spans for item placement.
    const popCultureLights = buildRoomShell(scene, popCultureModule);
    const popCultureWallSpans = computeUsableWallSpans(popCultureModule);

    const tcgLights = buildRoomShell(scene, tcgModule);
    const tcgWallSpans = computeUsableWallSpans(tcgModule);

    const collectionLights = buildRoomShell(scene, collectionModule);
    const collectionWallSpans = computeUsableWallSpans(collectionModule);

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
      // A connection's own reveal light (one per CAMPUS_DOORS entry, see
      // the connection-building loop above) follows the same rule a room's
      // preview group does — on whenever either of its two rooms is full or
      // preview, i.e. whenever the connection is actually relevant to what
      // the visitor can currently see.
      for (const { rooms, light } of connectionReveals) {
        light.visible = rooms.some((id) => fullSet.has(id) || previewSet.has(id));
      }
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
        const artMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
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
      const [itemsPerRoom, spotlightPrograms, storeItems] = await Promise.all([
        getItemsPerRoom(),
        getActiveSpotlightPrograms(),
        getEnabledStoreItems(),
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
        // other room uses.
        if (room.id === "POP_CULTURE" || room.id === "TCG" || room.id === "COLLECTION") continue;
        const universes = roomUniverses[room.id] ?? room.universes;
        if (universes.length === 0) continue;
        const items = allItems.filter((item) => {
          const universe = itemUniverse(item);
          return universe !== null && universes.includes(universe);
        }).slice(0, itemsPerRoom);
        if (items.length === 0) continue;

        const bounds = roomBounds(room);
        const usableWidth = room.w - 3;
        const step = usableWidth / items.length;
        const frameSize = Math.min(2.6, step * 0.72);

        items.forEach((item, index) => {
          const url = getPrimaryImageUrl(item);
          if (!url) return;
          hangFrame(bounds.x0 + 1.5 + step * (index + 0.5), bounds.z0 + WALL_THICKNESS, frameSize, url);
        });
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

    const WALK_SPEED = MUSEUM_WALK_SPEED;
    const WALK_SPEED_SLOW = MUSEUM_WALK_SPEED_SLOW;
    const TURN_RATE = 1.7; // rad/sec, Left/Right arrow turning
    const PITCH_LIMIT = MUSEUM_PITCH_LIMIT;

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

    // EK's ask (2026-09-02), stated plainly and repeatedly ("it spin me
    // around and make me go backwards," then next round "this jerking to
    // a different direction... i really hate this... i tried to get you
    // to remove it"): click-to-walk must NOT turn the camera at all —
    // position only, view stays exactly where the player left it. Now
    // also only ever targets a curated waypoint (see the waypoint-marker
    // comment above), so there's no arbitrary-distance destination to
    // worry about either.
    type WalkTween = {
      fromPos: THREE.Vector3; toPos: THREE.Vector3;
      t: number; duration: number;
    };
    let walkTween: WalkTween | null = null;

    function startWalkTween(destination: THREE.Vector3) {
      const fromPos = cameraBody.clone();
      const travelDistance = fromPos.distanceTo(destination);
      const duration = THREE.MathUtils.clamp(travelDistance / 4.8, 0.2, 1.65);
      walkTween = { fromPos, toPos: destination.clone(), t: 0, duration };
      targetCameraBody.copy(destination);
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

      // Click-to-walk only responds to a waypoint marker now, never an
      // arbitrary floor point — see the waypoint-marker comment above for
      // why (EK: bingebrowse.net has fixed, marked spots, not click-
      // anywhere; a raycast-anywhere destination could be an awkward,
      // unpredictable spot to end up standing).
      if (!hoveredMarker) return;
      const destination = new THREE.Vector3(
        hoveredMarker.userData.waypointX as number,
        EYE_HEIGHT,
        hoveredMarker.userData.waypointZ as number
      );
      startWalkTween(destination);
    }
    // EK's live foreground report on the first version of this fix: "I
    // scroll forward, sometimes it reacts right away, sometimes it doesn't
    // and then lags and over-moves." Root cause the automated single-event
    // test couldn't see: a real wheel/trackpad fires MULTIPLE native wheel
    // events per gesture (a mouse can send several in a burst; a trackpad
    // sends many small ones per swipe), and the previous version applied a
    // full WHEEL_STEP move to cameraBody synchronously inside EVERY one of
    // those events. Nothing is visible until the next rendered frame — so
    // if several events land before that frame paints (routine whenever the
    // event rate outpaces requestAnimationFrame, more likely on this
    // heavier campus scene than the single accepted room), their moves all
    // apply invisibly, and the next paint shows one sudden multi-step jump
    // instead of a steady walk. That's exactly "sometimes it reacts right
    // away [single isolated event, one frame each], sometimes it doesn't
    // and then lags and over-moves [several events silently piled up
    // before a frame caught up]."
    //
    // Fix: onWheel no longer touches cameraBody at all — it only
    // accumulates a pending distance (capped so one runaway trackpad fling
    // can't request an enormous single move). tick() below consumes and
    // applies the WHOLE accumulated amount exactly once per rendered frame,
    // right alongside the continuous WASD path. However many raw events
    // fired since the last frame, the visible camera advances by their sum
    // in one smooth step tied to the actual paint rate — not once per
    // event, and never queued across frames.
    let pendingWheelDistance = 0;
    const MAX_PENDING_WHEEL_DISTANCE = WHEEL_STEP * 4;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      walkTween = null;
      const signedDistance = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      pendingWheelDistance = THREE.MathUtils.clamp(
        pendingWheelDistance + signedDistance,
        -MAX_PENDING_WHEEL_DISTANCE,
        MAX_PENDING_WHEEL_DISTANCE
      );
    }

    function applyPendingWheelMovement() {
      if (pendingWheelDistance === 0) return;
      // Direction still uses the rendered `yaw`, not `targetYaw` — see the
      // Stage 1 comment above updateKeyboardMovement.
      const delta = facingDirection(yaw).multiplyScalar(pendingWheelDistance);
      moveWithCollision(cameraBody, delta);
      cameraBody.y = EYE_HEIGHT;
      targetCameraBody.copy(cameraBody);
      pendingWheelDistance = 0;
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

      updateKeyboardMovement(dt);
      applyPendingWheelMovement();

      if (walkTween) {
        // Position only — no yaw/pitch change (see the walkTween comment above).
        walkTween.t = Math.min(1, walkTween.t + dt / walkTween.duration);
        const k = smoothstep(walkTween.t);
        cameraBody.lerpVectors(walkTween.fromPos, walkTween.toPos, k);
        if (walkTween.t >= 1) {
          cameraBody.copy(walkTween.toPos);
          walkTween = null;
        }
      } else {
        const eased = easeTowardTargets(yaw, targetYaw, pitch, targetPitch, cameraBody, targetCameraBody);
        yaw = eased.yaw;
        pitch = eased.pitch;
      }
      cameraBody.y = EYE_HEIGHT;

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
      triggerWalkTween: (x: number, z: number) => startWalkTween(new THREE.Vector3(x, EYE_HEIGHT, z)),
      setCameraBody: (x: number, z: number, newYaw?: number) => {
        cameraBody.set(x, EYE_HEIGHT, z);
        targetCameraBody.copy(cameraBody);
        if (typeof newYaw === "number") {
          yaw = newYaw;
          targetYaw = newYaw;
        }
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
          // 2026-09-08 architecture reset: one reveal light per CAMPUS_DOORS
          // connection now (was up to two, independently, for a
          // converted<->converted pair) — surfaced separately from
          // perRoom's counts since a connection belongs to the door, not to
          // either room.
          connectionLights: {
            total: connectionReveals.length,
            enabled: connectionReveals.filter((c) => c.light.visible).length,
          },
          location: lastLightLocation,
          fullRoomIds: lastFullRoomIds,
          previewRoomIds: lastPreviewRoomIds,
        };
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
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#081527]">
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />

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
          Click a marker to walk there · drag to look around · scroll to step
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
