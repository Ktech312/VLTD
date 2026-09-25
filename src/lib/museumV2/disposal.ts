// Museum Runtime V2 (2026-09-23) — cleanup/disposal helpers.
// Separate from the legacy campus's own cleanup block (VltdMuseumCampus.tsx,
// untouched by this work) because V2's whole premise is that rooms come and
// go during a visit (streamed in/out as the visitor moves), not built once
// and torn down only on unmount — so disposal has to be callable mid-session,
// per room, not just once at the end.

import * as THREE from "three";

function disposeMaterial(material: THREE.Material) {
  // Dispose any texture the material references so a disposed room doesn't
  // leak GPU texture memory, matching the pattern already used for style
  // swaps elsewhere in the legacy campus code.
  for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
    const value = material[key];
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/** Recursively disposes every geometry/material/texture under `root`, then
 * removes it from its parent. Safe to call on a group containing meshes,
 * lights, and nested groups — anything that isn't a disposable resource is
 * just skipped. */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    }
  });
  root.parent?.remove(root);
}

/** Disposes a list of objects and clears the array in place — the common
 * "tear down everything this room owns" call a room-streaming entry makes
 * when it's unloaded. */
export function disposeAll(objects: THREE.Object3D[]): void {
  for (const obj of objects) disposeObject3D(obj);
  objects.length = 0;
}
