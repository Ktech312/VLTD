// The shared doorway frame kit — the same plain post+header assembly the
// accepted personal room falls back to for every non-Blue style
// (VirtualGalleryRoom.tsx's doorLeft/doorRight/doorHeader), extracted here
// so any new standard-room module (the museum campus, a future prototype)
// can install the identical, already-accepted opening instead of a flat
// rectangular gap. Measurements live in museumStandard.ts, not duplicated
// here.
//
// The accepted room's own inline copy is left untouched — this is a fresh
// implementation of the same measurements/material rules, not a refactor of
// that file, so the protected room can't regress from this change.
import * as THREE from "three";

import {
  DOORWAY_HEADER_DEPTH,
  DOORWAY_HEADER_HEIGHT,
  DOORWAY_HEADER_WIDTH,
  DOORWAY_HEADER_Y,
  DOORWAY_POST_DEPTH,
  DOORWAY_POST_HALF_SPACING,
  DOORWAY_POST_HEIGHT,
  DOORWAY_POST_WIDTH,
} from "./museumStandard";

/**
 * Builds one doorway frame — two posts and a header, opening centered on
 * local (0,0,0), facing local +Z, no fill across the opening. The caller
 * positions/rotates the returned group to place it on whichever wall.
 */
export function buildDoorwayFrame(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = "standard_doorway_frame";

  const postGeometry = new THREE.BoxGeometry(DOORWAY_POST_WIDTH, DOORWAY_POST_HEIGHT, DOORWAY_POST_DEPTH);
  const left = new THREE.Mesh(postGeometry, material);
  left.position.set(-DOORWAY_POST_HALF_SPACING, DOORWAY_POST_HEIGHT / 2, 0);
  left.name = "doorway_post_left";
  group.add(left);

  const right = new THREE.Mesh(postGeometry.clone(), material);
  right.position.set(DOORWAY_POST_HALF_SPACING, DOORWAY_POST_HEIGHT / 2, 0);
  right.name = "doorway_post_right";
  group.add(right);

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(DOORWAY_HEADER_WIDTH, DOORWAY_HEADER_HEIGHT, DOORWAY_HEADER_DEPTH),
    material
  );
  header.position.set(0, DOORWAY_HEADER_Y, 0);
  header.name = "doorway_header";
  group.add(header);

  return group;
}
