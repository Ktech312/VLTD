// Museum Runtime V2 (2026-09-23) — movement and camera.
// Reuses the same shared controller (src/lib/visitorController.ts,
// unchanged) the legacy campus and the personal Gallery room both already
// use, and reproduces the legacy campus's own WASD/drag/wheel wiring
// (VltdMuseumCampus.tsx's tick()/onPointerMove()/onWheel(), not exported
// there) so the feel matches exactly. Deliberately dropped for this first
// V2 pass: the click-to-walk floor-waypoint tween (startWalkTween/
// walkTween) — not part of the work order's own verification checklist
// ("scroll, WASD, and drag movement remain smooth"), and cutting it keeps
// this file's scope to what's actually required rather than porting the
// legacy waypoint-marker system (a separate, sizable chunk of raycasting/
// hover-highlight code) into a new runtime unproven for anything yet.

import * as THREE from "three";

import { buildWalkableAreas } from "@/lib/campusLayout";
import {
  aimCamera,
  applyDrag,
  buildKeyboardMoveDirection,
  easeTowardTargets,
  facingDirection,
  WHEEL_STEP,
} from "@/lib/visitorController";
import { MUSEUM_PITCH_LIMIT, MUSEUM_WALK_SPEED, MUSEUM_WALK_SPEED_SLOW } from "@/lib/museumStandard";
import { moveWithCollision } from "./collision";

const TURN_RATE = 1.7; // rad/sec, Left/Right arrow turning — matches the legacy campus exactly
const WHEEL_POSITION_EASE_RATE = 0.08;
const EYE_HEIGHT_DEFAULT = 5.4; // overwritten per-call by the real EYE_HEIGHT the caller passes in

type WalkableAreas = ReturnType<typeof buildWalkableAreas>;

export type VisitorMovement = {
  attach: () => void;
  detach: () => void;
  update: (dt: number) => void;
  getPosition: () => THREE.Vector3;
  getYaw: () => number;
  setWalkableAreas: (areas: WalkableAreas) => void;
  /** Teleports the camera body immediately (used for a fresh spawn — e.g.
   * a doorway crossing that recenters the streamed neighborhood — never for
   * ordinary movement, which always goes through moveWithCollision). */
  setPosition: (x: number, z: number, yaw?: number) => void;
};

export function createVisitorMovement(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  spawn: { x: number; z: number; yaw: number },
  initialWalkable: WalkableAreas,
  eyeHeight: number = EYE_HEIGHT_DEFAULT
): VisitorMovement {
  let walkable = initialWalkable;
  let yaw = spawn.yaw;
  let pitch = 0;
  let targetYaw = yaw;
  let targetPitch = 0;
  const cameraBody = new THREE.Vector3(spawn.x, eyeHeight, spawn.z);
  const targetCameraBody = cameraBody.clone();

  const pressedKeys = new Set<string>();
  let isDragging = false;
  let startX = 0;
  let startY = 0;

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
  function onWindowBlur() {
    pressedKeys.clear();
  }

  function updateKeyboardMovement(dt: number) {
    if (pressedKeys.size === 0) return;
    const speed = pressedKeys.has("shift") ? MUSEUM_WALK_SPEED_SLOW : MUSEUM_WALK_SPEED;
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
      moveWithCollision(cameraBody, move, walkable);
      cameraBody.y = eyeHeight;
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

  function onPointerDown(e: PointerEvent) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  }
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dragged = applyDrag(dx, dy, targetYaw, targetPitch, MUSEUM_PITCH_LIMIT);
    targetYaw = dragged.targetYaw;
    targetPitch = dragged.targetPitch;
    startX = e.clientX;
    startY = e.clientY;
  }
  function onPointerUp() {
    isDragging = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const signedStep = e.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
    const delta = facingDirection(yaw).multiplyScalar(signedStep);
    moveWithCollision(targetCameraBody, delta, walkable);
    targetCameraBody.y = eyeHeight;
  }

  function attach() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });
  }
  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onWindowBlur);
    domElement.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    domElement.removeEventListener("wheel", onWheel);
  }

  function update(dt: number) {
    updateKeyboardMovement(dt);
    const eased = easeTowardTargets(yaw, targetYaw, pitch, targetPitch, cameraBody, targetCameraBody, false, WHEEL_POSITION_EASE_RATE);
    yaw = eased.yaw;
    pitch = eased.pitch;
    cameraBody.y = eyeHeight;
    aimCamera(camera, cameraBody, yaw, pitch);
  }

  return {
    attach,
    detach,
    update,
    getPosition: () => cameraBody,
    getYaw: () => yaw,
    setWalkableAreas: (areas) => {
      walkable = areas;
    },
    setPosition: (x, z, newYaw) => {
      cameraBody.set(x, eyeHeight, z);
      targetCameraBody.copy(cameraBody);
      if (newYaw !== undefined) {
        yaw = newYaw;
        targetYaw = newYaw;
      }
    },
  };
}
