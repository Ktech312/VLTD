"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  DoorOpen,
  ExternalLink,
  Eye,
  GalleryHorizontalEnd,
  Grid3X3,
  Landmark,
  Layers3,
  Map as MapIcon,
  MonitorUp,
  PackagePlus,
  Paintbrush,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
} from "lucide-react";
import * as THREE from "three";

import {
  getGallerySections,
  loadGalleries,
  type Gallery,
} from "@/lib/galleryModel";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";

type RoomStyle = "vault" | "whitebox" | "arcade";
type RoomLayout = "storefront" | "salon" | "spotlight";
type ViewMode = "room" | "overview";
type RoomDraft = {
  galleryId: string;
  selectedIds: string[];
  roomStyle: RoomStyle;
  roomLayout: RoomLayout;
  viewMode?: ViewMode;
  showValues: boolean;
  wallTextureUrl?: string;
};
type RoomItemPosition = {
  x: number;
  y: number;
  z: number;
  ry: number;
  scale: number;
  wall: "back" | "left" | "right" | "center" | "cabinet";
  /** Lying flat in a display case (rotated onto the horizontal plane) instead of wall-mounted upright. */
  flat?: boolean;
};
type MuseumUniverseRoom = {
  id: string;
  title: string;
  items: VaultItem[];
  value: number;
  tier: "Starter" | "Gallery" | "Hall";
  wing: "North" | "South" | "Main" | "Garden";
};

const DRAFT_KEY = "vltd_virtual_gallery_room_draft_v1";
const WALLPAPER_KEY = "vltd_virtual_gallery_wallpaper_v1";
const MAX_ROOM_ITEMS = 32;

// The 5 center display cases (built further down as decorative glass cabinets)
// are also real, numbered, assignable slots — appended after the 32 wall slots.
const CABINET_SPOTS: Array<[number, number]> = [
  [-3.4, -3.5],
  [0, -4.55],
  [3.4, -3.5],
  [-2.1, 0.45],
  [2.1, 0.45],
];
const CABINET_SLOT_COUNT = CABINET_SPOTS.length;
const TOTAL_SLOT_COUNT = MAX_ROOM_ITEMS + CABINET_SLOT_COUNT;

// `selectedIds` is always exactly TOTAL_SLOT_COUNT long, one entry per physical
// slot (wall shelf or display case) — "" means that slot is empty. This is what
// makes an item's position independently assignable (drag it onto any slot,
// occupied or not) instead of just reorderable relative to its neighbors.
function makeEmptySlots(): string[] {
  return Array.from({ length: TOTAL_SLOT_COUNT }, () => "");
}

function fillSlots(ids: string[]): string[] {
  const slots = makeEmptySlots();
  ids.slice(0, TOTAL_SLOT_COUNT).forEach((id, index) => {
    slots[index] = id;
  });
  return slots;
}

const DEMO_ITEMS: VaultItem[] = [
  {
    id: "demo-comic",
    title: "Signed Variant Comic",
    subtitle: "Foil cover, limited run",
    universe: "Comics",
    category: "Comic Books",
    currentValue: 420,
    imageFrontUrl: "/collectibles/comic-slab.png",
  },
  {
    id: "demo-card",
    title: "Rookie Parallel",
    subtitle: "Graded 10",
    universe: "Sports",
    category: "Trading Cards",
    currentValue: 1850,
    imageFrontUrl: "/collectibles/sports-slab.png",
  },
  {
    id: "demo-record",
    title: "First Press Vinyl",
    subtitle: "Near mint sleeve",
    universe: "Music",
    category: "Vinyl",
    currentValue: 260,
    imageFrontUrl: "/collectibles/vinyl-record.png",
  },
  {
    id: "demo-figure",
    title: "Designer Figure",
    subtitle: "Artist proof",
    universe: "Pop Culture",
    category: "Figures",
    currentValue: 700,
    imageFrontUrl: "/collectibles/vinyl-figure.png",
  },
  {
    id: "demo-poster",
    title: "Theater One Sheet",
    subtitle: "Linen backed",
    universe: "Film",
    category: "Poster",
    currentValue: 540,
    imageFrontUrl: "/collectibles/movie-poster.png",
  },
  {
    id: "demo-guitar",
    title: "Tour Guitar",
    subtitle: "Stage-played",
    universe: "Music",
    category: "Instruments",
    currentValue: 3200,
    imageFrontUrl: "/collectibles/guitar.png",
  },
];

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function itemSubtitle(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" - ");
}

function itemImage(item: VaultItem) {
  return getPrimaryImageUrl(item) || item.imageFrontUrl || item.imageBackUrl || "";
}

function safeDraft(value: unknown): Partial<RoomDraft> {
  if (!value || typeof value !== "object") return {};
  return value as Partial<RoomDraft>;
}

function itemUniverse(item: VaultItem) {
  return String(item.universe || item.category || "Collection").trim() || "Collection";
}

