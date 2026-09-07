// The shared first-person visitor controller — extracted from the accepted
// personal room (VirtualGalleryRoom.tsx) so every walkable Three.js surface
// (the personal room, the public campus, the standard-room prototype) uses
// the exact same drag/scroll/keyboard/camera-aim math instead of each
// re-inventing its own.
//
// Museum Controls Correction Addendum (2026-09-06): an earlier pass
// invented a DIFFERENT campus controller from a theoretical bug analysis —
// wrong drag sign, ~23% of the accepted sensitivity, and direct
// `camera.rotation.y/x` assignment instead of the accepted room's
// `camera.lookAt()` aiming. That analysis is superseded. Every constant and
// formula below is copied verbatim from VirtualGalleryRoom.tsx's own
// working code, not re-derived:
//   - drag: `targetYaw -= dx * 0.0035`, `targetPitch += dy * 0.0016`
//   - movement basis: facingDirection()/strafeDirection() read `targetYaw`
//     (NOT the eased `yaw` — this was the earlier pass's wrong assumption)
//   - camera aim: a calculated lookDirection fed to `camera.lookAt(...)`,
//     never a direct rotation assignment
//   - wheel: a fixed 0.42-unit step per event, added to `targetCameraBody`
//     (eases in over subsequent frames)
//   - continuous WASD: added directly to `cameraBody` each frame
//     (`speed * dt`), clamped, then `targetCameraBody` synced to match —
//     no easing lag, unlike wheel
//   - per-frame easing: `yaw/pitch` chase `targetYaw/targetPitch` at 0.12,
//     `cameraBody` chases `targetCameraBody` at 0.15
//
// Collision is intentionally NOT baked in here — the personal room uses a
// simple rectangular clamp, the campus/prototype use a room-graph
// walkability check. Every consumer supplies its own `clamp`/`isWalkable`
// callback, which may only accept, shorten, or reject a requested move —
// never substitute a different heading (no per-axis fallback sliding).
import * as THREE from "three";

export const DRAG_YAW_SENSITIVITY = 0.0035;
export const DRAG_PITCH_SENSITIVITY = 0.0016;
export const WHEEL_STEP = 0.42;
export const YAW_EASE_RATE = 0.12;
export const POSITION_EASE_RATE = 0.15;

export function facingDirection(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
}

export function strafeDirection(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)).normalize();
}

/** Drag-to-look: dx/dy are the pointer's movement since the last sample. */
export function applyDrag(
  dx: number,
  dy: number,
  targetYaw: number,
  targetPitch: number,
  pitchLimit: number
): { targetYaw: number; targetPitch: number } {
  const nextYaw = targetYaw - dx * DRAG_YAW_SENSITIVITY;
  const nextPitch = Math.max(-pitchLimit, Math.min(pitchLimit, targetPitch + dy * DRAG_PITCH_SENSITIVITY));
  return { targetYaw: nextYaw, targetPitch: nextPitch };
}

/** Aims the camera at the rendered yaw/pitch — the accepted room's own
 * lookDirection + camera.lookAt() pattern, not a direct rotation set. */
export function aimCamera(camera: THREE.PerspectiveCamera, cameraBody: THREE.Vector3, yaw: number, pitch: number) {
  const lookDirection = new THREE.Vector3(Math.sin(yaw), Math.sin(pitch), -Math.cos(yaw)).normalize();
  camera.position.copy(cameraBody);
  camera.lookAt(cameraBody.clone().add(lookDirection.multiplyScalar(6)));
}

/** Per-frame easing of yaw/pitch toward their targets, and cameraBody
 * toward targetCameraBody. Mutates cameraBody in place (Vector3.lerp does);
 * returns the new yaw/pitch since those are plain numbers. */
export function easeTowardTargets(
  yaw: number,
  targetYaw: number,
  pitch: number,
  targetPitch: number,
  cameraBody: THREE.Vector3,
  targetCameraBody: THREE.Vector3,
  immediate = false
): { yaw: number; pitch: number } {
  const yawPitchRate = immediate ? 1 : YAW_EASE_RATE;
  const positionRate = immediate ? 1 : POSITION_EASE_RATE;
  const nextYaw = yaw + (targetYaw - yaw) * yawPitchRate;
  const nextPitch = pitch + (targetPitch - pitch) * yawPitchRate;
  cameraBody.lerp(targetCameraBody, positionRate);
  return { yaw: nextYaw, pitch: nextPitch };
}

export type MovementKeys = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};

/** The combined WASD/arrow move direction for one frame, using `targetYaw`
 * (the accepted room's own basis — see the module comment above). Returns a
 * zero vector if no movement keys are held. */
export function buildKeyboardMoveDirection(keys: MovementKeys, targetYaw: number): THREE.Vector3 {
  const move = new THREE.Vector3();
  const forward = facingDirection(targetYaw);
  const strafe = strafeDirection(targetYaw);
  if (keys.forward) move.add(forward);
  if (keys.back) move.sub(forward);
  if (keys.left) move.sub(strafe);
  if (keys.right) move.add(strafe);
  if (move.lengthSq() > 0) move.normalize();
  return move;
}
