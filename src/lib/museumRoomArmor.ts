// Museum Vault/Loft style parity pass (2026-09-12): adapts
// createGalleryFinishes()'s own addVaultArmor()/addLoftArmor()
// (src/components/gallery/galleryRoomFinishes.ts) -- the personal Gallery
// Builder's real decorative "identity" geometry (structural rib panels,
// corner rivets, and a diagonal glowing ceiling-light lattice for Vault;
// ribs, rivets, a horizontal seam, and broad divided wall bays plus 4
// ceiling "arrow" chevrons for Loft) -- for the museum's own real rooms.
//
// That personal-room geometry is hardcoded to one fixed room shape (its own
// WALL_TOP=8.9, and specific x/z rib/panel coordinates like -12/-10.5/10.5).
// The museum's real rooms come in several different sizes (21x26, 42x26,
// 21x52, 42x52, per campusLayout.ts's CAMPUS_ROOMS) with door openings on
// different walls per room, so calling that code unmodified would place
// geometry in the wrong spots or clip through walls -- this file re-derives
// the SAME rib/rivet/divider/seam/lattice technique and materials
// (identical colors/roughness/metalness values), parameterized by a real
// room's own wall spans instead. It reuses the exact same data
// campusRoomBuilder.ts's buildSharedWall() already uses to build each real
// wall (campusLayout.ts's roomBounds()/splitSegmentForDoor()), so armor
// geometry only ever lands on real solid wall and never crosses a doorway.
//
// galleryRoomFinishes.ts itself is untouched by this pass -- its own
// addVaultArmor/addLoftArmor keep serving the personal Gallery room exactly
// as before.
//
// Two deliberate, disclosed simplifications versus the personal room's own
// frozen geometry:
// - The archway-flanking jamb boxes from the frozen addLoftArmor are
//   dropped. Every museum doorway already gets its own real jamb+head
//   casing from buildSharedWall() (campusRoomBuilder.ts) -- stacking a
//   second decorative jamb directly against that real casing would
//   reproduce the exact overlapping-geometry z-fighting/flicker bug
//   buildSharedWall()'s own history already found and fixed once (see its
//   "carve the casing's footprint OUT of the wall" comment). Vault's own
//   refined armor already removed its jambs for an unrelated reason (EK's
//   direct correction, see galleryRoomFinishes.ts), so Vault needed no
//   change here either way.
// - Loft's LineSegments-based "bay outline" (a thin EdgesGeometry rectangle)
//   is dropped in favor of the (kept) full-height divider boxes alone
//   reading as bay boundaries. MuseumBuilder.tsx's scene-teardown effect
//   only disposes `THREE.Mesh` geometry/material on unmount (its
//   `scene.traverse` cleanup checks `object instanceof THREE.Mesh`) -- a
//   LineSegments object would silently leak its geometry/material every
//   time a room is closed. Everything built below is real Mesh geometry, so
//   it's covered by that same existing cleanup with no changes needed there.
import * as THREE from "three";

import {
  DOOR_WIDTH,
  roomBounds,
  splitSegmentForDoor,
  type CampusRoom,
  type CampusWallSegment,
} from "./campusLayout";
import type { GalleryFinishStyle } from "../components/gallery/galleryRoomFinishes";

type WallAxis = "x" | "z";

type SolidWallPiece = { wallAxis: WallAxis; fixedCoord: number; faceSign: 1 | -1; from: number; to: number };

// Clears buildSharedWall()'s own CASING_TRIM_WIDTH/ENTRANCE_CASING_TRIM_WIDTH
// (0.1/0.22) so this file's own decorative geometry never overlaps a real
// doorway's real jamb/head casing trim near the door edge.
const DOOR_EDGE_MARGIN = 0.3;

/** Same interior-direction convention buildSharedWall() documents: for an
 * "x" segment (fixed Z), roomA's interior is toward -Z, roomB's toward +Z;
 * for a "z" segment (fixed X), roomA's interior is toward -X, roomB's toward
 * +X. A small offset in that direction keeps this file's decorative
 * geometry standing just off the wall's real face, into the room. */
function faceSignFor(segment: CampusWallSegment, roomId: CampusRoom["id"]): 1 | -1 {
  return segment.roomA === roomId ? -1 : 1;
}

/** This room's own solid (door-gap-excluded, casing-margin-trimmed) wall
 * pieces, tagged with the axis/fixed-coordinate/faceSign every rib/rivet/
 * panel placement below needs -- built from the exact same
 * CampusWallSegment + splitSegmentForDoor data buildSharedWall() already
 * uses to build the real walls. */
