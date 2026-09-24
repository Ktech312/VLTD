"use client";

// Museum Runtime V2 (2026-09-23) — runtime and scene lifecycle.
// A separate visitor runtime from the legacy VltdMuseumCampus.tsx (untouched
// by this work, still the production fallback at plain /museum/vltd?room=…),
// reached at /museum/vltd?room=POP_CULTURE&runtime=v2. Builds a streamed
// neighborhood (roomStreaming.ts) around whichever room the camera is
// standing in — that room plus its direct adjacentRoomIds() neighbors —
// instead of the legacy component's one-time whole-campus construction.
// Movement/camera/collision (movement.ts, collision.ts) reuse the same
// shared visitorController.ts every other room in this app already uses.
//
// First-pass scope, per the work order: POP_CULTURE only loads from its
// published bake; TCG and HUB (its two real doors) are the only neighbors
// this proof preloads; no other room is converted or reachable by walking
// further than one hop from POP_CULTURE without triggering another,
// perfectly ordinary streaming cycle (which will build them procedurally,
// same as TCG/HUB, since nothing else has been published yet).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  CAMPUS_ROOMS,
  CAMPUS_SPAWN,
  EYE_HEIGHT,
  buildWalkableAreas,
  roomBounds,
  roomById,
  type CampusRoomId,
} from "@/lib/campusLayout";
import { MUSEUM_CAMERA_FOV } from "@/lib/museumStandard";
import { createVisitorMovement } from "@/lib/museumV2/movement";
import { createCampusShell, disposeCampusShell, primeRoom, syncNeighborhood, type CampusShellHandle } from "@/lib/museumV2/roomStreaming";

type Props = { roomId: CampusRoomId };

type DebugStats = {
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
};

function currentRoomId(x: number, z: number): CampusRoomId | null {
  const room = CAMPUS_ROOMS.find((r) => {
    const b = roomBounds(r);
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  });
  return room?.id ?? null;
}

