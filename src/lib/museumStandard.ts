// Shared source of truth for the VLTD Museum "standard room" module —
// created for the 2026-09-06 Full Museum Scale handoff, Phase 1.
//
// Every value here is copied from the ACCEPTED personal room
// (VirtualGalleryRoom.tsx, /museum/virtual-room), confirmed directly against
// that file's own source (not assumed from the handoff doc) before being
// written down here:
//   - room shell: `new THREE.PlaneGeometry(21, 26)` (floor and ceiling),
//     ceiling at y=9.15
//   - camera: `new THREE.PerspectiveCamera(47, ...)`, `eyeHeight = 3.6`
//   - movement: `WALK_SPEED = 2.55`, `WALK_SPEED_SLOW = 1.73`,
//     `NAV_PITCH_LIMIT = 0.32`
//   - doorway: the plain post+header frame every non-Blue style falls back
//     to (`doorLeft`/`doorRight`/`doorHeader`) — two posts
//     `BoxGeometry(0.16, 4.95, 0.18)` centered at x=+-1.85, plus a header
//     `BoxGeometry(3.85, 0.18, 0.18)` at y=4.92. This is the "modeled
//     entrance frame already used by the accepted room" the handoff means —
//     not the Vault GLB's own baked ornate arch, which is a Vault-specific
//     interior detail, not the shared doorway module.
//
// The public campus (VltdMuseumCampus.tsx) and any future standard-room
// prototype must read from here rather than re-declaring their own copies,
// so the two surfaces can't drift apart again the way the campus's old
// 20.43 x 16.72 rooms drifted from this 21 x 26 shell.

export const STANDARD_ROOM_WIDTH = 21; // interior clear width (X), matches VirtualGalleryRoom.tsx's floor/ceiling PlaneGeometry
export const STANDARD_ROOM_DEPTH = 26; // interior clear depth (Z)
export const STANDARD_ROOM_HEIGHT = 9.15; // interior clear height, matches the accepted room's ceiling y

export const MUSEUM_CAMERA_FOV = 47; // degrees, vertical FOV
export const MUSEUM_EYE_HEIGHT = 3.6;
export const MUSEUM_WALK_SPEED = 2.55; // units/sec
export const MUSEUM_WALK_SPEED_SLOW = 1.73; // units/sec, Shift
export const MUSEUM_PITCH_LIMIT = 0.32; // radians

// The accepted room's plain doorway frame — two posts + a header, no fill
// across the opening (a real walkable passage, not a blocked-off wall).
// Measured directly from VirtualGalleryRoom.tsx's own doorLeft/doorRight/
// doorHeader meshes.
export const DOORWAY_POST_HALF_SPACING = 1.85; // each post's center distance from the opening's centerline
export const DOORWAY_POST_WIDTH = 0.16;
export const DOORWAY_POST_DEPTH = 0.18;
export const DOORWAY_POST_HEIGHT = 4.95;
export const DOORWAY_HEADER_WIDTH = 3.85;
export const DOORWAY_HEADER_HEIGHT = 0.18;
export const DOORWAY_HEADER_DEPTH = 0.18;
export const DOORWAY_HEADER_Y = 4.92;
// Clear walkthrough opening, derived from the measurements above (inner
// face to inner face of the two posts, floor to the header's underside).
export const DOORWAY_CLEAR_WIDTH =
  DOORWAY_POST_HALF_SPACING * 2 - DOORWAY_POST_WIDTH; // 3.54
export const DOORWAY_CLEAR_HEIGHT = DOORWAY_HEADER_Y - DOORWAY_HEADER_HEIGHT / 2; // 4.83

// Reserved floor/wall margin on each side of a doorway's centerline where no
// shelf, panel, or display slot may be placed — approach, turn, sightline,
// and camera-collision clearance (handoff requirement 5 under "Two-door
// standard room").
export const DOORWAY_NO_DISPLAY_HALF_WIDTH = 2.2;

// The wall-gap width a real doorwayKit.ts frame needs to sit in without its
// posts clipping into the solid wall on either side: outer face of each post
// is DOORWAY_POST_HALF_SPACING + DOORWAY_POST_WIDTH / 2 (1.93) from center,
// so the full footprint is 3.86; +0.24 total clearance rounds to 4.1. Campus
// rooms using the plain rectangular gap (no kit) keep the campus's own
// narrower DOOR_WIDTH — this constant is only for doors that install the
// real frame.
export const DOORWAY_WALL_GAP =
  (DOORWAY_POST_HALF_SPACING + DOORWAY_POST_WIDTH / 2) * 2 + 0.24;
