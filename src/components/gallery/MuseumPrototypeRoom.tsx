"use client";

// Full Museum Scale handoff (2026-09-06), Phase 1 — the one measurable,
// two-door standard-room prototype. This is a STANDALONE scene, not an edit
// to the live 10-room campus (VltdMuseumCampus.tsx / campusLayout.ts).
//
// Why standalone: the brief asks to resize one existing campus standard
// room to an exact 21 x 26 interior with two real doorways, while leaving
// every other campus room untouched. The existing 10-room layout is fully
// packed — every side of every room, including the Hub, already borders
// another room or an existing doorway, so there is no adjacent open span
// large enough for a 21 x 26 footprint without overlapping a neighbor or
// moving it (which the brief also prohibits). Building the prototype as its
// own scene is the smallest reversible way to prove out the exact-size
// module, the two-door kit, and the corrected movement system without
// touching the real campus's coordinates at all — exactly the fallback the
// brief itself allows ("propose the smallest reversible solution without
// changing the rest of the campus"). Nothing in campusLayout.ts or
// VltdMuseumCampus.tsx (other than the shared movement-correction fix,
// which is a behavior fix, not a room resize) is touched by this file.
//
// Movement here is the SAME corrected pattern just applied to
// VltdMuseumCampus.tsx (forwardFromVisibleView/rightFromVisibleView reading
// the rendered `yaw`, movePreservingDirection stopping instead of
// redirecting on collision) — duplicated rather than imported because it
// closes over this component's own local camera state, same as the
// campus's copy does.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildDoorwayFrame } from "@/lib/doorwayKit";
import {
  DOORWAY_CLEAR_HEIGHT,
  DOORWAY_CLEAR_WIDTH,
  DOORWAY_NO_DISPLAY_HALF_WIDTH,
  MUSEUM_CAMERA_FOV,
  MUSEUM_EYE_HEIGHT,
  MUSEUM_PITCH_LIMIT,
  MUSEUM_WALK_SPEED,
  MUSEUM_WALK_SPEED_SLOW,
  STANDARD_ROOM_DEPTH,
  STANDARD_ROOM_HEIGHT,
  STANDARD_ROOM_WIDTH,
} from "@/lib/museumStandard";
import { getPrimaryImageUrl, loadItems } from "@/lib/vaultModel";

// Room centered on the world origin: x in [-W/2, W/2], z in [-D/2, D/2].
const HALF_W = STANDARD_ROOM_WIDTH / 2;
const HALF_D = STANDARD_ROOM_DEPTH / 2;
// Door 1 (south wall, z = -HALF_D): entry from the Grand Hall stub beyond it.
// Door 2 (north wall, z = +HALF_D): onward circulation to the next-room stub.
const GRAND_HALL_DEPTH = 12;
const NEXT_ROOM_DEPTH = 10;
const WALL_GAP_HALF_WIDTH = 2; // the physical hole cut in the wall itself (must clear the DOORWAY_CLEAR_WIDTH=3.54 opening + its 0.16-wide posts)