function solidWallPieces(room: CampusRoom, segments: CampusWallSegment[]): SolidWallPiece[] {
  const pieces: SolidWallPiece[] = [];
  for (const segment of segments) {
    if (segment.roomA !== room.id && segment.roomB !== room.id) continue;
    const faceSign = faceSignFor(segment, room.id);
    const { solid, door } = splitSegmentForDoor(segment);
    const doorHalf = door ? (door.width ?? DOOR_WIDTH) / 2 : 0;
    const gapFrom = door ? door.gapCenter - doorHalf : null;
    const gapTo = door ? door.gapCenter + doorHalf : null;
    for (const piece of solid) {
      let { from, to } = piece;
      if (gapFrom !== null && Math.abs(to - gapFrom) < 1e-6) to -= DOOR_EDGE_MARGIN;
      if (gapTo !== null && Math.abs(from - gapTo) < 1e-6) from += DOOR_EDGE_MARGIN;
      if (to - from < 0.5) continue; // too short to carry any panel/rib
      pieces.push({ wallAxis: segment.wall, fixedCoord: segment.fixed, faceSign, from, to });
    }
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Vault: large floor-to-ceiling panels with corner rivets (addVaultArmorRefined
// in galleryRoomFinishes.ts), plus a diagonal glowing ceiling lattice.
// ---------------------------------------------------------------------------

// Same target panel width as the frozen personal-room version's 4 equal
// panels across its own ~19.6-unit walls (9.8*2 span / 4 panels ≈ 4.9 each).
const VAULT_PANEL_WIDTH = 4.9;
const VAULT_RIVET_INSET = 0.4;

function addVaultPanels(
  scene: THREE.Scene,
  pieces: SolidWallPiece[],
  wallTop: number,
  wallBottom: number,
  dividerMaterial: THREE.Material,
  rivetMaterial: THREE.Material,
  wallThickness: number
): void {
  const midY = (wallTop + wallBottom) / 2;
  // Root cause of "the walls don't match" (EK, live): buildSharedWall()
  // centers each wall BOX on `segment.fixed` with the box extending
  // wallThickness/2 to each side — so the wall's actual visible face sits
  // at fixedCoord + faceSign*wallThickness/2, not at fixedCoord itself.
  // The personal Gallery room's own addVaultArmorRefined offsets (0.035/
  // 0.04) were tuned in that GLB's own local space, where 0 already IS the
  // wall face — reused unmodified here, they landed 0.11-0.115 units
  // *inside* this room's real 0.3-thick wall (WALL_THICKNESS/2 = 0.15),
  // fully embedded and invisible. Adding wallThickness/2 puts them back on
  // the real, visible face, same as the personal room's own geometry.
  const faceOffset = wallThickness / 2;
  for (const { wallAxis, fixedCoord, faceSign, from, to } of pieces) {
    const length = to - from;
    const panelCount = Math.max(1, Math.round(length / VAULT_PANEL_WIDTH));
    const panelWidth = length / panelCount;
    for (let i = 0; i < panelCount; i += 1) {
      const a = from + i * panelWidth;
      const b = a + panelWidth;
      for (const pos of [a + VAULT_RIVET_INSET, b - VAULT_RIVET_INSET]) {
        for (const y of [wallTop - VAULT_RIVET_INSET, wallBottom + VAULT_RIVET_INSET]) {
          const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), rivetMaterial);
          rivet.rotation.x = wallAxis === "x" ? Math.PI / 2 : 0;
          rivet.rotation.z = wallAxis === "x" ? 0 : Math.PI / 2;
          if (wallAxis === "x") rivet.position.set(pos, y, fixedCoord + faceSign * (faceOffset + 0.035));
          else rivet.position.set(fixedCoord + faceSign * (faceOffset + 0.035), y, pos);
          scene.add(rivet);
        }
      }
      if (i > 0) {
        const divider = new THREE.Mesh(
          wallAxis === "x"
            ? new THREE.BoxGeometry(0.07, wallTop - wallBottom, 0.06)
            : new THREE.BoxGeometry(0.06, wallTop - wallBottom, 0.07),
          dividerMaterial
        );
        if (wallAxis === "x") divider.position.set(a, midY, fixedCoord + faceSign * (faceOffset + 0.04));
        else divider.position.set(fixedCoord + faceSign * (faceOffset + 0.04), midY, a);
        scene.add(divider);
      }
    }
  }
}

function addVaultCeilingLattice(scene: THREE.Scene, room: CampusRoom, wallHeight: number): void {
  const bounds = roomBounds(room);
  // Same channel/edge/core offsets-below-the-true-ceiling-plane as the
  // frozen personal-room version (0.07/0.09/0.095 below its own 9.15
  // ceiling) -- expressed relative to this room's own real wallHeight
  // instead of that one fixed number.
  const channelY = wallHeight - 0.07;
  const edgeY = wallHeight - 0.09;
  const coreY = wallHeight - 0.095;
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x38d2f2, toneMapped: false });
  const edgeGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x38d2f2, transparent: true, opacity: 0.4, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const channelMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.85, metalness: 0.1 });

  function glowSegment(x1: number, z1: number, x2: number, z2: number) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = -Math.atan2(dz, dx);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const channel = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.26), channelMaterial);
    channel.position.set(midX, channelY, midZ);
    channel.rotation.y = angle;
    scene.add(channel);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.03, 0.2), edgeGlowMaterial);
    edge.position.set(midX, edgeY, midZ);
    edge.rotation.y = angle;
    scene.add(edge);
    const core = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, 0.06), coreMaterial);
    core.position.set(midX, coreY, midZ);
    core.rotation.y = angle;
    scene.add(core);
  }

  // 4 long diagonals, each touching a different pair of walls -- the same
  // "wall to wall diamond lattice" concept as the frozen personal-room
  // version, adapted to proportional fractions (t1/t2) of THIS room's own
  // real width/depth instead of that version's hand-placed absolute
  // coordinates, which were fitted point-by-point to one specific ~21x19
  // room and don't generalize to the museum's differently-shaped rooms.
  const t1 = 0.18;
  const t2 = 0.82;
  const bl = { x: bounds.x0 + t1 * room.w, z: bounds.z0 };
  const br = { x: bounds.x0 + t2 * room.w, z: bounds.z0 };
  const fl = { x: bounds.x0 + t1 * room.w, z: bounds.z1 };
  const fr = { x: bounds.x0 + t2 * room.w, z: bounds.z1 };
  const lb = { x: bounds.x0, z: bounds.z0 + t1 * room.d };
  const lf = { x: bounds.x0, z: bounds.z0 + t2 * room.d };
  const rb = { x: bounds.x1, z: bounds.z0 + t1 * room.d };
  const rf = { x: bounds.x1, z: bounds.z0 + t2 * room.d };

  glowSegment(bl.x, bl.z, rf.x, rf.z);
  glowSegment(br.x, br.z, lf.x, lf.z);
  glowSegment(lb.x, lb.z, fr.x, fr.z);
  glowSegment(rb.x, rb.z, fl.x, fl.z);

  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  const glow = new THREE.PointLight(0x38d2f2, 0.4, Math.max(room.w, room.d) * 0.5, 1.4);
  glow.position.set(center.x, wallHeight - 0.25, center.z);
  scene.add(glow);
}

