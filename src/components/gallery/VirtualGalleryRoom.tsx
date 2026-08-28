"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BadgeDollarSign,
  Boxes,
  ChevronDown,
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
  Pencil,
  Plus,
  Save,
  Share2,
  Sparkles,
} from "lucide-react";
import * as THREE from "three";

import {
  addItemIdsToGallery,
  getGallerySections,
  loadGalleries,
  type Gallery,
} from "@/lib/galleryModel";
import {
  createHall,
  listMyHalls,
  updateHall,
  uploadHallWallpaper,
  type VirtualRoomRow,
} from "@/lib/virtualRooms";
import { getPrimaryImageUrl, loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import SocialExportSheet from "@/components/SocialExportSheet";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The app's real theme blue — same tone/text pairing as the "Save Room
// Draft" button's own gradient (`#79E7FB`→`#2CB1D1`) and dark text
// (`#06171d`), not a guessed hex. Used for the held-item spine label.
const THEME_BLUE = "#79E7FB";
const THEME_BLUE_TEXT = "#06171d";

// "blue" is the original hand-coded room (navy walls, brass door frame,
// walnut floor) that used to BE the Vault look before the GLB pipeline —
// it never loads a .glb, it's the fallback shell shown permanently. See
// HANDOFF.md "Room styles" for the full vault/whitebox/arcade/blue map.
type RoomStyle = "vault" | "whitebox" | "arcade" | "blue";
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
  wall: "back" | "left" | "right" | "front" | "center" | "cabinet";
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
// EK: "finish and renumber the wall spaces, there are many not filled" —
// real gap, confirmed against the room generator script
// (scripts/generate-gallery-room-models.py): the shelf boards are single
// continuous planks with no baked physical dividers, so "8 columns x 3
// rows = 24" for the back wall is a placement CONVENTION already coded
// in wallGridPosition, not a hard limit — but the OLD MAX_ROOM_ITEMS=32
// budget (minus 8 for the vault style's front/door wall) only left 24
// "main wall" slots total for back+left+right COMBINED, so the 2:1:1
// WALL_CYCLE ratio gave back only 12 of its own real 24 positions, and
// left/right only 6 each (2 of their own real depth-steps) — the other
// 12 back-wall positions and the deeper side-wall rows never got a
// slot index at all, which is exactly the badge-less gaps EK circled.
// Raised to fit BACK_WALL_CAPACITY (24) + SIDE_WALL_CAPACITY for both
// sides, plus the vault style's existing 8-slot front/door wall.
const BACK_WALL_CAPACITY = 24;
// EK's ask (2026-08-23, 4th time raised) — side-wall items sat much
// farther apart than back-wall items AND stopped well short of the far
// corner, wasting real shelf length. Root cause: the 12-slot side-wall
// capacity (4 depth-steps x 3 rows) was never sized against the wall's
// own real length — the old "4 depth-steps" comment only checked that
// its deepest point (z=-0.25) stayed clear of an unrelated feature
// (the vault style's own front/door-wall row at z=5.54), not how much
// of the actual side shelf that left unused. Read the real numbers from
// the room generator instead of guessing again:
//   left_shelf_i / right_shelf_i: depth 23.2, centered z=-3.15
//     -> real board spans z in [-14.75, 8.45]
//     (scripts/generate-gallery-room-models.py add_wall_panels(); the
//     procedural whitebox/arcade shelves in this file's own
//     addSideRowBoard use the identical -14.75..8.45 span, so this
//     applies to every room style, not just the baked vault GLB)
//   back_corner_post_x: (1.3, 9.15, 1.3) centered z=-11.87
//     -> forward face at z=-11.22; the back wall's own face sits at
//     z~=-12.17..-11.99, so nothing should be centered any closer to
//     the back corner than that post's forward face
//   front_wall_left/right (the door wall): depth 0.18, centered z=5.8
//     -> near face at z=5.71
// An item's own footprint along the wall (frame width 1.12*scale plus
// matting on both sides, at MIN_ITEM_SCALE=0.78) is ~0.975 wide, so a
// safe CENTER position needs ~0.49 clearance from either limit:
// SIDE_WALL_SAFE_BACK_Z (-10.5) sits comfortably past the corner post's
// -11.22 forward face; SIDE_WALL_SAFE_FRONT_Z (4.9) sits comfortably
// short of the door wall's 5.71 near face. Real safe usable run: 15.4.
// Back wall gets the same treatment: real back_shelf_i is 19.9 wide
// (half-width 9.95), but the back_corner_post_x pieces (half-width 0.65,
// centered x=+-10.36) put their inner face at x=+-9.71 — BACK_WALL_HALF_WIDTH
// (9.0) leaves the same ~0.49-unit item-footprint clearance from that,
// same math as the side walls above.
//
// With both walls' safe usable lengths now real numbers, side-wall
// capacity is raised from 12 to 21 (7 depth-steps x 3 rows, still
// SHELF_ROW_Y.length rows) so its density can actually MATCH the back
// wall's instead of being forced sparser by too few slots for the same
// real length — see BACK_WALL_COL_STEP / SIDE_WALL_STEP below, both
// independently computed from these same safe bounds and landing within
// 0.01 units of each other, not hand-tuned to match.
const BACK_WALL_HALF_WIDTH = 9.0;
const BACK_WALL_COL_STEP = (BACK_WALL_HALF_WIDTH * 2) / 7; // 8 columns, 7 gaps
const SIDE_WALL_SAFE_BACK_Z = -10.5;
const SIDE_WALL_SAFE_FRONT_Z = 4.9;
const SIDE_WALL_DEPTH_COUNT = 7;
const SIDE_WALL_STEP =
  (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z) / (SIDE_WALL_DEPTH_COUNT - 1); // full safe range, 6 gaps
const SIDE_WALL_CAPACITY = SIDE_WALL_DEPTH_COUNT * 3; // 3 = SHELF_ROW_Y.length, fixed elsewhere below
const MAX_ROOM_ITEMS = BACK_WALL_CAPACITY + SIDE_WALL_CAPACITY * 2 + 8;
// "blue" has no entry — it's the hand-coded shell shown permanently, with
// no GLB to load at all. See the RoomStyle type above for what that means.
const ROOM_MODEL_URLS: Partial<Record<RoomStyle, string>> = {
  vault: "/models/gallery-rooms/vault-room.glb?v=shelf-headroom-2026-08-22",
  whitebox: "/models/gallery-rooms/whitebox-room.glb?v=off-white-not-tan-2026-08-22",
  arcade: "/models/gallery-rooms/arcade-room.glb?v=shelf-headroom-2026-08-22",
};

// The 5 center display cases (built further down as decorative glass cabinets)
// are also real, numbered, assignable slots — appended after the wall slots.
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
    notes: "Foil-cover variant, hand-signed by the cover artist at a convention signing. Limited print run, slabbed and graded shortly after release.",
  },
  {
    id: "demo-card",
    title: "Rookie Parallel",
    subtitle: "Graded 10",
    universe: "Sports",
    category: "Trading Cards",
    currentValue: 1850,
    imageFrontUrl: "/collectibles/sports-slab.png",
    notes: "Rookie-year parallel, numbered print run. Graded a perfect 10 with sharp corners and centering.",
  },
  {
    id: "demo-record",
    title: "First Press Vinyl",
    subtitle: "Near mint sleeve",
    universe: "Music",
    category: "Vinyl",
    currentValue: 260,
    imageFrontUrl: "/collectibles/vinyl-record.png",
    notes: "Original first pressing on the original label. Sleeve shows light shelf wear; the record itself plays near mint.",
  },
  {
    id: "demo-figure",
    title: "Designer Figure",
    subtitle: "Artist proof",
    universe: "Pop Culture",
    category: "Figures",
    currentValue: 700,
    imageFrontUrl: "/collectibles/vinyl-figure.png",
    notes: "Artist-proof edition, hand-numbered on the base. Never removed from its display stand.",
  },
  {
    id: "demo-poster",
    title: "Theater One Sheet",
    subtitle: "Linen backed",
    universe: "Film",
    category: "Poster",
    currentValue: 540,
    imageFrontUrl: "/collectibles/movie-poster.png",
    notes: "Original theatrical one-sheet from the film's release run. Professionally linen-backed for display.",
  },
  {
    id: "demo-guitar",
    title: "Tour Guitar",
    subtitle: "Stage-played",
    universe: "Music",
    category: "Instruments",
    currentValue: 3200,
    imageFrontUrl: "/collectibles/guitar.png",
    notes: "Played on tour, with visible fret wear and a repaired headstock crack. Comes with a signed certificate of authenticity.",
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

function itemImage(item: VaultItem) {
  return getPrimaryImageUrl(item) || item.imageFrontUrl || item.imageBackUrl || "";
}

// Same universe order + short labels as the Vault's "Wall" view
// (VaultWallView.tsx) — the "+" picker below is built to match that view's
// search/filter/A-Z browsing UX exactly, per EK's ask.
const PICKER_UNIVERSE_ORDER: UniverseKey[] = [
  "POP_CULTURE", "SPORTS", "TCG", "MUSIC",
  "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "ART", "AUTOMOTIVE", "MISC",
];
const PICKER_SHORT_LABEL: Record<UniverseKey, string> = {
  POP_CULTURE:     "Pop Culture",
  SPORTS:          "Sports",
  TCG:             "TCG",
  MUSIC:           "Music",
  JEWELRY_APPAREL: "Jewelry",
  GAMES:           "Games",
  BUILT_BOTANY:    "Botany",
  MISC:            "Misc",
  AUTOMOTIVE:      "Auto",
  ART:             "Art",
};
const PICKER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function inferPickerUniverse(item: VaultItem): UniverseKey {
  const raw = typeof item.universe === "string" ? item.universe.trim().toUpperCase() : "";
  if (raw && UNIVERSE_LABEL[raw as UniverseKey]) return raw as UniverseKey;
  return "MISC";
}

function pickerSearchText(item: VaultItem) {
  return [item.title, item.subtitle, item.number, item.grade, item.notes, item.category, item.universe]
    .filter(Boolean).join(" ").toLowerCase();
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

function drawItemTexture(image?: HTMLImageElement | null) {
  // EK, 2026-08-21, direct screenshot comparison against bingebrowse.net's
  // held-item view: theirs is the poster/cover art edge-to-edge, ZERO text
  // baked into the object itself — title/synopsis/price all live in panels
  // OUTSIDE the object. Ours used to reserve a 400x440 image box inside a
  // 512x704 canvas (the photo was only ~48% of the object's own area) plus
  // a permanent 134px dark footer for title/subtitle/price — that footer,
  // not the overall card scale, was the dominant reason our images read
  // smaller even after the scale-floor fix. The photo now fills the canvas
  // nearly edge-to-edge (a thin border only, no reserved text band); title/
  // value/universe are NOT redrawn onto the object — that data already
  // renders in the "Selected Piece" panel on click, so nothing is lost,
  // only de-duplicated off the picture itself.
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
  ctx.strokeRect(10, 10, 492, 684);

  const imageBox = { x: 22, y: 22, w: 468, h: 660 };
  if (image?.complete && image.naturalWidth > 0) {
    // Fit-inside, not cover-crop: a card/comic/slab photo's own border IS
    // real content (the graded slab's label, the case corners) — cropping
    // to fill cuts it off. BingeBrowse can crop-to-fill because movie
    // poster art is drawn full-bleed with nothing at the edges to lose;
    // our photos aren't. The image box is still ~86% of the object's own
    // area (was ~49%), so this is still a big legibility win, just without
    // chopping anything off.
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
    ctx.fillRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h);
    ctx.fillStyle = "rgba(237,239,241,0.75)";
    ctx.font = "700 46px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VLTD", 256, 352);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// EK's ask: the sides of a held item should be theme blue with the title
// and universe printed on them, like a book/case spine. Tall, narrow
// canvas (matches the actual side face's real proportions); text is drawn
// rotated so it reads top-to-bottom along the long edge.
function drawSpineTexture(title: string, universe?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  // EK: "this color does not match the button color" — a flat fill
  // rendered with scene lighting/tone-mapping never looks like the same
  // hex value shown in a plain CSS button (PBR shading + the room's own
  // exposure both shift it). Two fixes: (1) draw the button's ACTUAL
  // gradient (linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)), not
  // a flat approximation of just its lighter stop, and (2) the material
  // built from this texture (below) is unlit + toneMapped:false, so it
  // renders these exact pixel values instead of being reshaded by the
  // room's lights.
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#79E7FB");
  grd.addColorStop(0.55, "#41C6E4");
  grd.addColorStop(1, "#2CB1D1");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = THEME_BLUE_TEXT;
  ctx.font = "bold 46px Arial";
  ctx.fillText(title.slice(0, 40), 0, universe ? -18 : 0);
  if (universe) {
    ctx.font = "34px Arial";
    ctx.fillStyle = "rgba(6,23,29,0.7)";
    ctx.fillText(universe.toUpperCase(), 0, 32);
  }
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
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
  // "Blue" reuses the Vault hand-coded palette exactly — it's the same
  // room, the only difference is Blue never swaps to the GLB overlay.
  if (style === "blue") return getRoomPalette("vault");
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
// the back wall's own full grid is already used up (which left a small collection's
// side walls bare while the back wall did all the work).
const WALL_CYCLE: Array<"back" | "left" | "right"> = ["back", "left", "back", "right"];

// The physical shelf boards (built further down, same 4 heights) and every item's
// vertical position both read from this one table — they used to be two separately
// hand-tuned numbers (4.72 for the boards, 5.42/4.75 for items) that drifted out of
// sync, so items floated well above their shelf instead of resting on it.
//
// EK's ask (2026-08-21), corrected TWICE same day:
// 1st pass shifted all 4 rows down to sit near a "fixed" eyeHeight of 1.7
// — wrong on two counts: the eyeHeight change itself was based on a bad
// unit assumption and got reverted (see eyeHeight's own comment), and
// shifting the whole band down put a row right near the floor, which EK
// had explicitly said not to do ("I don't want a row on the floor like
// [bingebrowse.net] do[es]").
// 2nd pass cut to 3 rows and re-centered around the (still-wrong) 1.7 —
// same mistake, different shape.
// Corrected: back to the ORIGINAL 4-row heights — [4.72, 3.47, 2.22,
// 0.97] — with the genuinely-too-low bottom row (0.97) simply dropped,
// not the whole band reshuffled. The top 3 rows were never the problem;
// only the bottom one was. With eyeHeight reverted to 3.6, these 3 rows
// land close to evenly split around eye level (top row ~1.8 above eye,
// bottom row ~0.7 below) — no new number invented, just the one bad row
// removed.
//
// EK's ask (2026-08-21), a 4th correction: the 1.25 spacing above was
// exactly the item card's own height at MIN_ITEM_SCALE=0.78 (1.2 units)
// plus the board's half-thickness (0.05) — zero headroom, so an item's
// own top edge sat flush against the shelf board mounted above it,
// visibly clipping into it. EK: "do not change the size of the items"
// — so the fix is spacing, not scale. Top row (4.72) is untouched — it
// only needs clearance to the wall rail well above it. Middle and bottom
// rows moved down to open a real ~0.25-unit gap above every item:
// 1.5 spacing instead of 1.25 (3.47 -> 3.22, 2.22 -> 1.72).
//
// ⚠ These values are duplicated in scripts/generate-gallery-room-models.py
// (`shelf_y`, in add_wall_panels()) for the baked GLB's own shelf-board
// mesh positions — vault/whitebox/arcade need that regenerated to match, or
// items float off the physical shelf again (same bug as the display-case
// fix earlier this session). Kept in sync as part of this change — see
// HANDOFF for the exact regen command if it needs re-running.
const SHELF_ROW_Y = [4.72, 3.22, 1.72];

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
    // Was `Math.floor(slot / 8)` with an implicit assumption of exactly 4
    // rows — silently correct only because the array happened to have 4
    // entries. Deriving the row count from SHELF_ROW_Y.length instead
    // means changing the row count again later can't silently desync this
    // from the array the way the hardcoded "4" below already had to be
    // caught and fixed just now.
    const row = Math.floor(slot / 8) % SHELF_ROW_Y.length;
    return {
      x: -BACK_WALL_HALF_WIDTH + col * BACK_WALL_COL_STEP,
      y: shelfItemY(row, config.backScale),
      z: config.backZ,
      ry: 0,
      scale: config.backScale,
      wall: "back",
    };
  }

  const row = slot % SHELF_ROW_Y.length;
  const depth = Math.floor(slot / SHELF_ROW_Y.length);
  return {
    x: wall === "left" ? -10.22 : 10.22,
    y: shelfItemY(row, config.sideScale),
    z: config.sideBaseZ + depth * config.sideZStep,
    ry: wall === "left" ? Math.PI / 2 : -Math.PI / 2,
    scale: config.sideScale,
    wall,
  };
}

function rowForWallSlot(wall: "back" | "left" | "right", slot: number): number {
  if (wall === "back") return Math.floor(slot / 8) % SHELF_ROW_Y.length;
  return slot % SHELF_ROW_Y.length;
}

function distributeAcrossWalls(
  count: number,
  config: { backZ: number; backScale: number; sideBaseZ: number; sideZStep: number; sideScale: number },
  // Hero (spotlight layout) reserves its own row on whichever wall it sits
  // on — a regular grid slot landing in that same row can sit close enough
  // in depth to visually overlap Hero's much larger frame. EK caught this
  // live: "you have an extra one behind it on each wall, this causes a
  // conflict." Skipping the whole forbidden row on that wall (rather than
  // dodging Hero's exact footprint by distance) is simple to reason about
  // and can't be miscalculated the way a narrow exclusion zone could.
  excludeRow: Partial<Record<"back" | "left" | "right", number>> = {}
): RoomItemPosition[] {
  // Keeps the WALL_CYCLE's early-spread behavior (see its own comment —
  // a small collection gets presence on every wall right away, not just
  // the back wall) while ALSO making sure every wall's own full capacity
  // eventually gets a real slot once `count` is big enough to reach it —
  // the previous version just cycled blindly and stopped at whatever
  // count/ratio math it landed on, which is what left the back wall's
  // own upper rows and the side walls' deeper rows with no slot index
  // at all (EK circled the exact gaps in a screenshot).
  const caps: Record<"back" | "left" | "right", number> = {
    back: BACK_WALL_CAPACITY,
    left: SIDE_WALL_CAPACITY,
    right: SIDE_WALL_CAPACITY,
  };
  const wallSlot: Record<"back" | "left" | "right", number> = { back: 0, left: 0, right: 0 };
  function nextValidSlot(wall: "back" | "left" | "right"): number {
    let slot = wallSlot[wall];
    const forbidden = excludeRow[wall];
    if (forbidden !== undefined) {
      while (slot < caps[wall] && rowForWallSlot(wall, slot) === forbidden) slot++;
    }
    return slot;
  }
  function hasRoom(wall: "back" | "left" | "right"): boolean {
    return nextValidSlot(wall) < caps[wall];
  }
  const positions: RoomItemPosition[] = [];
  let cycleIndex = 0;
  // `count` is always MAX_ROOM_ITEMS (or that minus the vault-only front
  // wall's 8) — for vault that exactly equals the 3 caps' sum, so this
  // never overflows in practice. Non-vault styles skip the front-wall
  // carve-out and pass the full MAX_ROOM_ITEMS straight through, which
  // DOES exceed the 3 caps' sum by exactly the front wall's 8 — rather
  // than under-fill the array (breaking the fixed-length contract every
  // caller relies on), any genuine overflow keeps cycling past each
  // wall's normal cap once every wall has reached it, spread evenly
  // rather than dumped on one wall.
  while (positions.length < count) {
    let wall = WALL_CYCLE[cycleIndex % WALL_CYCLE.length];
    let skipped = 0;
    const allAtCap = (["back", "left", "right"] as const).every((w) => !hasRoom(w));
    if (!allAtCap) {
      while (!hasRoom(wall) && skipped < WALL_CYCLE.length) {
        cycleIndex++;
        wall = WALL_CYCLE[cycleIndex % WALL_CYCLE.length];
        skipped++;
      }
    }
    const slot = nextValidSlot(wall);
    wallSlot[wall] = slot + 1;
    positions.push(wallGridPosition(wall, slot, config));
    cycleIndex++;
  }
  return positions;
}

// EK's ask (2026-08-21): checked bingebrowse.net's own source (their
// rental-case mesh is a real 0.235 x ~0.165 world-unit DVD case, viewed at
// a close ~1.2-1.4 unit aisle distance with a 58-75deg camera) against ours
// (47deg FOV) and found our items were legible in the *focused* click-in
// view but not at normal walking-past distance — Salon's old 0.52/0.58
// scale read as illegible exactly where EK flagged it. This is the floor:
// no wall item (Store or Salon) renders smaller than this scale, ever.
// Hero's dedicated feature slots (1.2, below) are explicitly allowed to
// exceed it — EK: "hero images we can do larger."
const MIN_ITEM_SCALE = 0.78;

function buildWallPositions(layout: RoomLayout, count: number): RoomItemPosition[] {
  if (layout === "spotlight") {
    // EK's redesign: one big feature piece per wall (back/left/right),
    // not one feature for the whole room with everything else sidelined —
    // that read as "one picture and not much else." First pass positioned
    // these pulled 0.55-2.45 units off the wall for presence — but the
    // frame mesh below stretches its own depth to reach the actual wall,
    // assuming items sit close to it (see the frameDepth comment further
    // down). Pulled that far off the wall, it stretched into a genuinely
    // deep box (EK: "now it's a huge box"), and because that box's depth
    // spans all the way back to the wall, it occupies the same space as
    // the shelf boards mounted there — which is what read as shelf rails
    // crossing in front of the picture. Fix: keep the hero flush with the
    // wall like a normal item (small, normal frame depth).
    //
    // EK's ask (2026-08-22/23), a real fix not a guess: was y=5.96, jammed
    // into the gap between the top shelf row and the wall rail — the math
    // says that gap (~1.23 units) is smaller than Hero's own frame height
    // at scale 1.2 (~2.0 units), so no Y value up there could ever fully
    // clear both boundaries; 5.96 was always going to read as "crammed in
    // above the shelf," not "centered." Moved to the SAME height as
    // shelfItemY's middle row (row 1) instead — reuses a position that's
    // already proven to have real clearance (regular items sit there on
    // every other layout without incident), and lands much closer to eye
    // level (deviation from eyeHeight=3.6 drops from +2.36 to +0.594).
    // Vertically it now spans slightly past where row-0/row-2 items would
    // sit at this same x — that's fine, x=0/±10.22 sit BETWEEN the regular
    // grid's own column positions (columns are at -BACK_WALL_HALF_WIDTH +
    // col*BACK_WALL_COL_STEP, i.e. -9..9 in steps of ~2.57 — 0 and ±10.22
    // are never one of them), so nothing is ever placed there for Hero to
    // actually collide with.
    const HERO_Y = shelfItemY(1, 1.2); // the middle shelf row's own height, at hero scale — see comment above
    const allHeroSlots: RoomItemPosition[] = [
      { x: 0, y: HERO_Y, z: -11.78, ry: 0, scale: 1.2, wall: "back" },
      { x: -10.22, y: HERO_Y, z: -3.2, ry: Math.PI / 2, scale: 1.2, wall: "left" },
      { x: 10.22, y: HERO_Y, z: -3.2, ry: -Math.PI / 2, scale: 1.2, wall: "right" },
    ];
    const heroSlots = allHeroSlots.slice(0, count);
    const remaining = Math.max(0, count - heroSlots.length);
    // Medium density (unchanged design intent — a step between Salon's
    // tight cluster and Store's full-width spread) — but now explicitly
    // CENTERED within the real safe range (SIDE_WALL_SAFE_BACK_Z ..
    // SIDE_WALL_SAFE_FRONT_Z) instead of starting flush at an old,
    // ungeometry-checked -9.25, so the unused slack lands evenly on both
    // ends rather than looking lopsided toward one corner.
    const spotlightClusterSpan = 2.1 * (SIDE_WALL_DEPTH_COUNT - 1);
    const spotlightBaseZ =
      SIDE_WALL_SAFE_BACK_Z + (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z - spotlightClusterSpan) / 2;
    // Only left/right need the reservation — back-wall Hero sits at x=0,
    // which never lands on a back-wall column (columns run -9..9 in steps
    // of BACK_WALL_COL_STEP, an even split with no column at the exact
    // midpoint), so nothing is ever placed there to collide with. Left/
    // right Hero sits at a FIXED x (every item on that wall shares the
    // same x — only row/depth vary), so its own row must stay reserved.
    const heroWalls = new Set(heroSlots.map((slot) => slot.wall));
    const supportingExcludeRow: Partial<Record<"back" | "left" | "right", number>> = {};
    if (heroWalls.has("left")) supportingExcludeRow.left = 1;
    if (heroWalls.has("right")) supportingExcludeRow.right = 1;
    const supporting = distributeAcrossWalls(
      remaining,
      {
        backZ: -11.78,
        backScale: MIN_ITEM_SCALE,
        sideBaseZ: spotlightBaseZ,
        sideZStep: 2.1,
        sideScale: MIN_ITEM_SCALE,
      },
      supportingExcludeRow
    );
    return [...heroSlots, ...supporting];
  }

  if (layout === "salon") {
    // First darkening pass (0.48 scale, 1.55 step) still read as "the same
    // as Store" per EK — because with only a handful of items in a real
    // collection, tighter spacing along the wall barely shows (there
    // aren't enough items to even fill one row), so shrinking Salon was
    // the only thing that actually changed, and it just made pieces
    // harder to see rather than reading as "densely packed." A follow-up
    // pass brought scale back up but was still below MIN_ITEM_SCALE and
    // EK called it out again as illegible — Salon's item SIZE is now
    // locked to the same floor as Store; only the tight step (spacing)
    // differentiates the two, not size.
    //
    // EK's ask (2026-08-23, 4th time raised): sideBaseZ/sideZStep here
    // were picked without checking them against the wall's real length —
    // see the SIDE_WALL_* constants' own comment for the actual geometry.
    // Salon's tight 1.5 step is a deliberate, kept design choice (a small
    // collection reading as a dense little cluster rather than the same
    // spacing as Store just with less of it used) — what's fixed is that
    // the cluster is now explicitly CENTERED in the real safe range
    // instead of starting flush at an ungeometry-checked -9.6, so the
    // unused wall length splits evenly on both ends instead of piling up
    // on one side.
    return distributeAcrossWalls(count, {
      backZ: -11.82,
      backScale: MIN_ITEM_SCALE,
      sideBaseZ:
        SIDE_WALL_SAFE_BACK_Z +
        (SIDE_WALL_SAFE_FRONT_Z - SIDE_WALL_SAFE_BACK_Z - 1.5 * (SIDE_WALL_DEPTH_COUNT - 1)) / 2,
      sideZStep: 1.5,
      sideScale: MIN_ITEM_SCALE,
    });
  }

  // Store: pushed wider/bigger than before (was backScale 0.58, sideZStep
  // 2.35, sideScale 0.66) for real contrast against Salon's tight density
  // — a boutique, generously-spaced feel with fewer, larger pieces per
  // wall length, instead of two layouts occupying the same middle ground.
  //
  // EK's ask (2026-08-23, 4th time raised) — the real bug this session:
  // the old sideZStep (3.0) was picked without checking it against
  // either (a) the real usable side-wall length or (b) the back wall's
  // own column spacing, so side-wall items landed both MUCH farther
  // apart than back-wall items AND stopped a good ways short of the far
  // corner — both true at once, which is exactly what got circled twice.
  // SIDE_WALL_SAFE_BACK_Z/SIDE_WALL_STEP (see their own comment, real
  // numbers from the room generator) now span the entire real safe
  // side-wall run, at a step independently computed to land within 0.01
  // units of BACK_WALL_COL_STEP — Store's side walls now read at the
  // same density as its own back wall, using the real wall end to end.
  return distributeAcrossWalls(count, {
    backZ: -11.78,
    backScale: MIN_ITEM_SCALE,
    sideBaseZ: SIDE_WALL_SAFE_BACK_Z,
    sideZStep: SIDE_WALL_STEP,
    sideScale: MIN_ITEM_SCALE,
  });
}

function frontWallPosition(slot: number): RoomItemPosition {
  const positions = [
    { x: -6.6, y: 4.65 },
    { x: -4.65, y: 4.65 },
    { x: 4.65, y: 4.65 },
    { x: 6.6, y: 4.65 },
    { x: -6.6, y: 2.35 },
    { x: -4.65, y: 2.35 },
    { x: 4.65, y: 2.35 },
    { x: 6.6, y: 2.35 },
  ];
  const pos = positions[slot % positions.length];
  return {
    x: pos.x,
    y: pos.y,
    z: 5.54,
    ry: Math.PI,
    // Was 0.6, a leftover below MIN_ITEM_SCALE that patching the 3 main
    // wall configs missed — this front-wall row is a normal wall mount
    // like every other item, so it gets the same floor, no exception.
    scale: MIN_ITEM_SCALE,
    wall: "front",
  };
}

function buildVaultWallPositions(layout: RoomLayout, count: number): RoomItemPosition[] {
  if (layout === "spotlight") {
    return buildWallPositions(layout, count);
  }

  const frontSlotCount = Math.min(8, count);
  const mainWallCount = Math.max(0, count - frontSlotCount);
  return [
    ...buildWallPositions(layout, mainWallCount),
    ...Array.from({ length: frontSlotCount }, (_, index) => frontWallPosition(index)),
  ];
}

// Full fixed-capacity slot table for a layout: MAX_ROOM_ITEMS wall slots plus
// the CABINET_SLOT_COUNT display-case slots, always in this order — slot index
// is a stable identity regardless of layout or how many items are placed.
function buildPositions(layout: RoomLayout, style: RoomStyle): RoomItemPosition[] {
  const wallPositions =
    style === "vault" ? buildVaultWallPositions(layout, MAX_ROOM_ITEMS) : buildWallPositions(layout, MAX_ROOM_ITEMS);
  const cabinetPositions: RoomItemPosition[] = CABINET_SPOTS.map(([x, z]) => ({
    x,
    // Was 1.98 — the case's own glass cap sits at y=1.85 (base at 0.31,
    // glass spanning roughly 0.67 to 1.83), so the item was resting ON TOP
    // of the closed case, above the glass, not inside it at all — that's
    // what read as "a flat piece of paper just sitting there" instead of a
    // real display. 0.85 sits it just above the base, inside the glass.
    y: 0.85,
    z,
    ry: -Math.PI / 2,
    // Can't use MIN_ITEM_SCALE (0.78) here — this is a real physical
    // constraint, not a stylistic choice like the wall items were. The
    // case's own glass interior is baked at 1.3 x 1.0 world units
    // (add_cases() in generate-gallery-room-models.py); at 0.78 the card's
    // long edge (1.54 * 0.78 = 1.20) would clip straight through the glass
    // wall (1.0 clearance). 0.58 is the largest scale that still clears
    // the glass with a small margin (1.54 * 0.58 = 0.89 < 1.0). Reaching
    // true parity with wall items would mean enlarging the baked case
    // glass itself (a GLB regen) — flagged to EK, not done here.
    scale: 0.58,
    wall: "cabinet",
    flat: true,
  }));
  return [...wallPositions, ...cabinetPositions];
}

// EK's ask (2026-08-23): the builder had no concept of "who's looking" at
// all — anyone, signed in or not, owner or not, got the full edit chrome
// (Organize, Items, Save Draft) for whatever exhibition the SOURCE
// dropdown happened to load. Same local-profile pattern already used for
// this exact purpose elsewhere (GuestGalleryRenderer.tsx's own
// isOwner={Boolean(viewerProfileId) && ownerProfileId === viewerProfileId}) —
// not a new mechanism, the existing one just was never wired up here.
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export default function VirtualGalleryRoom({ guest = false }: { guest?: boolean } = {}) {
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
  // Real cloud-saved rooms ("Halls" in the UI) — EK's ask 2026-08-24, see
  // virtualRooms.ts. `currentHallId` is set once this room IS a saved Hall
  // (just created, or loaded from the "My Halls" group in Source) — while
  // set, Save quietly updates that same row instead of asking to name a
  // new one.
  const [halls, setHalls] = useState<VirtualRoomRow[]>([]);
  const [currentHallId, setCurrentHallId] = useState<string | null>(null);
  const [saveModal, setSaveModal] = useState<
    { step: "name" } | { step: "exhibition-choice"; galleryId: string; galleryTitle: string } | null
  >(null);
  const [hallNameInput, setHallNameInput] = useState("");
  const [isSavingHall, setIsSavingHall] = useState(false);
  // Held-item panel: a viewer clicking "View item" on a private (non-public)
  // item shows this inline notice instead of navigating anywhere.
  const [privateItemNotice, setPrivateItemNotice] = useState(false);
  // Same pattern as GuestGalleryRenderer.tsx's own viewerProfileId — read
  // once on mount, not tied to auth state changing mid-session (a profile
  // switch while this exact page is already open is a rare enough edge
  // case not worth the extra event-listener plumbing here).
  const [viewerProfileId, setViewerProfileId] = useState("");
  useEffect(() => {
    setViewerProfileId(getActiveProfileId());
  }, []);
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
  // EK's ask (2026-08-22/23): defaulted to the first demo item's id,
  // a leftover from when this fed the old "Selected Piece" sidebar panel
  // (removed 2026-08-21). Now it solely gates the "drag to rotate" hint
  // for a genuinely held item (see pickUpItem/putBackItem), so a
  // non-empty default made that hint show on page load with nothing
  // actually picked up.
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  // `selectedItemId` is deliberately NOT a dependency of the big mount
  // effect below (adding it would rebuild the entire 3D scene — camera
  // and all — every time an item's description opens/closes). That
  // means onPointerUp's closure only ever sees whatever selectedItemId
  // was at the LAST real rebuild, not the live value — a ref kept in
  // sync via this effect is how the "close it first" click-outside fix
  // reads the CURRENT value without adding selectedItemId to that
  // effect's deps.
  const selectedItemIdRef = useRef(selectedItemId);
  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);
  const [socialShareOpen, setSocialShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(true);
  const [hallNoticeDismissed, setHallNoticeDismissed] = useState(false);
  const [roomSwitcherOpen, setRoomSwitcherOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // EK's ask: an empty slot's "+" opens a picker built to match the Vault's
  // own "Wall" view (search + universe filter pills w/ counts + A-Z jump +
  // size slider — see VaultWallView.tsx). Multi-select fills the clicked
  // slot first, then the next empty slots in order. pickerSelection order
  // IS the fill order (append on select).
  const [pickerSlotIdx, setPickerSlotIdx] = useState<number | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerUniverses, setPickerUniverses] = useState<Set<UniverseKey>>(new Set());
  const [pickerCols, setPickerCols] = useState(6);
  const pickerLetterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function openSlotPicker(idx: number) {
    setPickerSlotIdx(idx);
    setPickerSelection([]);
    setPickerQuery("");
    setPickerUniverses(new Set());
  }

  function closeSlotPicker() {
    setPickerSlotIdx(null);
    setPickerSelection([]);
  }
  const touchFromRef = useRef<number | null>(null);
  const touchOverRef = useRef<number | null>(null);
  const touchCloneRef = useRef<HTMLElement | null>(null);

  // Separate from the vault-items/galleries mount effect below (those are
  // synchronous local-cache reads; this is a real network round trip) —
  // populates the Source dropdown's "My Halls" group.
  useEffect(() => {
    void listMyHalls().then(setHalls);
  }, []);

  useEffect(() => {
    const vaultItems = loadItems();
    const galleryList = loadGalleries();

    setGalleries(galleryList);
    if (vaultItems.length > 0) {
      setItems(vaultItems);
      setSelectedIds(fillSlots(vaultItems.slice(0, 12).map((item) => item.id)));
      // No auto-selected/held item on load — see the draft-restore block's
      // own comment further down for the full reasoning.
    }

    // EK's ask: "why do i not have access to my real items?" — `loadItems()`
    // above only reads whatever's ALREADY cached in this browser's local
    // storage; it never talks to Supabase. The real /vault page's own
    // hydrateAll() does exactly this same instant local render first, then
    // calls `syncVaultItemsFromSupabase()` to actually fetch the real cloud
    // vault and merge it in — this effect was only ever doing the first
    // half, so a browser/origin with nothing cached yet (this local dev
    // server is its own separate origin from the deployed site, with its
    // own empty localStorage) fell straight through to the hardcoded
    // DEMO_ITEMS fallback and stayed there.
    // `draftAppliedSelectedIds` is set below, synchronously, before this
    // promise's `.then()` ever gets a chance to run — a saved draft's own
    // layout should win over auto-placing the newly-synced real items.
    let draftAppliedSelectedIds = false;
    void syncVaultItemsFromSupabase().then((syncedItems) => {
      if (syncedItems.length === 0) return;
      setItems(syncedItems);
      // The synchronous load above only had DEMO_ITEMS to work with (cold
      // cache) and no draft restored its own layout — safe to plant the
      // room with the user's real items now, the same initial-fill this
      // effect already does above when the cache happens to be warm.
      if (vaultItems.length === 0 && !draftAppliedSelectedIds) {
        setSelectedIds(fillSlots(syncedItems.slice(0, 12).map((item) => item.id)));
      }
    });

    try {
      const draft = safeDraft(JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}"));
      if (draft.galleryId) setGalleryId(draft.galleryId);
      if (Array.isArray(draft.selectedIds) && draft.selectedIds.length > 0) {
        draftAppliedSelectedIds = true;
        const ids = draft.selectedIds.filter((id): id is string => typeof id === "string");
        setSelectedIds(fillSlots(ids));
        // EK's ask: walking into the room fresh should show nothing
        // selected/held — the description panel and bottom title bar are
        // gated on `selectedItemId` alone (`heldVaultItem`, further down),
        // not on the 3D pickup animation, so auto-selecting the first
        // restored item here made every fresh page load look like an item
        // was already lifted off the shelf. `selectedIds` (which items sit
        // on which shelves) still restores normally — only the "something
        // is currently selected" state no longer defaults itself in.
      }
      if (
        draft.roomStyle === "vault" ||
        draft.roomStyle === "whitebox" ||
        draft.roomStyle === "arcade" ||
        draft.roomStyle === "blue"
      ) {
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

  const slotItems = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return selectedIds.map((id) => (id ? (byId.get(id) ?? null) : null));
  }, [items, selectedIds]);
  const selectedItems = useMemo(
    () => slotItems.filter((item): item is VaultItem => Boolean(item)),
    [slotItems]
  );
  const selectedValue = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0),
    [selectedItems]
  );
  // The item currently lifted off the shelf into the inspect view — real
  // VaultItem data for the info panel below, looked up by the id the 3D
  // effect sets on pickup (heldItem itself lives inside that effect's own
  // closure, not React state, so this is how the render side gets at it).
  const heldVaultItem = useMemo(
    () => (selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null),
    [items, selectedItemId]
  );
  const heldVaultItemBasics = useMemo(
    () =>
      heldVaultItem
        ? [heldVaultItem.year, heldVaultItem.grade || heldVaultItem.condition, heldVaultItem.categoryLabel || heldVaultItem.category].filter(Boolean)
        : [],
    [heldVaultItem]
  );
  // EK caught this live 2026-08-24/25: when a Quick Add scan can't read an
  // item's real title, the AI is deliberately instructed (see
  // src/app/api/ai/analyze-item/route.ts) to write an honest placeholder
  // like "Comic book (title not legible)" instead of guessing wrong — real
  // stored data, not a display bug. But showing that caveat text as if it
  // WERE the title reads badly. EK: "there is no title... leave it blank
  // if the info isn't filled in." Only affects this panel's display, never
  // touches the stored title (the new Edit button below is how you'd
  // actually fix it).
  const heldVaultItemDisplayTitle = useMemo(() => {
    if (!heldVaultItem) return "";
    const title = heldVaultItem.title ?? "";
    return /\b(not\s+(clearly\s+)?legible|illegible|not\s+visible|unreadable|can'?t\s+(be\s+)?read)\b/i.test(title)
      ? ""
      : title;
  }, [heldVaultItem]);
  // EK: "no description" on an item with nothing typed into notes — rather
  // than leave the panel empty, fall back to a real one-line summary built
  // from other fields that actually exist on this item (never invented
  // text). Only used when there's no real notes to show as-is.
  const heldVaultItemDescription = useMemo(() => {
    if (!heldVaultItem) return "";
    if (heldVaultItem.notes) return heldVaultItem.notes;
    return [heldVaultItem.subject, heldVaultItem.brand, heldVaultItem.edition || heldVaultItem.variant, heldVaultItem.conditionReason]
      .filter(Boolean)
      .join(" · ");
  }, [heldVaultItem]);
  // EK's ask: a real-fields list like the reference's Year/Runtime/Genre
  // table, varying by what kind of item it actually is (comic vs card vs
  // vinyl vs instrument) — never invented text, just whichever of these
  // fields actually exist on this specific item.
  const heldVaultItemInfoRows = useMemo(() => {
    if (!heldVaultItem) return [];
    const rows: { label: string; value: string }[] = [];
    if (heldVaultItem.universe) rows.push({ label: "Universe", value: heldVaultItem.universe });
    if (heldVaultItem.categoryLabel || heldVaultItem.category) {
      rows.push({ label: "Category", value: heldVaultItem.categoryLabel || heldVaultItem.category! });
    }
    if (heldVaultItem.year) rows.push({ label: "Year", value: heldVaultItem.year });
    if (heldVaultItem.grade || heldVaultItem.condition) {
      rows.push({ label: "Condition", value: heldVaultItem.grade || heldVaultItem.condition! });
    }
    if (heldVaultItem.brand) rows.push({ label: "Brand", value: heldVaultItem.brand });
    if (heldVaultItem.edition || heldVaultItem.variant) {
      rows.push({ label: "Edition", value: heldVaultItem.edition || heldVaultItem.variant! });
    }
    if (heldVaultItem.comicIssueNumber) rows.push({ label: "Issue", value: heldVaultItem.comicIssueNumber });
    if (heldVaultItem.tcgParallelType) rows.push({ label: "Parallel", value: heldVaultItem.tcgParallelType });
    if (heldVaultItem.sportsParallelType) rows.push({ label: "Parallel", value: heldVaultItem.sportsParallelType });
    if (heldVaultItem.vinylPressing) rows.push({ label: "Pressing", value: heldVaultItem.vinylPressing });
    return rows;
  }, [heldVaultItem]);
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
  const slotPositions = useMemo(() => buildPositions(roomLayout, roomStyle), [roomLayout, roomStyle]);
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
      { wall: "front", label: "Door Wall" },
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
  // EK's ask: "renumber the wall spaces" — the raw global slot index
  // (used as the actual identity for drag/drop and the badge/ghost
  // rendering below, left untouched on purpose — WALL_CYCLE's
  // interleaving is deliberate, see its own comment) reads as scattered,
  // non-sequential numbers per wall (Back Wall showing 1,3,5,7... instead
  // of 1,2,3,4...) since each wall's slots are spread through the global
  // index rather than contiguous. This is a display-only remap — each
  // slot's position WITHIN its own wall's group, 1-based — so every
  // section reads as a clean 1..N regardless of where its slots actually
  // fall in the underlying array.
  const slotDisplayNumber = useMemo(() => {
    const map = new Map<number, number>();
    for (const group of slotGroups) {
      group.indices.forEach((index, position) => map.set(index, position + 1));
    }
    return map;
  }, [slotGroups]);
  // EK's ask (2026-08-23): "I should be able to select any item that own,
  // this isn't being fed off or exiting exhibitions only" — the picker
  // used to only list items not already placed anywhere in this room,
  // on the theory that dragging in the Arrange grid already covers
  // moving something that's already placed. In practice that meant
  // picking an already-placed item required removing it via the Items
  // sidebar FIRST, opening the picker second — "double work," EK's own
  // words. The picker now lists every vault item, period; selecting one
  // that's already on a shelf elsewhere in THIS room just MOVES it (see
  // fillFromSlot below, which now clears an item's old slot before
  // placing it in the new one) instead of needing a separate step.
  const pickerAllItems = items;
  // Current slot label for every item already placed somewhere in this
  // room — used to show e.g. "Back #3" on a tile so picking it reads as
  // "move this" instead of silently duplicating it. Built straight from
  // slotGroups (not slotDisplayNumber + a raw index) so the wall name is
  // right there too — wall-local numbering restarts at 1 on every wall,
  // so three different items can each legitimately be "#1" on their own
  // wall; showing just the bare number without which wall would read as
  // a bug once more than one wall has items in the picker at once.
  const pickerCurrentSlotLabel = useMemo(() => {
    const shortWallLabel: Record<string, string> = {
      "Back Wall": "Back",
      "Left Wall": "Left",
      "Right Wall": "Right",
      "Door Wall": "Door",
      "Display Cases": "Case",
      Featured: "Featured",
    };
    const map = new Map<string, string>();
    for (const group of slotGroups) {
      const label = shortWallLabel[group.label] ?? group.label;
      group.indices.forEach((index, position) => {
        const id = selectedIds[index];
        if (id) map.set(id, `${label} #${position + 1}`);
      });
    }
    return map;
  }, [slotGroups, selectedIds]);
  // Universe pill counts — over every vault item, unaffected by the
  // current search text (same convention as VaultWallView's universeCounts).
  const pickerUniverseCounts = useMemo(() => {
    const counts: Partial<Record<UniverseKey, number>> = {};
    for (const item of pickerAllItems) {
      const u = inferPickerUniverse(item);
      counts[u] = (counts[u] ?? 0) + 1;
    }
    return counts;
  }, [pickerAllItems]);
  const pickerFiltered = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return pickerAllItems
      .filter((item) => {
        if (pickerUniverses.size > 0 && !pickerUniverses.has(inferPickerUniverse(item))) return false;
        if (q && !pickerSearchText(item).includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
  }, [pickerAllItems, pickerQuery, pickerUniverses]);
  const pickerGrouped = useMemo(() => {
    const map: Record<string, VaultItem[]> = {};
    for (const item of pickerFiltered) {
      const first = (item.title ?? "").trim().toUpperCase()[0] ?? "#";
      const key = /[A-Z]/.test(first) ? first : "#";
      (map[key] ??= []).push(item);
    }
    return map;
  }, [pickerFiltered]);
  const pickerActiveLetters = useMemo(() => new Set(Object.keys(pickerGrouped)), [pickerGrouped]);

  function jumpToPickerLetter(letter: string) {
    pickerLetterRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function togglePickerUniverse(key: UniverseKey) {
    setPickerUniverses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const palette = getRoomPalette(roomStyle);

  function openUniverseRoom(room: MuseumUniverseRoom) {
    const ids = room.items.slice(0, TOTAL_SLOT_COUNT).map((item) => item.id);
    if (ids.length === 0) return;
    cameraStateRef.current = null; // entering a different room — start at a fresh spawn, not wherever the last room's camera happened to be
    setGalleryId("scratch");
    setSelectedIds(fillSlots(ids));
    setSelectedItemId(""); // no auto-selected/held item on a fresh room entry — see handleSourceChange's own comment
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

  // EK's ask: camera-position memory should only last while actively
  // arranging (Organize/add/move — those re-run the mount effect without
  // ever leaving room view, and cameraStateRef surviving that is correct,
  // wanted behavior). It should NOT survive an actual "come back to look at
  // the room" — from the campus map, or after picking a different Source/
  // Hall — those should spawn back at the doorway like a fresh visit, same
  // as openUniverseRoom/openMainHall already do above.
  function enterRoomFresh() {
    cameraStateRef.current = null;
    setSelectedItemId("");
    setViewMode("room");
  }

  useEffect(() => {
    if (viewMode !== "room") return;
    const mount = mountRef.current;
    if (!mount) return;
    const container = mount;

    container.innerHTML = "";
    meshesRef.current = [];
    doorwayMeshesRef.current = [];

    // Item pickup/inspect (EK's ask, 2026-08-22/23) — populated per
    // wall-mounted item below, read from onPointerUp's item-click branch
    // and from the render-loop pickup animation. Keyed by itemId so the
    // click handler (which only has the clicked mesh) can look up the
    // full VaultItem (for imageBackUrl) and the card's original shelf
    // transform (to animate it back).
    const itemMeshIndex = new Map<
      string,
      {
        mesh: THREE.Mesh;
        item: VaultItem;
        shelfPos: THREE.Vector3;
        shelfRotY: number;
        frontTexture: THREE.Texture | null;
        backTexture: THREE.Texture | null;
        // Card height as actually built (1.54 * pos.scale) — layouts scale
        // items very differently (Salon ~0.58, Store ~0.78, Hero ~1.2), so a
        // single flat INSPECT_SCALE multiplier makes some items fill barely
        // half the screen held up and others overflow it entirely (EK caught
        // a Store-scaled item cropping top and bottom at INSPECT_SCALE=1.5).
        // Stored so pickUpItem can size every held item to the SAME absolute
        // height regardless of its shelf scale.
        naturalHeight: number;
      }
    >();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // whitebox was at 1.08 — tuned for the old hand-coded shell, not the
    // GLB's baked materials (already 0.72-0.9 base brightness). Combined
    // with the hemisphere boost below and ACES tone mapping, that pushed
    // already-light cream/white surfaces toward blown-out white — white has
    // far less headroom before clipping than vault's dark navy did, so the
    // same exposure that reads fine on vault reads as washed out on white.
    // Cut again — 0.92 (matching vault) still read pale live per EK's
    // screenshot, even with the material darkening above. Going lower than
    // vault's own value this time instead of just matching it, since
    // white's base materials start lighter to begin with.
    renderer.toneMappingExposure = roomStyle === "whitebox" ? 0.68 : (roomStyle === "vault" || roomStyle === "blue") ? 0.92 : 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // The Grand Hall (empty, no items placed) always gets its own dark,
    // dramatically-spotlit look, independent of whichever room style is
    // selected — a fixed "front door" impression rather than something users
    // reskin like a normal room.
    const inHub = selectedItems.length === 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(inHub ? 0x04060a : roomStyle === "whitebox" ? 0xd5dbe1 : 0x05070b);
    scene.fog = new THREE.Fog(scene.background, 16, 32);
    let disposed = false;

    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 80);
    camera.position.set(0, 3.6, -2.2);

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    roomGroupRef.current = roomGroup;

    const fallbackShell = new THREE.Group();
    roomGroup.add(fallbackShell);
    const shellObjects: THREE.Object3D[] = [];
    function addShell(object: THREE.Object3D) {
      shellObjects.push(object);
      fallbackShell.add(object);
    }

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

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
    // whitebox was 4.8 here too — same story as the exposure value above:
    // tuned for the old shell, overexposing the GLB's already-bright cream
    // materials. Dropped to line up with the same intensity vault/blue use,
    // since the GLB's own baked brightness needs far less help than the
    // hand-coded shell did.
    // Cut again — 2.4 still read pale live. Going lower than the "matches
    // vault" instinct this round since that instinct already proved
    // insufficient once.
    const hemi = new THREE.HemisphereLight(
      0xffffff,
      0x3a3a3a,
      inHub ? 2.6 : roomStyle === "whitebox" ? 1.5 : 3.9
    );
    scene.add(hemi);
    // Both of these were left at vault's intensity for whitebox too (only
    // hemi/exposure above got a whitebox-specific cut last round) — and
    // both use palette.glow/palette.trim, which for whitebox are
    // themselves near-white (0xfff1d6, 0xe9e3d2). A bright near-white
    // light on top of already-light materials is what was still washing
    // out the contrast I baked into the GLB — Blender's renderer doesn't
    // share this lighting rig at all, so a clean Blender render never
    // would have caught this; it's a Three.js-side problem specifically.
    const key = new THREE.SpotLight(
      palette.glow,
      inHub ? 9.5 : roomStyle === "whitebox" ? 1.7 : 7.2,
      26,
      Math.PI / 5,
      0.55,
      1.4
    );
    key.position.set(0, 7.4, 1.5);
    scene.add(key);
    const warm = new THREE.PointLight(
      palette.trim,
      roomStyle === "arcade" ? 3.5 : roomStyle === "whitebox" ? 0.35 : 1.8,
      14
    );
    warm.position.set(-4.5, 2.4, 1.8);
    scene.add(warm);

    // "Hero" layout now has one feature piece per wall (buildWallPositions)
    // — each needs its own light, or only the back one would read as
    // spotlit and the side ones would just be big pictures under regular
    // room lighting again. Positions mirror the three hero slots exactly,
    // each light pulled up and slightly toward room-center from its target
    // so the beam rakes across the piece instead of hitting it dead-on.
    if (!inHub && roomLayout === "spotlight") {
      // Targets match the hero item positions exactly (buildWallPositions
      // above: y=shelfItemY(1,1.2), back z=-11.78, side x=+-10.22 — flush
      // wall-mount, not pulled forward). Light positions pulled up and
      // into the room from each target so the beam rakes across the piece
      // from above/in front, the way a real gallery spotlight would.
      const heroTargetY = shelfItemY(1, 1.2);
      const heroTargets: Array<[number, number, number]> = [
        [0, heroTargetY, -11.78],
        [-10.22, heroTargetY, -3.2],
        [10.22, heroTargetY, -3.2],
      ];
      const heroLightPositions: Array<[number, number, number]> = [
        [0, 7.4, -9.0],
        [-7.4, 7.4, -3.2],
        [7.4, 7.4, -3.2],
      ];
      heroTargets.forEach(([tx, ty, tz], index) => {
        const [lx, ly, lz] = heroLightPositions[index];
        const heroSpot = new THREE.SpotLight(0xffffff, 12, 10, Math.PI / 9, 0.4, 1.2);
        heroSpot.position.set(lx, ly, lz);
        heroSpot.target.position.set(tx, ty, tz);
        scene.add(heroSpot);
        scene.add(heroSpot.target);
      });
    }

    const modelUrl = ROOM_MODEL_URLS[roomStyle];
    if (!inHub && modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = true;
              object.receiveShadow = true;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => {
                if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
                  const name = material.name.toLowerCase();
                  if (roomStyle === "vault") {
                    if (name.includes("floor")) {
                      material.color.setHex(0x24170f);
                      material.roughness = 0.62;
                      material.metalness = 0.02;
                    } else if (name.includes("wall")) {
                      material.color.setHex(0x777d7e);
                      material.roughness = 0.38;
                      material.metalness = 0.78;
                    } else if (name.includes("seam")) {
                      material.color.setHex(0x202729);
                      material.roughness = 0.58;
                      material.metalness = 0.72;
                    } else if (name.includes("vestibule")) {
                      material.color.setHex(0x303636);
                      material.roughness = 0.58;
                      material.metalness = 0.55;
                    } else if (name.includes("ceiling")) {
                      material.color.setHex(0x171a1b);
                      material.roughness = 0.82;
                      material.metalness = 0.18;
                    } else if (name.includes("rivet")) {
                      material.color.setHex(0xb8c1c2);
                      material.roughness = 0.3;
                      material.metalness = 0.9;
                    } else if (name.includes("steel") || name.includes("trim")) {
                      material.color.setHex(0x9ca3a4);
                      material.roughness = 0.32;
                      material.metalness = 0.88;
                    } else if (name.includes("case")) {
                      material.color.setHex(0x15191d);
                      material.roughness = 0.5;
                      material.metalness = 0.22;
                    }
                  }
                  material.envMapIntensity = roomStyle === "whitebox" ? 0.45 : 0.72;
                  material.needsUpdate = true;
                }
              });
            }
          });
          roomGroup.add(model);
          shellObjects.forEach((object) => {
            object.visible = false;
          });

          // EK's ask (2026-08-23): same "custom shelf for the Hero frame"
          // fix as the shell (addBackRowBoard/addSideRowBoard above) —
          // Vault/White/Arcade's top shelf board is BAKED into this GLB
          // as one continuous mesh, so it can't be conditionally built
          // notched at bake time (the same .glb serves every layout).
          // Instead: find the baked top-row board by its exported name,
          // hide it, and add the same notched pair as the shell does —
          // reusing THIS mesh's own material so the replacement matches
          // whatever this room style baked (steel/wood/whatever), not a
          // guessed color.
          const heroWallNotch: Array<["back" | "left" | "right", boolean]> = [
            ["back", heroNotch.back],
            ["left", heroNotch.left],
            ["right", heroNotch.right],
          ];
          heroWallNotch.forEach(([wall, notch]) => {
            if (!notch) return;
            const boardName = `${wall}_shelf_0`;
            const baked = model.getObjectByName(boardName);
            if (!(baked instanceof THREE.Mesh)) return;
            baked.visible = false;
            const material = Array.isArray(baked.material) ? baked.material[0] : baked.material;
            const y = SHELF_ROW_Y[0];
            if (wall === "back") {
              const half = 9.95;
              const segWidth = half - HERO_NOTCH_HALF;
              const segA = new THREE.Mesh(new THREE.BoxGeometry(segWidth, 0.1, 0.845), material);
              segA.position.set(-(HERO_NOTCH_HALF + segWidth / 2), y, -11.6275);
              roomGroup.add(segA);
              const segB = new THREE.Mesh(new THREE.BoxGeometry(segWidth, 0.1, 0.845), material);
              segB.position.set(HERO_NOTCH_HALF + segWidth / 2, y, -11.6275);
              roomGroup.add(segB);
            } else {
              const x = wall === "left" ? -10.1275 : 10.1275;
              const heroZ = -3.2;
              const zStart = -3.15 - 11.6;
              const zEnd = -3.15 + 11.6;
              const segALen = heroZ - HERO_NOTCH_HALF - zStart;
              const segBLen = zEnd - (heroZ + HERO_NOTCH_HALF);
              const segA = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, segALen), material);
              segA.position.set(x, y, zStart + segALen / 2);
              roomGroup.add(segA);
              const segB = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, segBLen), material);
              segB.position.set(x, y, zEnd - segBLen / 2);
              roomGroup.add(segB);
            }
          });
        },
        undefined,
        () => {
          if (disposed) return;
          fallbackShell.visible = true;
        }
      );
    }

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
      roughness: roomStyle === "arcade" ? 0.34 : (roomStyle === "vault" || roomStyle === "blue") ? 0.42 : 0.65,
      metalness: roomStyle === "arcade" ? 0.72 : (roomStyle === "vault" || roomStyle === "blue") ? 0.55 : 0.08,
    });
    // EK's ask (2026-08-22): item frames used to share trimMaterial with
    // the wall trim AND the shelf boards — literally the same color as
    // everything around them, which is exactly why a real geometry bug
    // (the frame sinking into the shelf, fixed below) went unnoticed for
    // a while: "everything is blending too much." A fixed, distinct
    // matte off-white matting color reads as a picture frame against any
    // room style's own trim color, instead of disappearing into it.
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2eee3,
      roughness: 0.55,
      metalness: 0.02,
    });
    // Vault reference photos consistently pair the steel door itself with a
    // brass/gold frame and surround, not plain brushed steel — used only for
    // the doorway frame and hinge post below, not the wall shelves.
    const doorFrameMaterial =
      (roomStyle === "vault" || roomStyle === "blue")
        ? new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.32, metalness: 0.78 })
        : trimMaterial;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(21, 26), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.05, -3.2);
    addShell(floor);

    const baseboardMaterial = new THREE.MeshStandardMaterial({
      color: roomStyle === "whitebox" ? 0xcfc6ac : (roomStyle === "vault" || roomStyle === "blue") ? 0x4a545c : 0x252a30,
      roughness: 0.5,
      metalness: (roomStyle === "vault" || roomStyle === "blue") ? 0.35 : 0.18,
    });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(21, 9.2), wallMaterial);
    backWall.position.set(0, 4.55, -12);
    addShell(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9.2), wallMaterial);
    leftWall.position.set(-10.5, 4.55, -3.2);
    leftWall.rotation.y = Math.PI / 2;
    addShell(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(26, 9.2), wallMaterial);
    rightWall.position.set(10.5, 4.55, -3.2);
    rightWall.rotation.y = -Math.PI / 2;
    addShell(rightWall);

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
    addShell(ceiling);

    const doorSideMaterial = new THREE.MeshStandardMaterial({
      // Was noticeably darker than the main wall for vault (0x0f1c2e vs the
      // wall's 0x24405f) — same wall, different color right at the doorway
      // read as a mismatched patch instead of one continuous room.
      color: inHub ? 0x0a0e14 : roomStyle === "whitebox" ? 0xe0d9c4 : (roomStyle === "vault" || roomStyle === "blue") ? 0x24405f : 0x111419,
      roughness: 0.68,
      metalness: (roomStyle === "vault" || roomStyle === "blue") ? 0.05 : 0.02,
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

    if ((roomStyle === "vault" || roomStyle === "blue")) {
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
      addShell(rearWall);

      // Riveted steel architrave tracing the arch — two posts up the
      // straight sides, a half-ring over the curved top.
      const archPostHeight = archStraightHeight;
      const archPostLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostLeft.position.set(-archHalfWidth - 0.08, archPostHeight / 2, 5.7);
      addShell(archPostLeft);

      const archPostRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostRight.position.set(archHalfWidth + 0.08, archPostHeight / 2, 5.7);
      addShell(archPostRight);

      const archTop = new THREE.Mesh(
        new THREE.TorusGeometry(archHalfWidth + 0.08, 0.11, 12, 32, Math.PI),
        doorFrameMaterial
      );
      archTop.position.set(0, archStraightHeight, 5.7);
      addShell(archTop);

      // A heavier riveted hinge column at the right post — this is what the
      // open door below visually reads as attached to.
      const hingeColumn = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, archPostHeight + 0.6, 0.4),
        doorFrameMaterial
      );
      hingeColumn.position.set(archHalfWidth + 0.3, (archPostHeight + 0.6) / 2, 5.72);
      addShell(hingeColumn);
      for (let i = 0; i < 6; i += 1) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 8), trimMaterial);
        rivet.rotation.x = Math.PI / 2;
        rivet.position.set(archHalfWidth + 0.3, 0.4 + i * 0.55, 5.94);
        addShell(rivet);
      }
    } else {
      const rearWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallLeft.position.set(-6.13, 4.55, 5.8);
      rearWallLeft.rotation.y = Math.PI;
      addShell(rearWallLeft);

      const rearWallRight = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallRight.position.set(6.13, 4.55, 5.8);
      rearWallRight.rotation.y = Math.PI;
      addShell(rearWallRight);

      const rearWallTop = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.25), doorSideMaterial);
      rearWallTop.position.set(0, 7.08, 5.8);
      rearWallTop.rotation.y = Math.PI;
      addShell(rearWallTop);

      // Plain painted architrave (reuses trimMaterial — same matte finish as
      // the shelf rails) and deliberately NO fill plane across the opening —
      // a solid dark rectangle here read as a closed door, and real museum
      // doorways are open passages you can see straight through, not
      // blocked-off walls.
      const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorLeft.position.set(-1.85, 2.45, 5.64);
      addShell(doorLeft);

      const doorRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorRight.position.set(1.85, 2.45, 5.64);
      addShell(doorRight);

      const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.18, 0.18), doorFrameMaterial);
      doorHeader.position.set(0, 4.92, 5.64);
      addShell(doorHeader);
    }

    // A shallow, dim vestibule just beyond the entrance — without this, the
    // now-open doorway just showed flat scene.background through the gap,
    // which reads as a blank cutout/broken texture rather than a real
    // passage. This is only enough depth to avoid that, not a real room.
    const beyondMaterial = new THREE.MeshStandardMaterial({
      color: inHub ? 0x0a0e14 : roomStyle === "whitebox" ? 0xcfc6ac : (roomStyle === "vault" || roomStyle === "blue") ? 0x0a1420 : 0x0d0a16,
      roughness: 0.9,
      metalness: 0.02,
    });
    const beyondWall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), beyondMaterial);
    beyondWall.position.set(0, 2.5, 8.6);
    beyondWall.rotation.y = Math.PI;
    addShell(beyondWall);

    const beyondFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), floorMaterial);
    beyondFloor.rotation.x = -Math.PI / 2;
    beyondFloor.position.set(0, -0.04, 7.2);
    addShell(beyondFloor);

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
    if ((roomStyle === "vault" || roomStyle === "blue")) {
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
      addShell(doorGroup);
    }

    const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(20.7, 0.18, 0.12), baseboardMaterial);
    backBaseboard.position.set(0, 0.08, -11.9);
    addShell(backBaseboard);

    const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    leftBaseboard.position.set(-10.42, 0.08, -3.05);
    addShell(leftBaseboard);

    const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    rightBaseboard.position.set(10.42, 0.08, -3.05);
    addShell(rightBaseboard);

    // The entrance wall (either side of the doorway) had no baseboard at
    // all, so the door-frame posts appeared to just stop bare at the floor
    // instead of meeting the same trim line as the rest of the room.
    const frontBaseboardLeft = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardLeft.position.set(-6.13, 0.08, 5.7);
    addShell(frontBaseboardLeft);

    const frontBaseboardRight = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardRight.position.set(6.13, 0.08, 5.7);
    addShell(frontBaseboardRight);

    // EK's ask (2026-08-23): "the shelf design has to be custom for the
    // Hero Frame. do not make the frame bigger, do not move the frame or
    // change the size at all. The top shelve have to be redone from
    // scratch to stop just before the hero image." Root cause: the top
    // shelf board is one continuous run across the whole wall, built
    // completely independently of item placement — nothing ever checked
    // whether Hero's (deliberately taller) frame, now sitting at the
    // middle row's height, physically reaches up into where the top
    // row's board runs. It does, so the board visibly cut straight
    // through the top of the frame. Fix: when Hero layout is active, the
    // TOP row only (row 0 — the one Hero's frame actually reaches into)
    // is built as two segments with a real gap where Hero's frame is,
    // instead of one continuous board — Hero's own size/position is
    // completely untouched. Only the walls that actually have a
    // populated Hero slot get notched (back always; left once there are
    // >=2 items; right once there are >=3 — mirrors allHeroSlots' own
    // back/left/right fill order), so Store/Salon and under-filled Hero
    // walls keep the plain unbroken board.
    const heroNotch =
      roomLayout === "spotlight"
        ? {
            back: selectedItems.length >= 1,
            left: selectedItems.length >= 2,
            right: selectedItems.length >= 3,
          }
        : { back: false, left: false, right: false };
    // Half-width of the gap needed to clear Hero's own frame (1.12*1.2 +
    // 2*0.065*1.2 = 1.5 wide, half 0.75) plus a small margin — reused
    // as-is for the side walls too, since Hero's frame width becomes the
    // along-wall (Z) extent there once rotated onto that wall.
    const HERO_NOTCH_HALF = 0.9;

    function addBackRowBoard(y: number, notch: boolean) {
      if (!notch) {
        const backShelf = new THREE.Mesh(new THREE.BoxGeometry(19.9, 0.1, 0.845), trimMaterial);
        backShelf.position.set(0, y, -11.6275);
        addShell(backShelf);
        return;
      }
      const half = 9.95;
      const segWidth = half - HERO_NOTCH_HALF;
      const segA = new THREE.Mesh(new THREE.BoxGeometry(segWidth, 0.1, 0.845), trimMaterial);
      segA.position.set(-(HERO_NOTCH_HALF + segWidth / 2), y, -11.6275);
      addShell(segA);
      const segB = new THREE.Mesh(new THREE.BoxGeometry(segWidth, 0.1, 0.845), trimMaterial);
      segB.position.set(HERO_NOTCH_HALF + segWidth / 2, y, -11.6275);
      addShell(segB);
    }

    function addSideRowBoard(side: "left" | "right", y: number, notch: boolean) {
      const x = side === "left" ? -10.1275 : 10.1275;
      if (!notch) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, 23.2), trimMaterial);
        shelf.position.set(x, y, -3.15);
        addShell(shelf);
        return;
      }
      const heroZ = -3.2; // matches the hero item's own z on this wall
      const zStart = -3.15 - 11.6;
      const zEnd = -3.15 + 11.6;
      const segALen = heroZ - HERO_NOTCH_HALF - zStart;
      const segBLen = zEnd - (heroZ + HERO_NOTCH_HALF);
      const segA = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, segALen), trimMaterial);
      segA.position.set(x, y, zStart + segALen / 2);
      addShell(segA);
      const segB = new THREE.Mesh(new THREE.BoxGeometry(0.845, 0.1, segBLen), trimMaterial);
      segB.position.set(x, y, zEnd - segBLen / 2);
      addShell(segB);
    }

    for (let row = 0; row < SHELF_ROW_Y.length; row += 1) {
      const y = SHELF_ROW_Y[row];
      const isTopRow = row === 0;

      // The board's front edge (the face items actually sit near) stays put;
      // only the back edge moves. Original boards were 0.55 thick centered
      // 0.245 units clear of the real wall (back z=-12, sides x=±10.5) — that
      // wasn't just a corner gap, the ENTIRE run of every shelf floated off
      // its wall the whole time, visible as open air/wall-texture showing
      // above and behind the board. Depth 0.845 (0.55 + 0.245 gap + 0.05
      // embed) puts the back face flush against, and slightly into, the wall.

      // Widened to 19.9 (from 18.2) so it actually reaches the side shelves at
      // x=±9.98 instead of leaving a visible ~0.9-unit gap at each back corner.
      addBackRowBoard(y, isTopRow && heroNotch.back);
      addSideRowBoard("left", y, isTopRow && heroNotch.left);
      addSideRowBoard("right", y, isTopRow && heroNotch.right);
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
      addShell(base);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1), glassMaterial);
      glass.position.set(x, 1.25, z);
      addShell(glass);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 1.18), trimMaterial);
      cap.position.set(x, 1.85, z);
      addShell(cap);

      const glow = new THREE.PointLight(palette.glow, 0.55, 4);
      glow.position.set(x, 2.2, z + (index % 2 === 0 ? 0.25 : -0.25));
      roomGroup.add(glow);
    });

    // Doorways: a "go back one level" archway is always present at the entrance
    // wall, and the Grand Hall additionally gets one freestanding archway per
    // populated universe room, each with a sign naming where it leads — so the
    // museum is actually navigated room-to-room instead of only via the flat map.
    function buildDoorwaySign(
      x: number,
      y: number,
      z: number,
      label: string,
      faceBack: boolean,
      size: { width: number; height: number } = { width: 2.3, height: 0.58 }
    ) {
      const signTexture = drawDoorSignTexture(label);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(size.width, size.height),
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

    buildDoorwaySign(
      0,
      (roomStyle === "vault" || roomStyle === "blue") && !inHub ? 5.85 : 5.55,
      5.9,
      inHub ? "Campus Map" : "Main Gallery",
      true,
      (roomStyle === "vault" || roomStyle === "blue") && !inHub ? { width: 1.65, height: 0.42 } : undefined
    );
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

      const texture = drawItemTexture();
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.44,
        metalness: 0.08,
        emissive: new THREE.Color(0x05070a),
        emissiveIntensity: 0.08,
        // Flat display-case items need both faces for the same reason as
        // display cases always did (viewed from the "wrong" side while
        // walking past). Wall-mounted items now ALSO need both faces —
        // pickup/inspect (2026-08-22/23) rotates them a full turn to
        // reveal the back, and a FrontSide-only plane would just vanish
        // once rotated past 90° instead of showing anything.
        side: THREE.DoubleSide,
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

        // Real wall planes: back z=-12, front z=5.8, left x=-10.5, right x=10.5. The frame used to
        // be a fixed thin box floating ~0.045 behind the card, which left a visible
        // air gap (0.15-0.2 units) between the frame and the actual wall — reading as
        // the item hovering in front of the wall instead of mounted on it. Stretch the
        // frame's depth back to actually touch the wall. Free-standing "center" items
        // (spotlight layout) keep the old small offset since they aren't wall-mounted.
        let frameDepth = 0.06;
        let centerOffset = 0.045;
        if (pos.wall === "back" || pos.wall === "front" || pos.wall === "left" || pos.wall === "right") {
          const wallGap =
            pos.wall === "back"
              ? pos.z + 12
              : pos.wall === "front"
                ? 5.8 - pos.z
                : pos.wall === "left"
                  ? pos.x + 10.5
                  : 10.5 - pos.x;
          const frontOffset = 0.015;
          const backOverlap = 0.05;
          frameDepth = Math.max(0.06, wallGap - frontOffset + backOverlap);
          centerOffset = frontOffset + frameDepth / 2;
        }

        // EK's ask (2026-08-22): the frame used to be centered on the same
        // Y as the card, symmetric matting extending equally above AND
        // below it — but the card only has a fixed 0.05-unit clearance
        // above the shelf board it rests on (shelfHalfThickness, doesn't
        // scale with item size), while the frame's matting DOES scale
        // with item size. At normal item scale that overhang already
        // exceeds the clearance, so the frame's bottom edge sank into the
        // shelf board itself — EK caught it live: "the bottom of the
        // frame is in the shelf." Matting now only extends above and to
        // the sides; the bottom of the frame is flush with the bottom of
        // the card (like a framed piece resting directly on the shelf
        // ledge), so it can't dip into the board regardless of scale.
        const mattingTop = 0.065 * pos.scale;
        const mattingSide = 0.065 * pos.scale;
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.12 * pos.scale + mattingSide * 2, 1.54 * pos.scale + mattingTop, frameDepth),
          frameMaterial
        );
        frame.position.set(
          pos.x - normal.x * centerOffset,
          pos.y + mattingTop / 2,
          pos.z - normal.z * centerOffset
        );
        frame.rotation.y = pos.ry;
        roomGroup.add(frame);

        // Only wall-mounted items get pickup/inspect — display-case items
        // (flat, lying in glass) keep the existing camera-focus-only click,
        // a deliberate scope cut, not an oversight.
        itemMeshIndex.set(item.id, {
          mesh: card,
          item,
          shelfPos: card.position.clone(),
          shelfRotY: pos.ry,
          frontTexture: null,
          backTexture: null,
          naturalHeight: 1.54 * pos.scale,
        });
      }

      const url = itemImage(item);
      if (url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const next = drawItemTexture(img);
          material.map = next;
          material.needsUpdate = true;
          const entry = itemMeshIndex.get(item.id);
          if (entry) entry.frontTexture = next;
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
        const badgeTexture = drawSlotBadgeTexture(slotDisplayNumber.get(index) ?? index + 1);
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
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const clock = new THREE.Clock();
    let width = 0;
    let height = 0;
    let raf = 0;
    // EK's ask (2026-08-21), REVERTED same day after EK reported the room
    // felt toddler-scale ("I feel like a 5 year old"). The 3.6 -> 1.7 drop
    // was based on assuming this room's units are 1:1 meters — never
    // actually checked against anything real in the room. Cross-checked it
    // against the one real-world anchor that DOES exist in the baked
    // geometry: the entrance door frame is 4.95 units tall
    // (add_standard_door() in generate-gallery-room-models.py). A real
    // grand-entrance door runs roughly 7-9 feet, which puts 1 unit at
    // roughly 0.43-0.55m, not 1m. Redone with that scale, the ORIGINAL 3.6
    // works out to ~5'1"-5'7" (a normal adult) and the "fix" of 1.7 works
    // out to ~2'4"-3'0" (a toddler) — the opposite of what was intended.
    // Back to the original value; SHELF_ROW_Y's fix (dropping the one row
    // that genuinely was too low, see its own comment) stands on its own
    // and didn't need this number to be right.
    const eyeHeight = 3.6;
    const savedCamera = cameraStateRef.current;
    // A fresh spawn (no saved camera) looks straight down -Z at yaw 0, which
    // points dead-on at the back shelf wall — it fills the frame edge-to-edge
    // with flat, unforeshortened shelf rows and leaves almost no floor/ceiling/
    // side-wall visible, reading as "staring at a wall" instead of "entering a
    // room." Angling the default view ~25° toward a corner (and tilting down
    // slightly) shows the back wall AND a side wall together with real depth,
    // the way a person glancing across a room on arrival actually would.
    //
    // EK's ask (2026-08-28): "this is where I stand on refresh, that's not
    // in front of the door." The spawn Z here (-2.2) was never actually near
    // the door — the front/door wall sits at z=5.54 (frontWallPosition),
    // the walkable area's own forward clamp stops at z=4.72 (clampPosition,
    // below), and the back wall is at z=-11.78. -2.2 sits almost exactly at
    // the room's MIDPOINT (17.32-unit span, -2.2 is only ~1 unit off center)
    // — a person standing there is already deep in the room, close enough to
    // both the back wall and a side wall for items to fill the frame, which
    // is exactly what read as "cornered" instead of "just walked in." Moved
    // to z=3.8 — just inside the walkable clamp's own forward limit (4.72),
    // genuinely near the entrance instead of the room's center.
    let yaw = savedCamera?.yaw ?? -0.45;
    let pitch = savedCamera?.pitch ?? -0.08;
    let targetYaw = yaw;
    let targetPitch = pitch;
    const NAV_PITCH_LIMIT = 0.32;
    const cameraBody = new THREE.Vector3(savedCamera?.x ?? 0, savedCamera?.y ?? eyeHeight, savedCamera?.z ?? 3.8);
    const targetCameraBody = cameraBody.clone();
    let isDragging = false;
    let didDrag = false;
    let startX = 0;
    let startY = 0;

    // EK's ask, the still-open half of "you never changed the walking
    // pattern like the other app" — click-to-walk (below) was the first
    // half; this is WASD. Researched directly from bingebrowse.net's own
    // bundle (`updateMovement(dt)`): held-key movement is direct velocity,
    // no acceleration/deceleration curve at all — starts and stops the
    // instant a key goes down/up, every frame while held. Our OLD
    // implementation had no continuous movement whatsoever — onKeyDown
    // fired `moveCamera()` as a single fixed-size nudge per keydown EVENT,
    // relying entirely on the OS's own key-repeat timing for a held key,
    // which is why it never felt like walking (inconsistent cadence, a
    // startup delay before repeat kicks in, no per-frame smoothness).
    // `pressedKeys` + `updateKeyboardMovement` below replace that with a
    // real per-frame held-key loop, matching their model.
    const pressedKeys = new Set<string>();
    // Their own speed is 1.25 m/s (0.85 while Shift) — but their scene is
    // genuine 1:1 meters and ours is NOT (see eyeHeight's own history: the
    // entrance door's real baked height cross-checks this room at roughly
    // 0.43-0.55m per unit, i.e. our units are about 2x a meter). Copying
    // "1.25" as 1.25 units/sec here would walk at roughly HALF their real
    // pace — same unit-scale mistake that broke eyeHeight earlier this
    // session. Converted through that same verified ~0.49m/unit factor
    // instead of copied raw.
    const WALK_SPEED = 2.55; // units/sec, ~1.25 m/s equivalent
    const WALK_SPEED_SLOW = 1.73; // units/sec, ~0.85 m/s equivalent (Shift)
    // Keyboard turning (Left/Right) has no bingebrowse equivalent — theirs
    // is mouse-look only — tuned to feel continuous and comparable to the
    // walk speed above, not sourced from their bundle.
    const TURN_RATE = 1.7; // rad/sec

    function updateKeyboardMovement(dt: number) {
      if (heldItem || pressedKeys.size === 0) return;
      walkTween = null; // a held movement/turn key interrupts click-to-walk, same as every other nav input already does
      const speed = pressedKeys.has("shift") ? WALK_SPEED_SLOW : WALK_SPEED;
      const move = new THREE.Vector3();
      if (pressedKeys.has("forward")) move.add(facingDirection());
      if (pressedKeys.has("back")) move.sub(facingDirection());
      if (pressedKeys.has("left")) move.sub(strafeDirection());
      if (pressedKeys.has("right")) move.add(strafeDirection());
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        cameraBody.add(move);
        cameraBody.y = eyeHeight;
        clampPosition(cameraBody);
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

    // EK's ask (2026-08-22/23): "you never changed the walking pattern
    // like the other app." Researched bingebrowse.net's own click-to-walk
    // directly from their bundle — it's not one continuous ease toward a
    // destination (which is all the plain targetCameraBody/targetYaw lerp
    // below does); it's a three-phase move, their own comment: "face the
    // destination, travel with a steady view, stop, then turn to the
    // exact film." Phase 1 turns in place to face the destination (position
    // frozen). Phase 2 walks in a straight line at that fixed facing (no
    // reorienting mid-walk). Phase 3 turns from the travel-facing to the
    // precise final aim (position frozen again). Each phase individually
    // smoothstepped, not one curve stretched over the whole journey.
    // Exact timing/rate constants are theirs, pulled from the live bundle,
    // not invented: turn rate ~2.2 rad/sec (clamped 0.18-1.25s per turn),
    // travel speed ~4.8 units/sec (clamped 0.34-1.65s) — travel is ~3.8x
    // the WASD walk speed (moveCamera's own 0.54-per-tap movement reads as
    // real-time walking; click-to-walk reads as deliberate fast travel).
    // Only click-to-walk uses this — WASD and mouse-look keep the existing
    // continuous lerp, matching the reference (their WASD has no tween at
    // all, see updateMovement).
    type WalkTween = {
      fromYaw: number; toYaw: number; travelYaw: number;
      fromPitch: number; toPitch: number; travelPitch: number;
      fromPos: THREE.Vector3; toPos: THREE.Vector3;
      t: number; journeyDuration: number; firstTurnEnd: number; moveEnd: number;
    };
    let walkTween: WalkTween | null = null;

    function angleDelta(from: number, to: number) {
      let d = (to - from) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    function smoothstep(q: number) {
      return q * q * (3 - 2 * q);
    }

    function startWalkTween(destination: THREE.Vector3) {
      // EK's ask (2026-08-23): the reference's own 3rd phase (turn to the
      // PRECISE final aim on arrival — their "then turn to the exact
      // film") was carried over too literally. Ours forced that final
      // turn to face whichever wall was nearest the destination, which
      // read as "it spins you to a position it thinks you want" — an
      // unrequested reorientation you didn't ask for, right as you arrive
      // right up close to that wall. Dropped entirely: the walk now ends
      // facing the same direction you were already walking in (phase 2's
      // travel-facing), no extra re-aim. Two phases, not three.
      const fromPos = cameraBody.clone();
      const travelDistance = fromPos.distanceTo(destination);
      const dx = destination.x - fromPos.x;
      const dz = destination.z - fromPos.z;
      const wantTravelYaw = Math.atan2(dx, -dz);
      const travelYaw = travelDistance > 0.01 ? yaw + angleDelta(yaw, wantTravelYaw) : yaw;
      const travelPitch = pitch;

      const firstTurnDuration = THREE.MathUtils.clamp(
        Math.max(Math.abs(travelYaw - yaw), Math.abs(travelPitch - pitch) * 1.4) / 2.2,
        0.18,
        1.25
      );
      const moveDuration = THREE.MathUtils.clamp(travelDistance / 4.8, 0.34, 1.65);
      const journeyDuration = firstTurnDuration + moveDuration;

      walkTween = {
        fromYaw: yaw,
        toYaw: travelYaw,
        travelYaw,
        fromPitch: pitch,
        toPitch: travelPitch,
        travelPitch,
        fromPos,
        toPos: destination.clone(),
        t: 0,
        journeyDuration,
        firstTurnEnd: firstTurnDuration / journeyDuration,
        moveEnd: 1,
      };
      // Keep the plain lerp targets in sync with the destination so that if
      // WASD/mouse-look interrupts the tween (see moveCamera/onPointerDown),
      // the existing continuous system picks up from exactly where the
      // tween left off instead of snapping.
      targetCameraBody.copy(destination);
      targetYaw = travelYaw;
      targetPitch = travelPitch;
    }

    // Item pickup/inspect (EK's ask, 2026-08-22/23) — researched directly
    // from bingebrowse.net's own bundle rather than guessed. Two pieces,
    // both theirs: (1) a two-phase pull animation (0.6s, easeOutCubic,
    // split at eased-progress 0.45 — pull straight off the shelf to a
    // waypoint first, THEN travel/rotate/grow into the held position —
    // see updateInspectAnim in their source), and (2) a spring-damper
    // chasing the cursor for the held item's idle tilt (their own
    // comment: "the held case is a spring chasing a cursor-driven
    // target"), exact constants INSPECT_STIFF=100/INSPECT_DAMP=19 from
    // their source, not tuned by feel. Scoped to wall-mounted items only
    // — display-case items keep the existing camera-focus click.
    type HeldItem = {
      id: string;
      mesh: THREE.Mesh;
      item: VaultItem;
      shelfPos: THREE.Vector3;
      shelfRotY: number;
      waypoint: THREE.Vector3;
      focal: THREE.Vector3;
      frozenYaw: number;
      inspectScale: number;
      // EK: "you did not make the entire item thicker, you just put a
      // bigger end on it... looks like an I-Beam" — bolting a separate
      // box onto the edge of an otherwise-flat card is exactly what
      // produced that: front/back stayed paper-thin while only a thin
      // strip at the edge had real depth, reading as two mismatched
      // pieces, not one uniformly thick object. Real fix: swap the
      // card's own geometry+material to a real box for as long as it's
      // held (restored on put-back), so front/back/sides all belong to
      // the SAME uniformly-thick shape — no bolted-on piece at all.
      originalGeometry: THREE.BufferGeometry;
      originalMaterial: THREE.Material | THREE.Material[];
      // The 6 fresh materials built for the held box, so put-back can
      // dispose exactly these (never the restored original).
      boxMaterials: THREE.Material[];
      // The back face's own material — kept directly reachable so the
      // async back-image load (below) can update it in place if it
      // resolves after this pickup already started.
      backMat: THREE.MeshBasicMaterial;
    };
    let heldItem: HeldItem | null = null;
    let pullAnim: { dir: "in" | "out"; t: number } | null = null;
    let inspectYaw = 0;
    let inspectPitch = 0;
    let inspectVelYaw = 0;
    let inspectVelPitch = 0;
    let inspectTargetYaw = 0;
    let inspectTargetPitch = 0;
    let heldDragYaw = 0;
    // EK's ask (2026-08-22, later pass): "shrink it slightly ... its just
    // slight larger" — then, after a live test, "even bigger now ... paper
    // thin." Root cause: a flat multiplier on top of pos.scale, which
    // already varies wildly by layout (Salon ~0.58, Store ~0.78, Hero
    // ~1.2) — at focal distance 2.2 and this camera's 47deg vertical FOV,
    // the visible height budget there is 2*2.2*tan(23.5deg) ≈ 1.91 units,
    // so a Store-scaled item at the old flat 1.5x (1.54*0.78*1.5 ≈ 1.80)
    // filled ~94% of the frame — exactly the "cropped top and bottom"
    // EK saw. Replaced with a per-item scale computed in pickUpItem so
    // every held item lands at the SAME absolute height regardless of
    // its shelf scale, instead of a flat multiplier compounding on top
    // of whatever that item already was.
    const TARGET_HELD_HEIGHT = 1.15;

    function pickUpItem(itemId: string) {
      const entry = itemMeshIndex.get(itemId);
      if (!entry) return;
      const wallNormal = new THREE.Vector3(Math.sin(entry.shelfRotY), 0, Math.cos(entry.shelfRotY));
      const waypoint = entry.shelfPos.clone().addScaledVector(wallNormal, 0.9);
      const frozenYaw = yaw;
      const facing = new THREE.Vector3(Math.sin(frozenYaw), 0, -Math.cos(frozenYaw));
      const focal = cameraBody.clone().addScaledVector(facing, 2.2);
      focal.y = cameraBody.y;
      const inspectScale = TARGET_HELD_HEIGHT / entry.naturalHeight;
      const cardWidth = entry.naturalHeight * (1.12 / 1.54);

      // Swap the card's own geometry/material to a real box for as long
      // as it's held — front and back keep the real photo (front's own
      // existing texture; back mirrors it unless a genuine back image
      // exists), all 4 remaining faces are theme blue. One uniformly
      // thick object, not a flat card with a separate piece bolted onto
      // its edge (see the HeldItem type comment for why that read as an
      // "I-Beam").
      const originalGeometry = entry.mesh.geometry;
      const originalMaterial = entry.mesh.material;
      const frontTexture = (originalMaterial as THREE.MeshStandardMaterial).map ?? null;
      // EK caught this live 2026-08-25: "it has to be the original bright
      // image when you are looking at it up close" — some wash-out from
      // the room's own dim, moody lighting is fine on the shelf (this is
      // the SEPARATE material used only while held/inspected, swapped in
      // below and restored on put-back — the shelf's own material is
      // untouched), but a photo you've picked up to actually look at
      // should show its true captured color, not get dimmed/tinted by
      // whichever room style's lights and low exposure happen to be
      // active. These used to be MeshStandardMaterial, which — even with
      // the toneMapped:false the side/edge materials below already use —
      // still diffusely REFLECTS the scene's actual lights, so a dim room
      // still dimmed the photo. MeshBasicMaterial is unlit (ignores scene
      // lights entirely) and toneMapped:false skips the exposure curve
      // too, so the texture renders at its own native brightness/color no
      // matter what room it's held in.
      const frontMat = new THREE.MeshBasicMaterial({ map: frontTexture, toneMapped: false });
      const backMat = new THREE.MeshBasicMaterial({ map: entry.backTexture ?? frontTexture, toneMapped: false });
      const spineTexture = drawSpineTexture(entry.item.title, entry.item.universe);
      // EK: "the blue doesn't seem to have the white glow to it that the
      // button does" — the button has a real box-shadow glow
      // (shadow-[0_0_18px_rgba(79,211,238,0.22)]) around it; a flat unlit
      // MeshBasicMaterial has no equivalent of that. Emissive light (as
      // opposed to a diffuse map, which only reflects whatever light
      // already hits it) reads as genuinely self-lit/glowing rather than
      // just colored — color:black so the near-zero diffuse contribution
      // can't get reshaded by the room's own lights, emissiveIntensity:1
      // so the emitted color matches the drawn texture/hex exactly
      // (still toneMapped:false too, same reasoning as before: renders
      // the exact color, not reshaded by the room's exposure).
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xffffff,
        emissiveMap: spineTexture,
        emissiveIntensity: 1,
        toneMapped: false,
      });
      // Top/bottom edges: same blue family (the gradient's own midpoint),
      // flat since there's no room for legible text on that thin a face.
      const edgeMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: "#53cce6",
        emissiveIntensity: 1,
        toneMapped: false,
      });
      const boxMaterials = [sideMat, sideMat, edgeMat, edgeMat, frontMat, backMat];
      entry.mesh.geometry = new THREE.BoxGeometry(cardWidth, entry.naturalHeight, 0.16);
      entry.mesh.material = boxMaterials;

      heldItem = {
        id: itemId,
        mesh: entry.mesh,
        item: entry.item,
        shelfPos: entry.shelfPos.clone(),
        shelfRotY: entry.shelfRotY,
        waypoint,
        focal,
        frozenYaw,
        inspectScale,
        originalGeometry,
        originalMaterial,
        boxMaterials,
        backMat,
      };
      inspectYaw = 0;
      inspectPitch = 0;
      inspectVelYaw = 0;
      inspectVelPitch = 0;
      inspectTargetYaw = 0;
      inspectTargetPitch = 0;
      heldDragYaw = 0;
      pullAnim = { dir: "in", t: 0 };
      setSelectedItemId(itemId);

      // Kick off the back-image load now (if there is one) so it's ready
      // well before a drag could rotate far enough to need it. Updates
      // the box's own back material directly if this same item is still
      // the one being held once it resolves.
      if (entry.item.imageBackUrl && !entry.backTexture) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          entry.backTexture = drawItemTexture(img);
          if (heldItem?.id === itemId) {
            heldItem.backMat.map = entry.backTexture;
            heldItem.backMat.needsUpdate = true;
          }
        };
        img.src = entry.item.imageBackUrl;
      }
    }

    function putBackItem() {
      if (!heldItem || pullAnim?.dir === "out") return;
      pullAnim = { dir: "out", t: 0 };
    }

    function updateHeldItem(dt: number) {
      if (!heldItem) return;
      const mesh = heldItem.mesh;

      if (pullAnim) {
        pullAnim.t = Math.min(1, pullAnim.t + dt / 0.6);
        const raw = pullAnim.dir === "in" ? pullAnim.t : 1 - pullAnim.t;
        const e = 1 - Math.pow(1 - raw, 3); // easeOutCubic
        if (e < 0.45) {
          const k = e / 0.45;
          mesh.position.lerpVectors(heldItem.shelfPos, heldItem.waypoint, k);
          mesh.rotation.y = heldItem.shelfRotY;
          mesh.rotation.x = 0;
          mesh.scale.setScalar(1);
        } else {
          const k = (e - 0.45) / 0.55;
          mesh.position.lerpVectors(heldItem.waypoint, heldItem.focal, k);
          // Rotation.y=t turns local +Z to world (sin t, 0, cos t) — for
          // that to point back at the camera (world -facing(frozenYaw)),
          // t = -frozenYaw. Was frozenYaw+PI, which is wrong by a
          // frozenYaw-dependent amount and could land the card edge-on
          // to the camera (functionally invisible) depending on which
          // way the camera happened to be facing at pickup.
          mesh.rotation.y = THREE.MathUtils.lerp(heldItem.shelfRotY, -heldItem.frozenYaw, k);
          mesh.rotation.x = 0;
          mesh.scale.setScalar(THREE.MathUtils.lerp(1, heldItem.inspectScale, k));
        }
        if (pullAnim.t >= 1) {
          if (pullAnim.dir === "in") {
            pullAnim = null;
          } else {
            mesh.position.copy(heldItem.shelfPos);
            mesh.rotation.y = heldItem.shelfRotY;
            mesh.rotation.x = 0;
            mesh.scale.setScalar(1);
            // Restore the card's real flat geometry/material (the held
            // box was always temporary — see pickUpItem) before
            // disposing the box's own geometry and materials. Only the
            // side material's own texture gets disposed — front/back
            // reuse textures that are shared with the restored material
            // or cached on entry.backTexture for next time, so those
            // must NOT be disposed here.
            const tempGeometry = mesh.geometry;
            mesh.geometry = heldItem.originalGeometry;
            mesh.material = heldItem.originalMaterial;
            tempGeometry.dispose();
            (heldItem.boxMaterials[0] as THREE.MeshStandardMaterial).emissiveMap?.dispose(); // the side spine texture, unique per pickup
            for (const mat of new Set(heldItem.boxMaterials)) mat.dispose();
            pullAnim = null;
            heldItem = null;
            setSelectedItemId("");
          }
        }
        return;
      }

      // Settled — their exact spring constants (near-critically damped:
      // "follows fast, barely overshoots"), chasing a cursor-driven target.
      const INSPECT_STIFF = 100;
      const INSPECT_DAMP = 19;
      const INSPECT_RANGE_YAW = 0.95;
      const INSPECT_RANGE_PITCH = 0.4;
      const damp = Math.exp(-INSPECT_DAMP * dt);
      inspectVelYaw = (inspectVelYaw + (inspectTargetYaw - inspectYaw) * INSPECT_STIFF * dt) * damp;
      inspectYaw += inspectVelYaw * dt;
      inspectVelPitch = (inspectVelPitch + (inspectTargetPitch - inspectPitch) * INSPECT_STIFF * dt) * damp;
      inspectPitch += inspectVelPitch * dt;

      mesh.position.copy(heldItem.focal);
      mesh.rotation.y = -heldItem.frozenYaw + inspectYaw * INSPECT_RANGE_YAW + heldDragYaw;
      mesh.rotation.x = inspectPitch * INSPECT_RANGE_PITCH;
      mesh.scale.setScalar(heldItem.inspectScale);
      // No front/back texture-swap-on-rotate needed any more — the held
      // shape is now a real box with its own separate front and back
      // faces (set up in pickUpItem), so rotating it naturally shows
      // whichever face actually points at the camera.
    }

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

    // EK's ask (2026-08-23), then EK again (2026-08-22 later pass): a
    // ~4-unit margin still wasn't enough — screenshots showed a corner
    // click landing nose-to-wall, no floor or ceiling visible at all
    // ("I need to be much further back... I need to see floor to
    // ceiling. Never any closer, that is what zoom is for"). The math:
    // camera is PerspectiveCamera(47deg) (vertical FOV) at eyeHeight=3.6,
    // ceiling at y=9.15 — looking level at a flat wall from distance D,
    // the visible vertical span is 2*D*tan(23.5deg) ≈ 0.87*D, centered on
    // eye height. Seeing the full floor(0)-to-ceiling(9.15) span needs
    // D >= max(3.6, 9.15-3.6) / 0.435 ≈ 12.8 — most of the room. Rather
    // than chase that exactly (it would make click-to-walk barely move
    // you from a corner click), pulled the destination in hard so it
    // always lands comfortably away from EVERY wall, corner or not — a
    // generous, room-interior stop, not a minimally-legal one. Zoom
    // (scroll wheel -> moveCamera, still governed by the looser
    // clampPosition above) is how you actually get close, same as EK
    // asked.
    function clampWalkDestination(position: THREE.Vector3) {
      position.x = Math.max(-3.5, Math.min(3.5, position.x));
      position.z = Math.max(-4.6, Math.min(1.8, position.z));
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
      if (heldItem) return; // camera stays put while inspecting an item
      walkTween = null;
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
      const dt = Math.min(clock.getDelta(), 0.05);
      updateHeldItem(dt);
      updateKeyboardMovement(dt);
      if (walkTween) {
        walkTween.t = Math.min(1, walkTween.t + dt / walkTween.journeyDuration);
        const { t, firstTurnEnd, moveEnd } = walkTween;
        if (t < firstTurnEnd) {
          const k = smoothstep(firstTurnEnd > 0 ? t / firstTurnEnd : 1);
          yaw = THREE.MathUtils.lerp(walkTween.fromYaw, walkTween.travelYaw, k);
          pitch = THREE.MathUtils.lerp(walkTween.fromPitch, walkTween.travelPitch, k);
          cameraBody.copy(walkTween.fromPos);
        } else if (t < moveEnd) {
          const k = smoothstep((t - firstTurnEnd) / (moveEnd - firstTurnEnd));
          yaw = walkTween.travelYaw;
          pitch = walkTween.travelPitch;
          cameraBody.lerpVectors(walkTween.fromPos, walkTween.toPos, k);
        } else {
          const k = smoothstep(moveEnd < 1 ? (t - moveEnd) / (1 - moveEnd) : 1);
          yaw = THREE.MathUtils.lerp(walkTween.travelYaw, walkTween.toYaw, k);
          pitch = THREE.MathUtils.lerp(walkTween.travelPitch, walkTween.toPitch, k);
          cameraBody.copy(walkTween.toPos);
        }
        if (walkTween.t >= 1) {
          yaw = walkTween.toYaw;
          pitch = walkTween.toPitch;
          cameraBody.copy(walkTween.toPos);
          walkTween = null;
        }
      } else {
        yaw += (targetYaw - yaw) * 0.12;
        pitch += (targetPitch - pitch) * 0.12;
        cameraBody.lerp(targetCameraBody, 0.15);
      }

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
      if (heldItem) {
        // EK's ask (2026-08-22, later pass): "only allow it to spin when
        // being held down or when clicked" — bingebrowse's own passive
        // cursor-chase parallax (spinning on every mouse move, no button
        // held) read as uncontrolled spinning here instead of a subtle
        // tilt, so it's removed outright. The spring in updateHeldItem
        // still exists (settles inspectYaw/Pitch back toward their
        // initial 0 target from pickUpItem), it's just never re-driven by
        // bare mouse movement anymore — only an actual drag (below) moves
        // the item now, via heldDragYaw, same as it always did.
        if (!isDragging) return;
        // An actual drag free-rotates the held item (not spring-bound) —
        // this is what reveals the back past the edge-on point.
        const dx = event.clientX - startX;
        if (Math.abs(dx) > 6) didDrag = true;
        heldDragYaw -= dx * 0.008;
        startX = event.clientX;
        startY = event.clientY;
        return;
      }
      if (!isDragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        didDrag = true;
        walkTween = null; // a real manual look-drag interrupts an in-progress auto-walk
      }
      targetYaw -= dx * 0.0035;
      targetPitch += dy * 0.0016;
      clampView();
      startX = event.clientX;
      startY = event.clientY;
    }

    function onPointerUp(event: PointerEvent) {
      // EK caught this live 2026-08-25: clicking "Update Hall"/"Save Hall"
      // in the sidebar sent the camera walking off toward a corner — root
      // cause had nothing to do with Save. This listener is deliberately
      // on `window`, not the canvas (so a look-drag that started on the
      // canvas still completes correctly even if the mouse drifts off it
      // before releasing) — but that means it ALSO fired for a pointerup
      // on ANY button anywhere on the page (Save, Organize, the Room
      // style dropdown, all of it), with no check that the click actually
      // started on the canvas. `didDrag` alone didn't catch this: it just
      // holds whatever value was left over from the LAST real canvas
      // interaction, so a sidebar click after a plain (non-drag) canvas
      // click read as `!didDrag` = true = "a clean tap" and fell into the
      // click-to-walk floor logic below, raycasting from that button's
      // own screen position (nowhere near the canvas) and walking to
      // wherever that ray happened to land, clamped into the room —
      // which is why it kept landing near a corner. `isDragging` is only
      // ever set true by the canvas's OWN pointerdown (never by a click
      // elsewhere on the page), so gating on it here means a pointerup
      // that didn't start on the canvas correctly does nothing instead.
      if (!isDragging) return;
      if (heldItem) {
        // Holding something? ANY click puts it back — a click that
        // dragged the item to rotate it (didDrag=true) is just the end
        // of that rotation, not a release; only a clean tap releases.
        // Consumed here, doesn't fall through to raycasting/walking below.
        if (!didDrag) putBackItem();
        isDragging = false;
        return;
      }
      if (!didDrag) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          [...meshesRef.current, ...doorwayMeshesRef.current],
          false
        )[0];
        walkTween = null; // any click/tap takes over camera control from an in-progress auto-walk
        // EK's ask: a display-case (flat) item's description panel has no
        // "put it back" pickup animation to close it (that's only the
        // wall-mounted heldItem path above) — it was a pure React-state
        // overlay with no dismiss trigger of its own, so it stayed open
        // through anything: clicking the floor, a doorway, Organize, all
        // of it. Every click that isn't a re-click of that exact item
        // closes it FIRST, before this same click does anything else —
        // clearing it here and letting a genuine item hit below set a new
        // id in the same tick is equivalent to "close old, then open new."
        if (selectedItemIdRef.current && hit?.object.userData.itemId !== selectedItemIdRef.current) {
          setSelectedItemId("");
        }
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
            // EK's ask (2026-08-22/23): wall-mounted items now lift off
            // the shelf into a held/inspect view instead of just moving
            // the camera to face them in place — see pickUpItem/
            // updateHeldItem above. Display-case items above keep the
            // old camera-focus behavior (scoped out, not forgotten).
            pickUpItem(itemId);
          }
        } else {
          // Click-to-walk floor navigation (EK's ask, matching bingebrowse.net's
          // "click a shelf area to move" — their own hint text confirms it's a
          // single click, not a hover-then-confirm, so this reuses the same
          // didDrag gate every other click here already uses to tell a tap from
          // a look-drag). No item/doorway was hit, so try the floor: intersect
          // the click ray against the y=0 plane and clamp it into the walkable
          // bounds — clampWalkDestination, not clampPosition, so a corner click
          // can't wedge you within ~2.7 units of two walls at once (see that
          // function's own comment). The journey is the two-phase walkTween
          // above (turn to face the destination, then walk) — EK's ask,
          // 2026-08-23: the walk used to ALSO force a final turn to face
          // whichever wall was nearest the destination, which read as "it
          // spins you to a position it thinks you want" right as you land up
          // close to that wall. Removed — the walk just ends facing the
          // direction you were walking.
          const floorHit = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(floorPlane, floorHit)) {
            clampWalkDestination(floorHit);
            floorHit.y = eyeHeight;
            startWalkTween(floorHit);
          }
        }
      }
      isDragging = false;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      moveCamera(event.deltaY > 0 ? "back" : "forward", 0.42);
    }

    function movementKeyToken(event: KeyboardEvent): string | null {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") return "forward";
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") return "back";
      if (event.key.toLowerCase() === "a") return "left";
      if (event.key.toLowerCase() === "d") return "right";
      if (event.key === "ArrowLeft") return "turn-left";
      if (event.key === "ArrowRight") return "turn-right";
      if (event.key === "Shift") return "shift";
      return null;
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;

      if (event.key === "Escape" && heldItem) {
        event.preventDefault();
        putBackItem();
        return;
      }

      const token = movementKeyToken(event);
      if (token) {
        event.preventDefault();
        pressedKeys.add(token);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const token = movementKeyToken(event);
      if (token) pressedKeys.delete(token);
    }

    // A held key's keyup can be missed entirely if focus leaves the window
    // while it's down (alt-tab, clicking a browser chrome element) — without
    // this, that key would read as permanently "held" until pressed again.
    function onWindowBlur() {
      pressedKeys.clear();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    resize();
    render();

    return () => {
      disposed = true;
      cameraStateRef.current = { x: cameraBody.x, y: cameraBody.y, z: cameraBody.z, yaw, pitch };
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
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
      environment.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [isOrganizing, palette.floor, palette.glow, palette.trim, palette.wall, roomLayout, roomStyle, showValues, slotDisplayNumber, slotItems, slotPositions, universeRoomsKey, viewMode, wallTextureUrl]);

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
      // Not auto-selecting the first item here anymore — see
      // handleSourceChange's own comment: loading a different exhibition
      // is "entering the room" too, and should land with nothing selected/
      // held, not the description panel already open on item #1.
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

  // Loads a previously saved Hall back into the builder, replacing
  // whatever's currently arranged — same full-replace semantics as picking
  // an Exhibition above, just restoring EVERY room field (style/layout/
  // wallpaper/shelf placement), not just an item list. Reads straight from
  // the already-loaded `halls` state (listMyHalls already fetched full
  // rows) rather than a second round trip.
  function applyHall(hallId: string) {
    const hall = halls.find((entry) => entry.id === hallId);
    if (!hall) {
      setSourceStatus({ ok: false, message: "Couldn't find that Hall." });
      return;
    }
    setCurrentHallId(hall.id);
    setGalleryId(hall.galleryId ?? "scratch");
    if (hall.roomStyle === "vault" || hall.roomStyle === "whitebox" || hall.roomStyle === "arcade" || hall.roomStyle === "blue") {
      setRoomStyle(hall.roomStyle);
    }
    if (hall.roomLayout === "storefront" || hall.roomLayout === "salon" || hall.roomLayout === "spotlight") {
      setRoomLayout(hall.roomLayout);
    }
    if (hall.viewMode === "room" || hall.viewMode === "overview") setViewMode(hall.viewMode);
    setShowValues(hall.showValues);
    setWallTextureUrl(hall.wallpaperUrl ?? "");
    // fillSlots is a plain positional copy (see its own definition) — safe
    // here because hall.selectedIds is already the full slot-length array
    // with "" gaps in their exact places, same as the local-draft restore
    // above does for the same reason.
    setSelectedIds(fillSlots(hall.selectedIds));
    // Same reasoning as applyGallery just above — no auto-selected item on load.
    setSourceStatus({ ok: true, message: `Loaded "${hall.title}".` });
  }

  // The Source dropdown's single onChange — EK's ask (2026-08-24) put "My
  // Halls" in the same dropdown as Empty Hall/Exhibitions rather than a
  // separate picker, so this is the one place that decides which of the
  // three kinds of option was picked. Choosing Empty Hall or an Exhibition
  // always starts a fresh (unsaved) arrangement — same as applyGallery
  // already did before Halls existed — so it clears currentHallId; only
  // explicitly picking a Hall continues editing a saved one.
  function handleSourceChange(value: string) {
    // Loading a different Hall or exhibition through Source is the same
    // kind of "entering a different room" as openUniverseRoom/openMainHall
    // — reset the camera and put down whatever's held instead of carrying
    // over wherever the LAST room's camera happened to be parked.
    cameraStateRef.current = null;
    setSelectedItemId("");
    if (value.startsWith("hall:")) {
      applyHall(value.slice(5));
      return;
    }
    setCurrentHallId(null);
    applyGallery(value);
  }

  // Kicks off the Save flow — EK caught the real gap here 2026-08-24:
  // the old version wrote to one fixed local-storage slot regardless of
  // what was open, never asked to name anything, and never touched the
  // account at all. Now: continuing an already-saved Hall just quietly
  // updates it; a brand-new room asks a question first (name it, or if it
  // started from an Exhibition, add to that Exhibition vs. spin off a
  // separately-named Hall).
  function handleSaveClick() {
    // Unrelated local safety net, unchanged — still protects against
    // losing in-progress work to an accidental reload before a real save.
    saveDraft();

    if (currentHallId) {
      void persistHall(currentHallId, null, galleryId === "scratch" ? null : galleryId);
      return;
    }
    if (galleryId !== "scratch") {
      const gallery = galleries.find((entry) => entry.id === galleryId);
      setHallNameInput(gallery?.title ?? "");
      setSaveModal({ step: "exhibition-choice", galleryId, galleryTitle: gallery?.title ?? "this Exhibition" });
    } else {
      setHallNameInput("");
      setSaveModal({ step: "name" });
    }
  }

  async function persistHall(hallId: string | null, title: string | null, linkGalleryId: string | null) {
    setIsSavingHall(true);
    try {
      let wallpaperUrl: string | null = wallTextureUrl || null;
      if (wallpaperUrl && wallpaperUrl.startsWith("data:")) {
        // A freshly-uploaded wallpaper is still a data: URL in state at
        // this point (see fileToRoomWallpaper) — upload it for real
        // before saving so the row holds a URL, not a multi-hundred-KB
        // blob (see uploadHallWallpaper's own comment for why). Fail
        // safe to no wallpaper rather than failing the whole save over
        // one image, or worse, writing the raw data: URL into the row.
        wallpaperUrl = await uploadHallWallpaper(wallpaperUrl);
      }
      const input = {
        galleryId: linkGalleryId,
        roomStyle,
        roomLayout,
        viewMode,
        showValues,
        selectedIds,
        wallpaperUrl,
      };
      if (hallId) {
        const ok = await updateHall(hallId, input);
        setSaveState(ok ? "saved" : "error");
        if (ok) {
          setHalls((current) =>
            current.map((h) => (h.id === hallId ? { ...h, ...input, updatedAt: new Date().toISOString() } : h))
          );
        }
      } else if (title) {
        const created = await createHall(title, input);
        if (created) {
          setCurrentHallId(created.id);
          setHalls((current) => [created, ...current.filter((h) => h.id !== created.id)]);
          setSaveState("saved");
        } else {
          setSaveState("error");
        }
      }
    } finally {
      setIsSavingHall(false);
      setSaveModal(null);
      window.setTimeout(() => setSaveState("idle"), 1800);
    }
  }

  function confirmSaveToExhibition() {
    if (!saveModal || saveModal.step !== "exhibition-choice") return;
    addItemIdsToGallery(saveModal.galleryId, selectedIds.filter(Boolean));
    void persistHall(null, saveModal.galleryTitle, saveModal.galleryId);
  }

  function confirmSaveAsNewHall() {
    const title = hallNameInput.trim();
    if (!title) return;
    const linkGalleryId = saveModal && saveModal.step === "exhibition-choice" ? saveModal.galleryId : null;
    void persistHall(null, title, linkGalleryId);
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

  // EK's ask: the first item picked goes into the exact slot whose "+"
  // was clicked; every item picked after that fills the next EMPTY slots
  // in order.
  //
  // EK caught a real bug here 2026-08-24: this used to walk forward
  // through the RAW global slot index (`cursor + 1`, wrapping at
  // `next.length`) — but a wall's slots are NOT contiguous in that raw
  // array (see slotGroups' own comment above: "WALL_CYCLE's interleaving
  // is deliberate"). So clicking slot #2 on the Left Wall and adding a
  // few more items scattered the overflow across whichever OTHER walls
  // happened to be interleaved next in the raw table, instead of landing
  // in that same wall's next empty slots (#3, #4, ...) the way it visibly
  // reads on screen. Fixed by walking `slotGroups`' own per-wall index
  // lists — same wall as the clicked slot first, in that wall's real
  // shelf-reading order — and only spilling into other walls' groups
  // once the clicked wall is completely full, so nothing still gets
  // silently dropped for an oversized collection.
  //
  // EK's ask (2026-08-23): the picker used to only offer items not
  // already placed somewhere in this room — "I should be able to select
  // any item that own... Then i have to do double the work" (remove it
  // via the Items sidebar first, THEN pick it). The picker now offers
  // every vault item, so an already-placed item can arrive here — clear
  // its OLD slot before assigning it its new one, or picking it would
  // just duplicate it into two slots at once instead of moving it.
  function fillFromSlot(startIdx: number, itemIds: string[]) {
    if (itemIds.length === 0) return;
    setSelectedIds((current) => {
      const next = [...current];
      for (const id of itemIds) {
        const existingIdx = next.indexOf(id);
        if (existingIdx !== -1) next[existingIdx] = "";
      }
      next[startIdx] = itemIds[0];
      let remaining = itemIds.slice(1);
      if (remaining.length > 0) {
        const ownGroup = slotGroups.find((g) => g.indices.includes(startIdx));
        const orderedGroups = ownGroup ? [ownGroup, ...slotGroups.filter((g) => g !== ownGroup)] : slotGroups;
        for (const group of orderedGroups) {
          if (remaining.length === 0) break;
          for (const idx of group.indices) {
            if (remaining.length === 0) break;
            if (idx === startIdx) continue;
            if (next[idx] === "") {
              next[idx] = remaining[0];
              remaining = remaining.slice(1);
            }
          }
        }
        // Last-resort fallback — slotGroups should already cover every
        // slot in the table, so this shouldn't normally trigger, but
        // it's here so a mismatch fails safe (lands the item somewhere)
        // instead of silently dropping it.
        if (remaining.length > 0) {
          for (let i = 0; i < next.length && remaining.length > 0; i++) {
            if (next[i] === "") {
              next[i] = remaining[0];
              remaining = remaining.slice(1);
            }
          }
        }
      }
      return next;
    });
    closeSlotPicker();
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

  function handleWallpaperUpload(file?: File | null) {
    if (!file) return;
    setWallpaperError("");
    void fileToRoomWallpaper(file)
      .then(setWallTextureUrl)
      .catch((error) => {
        setWallpaperError(error instanceof Error ? error.message : "Could not load wallpaper image.");
      });
  }

  // EK's ask (2026-08-23): "a guest should be view only" — a Scratch room
  // (building from your OWN vault, nothing published, no real exhibition
  // at stake) stays open to try regardless of sign-in — same low-stakes
  // sandbox it's always been. Loading a REAL, named exhibition through the
  // Source dropdown is the part that needs gating: only its actual owner
  // gets edit chrome for it. `effectiveGuest` is what every render branch
  // below checks instead of the raw `guest` prop, so "explicitly viewing
  // via /museum/virtual-room/guest" and "opened someone else's exhibition
  // without owning it" collapse to the exact same read-only treatment —
  // including the existing "Builder" link back out (below), so picking a
  // gallery you don't own doesn't strand you with no way to get edit
  // chrome back.
  const currentGallery = galleryId === "scratch" ? null : galleries.find((entry) => entry.id === galleryId) ?? null;
  const isOwnerOfCurrentGallery =
    galleryId === "scratch"
      ? true
      : Boolean(viewerProfileId) && currentGallery?.profile_id === viewerProfileId;
  const effectiveGuest = guest || !isOwnerOfCurrentGallery;

  // Guest view (EK's ask, 2026-08-21): the builder chrome above — Source
  // dropdown, Room settings, Items sidebar, Save Draft — is for the owner
  // arranging the room, not a visitor looking at it. A guest gets just the
  // 3D view, full-bleed below the site header, no bottom move/rotate pad
  // (click-to-walk + drag-look are the only navigation, matching the
  // reference site's own guest-facing experience). Same underlying scene/
  // state — only the surrounding chrome differs.
  // EK's ask (2026-08-21): the builder view forced a scroll — the room
  // was sized to "100% of screen height minus 116px" for the toolbar
  // above it, but that 116px was just a guess. The toolbar's real height
  // varies (Hero's expanded pill row, the new Guest button wrapping to a
  // second line, etc.), so whenever it grows past 116px the page becomes
  // taller than one screen and forces a small scroll to see the bottom.
  // A fixed min-height instead of a viewport-minus-guess calc can't ever
  // force that overflow, whatever the toolbar's actual height turns out
  // to be.
  //
  // EK caught a real bug here 2026-08-24: a plain navy strip of dead
  // space at the bottom of this rounded room panel, below the actual 3D
  // view. Root cause — this `<section>` sits next to `<aside>` in a CSS
  // grid row (`grid xl:grid-cols-[300px_minmax(0,1fr)]`), and grid items
  // default to `align-items: stretch`, so this section was being
  // stretched to match whatever height the sidebar's own content (all
  // of Arrange Shelf Order's wall slots — often much taller than one
  // room's worth of 3D view) happened to need. The `<div>`s inside only
  // guarantee a 600px MINIMUM height, so they stayed at their own
  // natural ~600px, and the section's now-taller stretched box exposed
  // its own background color underneath as unused empty space. The
  // aside already opts out of this with `xl:self-start` (that's why it
  // sits at its own natural height instead of stretching); adding the
  // same here makes this section do the same instead of matching the
  // sidebar's height.
  const roomView = (
    <section
      className={[
        effectiveGuest
          ? "h-full overflow-hidden"
          : "min-h-[600px] overflow-hidden rounded-[8px] border shadow-[0_30px_90px_rgba(0,0,0,0.34)] xl:self-start",
        palette.shell,
      ].join(" ")}
      style={effectiveGuest ? undefined : { borderColor: "var(--theme-border)" }}
    >
      <div className={effectiveGuest ? "h-full" : "min-h-[600px]"}>
        <div className={effectiveGuest ? "relative h-full" : "relative min-h-[600px]"}>
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
            {effectiveGuest ? (
              // Guest view had no way back to the builder at all — Exit
              // only reaches the campus map, and the map has no link back
              // to the setup page either, so a guest visitor was stuck in
              // a room<->map loop with no escape. EK caught this live. Also
              // the escape hatch for "picked a gallery you don't own" —
              // this always points at a fresh /museum/virtual-room load,
              // which remounts back to Scratch, not whatever gallery just
              // collapsed the chrome.
              <Link
                href="/museum/virtual-room"
                className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                title="Back to the room builder"
              >
                <PackagePlus size={14} />
                Builder
              </Link>
            ) : null}
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
            ) : (
              // Was missing entirely — landing in the map with no way back
              // into the room, worst in guest view where there's no
              // sidebar/Rooms dropdown to fall back on. EK flagged it live.
              <button
                type="button"
                onClick={enterRoomFresh}
                className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                title="Back to the room"
              >
                <Sparkles size={14} />
                Back to Room
              </button>
            )}
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
            {/* EK's ask (2026-08-23): moved here from the Items panel header —
                this toggle only ever affected the 3D view (the floating slot
                badges/ghost outlines below) and the sidebar's own content, so
                it reads more naturally next to the room's other view toggles
                than buried in a sidebar section header. */}
            {viewMode === "room" && !effectiveGuest ? (
              <button
                type="button"
                onClick={() => {
                  setIsOrganizing((current) => !current);
                  setDragIndex(null);
                  setDragOverIndex(null);
                  setSelectedItemId("");
                }}
                aria-pressed={isOrganizing}
                className={[
                  "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition",
                  isOrganizing
                    ? "bg-[#4FD3EE] text-[#06171d]"
                    : "bg-black/42 text-white ring-1 ring-white/12 hover:bg-black/60",
                ].join(" ")}
                title="Show slot numbers and rearrange shelves"
              >
                <Grid3X3 size={14} />
                {isOrganizing ? "Done" : "Organize"}
              </button>
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
          {viewMode === "room" && selectedItemId && heldVaultItem ? (
            // EK's ask, styled after a reference screenshot: a description
            // panel on the left (its own header label in a different
            // color — the "side title, different color" line, not a
            // separate floating tag) and a bottom title/info/share bar.
            // Real per-item VaultItem fields, never invented text.
            <>
              <div className="pointer-events-none absolute left-5 top-1/2 w-[340px] -translate-y-1/2 rounded-[10px] bg-black/55 p-4 text-xs leading-5 text-white/80 ring-1 ring-white/15 backdrop-blur">
                <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: THEME_BLUE }}>
                  Description
                </div>
                {heldVaultItemDescription}
                {heldVaultItemInfoRows.length > 0 ? (
                  <div className="mt-3 border-t border-white/15 pt-3">
                    {heldVaultItemInfoRows.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-3 py-0.5 text-[11px]">
                        <span className="uppercase tracking-[0.08em] text-white/50">{row.label}</span>
                        <span className="text-right font-bold text-white/85">{row.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="pointer-events-auto absolute bottom-5 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-[10px] bg-black/60 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur">
                <div className="min-w-0">
                  {heldVaultItemDisplayTitle ? (
                    <div className="truncate text-sm font-black text-white">{heldVaultItemDisplayTitle}</div>
                  ) : null}
                  {heldVaultItemBasics.length > 0 ? (
                    <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                      {heldVaultItemBasics.join(" · ")}
                    </div>
                  ) : null}
                </div>
                {/* EK's ask (2026-08-24/25): owner gets a way to fill in
                    missing fields (this exact panel is what surfaced the
                    blank-title case) without leaving the room; a viewer
                    gets a link to the item's real public page, but only
                    when the owner actually marked it Public — otherwise a
                    quick inline notice instead of a dead link. */}
                {!effectiveGuest ? (
                  <Link
                    href={`/vault/item/${heldVaultItem.id}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
                    title="Edit this item"
                    aria-label="Edit this item"
                  >
                    <Pencil size={12} />
                  </Link>
                ) : (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (heldVaultItem.isPublic) {
                          window.open(`/share/${heldVaultItem.id}`, "_blank", "noopener,noreferrer");
                        } else {
                          setPrivateItemNotice(true);
                          window.setTimeout(() => setPrivateItemNotice(false), 2600);
                        }
                      }}
                      className="grid h-6 w-6 place-items-center rounded-[6px] bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
                      title="View this item"
                      aria-label="View this item"
                    >
                      <ExternalLink size={12} />
                    </button>
                    {privateItemNotice ? (
                      <div className="absolute bottom-full right-0 z-10 mb-2 w-max max-w-[220px] rounded-[6px] bg-black/90 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-white ring-1 ring-white/15">
                        This user isn&apos;t sharing more details on this item right now.
                      </div>
                    ) : null}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSocialShareOpen(true)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
                  title="Share this item"
                  aria-label="Share this item"
                >
                  <Share2 size={12} />
                </button>
              </div>
              {socialShareOpen
                ? createPortal(
                    <SocialExportSheet
                      item={heldVaultItem}
                      onClose={() => setSocialShareOpen(false)}
                    />,
                    document.body
                  )
                : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );

  if (effectiveGuest) {
    return (
      <div className="fixed inset-x-0 bottom-0 text-[color:var(--fg)]" style={{ top: "var(--topnav-h)" }}>
        {roomView}
      </div>
    );
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-3 sm:px-6 sm:py-4">
        {/* Top bar: identity + Source + Room settings, side by side, full width —
            keeps the 3D room from being squeezed next to a tall stacked sidebar.
            flex, not grid-with-1fr: the Room card sizes to its own pill row
            instead of stretching to fill the leftover row width, which just
            left a huge empty gap next to a small cluster of pills. */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-[300px] shrink-0 rounded-[8px] border bg-[color:var(--theme-card)] p-3 shadow-[var(--shadow-soft)]" style={{ borderColor: "var(--theme-border)" }}>
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
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href="/museum/virtual-room/guest"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[color:var(--pill)] px-2.5 text-xs font-black ring-1 ring-[color:var(--border)]"
                  title="View as a guest would — full screen, no builder controls"
                >
                  <Eye size={14} />
                  Guest
                </Link>
                <Link
                  href="/museum"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]"
                  aria-label="Back to exhibitions"
                  title="Back to exhibitions"
                >
                  <GalleryHorizontalEnd size={15} />
                </Link>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Metric icon={<Boxes size={13} />} label="Items" value={String(selectedItems.length)} />
              <Metric icon={<BadgeDollarSign size={13} />} label="Value" value={formatMoney(selectedValue) || "$0"} />
              <Metric icon={<Eye size={13} />} label="Mode" value="3D" />
            </div>
          </div>

          <div className="w-[260px] shrink-0">
            <ControlPanel title="Source" icon={<Grid3X3 size={15} />}>
              <select
                value={currentHallId ? `hall:${currentHallId}` : galleryId}
                onChange={(event) => handleSourceChange(event.target.value)}
                className="h-8 w-full rounded-[6px] bg-[color:var(--input)] px-2.5 text-xs ring-1 ring-[color:var(--border)]"
              >
                <option value="scratch">Empty Hall</option>
                {galleries.length > 0 ? (
                  <optgroup label="Exhibitions">
                    {galleries.map((gallery) => (
                      <option key={gallery.id} value={gallery.id}>
                        {gallery.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {halls.length > 0 ? (
                  <optgroup label="My Halls">
                    {halls.map((hall) => (
                      <option key={hall.id} value={`hall:${hall.id}`}>
                        {hall.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
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
          </div>

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
                    onChange={(value) => (value === "room" ? enterRoomFresh() : setViewMode(value as ViewMode))}
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
                <select
                  value={roomStyle}
                  onChange={(event) => setRoomStyle(event.target.value as RoomStyle)}
                  className="h-6 w-auto rounded-[5px] bg-[color:var(--input)] px-2 text-[10px] font-black leading-none ring-1 ring-[color:var(--border)]"
                >
                  <option value="vault">Vault</option>
                  <option value="whitebox">White</option>
                  <option value="arcade">Arcade</option>
                  <option value="blue">Blue</option>
                </select>
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
            // EK's ask (2026-08-23): "I really don't see the use for the
            // Items Pill... that can be done in the organize window in an
            // easier less space taking way" — real gap check first, not
            // just agreeing: the ONE thing the flat on/off list did that
            // this grid didn't was let you pull an item off a shelf
            // WITHOUT immediately putting something else there. Added that
            // as a real "×" remove control on every filled cell below
            // instead of keeping a whole separate list around for it — the
            // grid (add via "+", move via drag, remove via "×") now covers
            // everything the flat list did, so it's retired for good, not
            // just hidden. The Organize/Done toggle itself moved to the
            // room's own toolbar (it only ever affected the 3D badges +
            // this always-visible grid, not two different sidebar views).
            title="Arrange Shelf Order"
            icon={<PackagePlus size={15} />}
          >
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
                                {slotDisplayNumber.get(idx) ?? idx + 1}
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
                              {!item ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSlotPicker(idx);
                                  }}
                                  aria-label="Add an item to this spot"
                                  className="absolute inset-0 grid place-items-center text-[color:var(--muted2)] transition hover:bg-[rgba(79,211,238,0.12)] hover:text-[#4FD3EE]"
                                >
                                  <Plus size={14} />
                                </button>
                              ) : (
                                // The one real job the old flat Items on/off
                                // list did that this grid didn't: pull an
                                // item off its shelf without also having to
                                // put something else there. toggleItem
                                // already clears a slot when the id is
                                // already present — same call the old list's
                                // own "ON" pill made.
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(item.id);
                                  }}
                                  aria-label={`Remove ${item.title} from this spot`}
                                  className="absolute right-0.5 top-0.5 z-[1] grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white/70 opacity-0 transition hover:bg-red-500/80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                                  style={{ opacity: undefined }}
                                >
                                  <span aria-hidden className="text-[10px] leading-none">✕</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
            </div>
          </ControlPanel>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSavingHall}
            className={[
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-black shadow-[0_0_18px_rgba(79,211,238,0.22)] disabled:opacity-60",
              saveState === "error"
                ? "bg-red-400 text-[#2a0505]"
                : "bg-[linear-gradient(180deg,#79E7FB,#2CB1D1)] text-[#06171d]",
            ].join(" ")}
          >
            <Save size={16} />
            {saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save Failed"
                : currentHallId
                  ? "Update Hall"
                  : "Save Hall"}
          </button>
        </aside>

        {roomView}
        </div>
      </div>
      {pickerSlotIdx !== null
        ? createPortal(
            // EK's ask: this should read as an actual pop-up (a dimmed
            // backdrop behind a contained sheet), not a blank full-page
            // takeover, and needs to work on mobile — reusing the exact
            // backdrop/sheet/handle pattern SocialExportSheet.tsx already
            // uses elsewhere in this app (bottom sheet + handle on
            // mobile, a centered rounded dialog on desktop) instead of
            // inventing a new one. Position/inset/z-index stay inline
            // style, not Tailwind classes — see the `body > *` cascade
            // note above fillFromSlot for why a body-portaled element's
            // `fixed` class alone isn't safe here.
            <div
              className="flex items-end justify-center p-0 sm:items-center sm:p-4"
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 95 }}
            >
              <button
                type="button"
                onClick={closeSlotPicker}
                aria-label="Close"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <div
                className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl ring-1 sm:max-w-4xl sm:rounded-3xl"
                style={{ background: "var(--bg, #060a13)", borderColor: "var(--theme-border)" }}
              >
              {/* Drag handle — mobile bottom-sheet affordance only */}
              <div className="flex justify-center pb-1 pt-3 sm:hidden">
                <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
              </div>
              {/* Row 1: close + title + selected counter */}
              <div className="flex shrink-0 items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={closeSlotPicker}
                  aria-label="Close"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--pill)] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-[15px] w-[15px]">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">
                    Add to slot #{slotDisplayNumber.get(pickerSlotIdx) ?? pickerSlotIdx + 1}
                  </div>
                  <div className="truncate text-[11px] text-[color:var(--muted)]">
                    The first pick goes here — the rest fill the next open spots. Picking an item already on a shelf moves it.
                  </div>
                </div>
                <div
                  className={[
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ring-1",
                    pickerSelection.length > 0
                      ? "bg-[rgba(79,211,238,0.16)] text-[#4FD3EE] ring-[rgba(79,211,238,0.4)]"
                      : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]",
                  ].join(" ")}
                >
                  {pickerSelection.length} selected
                </div>
              </div>

              {/* Controls bar — same shape as the Vault's Wall view: search +
                  size slider + count, universe pills w/ counts, A-Z jump. */}
              <div className="shrink-0 px-3 pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="search"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search vault…"
                    className="h-8 w-40 rounded-full bg-[color:var(--pill)] px-3 text-[13px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] outline-none placeholder:text-[color:var(--muted)] focus:ring-[#4FD3EE]/50"
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-[color:var(--muted)]">Size</span>
                    <input
                      type="range"
                      min={3}
                      max={10}
                      value={pickerCols}
                      onChange={(e) => setPickerCols(Number(e.target.value))}
                      className="w-24 accent-[#4FD3EE]"
                    />
                  </div>
                  <span className="text-[11px] text-[color:var(--muted)]">{pickerFiltered.length} items</span>
                </div>

                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  <button
                    type="button"
                    onClick={() => setPickerUniverses(new Set())}
                    className={[
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
                      pickerUniverses.size === 0
                        ? "bg-[rgba(79,211,238,0.16)] text-[#4FD3EE] ring-[rgba(79,211,238,0.4)]"
                        : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)] hover:text-[color:var(--fg)]",
                    ].join(" ")}
                  >
                    All ({pickerAllItems.length})
                  </button>
                  {PICKER_UNIVERSE_ORDER.map((key) => {
                    const count = pickerUniverseCounts[key] ?? 0;
                    if (count === 0) return null;
                    const active = pickerUniverses.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePickerUniverse(key)}
                        className={[
                          "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
                          active
                            ? "bg-[rgba(79,211,238,0.16)] text-[#4FD3EE] ring-[rgba(79,211,238,0.4)]"
                            : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)] hover:text-[color:var(--fg)]",
                        ].join(" ")}
                      >
                        {PICKER_SHORT_LABEL[key]} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex gap-0.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  {PICKER_LETTERS.map((letter) => {
                    const active = pickerActiveLetters.has(letter);
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={!active}
                        onClick={() => jumpToPickerLetter(letter)}
                        className={[
                          "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold transition",
                          active
                            ? "text-[color:var(--muted)] hover:bg-[rgba(79,211,238,0.16)] hover:text-[#4FD3EE]"
                            : "cursor-default text-[color:var(--muted2)] opacity-40",
                        ].join(" ")}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thumbnail grid, grouped A-Z */}
              <div className="min-h-0 flex-1 overflow-y-auto px-3">
                {pickerFiltered.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-[color:var(--muted)]">
                    {pickerAllItems.length === 0
                      ? "Your vault is empty — add items to it first."
                      : "No items matched."}
                  </div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {PICKER_LETTERS.map((letter) => {
                      const group = pickerGrouped[letter];
                      if (!group?.length) return null;
                      return (
                        <div key={letter} ref={(el) => { pickerLetterRefs.current[letter] = el; }}>
                          <div className="mb-1.5 text-[11px] font-bold tracking-[0.2em] text-[color:var(--muted2)]">
                            {letter}
                          </div>
                          <div
                            className="grid gap-1.5"
                            style={{ gridTemplateColumns: `repeat(${pickerCols}, minmax(0, 1fr))` }}
                          >
                            {group.map((item) => {
                              const order = pickerSelection.indexOf(item.id);
                              const selected = order !== -1;
                              const currentSlot = pickerCurrentSlotLabel.get(item.id);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    setPickerSelection((current) =>
                                      current.includes(item.id)
                                        ? current.filter((id) => id !== item.id)
                                        : [...current, item.id]
                                    )
                                  }
                                  aria-pressed={selected}
                                  aria-label={item.title}
                                  className={[
                                    "group relative block overflow-hidden rounded-[6px] bg-black/30 text-left transition",
                                    selected ? "ring-2 ring-[#4FD3EE]" : "ring-1 ring-[color:var(--border)] hover:ring-[color:var(--muted)]",
                                  ].join(" ")}
                                  style={{ aspectRatio: "2/3" }}
                                >
                                  {itemImage(item) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={itemImage(item)} alt="" className="h-full w-full object-cover" draggable={false} />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase tracking-widest text-[color:var(--muted2)]">
                                      No photo
                                    </div>
                                  )}
                                  {currentSlot !== undefined ? (
                                    // EK's ask: picking any owned item, including
                                    // one already on a shelf, is now normal — this
                                    // just makes it clear a click here MOVES it
                                    // rather than duplicating it somewhere new.
                                    <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-white/85 ring-1 ring-white/20">
                                      {currentSlot}
                                    </span>
                                  ) : null}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-1 pb-1 pt-4">
                                    <p className="line-clamp-2 text-center text-[9px] font-semibold leading-tight text-white">
                                      {item.title}
                                    </p>
                                  </div>
                                  {selected ? (
                                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#4FD3EE] text-[10px] font-black text-[#06171d]">
                                      {order + 1}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--theme-border)" }}>
                <button
                  type="button"
                  disabled={pickerSelection.length === 0}
                  onClick={() => fillFromSlot(pickerSlotIdx, pickerSelection)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full py-3 text-sm font-black transition disabled:opacity-35"
                  style={{ background: "linear-gradient(180deg,#79E7FB,#2CB1D1)", color: "#06171d" }}
                >
                  <Plus size={14} />
                  {pickerSelection.length > 0 ? `Add ${pickerSelection.length}` : "Select items to add"}
                </button>
              </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {saveModal
        ? createPortal(
            // Same backdrop/sheet shell as the slot picker above — a real
            // pop-up, not a blank full-page takeover, and it works on
            // mobile the same way.
            <div
              className="flex items-end justify-center p-0 sm:items-center sm:p-4"
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 96 }}
            >
              <button
                type="button"
                onClick={() => setSaveModal(null)}
                aria-label="Close"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <div
                className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl ring-1 sm:rounded-3xl"
                style={{ background: "var(--bg, #060a13)", borderColor: "var(--theme-border)" }}
              >
                <div className="flex justify-center pb-1 pt-3 sm:hidden">
                  <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
                </div>
                <div className="p-5">
                  {saveModal.step === "exhibition-choice" ? (
                    <>
                      <div className="text-sm font-black">Save this room</div>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        This room started from &quot;{saveModal.galleryTitle}&quot;. Add whatever you&apos;ve placed
                        into that Exhibition, or save this as its own separate Hall instead?
                      </p>
                      <button
                        type="button"
                        disabled={isSavingHall}
                        onClick={confirmSaveToExhibition}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[6px] py-2.5 text-sm font-black disabled:opacity-50"
                        style={{ background: "linear-gradient(180deg,#79E7FB,#2CB1D1)", color: "#06171d" }}
                      >
                        Add to &quot;{saveModal.galleryTitle}&quot;
                      </button>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="h-px flex-1" style={{ background: "var(--theme-border)" }} />
                        <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--muted)]">
                          or save as a new Hall
                        </span>
                        <div className="h-px flex-1" style={{ background: "var(--theme-border)" }} />
                      </div>
                      <input
                        value={hallNameInput}
                        onChange={(event) => setHallNameInput(event.target.value)}
                        placeholder="Hall name"
                        className="mt-3 h-10 w-full rounded-[6px] bg-[color:var(--input)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingHall || !hallNameInput.trim()}
                        onClick={confirmSaveAsNewHall}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-[6px] border py-2.5 text-sm font-black disabled:opacity-40"
                        style={{ borderColor: "var(--theme-border)", color: "var(--fg)" }}
                      >
                        Save as New Hall
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-black">Name this Hall</div>
                      <p className="mt-1 text-xs text-[color:var(--muted)]">
                        Give this room a name so you can find and reopen it later from the Source dropdown.
                      </p>
                      <input
                        value={hallNameInput}
                        onChange={(event) => setHallNameInput(event.target.value)}
                        placeholder="e.g. My Trading Card Room"
                        autoFocus
                        className="mt-3 h-10 w-full rounded-[6px] bg-[color:var(--input)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isSavingHall || !hallNameInput.trim()}
                        onClick={confirmSaveAsNewHall}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[6px] py-2.5 text-sm font-black disabled:opacity-50"
                        style={{ background: "linear-gradient(180deg,#79E7FB,#2CB1D1)", color: "#06171d" }}
                      >
                        Save Hall
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
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