export default function MuseumPrototypeRoom() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [helpVisible, setHelpVisible] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f16);
    scene.fog = new THREE.Fog(0x0b0f16, 30, 90);

    const camera = new THREE.PerspectiveCamera(MUSEUM_CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbcd6ef, 0x12294a, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e0, 0.5);
    key.position.set(10, 20, 8);
    scene.add(key);

    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

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
      textures.push(texture);
      return texture;
    }

    // Standard-room finish: a neutral wall tone with a rail trim at two
    // heights (same trimHeights/thickness the campus already uses, for
    // visual consistency between the two surfaces) — the same "give a flat
    // box real scale cues" fix already applied to the campus rooms.
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.88, metalness: 0.02 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xa8b0b8, roughness: 0.4, metalness: 0.5 });
    const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.55, metalness: 0.35 });
    const floorTexture = makeFloorTexture(0x9aa0a8);
    if (floorTexture) floorTexture.repeat.set(STANDARD_ROOM_WIDTH / 3.5, STANDARD_ROOM_DEPTH / 3.5);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorTexture ? 0xffffff : 0x9aa0a8,
      map: floorTexture,
      roughness: 0.9,
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.92 });
    materials.push(wallMaterial, trimMaterial, doorFrameMaterial, floorMaterial, ceilingMaterial);

    function addFloor(x: number, z: number, w: number, d: number, material: THREE.Material) {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(x, 0, z);
      scene.add(floor);
    }
    function addCeiling(x: number, z: number, w: number, d: number) {
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilingMaterial);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(x, STANDARD_ROOM_HEIGHT, z);
      scene.add(ceiling);
    }

    // Main standard-room shell.
    addFloor(0, 0, STANDARD_ROOM_WIDTH, STANDARD_ROOM_DEPTH, floorMaterial);
    addCeiling(0, 0, STANDARD_ROOM_WIDTH, STANDARD_ROOM_DEPTH);

    // Rail trim, same two heights/thickness the campus rooms use.
    function addRail(x: number, y: number, z: number, w: number, d: number) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), trimMaterial);
      rail.position.set(x, y, z);
      scene.add(rail);
    }

    // North/south walls run along X, split around the door gap at x=0.
    // East/west walls run along Z with no door — a single full-length slab.
    function addWallAlongX(z: number, faceSign: 1 | -1, hasGap: boolean) {
      if (!hasGap) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(STANDARD_ROOM_WIDTH, STANDARD_ROOM_HEIGHT, 0.3), wallMaterial);
        wall.position.set(0, STANDARD_ROOM_HEIGHT / 2, z);
        scene.add(wall);
        for (const h of [2.4, 5.2]) addRail(0, h, z + faceSign * 0.16, STANDARD_ROOM_WIDTH, 0.06);
        return;
      }
      const segmentWidth = HALF_W - WALL_GAP_HALF_WIDTH;
      for (const side of [-1, 1] as const) {
        const centerX = side * (WALL_GAP_HALF_WIDTH + segmentWidth / 2);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(segmentWidth, STANDARD_ROOM_HEIGHT, 0.3), wallMaterial);
        wall.position.set(centerX, STANDARD_ROOM_HEIGHT / 2, z);
        scene.add(wall);
        for (const h of [2.4, 5.2]) addRail(centerX, h, z + faceSign * 0.16, segmentWidth, 0.06);
      }
    }
    function addWallAlongZ(x: number) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, STANDARD_ROOM_HEIGHT, STANDARD_ROOM_DEPTH), wallMaterial);
      wall.position.set(x, STANDARD_ROOM_HEIGHT / 2, 0);
      scene.add(wall);
      for (const h of [2.4, 5.2]) addRail(x + (x > 0 ? -0.16 : 0.16), h, 0, 0.06, STANDARD_ROOM_DEPTH);
    }

    addWallAlongX(-HALF_D, 1, true); // south — door 1, to the Grand Hall
    addWallAlongX(HALF_D, -1, true); // north — door 2, onward circulation
    addWallAlongZ(-HALF_W); // west, solid
    addWallAlongZ(HALF_W); // east, solid

    // Both doorway frames — the same accepted-room kit, no fill across the
    // opening, threshold plates give a continuous floor into each stub.
    const door1 = buildDoorwayFrame(doorFrameMaterial);
    door1.position.set(0, 0, -HALF_D);
    scene.add(door1);
    const door2 = buildDoorwayFrame(doorFrameMaterial);
    door2.position.set(0, 0, HALF_D);
    scene.add(door2);

    const thresholdMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 0.85 });
    materials.push(thresholdMaterial);
    function addThreshold(z: number) {
      const threshold = new THREE.Mesh(new THREE.PlaneGeometry(WALL_GAP_HALF_WIDTH * 2, 1.4), thresholdMaterial);
      threshold.rotation.x = -Math.PI / 2;
      threshold.position.set(0, 0.008, z);
      scene.add(threshold);
    }
    addThreshold(-HALF_D);
    addThreshold(HALF_D);

    // Grand Hall stub beyond door 1 — a believable adjoining space, not
    // scene background. Warmer/brighter, larger, matching how the real
    // campus Hub reads (amber wall tone, no door split needed for a dead-
    // end demo stub).
    {
      const hallZ0 = -HALF_D - GRAND_HALL_DEPTH;
      const hallCenterZ = -HALF_D - GRAND_HALL_DEPTH / 2;
      const hallWidth = STANDARD_ROOM_WIDTH * 1.6;
      addFloor(0, hallCenterZ, hallWidth, GRAND_HALL_DEPTH, new THREE.MeshStandardMaterial({ color: 0x3a301c, roughness: 0.9 }));
      addCeiling(0, hallCenterZ, hallWidth, GRAND_HALL_DEPTH);
      const hallWallMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b95e, roughness: 0.7, metalness: 0.05 });
      materials.push(hallWallMaterial);
      const farWall = new THREE.Mesh(new THREE.BoxGeometry(hallWidth, STANDARD_ROOM_HEIGHT, 0.3), hallWallMaterial);
      farWall.position.set(0, STANDARD_ROOM_HEIGHT / 2, hallZ0);
      scene.add(farWall);
      const sideSpan = (hallWidth - STANDARD_ROOM_WIDTH) / 2;
      for (const side of [-1, 1] as const) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(sideSpan, STANDARD_ROOM_HEIGHT, GRAND_HALL_DEPTH), hallWallMaterial);
        sideWall.position.set(side * (STANDARD_ROOM_WIDTH / 2 + sideSpan / 2), STANDARD_ROOM_HEIGHT / 2, hallCenterZ);
        scene.add(sideWall);
      }
      const glow = new THREE.PointLight(0xfff2d0, 0.9, 30, 2);
      glow.position.set(0, STANDARD_ROOM_HEIGHT - 1, hallCenterZ);
      scene.add(glow);
      const label = makeLabelSprite("Grand Hall");
      if (label) {
        label.position.set(0, STANDARD_ROOM_HEIGHT - 1.6, hallZ0 + 0.5);
        scene.add(label);
      }
    }

    // Next-room stub beyond door 2 — a short corridor hinting at
    // continuation, not a dead void.
    {
      const nextZ1 = HALF_D + NEXT_ROOM_DEPTH;
      const nextCenterZ = HALF_D + NEXT_ROOM_DEPTH / 2;
      const nextWidth = STANDARD_ROOM_WIDTH * 0.5;
      addFloor(0, nextCenterZ, nextWidth, NEXT_ROOM_DEPTH, new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.92 }));
      addCeiling(0, nextCenterZ, nextWidth, NEXT_ROOM_DEPTH);
      const corridorWallMaterial = new THREE.MeshStandardMaterial({ color: 0x555f6b, roughness: 0.8 });
      materials.push(corridorWallMaterial);
      const farWall = new THREE.Mesh(new THREE.BoxGeometry(nextWidth, STANDARD_ROOM_HEIGHT, 0.3), corridorWallMaterial);
      farWall.position.set(0, STANDARD_ROOM_HEIGHT / 2, nextZ1);
      scene.add(farWall);
      for (const side of [-1, 1] as const) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, STANDARD_ROOM_HEIGHT, NEXT_ROOM_DEPTH), corridorWallMaterial);
        sideWall.position.set(side * nextWidth / 2, STANDARD_ROOM_HEIGHT / 2, nextCenterZ);
        scene.add(sideWall);
      }
      const label = makeLabelSprite("Next Room (Phase 2)");
      if (label) {
        label.position.set(0, STANDARD_ROOM_HEIGHT - 1.6, nextZ1 - 0.5);
        scene.add(label);
      }
    }

    function makeLabelSprite(text: string) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(234,242,251,0.92)";
      ctx.font = "700 40px Archivo, sans-serif";
      ctx.fillText(text, canvas.width / 2, 60);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      materials.push(material);
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(8, 1.5, 1);
      return sprite;
    }

    // Item slots — split cleanly around both doorways: usable wall span on
    // the north/south walls excludes the DOORWAY_NO_DISPLAY_HALF_WIDTH zone
    // either side of each opening's centerline; east/west walls (no door)
    // use their full length. Capacity is recomputed from what's left, not a
    // fixed count carried over from a doorless wall.
    type Slot = { x: number; y: number; z: number; rotY: number; w: number; h: number };
    const slots: Slot[] = [];
    const itemY = [MUSEUM_EYE_HEIGHT + 0.5, MUSEUM_EYE_HEIGHT - 1.1];
    const frameW = 2.1;
    const frameH = 2.1;

    function addWallSlots(wall: "north" | "south" | "east" | "west") {
      if (wall === "north" || wall === "south") {
        const usableHalf = HALF_W - 0.6;
        const from = -usableHalf;
        const to = usableHalf;
        const z = wall === "south" ? -HALF_D + 0.2 : HALF_D - 0.2;
        const rotY = wall === "south" ? 0 : Math.PI;
        // Two spans, one on each side of the door's no-display zone.
        for (const span of [
          [from, -DOORWAY_NO_DISPLAY_HALF_WIDTH],
          [DOORWAY_NO_DISPLAY_HALF_WIDTH, to],
        ]) {
          const [a, b] = span;
          const width = b - a;
          if (width < frameW) continue;
          const count = Math.max(1, Math.floor(width / (frameW + 0.6)));
          const step = width / count;
          for (let i = 0; i < count; i++) {
            const x = a + step * (i + 0.5);
            for (const y of itemY) slots.push({ x, y, z, rotY, w: frameW, h: frameH });
          }
        }
      } else {
        const usableHalf = HALF_D - 0.6;
        const from = -usableHalf;
        const to = usableHalf;
        const x = wall === "west" ? -HALF_W + 0.2 : HALF_W - 0.2;
        const rotY = wall === "west" ? Math.PI / 2 : -Math.PI / 2;
        const width = to - from;
        const count = Math.max(1, Math.floor(width / (frameW + 0.6)));
        const step = width / count;
        for (let i = 0; i < count; i++) {
          const z = from + step * (i + 0.5);
          for (const y of itemY) slots.push({ x, y, z, rotY, w: frameW, h: frameH });
        }
      }
    }
    addWallSlots("north");
    addWallSlots("south");
    addWallSlots("east");
    addWallSlots("west");

    // Populate with the signed-in user's own vault items as placeholder
    // content (same approach the live campus already uses) — enough to
    // give a real item-inspection interaction to test/screenshot.
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");
    let cancelled = false;
    const inspectable: Array<{ mesh: THREE.Mesh; homePos: THREE.Vector3; homeRotY: number; homeScale: number }> = [];

    const items = loadItems().slice(0, slots.length);
    items.forEach((item, index) => {
      const slot = slots[index];
      if (!slot) return;
      const url = getPrimaryImageUrl(item);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });
      materials.push(frameMat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(slot.w, slot.h), frameMat);
      mesh.position.set(slot.x, slot.y, slot.z);
      mesh.rotation.y = slot.rotY;
      // Nudge off the wall face along its own outward normal so it doesn't
      // z-fight with the wall behind it.
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotY);
      mesh.position.addScaledVector(normal, 0.02);
      mesh.userData.itemTitle = item.title ?? "Untitled";
      scene.add(mesh);
      inspectable.push({ mesh, homePos: mesh.position.clone(), homeRotY: slot.rotY, homeScale: 1 });
      if (url) {
        textureLoader.load(url, (texture) => {
          if (cancelled) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          mesh.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
          materials.push(mesh.material as THREE.Material);
        });
      }
    });

    // --- Movement: the same corrected pattern as VltdMuseumCampus.tsx. ---
    const roomHalf = { x: HALF_W - 0.9, z: HALF_D - 0.9 };
    const hallHalf = { x: (STANDARD_ROOM_WIDTH * 1.6) / 2 - 0.9, zNear: -HALF_D, zFar: -HALF_D - GRAND_HALL_DEPTH + 0.9 };
    const nextHalf = { x: (STANDARD_ROOM_WIDTH * 0.5) / 2 - 0.9, zNear: HALF_D, zFar: HALF_D + NEXT_ROOM_DEPTH - 0.9 };
    function isWalkable(x: number, z: number) {
      if (Math.abs(x) <= roomHalf.x && Math.abs(z) <= roomHalf.z) return true;
      if (z <= hallHalf.zNear + 0.5 && z >= hallHalf.zFar && Math.abs(x) <= hallHalf.x) return true;
      if (z >= nextHalf.zNear - 0.5 && z <= nextHalf.zFar && Math.abs(x) <= nextHalf.x) return true;
      // Door gaps themselves (bridging the small step between the room's
      // own margin-inset bound and the stub's).
      if (Math.abs(x) <= WALL_GAP_HALF_WIDTH && z <= -HALF_D + 0.5 && z >= -HALF_D - 1) return true;
      if (Math.abs(x) <= WALL_GAP_HALF_WIDTH && z >= HALF_D - 0.5 && z <= HALF_D + 1) return true;
      return false;
    }

    const WALK_SPEED = MUSEUM_WALK_SPEED;
    const WALK_SPEED_SLOW = MUSEUM_WALK_SPEED_SLOW;
    const TURN_RATE = 1.7;
    const PITCH_LIMIT = MUSEUM_PITCH_LIMIT;
    const YAW_SENSITIVITY = 0.0008;
    const PITCH_SENSITIVITY = 0.00036;

    let yaw = 0;
    let pitch = 0;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const cameraBody = new THREE.Vector3(0, MUSEUM_EYE_HEIGHT, HALF_D + NEXT_ROOM_DEPTH - 2);
    const targetCameraBody = cameraBody.clone();
    yaw = Math.PI; // spawn facing back into the room from the next-room stub

    const pressedKeys = new Set<string>();
    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;

    function forwardFromVisibleView() {
      return new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    }
    function rightFromVisibleView() {
      return new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
    }

    function movePreservingDirection(delta: THREE.Vector3) {
      const distance = delta.length();
      if (distance === 0) return;
      const direction = delta.clone().normalize();
      const maxSubstep = 0.14;
      const steps = Math.max(1, Math.ceil(distance / maxSubstep));
      const step = direction.multiplyScalar(distance / steps);
      for (let index = 0; index < steps; index += 1) {
        const nextX = cameraBody.x + step.x;
        const nextZ = cameraBody.z + step.z;
        if (!isWalkable(nextX, nextZ)) break;
        cameraBody.x = nextX;
        cameraBody.z = nextZ;
      }
      targetCameraBody.copy(cameraBody);
    }

    function updateKeyboardMovement(dt: number) {
      if (pressedKeys.size === 0) return;
      const speed = pressedKeys.has("shift") ? WALK_SPEED_SLOW : WALK_SPEED;
      const move = new THREE.Vector3();
      const forward = forwardFromVisibleView();
      const right = rightFromVisibleView();
      if (pressedKeys.has("forward")) move.add(forward);
      if (pressedKeys.has("back")) move.sub(forward);
      if (pressedKeys.has("left")) move.sub(right);
      if (pressedKeys.has("right")) move.add(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        movePreservingDirection(move);
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
      if (e.key === "Escape" && activeEntry) {
        e.preventDefault();
        returnInspectedItem();
        return;
      }
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
    function onWindowBlur() {
      pressedKeys.clear();
    }

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      didDrag = false;
      startX = e.clientX;
      startY = e.clientY;
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) didDrag = true;
      targetYaw += dx * YAW_SENSITIVITY;
      targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, targetPitch + dy * PITCH_SENSITIVITY));
      startX = e.clientX;
      startY = e.clientY;
    }

    // Minimal item-inspection interaction: click a hung item to bring it in
    // front of the camera and scale it up; Escape or clicking it again
    // returns it to its wall slot. Not the full pickup/drag-spin system the
    // personal room has — enough to prove approach/select/inspect/return
    // exists in the public flow, per the acceptance checklist.
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    type InspectEntry = (typeof inspectable)[number];
    type InspectAnim = {
      entry: InspectEntry;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromRotY: number;
      toRotY: number;
      fromScale: number;
      toScale: number;
      t: number;
    };
    let activeEntry: InspectEntry | null = null;
    let anim: InspectAnim | null = null;

    function focalPoint() {
      const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
      return cameraBody.clone().addScaledVector(forward, 2.4);
    }

    function inspectItem(entry: InspectEntry) {
      activeEntry = entry;
      anim = {
        entry,
        fromPos: entry.mesh.position.clone(),
        toPos: focalPoint(),
        fromRotY: entry.mesh.rotation.y,
        toRotY: yaw + Math.PI,
        fromScale: entry.mesh.scale.x,
        toScale: 1.8,
        t: 0,
      };
    }
    function returnInspectedItem() {
      if (!activeEntry) return;
      const entry = activeEntry;
      anim = {
        entry,
        fromPos: entry.mesh.position.clone(),
        toPos: entry.homePos.clone(),
        fromRotY: entry.mesh.rotation.y,
        toRotY: entry.homeRotY,
        fromScale: entry.mesh.scale.x,
        toScale: entry.homeScale,
        t: 0,
      };
      activeEntry = null;
    }

    function onClick(e: MouseEvent) {
      if (didDrag) return;
      if (activeEntry) {
        returnInspectedItem();
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObjects(
        inspectable.map((entry) => entry.mesh),
        false
      )[0];
      if (!hit) return;
      const entry = inspectable.find((candidate) => candidate.mesh === hit.object);
      if (entry) inspectItem(entry);
    }

    function onPointerUp() {
      isDragging = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const signedDistance = e.deltaY > 0 ? -0.42 : 0.42;
      movePreservingDirection(forwardFromVisibleView().multiplyScalar(signedDistance));
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    function tick() {
      frameId = window.requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);

      updateKeyboardMovement(dt);
      yaw += (targetYaw - yaw) * 0.12;
      pitch += (targetPitch - pitch) * 0.12;
      cameraBody.lerp(targetCameraBody, 0.15);
      cameraBody.y = MUSEUM_EYE_HEIGHT;

      camera.position.copy(cameraBody);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      if (anim) {
        anim.t = Math.min(1, anim.t + dt / 0.35);
        const k = anim.t * anim.t * (3 - 2 * anim.t);
        anim.entry.mesh.position.lerpVectors(anim.fromPos, anim.toPos, k);
        anim.entry.mesh.rotation.y = THREE.MathUtils.lerp(anim.fromRotY, anim.toRotY, k);
        anim.entry.mesh.scale.setScalar(THREE.MathUtils.lerp(anim.fromScale, anim.toScale, k));
        if (anim.t >= 1) anim = null;
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

    // Expose real measurements for the implementation report / live
    // verification, same pattern as the personal room's own __vltdDebug.
    (window as unknown as { __vltdPrototypeDebug?: unknown }).__vltdPrototypeDebug = {
      scene,
      camera,
      roomWidth: STANDARD_ROOM_WIDTH,
      roomDepth: STANDARD_ROOM_DEPTH,
      roomHeight: STANDARD_ROOM_HEIGHT,
      doorwayClearWidth: DOORWAY_CLEAR_WIDTH,
      doorwayClearHeight: DOORWAY_CLEAR_HEIGHT,
      getCameraBody: () => cameraBody.clone(),
      getYawPitch: () => ({ yaw, pitch, targetYaw, targetPitch }),
      setCameraBody: (x: number, z: number, newYaw?: number) => {
        cameraBody.set(x, MUSEUM_EYE_HEIGHT, z);
        targetCameraBody.copy(cameraBody);
        if (typeof newYaw === "number") {
          yaw = newYaw;
          targetYaw = newYaw;
        }
      },
    };

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      pressedKeys.clear();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0b0f16]">
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <Link
            href="/museum"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70"
          >
            ← Exit
          </Link>
          <div className="rounded-full bg-black/55 px-4 py-2 text-right ring-1 ring-white/15 backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">
              Standard-room prototype — 21 x 26 x 9.15
            </div>
          </div>
        </div>
        {helpVisible ? (
          <div className="pointer-events-auto mx-auto flex items-center gap-3 rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white/75 ring-1 ring-white/15 backdrop-blur">
            <span>WASD/arrows to move · drag to look · scroll to step · click an item to inspect, Esc to return</span>
            <button type="button" className="text-white/50 hover:text-white" onClick={() => setHelpVisible(false)}>
              ✕
            </button>
          </div>
        ) : null}
      </div>
      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
          Building the prototype…
        </div>
      ) : null}
    </div>
  );
}