/** Adapts createGalleryFinishes("vault").addVaultArmor()'s refined-panel
 * geometry (galleryRoomFinishes.ts's addVaultArmorRefined) for a real museum
 * room: same panel/rivet/divider recipe and colors, scaled to this room's
 * own real solid wall spans (door gaps excluded) instead of one fixed
 * personal-room size. */
export function addVaultArmorForRoom(
  scene: THREE.Scene, room: CampusRoom, segments: CampusWallSegment[], wallHeight: number, wallThickness: number
): void {
  const dividerMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.3, roughness: 0.55 });
  const rivetMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.72, roughness: 0.35 });
  const wallTop = wallHeight - 0.25;
  const wallBottom = 0.25;
  addVaultPanels(scene, solidWallPieces(room, segments), wallTop, wallBottom, dividerMaterial, rivetMaterial, wallThickness);
  addVaultCeilingLattice(scene, room, wallHeight);
}

// ---------------------------------------------------------------------------
// Loft: shallow ribs + a horizontal seam + broad dividers (frozen addLoftArmor),
// plus 4 ceiling "arrow" chevrons, one pointing at each wall.
// ---------------------------------------------------------------------------

// Same rough rib spacing as the frozen personal-room version's 4 ribs across
// its own ~19.6-unit back wall.
const LOFT_RIB_SPACING = 5;
const LOFT_RIB_DEPTH = 0.08;
// The frozen version's SEAM_Y (6.6) as a fraction of its own WALL_TOP/
// WALL_BOTTOM span ((6.6 - 0.25) / (8.9 - 0.25) ≈ 0.735) -- kept as a
// fraction of wall height instead of that one absolute number.
const LOFT_SEAM_FRACTION = 0.735;