function buildUniverseRooms(items: VaultItem[]): MuseumUniverseRoom[] {
  const groups = new Map<string, VaultItem[]>();
  items.forEach((item) => {
    const key = itemUniverse(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries())
    .map(([title, roomItems]) => {
      const value = roomItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
      return {
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "collection",
        title,
        items: roomItems,
        value,
        tier: roomItems.length >= 18 ? "Hall" : roomItems.length >= 8 ? "Gallery" : "Starter",
        wing: title.length % 4 === 0 ? "North" : title.length % 4 === 1 ? "South" : title.length % 4 === 2 ? "Main" : "Garden",
      } satisfies MuseumUniverseRoom;
    })
    .sort((a, b) => b.items.length - a.items.length || b.value - a.value || a.title.localeCompare(b.title));
}

function drawItemTexture(
  item: VaultItem,
  showValues: boolean,
  image?: HTMLImageElement | null
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 704;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grd = ctx.createLinearGradient(0, 0, 512, 704);
  grd.addColorStop(0, "#272b32");
  grd.addColorStop(0.52, "#0f1319");
  grd.addColorStop(1, "#080a0d");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 512, 704);

  ctx.strokeStyle = "rgba(237,239,241,0.72)";
  ctx.lineWidth = 7;
  ctx.strokeRect(18, 18, 476, 668);
  ctx.strokeStyle = "rgba(79,211,238,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, 444, 636);

  if (image?.complete && image.naturalWidth > 0) {
    const imageBox = { x: 56, y: 58, w: 400, h: 440 };
    const scale = Math.min(imageBox.w / image.naturalWidth, imageBox.h / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(
      image,
      imageBox.x + (imageBox.w - w) / 2,
      imageBox.y + (imageBox.h - h) / 2,
      w,
      h
    );
  } else {
    ctx.fillStyle = "rgba(79,211,238,0.12)";
    ctx.fillRect(56, 58, 400, 440);
    ctx.fillStyle = "rgba(237,239,241,0.75)";
    ctx.font = "700 46px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VLTD", 256, 290);
  }

  const title = item.title.length > 34 ? `${item.title.slice(0, 31)}...` : item.title;
  const subtitle = itemSubtitle(item) || String(item.category || item.universe || "Collection piece");
  const value = formatMoney(item.currentValue);

  ctx.fillStyle = "rgba(2,5,9,0.92)";
  ctx.fillRect(36, 520, 440, 134);
  ctx.fillStyle = "#ECEDEF";
  ctx.font = "800 30px Arial";
  ctx.textAlign = "left";
  ctx.fillText(title, 58, 568);
  ctx.fillStyle = "rgba(236,237,239,0.62)";
  ctx.font = "500 20px Arial";
  ctx.fillText(subtitle.slice(0, 42), 58, 606);
  if (showValues && value) {
    ctx.fillStyle = "#4FD3EE";
    ctx.font = "800 24px Arial";
    ctx.fillText(value, 58, 640);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawDoorSignTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "rgba(9,11,15,0.94)";
  ctx.fillRect(0, 0, 640, 160);
  ctx.strokeStyle = "rgba(79,211,238,0.6)";
  ctx.lineWidth = 5;
  ctx.strokeRect(7, 7, 626, 146);

  ctx.fillStyle = "#ECEDEF";
  ctx.font = "800 54px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = (label.length > 20 ? `${label.slice(0, 18)}...` : label).toUpperCase();
  ctx.fillText(text, 320, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawSlotBadgeTexture(n: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "rgba(10,14,18,0.88)";
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(79,211,238,0.95)";
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = "#ECEDEF";
  ctx.font = "800 52px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 64, 68);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A seeded PRNG (not Math.random) so the plank layout is stable across
// re-renders instead of reshuffling on every effect re-run.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createHardwoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const rand = mulberry32(20260815);
  const plankHeight = 64;
  // A deep walnut palette (was a flatter, more saturated rust-orange that
  // read as plastic under render) — every plank below picks its own base
  // tone from this set rather than every row sharing one identical
  // gradient, which is what made the old floor look like a single tiled
  // sprite instead of individual boards.
  const tones = ["#4a3120", "#573823", "#3f2a1b", "#5c3d26", "#48301f", "#63432b"];

  ctx.fillStyle = "#3f2a1b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += plankHeight) {
    let x = -Math.floor(rand() * 140);
    while (x < canvas.width) {
      const plankLength = 130 + rand() * 130;
      const base = tones[Math.floor(rand() * tones.length)];
      const grd = ctx.createLinearGradient(0, y, 0, y + plankHeight);
      grd.addColorStop(0, shadeHex(base, 0.16));
      grd.addColorStop(0.5, base);
      grd.addColorStop(1, shadeHex(base, -0.12));
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, plankLength, plankHeight);

      // End-seam and long-edge lines around this specific board.
      ctx.strokeStyle = "rgba(18,9,4,0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y + 0.75, plankLength, plankHeight - 1.5);

      // A little brightness jitter per board so neighbors read as distinct
      // pieces of wood, not one repeating swatch.
      ctx.fillStyle = `rgba(255,235,205,${rand() * 0.05})`;
      ctx.fillRect(x, y, plankLength, plankHeight);

      x += plankLength;
    }
  }

  for (let i = 0; i < 220; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const length = 20 + rand() * 70;
    ctx.strokeStyle = `rgba(255,220,165,${0.04 + rand() * 0.07})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * 0.32, y - 6, x + length * 0.68, y + 6, x + length, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4.4);
  texture.anisotropy = 8;
  return texture;
}

// Lightens (positive amt) or darkens (negative amt) a hex color by a
// fraction of the distance to white/black — used to build each plank's own
// gradient from its randomly-picked base tone instead of one shared gradient.
function shadeHex(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (channel: number) => {
    const target = amt >= 0 ? 255 : 0;
    return Math.round(channel + (target - channel) * Math.abs(amt));
  };
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function createHerringboneTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#6d4c2e";
  ctx.fillRect(0, 0, size, size);

  const cell = 48;
  const tones = ["#8a6238", "#93692f", "#7d5730", "#96703c", "#875f34"];
  let toneIndex = 0;

  for (let row = 0; row * cell < size; row += 1) {
    for (let col = 0; col * cell < size; col += 1) {
      const x = col * cell;
      const y = row * cell;
      const flip = (row + col) % 2 === 0;
      toneIndex = (toneIndex + 1) % tones.length;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cell, cell);
      ctx.clip();
      ctx.translate(x + cell / 2, y + cell / 2);
      ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillStyle = tones[toneIndex];
      ctx.fillRect(-cell * 0.9, -cell * 0.24, cell * 1.8, cell * 0.48);
      ctx.strokeStyle = "rgba(24,12,6,0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-cell * 0.9, -cell * 0.24, cell * 1.8, cell * 0.48);
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 5);
  texture.anisotropy = 8;
  return texture;
}

function createImageTexture(url: string, repeatX = 1, repeatY = 1) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

function fileToRoomWallpaper(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not prepare wallpaper image."));
        return;
      }

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load wallpaper image."));
    };

    image.src = objectUrl;
  });
}

function getRoomPalette(style: RoomStyle) {
  if (style === "whitebox") {
    // "White" — a bright classical gallery: warm cream walls with painted
    // molding, honey wood floor, big airy daylight feel.
    return {
      wall: 0xf1ede2,
      floor: 0xb98a55,
      trim: 0xe9e3d2,
      glow: 0xfff1d6,
      textTone: "text-slate-950",
      shell: "bg-[linear-gradient(180deg,#f7f4ec,#e4ddc9)] text-slate-950",
    };
  }

  if (style === "arcade") {
    return {
      wall: 0x161024,
      floor: 0x080914,
      trim: 0xf0a23a,
      glow: 0x4fd3ee,
      textTone: "text-white",
      shell: "bg-[radial-gradient(circle_at_50%_0%,rgba(240,162,58,0.16),transparent_32%),linear-gradient(180deg,#171122,#070913)] text-white",
    };
  }

  // Default ("Vault") — a real bank-vault feel: navy walls you can actually
  // read as navy (the old 0x16273f rendered as near-black under normal
  // lighting — a color that's technically blue but reads as black isn't
  // "moody," it's just invisible), a heavy riveted steel door with a brass
  // surround at the entrance, dark walnut plank floor.
  return {
    wall: 0x24405f,
    floor: 0x8a6238,
    trim: 0xa8b0b8,
    glow: 0xdfe8f0,
    textTone: "text-white",
    shell: "bg-[radial-gradient(circle_at_50%_0%,rgba(159,184,214,0.14),transparent_34%),linear-gradient(180deg,#24405f,#0a1220)] text-white",
  };
}

// Back wall gets 2 of every 4 items, left/right get 1 each — the back wall stays the
// visual anchor, but both side walls start filling from item #1 instead of only once
// the back wall's 32-slot grid is already full (which left a small collection's side
// walls bare while the back wall did all the work).
const WALL_CYCLE: Array<"back" | "left" | "right"> = ["back", "left", "back", "right"];

// The physical shelf boards (built further down, same 4 heights) and every item's
// vertical position both read from this one table — they used to be two separately
// hand-tuned numbers (4.72 for the boards, 5.42/4.75 for items) that drifted out of
// sync, so items floated well above their shelf instead of resting on it.
const SHELF_ROW_Y = [4.72, 3.47, 2.22, 0.97];

function shelfItemY(row: number, scale: number) {
  const shelfY = SHELF_ROW_Y[row] ?? SHELF_ROW_Y[SHELF_ROW_Y.length - 1];
  const shelfHalfThickness = 0.05;
  const cardHalfHeight = (1.54 * scale) / 2;
  return shelfY + shelfHalfThickness + cardHalfHeight;
}

function wallGridPosition(
  wall: "back" | "left" | "right",
  slot: number,
  config: { backZ: number; backScale: number; sideBaseZ: number; sideZStep: number; sideScale: number }
): RoomItemPosition {
  if (wall === "back") {
    const col = slot % 8;
    const row = Math.floor(slot / 8);
    return {
      x: -7.35 + col * 2.1,
      y: shelfItemY(row, config.backScale),
      z: config.backZ,
      ry: 0,
      scale: config.backScale,
      wall: "back",
    };
  }

  const row = slot % 4;
  const depth = Math.floor(slot / 4);
  return {
    x: wall === "left" ? -10.22 : 10.22,
    y: shelfItemY(row, config.sideScale),
    z: config.sideBaseZ + depth * config.sideZStep,
    ry: wall === "left" ? Math.PI / 2 : -Math.PI / 2,
    scale: config.sideScale,
    wall,
  };
}

function distributeAcrossWalls(
  count: number,
  config: { backZ: number; backScale: number; sideBaseZ: number; sideZStep: number; sideScale: number }
): RoomItemPosition[] {
  const wallSlot: Record<"back" | "left" | "right", number> = { back: 0, left: 0, right: 0 };
  return Array.from({ length: count }, (_, index) => {
    const wall = WALL_CYCLE[index % WALL_CYCLE.length];
    const slot = wallSlot[wall]++;
    return wallGridPosition(wall, slot, config);
  });
}

function buildWallPositions(layout: RoomLayout, count: number): RoomItemPosition[] {
  if (layout === "spotlight") {
    return Array.from({ length: count }, (_, index) => {
      if (index === 0) {
        return {
          x: 0,
          y: 3.25,
          z: -9.7,
          ry: 0,
          scale: 1.44,
          wall: "center",
        };
      }

      const sideIndex = index - 1;
      const wall = sideIndex % 2 === 0 ? "left" : "right";
      const slot = Math.floor(sideIndex / 2);
      return {
        x: wall === "left" ? -10.22 : 10.22,
        y: shelfItemY(slot % 4, 0.74),
        z: -8.8 + Math.floor(slot / 4) * 2.2,
        ry: wall === "left" ? Math.PI / 2 : -Math.PI / 2,
        scale: 0.74,
        wall,
      };
    });
  }

  if (layout === "salon") {
    return distributeAcrossWalls(count, {
      backZ: -11.82,
      backScale: 0.58,
      sideBaseZ: -9.4,
      sideZStep: 2.35,
      sideScale: 0.68,
    });
  }

  return distributeAcrossWalls(count, {
    backZ: -11.78,
    backScale: 0.58,
    sideBaseZ: -9.25,
    sideZStep: 2.35,
    sideScale: 0.66,
  });
}

// Full fixed-capacity slot table for a layout: MAX_ROOM_ITEMS wall slots plus
// the CABINET_SLOT_COUNT display-case slots, always in this order — slot index
// is a stable identity regardless of layout or how many items are placed.
function buildPositions(layout: RoomLayout): RoomItemPosition[] {
  const wallPositions = buildWallPositions(layout, MAX_ROOM_ITEMS);
  const cabinetPositions: RoomItemPosition[] = CABINET_SPOTS.map(([x, z]) => ({
    x,
    y: 1.98,
    z,
    ry: -Math.PI / 2,
    scale: 0.5,
    wall: "cabinet",
    flat: true,
  }));
  return [...wallPositions, ...cabinetPositions];
}

export default function VirtualGalleryRoom() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const roomGroupRef = useRef<THREE.Group | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const doorwayMeshesRef = useRef<THREE.Mesh[]>([]);
  // Rearranging items (or flipping Values/Style/Wallpaper) rebuilds the whole
  // Three.js scene — without this, that rebuild silently reset the camera to the
  // default spawn every time, which is why one drag in Arrange used to throw you
  // back to the entrance. Persists across rebuilds; only entering a genuinely
  // different room (openUniverseRoom/openMainHall) clears it back to a fresh spawn.
  const cameraStateRef = useRef<{ x: number; y: number; z: number; yaw: number; pitch: number } | null>(null);
  const [items, setItems] = useState<VaultItem[]>(DEMO_ITEMS);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [galleryId, setGalleryId] = useState("scratch");
  // Feedback for the Source dropdown — switching exhibitions used to fail
  // silently (nothing visibly changed) whenever an exhibition's saved item
  // ids didn't match anything in the loaded vault, which read as "this
  // control doesn't do anything." Now every switch reports what happened.
  const [sourceStatus, setSourceStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => fillSlots(DEMO_ITEMS.map((item) => item.id)));
  const [roomStyle, setRoomStyle] = useState<RoomStyle>("vault");
  const [roomLayout, setRoomLayout] = useState<RoomLayout>("storefront");
  const [viewMode, setViewMode] = useState<ViewMode>("room");
  const [showValues, setShowValues] = useState(true);
  const [wallTextureUrl, setWallTextureUrl] = useState("");
  const [wallpaperError, setWallpaperError] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>(DEMO_ITEMS[0]?.id ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(true);
  const [hallNoticeDismissed, setHallNoticeDismissed] = useState(false);
  const [roomSwitcherOpen, setRoomSwitcherOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchFromRef = useRef<number | null>(null);
  const touchOverRef = useRef<number | null>(null);
  const touchCloneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const vaultItems = loadItems();
    const galleryList = loadGalleries();

    setGalleries(galleryList);
    if (vaultItems.length > 0) {
      setItems(vaultItems);
      setSelectedIds(fillSlots(vaultItems.slice(0, 12).map((item) => item.id)));
      setSelectedItemId(vaultItems[0]?.id ?? "");
    }

    try {
      const draft = safeDraft(JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}"));
      if (draft.galleryId) setGalleryId(draft.galleryId);
      if (Array.isArray(draft.selectedIds) && draft.selectedIds.length > 0) {
        const ids = draft.selectedIds.filter((id): id is string => typeof id === "string");
        setSelectedIds(fillSlots(ids));
        setSelectedItemId(String(ids.find(Boolean) ?? ""));
      }
      if (draft.roomStyle === "vault" || draft.roomStyle === "whitebox" || draft.roomStyle === "arcade") {
        setRoomStyle(draft.roomStyle);
      }
      if (draft.roomLayout === "storefront" || draft.roomLayout === "salon" || draft.roomLayout === "spotlight") {
        setRoomLayout(draft.roomLayout);
      }
      if (draft.viewMode === "room" || draft.viewMode === "overview") setViewMode(draft.viewMode);
      if (typeof draft.showValues === "boolean") setShowValues(draft.showValues);
      // Wallpaper is saved under its own key (see saveDraft) since it's the one
      // field big enough to blow past localStorage's quota — read that first,
      // falling back to an old-format draft that had it embedded inline.
      const savedWallpaper = window.localStorage.getItem(WALLPAPER_KEY);
      if (savedWallpaper) {
        setWallTextureUrl(savedWallpaper);
      } else if (typeof draft.wallTextureUrl === "string" && draft.wallTextureUrl) {
        setWallTextureUrl(draft.wallTextureUrl);
      }
    } catch {
      // Ignore malformed local drafts.
    }
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds.filter(Boolean)), [selectedIds]);
  const slotItems = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return selectedIds.map((id) => (id ? (byId.get(id) ?? null) : null));
  }, [items, selectedIds]);
  const selectedItems = useMemo(
    () => slotItems.filter((item): item is VaultItem => Boolean(item)),
    [slotItems]
  );
  const selectedItem = useMemo(
    () => selectedItems.find((item) => item.id === selectedItemId) ?? selectedItems[0],
    [selectedItemId, selectedItems]
  );
  const selectedValue = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0),
    [selectedItems]
  );
  const universeRooms = useMemo(() => buildUniverseRooms(items), [items]);
  // A fixed-shape key for the 3D effect's dependency array — `universeRooms`
  // itself is a variable-length array (it grows/shrinks as vault items load),
  // which the React Compiler's effect diffing can't safely track as a single
  // dependency slot. A string always has stable arity.
  const universeRoomsKey = useMemo(
    () => universeRooms.map((room) => `${room.id}:${room.items.length}`).join("|"),
    [universeRooms]
  );
  // The full MAX_ROOM_ITEMS-slot position table for the current layout — always
  // computed at full capacity (not `selectedItems.length`) so slot index i always
  // means the same physical spot, whether or not it's currently occupied. Shared
  // by the 3D scene build and the Arrange panel, so both agree on where slot i is.
  const slotPositions = useMemo(() => buildPositions(roomLayout), [roomLayout]);
  // Groups slot indices by which physical wall they're on, in shelf-reading
  // order (top row first, left-to-right/front-to-back within a row) — this is
  // what lets the Arrange panel show real "Back Wall" / "Left Wall" / "Right
  // Wall" sections instead of one flat, spatially-meaningless list.
  const slotGroups = useMemo(() => {
    const order: Array<{ wall: RoomItemPosition["wall"]; label: string }> = [
      { wall: "center", label: "Featured" },
      { wall: "back", label: "Back Wall" },
      { wall: "left", label: "Left Wall" },
      { wall: "right", label: "Right Wall" },
      { wall: "cabinet", label: "Display Cases" },
    ];
    return order
      .map(({ wall, label }) => {
        const indices = slotPositions
          .map((pos, index) => ({ pos, index }))
          .filter((entry) => entry.pos.wall === wall)
          .sort((a, b) => {
            if (a.pos.y !== b.pos.y) return b.pos.y - a.pos.y;
            return wall === "left" || wall === "right" ? a.pos.z - b.pos.z : a.pos.x - b.pos.x;
          })
          .map((entry) => entry.index);
        return { wall, label, indices };
      })
      .filter((group) => group.indices.length > 0);
  }, [slotPositions]);
  const palette = getRoomPalette(roomStyle);

  function openUniverseRoom(room: MuseumUniverseRoom) {
    const ids = room.items.slice(0, TOTAL_SLOT_COUNT).map((item) => item.id);
    if (ids.length === 0) return;
    cameraStateRef.current = null; // entering a different room — start at a fresh spawn, not wherever the last room's camera happened to be
    setGalleryId("scratch");
    setSelectedIds(fillSlots(ids));
    setSelectedItemId(ids[0] ?? "");
    setRoomLayout(ids.length > 16 ? "salon" : "storefront");
    setViewMode("room");
  }

  // The Main Gallery isn't a real universe room yet — it's the museum's still-
  // unbuilt central hall. Entering it clears the selection instead of picking
  // a "biggest room" stand-in, so the room renders as a large, deliberately
  // empty hall (see the empty-room overlay below) until exhibitions exist.
  function openMainHall() {
    cameraStateRef.current = null;
    setGalleryId("scratch");
    setSelectedIds(makeEmptySlots());
    setSelectedItemId("");
    setRoomLayout("storefront");
    setViewMode("room");
    setHallNoticeDismissed(false);
  }

  useEffect(() => {
    if (viewMode !== "room") return;
    const mount = mountRef.current;
    if (!mount) return;
    const container = mount;

    container.innerHTML = "";
    meshesRef.current = [];
    doorwayMeshesRef.current = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // The Grand Hall (empty, no items placed) always gets its own dark,
    // dramatically-spotlit look, independent of whichever room style is
    // selected — a fixed "front door" impression rather than something users
    // reskin like a normal room.
    const inHub = selectedItems.length === 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(inHub ? 0x04060a : roomStyle === "whitebox" ? 0xd5dbe1 : 0x05070b);
    scene.fog = new THREE.Fog(scene.background, 16, 32);

    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 80);
    camera.position.set(0, 3.6, -2.2);

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    roomGroupRef.current = roomGroup;

    // The ground-color argument was the actual floor hex (a saturated
    // brown for every style) — for a vertical wall, whose normal is roughly
    // horizontal, a hemisphere light blends close to 50/50 between sky and
    // ground color, so it pulled EVERY wall toward brown/tan regardless of
    // the wall's own color. That's what was actually crushing/washing out
    // the wall colors, not the hex values themselves — confirmed by
    // sampling actual rendered pixels: the intended navy 0x24405f rendered
    // as 0x0d1a28 (a third of the brightness), and the intended cream
    // 0xf1ede2 rendered as 0x9f9181 (pulled warm/tan). A neutral, low-
    // saturation ground color still gives the hemisphere gradient without
    // overriding every surface's own color.
    const hemi = new THREE.HemisphereLight(
      0xffffff,
      0x3a3a3a,
      inHub ? 2.6 : roomStyle === "whitebox" ? 4.8 : 3.9
    );
    scene.add(hemi);
    const key = new THREE.SpotLight(palette.glow, inHub ? 9.5 : 7.2, 26, Math.PI / 5, 0.55, 1.4);
    key.position.set(0, 7.4, 1.5);
    scene.add(key);
    const warm = new THREE.PointLight(palette.trim, roomStyle === "arcade" ? 3.5 : 1.8, 14);
    warm.position.set(-4.5, 2.4, 1.8);
    scene.add(warm);

    // Flat matte plaster/paint finish for the gallery walls — the old vault
    // style had a noticeable metallic sheen (0.18) that read wrong once the
    // wall color moved from near-black to a painted sage. The Grand Hall
    // overrides to near-black navy regardless of style (see inHub above).
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: inHub ? 0x0c1118 : palette.wall,
      roughness: 0.72,
      metalness: 0.02,
    });
    if (wallTextureUrl) {
      void createImageTexture(wallTextureUrl, 2.4, 1).then((texture) => {
        wallMaterial.map = texture;
        wallMaterial.color.set(0xffffff);
        wallMaterial.needsUpdate = true;
      });
    }
    // Herringbone parquet for the bright classical gallery ("White"); the vault
    // and arcade styles keep plain wood plank / dark flooring.
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: roomStyle === "whitebox" ? createHerringboneTexture() : createHardwoodTexture(),
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0.04,
    });
    // Trim finish varies by style: Vault gets a real brushed-steel feel (it's
    // meant to evoke a bank vault door), White stays matte painted wood/
    // plaster, Arcade keeps its polished-chrome look.
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: roomStyle === "arcade" ? 0.34 : roomStyle === "vault" ? 0.42 : 0.65,
      metalness: roomStyle === "arcade" ? 0.72 : roomStyle === "vault" ? 0.55 : 0.08,
    });
    // Vault reference photos consistently pair the steel door itself with a
    // brass/gold frame and surround, not plain brushed steel — used only for
    // the doorway frame and hinge post below, not the wall shelves.
    const doorFrameMaterial =
      roomStyle === "vault"
        ? new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.32, metalness: 0.78 })
        : trimMaterial;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(21, 26), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.05, -3.2);
    roomGroup.add(floor);

    const baseboardMaterial = new THREE.MeshStandardMaterial({
      color: roomStyle === "whitebox" ? 0xcfc6ac : roomStyle === "vault" ? 0x4a545c : 0x252a30,
      roughness: 0.5,
      metalness: roomStyle === "vault" ? 0.35 : 0.18,
    });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(21, 9.2), wallMaterial);
    backWall.position.set(0, 4.55, -12);
    roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9.2), wallMaterial);
    leftWall.position.set(-10.5, 4.55, -3.2);
    leftWall.rotation.y = Math.PI / 2;
    roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9.2), wallMaterial);
    rightWall.position.set(10.5, 4.55, -3.2);
    rightWall.rotation.y = -Math.PI / 2;
    roomGroup.add(rightWall);

    // The ceiling gets its own plain material, deliberately never wallTextureUrl
    // — an uploaded wallpaper stretched across the ceiling too before, which
    // looked wrong (that's wall decor, not a ceiling finish).
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: inHub ? 0x141a22 : roomStyle === "whitebox" ? 0xf5f1e6 : roomStyle === "arcade" ? 0x14101f : 0xd8dce0,
      roughness: 0.85,
      metalness: 0.02,
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(21, 26), ceilingMaterial);
    ceiling.position.set(0, 9.15, -3.2);
    ceiling.rotation.x = Math.PI / 2;
    roomGroup.add(ceiling);

    const doorSideMaterial = new THREE.MeshStandardMaterial({
      // Was noticeably darker than the main wall for vault (0x0f1c2e vs the
      // wall's 0x24405f) — same wall, different color right at the doorway
      // read as a mismatched patch instead of one continuous room.
      color: inHub ? 0x0a0e14 : roomStyle === "whitebox" ? 0xe0d9c4 : roomStyle === "vault" ? 0x24405f : 0x111419,
      roughness: 0.68,
      metalness: roomStyle === "vault" ? 0.05 : 0.02,
    });
    if (wallTextureUrl) {
      void createImageTexture(wallTextureUrl, 1.4, 1).then((texture) => {
        doorSideMaterial.map = texture;
        doorSideMaterial.color.set(0xffffff);
        doorSideMaterial.needsUpdate = true;
      });
    }
    // Vault style: the entrance wall gets a floor-to-ceiling ARCH cutout
    // (straight sides + a rounded top, reaching the floor — a real walkable
    // passage) instead of a full circle floating mid-wall. EK's reference
    // photo (a real museum "Weapons Vault" exhibit) is unambiguous: the
    // opening itself is arched, not round — the round part is only the
    // door, which stands fully swung clear beside it. archHalfWidth/
    // archStraightHeight define that arch; the door assembly below reuses
    // them so the frame and the opening agree on size.
    const archHalfWidth = 1.7;
    const archStraightHeight = 3.25;
    const vaultDoorRadius = 1.5;

    if (roomStyle === "vault") {
      const rearWallShape = new THREE.Shape();
      rearWallShape.moveTo(-10.5, -0.05);
      rearWallShape.lineTo(10.5, -0.05);
      rearWallShape.lineTo(10.5, 9.15);
      rearWallShape.lineTo(-10.5, 9.15);
      rearWallShape.lineTo(-10.5, -0.05);
      const holePath = new THREE.Path();
      holePath.moveTo(-archHalfWidth, 0);
      holePath.lineTo(-archHalfWidth, archStraightHeight);
      holePath.absarc(0, archStraightHeight, archHalfWidth, Math.PI, 0, true);
      holePath.lineTo(archHalfWidth, 0);
      holePath.lineTo(-archHalfWidth, 0);
      rearWallShape.holes.push(holePath);

      const rearWall = new THREE.Mesh(new THREE.ShapeGeometry(rearWallShape, 48), doorSideMaterial);
      rearWall.position.set(0, 0, 5.8);
      rearWall.rotation.y = Math.PI;
      roomGroup.add(rearWall);

      // Riveted steel architrave tracing the arch — two posts up the
      // straight sides, a half-ring over the curved top.
      const archPostHeight = archStraightHeight;
      const archPostLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostLeft.position.set(-archHalfWidth - 0.08, archPostHeight / 2, 5.7);
      roomGroup.add(archPostLeft);

      const archPostRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostRight.position.set(archHalfWidth + 0.08, archPostHeight / 2, 5.7);
      roomGroup.add(archPostRight);

      const archTop = new THREE.Mesh(
        new THREE.TorusGeometry(archHalfWidth + 0.08, 0.11, 12, 32, Math.PI),
        doorFrameMaterial
      );
      archTop.position.set(0, archStraightHeight, 5.7);
      roomGroup.add(archTop);

      // A heavier riveted hinge column at the right post — this is what the
      // open door below visually reads as attached to.
      const hingeColumn = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, archPostHeight + 0.6, 0.4),
        doorFrameMaterial
      );
      hingeColumn.position.set(archHalfWidth + 0.3, (archPostHeight + 0.6) / 2, 5.72);
      roomGroup.add(hingeColumn);
      for (let i = 0; i < 6; i += 1) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 8), trimMaterial);
        rivet.rotation.x = Math.PI / 2;
        rivet.position.set(archHalfWidth + 0.3, 0.4 + i * 0.55, 5.94);
        roomGroup.add(rivet);
      }
    } else {
      const rearWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallLeft.position.set(-6.13, 4.55, 5.8);
      rearWallLeft.rotation.y = Math.PI;
      roomGroup.add(rearWallLeft);

      const rearWallRight = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallRight.position.set(6.13, 4.55, 5.8);
      rearWallRight.rotation.y = Math.PI;
      roomGroup.add(rearWallRight);

      const rearWallTop = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.25), doorSideMaterial);
      rearWallTop.position.set(0, 7.08, 5.8);
      rearWallTop.rotation.y = Math.PI;
      roomGroup.add(rearWallTop);

      // Plain painted architrave (reuses trimMaterial — same matte finish as
      // the shelf rails) and deliberately NO fill plane across the opening —
      // a solid dark rectangle here read as a closed door, and real museum
      // doorways are open passages you can see straight through, not
      // blocked-off walls.
      const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorLeft.position.set(-1.85, 2.45, 5.64);
      roomGroup.add(doorLeft);

      const doorRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorRight.position.set(1.85, 2.45, 5.64);
      roomGroup.add(doorRight);

      const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.18, 0.18), doorFrameMaterial);
      doorHeader.position.set(0, 4.92, 5.64);
      roomGroup.add(doorHeader);
    }

    // A shallow, dim vestibule just beyond the entrance — without this, the
    // now-open doorway just showed flat scene.background through the gap,
    // which reads as a blank cutout/broken texture rather than a real
    // passage. This is only enough depth to avoid that, not a real room.
    const beyondMaterial = new THREE.MeshStandardMaterial({
      color: inHub ? 0x0a0e14 : roomStyle === "whitebox" ? 0xcfc6ac : roomStyle === "vault" ? 0x0a1420 : 0x0d0a16,
      roughness: 0.9,
      metalness: 0.02,
    });
    const beyondWall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), beyondMaterial);
    beyondWall.position.set(0, 2.5, 8.6);
    beyondWall.rotation.y = Math.PI;
    roomGroup.add(beyondWall);

    const beyondFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), floorMaterial);
    beyondFloor.rotation.x = -Math.PI / 2;
    beyondFloor.position.set(0, -0.04, 7.2);
    roomGroup.add(beyondFloor);

    const beyondLight = new THREE.PointLight(palette.glow, 0.5, 6);
    beyondLight.position.set(0, 3, 7.5);
    roomGroup.add(beyondLight);

    // Vault style only: a heavy riveted steel door, fully swung open and
    // standing clear beside the arch — grounded near the floor, its full
    // riveted face visible, exactly like EK's reference photo (a real
    // "Weapons Vault" museum exhibit: the door stands to the right of the
    // opening, attached to a thick hinge column, face mostly toward the
    // viewer, nowhere near overlapping the passage). Not part of
    // meshesRef/doorwayMeshesRef, so it can't affect the doorway's
    // click/raycast behavior (backDoorway, the plain invisible hit-target
    // plane a bit further down, is unchanged and still covers this arch).
    //
    // Two earlier passes both tried to make this door literally hinge/pivot
    // in place — first onto a rectangular opening (never matched, a round
    // door swinging out of a square hole isn't a real design), then a
    // second time with real hinge-rotation math onto a round hole, but the
    // rotation only opened ~110° and the math showed the disc still
    // clipping the opening at that angle. Reference photos show the door
    // simply standing well clear, next to the frame, not mid-swing — so
    // this version places it directly at its open resting position instead
    // of computing a rotation, and the placement below is chosen so the
    // disc's footprint (center + radius) never reaches the arch's x<=1.7
    // opening at all.
    if (roomStyle === "vault") {
      const vaultDoorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b939a,
        roughness: 0.3,
        metalness: 0.88,
      });
      const doorThickness = 0.28;
      const doorGroup = new THREE.Group();

      const doorDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(vaultDoorRadius, vaultDoorRadius, doorThickness, 32),
        vaultDoorMaterial
      );
      doorDisc.rotation.x = Math.PI / 2;
      doorGroup.add(doorDisc);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, doorThickness + 0.05, 20),
        trimMaterial
      );
      hub.rotation.x = Math.PI / 2;
      doorGroup.add(hub);

      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, doorThickness + 0.06), trimMaterial);
        spoke.position.set(Math.cos(angle) * vaultDoorRadius * 0.8, Math.sin(angle) * vaultDoorRadius * 0.8, 0);
        doorGroup.add(spoke);
      }

      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2;
        const rivet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, doorThickness + 0.08, 8),
          trimMaterial
        );
        rivet.rotation.x = Math.PI / 2;
        rivet.position.set(
          Math.cos(angle) * vaultDoorRadius * 0.94,
          Math.sin(angle) * vaultDoorRadius * 0.94,
          0
        );
        doorGroup.add(rivet);
      }

      // Grounded (bottom edge ~0.15 above the floor), standing just past
      // the hinge column, well inside the room (not the vestibule) on the
      // same side as the camera — matching the reference. A slight turn
      // (not a full 90°) keeps the riveted face visible rather than edge-on.
      doorGroup.position.set(archHalfWidth + 0.3 + vaultDoorRadius + 0.35, vaultDoorRadius + 0.15, 5.2);
      doorGroup.rotation.y = 0.3;
      roomGroup.add(doorGroup);
    }

    const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(20.7, 0.18, 0.12), baseboardMaterial);
    backBaseboard.position.set(0, 0.08, -11.9);
    roomGroup.add(backBaseboard);

    const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    leftBaseboard.position.set(-10.42, 0.08, -3.05);
    roomGroup.add(leftBaseboard);

    const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    rightBaseboard.position.set(10.42, 0.08, -3.05);
    roomGroup.add(rightBaseboard);

    // The entrance wall (either side of the doorway) had no baseboard at
    // all, so the door-frame posts appeared to just stop bare at the floor
    // instead of meeting the same trim line as the rest of the room.
    const frontBaseboardLeft = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardLeft.position.set(-6.13, 0.08, 5.7);
    roomGroup.add(frontBaseboardLeft);

    const frontBaseboardRight = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardRight.position.set(6.13, 0.08, 5.7);
    roomGroup.add(frontBaseboardRight);

    for (let row = 0; row < SHELF_ROW_Y.length; row += 1) {
      const y = SHELF_ROW_Y[row];

      // The board's front edge (the face items actually sit near) stays put;
      // only the back edge moves. Original boards were 0.55 thick centered
      // 0.245 units clear of the real wall (back z=-12, sides x=±10.5) — that
      // wasn't just a corner gap, the ENTIRE run of every shelf floated off
      // its wall the whole time, visible as open air/wall-texture showing
      // above and behind the board. Depth 0.845 (0.55 + 0.245 gap + 0.05
      // embed) puts the back face flush against, and slightly into, the wall.

      // Widened to 19.9 (from 18.2) so it actually reaches the side shelves at
      // x=±9.98 instead of leaving a visible ~0.9-unit gap at each back corner.
      const backShelf = new THREE.Mesh(new THREE.BoxGeometry(19.9, 0.1, 0.845), trimMaterial);
      backShelf.position.set(0, y, -11.6275);
      roomGroup.add(backShelf);

      const leftShelf = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, 23.2), trimMaterial);
      leftShelf.position.set(-10.1275, y, -3.15);
      roomGroup.add(leftShelf);

      const rightShelf = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, 23.2), trimMaterial);
      rightShelf.position.set(10.1275, y, -3.15);
      roomGroup.add(rightShelf);
    }

    const cabinetMaterial = new THREE.MeshStandardMaterial({
      color: roomStyle === "whitebox" ? 0xe8edf1 : 0x2b3037,
      roughness: 0.38,
      metalness: 0.18,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xbceeff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.08,
      metalness: 0.08,
    });
    CABINET_SPOTS.forEach(([x, z], index) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.72, 1.12), cabinetMaterial);
      base.position.set(x, 0.31, z);
      roomGroup.add(base);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1), glassMaterial);
      glass.position.set(x, 1.25, z);
      roomGroup.add(glass);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.18), trimMaterial);
      cap.position.set(x, 1.85, z);
      roomGroup.add(cap);

      const glow = new THREE.PointLight(palette.glow, 0.55, 4);
      glow.position.set(x, 2.2, z + (index % 2 === 0 ? 0.25 : -0.25));
      roomGroup.add(glow);
    });

    // Doorways: a "go back one level" archway is always present at the entrance
    // wall, and the Grand Hall additionally gets one freestanding archway per
    // populated universe room, each with a sign naming where it leads — so the
    // museum is actually navigated room-to-room instead of only via the flat map.
    function buildDoorwaySign(x: number, y: number, z: number, label: string, faceBack: boolean) {
      const signTexture = drawDoorSignTexture(label);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 0.58),
        new THREE.MeshStandardMaterial({
          map: signTexture,
          emissive: 0x0c0f13,
          emissiveIntensity: 0.35,
          roughness: 0.5,
        })
      );
      sign.position.set(x, y, z);
      if (faceBack) sign.rotation.y = Math.PI;
      roomGroup.add(sign);
    }

    buildDoorwaySign(0, 5.55, 5.9, inHub ? "Campus Map" : "Main Gallery", true);
    // Two real bugs here, both silently killed every doorway click: (1)
    // `visible: false` makes the raycaster skip the mesh entirely, not just hide
    // it — fixed with transparent+opacity:0 instead. (2) this plane is never
    // rotated, so it keeps PlaneGeometry's default +Z-facing normal — the room
    // interior approaches it from -Z, hitting its BACK face, which a default
    // FrontSide material silently ignores for raycasting. DoubleSide fixes that
    // regardless of which way the plane happens to face.
    const backDoorway = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 4.9),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    backDoorway.position.set(0, 2.6, 5.55);
    backDoorway.userData.doorwayTarget = inHub ? "__overview__" : "__hub__";
    roomGroup.add(backDoorway);
    doorwayMeshesRef.current.push(backDoorway);

    if (inHub) {
      const wingRooms = universeRooms.filter((room) => room.items.length > 0).slice(0, 6);
      const doorHeight = 3.3;
      const doorWidth = 2.05;
      const archZ = -8.4;
      wingRooms.forEach((room, index) => {
        const x = wingRooms.length === 1 ? 0 : -7 + (index * 14) / (wingRooms.length - 1);

        const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight, 0.18), trimMaterial);
        left.position.set(x - doorWidth / 2, doorHeight / 2, archZ);
        roomGroup.add(left);

        const right = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight, 0.18), trimMaterial);
        right.position.set(x + doorWidth / 2, doorHeight / 2, archZ);
        roomGroup.add(right);

        const header = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.16, 0.18, 0.18), trimMaterial);
        header.position.set(x, doorHeight, archZ);
        roomGroup.add(header);

        const archGlow = new THREE.PointLight(palette.glow, 0.4, 3.4);
        archGlow.position.set(x, doorHeight - 0.4, archZ + 0.3);
        roomGroup.add(archGlow);

        buildDoorwaySign(x, doorHeight + 0.5, archZ, room.title, false);

        const hitTarget = new THREE.Mesh(
          new THREE.PlaneGeometry(doorWidth, doorHeight + 1),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
        );
        hitTarget.position.set(x, (doorHeight + 1) / 2, archZ);
        hitTarget.userData.doorwayTarget = room.id;
        roomGroup.add(hitTarget);
        doorwayMeshesRef.current.push(hitTarget);
      });
    }

    // Always the full fixed-slot table (not selectedItems.length) so slot index i
    // is the same physical spot regardless of how many items are actually placed —
    // that's what makes an item's shelf position independently assignable.
    const positions = slotPositions;
    slotItems.forEach((item, index) => {
      if (!item) return;
      const pos = positions[index];
      if (!pos) return;

      const texture = drawItemTexture(item, showValues);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.44,
        metalness: 0.08,
        emissive: new THREE.Color(0x05070a),
        emissiveIntensity: 0.08,
      });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1.12 * pos.scale, 1.54 * pos.scale), material);
      card.position.set(pos.x, pos.y, pos.z);
      card.userData.itemId = item.id;
      card.userData.flat = pos.flat === true;

      if (pos.flat) {
        // Lying flat in a display case, face up — no wall-mount frame.
        card.rotation.x = -Math.PI / 2;
        card.rotation.z = pos.ry;
        roomGroup.add(card);
        meshesRef.current.push(card);
      } else {
        card.rotation.y = pos.ry;
        roomGroup.add(card);
        meshesRef.current.push(card);

        const normal = new THREE.Vector3(Math.sin(pos.ry), 0, Math.cos(pos.ry));

        // Real wall planes: back z=-12, left x=-10.5, right x=10.5. The frame used to
        // be a fixed thin box floating ~0.045 behind the card, which left a visible
        // air gap (0.15-0.2 units) between the frame and the actual wall — reading as
        // the item hovering in front of the wall instead of mounted on it. Stretch the
        // frame's depth back to actually touch the wall. Free-standing "center" items
        // (spotlight layout) keep the old small offset since they aren't wall-mounted.
        let frameDepth = 0.06;
        let centerOffset = 0.045;
        if (pos.wall === "back" || pos.wall === "left" || pos.wall === "right") {
          const wallGap =
            pos.wall === "back" ? pos.z + 12 : pos.wall === "left" ? pos.x + 10.5 : 10.5 - pos.x;
          const frontOffset = 0.015;
          const backOverlap = 0.05;
          frameDepth = Math.max(0.06, wallGap - frontOffset + backOverlap);
          centerOffset = frontOffset + frameDepth / 2;
        }

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.25 * pos.scale, 1.67 * pos.scale, frameDepth),
          trimMaterial
        );
        frame.position.set(
          pos.x - normal.x * centerOffset,
          pos.y,
          pos.z - normal.z * centerOffset
        );
        frame.rotation.y = pos.ry;
        roomGroup.add(frame);
      }

      const url = itemImage(item);
      if (url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const next = drawItemTexture(item, showValues, img);
          material.map = next;
          material.needsUpdate = true;
        };
        img.onerror = () => {
          material.needsUpdate = true;
        };
        img.src = url;
      }
    });

    // Organize mode: a numbered badge floating in front of every slot (matching
    // the Arrange panel's numbering exactly, same slotPositions table) plus a
    // dashed outline on empty ones — so you can see in the actual room, not just
    // the flat sidebar list, exactly which physical spot a number refers to.
    if (isOrganizing) {
      positions.forEach((pos, index) => {
        const occupied = Boolean(slotItems[index]);
        const badgeTexture = drawSlotBadgeTexture(index + 1);
        const badge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4, 0.4),
          new THREE.MeshBasicMaterial({
            map: badgeTexture,
            transparent: true,
            depthTest: false,
          })
        );
        badge.renderOrder = 999;

        if (pos.flat) {
          badge.position.set(pos.x, pos.y + 0.05, pos.z);
          badge.rotation.x = -Math.PI / 2;
        } else {
          const nx = Math.sin(pos.ry);
          const nz = Math.cos(pos.ry);
          const halfHeight = (1.54 * pos.scale) / 2;
          badge.position.set(pos.x + nx * 0.4, pos.y + halfHeight + 0.28, pos.z + nz * 0.4);
          badge.rotation.y = pos.ry;
        }
        roomGroup.add(badge);

        if (!occupied) {
          const ghostWidth = pos.flat ? 1.12 * pos.scale : 1.12 * pos.scale;
          const ghostHeight = pos.flat ? 1.12 * pos.scale : 1.54 * pos.scale;
          const ghostEdges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(ghostWidth, ghostHeight));
          const ghostLine = new THREE.LineSegments(
            ghostEdges,
            new THREE.LineBasicMaterial({ color: 0x4fd3ee, transparent: true, opacity: 0.6 })
          );
          ghostLine.position.set(pos.x, pos.y, pos.z);
          if (pos.flat) {
            ghostLine.rotation.x = -Math.PI / 2;
            ghostLine.rotation.z = pos.ry;
          } else {
            ghostLine.rotation.y = pos.ry;
          }
          roomGroup.add(ghostLine);
        }
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let width = 0;
    let height = 0;
    let raf = 0;
    const eyeHeight = 3.6;
    const savedCamera = cameraStateRef.current;
    // A fresh spawn (no saved camera) looks straight down -Z at yaw 0, which
    // points dead-on at the back shelf wall — it fills the frame edge-to-edge
    // with flat, unforeshortened shelf rows and leaves almost no floor/ceiling/
    // side-wall visible, reading as "staring at a wall" instead of "entering a
    // room." Angling the default view ~25° toward a corner (and tilting down
    // slightly) shows the back wall AND a side wall together with real depth,
    // the way a person glancing across a room on arrival actually would.
    let yaw = savedCamera?.yaw ?? -0.45;
    let pitch = savedCamera?.pitch ?? -0.08;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const NAV_PITCH_LIMIT = 0.32;
    const cameraBody = new THREE.Vector3(savedCamera?.x ?? 0, savedCamera?.y ?? eyeHeight, savedCamera?.z ?? -2.2);
    const targetCameraBody = cameraBody.clone();
    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;

    // Height is NOT force-reset to eye level here anymore — a focus-click needs to
    // park the camera at the item's own height (see onPointerUp) for a level,
    // face-on shot. moveCamera() below restores eye height on foot so walking
    // around doesn't leave you stuck crouched/floating from an earlier focus.
    // Walking or scroll-zooming has no collision detection at all — this
    // clamp is the only thing keeping the camera out of the walls, and it
    // used to allow getting within ~1.1 units of the shelf-mounted side/back
    // walls. At that range, looking straight at a wall fills the entire
    // frame with flat shelf trim and no floor/ceiling around it — which
    // reads exactly like being "stuck behind a shelf," not just close to
    // one. Pulled back to a ~3-unit margin so the wall never fills the view.
    function clampPosition(position: THREE.Vector3) {
      position.x = Math.max(-7.5, Math.min(7.5, position.x));
      position.z = Math.max(-9, Math.min(4.72, position.z));
      return position;
    }

    function clampView(pitchLimit = NAV_PITCH_LIMIT) {
      targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, targetPitch));
      clampPosition(targetCameraBody);
    }

    function facingDirection() {
      return new THREE.Vector3(Math.sin(targetYaw), 0, -Math.cos(targetYaw)).normalize();
    }

    function strafeDirection() {
      return new THREE.Vector3(Math.cos(targetYaw), 0, Math.sin(targetYaw)).normalize();
    }

    function moveCamera(command: string, amount = 0.54) {
      if (command === "forward") {
        targetCameraBody.add(facingDirection().multiplyScalar(amount));
        targetCameraBody.y = eyeHeight;
      } else if (command === "back") {
        targetCameraBody.add(facingDirection().multiplyScalar(-amount));
        targetCameraBody.y = eyeHeight;
      } else if (command === "left") {
        targetCameraBody.add(strafeDirection().multiplyScalar(-amount));
        targetCameraBody.y = eyeHeight;
      } else if (command === "right") {
        targetCameraBody.add(strafeDirection().multiplyScalar(amount));
        targetCameraBody.y = eyeHeight;
      } else if (command === "turn-left") {
        targetYaw += 0.22;
      } else if (command === "turn-right") {
        targetYaw -= 0.22;
      }
      clampView();
    }

    function resize() {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function render() {
      yaw += (targetYaw - yaw) * 0.12;
      pitch += (targetPitch - pitch) * 0.12;
      cameraBody.lerp(targetCameraBody, 0.15);

      const lookDirection = new THREE.Vector3(
        Math.sin(yaw),
        Math.sin(pitch),
        -Math.cos(yaw)
      ).normalize();
      camera.position.copy(cameraBody);
      camera.lookAt(cameraBody.clone().add(lookDirection.multiplyScalar(6)));
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(render);
    }

    function onPointerDown(event: PointerEvent) {
      isDragging = true;
      didDrag = false;
      startX = event.clientX;
      startY = event.clientY;
    }

    function onPointerMove(event: PointerEvent) {
      if (!isDragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) didDrag = true;
      targetYaw -= dx * 0.0035;
      targetPitch += dy * 0.0016;
      clampView();
      startX = event.clientX;
      startY = event.clientY;
    }

    function onPointerUp(event: PointerEvent) {
      if (!didDrag) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          [...meshesRef.current, ...doorwayMeshesRef.current],
          false
        )[0];
        if (hit?.object.userData.doorwayTarget) {
          const target = String(hit.object.userData.doorwayTarget);
          if (target === "__overview__") {
            setViewMode("overview");
          } else if (target === "__hub__") {
            openMainHall();
          } else {
            const targetRoom = universeRooms.find((room) => room.id === target);
            if (targetRoom) openUniverseRoom(targetRoom);
          }
        } else if (hit?.object.userData.itemId) {
          const itemId = String(hit.object.userData.itemId);
          const worldPosition = hit.object.getWorldPosition(new THREE.Vector3());

          if (hit.object.userData.flat) {
            // A display-case item lies flat with no wall to be "level" against —
            // the natural way to view it is standing back a bit and looking down
            // into the case, so this deliberately keeps some downward tilt instead
            // of forcing pitch to 0 the way a wall-mounted item does.
            const standBack = 2.3;
            const standUp = 1.3;
            const focusCamera = new THREE.Vector3(worldPosition.x, worldPosition.y + standUp, worldPosition.z + standBack);
            setSelectedItemId(itemId);
            targetCameraBody.copy(focusCamera);
            targetYaw = 0;
            targetPitch = Math.atan2(-standUp, standBack);
            clampView();
          } else {
            const worldQuaternion = hit.object.getWorldQuaternion(new THREE.Quaternion());
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
            normal.y = 0;
            normal.normalize();

            // Level, face-on framing: park the camera at the ITEM's own height (not
            // a fixed eye height) so the shot is dead level — tilting a fixed-height
            // camera up/down to compensate reads as "looking up/down at" the item
            // instead of standing in front of it. moveCamera() restores normal eye
            // height as soon as you walk, so this doesn't strand you crouched/floating.
            const standDistance = 2.6;
            const focusCamera = worldPosition.clone().add(normal.clone().multiplyScalar(standDistance));
            focusCamera.y = Math.max(1.3, Math.min(6.6, worldPosition.y));

            setSelectedItemId(itemId);
            targetCameraBody.copy(focusCamera);
            targetYaw = Math.atan2(-normal.x, normal.z);
            targetPitch = 0;
            clampView();
          }
        }
      }
      isDragging = false;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      moveCamera(event.deltaY > 0 ? "back" : "forward", 0.42);
    }

    function onMoveCommand(event: Event) {
      const command = (event as CustomEvent<{ command?: string; amount?: number }>).detail?.command;
      if (!command) return;
      moveCamera(command, (event as CustomEvent<{ amount?: number }>).detail?.amount ?? 0.54);
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        moveCamera("forward");
      } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        moveCamera("back");
      } else if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        moveCamera("left");
      } else if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        moveCamera("right");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveCamera("turn-left");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveCamera("turn-right");
      }
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("vltd-room-move", onMoveCommand);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    resize();
    render();



    return () => {
      cameraStateRef.current = { x: cameraBody.x, y: cameraBody.y, z: cameraBody.z, yaw, pitch };
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("vltd-room-move", onMoveCommand);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [isOrganizing, palette.floor, palette.glow, palette.trim, palette.wall, roomLayout, roomStyle, showValues, slotItems, slotPositions, universeRoomsKey, viewMode, wallTextureUrl]);

  function applyGallery(nextGalleryId: string) {
    setGalleryId(nextGalleryId);
    if (nextGalleryId === "scratch") {
      setSourceStatus(null);
      return;
    }
    const gallery = galleries.find((entry) => entry.id === nextGalleryId);
    if (!gallery) {
      setSourceStatus({ ok: false, message: "Couldn't find that exhibition." });
      return;
    }
    const sectionIds = getGallerySections(gallery).flatMap((section) => section.itemIds);
    const ids = sectionIds.length > 0 ? sectionIds : gallery.itemIds;
    const validIds = ids.filter((id) => items.some((item) => item.id === id));
    if (validIds.length > 0) {
      setSelectedIds(fillSlots(validIds));
      setSelectedItemId(validIds[0] ?? "");
      setSourceStatus(
        validIds.length < ids.length
          ? { ok: true, message: `Loaded ${validIds.length} of ${ids.length} items (some no longer match your vault).` }
          : { ok: true, message: `Loaded ${validIds.length} item${validIds.length === 1 ? "" : "s"}.` }
      );
      return;
    }
    // Nothing matched — this used to leave the room exactly as it was with
    // no explanation. Now it says so, instead of looking like the dropdown
    // did nothing.
    setSourceStatus({
      ok: false,
      message:
        ids.length === 0
          ? "This exhibition has no items saved to it yet."
          : `None of this exhibition's ${ids.length} item${ids.length === 1 ? "" : "s"} matched your vault — room unchanged.`,
    });
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) => {
      const existingIdx = current.indexOf(itemId);
      if (existingIdx !== -1) {
        const next = [...current];
        next[existingIdx] = "";
        return next;
      }
      const emptyIdx = current.indexOf("");
      if (emptyIdx === -1) return current;
      const next = [...current];
      next[emptyIdx] = itemId;
      return next;
    });
    setSelectedItemId(itemId);
  }

  // Swaps whatever occupies two shelf slots (an item, or nothing) — since
  // `positions[i]` is a fixed physical spot regardless of what's in it, this is
  // what makes a slot independently assignable: swap onto an empty slot to move
  // an item there, or onto an occupied one to trade places.
  function swapSlots(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setSelectedIds((current) => {
      const next = [...current];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
  }

  function saveDraft() {
    // Wallpaper is saved separately from the rest of the draft (see below) —
    // it used to be embedded inline here, and a large base64 image could push
    // the whole blob past localStorage's quota. That failure was never caught,
    // so it silently dropped the ENTIRE draft, not just the wallpaper.
    const draft: RoomDraft = {
      galleryId,
      selectedIds,
      roomStyle,
      roomLayout,
      viewMode,
      showValues,
    };
    let ok = true;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      ok = false;
    }
    try {
      if (wallTextureUrl) {
        window.localStorage.setItem(WALLPAPER_KEY, wallTextureUrl);
      } else {
        window.localStorage.removeItem(WALLPAPER_KEY);
      }
    } catch {
      ok = false;
      setWallpaperError("Wallpaper is too large to save — try a smaller image.");
    }
    setSaveState(ok ? "saved" : "error");
    window.setTimeout(() => setSaveState("idle"), 1800);
  }

  function sendMoveCommand(command: string, amount?: number) {
    window.dispatchEvent(
      new CustomEvent("vltd-room-move", {
        detail: { command, amount },
      })
    );
  }

  function handleWallpaperUpload(file?: File | null) {
    if (!file) return;
    setWallpaperError("");
    void fileToRoomWallpaper(file)
      .then(setWallTextureUrl)
      .catch((error) => {
        setWallpaperError(error instanceof Error ? error.message : "Could not load wallpaper image.");
      });
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-3 sm:px-6 sm:py-4">
        {/* Top bar: identity + Source + Room settings, side by side, full width —
            keeps the 3D room from being squeezed next to a tall stacked sidebar. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,300px)_minmax(200px,260px)_minmax(0,1fr)]">
          <div className="rounded-[8px] border bg-[color:var(--theme-card)] p-3 shadow-[var(--shadow-soft)]" style={{ borderColor: "var(--theme-border)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                  <Layers3 size={12} />
                  Virtual Room
                </div>
                <h1 className="mt-1 text-xl font-black uppercase leading-[0.92] tracking-normal">
                  Gallery Builder
                </h1>
              </div>
              <Link
                href="/museum"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]"
                aria-label="Back to exhibitions"
                title="Back to exhibitions"
              >
                <GalleryHorizontalEnd size={15} />
              </Link>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Metric icon={<Boxes size={13} />} label="Items" value={String(selectedItems.length)} />
              <Metric icon={<BadgeDollarSign size={13} />} label="Value" value={formatMoney(selectedValue) || "$0"} />
              <Metric icon={<Eye size={13} />} label="Mode" value="3D" />
            </div>
          </div>

          <ControlPanel title="Source" icon={<Grid3X3 size={15} />}>
            <select
              value={galleryId}
              onChange={(event) => applyGallery(event.target.value)}
              className="h-8 w-full rounded-[6px] bg-[color:var(--input)] px-2.5 text-xs ring-1 ring-[color:var(--border)]"
            >
              <option value="scratch">Scratch room</option>
              {galleries.map((gallery) => (
                <option key={gallery.id} value={gallery.id}>
                  {gallery.title}
                </option>
              ))}
            </select>
            {sourceStatus ? (
              <div
                className={[
                  "text-xs font-semibold leading-4",
                  sourceStatus.ok ? "text-[color:var(--muted)]" : "text-amber-300",
                ].join(" ")}
              >
                {sourceStatus.message}
              </div>
            ) : null}
          </ControlPanel>

          <ControlPanel
            title="Room"
            icon={<MonitorUp size={15} />}
            action={
              <button
                type="button"
                onClick={() => setRoomPanelOpen((current) => !current)}
                aria-label={roomPanelOpen ? "Collapse room settings" : "Expand room settings"}
                className="grid h-6 w-6 place-items-center rounded-[5px] bg-[color:var(--input)] text-[color:var(--muted2)] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
              >
                {roomPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            }
          >
            {roomPanelOpen ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="w-[92px] min-w-[92px]">
                  <Segmented
                    value={viewMode}
                    options={[
                      ["room", "Room"],
                      ["overview", "Map"],
                    ]}
                    onChange={(value) => setViewMode(value as ViewMode)}
                  />
                </div>
                <div className="w-[136px] min-w-[136px]">
                  <Segmented
                    value={roomLayout}
                    options={[
                      ["storefront", "Store"],
                      ["salon", "Salon"],
                      ["spotlight", "Hero"],
                    ]}
                    onChange={(value) => setRoomLayout(value as RoomLayout)}
                  />
                </div>
                <div className="w-[136px] min-w-[136px]">
                  <Segmented
                    value={roomStyle}
                    options={[
                      ["vault", "Vault"],
                      ["whitebox", "White"],
                      ["arcade", "Arcade"],
                    ]}
                    onChange={(value) => setRoomStyle(value as RoomStyle)}
                  />
                </div>
                <label className="flex h-6 items-center gap-1.5 rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold ring-1 ring-[color:var(--border)]">
                  <input
                    type="checkbox"
                    checked={showValues}
                    onChange={(event) => setShowValues(event.target.checked)}
                    className="h-3 w-3 accent-cyan-400"
                  />
                  Values
                </label>
                <label className="flex h-6 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold ring-1 ring-[color:var(--border)] transition hover:bg-black/10">
                  <Paintbrush size={12} />
                  {wallTextureUrl ? "Wallpaper" : "Wallpaper"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      handleWallpaperUpload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {wallTextureUrl ? (
                  <button
                    type="button"
                    onClick={() => setWallTextureUrl("")}
                    className="flex h-6 items-center rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
                  >
                    Remove
                  </button>
                ) : null}
                {wallpaperError ? (
                  <div className="basis-full text-[11px] font-semibold text-red-300">{wallpaperError}</div>
                ) : null}
              </div>
            ) : null}
          </ControlPanel>
        </div>

        {/* Below the top bar: Items sidebar (narrower) + the 3D room, which now
            gets the majority of the width instead of sitting beside a tall
            stacked sidebar for the room's full height. */}
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="grid gap-3 xl:sticky xl:top-4 xl:self-start">
          <ControlPanel
            title={isOrganizing ? "Arrange Shelf Order" : "Items"}
            icon={<PackagePlus size={15} />}
            action={
              selectedItems.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsOrganizing((current) => {
                      const next = !current;
                      setRoomPanelOpen(!next);
                      return next;
                    });
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  aria-pressed={isOrganizing}
                  className={[
                    "inline-flex min-h-[26px] items-center justify-center rounded-full px-2.5 text-[11px] font-black transition",
                    isOrganizing
                      ? "bg-[#4FD3EE] text-[#06171d]"
                      : "bg-[color:var(--input)] text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]",
                  ].join(" ")}
                >
                  {isOrganizing ? "Done" : "Organize"}
                </button>
              ) : null
            }
          >
            {isOrganizing ? (
              <>
                <p className="text-xs leading-5 text-[color:var(--muted)]">
                  Sections below match the room&apos;s actual walls. Drag a piece onto any
                  square — filled or empty — to put it on that exact shelf.
                </p>
                <div className="grid max-h-[520px] gap-4 overflow-y-auto pr-1">
                  {slotGroups.map((group) => (
                    <div key={group.wall}>
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                        <span>{group.label}</span>
                        <span className="text-[color:var(--muted)]">
                          {group.indices.filter((i) => slotItems[i]).length}/{group.indices.length}
                        </span>
                      </div>
                      <div
                        className={
                          group.wall === "back"
                            ? "grid grid-cols-8 gap-1"
                            : group.wall === "center"
                              ? "grid grid-cols-3 gap-1.5"
                              : group.wall === "cabinet"
                                ? "grid grid-cols-5 gap-1.5"
                                : "grid grid-cols-4 gap-1.5"
                        }
                      >
                        {group.indices.map((idx) => {
                          const item = slotItems[idx];
                          const isBeingDragged = dragIndex === idx;
                          const isDragOver = dragOverIndex === idx && dragIndex !== idx;
                          const showLabel = group.wall !== "back";
                          return (
                            <div
                              key={idx}
                              data-arrange-idx={idx}
                              draggable={Boolean(item)}
                              title={item?.title}
                              style={{ touchAction: "none" }}
                              onDragStart={(e) => {
                                if (!item) return;
                                e.dataTransfer.setData("text/plain", String(idx));
                                e.dataTransfer.effectAllowed = "move";
                                setDragIndex(idx);
                                const imgEl = e.currentTarget.querySelector("img");
                                if (imgEl) e.dataTransfer.setDragImage(imgEl, imgEl.clientWidth / 2, imgEl.clientHeight / 2);
                              }}
                              onDragOver={(e) => {
                                if (dragIndex === null) return;
                                e.preventDefault();
                                if (dragIndex !== idx) setDragOverIndex(idx);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const fromIdx = dragIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
                                if (!Number.isNaN(fromIdx) && fromIdx !== idx) swapSlots(fromIdx, idx);
                                setDragIndex(null);
                                setDragOverIndex(null);
                              }}
                              onDragEnd={() => {
                                setDragIndex(null);
                                setDragOverIndex(null);
                              }}
                              onTouchStart={
                                item
                                  ? (e) => {
                                      e.stopPropagation();
                                      touchFromRef.current = idx;
                                      touchOverRef.current = null;
                                      setDragIndex(idx);
                                      const imgEl = e.currentTarget.querySelector("img");
                                      if (imgEl) {
                                        const clone = imgEl.cloneNode(true) as HTMLImageElement;
                                        Object.assign(clone.style, {
                                          position: "fixed",
                                          width: "56px",
                                          height: "56px",
                                          objectFit: "cover",
                                          borderRadius: "6px",
                                          opacity: "0.88",
                                          pointerEvents: "none",
                                          zIndex: "9999",
                                          transform: "scale(1.1)",
                                          boxShadow: "0 0 0 2px rgba(79,211,238,0.8), 0 8px 24px rgba(0,0,0,0.5)",
                                        });
                                        const touch = e.touches[0];
                                        clone.style.left = `${touch.clientX - 28}px`;
                                        clone.style.top = `${touch.clientY - 28}px`;
                                        document.body.appendChild(clone);
                                        touchCloneRef.current = clone;
                                      }
                                    }
                                  : undefined
                              }
                              onTouchMove={
                                item
                                  ? (e) => {
                                      if (touchFromRef.current === null) return;
                                      const touch = e.touches[0];
                                      if (touchCloneRef.current) {
                                        touchCloneRef.current.style.left = `${touch.clientX - 28}px`;
                                        touchCloneRef.current.style.top = `${touch.clientY - 28}px`;
                                      }
                                      const clone = touchCloneRef.current;
                                      if (clone) clone.style.visibility = "hidden";
                                      let el: Element | null = document.elementFromPoint(touch.clientX, touch.clientY);
                                      if (clone) clone.style.visibility = "";
                                      let toIdx: number | null = null;
                                      while (el && toIdx === null) {
                                        const attr = el.getAttribute("data-arrange-idx");
                                        if (attr !== null) toIdx = parseInt(attr, 10);
                                        el = el.parentElement;
                                      }
                                      if (toIdx !== null && toIdx !== touchFromRef.current) {
                                        touchOverRef.current = toIdx;
                                        setDragOverIndex(toIdx);
                                      }
                                    }
                                  : undefined
                              }
                              onTouchEnd={
                                item
                                  ? () => {
                                      const fromIdx = touchFromRef.current;
                                      const toIdx = touchOverRef.current;
                                      touchFromRef.current = null;
                                      touchOverRef.current = null;
                                      touchCloneRef.current?.remove();
                                      touchCloneRef.current = null;
                                      if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
                                        swapSlots(fromIdx, toIdx);
                                      }
                                      setDragIndex(null);
                                      setDragOverIndex(null);
                                    }
                                  : undefined
                              }
                              className={[
                                "relative min-w-0 select-none overflow-hidden rounded-[5px] transition",
                                item ? "cursor-grab bg-[color:var(--input)] ring-1 ring-[color:var(--border)] active:cursor-grabbing" : "bg-black/10 ring-1 ring-dashed ring-[color:var(--border)]",
                                isDragOver ? "z-10 scale-110 bg-[rgba(79,211,238,0.22)] ring-2 ring-[#4FD3EE]" : "",
                                isBeingDragged ? "opacity-30" : "opacity-100",
                              ].join(" ")}
                            >
                              <span className="absolute left-0.5 top-0.5 z-[1] grid h-3.5 min-w-[14px] place-items-center rounded-[3px] bg-black/70 px-0.5 text-[8px] font-black leading-none text-white/85">
                                {idx + 1}
                              </span>
                              <span className="block aspect-square overflow-hidden bg-black/20">
                                {item && itemImage(item) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={itemImage(item)} alt="" className="h-full w-full object-cover" draggable={false} />
                                ) : null}
                              </span>
                              {showLabel && item ? (
                                <span className="block truncate px-1 py-0.5 text-[9px] font-bold">{item.title}</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="max-h-[360px] overflow-y-auto pr-1">
                <div className="grid gap-2">
                  {items.map((item) => {
                    const selected = selectedSet.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className={[
                          "grid grid-cols-[42px_minmax(0,1fr)_24px] items-center gap-2 rounded-[6px] p-2 text-left ring-1 transition",
                          selected
                            ? "bg-[rgba(79,211,238,0.10)] ring-[rgba(79,211,238,0.45)]"
                            : "bg-[color:var(--input)] ring-[color:var(--border)]",
                        ].join(" ")}
                      >
                        <span className="h-[54px] overflow-hidden rounded-[5px] bg-black/20">
                          {itemImage(item) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={itemImage(item)} alt="" className="h-full w-full object-cover" draggable={false} />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">
                            {itemSubtitle(item) || item.universe || item.category || "Collection piece"}
                          </span>
                        </span>
                        <span
                          className={[
                            "grid h-6 w-6 place-items-center rounded-[5px] text-xs font-black ring-1",
                            selected
                              ? "bg-[#4FD3EE] text-[#06171d] ring-cyan-200/40"
                              : "bg-black/10 text-[color:var(--muted2)] ring-[color:var(--border)]",
                          ].join(" ")}
                        >
                          {selected ? "ON" : "+"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </ControlPanel>

          <button
            type="button"
            onClick={saveDraft}
            className={[
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-black shadow-[0_0_18px_rgba(79,211,238,0.22)]",
              saveState === "error"
                ? "bg-red-400 text-[#2a0505]"
                : "bg-[linear-gradient(180deg,#79E7FB,#2CB1D1)] text-[#06171d]",
            ].join(" ")}
          >
            <Save size={16} />
            {saveState === "saved" ? "Saved" : saveState === "error" ? "Save Failed" : "Save Room Draft"}
          </button>
        </aside>

        <section className={["min-h-[calc(100svh-116px)] overflow-hidden rounded-[8px] border shadow-[0_30px_90px_rgba(0,0,0,0.34)]", palette.shell].join(" ")} style={{ borderColor: "var(--theme-border)" }}>
          <div className="grid min-h-[calc(100svh-116px)] grid-rows-[minmax(420px,1fr)_auto]">
            <div className="relative min-h-[420px]">
              {viewMode === "room" ? (
                <div ref={mountRef} className="absolute inset-0" />
              ) : (
                <MuseumCampusOverview rooms={universeRooms} onOpenRoom={openUniverseRoom} onOpenMainHall={openMainHall} />
              )}
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <div className="pointer-events-none flex items-center gap-2 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur">
                  {viewMode === "room" ? <Sparkles size={14} /> : <MapIcon size={14} />}
                  {viewMode === "room" ? "VLTD Room" : "Universe Map"}
                </div>
                {viewMode === "room" ? (
                  <button
                    type="button"
                    onClick={() => setViewMode("overview")}
                    className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                    title="Exit to the campus map"
                  >
                    <MapIcon size={14} />
                    Exit
                  </button>
                ) : null}
                {viewMode === "room" && universeRooms.some((room) => room.items.length > 0) ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRoomSwitcherOpen((current) => !current)}
                      aria-expanded={roomSwitcherOpen}
                      className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                      title="Jump to another room"
                    >
                      <DoorOpen size={14} />
                      Rooms
                      <ChevronDown size={13} />
                    </button>
                    {roomSwitcherOpen ? (
                      <div className="absolute left-0 top-[calc(100%+6px)] z-20 grid max-h-[280px] w-52 gap-1 overflow-y-auto rounded-[8px] bg-black/85 p-1.5 ring-1 ring-white/15 backdrop-blur">
                        {universeRooms
                          .filter((room) => room.items.length > 0)
                          .map((room) => (
                            <button
                              key={room.id}
                              type="button"
                              onClick={() => {
                                openUniverseRoom(room);
                                setRoomSwitcherOpen(false);
                              }}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[5px] px-2.5 py-2 text-left text-xs font-bold text-white/85 transition hover:bg-white/10 hover:text-white"
                            >
                              <span className="truncate">{room.title}</span>
                              <span className="text-[10px] font-black text-white/45">{room.items.length} pcs</span>
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {viewMode === "room" && selectedItems.length === 0 && !hallNoticeDismissed ? (
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <div className="pointer-events-auto relative rounded-[10px] bg-black/38 px-6 py-5 ring-1 ring-white/12 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setHallNoticeDismissed(true)}
                      aria-label="Dismiss"
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-[5px] bg-white/10 text-white/70 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
                    >
                      ✕
                    </button>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100/60">
                      Grand Hall
                    </div>
                    <div className="mt-2 text-xl font-black tracking-normal text-white sm:text-2xl">
                      Exhibitions coming soon
                    </div>
                    <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-white/60">
                      This hall is reserved for future exhibitions. Pick items in the
                      Items panel to start filling it.
                    </p>
                  </div>
                </div>
              ) : null}
              {viewMode === "room" ? <FloorMoveControls onMove={sendMoveCommand} /> : null}
            </div>

            <div className="border-t bg-black/32 p-4 backdrop-blur" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              {selectedItem ? (
                <div className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)_auto] md:items-center">
                  <div className="h-[110px] overflow-hidden rounded-[6px] bg-black/20 ring-1 ring-white/10">
                    {itemImage(selectedItem) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemImage(selectedItem)} alt={selectedItem.title} className="h-full w-full object-cover" draggable={false} />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                      Selected Piece
                    </div>
                    <h2 className="mt-1 truncate text-2xl font-black tracking-normal text-white">
                      {selectedItem.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/68">
                      {itemSubtitle(selectedItem) || selectedItem.notes || selectedItem.universe || "Collection piece"}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:min-w-[220px]">
                    <Metric icon={<BadgeDollarSign size={15} />} label="Value" value={formatMoney(selectedItem.currentValue) || "$0"} inverse />
                    <Metric icon={<Boxes size={15} />} label="Universe" value={String(selectedItem.universe || selectedItem.category || "Item")} inverse />
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-white/60">
                  {viewMode === "room" ? "Waiting for exhibitions — add items to fill this hall." : "Add items to build the room."}
                </div>
              )}
            </div>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}

function ControlPanel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[8px] border bg-[color:var(--theme-card)] p-2.5 shadow-[var(--shadow-soft)]" style={{ borderColor: "var(--theme-border)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--muted2)]">
          {icon}
          {title}
        </div>
        {action}
      </div>
      <div className="grid gap-1.5">{children}</div>
    </section>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="grid h-6 rounded-[5px] bg-[color:var(--input)] p-0.5 ring-1 ring-[color:var(--border)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={[
            "rounded-[4px] px-1 text-[10px] font-black leading-none transition",
            optionValue === value
              ? "bg-[rgba(79,211,238,0.18)] text-[#67E8F9] shadow-[0_0_12px_rgba(79,211,238,0.16)]"
              : "text-[color:var(--muted)]",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const CAMPUS_GRID_AREAS =
  '"rotN main main main dgal dgal" ' +
  '"rotS main main main egal egal" ' +
  '"galA main main main garden garden" ' +
  '"galA galC galF galG garden garden"';

function MuseumCampusOverview({
  rooms,
  onOpenRoom,
  onOpenMainHall,
}: {
  rooms: MuseumUniverseRoom[];
  onOpenRoom: (room: MuseumUniverseRoom) => void;
  onOpenMainHall: () => void;
}) {
  const featuredRooms = rooms.slice(0, 9);
  const totalItems = rooms.reduce((sum, room) => sum + room.items.length, 0);
  const totalValue = rooms.reduce((sum, room) => sum + room.value, 0);
  const paddedRooms = [
    ...featuredRooms,
    ...Array.from({ length: Math.max(0, 9 - featuredRooms.length) }, (_, index) => ({
      id: `future-${index}`,
      title: ["Automobile", "Cards", "Comics", "Music", "Art", "Cinema", "Games", "Vault", "Exotics"][index] ?? "Future",
      items: [],
      value: 0,
      tier: index > 4 ? "Hall" : "Starter",
      wing: index % 4 === 0 ? "North" : index % 4 === 1 ? "South" : index % 4 === 2 ? "Main" : "Garden",
    } satisfies MuseumUniverseRoom)),
  ];

  return (
    <div className="absolute inset-0 overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(79,211,238,0.10),transparent_30%),linear-gradient(180deg,#12151a,#07090d)] p-4 pt-16 text-white">
      <div className="mx-auto grid min-h-full max-w-[1180px] gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-white/10 bg-[#0b0e12] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="h-full overflow-x-auto overflow-y-hidden p-3 sm:p-4">
            <div className="min-w-[640px]">
              <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span className="inline-flex w-fit items-center rounded-[6px] border border-amber-200/20 bg-amber-300/8 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/72">
                  Store
                </span>
                <span className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
                  VLTD Museum Campus
                </span>
                <span className="ml-auto inline-flex w-fit items-center rounded-[6px] border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  Elevator
                </span>
              </div>

              <div
                className="grid gap-2.5 sm:gap-3"
                style={{
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(4, minmax(80px, 1fr))",
                  gridTemplateAreas: CAMPUS_GRID_AREAS,
                }}
              >
                <CampusRoomButton room={paddedRooms[0]} onOpenRoom={onOpenRoom} label="North Rotunda" area="rotN" size="sm" />
                <CampusRoomButton room={paddedRooms[1]} onOpenRoom={onOpenRoom} label="South Rotunda" area="rotS" size="sm" />
                <CampusRoomButton room={paddedRooms[2]} onOpenRoom={onOpenRoom} label="Gallery A" area="galA" size="md" />
                <CampusRoomButton room={paddedRooms[3]} onOpenRoom={onOpenRoom} label="Gallery C" area="galC" size="sm" />
                <CampusRoomButton room={paddedRooms[4]} onOpenRoom={onOpenRoom} label="Gallery F" area="galF" size="sm" />
                <CampusRoomButton room={paddedRooms[5]} onOpenRoom={onOpenRoom} label="Gallery D" area="dgal" size="sm" />
                <CampusRoomButton room={paddedRooms[6]} onOpenRoom={onOpenRoom} label="Gallery E" area="egal" size="sm" />
                <CampusRoomButton room={paddedRooms[8]} onOpenRoom={onOpenRoom} label="Gallery G" area="galG" size="sm" />
                <CampusRoomButton room={paddedRooms[7]} onOpenRoom={onOpenRoom} label="Garden Gallery" area="garden" size="lg" />

                <button
                  type="button"
                  style={{ gridArea: "main" }}
                  onClick={onOpenMainHall}
                  className="grid min-w-0 place-items-center rounded-[10px] border border-cyan-200/22 bg-[linear-gradient(180deg,rgba(79,211,238,0.12),rgba(255,255,255,0.03))] p-4 text-center shadow-[0_0_30px_rgba(79,211,238,0.08)] transition hover:border-cyan-200/42 hover:bg-cyan-300/10"
                >
                  <span className="flex flex-col items-center justify-center">
                    <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-black/28 ring-1 ring-white/12">
                      <Landmark size={24} />
                    </span>
                    <span className="mt-3 block text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60">
                      Main Gallery
                    </span>
                    <span className="mt-1.5 block text-2xl sm:text-3xl font-black tracking-normal">VLTD Museum</span>
                    <span className="mt-1.5 block text-xs sm:text-sm font-semibold text-white/55">
                      Grand hall - exhibitions coming soon
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                <DoorOpen size={16} />
                Entrance
              </div>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-[8px] border border-white/10 bg-black/24 p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/42">
              <MapIcon size={15} />
              Floorplan
            </div>
            <h2 className="mt-2 text-xl font-black tracking-normal">Universe Rooms</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric icon={<Boxes size={15} />} label="Vault Pieces" value={String(totalItems)} inverse />
              <Metric icon={<BadgeDollarSign size={15} />} label="Vault Value" value={totalValue > 0 ? `$${formatCompactNumber(totalValue)}` : "$0"} inverse />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[8px] border border-white/10 bg-black/24 p-2">
            <button type="button" className="rounded-[6px] bg-cyan-300/14 px-2 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/22">Overview</button>
            <button type="button" className="rounded-[6px] bg-white/6 px-2 py-2 text-xs font-black text-white/54 ring-1 ring-white/8">Rooms</button>
            <button type="button" className="rounded-[6px] bg-white/6 px-2 py-2 text-xs font-black text-white/54 ring-1 ring-white/8">Public</button>
          </div>

          {rooms.slice(0, 6).map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => onOpenRoom(room)}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-cyan-200/36 hover:bg-cyan-300/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{room.title}</span>
                <span className="mt-0.5 block text-xs font-semibold text-white/48">
                  {room.items.length} items - {room.tier} - {room.wing}
                </span>
              </span>
              <ExternalLink size={16} className="text-white/46" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const CAMPUS_ROOM_SIZING = {
  sm: {
    icon: 13,
    box: "h-6 w-6 rounded-[5px]",
    label: "text-[8px]",
    title: "text-xs",
    pad: "p-2",
    pillGap: "mt-1.5 gap-1",
    pill: "rounded-[4px] px-1.5 py-0.5 text-[8px]",
  },
  md: {
    icon: 15,
    box: "h-7 w-7 rounded-[6px]",
    label: "text-[9px]",
    title: "text-sm",
    pad: "p-2.5",
    pillGap: "mt-2 gap-1.5",
    pill: "rounded-[5px] px-1.5 py-1 text-[9px]",
  },
  lg: {
    icon: 18,
    box: "h-8 w-8 rounded-[7px]",
    label: "text-[10px]",
    title: "text-base",
    pad: "p-3",
    pillGap: "mt-2.5 gap-2",
    pill: "rounded-[5px] px-2 py-1 text-[10px]",
  },
} as const;

function CampusRoomButton({
  room,
  onOpenRoom,
  label,
  area,
  size = "sm",
}: {
  room: MuseumUniverseRoom;
  onOpenRoom: (room: MuseumUniverseRoom) => void;
  label: string;
  area: string;
  size?: keyof typeof CAMPUS_ROOM_SIZING;
}) {
  const disabled = room.items.length === 0;
  const sizing = CAMPUS_ROOM_SIZING[size];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onOpenRoom(room)}
      style={{ gridArea: area }}
      className={[
        "min-w-0 overflow-hidden rounded-[8px] border text-left transition",
        sizing.pad,
        disabled
          ? "border-white/6 bg-black/20 text-white/25"
          : "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] text-white hover:border-cyan-200/40 hover:bg-cyan-300/10",
      ].join(" ")}
    >
      <span className="flex h-full flex-col justify-between">
        <span className="min-w-0">
          <span className={["inline-flex items-center justify-center bg-black/24 ring-1 ring-white/10", sizing.box].join(" ")}>
            {room.tier === "Hall" ? <CircleDollarSign size={sizing.icon} /> : <Landmark size={sizing.icon} />}
          </span>
          <span className={["mt-1.5 block truncate font-black uppercase tracking-[0.1em] text-white/34", sizing.label].join(" ")}>
            {label}
          </span>
          <span className={["mt-0.5 block truncate font-black tracking-normal", sizing.title].join(" ")}>{room.title}</span>
        </span>
        <span className={["flex flex-wrap font-black", sizing.pillGap].join(" ")}>
          <span className={["bg-black/22 ring-1 ring-white/8", sizing.pill].join(" ")}>{room.items.length} pcs</span>
          <span className={["bg-black/22 ring-1 ring-white/8", sizing.pill].join(" ")}>{room.tier}</span>
        </span>
      </span>
    </button>
  );
}

function FloorMoveControls({
  onMove,
}: {
  onMove: (command: string, amount?: number) => void;
}) {
  return (
    <div className="absolute bottom-5 left-1/2 z-20 grid -translate-x-1/2 gap-1.5 rounded-[8px] bg-black/34 p-2 ring-1 ring-white/12 backdrop-blur-md">
      <div className="grid grid-cols-5 gap-1.5">
        <span />
        <button
          type="button"
          onClick={() => onMove("turn-left")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-white/8 text-white/78 ring-1 ring-white/12 transition hover:bg-white/14"
          aria-label="Turn left"
          title="Turn left"
        >
          <RotateCcw size={17} />
        </button>
        <button
          type="button"
          onClick={() => onMove("forward")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-cyan-300/18 text-cyan-100 ring-1 ring-cyan-200/24 transition hover:bg-cyan-300/26"
          aria-label="Move forward"
          title="Move forward"
        >
          <ChevronUp size={20} />
        </button>
        <button
          type="button"
          onClick={() => onMove("turn-right")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-white/8 text-white/78 ring-1 ring-white/12 transition hover:bg-white/14"
          aria-label="Turn right"
          title="Turn right"
        >
          <RotateCw size={17} />
        </button>
        <span />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => onMove("left")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-white/8 text-white/78 ring-1 ring-white/12 transition hover:bg-white/14"
          aria-label="Move left"
          title="Move left"
        >
          <ChevronLeft size={20} />
        </button>
        <span />
        <button
          type="button"
          onClick={() => onMove("back")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-white/8 text-white/78 ring-1 ring-white/12 transition hover:bg-white/14"
          aria-label="Move back"
          title="Move back"
        >
          <ChevronDown size={20} />
        </button>
        <span />
        <button
          type="button"
          onClick={() => onMove("right")}
          className="grid h-9 w-9 place-items-center rounded-[6px] bg-white/8 text-white/78 ring-1 ring-white/12 transition hover:bg-white/14"
          aria-label="Move right"
          title="Move right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  inverse = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  inverse?: boolean;
}) {
  return (
    <div className={["rounded-[6px] p-2 ring-1", inverse ? "bg-white/7 ring-white/12" : "bg-[color:var(--input)] ring-[color:var(--border)]"].join(" ")}>
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--muted2)]">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-black">{value}</div>
    </div>
  );
}
