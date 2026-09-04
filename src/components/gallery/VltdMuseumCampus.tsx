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
  CAMPUS_ROOMS,
  CAMPUS_SPAWN,
  DOOR_WIDTH,
  EYE_HEIGHT,
  S,
  WALL_HEIGHT,
  WALL_THICKNESS,
  assignSwingRoomUniverses,
  buildWalkableAreas,
  computeCampusWaypoints,
  computeDoorBridges,
  computeWallSegments,
  isWalkable,
  roomBounds,
  roomById,
  type CampusRoom,
} from "@/lib/campusLayout";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { getActiveSpotlightPrograms, getEnabledStoreItems, getItemsPerRoom } from "@/lib/museumCampusConfig";

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
    const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 400);
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

    // Door-threshold floor patches (the physical gap between adjacent rooms)
    for (const bridge of computeDoorBridges()) {
      const w = bridge.x1 - bridge.x0;
      const d = bridge.z1 - bridge.z0;
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color: 0x162944, roughness: 0.95 })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set((bridge.x0 + bridge.x1) / 2, 0.01, (bridge.z0 + bridge.z1) / 2);
      scene.add(patch);
    }

    // Walls, split around door gaps, with the same gold rail trim the
    // single room's own walls use (its shelf-rail lattice) — this is the
    // single biggest thing missing that made identically-dimensioned
    // rooms read as smaller/flatter than the original.
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.5, metalness: 0.25 });
    const trimHeights = [2.4, 5.2]; // rail heights, roughly matching the single room's own two visible rails
    const trimDepth = 0.06;
    const trimThickness = 0.12;

    for (const segment of computeWallSegments()) {
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

      addShelfPair("POP_CULTURE", "east", 6.3 * S);
      addShelfPair("TCG", "east", 20.4 * S);
      addShelfPair("COLLECTION", "north", 24.6 * S);
      addShelfPair("SPORTS", "north", 41.45 * S);
      addShelfPair("CARDS", "north", 58.3 * S);
      addShelfPair("BUILT_BOTANY", "west", 6.3 * S);
      addShelfPair("GAMES", "west", 20.4 * S);
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

    function hangPlaque(x: number, z: number, width: number, height: number, title: string, sub?: string, yOffset = 0) {
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
      plaque.position.set(x, EYE_HEIGHT + yOffset, z + 0.03);
      scene.add(plaque);
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

    const WALK_SPEED = 2.55; // units/sec — same real-world-calibrated speed as the single room
    const WALK_SPEED_SLOW = 1.73; // Shift
    const TURN_RATE = 1.7; // rad/sec, Left/Right arrow turning
    const PITCH_LIMIT = 0.32; // exact match to the single room's own limit — no campus-specific deviation
    // Calibrated to "drag across the full screen width = rotate through
    // one horizontal field of view" (~0.00079 rad/px at this FOV/aspect),
    // not ported — see the onPointerMove comment below for the measured
    // reasoning. Pitch keeps the same ratio to yaw the single room used.
    const YAW_SENSITIVITY = 0.0008;
    const PITCH_SENSITIVITY = 0.00036;

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

    function facingDirection() {
      return new THREE.Vector3(Math.sin(targetYaw), 0, -Math.cos(targetYaw)).normalize();
    }
    function strafeDirection() {
      return new THREE.Vector3(Math.cos(targetYaw), 0, Math.sin(targetYaw)).normalize();
    }

    // Slide collision: try the full move, then each axis alone — same
    // approach as before, just driven by a velocity vector now instead of
    // a normalized diagonal step.
    function tryMove(candidateX: number, candidateZ: number) {
      if (isWalkable(candidateX, candidateZ, walkable)) {
        cameraBody.x = candidateX;
        cameraBody.z = candidateZ;
        return;
      }
      if (isWalkable(candidateX, cameraBody.z, walkable)) cameraBody.x = candidateX;
      else if (isWalkable(cameraBody.x, candidateZ, walkable)) cameraBody.z = candidateZ;
    }

    function updateKeyboardMovement(dt: number) {
      if (pressedKeys.size === 0) return;
      walkTween = null; // a held movement/turn key interrupts click-to-walk (view is never touched by the tween, so nothing else to reset)
      const speed = pressedKeys.has("shift") ? WALK_SPEED_SLOW : WALK_SPEED;
      const move = new THREE.Vector3();
      if (pressedKeys.has("forward")) move.add(facingDirection());
      if (pressedKeys.has("back")) move.sub(facingDirection());
      if (pressedKeys.has("left")) move.sub(strafeDirection());
      if (pressedKeys.has("right")) move.add(strafeDirection());
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        tryMove(cameraBody.x + move.x, cameraBody.z + move.z);
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
      // EK's ask (2026-09-04), stated as a HUGE issue: "when i click and
      // drag the room to look around it moves the room the wrong way."
      // The sign here was backwards for the "grab and pan the room"
      // metaphor EK has been describing this whole time — dragging right
      // should carry the room's content right with the cursor (like
      // dragging a photo), which means the sign is `+=`, not `-=`. Fixed
      // on both axes together (pitch had the same class of bug).
      targetYaw += dx * YAW_SENSITIVITY;
      targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, targetPitch + dy * PITCH_SENSITIVITY));
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
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      walkTween = null;
      const amount = (e.deltaY > 0 ? -1 : 1) * 0.42;
      const move = facingDirection().multiplyScalar(amount);
      tryMove(cameraBody.x + move.x, cameraBody.z + move.z);
      targetCameraBody.copy(cameraBody);
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
    function currentRoomLabel(x: number, z: number) {
      const room = CAMPUS_ROOMS.find((r) => {
        const b = roomBounds(r);
        return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
      });
      return room ? room.label : "";
    }

    const clock = new THREE.Clock();
    let frameId = 0;

    function tick() {
      frameId = window.requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);

      updateKeyboardMovement(dt);

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
        yaw += (targetYaw - yaw) * 0.12;
        pitch += (targetPitch - pitch) * 0.12;
        cameraBody.lerp(targetCameraBody, 0.15);
      }
      cameraBody.y = EYE_HEIGHT;

      camera.position.copy(cameraBody);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      const label = currentRoomLabel(cameraBody.x, cameraBody.z);
      if (label !== lastRoomLabel) {
        lastRoomLabel = label;
        if (roomLabelRef.current) roomLabelRef.current.textContent = label || "Corridor";
      }

      renderer.render(scene, camera);
    }
    tick();
    const readyTimer = window.setTimeout(() => setReady(true), 0);

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
