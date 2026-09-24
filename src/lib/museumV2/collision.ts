// Museum Runtime V2 (2026-09-23) — collision.
// moveWithCollision() is ported verbatim from the local closure of the same
// name inside VltdMuseumCampus.tsx (not exported there, and that file is
// off-limits to edit for this work) — substeps a move so a fast input can't
// tunnel across a thin doorway threshold, and on a blocked diagonal step,
// slides along whichever single axis is still walkable instead of stopping
// outright (the 2026-09-14 doorway-stuck-collision fix). isWalkable()/
// buildWalkableAreas() themselves are unchanged, real exports from
// campusLayout.ts — this file only reproduces the substep/slide wrapper
// built on top of them.

import * as THREE from "three";

import { buildWalkableAreas, isWalkable } from "@/lib/campusLayout";

type WalkableAreas = ReturnType<typeof buildWalkableAreas>;

const MAX_SUBSTEP = 0.14;

export function moveWithCollision(position: THREE.Vector3, delta: THREE.Vector3, walkable: WalkableAreas): void {
  const distance = delta.length();
  if (distance === 0) return;

  const direction = delta.clone().normalize();
  const steps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const step = direction.multiplyScalar(distance / steps);

  for (let index = 0; index < steps; index += 1) {
    const nextX = position.x + step.x;
    const nextZ = position.z + step.z;
    if (isWalkable(nextX, nextZ, walkable)) {
      position.x = nextX;
      position.z = nextZ;
      continue;
    }
    const xOnlyWalkable = isWalkable(nextX, position.z, walkable);
    const zOnlyWalkable = isWalkable(position.x, nextZ, walkable);
    if (xOnlyWalkable) {
      position.x = nextX;
    } else if (zOnlyWalkable) {
      position.z = nextZ;
    } else {
      break;
    }
  }
}