function addLoftWalls(
  scene: THREE.Scene,
  pieces: SolidWallPiece[],
  wallTop: number,
  wallBottom: number,
  ribMaterial: THREE.Material,
  dividerMaterial: THREE.Material,
  seamMaterial: THREE.Material,
  rivetMaterial: THREE.Material,
  wallThickness: number
): void {
  const midY = (wallTop + wallBottom) / 2;
  const seamY = wallBottom + LOFT_SEAM_FRACTION * (wallTop - wallBottom);
  // Same real-wall-face correction as addVaultPanels above — see its own
  // comment for the root cause (buildSharedWall() centers each wall box on
  // segment.fixed, so the real face is wallThickness/2 further out than
  // the personal room's own GLB-local-space offsets assumed).
  const faceOffset = wallThickness / 2;
  for (const { wallAxis, fixedCoord, faceSign, from, to } of pieces) {
    const length = to - from;

    // Ribs at a regular spacing, one rivet per rib where it crosses the
    // horizontal seam -- same "one believable fastener per junction" recipe
    // as the frozen version.
    const ribCount = Math.max(1, Math.round(length / LOFT_RIB_SPACING));
    for (let i = 0; i < ribCount; i += 1) {
      const pos = from + (i + 0.5) * (length / ribCount);
      const rib = new THREE.Mesh(
        wallAxis === "x"
          ? new THREE.BoxGeometry(0.16, wallTop - wallBottom, LOFT_RIB_DEPTH)
          : new THREE.BoxGeometry(LOFT_RIB_DEPTH, wallTop - wallBottom, 0.16),
        ribMaterial
      );
      if (wallAxis === "x") rib.position.set(pos, midY, fixedCoord + faceSign * (faceOffset + LOFT_RIB_DEPTH * 0.5));
      else rib.position.set(fixedCoord + faceSign * (faceOffset + LOFT_RIB_DEPTH * 0.5), midY, pos);
      scene.add(rib);

      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), rivetMaterial);
      rivet.rotation.x = wallAxis === "x" ? Math.PI / 2 : 0;
      rivet.rotation.z = wallAxis === "x" ? 0 : Math.PI / 2;
      if (wallAxis === "x") rivet.position.set(pos, seamY, fixedCoord + faceSign * (faceOffset + LOFT_RIB_DEPTH + 0.035));
      else rivet.position.set(fixedCoord + faceSign * (faceOffset + LOFT_RIB_DEPTH + 0.035), seamY, pos);
      scene.add(rivet);
    }

    // One recessed horizontal seam spanning this whole solid piece.
    const mid = (from + to) / 2;
    const seam = new THREE.Mesh(
      wallAxis === "x" ? new THREE.BoxGeometry(length, 0.05, 0.03) : new THREE.BoxGeometry(0.03, 0.05, length),
      seamMaterial
    );
    if (wallAxis === "x") seam.position.set(mid, seamY, fixedCoord + faceSign * (faceOffset + 0.02));
    else seam.position.set(fixedCoord + faceSign * (faceOffset + 0.02), seamY, mid);
    scene.add(seam);

    // A broad divider splitting this piece into 2-3 wide sections -- same
    // "organize the wall into a few broad bays" concept as the frozen
    // version, scaled to this piece's own real length (1 divider under ~12
    // units, 2 above) instead of a fixed 2-3-bay count regardless of size.
    const bayCount = Math.max(1, Math.min(3, Math.round(length / 8)));
    for (let i = 1; i < bayCount; i += 1) {
      const pos = from + (length * i) / bayCount;
      const divider = new THREE.Mesh(
        wallAxis === "x"
          ? new THREE.BoxGeometry(0.32, wallTop - wallBottom, LOFT_RIB_DEPTH + 0.04)
          : new THREE.BoxGeometry(LOFT_RIB_DEPTH + 0.04, wallTop - wallBottom, 0.32),
        dividerMaterial
      );
      if (wallAxis === "x") divider.position.set(pos, midY, fixedCoord + faceSign * (faceOffset + (LOFT_RIB_DEPTH + 0.04) * 0.5));
      else divider.position.set(fixedCoord + faceSign * (faceOffset + (LOFT_RIB_DEPTH + 0.04) * 0.5), midY, pos);
      scene.add(divider);
    }
  }
}

