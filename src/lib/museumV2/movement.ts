// Museum Runtime V2 (2026-09-23, nav-targets pass 2026-09-24) — movement
// and camera. Reuses the same shared controller (src/lib/
// visitorController.ts, unchanged) the legacy campus and the personal
// Gallery room both already use, and reproduces the legacy campus's own
// WASD/drag/wheel/click-to-walk wiring (VltdMuseumCampus.tsx's tick()/
// onPointerMove()/onWheel()/startWalkTween(), not exported there) so the
// feel matches exactly — walkTo()/PadAlignTween below is startWalkTween()
// ported verbatim, not a reinvented system. The actual decision of WHAT
// was clicked (a waypoint vs. an item vs. empty space) lives outside this
// file, in interaction.ts — this file only knows how to execute a walk
// once told a destination, via walkTo(), and reports plain clicks (drag
// distance below the threshold) via the onClick callback so interaction.ts
// can raycast and decide.

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
const DRAG_CLICK_THRESHOLD = 6; // px — matches legacy's own didDrag threshold exactly
const ALIGN_TURN_SPEED = Math.PI / 1.1; // rad/sec — a full 180-degree turn takes ~1.1s, ported from legacy

type WalkableAreas = ReturnType<typeof buildWalkableAreas>;

function smoothstep(q: number): number {
  return q * q * (3 - 2 * q);
}

function shortestYawDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

type PadAlignTween = {
  fromPos: THREE.Vector3; toPos: THREE.Vector3;
  fromYaw: number; toYaw: number;
  fromPitch: number; toPitch: number;
  t: number; duration: number;
};

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
  /** Smoothly walks to a destination (a clicked navigation target) —
   * ported verbatim from the legacy campus's own startWalkTween(). A held
   * movement/turn key or a real look-drag interrupts an in-progress walk,
   * same as legacy. */
  walkTo: (x: number, z: number, destinationYaw: number) => void;
};

export function createVisitorMovement(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  spawn: { x: number; z: number; yaw: number },
  initialWalkable: WalkableAreas,
  eyeHeight: number = EYE_HEIGHT_DEFAULT,
  onClick?: (clientX: number, clientY: number) => void
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
  let didDrag = false;
  let startX = 0;
  let startY = 0;
  let walkTween: PadAlignTween | null = null;

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
    walkTween = null; // a held movement/turn key interrupts an in-progress click-to-walk, same as legacy
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
    didDrag = false;
    startX = e.clientX;
    startY = e.clientY;
  }
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_CLICK_THRESHOLD) {
      didDrag = true;
      walkTween = null; // a real manual look-drag interrupts an in-progress auto-walk, same as legacy
    }
    const dragged = applyDrag(dx, dy, targetYaw, targetPitch, MUSEUM_PITCH_LIMIT);
    targetYaw = dragged.targetYaw;
    targetPitch = dragged.targetPitch;
    startX = e.clientX;
    startY = e.clientY;
  }
  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (!didDrag && onClick) onClick(e.clientX, e.clientY);
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

  // Ported verbatim from the legacy campus's own startWalkTween() —
  // duration scales with both travel distance and how much the view has
  // to turn, so a big reorientation always gets time proportional to how
  // far it turns (EK's own "choppy" fix from that file's history).
  function walkTo(x: number, z: number, destinationYaw: number) {
    const destination = new THREE.Vector3(x, eyeHeight, z);
    const fromPos = cameraBody.clone();
    const travelDistance = fromPos.distanceTo(destination);
    const yawDelta = shortestYawDelta(yaw, destinationYaw);
    const toYaw = yaw + yawDelta;
    const turnAmount = Math.abs(yawDelta) + Math.abs(pitch - 0);
    const duration = THREE.MathUtils.clamp(
      Math.max(travelDistance / 4.8, turnAmount / ALIGN_TURN_SPEED),
      0.45,
      2.2
    );
    walkTween = {
      fromPos, toPos: destination,
      fromYaw: yaw, toYaw,
      fromPitch: pitch, toPitch: 0,
      t: 0, duration,
    };
    targetCameraBody.copy(destination);
    targetYaw = toYaw;
    targetPitch = 0;
  }

  function update(dt: number) {
    updateKeyboardMovement(dt);
    if (walkTween) {
      walkTween.t = Math.min(1, walkTween.t + dt / walkTween.duration);
      const k = smoothstep(walkTween.t);
      cameraBody.lerpVectors(walkTween.fromPos, walkTween.toPos, k);
      yaw = walkTween.fromYaw + (walkTween.toYaw - walkTween.fromYaw) * k;
      pitch = walkTween.fromPitch + (walkTween.toPitch - walkTween.fromPitch) * k;
      if (walkTween.t >= 1) {
        cameraBody.copy(walkTween.toPos);
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
      walkTween = null;
      cameraBody.set(x, eyeHeight, z);
      targetCameraBody.copy(cameraBody);
      if (newYaw !== undefined) {
        yaw = newYaw;
        targetYaw = newYaw;
      }
    },
    walkTo,
  };
}
