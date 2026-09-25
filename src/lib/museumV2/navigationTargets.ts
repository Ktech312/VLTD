// Museum Runtime V2 (2026-09-24) — navigation targets.
// Ports the legacy campus's own blue/cyan click-to-walk chevron markers
// (VltdMuseumCampus.tsx's drawChevron()/makeChevronTexture()/the waypoint-
// mesh-build loop, none exported there) verbatim — same textures, same
// colors, same geometry, same positioning math — scoped down to only the
// rooms currently streamed in, since V2 never has the whole campus built
// at once the way the legacy component does. computeCampusWaypoints()
// (campusLayout.ts, unchanged) already tags every waypoint with the
// roomId it belongs to, so scoping is a plain filter, not a rewrite of
// that function.

import * as THREE from "three";

import { buildWalkableAreas, computeCampusWaypoints, isWalkable, type CampusRoomId, type CampusWaypoint } from "@/lib/campusLayout";

type WalkableAreas = ReturnType<typeof buildWalkableAreas>;

const HUB_TARGET_SIZE = 6.4;
const ROOM_CENTER_TARGET_SIZE = 2.2;

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

function makeChevronTexture(chevrons: { cx: number; cy: number; size: number; angle?: number; legFactor?: number }[]): THREE.CanvasTexture | null {
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

let doorwayChevronTexture: THREE.CanvasTexture | null | undefined;
let roomCenterChevronTexture: THREE.CanvasTexture | null | undefined;

function ensureTextures() {
  if (doorwayChevronTexture === undefined) {
    doorwayChevronTexture = makeChevronTexture([{ cx: 64, cy: 64, size: 68 }]);
  }
  if (roomCenterChevronTexture === undefined) {
    roomCenterChevronTexture = makeChevronTexture([
      { cx: 64, cy: 20, size: 26, angle: 0, legFactor: 0.5 },
      { cx: 64, cy: 108, size: 26, angle: Math.PI, legFactor: 0.5 },
      { cx: 108, cy: 64, size: 26, angle: Math.PI / 2, legFactor: 0.5 },
      { cx: 20, cy: 64, size: 26, angle: -Math.PI / 2, legFactor: 0.5 },
    ]);
  }
}

export type WaypointMesh = THREE.Mesh & { userData: { waypoint: CampusWaypoint } };

export type NavigationTargetsHandle = {
  meshes: WaypointMesh[];
  dispose: () => void;
};

/** Builds one marker per doorway/room-center waypoint whose room is in
 * `loadedRoomIds` — call again (after disposing the previous handle)
 * whenever the streamed room set changes. A waypoint that lands outside
 * the real walkable area is skipped, same defensive check legacy makes. */
export function buildNavigationTargets(
  scene: THREE.Scene,
  loadedRoomIds: Set<CampusRoomId>,
  walkable: WalkableAreas
): NavigationTargetsHandle {
  ensureTextures();
  const meshes: WaypointMesh[] = [];
  for (const waypoint of computeCampusWaypoints()) {
    if (!loadedRoomIds.has(waypoint.roomId)) continue;
    if (!isWalkable(waypoint.x, waypoint.z, walkable)) continue;

    const targetSize = waypoint.enlarged ? HUB_TARGET_SIZE : ROOM_CENTER_TARGET_SIZE;
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
    meshes.push(marker as unknown as WaypointMesh);
  }

  return {
    meshes,
    dispose: () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        scene.remove(mesh);
      }
    },
  };
}