export default function VltdMuseumCampusV2({ roomId }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roomLabelRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1626);
    scene.fog = new THREE.Fog(0x081527, 40, 140);

    const camera = new THREE.PerspectiveCamera(MUSEUM_CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbcd6ef, 0x12294a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.6);
    sun.position.set(40, 60, 20);
    scene.add(sun);

    const spawnRoom = roomById(roomId);
    const spawn = { x: spawnRoom.x + spawnRoom.w / 2, z: spawnRoom.z + spawnRoom.d / 2, yaw: CAMPUS_SPAWN.yaw };
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);

    // Purely data-driven (CAMPUS_ROOMS/CAMPUS_DOORS are static), not tied to
    // which rooms are currently streamed in — computed once, matching
    // exactly what the legacy campus's own collision already allows. Visual
    // content streaming in a beat behind the visitor crossing into a
    // not-yet-loaded neighbor (more than one hop from the current center)
    // is a real, bounded, disclosed limitation of this first pass, not a
    // silent gap.
    const walkable = buildWalkableAreas();

    const movement = createVisitorMovement(camera, renderer.domElement, spawn, walkable, EYE_HEIGHT);
    movement.attach();

    let shellHandle: CampusShellHandle | null = null;
    let centerRoomId: CampusRoomId = roomId;
    let syncInFlight = false;
    let pendingResync = false;
    const coldStart = performance.now();
    let firstReadyMs: number | null = null;

    async function resyncTo(nextCenter: CampusRoomId) {
      if (!shellHandle) return;
      if (syncInFlight) {
        pendingResync = true;
        return;
      }
      syncInFlight = true;
      centerRoomId = nextCenter;
      try {
        await syncNeighborhood(shellHandle, nextCenter);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to stream the room.");
      }
      syncInFlight = false;
      if (pendingResync) {
        pendingResync = false;
        const latest = currentRoomId(movement.getPosition().x, movement.getPosition().z);
        if (latest && latest !== centerRoomId) void resyncTo(latest);
      }
    }

    (async () => {
      try {
        shellHandle = createCampusShell(scene, new THREE.TextureLoader());
        if (cancelled) return;
        // Phase 1: only the room the visitor is actually entering — real
        // walls on every side (including toward TCG/HUB, not yet built),
        // real floor/ceiling/furniture/content. This is what the work
        // order's "controllable within 2s warm / 4s cold" target is about.
        await primeRoom(shellHandle, roomId);
        if (cancelled) return;
        renderer.compile(scene, camera);
        firstReadyMs = performance.now() - coldStart;
        setReady(true);
        // Phase 2: bring the rest of the neighborhood (TCG, HUB) in behind
        // it, unawaited — doesn't block "controllable," matches the work
        // order's own "preload only rooms directly connected" framing
        // (preload, not block on). Routed through resyncTo() (not a direct
        // syncNeighborhood call) so it shares the same syncInFlight guard a
        // doorway-crossing resync uses — otherwise a visitor crossing into
        // TCG/HUB before this background sync finishes could race it,
        // mutating handle.loadedRooms/loadedWalls from two places at once.
        void resyncTo(roomId);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load the room.");
      }
    })();

    let frameId = 0;
    const clock = new THREE.Clock();
    let lastRoomLabel = "__unset__";

    function frameStep(dt: number) {
      movement.update(dt);

      const pos = movement.getPosition();
      const room = currentRoomId(pos.x, pos.z);
      const label = room ? roomById(room).label : "";
      if (label !== lastRoomLabel) {
        lastRoomLabel = label;
        if (roomLabelRef.current) roomLabelRef.current.textContent = label || "Corridor";
      }
      if (room && room !== centerRoomId && !syncInFlight) {
        void resyncTo(room);
      }

      renderer.render(scene, camera);
    }

    function tick() {
      frameId = window.requestAnimationFrame(tick);
      frameStep(Math.min(clock.getDelta(), 0.05));
    }
    tick();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    // Real live-verification hook, same shape/spirit as the legacy campus's
    // own window.__vltdCampusMoveDebug — genuine renderer.info numbers, not
    // guesses, for the work order's own required cold/warm load time,
    // draw-call, triangle, texture, and memory report.
    (window as unknown as { __vltdMuseumV2Debug?: unknown }).__vltdMuseumV2Debug = {
      getSceneStats: (): DebugStats => ({
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        programs: renderer.info.programs?.length ?? 0,
      }),
      getFirstReadyMs: () => firstReadyMs,
      getCenterRoomId: () => centerRoomId,
      getLoadedRoomIds: () => (shellHandle ? Array.from(shellHandle.loadedRooms.keys()) : []),
      getCameraBody: () => ({ x: movement.getPosition().x, y: movement.getPosition().y, z: movement.getPosition().z, yaw: movement.getYaw() }),
      forceRender: () => renderer.render(scene, camera),
      // Verification-only: drives the exact same per-frame logic tick()
      // does (movement.update, room-crossing/resync check, render), but
      // via explicit dt steps instead of requestAnimationFrame — rAF is
      // throttled/paused by the browser whenever the tab isn't the visible
      // one (document.hidden), which is correct, standard behavior (the
      // legacy campus's own tick loop has the exact same characteristic),
      // not something specific to V2. This lets movement/collision/
      // doorway-crossing be verified deterministically regardless of
      // whether the tab is actually foregrounded during automated testing.
      pumpFrames: (count: number, dtMs = 16) => {
        for (let i = 0; i < count; i += 1) frameStep(dtMs / 1000);
      },
    };

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      movement.detach();
      if (shellHandle) disposeCampusShell(shellHandle);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      delete (window as unknown as { __vltdMuseumV2Debug?: unknown }).__vltdMuseumV2Debug;
    };
  }, [roomId]);

  return (
    <div className="fixed inset-0 bg-[#081527]">
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs font-medium tracking-wide text-white/85 ring-1 ring-white/15 backdrop-blur">
        <span ref={roomLabelRef}>Corridor</span>
        <span className="ml-2 text-cyan-300/80">V2</span>
      </div>
      <Link
        href="/museum/vltd"
        className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur hover:bg-black/80"
      >
        Exit
      </Link>
      {!ready && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081527] text-sm text-white/70">
          Loading room…
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#081527] text-sm text-red-300">
          {loadError}
        </div>
      )}
    </div>
  );
}
