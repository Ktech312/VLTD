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
import { useEffect, useRef, useState, type ReactNode } from "react";
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

// On-screen movement control for touch devices (no physical keyboard) —
// presses/releases feed the exact same keys Set real WASD does, so tick()
// doesn't need to know which input source triggered a move.
function TouchPadButton({
  label,
  onDown,
  onUp,
  children,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur active:bg-black/75"
      style={{ touchAction: "none" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export default function VltdMuseumCampus() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roomLabelRef = useRef<HTMLDivElement | null>(null);
  // Shared with the on-screen touch controls below (mobile has no
  // keyboard) — same Set an on-screen button press adds/removes from, so
  // tick()'s movement code doesn't need to know which input source it
  // came from.
  const keysRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowTouchControls(("ontouchstart" in window) || navigator.maxTouchPoints > 0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
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
    for (const room of CAMPUS_ROOMS) {
      const { x, z } = roomCenter(room);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w, room.d),
        new THREE.MeshStandardMaterial({ color: room.floorColor, roughness: 0.95 })
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

    // Walls, split around door gaps
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

    // --- Movement: WASD walk + click-drag look, matching the built room's
    // existing input model (see VirtualGalleryRoom.tsx) rather than
    // reinventing a control scheme. ---
    const walkable = buildWalkableAreas();
    const keys = keysRef.current;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const pose = { yaw: CAMPUS_SPAWN.yaw, pitch: 0 };

    function onKeyDown(e: KeyboardEvent) {
      keys.add(e.key.toLowerCase());
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }
    function onPointerDown(e: PointerEvent) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      pose.yaw -= dx * 0.0032;
      pose.pitch = Math.max(-1.1, Math.min(1.1, pose.pitch - dy * 0.0032));
    }
    function onPointerUp() {
      dragging = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let lastRoomLabel = "";
    function currentRoomLabel(x: number, z: number) {
      const room = CAMPUS_ROOMS.find((r) => {
        const b = roomBounds(r);
        return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
      });
      return room ? room.label : "";
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    const SPEED = 15;

    function tick() {
      frameId = window.requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), 0.1);

      camera.rotation.y = pose.yaw;
      camera.rotation.x = pose.pitch;

      const forward = new THREE.Vector3(-Math.sin(pose.yaw), 0, -Math.cos(pose.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      let moveX = 0;
      let moveZ = 0;
      if (keys.has("w") || keys.has("arrowup")) { moveX += forward.x; moveZ += forward.z; }
      if (keys.has("s") || keys.has("arrowdown")) { moveX -= forward.x; moveZ -= forward.z; }
      if (keys.has("d") || keys.has("arrowright")) { moveX += right.x; moveZ += right.z; }
      if (keys.has("a") || keys.has("arrowleft")) { moveX -= right.x; moveZ -= right.z; }

      const mag = Math.hypot(moveX, moveZ);
      if (mag > 0.001) {
        moveX = (moveX / mag) * SPEED * delta;
        moveZ = (moveZ / mag) * SPEED * delta;

        const pos = camera.position;
        if (isWalkable(pos.x + moveX, pos.z, walkable)) pos.x += moveX;
        if (isWalkable(pos.x, pos.z + moveZ, walkable)) pos.z += moveZ;
      }

      const label = currentRoomLabel(camera.position.x, camera.position.z);
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
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      keys.clear();
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

  function pressKey(key: string) {
    keysRef.current.add(key);
  }
  function releaseKey(key: string) {
    keysRef.current.delete(key);
  }

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

        <div className="flex items-end justify-between">
          <div className="rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white/75 ring-1 ring-white/15 backdrop-blur">
            {showTouchControls ? "Drag to look · pad to walk" : "WASD to walk · drag to look"}
          </div>

          {showTouchControls ? (
            <div className="pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1" style={{ touchAction: "none" }}>
              <div />
              <TouchPadButton label="Forward" onDown={() => pressKey("w")} onUp={() => releaseKey("w")}>
                <path d="M12 5 5 14h14L12 5Z" />
              </TouchPadButton>
              <div />
              <TouchPadButton label="Left" onDown={() => pressKey("a")} onUp={() => releaseKey("a")}>
                <path d="M5 12 14 5v14L5 12Z" />
              </TouchPadButton>
              <div />
              <TouchPadButton label="Right" onDown={() => pressKey("d")} onUp={() => releaseKey("d")}>
                <path d="M19 12 10 5v14l9-7Z" />
              </TouchPadButton>
              <div />
              <TouchPadButton label="Back" onDown={() => pressKey("s")} onUp={() => releaseKey("s")}>
                <path d="M12 19 5 10h14l-7 9Z" />
              </TouchPadButton>
              <div />
            </div>
          ) : null}
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
