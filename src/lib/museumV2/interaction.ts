// Museum Runtime V2 (2026-09-24) — interaction: click-to-walk targets and
// item clicks share one pointer stream (movement.ts's own onPointerDown/
// Move/Up already decides "was this a click or a drag" — see that file's
// header comment), so this module owns exactly one job: given a click at
// (clientX, clientY), raycast against whatever is currently interactive
// (navigation-target chevrons + placed item meshes) and report which ONE
// thing — if any — was actually clicked, nearest hit wins, same as any
// ordinary 3D pointer-picking. Hover (for cursor + the same highlight-on-
// hover feedback legacy's waypoint markers already had) is a second,
// independent raycast on pointermove, not tied to movement.ts's own drag
// tracking at all.

import * as THREE from "three";

import type { MuseumItemClickRef } from "@/lib/campusRoomBuilder";
import type { CampusWaypoint } from "@/lib/campusLayout";
import type { WaypointMesh } from "./navigationTargets";

export type InteractionTargets = {
  waypointMeshes: WaypointMesh[];
  // Room-owned groups (roomStreaming.ts's StreamedRoom.group) — item meshes
  // load asynchronously into these, so raycasting against the groups
  // themselves (recursively) always sees whatever's actually landed so
  // far, with no separate list to keep in sync.
  itemRoots: THREE.Object3D[];
};

type ItemMesh = THREE.Object3D & { userData: { itemRef: MuseumItemClickRef } };

function isWaypointMesh(obj: THREE.Object3D): obj is WaypointMesh {
  return Boolean((obj.userData as { waypoint?: CampusWaypoint }).waypoint);
}
function isItemMesh(obj: THREE.Object3D): obj is ItemMesh {
  return Boolean((obj.userData as { itemRef?: MuseumItemClickRef }).itemRef);
}

export type InteractionHandle = {
  setTargets: (targets: InteractionTargets) => void;
  handleHover: (clientX: number, clientY: number, camera: THREE.Camera, domElement: HTMLElement) => void;
  /** Returns what was clicked, if anything — the caller (component) decides
   * what to actually do (walk / open an item) so this module stays free of
   * app-level side effects like opening a modal. */
  resolveClick: (clientX: number, clientY: number, camera: THREE.Camera, domElement: HTMLElement) => { kind: "waypoint"; waypoint: CampusWaypoint } | { kind: "item"; itemRef: MuseumItemClickRef } | null;
};

export function createInteraction(): InteractionHandle {
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let targets: InteractionTargets = { waypointMeshes: [], itemRoots: [] };
  let hoveredWaypoint: WaypointMesh | null = null;

  function setWaypointHover(marker: WaypointMesh | null) {
    if (hoveredWaypoint === marker) return;
    if (hoveredWaypoint) {
      hoveredWaypoint.scale.set(1, 1, 1);
      (hoveredWaypoint.material as THREE.MeshBasicMaterial).opacity = 0.72;
    }
    if (marker) {
      marker.scale.set(1.3, 1.3, 1);
      (marker.material as THREE.MeshBasicMaterial).opacity = 1;
    }
    hoveredWaypoint = marker;
  }

  function setNdc(clientX: number, clientY: number, domElement: HTMLElement) {
    const rect = domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** Nearest hit across both waypoint markers and item meshes, or null. */
  function raycastNearest(clientX: number, clientY: number, camera: THREE.Camera, domElement: HTMLElement): THREE.Object3D | null {
    setNdc(clientX, clientY, domElement);
    raycaster.setFromCamera(pointerNdc, camera);
    const waypointHits = targets.waypointMeshes.length ? raycaster.intersectObjects(targets.waypointMeshes, false) : [];
    const itemHits = targets.itemRoots.length ? raycaster.intersectObjects(targets.itemRoots, true).filter((h) => isItemMesh(h.object)) : [];
    const all = [...waypointHits, ...itemHits].sort((a, b) => a.distance - b.distance);
    return all[0]?.object ?? null;
  }

  return {
    setTargets: (next) => {
      targets = next;
      if (hoveredWaypoint && !targets.waypointMeshes.includes(hoveredWaypoint)) hoveredWaypoint = null;
    },
    handleHover: (clientX, clientY, camera, domElement) => {
      const hit = raycastNearest(clientX, clientY, camera, domElement);
      setWaypointHover(hit && isWaypointMesh(hit) ? hit : null);
      domElement.style.cursor = hit ? "pointer" : "";
    },
    resolveClick: (clientX, clientY, camera, domElement) => {
      const hit = raycastNearest(clientX, clientY, camera, domElement);
      if (!hit) return null;
      if (isWaypointMesh(hit)) return { kind: "waypoint", waypoint: hit.userData.waypoint };
      if (isItemMesh(hit)) return { kind: "item", itemRef: hit.userData.itemRef };
      return null;
    },
  };
}