function addLoftCeilingArrows(scene: THREE.Scene, room: CampusRoom, wallHeight: number): void {
  const bounds = roomBounds(room);
  const center = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
  // Same channel/line offsets-below-the-true-ceiling-plane as the frozen
  // personal-room version (0.37/0.41 below its own 9.15 ceiling), expressed
  // relative to this room's own real wallHeight.
  const channelY = wallHeight - 0.37;
  const glowY = wallHeight - 0.41;
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xcfe1e8, toneMapped: false });
  const channelMaterial = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.8, metalness: 0.1 });

  function glowSegment(x1: number, z1: number, x2: number, z2: number) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = -Math.atan2(dz, dx);
    const channel = new THREE.Mesh(new THREE.BoxGeometry(length + 0.3, 0.1, 0.32), channelMaterial);
    channel.position.set((x1 + x2) / 2, channelY, (z1 + z2) / 2);
    channel.rotation.y = angle;
    scene.add(channel);
    const line = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.1), glowMaterial);
    line.position.set((x1 + x2) / 2, glowY, (z1 + z2) / 2);
    line.rotation.y = angle;
    scene.add(line);
  }

  function addArrow(vertex: [number, number], arm1: [number, number], arm2: [number, number]) {
    glowSegment(vertex[0], vertex[1], arm1[0], arm1[1]);
    glowSegment(vertex[0], vertex[1], arm2[0], arm2[1]);
    const light = new THREE.PointLight(0xcfe1e8, 0.22, Math.max(room.w, room.d) * 0.4, 1.4);
    light.position.set(vertex[0], wallHeight - 0.5, vertex[1]);
    scene.add(light);
  }

  // Same "one arrow per wall, vertex pointing at that wall, arms opening
  // toward the room's center" concept as the frozen version -- vertex/arm
  // positions expressed as fractions of this room's own real width/depth
  // instead of one hardcoded room's absolute coordinates.
  const nearD = 0.08 * room.d;
  const farD = 0.32 * room.d;
  const nearW = 0.08 * room.w;
  const farW = 0.32 * room.w;
  const armSpreadW = 0.19 * room.w;
  const armSpreadD = 0.19 * room.d;

  addArrow(
    [center.x, bounds.z0 + nearD],
    [center.x - armSpreadW, bounds.z0 + farD], [center.x + armSpreadW, bounds.z0 + farD]
  ); // points at the back wall
  addArrow(
    [center.x, bounds.z1 - nearD],
    [center.x - armSpreadW, bounds.z1 - farD], [center.x + armSpreadW, bounds.z1 - farD]
  ); // points at the front wall
  addArrow(
    [bounds.x0 + nearW, center.z],
    [bounds.x0 + farW, center.z - armSpreadD], [bounds.x0 + farW, center.z + armSpreadD]
  ); // points at the left wall
  addArrow(
    [bounds.x1 - nearW, center.z],
    [bounds.x1 - farW, center.z - armSpreadD], [bounds.x1 - farW, center.z + armSpreadD]
  ); // points at the right wall
}

/** Adapts createGalleryFinishes("loft").addVaultArmor()'s frozen rib/rivet/
 * seam/divider geometry (galleryRoomFinishes.ts's addLoftArmor) for a real
 * museum room: same recipe and colors, scaled to this room's own real solid
 * wall spans (door gaps excluded) instead of one fixed personal-room size. */
export function addLoftArmorForRoom(
  scene: THREE.Scene, room: CampusRoom, segments: CampusWallSegment[], wallHeight: number, wallThickness: number
): void {
  const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x24272a, metalness: 0.32, roughness: 0.52 });
  const dividerMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.3, roughness: 0.55 });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x121314, metalness: 0.2, roughness: 0.65 });
  const rivetMaterial = new THREE.MeshStandardMaterial({ color: 0x767c81, metalness: 0.68, roughness: 0.4 });
  const wallTop = wallHeight - 0.25;
  const wallBottom = 0.25;
  addLoftWalls(scene, solidWallPieces(room, segments), wallTop, wallBottom, ribMaterial, dividerMaterial, seamMaterial, rivetMaterial, wallThickness);
  addLoftCeilingArrows(scene, room, wallHeight);
}

/** Style-conditional dispatcher matching createGalleryFinishes()'s own
 * addVaultArmor() (called only for `roomStyle === "vault" || roomStyle ===
 * "loft"` in VirtualGalleryRoom.tsx -- White/Arcade don't use this armor
 * system in the personal Gallery either). No-ops for any other style. */
export function addStyledRoomArmor(
  scene: THREE.Scene,
  room: CampusRoom,
  segments: CampusWallSegment[],
  wallHeight: number,
  style: GalleryFinishStyle | null | undefined,
  wallThickness: number
): void {
  if (style === "vault") addVaultArmorForRoom(scene, room, segments, wallHeight, wallThickness);
  else if (style === "loft") addLoftArmorForRoom(scene, room, segments, wallHeight, wallThickness);
}
