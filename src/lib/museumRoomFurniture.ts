// Museum Builder pass (2026-09-12): shelf-board and display-case furniture,
// ported from VirtualGalleryRoom.tsx's own inline shelf/cabinet mesh code
// (the personal Gallery's real shelf boards + glass display cases) — the
// same box dimensions and materials recipe, generalized to take an arbitrary
// world-space span/position instead of the personal room's fixed wall
// coordinates (back z=-12, sides x=±10.5). Reused, not rebuilt: only the
// position math is new here — the actual furniture look (board thickness,
// cabinet/glass dimensions, the soft contact-shadow plane) is copied over
// unchanged. Used only by the new Museum Builder page
// (src/components/gallery/MuseumBuilder.tsx) — VirtualGalleryRoom.tsx and
// MuseumRoomPopup.tsx are both untouched and neither imports this file.
import * as THREE from "three";

import type { PlacementSlot, WallSpan } from "./campusRoomBuilder";

// Same board thickness/depth as VirtualGalleryRoom.tsx's own
// addBackRowBoard/addSideRowBoard (BoxGeometry(width, 0.1, 0.845)), embedded
// slightly into the wall so there's no visible air gap behind it.
const SHELF_BOARD_THICKNESS = 0.1;
const SHELF_BOARD_DEPTH = 0.845;
// Wall-face-to-board-center distance — matches
// campusRoomBuilder.ts's computeRoomShelfSlots() own SHELF_WALL_OUTSET, so
// an item placed at a shelf slot always sits centered on top of this board.
const SHELF_BOARD_OUTSET = 0.46;

/** Same warm trim tone VirtualGalleryRoom.tsx's own shelf `trimMaterial`
 * uses — a plain wood-ish trim, independent of the room's own RoomFinish so
 * a shelf reads consistently regardless of which finish the room is in. */
export function createShelfMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.55, metalness: 0.08 });
}

/** One shelf board spanning a room's own usable wall span (see
 * campusRoomBuilder.ts's computeRoomShelfSpans) at the same resting height
 * computeRoomShelfSlots() places items at. */
export function buildShelfBoard(
  scene: THREE.Scene,
  span: WallSpan,
  shelfY: number,
  wallThickness: number,
  material: THREE.Material
): void {
  const spanLength = span.to - span.from;
  if (spanLength <= 0.2) return;
  const isNS = span.wall === "north" || span.wall === "south";
  const geometry = isNS
    ? new THREE.BoxGeometry(spanLength - 0.2, SHELF_BOARD_THICKNESS, SHELF_BOARD_DEPTH)
    : new THREE.BoxGeometry(SHELF_BOARD_DEPTH, SHELF_BOARD_THICKNESS, spanLength - 0.2);
  const board = new THREE.Mesh(geometry, material);
  const wallInset = wallThickness / 2 + SHELF_BOARD_OUTSET;
  const mid = (span.from + span.to) / 2;
  if (isNS) board.position.set(mid, shelfY, span.fixed + (span.wall === "north" ? 1 : -1) * wallInset);
  else board.position.set(span.fixed + (span.wall === "west" ? 1 : -1) * wallInset, shelfY, mid);
  scene.add(board);
}

// Same cabinet/glass dimensions and materials as VirtualGalleryRoom.tsx's own
// CABINET_SPOTS display cases (base BoxGeometry(1.42, 0.72, 1.12), glass
// BoxGeometry(1.3, 1.15, 1)) plus its soft radial-gradient contact-shadow
// plane — ported verbatim, just placed at an arbitrary (x, z) instead of a
// fixed CABINET_SPOTS table entry.
let cachedShadowTexture: THREE.CanvasTexture | null = null;
function caseShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTexture) return cachedShadowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(20,18,14,0.42)");
  gradient.addColorStop(0.7, "rgba(20,18,14,0.22)");
  gradient.addColorStop(1, "rgba(20,18,14,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedShadowTexture = texture;
  return texture;
}

export function buildDisplayCase(scene: THREE.Scene, x: number, z: number): void {
  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3037, roughness: 0.38, metalness: 0.18 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xbceeff, transparent: true, opacity: 0.18, roughness: 0.08, metalness: 0.08,
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: caseShadowTexture(), transparent: true, depthWrite: false, toneMapped: false });

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.7), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, 0.006, z);
  scene.add(shadow);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.72, 1.12), cabinetMaterial);
  base.position.set(x, 0.31, z);
  scene.add(base);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1), glassMaterial);
  glass.position.set(x, 1.25, z);
  scene.add(glass);
}

/** Places curated items flat inside their display cases — the same "lying
 * flat in a display case, face up" treatment VirtualGalleryRoom.tsx gives
 * its own flat-case items (rotated face-up, double-sided material, no wall
 * frame). Kept separate from campusRoomBuilder.ts's placeItemsAtSlots (the
 * protected live-museum read path, which only ever hangs framed wall art) —
 * case items are a visually different furniture kind, so they get their own
 * small placement function instead of adding a branch to that protected
 * one. */
export function placeItemsInCases(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  slots: PlacementSlot[],
  itemsBySlot: Map<string, { url: string; label?: string }>,
  isCancelled: () => boolean
): void {
  for (const slot of slots) {
    const item = itemsBySlot.get(slot.id);
    if (!item) continue;
    textureLoader.load(item.url, (texture) => {
      if (isCancelled()) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      const naturalW = texture.image?.width || 1;
      const naturalH = texture.image?.height || 1;
      const scale = Math.min(slot.maxWidth / naturalW, slot.maxHeight / naturalH);
      const material = new THREE.MeshStandardMaterial({
        map: texture, roughness: 0.44, metalness: 0.08, side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(naturalW * scale, naturalH * scale), material);
      plane.position.set(slot.x, slot.y, slot.z);
      plane.rotation.x = -Math.PI / 2;
      scene.add(plane);
    });
  }
}
