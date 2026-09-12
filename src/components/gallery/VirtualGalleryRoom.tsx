"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BadgeDollarSign,
  Boxes,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  ExternalLink,
  Eye,
  GalleryHorizontalEnd,
  Grid3X3,
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
  renameHall,
  updateHall,
  uploadHallWallpaper,
  type VirtualRoomRow,
} from "@/lib/virtualRooms";
import { getPrimaryImageUrl, loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import SocialExportSheet from "@/components/SocialExportSheet";
import MuseumCampusOverview from "./MuseumCampusOverview";
import { getMyAdminRole } from "@/lib/adminAuth";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createGalleryFinishes, type GalleryFinishStyle } from "./galleryRoomFinishes";
import { createGrainTexture, createHardwoodTexture } from "./galleryTextures";
import {
  aimCamera,
  applyDrag,
  easeTowardTargets,
  facingDirection as sharedFacingDirection,
  strafeDirection as sharedStrafeDirection,
  WHEEL_STEP,
} from "@/lib/visitorController";
import {
  CABINET_SPOTS,
  FRONT_WALL_ITEM_Z,
  FRONT_WALL_PANEL_SEAM_BASE_Z,
  FRONT_WALL_PUSH_BACK,
  SHELF_ROW_Y,
  TOTAL_SLOT_COUNT,
  buildPositions,
  fillSlots,
  makeEmptySlots,
  shelfItemY,
  type RoomItemPosition,
  type RoomLayout,
} from "@/lib/galleryRoomSlots";
import { OrganizeMoveMenu, OrganizeReplaceConfirm, OrganizeSlotOverlay, useSlotOrganizer } from "./organizeSlots";

// The app's real theme blue — same tone/text pairing as the "Save Room
// Draft" button's own gradient (`#79E7FB`→`#2CB1D1`) and dark text
// (`#06171d`), not a guessed hex. Used for the held-item spine label.
const THEME_BLUE = "#79E7FB";
const THEME_BLUE_TEXT = "#06171d";

// "blue" is the original hand-coded room (navy walls, brass door frame,
// walnut floor) that used to BE the Vault look before the GLB pipeline —
// it never loads a .glb, it's the fallback shell shown permanently. See
// HANDOFF.md "Room styles" for the full vault/whitebox/arcade/blue map.
// "loft" (Industrial Loft) is a frozen snapshot of Vault's own look as of
// commit 4f64dff, saved as its own independent style per EK's 2026-09-06
// handoff so Vault can keep evolving without moving the room EK already
// approved — it shares Vault's real GLB (same file, see ROOM_MODEL_URLS)
// but suppresses the model's baked ornate door surround.
type RoomStyle = "vault" | "whitebox" | "arcade" | "blue" | "loft";
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
// "blue" has no entry — it's the hand-coded shell shown permanently, with
// no GLB to load at all. See the RoomStyle type above for what that means.
const ROOM_MODEL_URLS: Partial<Record<RoomStyle, string>> = {
  vault: "/models/gallery-rooms/vault-room.glb?v=front-wall-pushback-all-styles-2026-08-30",
  whitebox: "/models/gallery-rooms/whitebox-room.glb?v=front-wall-pushback-all-styles-2026-08-30",
  arcade: "/models/gallery-rooms/arcade-room.glb?v=front-wall-pushback-all-styles-2026-08-30",
  // Industrial Loft reuses Vault's exact GLB (same file, same cache entry) —
  // its only geometry difference is hiding the baked door surround, done at
  // render time below, not a separate model.
  loft: "/models/gallery-rooms/vault-room.glb?v=front-wall-pushback-all-styles-2026-08-30",
};

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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
  // "Blue" used to alias Vault's palette exactly — same navy wall, but also
  // Vault's own cool steel-gray trim (0xa8b0b8), which reads as a second
  // steel room rather than its own identity. EK's refinement-pass ask
  // (2026-09-06): "navy and warm accents for Blue." Keeps the navy wall and
  // walnut floor (both already right for "navy"), gives it its own warm
  // gold trim/glow instead of borrowing Vault's cool one — this is the one
  // real difference between the two now, not a copy.
  if (style === "blue") {
    return {
      wall: 0x24405f,
      floor: 0x8a6238,
      trim: 0xc9a24a,
      glow: 0xf2d9a0,
      textTone: "text-white",
      shell: "bg-[radial-gradient(circle_at_50%_0%,rgba(201,162,74,0.14),transparent_34%),linear-gradient(180deg,#24405f,#0a1220)] text-white",
    };
  }
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

  if (style === "loft") {
    // Industrial Loft — a frozen copy of Vault's own accent palette below
    // (2026-09-06 handoff), independent on purpose so Vault's own entry can
    // keep changing without moving Loft.
    return {
      wall: 0x24405f,
      floor: 0x8a6238,
      trim: 0xa8b0b8,
      glow: 0xdfe8f0,
      textTone: "text-white",
      shell: "bg-[radial-gradient(circle_at_50%_0%,rgba(159,184,214,0.14),transparent_34%),linear-gradient(180deg,#24405f,#0a1220)] text-white",
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
  // EK's ask (2026-08-30): "it still flashes several times like its
  // loading." Real cause: the mount effect's own dependency list
  // includes things that change more than once during a normal room
  // load (slotItems/slotPositions as saved data arrives, palette,
  // showValues, isOrganizing) — every change tears the whole scene down
  // and re-fetches + re-parses the SAME GLB from scratch, each one its
  // own hide-then-show flash. A ref (survives across re-runs, unlike
  // effect-local state) caches the fully processed model per URL so
  // every re-run after the first reuses it instantly instead of
  // re-fetching, with no gap to flash during.
  const loadedModelCacheRef = useRef<Map<string, THREE.Group>>(new Map());
  // Rearranging items (or flipping Values/Style/Wallpaper) rebuilds the whole
  // Three.js scene — without this, that rebuild silently reset the camera to the
  // default spawn every time, which is why one drag in Arrange used to throw you
  // back to the entrance. Persists across rebuilds; only entering a genuinely
  // different room (openUniverseRoom/openMainHall) clears it back to a fresh spawn.
  const cameraStateRef = useRef<{ x: number; y: number; z: number; yaw: number; pitch: number } | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [galleryId, setGalleryId] = useState("scratch");
  // Real cloud-saved rooms ("Halls" in the UI) — EK's ask 2026-08-24, see
  // virtualRooms.ts. `currentHallId` is set once this room IS a saved Hall
  // (just created, or loaded from the "My Halls" group in Source) — while
  // set, Save quietly updates that same row instead of asking to name a
  // new one.
  const [halls, setHalls] = useState<VirtualRoomRow[]>([]);
  const [currentHallId, setCurrentHallId] = useState<string | null>(null);
  // The Map now shows the real, shared VLTD Museum (see MuseumCampusOverview's
  // own comment) — per EK's 2026-09-11 correction, that shared museum and its
  // map stay admin/owner-only for now, same gate already used across every
  // other admin surface in this app. Ordinary accounts keep Room mode only.
  const [isMuseumMapAdmin, setIsMuseumMapAdmin] = useState(false);
  const [saveModal, setSaveModal] = useState<
    { step: "name" } | { step: "exhibition-choice"; galleryId: string; galleryTitle: string } | null
  >(null);
  const [hallNameInput, setHallNameInput] = useState("");
  const [isSavingHall, setIsSavingHall] = useState(false);
  // 2026-09-11 Gallery Map / Room-Editing pass: set only when a room was
  // entered by clicking a real shape on the Map (not HUB, not the Source
  // dropdown, not "Back to Room") — this is what makes the Organize toggle's
  // "Done" state also flush a pending save and return to the Map, instead
  // of just leaving Organize mode in place the way it does for a room
  // entered any other way. Cleared on Done/Exit back to the Map.
  const [editRoomContext, setEditRoomContext] = useState<{ hallId: string } | null>(null);
  const [nameSaveState, setNameSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const nameSaveTimerRef = useRef<number | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  function announce(message: string) {
    // Re-announce the same text reliably even if it repeats (e.g. two
    // removals in a row) — a live region only fires for screen readers on
    // an actual text change, so a leading space forces that.
    setLiveAnnouncement((current) => (current === message ? `${message} ` : message));
  }
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
  const [selectedIds, setSelectedIds] = useState<string[]>(() => fillSlots([]));
  // EK's ask (2026-08-30): "it flashes blue, blank, purple no items, purple
  // with items" — the mount effect below restores state in real stages (the
  // hardcoded "vault" default, then the localStorage draft's real style/items
  // synchronously, then the actual cloud vault items async) and the 3D scene
  // effect rebuilds + reveals itself from scratch on EVERY one of those
  // changes, each one a real network-and-render cycle long enough to see.
  // Root cause isn't "reveal too abruptly" (already fixed once) — it's
  // revealing a legitimately different scene 3-4 times. Fix: don't reveal
  // (or even start loading a room GLB / building items) at all until this
  // flips true once, after the mount effect's whole restore sequence
  // (sync draft + async cloud sync) has actually settled — see its own
  // comment further down for how/when it flips.
  const [dataReady, setDataReady] = useState(false);
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
  // Same stale-closure reasoning as selectedItemIdRef above — the Three.js
  // scene's own click/raycast handler is set up once and does not have
  // isMuseumMapAdmin in its effect deps.
  const isMuseumMapAdminRef = useRef(isMuseumMapAdmin);
  useEffect(() => {
    isMuseumMapAdminRef.current = isMuseumMapAdmin;
  }, [isMuseumMapAdmin]);
  const [socialShareOpen, setSocialShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(true);
  const [hallNoticeDismissed, setHallNoticeDismissed] = useState(false);
  const [roomSwitcherOpen, setRoomSwitcherOpen] = useState(false);
  // 2026-09-11 in-room Organize overlay — replaces the old flat "Arrange
  // Shelf Order" sidebar. Its state/interaction (organizeSelectedSlot,
  // moveMenuFor, replaceConfirm, drag/touch handling, the overlay JSX
  // itself) now lives in organizeSlots.tsx's useSlotOrganizer() — see the
  // `organizer` const below (Shared Museum Room Editor consolidation pass,
  // 2026-09-12) — so the same Organize system can also drive the new
  // museum room popup. This file still owns its OWN slotItems/selectedIds
  // data model, passed into that shared hook via callbacks.
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
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
    if (pickerSlotIdx !== null) organizer.focusSlot(pickerSlotIdx);
    setPickerSlotIdx(null);
    setPickerSelection([]);
  }
  // Separate from the vault-items/galleries mount effect below (those are
  // synchronous local-cache reads; this is a real network round trip) —
  // populates the Source dropdown's "My Halls" group.
  useEffect(() => {
    void listMyHalls().then(setHalls);
  }, []);

  useEffect(() => {
    getMyAdminRole().then((role) => setIsMuseumMapAdmin(role !== null));
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
    // empty-room fallback and stayed there.
    // `draftAppliedSelectedIds` is set below, synchronously, before this
    // promise's `.then()` ever gets a chance to run — a saved draft's own
    // layout should win over auto-placing the newly-synced real items.
    let draftAppliedSelectedIds = false;
    // The 3D scene doesn't reveal anything until `dataReady` flips true (see
    // its own comment up by useState) — so the room shows once, fully
    // settled, instead of the vault-default -> draft-style -> synced-items
    // sequence each visibly rendering in turn. `markDataReady` fires once,
    // whichever comes first: the real cloud sync settling, or (defensively,
    // in case that hangs) a 4s timeout — never leave the room blank forever
    // over one slow/failed request.
    let dataReadySettled = false;
    const markDataReady = () => {
      if (dataReadySettled) return;
      dataReadySettled = true;
      setDataReady(true);
    };
    void syncVaultItemsFromSupabase().then((syncedItems) => {
      if (syncedItems.length === 0) return;
      setItems(syncedItems);
      // The synchronous load above had no cached items to work with (cold
      // cache) and no draft restored its own layout — safe to plant the
      // room with the user's real items now, the same initial-fill this
      // effect already does above when the cache happens to be warm.
      if (vaultItems.length === 0 && !draftAppliedSelectedIds) {
        setSelectedIds(fillSlots(syncedItems.slice(0, 12).map((item) => item.id)));
      }
    }).finally(markDataReady);
    const dataReadyFallback = window.setTimeout(markDataReady, 4000);

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
        draft.roomStyle === "blue" ||
        draft.roomStyle === "loft"
      ) {
        setRoomStyle(draft.roomStyle);
      }
      if (draft.roomLayout === "storefront" || draft.roomLayout === "salon" || draft.roomLayout === "spotlight") {
        setRoomLayout(draft.roomLayout);
      }
      if (draft.viewMode === "room" || draft.viewMode === "overview") {
        // The Map is the real, shared VLTD Museum — admin/owner only for now.
        // isMuseumMapAdmin may not have resolved yet this early (async), so
        // this can under-admit a genuine admin back into Room instead of Map
        // on load — safe direction to be wrong in; it never over-admits.
        setViewMode(draft.viewMode === "overview" && !isMuseumMapAdmin ? "room" : draft.viewMode);
      }
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

    return () => window.clearTimeout(dataReadyFallback);
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
  // Shared Museum Room Editor consolidation pass (2026-09-12): the personal
  // Gallery's own Organize overlay, now driven by the shared
  // useSlotOrganizer() hook (organizeSlots.tsx) instead of this file's own
  // copy of that state machine — see that file's module comment for exactly
  // what moved out of here. `onMove`/`onReplace` are identical (both just
  // move the dragged item's id into the destination slot and clear the
  // source), matching moveItemToSlot's non-replace branch and
  // confirmReplace's mutation in the pre-extraction version of this file.
  const organizer = useSlotOrganizer({
    slotItems,
    slotDisplayNumber,
    announce,
    onMove: (fromIdx, toIdx) => {
      setSelectedIds((current) => {
        const next = [...current];
        next[toIdx] = next[fromIdx];
        next[fromIdx] = "";
        return next;
      });
    },
    onReplace: (fromIdx, toIdx) => {
      setSelectedIds((current) => {
        const next = [...current];
        next[toIdx] = next[fromIdx];
        next[fromIdx] = "";
        return next;
      });
    },
    onRemove: (idx) => {
      setSelectedIds((current) => {
        const next = [...current];
        next[idx] = "";
        return next;
      });
    },
  });
  // A stable alias for the rAF projection effect's dependency array below —
  // `organizer` itself is a fresh object every render, but `slotRefs` is the
  // exact same ref (from useSlotOrganizer's own useRef) every time, so
  // depending on this instead avoids re-running that effect on every render.
  const organizeSlotRefs = organizer.slotRefs;
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

    // EK's ask (2026-08-30): "it flashes blue, blank, purple no items,
    // purple with items" — each of those was a REAL scene, not a glitch:
    // this effect faithfully rebuilds from scratch every time roomStyle or
    // the item list changes, and the mount effect above sets those in
    // stages (hardcoded "vault" default -> localStorage draft's real
    // style/items, synchronously -> the actual cloud vault items, async).
    // Nothing to fix in the rebuild logic itself — the fix is to not run it
    // at all on the intermediate, not-yet-final states. `dataReady` (set by
    // that mount effect once its whole restore sequence has settled) gates
    // this: skip building/loading anything until the data behind it is the
    // real, final data, so there's one hidden wait then one correct reveal
    // instead of 3-4 visibly different ones.
    if (!dataReady) {
      container.innerHTML = "";
      container.style.opacity = "0";
      return;
    }

    container.innerHTML = "";
    meshesRef.current = [];
    doorwayMeshesRef.current = [];
    // EK's ask (2026-08-30): "why is it every time i open a room, its
    // blue first and then changes color and design, its very noticable."
    // Real cause: the fallback shell renders immediately (synchronously,
    // below) while the real GLB loads in the background, so every style
    // briefly shows the shell's own colors before the GLB's onLoad swaps
    // in the real materials. Hiding the container until the model is
    // ready (or immediately, for styles/hub views with no model to wait
    // on) trades that visible color-swap for a plain hidden-then-shown
    // reveal instead.
    container.style.opacity = "0";
    container.style.transition = "opacity 0.15s ease-out";

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
    // Arcade's own ask (2026-09-06 refinement pass): "dark surfaces" — it
    // was falling into the same bucket as vault/blue's "else" case at 0.98,
    // actually the BRIGHTEST exposure of any style, which is backwards for
    // a room whose own baked GLB materials are near-black on purpose (see
    // style_mats() in generate-gallery-room-models.py — arcade's wall is
    // (0.035, 0.025, 0.06), essentially black). Given its own branch instead
    // of sharing arcade's old default with nothing else.
    // Blue got its own branch in an earlier pass: its navy base color
    // (0x24405f) is much darker than Vault's, so the same bright shared
    // value that once read fine as "steel" on Vault renders Blue as a
    // bright medium blue instead of navy.
    //
    // Vault's own value is cut again here (2026-09-06 guarded second pass,
    // live desktop review): "very strong global light flattens the walls,
    // door, shelving, and artwork into nearly the same brightness... little
    // light hierarchy." Confirmed live via __vltdDebug that Vault and White
    // share the exact same 3 baked wall-wash spotlights (intensity 12
    // each) — White works fine with them because its own exposure/hemi/
    // key/warm stay low; Vault's were left much higher, compounding with
    // Vault's own (also darkened this pass) but still somewhat reflective
    // wall material. Brought down close to White's own values rather than
    // just nudged, now that Vault also gets its own addLighting() ceiling
    // rig (see below) to provide the deliberate exhibit pools instead.
    renderer.toneMappingExposure =
      roomStyle === "whitebox" ? 0.68 : roomStyle === "vault" ? 0.62 : roomStyle === "loft" ? 0.62 : roomStyle === "arcade" ? 0.6 : roomStyle === "blue" ? 0.75 : 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // The Grand Hall (empty, no items placed) always gets its own dark,
    // dramatically-spotlit look, independent of whichever room style is
    // selected — a fixed "front door" impression rather than something users
    // reskin like a normal room.
    const inHub = selectedItems.length === 0;
    // Vault and Arcade have real GLBs (same shared mesh-naming convention as
    // White's — floor_slab/case_cap/glass/shelf/corner_post/wall/rail/
    // baseboard — see generate-gallery-room-models.py's add_wall_panels(),
    // "shared by every style"), so the exact same apply()/addCaseDetails()
    // architecture that fixed White's flat textures and floating cases
    // reuses cleanly here, just with each style's own palette (steel+walnut
    // for Vault, dark surfaces + the arcade's own bronze/cyan accents for
    // Arcade — see PALETTES in galleryRoomFinishes.ts). Blue has no GLB at
    // all (ROOM_MODEL_URLS has no "blue" entry) — its fallback shell is
    // hand-built directly below and gets its own inline treatment instead.
    const finishStyle: GalleryFinishStyle | null =
      roomStyle === "whitebox" || roomStyle === "vault" || roomStyle === "arcade" || roomStyle === "loft" ? roomStyle : null;
    const galleryFinishes = finishStyle && !inHub ? createGalleryFinishes(finishStyle) : null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(inHub ? 0x04060a : roomStyle === "whitebox" ? 0xd5dbe1 : 0x05070b);
    scene.fog = new THREE.Fog(scene.background, 16, 32);
    let disposed = false;

    const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 80);
    camera.position.set(0, 3.6, -2.2);
    // Exposed so the Organize overlay's own (separate, lightweight) rAF
    // loop can project each slot's real 3D position to screen space every
    // frame without depending on this whole scene-rebuild effect.
    cameraRef.current = camera;

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    // Correction (2026-09-06 guarded Vault pass): checked live via
    // __vltdDebug rather than assuming — White and Vault's GLBs both bake
    // in the SAME 3 wall-wash spotlights (intensity 12 each), so those
    // aren't vault-specific "already has its own lights" — they're shared
    // infrastructure present in every GLB-based style. White already
    // proves this combination works: those 3 baked lights PLUS its own
    // addLighting() ceiling-track rig, on top of White's own low ambient.
    // Vault was missing that same deliberate ceiling-track rig entirely —
    // "no convincing visible lighting system or localized exhibit pools,
    // unlike White" — so it gets addLighting() too now. Arcade is left
    // alone for this pass (not reviewed/approved yet — see the brief).
    if (roomStyle === "whitebox" || roomStyle === "vault" || roomStyle === "loft") galleryFinishes?.addLighting(roomGroup);
    galleryFinishes?.addCaseDetails(roomGroup, CABINET_SPOTS);
    // EK's direct correction (2026-09-06, third round): the material-only
    // pass "still looks like the original gallery with different colors" —
    // a real architectural pass needed actual added geometry (ribs, seams,
    // rivets, a recessed-bay outline, deeper jambs by the door, a glowing
    // ceiling pattern), not just recolored materials. Vault-only, doesn't
    // touch shelf/item/door geometry or hit targets.
    if (roomStyle === "vault" || roomStyle === "loft") galleryFinishes?.addVaultArmor(roomGroup);
    roomGroupRef.current = roomGroup;

    const fallbackShell = new THREE.Group();
    roomGroup.add(fallbackShell);
    const shellObjects: THREE.Object3D[] = [];
    // TEMPORARY debug hook (2026-08-28, round 3) - diagnosing "item squares
    // behind the wall" near the left wall's back corner. Remove once
    // diagnosed.
    (window as unknown as { __vltdDebug?: unknown }).__vltdDebug = { scene, roomGroup, fallbackShell, shellObjects, camera };
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
    // Arcade and Blue each got their own (lower) branch in an earlier
    // pass, for the same reason Vault gets one now below — they previously
    // shared a bucket that washed their own materials out toward flat
    // pastel instead of dark/moody.
    //
    // Vault's own 3.9 is CUT here (2026-09-06 guarded second pass) — it
    // was left untouched in the overnight pass on the assumption Vault's
    // light steel base "already read fine" under it, but the guarded
    // live review found the opposite: this generic hemisphere fill,
    // combined with the shared baked wall-wash lights every GLB style has,
    // was flattening the whole room to one brightness with "little light
    // hierarchy." Brought down near White's own value; Vault keeps a touch
    // more than White (1.7 vs 1.5) for a slightly cooler, less airy feel.
    const hemi = new THREE.HemisphereLight(
      0xffffff,
      0x3a3a3a,
      inHub ? 2.6 : roomStyle === "whitebox" ? 1.5 : roomStyle === "vault" ? 1.3 : roomStyle === "loft" ? 1.3 : roomStyle === "arcade" ? 1.8 : roomStyle === "blue" ? 2.2 : 3.9
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
    // Vault cut the same way as hemi above, same reasoning.
    const key = new THREE.SpotLight(
      palette.glow,
      inHub ? 9.5 : roomStyle === "whitebox" ? 1.7 : roomStyle === "vault" ? 1.5 : roomStyle === "loft" ? 1.5 : roomStyle === "arcade" ? 2.2 : roomStyle === "blue" ? 3.4 : 7.2,
      26,
      Math.PI / 5,
      0.55,
      1.4
    );
    key.position.set(0, 7.4, 1.5);
    scene.add(key);
    const warm = new THREE.PointLight(
      palette.trim,
      // Cut from 3.5 in an earlier pass for Arcade; Vault's own 1.8 is cut
      // here for the same reason as hemi/key above — this sits close to
      // the entrance/door area and was adding to the same flattening wash.
      roomStyle === "arcade" ? 1.4 : roomStyle === "whitebox" ? 0.35 : roomStyle === "vault" ? 0.75 : roomStyle === "loft" ? 0.75 : 1.8,
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

    // Hero wall-notch flags: declared here (ahead of applyHeroNotchAndReveal's
    // use below) rather than down near addBackRowBoard/addSideRowBoard where
    // it's also read, because the cache-hit path below calls
    // applyHeroNotchAndReveal SYNCHRONOUSLY — a later `const heroNotch` would
    // throw "Cannot access before initialization" on any cache hit (the
    // loader.load callback path is async so it never hit this, which is why
    // the crash only showed up on repeat loads of the same style).
    const heroNotch =
      roomLayout === "spotlight"
        ? {
            back: selectedItems.length >= 1,
            left: selectedItems.length >= 2,
            right: selectedItems.length >= 3,
          }
        : { back: false, left: false, right: false };
    // Same reason as heroNotch above: also read synchronously inside
    // applyHeroNotchAndReveal on a cache hit, so it must be declared
    // before that function's first call, not down near addBackRowBoard.
    const HERO_NOTCH_HALF = 0.9;

    const modelUrl = ROOM_MODEL_URLS[roomStyle];
    if (inHub || !modelUrl) {
      // Nothing to wait for (hub view, or "blue"'s hand-coded shell with
      // no GLB at all) — reveal immediately, no hidden wait needed.
      container.style.opacity = "1";
    }
    // Applies the Hero-layout notched-shelf swap and reveals the room —
    // shared by both the cache-hit and freshly-loaded paths below, so a
    // cached model gets this re-applied fresh each time (heroNotch flags
    // can differ between re-runs) instead of baking a stale notch state
    // into the cache.
    function applyHeroNotchAndReveal(model: THREE.Group) {
      galleryFinishes?.apply(model);
      // Industrial Loft handoff (2026-09-06): Loft shares Vault's exact GLB
      // but must lose the model's own baked ornate door surround — the
      // "vault_door_anchor" group (54 real meshes: arch trim, posts, plates,
      // rivets, threshold, reveals, confirmed live via __vltdDebug this
      // session) — in favor of a plain squared industrial portal. Hiding the
      // one ancestor group is enough; Three.js skips every invisible
      // object's descendants during render, so none of the 54 sub-meshes
      // need to be found individually.
      if (roomStyle === "loft") {
        const doorAnchor = model.getObjectByName("vault_door_anchor");
        if (doorAnchor) doorAnchor.visible = false;
        if (galleryFinishes) {
          const portalZ = FRONT_WALL_PANEL_SEAM_BASE_Z + FRONT_WALL_PUSH_BACK - 0.02;
          const portalLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), galleryFinishes.dark);
          portalLeft.position.set(-1.85, 2.45, portalZ);
          roomGroup.add(portalLeft);
          const portalRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), galleryFinishes.dark);
          portalRight.position.set(1.85, 2.45, portalZ);
          roomGroup.add(portalRight);
          const portalHeader = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.18, 0.18), galleryFinishes.dark);
          portalHeader.position.set(0, 4.92, portalZ);
          roomGroup.add(portalHeader);
        }
      }
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
      container.style.opacity = "1";
    }

    if (!inHub && modelUrl) {
      const cachedModel = loadedModelCacheRef.current.get(modelUrl);
      if (cachedModel) {
        applyHeroNotchAndReveal(cachedModel.clone(true));
      } else {
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
                  if (roomStyle === "vault" || roomStyle === "loft") {
                    if (name.includes("floor")) {
                      material.color.setHex(0x24170f);
                      material.roughness = 0.62;
                      material.metalness = 0.02;
                    } else if (name.includes("wall")) {
                      material.color.setHex(0x777d7e);
                      material.roughness = 0.38;
                      material.metalness = 0.78;
                    } else if (name.includes("seam")) {
                      // Vault refinement handoff, THIRD correction — image 1
                      // reference: "darker recesses" on the arch surround.
                      // Darkened and de-metaled slightly so the seam reads
                      // as a shadowed gap, not another shiny groove.
                      material.color.setHex(0x16181a);
                      material.roughness = 0.62;
                      material.metalness = 0.6;
                    } else if (name.includes("vestibule")) {
                      material.color.setHex(0x303636);
                      material.roughness = 0.58;
                      material.metalness = 0.55;
                    } else if (name.includes("ceiling")) {
                      material.color.setHex(0x171a1b);
                      material.roughness = 0.82;
                      material.metalness = 0.18;
                    } else if (name.includes("rivet")) {
                      // "Clearer bolt heads" — lower roughness for a
                      // sharper specular catch, slightly brighter base.
                      material.color.setHex(0xc4cdce);
                      material.roughness = 0.22;
                      material.metalness = 0.92;
                    } else if (name.includes("steel") || name.includes("trim")) {
                      // "Brushed stainless or gunmetal... brighter curved
                      // edge highlights... controlled reflections that
                      // reveal its thickness" — cooler gunmetal tone, lower
                      // roughness than before for a sharper, more defined
                      // highlight along the arch's curved trim.
                      material.color.setHex(0x8f9799);
                      material.roughness = 0.24;
                      material.metalness = 0.9;
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
          // Cache a clean (untouched-visibility) clone BEFORE
          // applyHeroNotchAndReveal mutates this model's own mesh
          // visibility — future re-runs (same URL) clone this pristine,
          // already-tinted copy instead of re-fetching the GLB, and get
          // the notch logic re-applied fresh from current heroNotch flags.
          loadedModelCacheRef.current.set(modelUrl, model.clone(true));
          applyHeroNotchAndReveal(model);
        },
        undefined,
        () => {
          if (disposed) return;
          container.style.opacity = "1";
          fallbackShell.visible = true;
        }
      );
      }
    }

    // Flat matte plaster/paint finish for the gallery walls — the old vault
    // style had a noticeable metallic sheen (0.18) that read wrong once the
    // wall color moved from near-black to a painted sage. The Grand Hall
    // overrides to near-black navy regardless of style (see inHub above).
    // Blue (the one style with no GLB — see ROOM_MODEL_URLS) is the only
    // style whose walls are actually seen through this material long-term;
    // White/Vault/Arcade all overwrite it via galleryFinishes.wall the
    // moment their own finishes/GLB are ready. The grain texture here is
    // the same hue-agnostic fine-grain layer that fixed White's flat-wall
    // problem, reused so Blue isn't left with the plain flat color that
    // every other style already moved past in the 2026-09-06 refinement pass.
    const wallGrain = createGrainTexture();
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallGrain,
      bumpMap: wallGrain,
      bumpScale: 0.02,
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
    if (galleryFinishes) {
      floorMaterial.map?.dispose();
      floorMaterial.copy(galleryFinishes.floor);
      if (!wallTextureUrl) wallMaterial.copy(galleryFinishes.wall);
    }
    // Trim finish varies by style: Vault gets a real brushed-steel feel (it's
    // meant to evoke a bank vault door), White stays matte painted wood/
    // plaster, Arcade keeps its polished-chrome look.
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: palette.trim,
      roughness: roomStyle === "arcade" ? 0.34 : (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") ? 0.42 : 0.65,
      metalness: roomStyle === "arcade" ? 0.72 : (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") ? 0.55 : 0.08,
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
      color: roomStyle === "whitebox" ? 0xcfc6ac : (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") ? 0x4a545c : 0x252a30,
      roughness: 0.5,
      metalness: (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") ? 0.35 : 0.18,
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

    // EK's ask (2026-09-06, live screenshot): "residual of blue behind" the
    // vault entrance — this material was still sharing Blue's navy
    // (0x24405f) for the brief fallback-shell flash before Vault's real GLB
    // takes over, which read as a real bug once Vault's own materials
    // became steel/neutral tonight instead of the old flat-gray-everywhere
    // look that made the mismatch less noticeable. Vault gets its own
    // steel-neutral tone here now — Blue (no GLB, so this ISN'T just a
    // brief flash for it, it's what actually stays on screen) keeps navy.
    const doorSideMaterial = new THREE.MeshStandardMaterial({
      color: inHub ? 0x0a0e14 : roomStyle === "whitebox" ? 0xe0d9c4 : (roomStyle === "vault" || roomStyle === "loft") ? 0x8a9096 : roomStyle === "blue" ? 0x24405f : 0x111419,
      roughness: 0.68,
      metalness: (roomStyle === "vault" || roomStyle === "loft") ? 0.25 : roomStyle === "blue" ? 0.05 : 0.02,
    });
    if (wallTextureUrl) {
      void createImageTexture(wallTextureUrl, 1.4, 1).then((texture) => {
        doorSideMaterial.map = texture;
        doorSideMaterial.color.set(0xffffff);
        doorSideMaterial.needsUpdate = true;
      });
    }
    // Blue style: the entrance wall gets a floor-to-ceiling ARCH cutout
    // (straight sides + a rounded top, reaching the floor — a real walkable
    // passage) instead of a full circle floating mid-wall. Vault no longer
    // uses this shape at all (see the removed-door comment below) — its
    // real GLB bakes its own complete, correctly-positioned entrance.
    const archHalfWidth = 1.7;
    const archStraightHeight = 3.25;

    // EK's ask (2026-09-06, live screenshot circling all three): the arched
    // cutout + gold architrave + circular vault-door prop below were all
    // built here as Vault's fallback-shell entrance, shown only briefly
    // before Vault's real GLB loads and takes over. That GLB now bakes in
    // its own COMPLETE, correctly-positioned entrance assembly (arch trim,
    // posts, plates, rivets, threshold — confirmed live via the
    // __vltdDebug hook: 54 real "vault_*" meshes under a "vault_door_anchor"
    // group), so this whole fallback build is redundant for Vault and
    // actively wrong now: differently positioned from the real GLB
    // ("gold arch is half in the other room" — this fallback arch's z
    // doesn't match the GLB's own), still using Blue's old navy tone until
    // the fix above, and the round door disc below was already supposed to
    // be gone (EK, weeks ago: "why would there be a Vault door on the Blue
    // room?" — vault-only was the fix at the time, but the real fix is that
    // the disc itself is dead weight once the real GLB has its own
    // entrance). Blue has no GLB, so this fallback IS its permanent
    // entrance, not a brief flash — it still needs the arch. Vault now
    // falls through to the plain doorframe in the `else` branch below,
    // same simpler shape White/Arcade already use for their own brief
    // pre-load flash.
    if (roomStyle === "blue") {
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
      rearWall.position.set(0, 0, 5.8 + FRONT_WALL_PUSH_BACK);
      rearWall.rotation.y = Math.PI;
      addShell(rearWall);

      // Riveted steel architrave tracing the arch — two posts up the
      // straight sides, a half-ring over the curved top.
      //
      // EK's ask (2026-08-30): "you fixed it on White and Arcade but not
      // on Blue" — the corner-fill item slots (z=5.6, added earlier
      // tonight, same physical shelf length on every style) sit only 0.1
      // unit from this arch's old z=5.7, visibly clipping into it. White/
      // Arcade's real walls moved clear of that zone when their push-back
      // landed; Blue's shell (its own separate, hand-coded fallback with
      // no GLB) never got the same treatment. Applying it here closes
      // that gap AND makes the shell match each style's eventual loaded
      // GLB position much more closely — directly helps the "blue flash"
      // read as less of a jump when the real model swaps in.
      const archPostHeight = archStraightHeight;
      const archPostLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostLeft.position.set(-archHalfWidth - 0.08, archPostHeight / 2, 5.7 + FRONT_WALL_PUSH_BACK);
      addShell(archPostLeft);

      const archPostRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, archPostHeight, 0.18),
        doorFrameMaterial
      );
      archPostRight.position.set(archHalfWidth + 0.08, archPostHeight / 2, 5.7 + FRONT_WALL_PUSH_BACK);
      addShell(archPostRight);

      const archTop = new THREE.Mesh(
        new THREE.TorusGeometry(archHalfWidth + 0.08, 0.11, 12, 32, Math.PI),
        doorFrameMaterial
      );
      archTop.position.set(0, archStraightHeight, 5.7 + FRONT_WALL_PUSH_BACK);
      addShell(archTop);
      // The hinge column that used to stand here (support for the now-
      // removed door disc, Vault-only) is gone too — this block only ever
      // runs for Blue now (the outer condition above), which never had a
      // door to hinge in the first place.
    } else {
      // Same push-back as the vault/blue arch above and as every GLB-backed
      // style's own front wall now — keeps this fallback shell close to
      // whatever the real model will show once it loads.
      const rearWallLeft = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallLeft.position.set(-6.13, 4.55, 5.8 + FRONT_WALL_PUSH_BACK);
      rearWallLeft.rotation.y = Math.PI;
      addShell(rearWallLeft);

      const rearWallRight = new THREE.Mesh(new THREE.PlaneGeometry(8.75, 9.2), doorSideMaterial);
      rearWallRight.position.set(6.13, 4.55, 5.8 + FRONT_WALL_PUSH_BACK);
      rearWallRight.rotation.y = Math.PI;
      addShell(rearWallRight);

      const rearWallTop = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 4.25), doorSideMaterial);
      rearWallTop.position.set(0, 7.08, 5.8 + FRONT_WALL_PUSH_BACK);
      rearWallTop.rotation.y = Math.PI;
      addShell(rearWallTop);

      // Plain painted architrave (reuses trimMaterial — same matte finish as
      // the shelf rails) and deliberately NO fill plane across the opening —
      // a solid dark rectangle here read as a closed door, and real museum
      // doorways are open passages you can see straight through, not
      // blocked-off walls.
      const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorLeft.position.set(-1.85, 2.45, 5.64 + FRONT_WALL_PUSH_BACK);
      addShell(doorLeft);

      const doorRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.95, 0.18), doorFrameMaterial);
      doorRight.position.set(1.85, 2.45, 5.64 + FRONT_WALL_PUSH_BACK);
      addShell(doorRight);

      const doorHeader = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.18, 0.18), doorFrameMaterial);
      doorHeader.position.set(0, 4.92, 5.64 + FRONT_WALL_PUSH_BACK);
      addShell(doorHeader);
    }

    // A shallow, dim vestibule just beyond the entrance — without this, the
    // now-open doorway just showed flat scene.background through the gap,
    // which reads as a blank cutout/broken texture rather than a real
    // passage. This is only enough depth to avoid that, not a real room.
    // EK's ask (2026-08-30): "background colors behind the door are not
    // Right" — vault was sharing blue's own navy tone (0x0a1420) here,
    // same "vault || blue" grouping mistake already fixed elsewhere this
    // session in the other direction (vault's door/hinge post leaking onto
    // blue). Navy suits blue's own theme; vault's is neutral steel/gray
    // everywhere else (trim/case materials run 0x15191d-0x9ca3a4, no blue
    // in them), so its vestibule gets its own dark neutral gray instead.
    const beyondMaterial = new THREE.MeshStandardMaterial({
      color: inHub
        ? 0x0a0e14
        : roomStyle === "whitebox"
          ? 0xcfc6ac
          : roomStyle === "vault" || roomStyle === "loft"
            ? 0x14171a
            : roomStyle === "blue"
              ? 0x0a1420
              : 0x0d0a16,
      roughness: 0.9,
      metalness: 0.02,
    });
    const beyondWall = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), beyondMaterial);
    beyondWall.position.set(0, 2.5, 8.6 + FRONT_WALL_PUSH_BACK);
    beyondWall.rotation.y = Math.PI;
    addShell(beyondWall);

    const beyondFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), floorMaterial);
    beyondFloor.rotation.x = -Math.PI / 2;
    beyondFloor.position.set(0, -0.04, 7.2 + FRONT_WALL_PUSH_BACK);
    addShell(beyondFloor);

    const beyondLight = new THREE.PointLight(palette.glow, 0.5, 6);
    beyondLight.position.set(0, 3, 7.5 + FRONT_WALL_PUSH_BACK);
    roomGroup.add(beyondLight);

    // The heavy riveted swung-open door disc that used to live here
    // (Vault-only fallback prop) is REMOVED as of the 2026-09-06 refinement
    // pass — EK circled it live: "you used some old code on that vault
    // because that door was removed weeks ago." It was never actually
    // deleted, just gated to Vault only after an earlier round; the real
    // fix is that Vault's GLB now bakes its own complete entrance assembly
    // (confirmed live via __vltdDebug: "vault_door_anchor" with 54 real
    // meshes — arch trim, posts, plates, rivets, threshold), so this
    // fallback-only disc is dead weight regardless of which style shows it,
    // not something to keep re-gating.

    // EK's ask (2026-08-30): "the trim doesn't touch the floor" — real,
    // measured: the shell's own floor plane sits at y=-0.05, but every
    // baseboard here was centered at y=0.08 with height 0.18, leaving its
    // bottom edge at y=-0.01 — 0.04 above the floor. Centered so the
    // bottom edge lands exactly on the floor (-0.05 + half-height 0.09).
    const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(20.7, 0.18, 0.12), baseboardMaterial);
    backBaseboard.position.set(0, 0.04, -11.9);
    addShell(backBaseboard);

    const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    leftBaseboard.position.set(-10.42, 0.04, -3.05);
    addShell(leftBaseboard);

    const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 23.4), baseboardMaterial);
    rightBaseboard.position.set(10.42, 0.04, -3.05);
    addShell(rightBaseboard);

    // The entrance wall (either side of the doorway) had no baseboard at
    // all, so the door-frame posts appeared to just stop bare at the floor
    // instead of meeting the same trim line as the rest of the room.
    const frontBaseboardLeft = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardLeft.position.set(-6.13, 0.04, 5.7 + FRONT_WALL_PUSH_BACK);
    addShell(frontBaseboardLeft);

    const frontBaseboardRight = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 0.12), baseboardMaterial);
    frontBaseboardRight.position.set(6.13, 0.04, 5.7 + FRONT_WALL_PUSH_BACK);
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
    // (heroNotch and HERO_NOTCH_HALF are both declared earlier, before
    // applyHeroNotchAndReveal, for the same cache-hit-synchronous-call reason.)

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
    // Cheap fake contact shadow under each case (a plane, not a light) —
    // same fix as galleryRoomFinishes.ts's addCaseDetails, needed here too
    // since Blue (the one style with no GLB) never calls into that module
    // and was left with its cases floating with no shadow at all.
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext("2d")!;
    const shadowGradient = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    shadowGradient.addColorStop(0, "rgba(20,18,14,0.42)");
    shadowGradient.addColorStop(0.7, "rgba(20,18,14,0.22)");
    shadowGradient.addColorStop(1, "rgba(20,18,14,0)");
    shadowCtx.fillStyle = shadowGradient;
    shadowCtx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    shadowTexture.colorSpace = THREE.SRGBColorSpace;
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false,
    });
    CABINET_SPOTS.forEach(([x, z], index) => {
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.7), shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.006, z);
      addShell(shadow);

      const base = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.72, 1.12), cabinetMaterial);
      base.position.set(x, 0.31, z);
      addShell(base);

      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1), glassMaterial);
      glass.position.set(x, 1.25, z);
      addShell(glass);

      // An open rim instead of a solid lid — same fix as
      // galleryRoomFinishes.ts's addCaseDetails/apply() (hiding case_cap):
      // a solid top blocks viewing a flat-lying item from above. This is
      // Blue's own hand-built case (no GLB, so no case_cap mesh to hide),
      // but the same problem, so the same open-top treatment.
      for (const side of [-1, 1]) {
        const across = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.04, 0.035), trimMaterial);
        across.position.set(x, 1.85, z + side * 0.5725);
        const along = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 1.18), trimMaterial);
        along.position.set(x + side * 0.7225, 1.85, z);
        addShell(across);
        addShell(along);
      }

      const glow = new THREE.PointLight(palette.glow, 0.55, 4);
      glow.position.set(x, 2.2, z + (index % 2 === 0 ? 0.25 : -0.25));
      roomGroup.add(glow);
    });

    // Doorways: a "go back one level" archway is always present at the entrance
    // wall, and the Grand Hall additionally gets one freestanding archway per
    // populated universe room, each with a sign naming where it leads — so the
    // museum is actually navigated room-to-room instead of only via the flat map.
    // EK's ask (2026-08-30): "clicking the door takes you to the other
    // room and its very touchy, can you make it so that you have to click
    // the sign above the door to move into that room" — navigation used to
    // hang off a big invisible plane covering the whole door/archway
    // (backDoorway / hitTarget below), so any click near the doorway fired
    // it. The sign itself is a small, precise, already-visible target —
    // moved doorwayTarget onto the sign mesh instead, and the two big door-
    // shaped hit-planes are gone (nothing else used them). DoubleSide
    // matches the "either raycast direction hits" fix already proven below
    // for these same doorway clicks.
    function buildDoorwaySign(
      x: number,
      y: number,
      z: number,
      label: string,
      faceBack: boolean,
      size: { width: number; height: number } = { width: 2.3, height: 0.58 },
      doorwayTarget?: string
    ) {
      const signTexture = drawDoorSignTexture(label);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(size.width, size.height),
        new THREE.MeshStandardMaterial({
          map: signTexture,
          emissive: 0x0c0f13,
          emissiveIntensity: 0.35,
          roughness: 0.5,
          side: THREE.DoubleSide,
        })
      );
      sign.position.set(x, y, z);
      if (faceBack) sign.rotation.y = Math.PI;
      roomGroup.add(sign);
      if (doorwayTarget) {
        sign.userData.doorwayTarget = doorwayTarget;
        doorwayMeshesRef.current.push(sign);
      }
    }

    // EK's ask (2026-08-29): first tried mounting this sign on the wall's
    // FAR (vestibule) face — too far back to render from the room's own
    // camera at all ("still no visible sign"). Reverting to the original
    // literal 5.9 fixed visibility but left it floating in open air once
    // the wall moved to 7.3 (EK: "floating again... not on the wall") —
    // 5.9 was only ever close to the wall by coincidence, back when the
    // wall itself sat at 5.8. Mounting it on the wall's NEAR face instead,
    // using the exact same FRONT_WALL_ITEM_Z the item hangers already use
    // successfully on this same wall, rather than inventing a third
    // offset. Applies to every style now (2026-08-30: "it doesn't look
    // like you pushed the wall back on the other ones") — Blue's own
    // fallback-shell arch got the same push-back applied above, so its
    // wall sits at the same effective position as every GLB-backed style.
    buildDoorwaySign(
      0,
      (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") && !inHub ? 5.85 : 5.55,
      FRONT_WALL_ITEM_Z,
      inHub ? "Campus Map" : "Main Gallery",
      true,
      (roomStyle === "vault" || roomStyle === "blue" || roomStyle === "loft") && !inHub ? { width: 1.65, height: 0.42 } : undefined,
      inHub ? "__overview__" : "__hub__"
    );

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

        buildDoorwaySign(x, doorHeight + 0.5, archZ, room.title, false, undefined, room.id);
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

        // Real wall planes: back z=-12, front z=5.8+FRONT_WALL_PUSH_BACK, left x=-10.5, right x=10.5. The frame used to
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
                ? // Was a bare "5.8 - pos.z" — went negative (clamping
                  // frameDepth to a useless 0.06) once FRONT_WALL_ITEM_Z
                  // moved pos.z past the wall's OLD 5.8 reference to fix the
                  // door-wall items floating bug. Same 5.8 + push-back the
                  // wall/door geometry itself uses, so this stays correct
                  // whenever that constant changes again.
                  5.8 + FRONT_WALL_PUSH_BACK - pos.z
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
        // below it — but the card only had a fixed 0.05-unit clearance
        // above the shelf board it rests on, while the frame's matting
        // scales with item size, so at normal scale the frame's bottom
        // edge sank into the shelf board — EK caught it live: "the bottom
        // of the frame is in the shelf." The fix at the time removed
        // bottom matting entirely instead of giving shelfItemY enough
        // clearance to support it.
        //
        // EK's ask (2026-08-30): that half-fix only ever got applied to
        // "front" wall (door-hanging) items, and shelf items were quietly
        // left asymmetric — never flagged, and EK caught it again in a
        // fresh screenshot: "all the frames... were not made the same as
        // the ones on the wall." Every item now gets real symmetric
        // matting on all 4 sides; shelfItemY (see its own comment) lifts
        // shelf-resting items by this same amount so the newly-added
        // bottom border can't sink into the shelf either.
        const mattingTop = 0.065 * pos.scale;
        const mattingSide = 0.065 * pos.scale;
        const mattingBottom = mattingTop;
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(
            1.12 * pos.scale + mattingSide * 2,
            1.54 * pos.scale + mattingTop + mattingBottom,
            frameDepth
          ),
          frameMaterial
        );
        frame.position.set(
          pos.x - normal.x * centerOffset,
          pos.y + (mattingTop - mattingBottom) / 2,
          pos.z - normal.z * centerOffset
        );
        frame.rotation.y = pos.ry;
        roomGroup.add(frame);
        if (galleryFinishes) {
          // A thin raised brass lip around the existing mat: preserves the
          // photo's contain-fit, shelf clearance, and pickup hit target.
          const edgeGroup = new THREE.Group();
          edgeGroup.position.copy(card.position).addScaledVector(normal, -0.012);
          edgeGroup.rotation.y = pos.ry;
          const w = 1.12 * pos.scale + mattingSide * 2;
          const h = 1.54 * pos.scale + mattingTop + mattingBottom;
          const lip = 0.018 * pos.scale;
          for (const side of [-1, 1]) {
            const horizontal = new THREE.Mesh(new THREE.BoxGeometry(w, lip, 0.025), galleryFinishes.brass);
            horizontal.position.y = side * (h - lip) / 2;
            const vertical = new THREE.Mesh(new THREE.BoxGeometry(lip, h, 0.025), galleryFinishes.brass);
            vertical.position.x = side * (w - lip) / 2;
            edgeGroup.add(horizontal, vertical);
          }
          roomGroup.add(edgeGroup);
        }

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
    // EK's ask (2026-08-28), with a direct reference screenshot from
    // bingebrowse.net: their spawn looks STRAIGHT at the back wall, centered,
    // level — not angled toward a corner. The old default here deliberately
    // angled the view ~25° toward a corner (see this block's own prior
    // history) reasoning that a dead-center view "fills the frame edge-to-
    // edge with flat shelf rows" — but EK's reference shows exactly that
    // straight-on framing looking correct and normal, not flat/boring the
    // way it was assumed to. Reverted to straight ahead (yaw=0) and level
    // (pitch=0) to match. The corner-angle idea is gone — stop reintroducing
    // it as a "fix" for staring-at-a-wall complaints; EK's own reference
    // proves centered/level is the wanted look.
    //
    // Z: moved from -2.2 (the room's actual midpoint, never really "near
    // the door") to 3.8 — just inside the walk clamp's own forward limit
    // (clampPosition, below), genuinely near the entrance. A same-night
    // detour moved this again to the click-to-walk zone's center (-1.4)
    // — REVERTED, see clampPosition's own comment: that tighter zone
    // itself got reverted after EK tried it live and found it too
    // cramped, so 3.8 is back too, matching the zone it actually spawns
    // into again.
    let yaw = savedCamera?.yaw ?? 0;
    let pitch = savedCamera?.pitch ?? 0;
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
    // generous, room-interior stop, not a minimally-legal one.
    //
    // EK's ask (2026-08-28), from the floor-plan reference diagram: "let's
    // do the Amber walk patch" — unifying WASD/zoom with click-to-walk's
    // tighter box. REVERTED SAME NIGHT: tried live, EK: "I can't even
    // scroll back in the door anymore... looked better on paper but not
    // good in real life." The tighter box cut off real usable floor space
    // (most of all, the ability to back off toward the door) that WASD/
    // zoom genuinely needs and click-to-walk doesn't — click-to-walk's own
    // tight bound exists so a single destination click can't strand you
    // nose-to-wall (see the comment above), a concern that doesn't apply
    // to gradual WASD stepping or scroll-zoom at all. Back to two
    // independent bounds: this one (WASD/zoom) stays the original, looser
    // room-wide box; clampWalkDestination below keeps its own tighter one.
    function clampPosition(position: THREE.Vector3) {
      position.x = Math.max(-7.5, Math.min(7.5, position.x));
      position.z = Math.max(-9, Math.min(4.72, position.z));
      return position;
    }

    function clampWalkDestination(position: THREE.Vector3) {
      position.x = Math.max(-3.5, Math.min(3.5, position.x));
      position.z = Math.max(-4.6, Math.min(1.8, position.z));
      return position;
    }

    function clampView(pitchLimit = NAV_PITCH_LIMIT) {
      targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, targetPitch));
      clampPosition(targetCameraBody);
    }

    // Full Museum Scale controls addendum (2026-09-06): these two now
    // delegate to the shared visitorController module so the campus and
    // the prototype room use the literal same math, instead of each
    // surface keeping its own copy that can drift. Behavior is unchanged —
    // still `targetYaw`-based, exactly as before.
    function facingDirection() {
      return sharedFacingDirection(targetYaw);
    }

    function strafeDirection() {
      return sharedStrafeDirection(targetYaw);
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
        if (reducedMotion.matches) walkTween.t = 1;
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
        const eased = easeTowardTargets(yaw, targetYaw, pitch, targetPitch, cameraBody, targetCameraBody, reducedMotion.matches);
        yaw = eased.yaw;
        pitch = eased.pitch;
      }

      aimCamera(camera, cameraBody, yaw, pitch);
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
        // EK's ask: dragging to spin a held item was turning it the
        // opposite way from a natural "grab and drag" feel — dragging
        // right should bring the near face rightward (a positive
        // rotation.y move in Three's convention), which needs heldDragYaw
        // to increase with a rightward drag, not decrease.
        heldDragYaw += dx * 0.008;
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
      const dragged = applyDrag(dx, dy, targetYaw, targetPitch, NAV_PITCH_LIMIT);
      targetYaw = dragged.targetYaw;
      targetPitch = dragged.targetPitch;
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
            // Map = the real, shared VLTD Museum — admin/owner only for now.
            if (isMuseumMapAdminRef.current) setViewMode("overview");
          } else if (target === "__hub__") {
            openMainHall();
          } else {
            const targetRoom = universeRooms.find((room) => room.id === target);
            if (targetRoom) openUniverseRoom(targetRoom);
          }
        } else if (hit?.object.userData.itemId && !isOrganizing) {
          // While Organize is on, the HTML overlay (rendered in React,
          // projected onto these same slot positions) is the interactive
          // surface for occupied/empty slots — a raw 3D click here would
          // otherwise still lift the item into the held/inspect view
          // underneath the overlay's own select/move/remove controls.
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
        }
        // Click-to-walk floor navigation used to live here (any click that
        // hit neither an item nor a doorway raycast against the floor and
        // walked you there). EK's ask (2026-08-30): "if i'm just looking
        // around the room and click something on accident, it just drags
        // me to that location" — removed entirely; a click that hits
        // nothing now genuinely does nothing. startWalkTween/
        // clampWalkDestination/floorPlane are unused now (only this call
        // site ever used them) but left in place rather than torn out —
        // this was a request to stop the auto-walk trigger, not to gut
        // the walk-tween system itself.
      }
      isDragging = false;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      moveCamera(event.deltaY > 0 ? "back" : "forward", WHEEL_STEP);
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
      if (cameraRef.current === camera) cameraRef.current = null;
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
        if (object instanceof THREE.LineSegments) object.geometry.dispose();
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
      galleryFinishes?.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [dataReady, isOrganizing, palette.floor, palette.glow, palette.trim, palette.wall, roomLayout, roomStyle, showValues, slotDisplayNumber, slotItems, slotPositions, universeRoomsKey, viewMode, wallTextureUrl]);

  // 2026-09-11 Gallery Map / Room-Editing pass: a small, independent rAF
  // loop that projects every real slot position to on-screen coordinates
  // every frame, so the React-rendered Organize overlay buttons below sit
  // exactly over their real 3D shelf/case position — the numbered badges
  // and ghost outlines the big scene effect above already draws stay the
  // pure visual layer; this is what makes them a real interactive surface
  // (click/tap/drag/keyboard), without tying overlay position updates to
  // that much heavier effect's own rebuild cycle.
  useEffect(() => {
    if (viewMode !== "room" || !isOrganizing) return undefined;
    let raf = 0;
    const tmp = new THREE.Vector3();
    function tick() {
      const camera = cameraRef.current;
      const mount = mountRef.current;
      if (camera && mount) {
        const rect = mount.getBoundingClientRect();
        organizeSlotRefs.current.forEach((el, index) => {
          const pos = slotPositions[index];
          if (!el) return;
          if (!pos) {
            el.style.display = "none";
            return;
          }
          tmp.set(pos.x, pos.flat ? pos.y + 0.32 : pos.y, pos.z);
          tmp.project(camera);
          const behind = tmp.z > 1 || tmp.z < -1;
          if (behind) {
            el.style.display = "none";
          } else {
            const x = (tmp.x * 0.5 + 0.5) * rect.width;
            const y = (-tmp.y * 0.5 + 0.5) * rect.height;
            el.style.display = "";
            el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
          }
        });
      }
      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [viewMode, isOrganizing, slotPositions, organizeSlotRefs]);

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
    if (
      hall.roomStyle === "vault" ||
      hall.roomStyle === "whitebox" ||
      hall.roomStyle === "arcade" ||
      hall.roomStyle === "blue" ||
      hall.roomStyle === "loft"
    ) {
      setRoomStyle(hall.roomStyle);
    }
    if (hall.roomLayout === "storefront" || hall.roomLayout === "salon" || hall.roomLayout === "spotlight") {
      setRoomLayout(hall.roomLayout);
    }
    if (hall.viewMode === "room" || hall.viewMode === "overview") {
      // Map = the real, shared VLTD Museum — admin/owner only for now.
      setViewMode(hall.viewMode === "overview" && !isMuseumMapAdmin ? "room" : hall.viewMode);
    }
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

  // Returns whether the save actually succeeded — autosave and the
  // Organize/Done "wait for a pending save, confirm success" flow both need
  // a real answer, not just a fire-and-forget call, before they can safely
  // exit Organize or navigate back to the Map.
  async function persistHall(hallId: string | null, title: string | null, linkGalleryId: string | null): Promise<boolean> {
    setIsSavingHall(true);
    setSaveState("saving");
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
        announce(ok ? "Room saved." : "Save failed. Your changes are kept — tap Retry.");
        if (ok) {
          setHalls((current) =>
            current.map((h) => (h.id === hallId ? { ...h, ...input, updatedAt: new Date().toISOString() } : h))
          );
        }
        return ok;
      } else if (title) {
        const created = await createHall(title, input);
        if (created) {
          setCurrentHallId(created.id);
          setHalls((current) => [created, ...current.filter((h) => h.id !== created.id)]);
          setSaveState("saved");
          announce("Room saved.");
          return true;
        }
        setSaveState("error");
        announce("Save failed. Your changes are kept — tap Retry.");
        return false;
      }
      setSaveState("idle");
      return true;
    } catch {
      setSaveState("error");
      return false;
    } finally {
      setIsSavingHall(false);
      setSaveModal(null);
      window.setTimeout(() => setSaveState((current) => (current === "saved" ? "idle" : current)), 1800);
    }
  }

  // 2026-09-11 autosave: coalesces every successful add/move/replace/
  // remove/wallpaper/style edit into one debounced write per saved Hall,
  // instead of one write per click — "Coalesce rapid edits so they do not
  // create overlapping or out-of-order writes." A brand-new, never-named
  // room (`currentHallId` still null) is NOT autosaved — Save Hall's naming
  // step stays the explicit first save, same as before.
  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosaveHallIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dataReady || !currentHallId) return undefined;
    if (lastAutosaveHallIdRef.current !== currentHallId) {
      // Just loaded/created this Hall (applyHall, or persistHall's own
      // create branch) — these are the values that were just loaded, not a
      // fresh edit, so this run must not schedule a save of its own load.
      lastAutosaveHallIdRef.current = currentHallId;
      return undefined;
    }
    setSaveState("saving");
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistHall(currentHallId, null, galleryId === "scratch" ? null : galleryId);
    }, 900);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [selectedIds, roomStyle, roomLayout, showValues, wallTextureUrl, dataReady, galleryId, currentHallId]);

  // Flushes any pending debounced autosave immediately and waits for the
  // real result — used by Done/Exit so "waits for a pending save, confirms
  // success" is a real await, not a hope that the debounce already fired.
  async function flushPendingSave(): Promise<boolean> {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!currentHallId) return true; // nothing persisted yet to flush — never blocks navigation
    return persistHall(currentHallId, null, galleryId === "scratch" ? null : galleryId);
  }

  // Shared by the toolbar's "Exit" button and Organize's "Done" (when it
  // was opened from the Map) — "Navigating away while a save is pending
  // must not silently discard changes": wait for the real result before
  // leaving, and stay put with the Save Failed state visible on failure
  // rather than bouncing back to the Map as if nothing was wrong.
  async function leaveRoomToMap() {
    const ok = await flushPendingSave();
    if (!ok) return;
    setIsOrganizing(false);
    setEditRoomContext(null);
    // The Map is the real, shared VLTD Museum floor plan now — admin/owner
    // only for now (see isMuseumMapAdmin above). An ordinary account's
    // "Exit" just closes Organize; there is nothing else here for them to
    // land on yet.
    if (isMuseumMapAdmin) setViewMode("overview");
  }

  async function handleOrganizeToggle() {
    if (isOrganizing && editRoomContext) {
      organizer.setDragIndex(null);
      organizer.setDragOverIndex(null);
      setSelectedItemId("");
      organizer.setOrganizeSelectedSlot(null);
      const ok = await flushPendingSave();
      if (!ok) return; // stay in Organize with the Save Failed pill visible — nothing is discarded, just retry
      setIsOrganizing(false);
      setEditRoomContext(null);
      setViewMode("overview");
      return;
    }
    setIsOrganizing((current) => !current);
    organizer.setDragIndex(null);
    organizer.setDragOverIndex(null);
    setSelectedItemId("");
    organizer.setOrganizeSelectedSlot(null);
  }

  // Room name (Hall title) editing — section 4 of the work order. `title`
  // is a real, already-existing column (see virtualRooms.ts's renameHall);
  // this is a plain debounced write, same coalescing spirit as autosave
  // above, just scoped to one field so it can never race a routine
  // selectedIds/style autosave.
  function renameMapHall(hallId: string, nextTitle: string) {
    setHalls((current) => current.map((h) => (h.id === hallId ? { ...h, title: nextTitle } : h)));
    if (nameSaveTimerRef.current) window.clearTimeout(nameSaveTimerRef.current);
    setNameSaveState("saving");
    nameSaveTimerRef.current = window.setTimeout(() => {
      nameSaveTimerRef.current = null;
      void renameHall(hallId, nextTitle).then((ok) => {
        setNameSaveState(ok ? "saved" : "error");
        if (ok) announce("Room name saved.");
        window.setTimeout(() => setNameSaveState((current) => (current === "saved" ? "idle" : current)), 1800);
      });
    }, 700);
  }

  function renameCurrentHall(nextTitle: string) {
    if (currentHallId) renameMapHall(currentHallId, nextTitle);
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

  // Shared room-edit commands for the in-3D Organize overlay (click-to-
  // select, desktop drag, touch press-and-hold, and the keyboard Move menu)
  // now live in organizeSlots.tsx's useSlotOrganizer() — see the `organizer`
  // const above. Its onMove/onReplace/onRemove callbacks are this file's own
  // canonical selectedIds mutation (work order §10: "the desktop drag flow,
  // touch flow, keyboard flow... must all call these same commands").

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
  // 2026-09-11 Gallery Map / Room-Editing pass: Map mode gets a tall,
  // viewport-driven workspace (EK's marked boundaries — below the top
  // controls, the full former sidebar+panel width, close to the bottom of
  // the visible viewport, no internal scrolling) instead of the same fixed
  // ~600px box Room mode uses. Room mode's own sizing is untouched — the
  // work order is explicit that normal Room mode stays visually intact.
  const roomBoxHeightClass = effectiveGuest
    ? "h-full"
    : viewMode === "overview"
      ? "h-[calc(100dvh-var(--topnav-h,0px)-228px)] min-h-[560px]"
      : "min-h-[600px]";
  const roomView = (
    <section
      className={[
        effectiveGuest
          ? "h-full overflow-hidden"
          : ["overflow-hidden rounded-[8px] border shadow-[0_30px_90px_rgba(0,0,0,0.34)] xl:self-start", roomBoxHeightClass].join(" "),
        palette.shell,
      ].join(" ")}
      style={effectiveGuest ? undefined : { borderColor: "var(--theme-border)" }}
    >
      <div className={effectiveGuest ? "h-full" : roomBoxHeightClass}>
        <div className={effectiveGuest ? "relative h-full" : ["relative", roomBoxHeightClass].join(" ")}>
          {viewMode === "room" || !isMuseumMapAdmin ? (
            // touch-action: none — without it, a touch drag on the canvas is
            // ALSO interpreted by the browser as a native page-scroll gesture
            // (pointer events fire and the camera rotates, but the page
            // scrolls underneath it at the same time), and a gesture the
            // browser decides is a scroll can cut the pointermove stream
            // short — which is why yaw dragging read as "doesn't just spin
            // easily" on a touch device, not just the vertical-scroll
            // symptom. Same fix already used for the thumbnail drag-reorder
            // list elsewhere in this file.
            // The `|| !isMuseumMapAdmin` half of this condition is the real
            // access-control point for the Map: the shared VLTD Museum floor
            // plan is admin/owner-only for now (EK, 2026-09-11), so even if
            // viewMode somehow reads "overview" for an ordinary account (a
            // legacy saved Hall's stored view_mode, an in-room doorway click),
            // this still renders the room, never the museum map.
            <div ref={mountRef} className="absolute inset-0" style={{ touchAction: "none" }} />
          ) : (
            <MuseumCampusOverview onBackToRoom={enterRoomFresh} />
          )}
          {viewMode === "room" && isOrganizing && !effectiveGuest ? (
            // 2026-09-11 Gallery Map / Room-Editing pass: the in-room
            // Organize overlay — real, tabbable HTML controls projected
            // every frame onto each slot's actual 3D position (see the
            // small rAF effect above `applyGallery`), so this is the same
            // "numbered overlays in the actual 3D room" the work order
            // asks for, just implemented as an accessible DOM layer over
            // the canvas rather than unreachable WebGL-only geometry.
            // Shared Museum Room Editor consolidation pass (2026-09-12):
            // the overlay's own JSX now lives in organizeSlots.tsx's
            // <OrganizeSlotOverlay> — same markup, same interactions, just
            // shared with the new museum room popup.
            <OrganizeSlotOverlay
              slotCount={slotPositions.length}
              slotItems={slotItems}
              organizer={organizer}
              onOpenPicker={openSlotPicker}
            />
          ) : null}
          <div className={viewMode === "overview" ? "hidden" : "absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2"}>
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
              // The Map is the real, shared VLTD Museum — admin/owner only for
              // now, so an ordinary account has nowhere for "Exit" to lead;
              // hide it rather than show a button that visibly does nothing.
              isMuseumMapAdmin ? (
                <button
                  type="button"
                  onClick={() => void leaveRoomToMap()}
                  className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                  title="Save and exit to the campus map"
                >
                  <MapIcon size={14} />
                  Exit
                </button>
              ) : null
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
                onClick={() => void handleOrganizeToggle()}
                aria-pressed={isOrganizing}
                className={[
                  "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition",
                  isOrganizing
                    ? "bg-[#4FD3EE] text-[#06171d]"
                    : "bg-black/42 text-white ring-1 ring-white/12 hover:bg-black/60",
                ].join(" ")}
                title={editRoomContext ? "Rearrange, then save and return to the Map" : "Show slot numbers and rearrange shelves"}
              >
                <Grid3X3 size={14} />
                {isOrganizing ? "Done" : "Organize"}
              </button>
            ) : null}
            {/* 2026-09-11 pass: the old always-visible sidebar "Save Hall"
                button moved here, next to Organize/Done — a brand-new,
                never-named room still needs this explicit first save
                (creating the Hall row); once one exists, autosave takes
                over and this becomes a quiet status pill instead (tap to
                retry on failure). */}
            {viewMode === "room" && !effectiveGuest ? (
              currentHallId ? (
                <button
                  type="button"
                  disabled={saveState !== "error"}
                  onClick={
                    saveState === "error"
                      ? () => void persistHall(currentHallId, null, galleryId === "scratch" ? null : galleryId)
                      : undefined
                  }
                  className={[
                    "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition",
                    saveState === "error"
                      ? "bg-red-500/85 text-white hover:bg-red-500"
                      : "cursor-default bg-black/42 text-white ring-1 ring-white/12",
                  ].join(" ")}
                  title={saveState === "error" ? "Save failed — tap to retry" : "Autosave status"}
                >
                  <Save size={14} />
                  {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save Failed — Retry" : "Saved"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={isSavingHall}
                  className={[
                    "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition disabled:opacity-60",
                    saveState === "error"
                      ? "bg-red-500/85 text-white hover:bg-red-500"
                      : "bg-black/42 text-white ring-1 ring-white/12 hover:bg-black/60",
                  ].join(" ")}
                  title="Name and save this room so it can autosave"
                >
                  <Save size={14} />
                  {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save Failed — Try Again" : "Save Hall"}
                </button>
              )
            ) : null}
          </div>
          {viewMode === "room" && selectedItems.length === 0 && !hallNoticeDismissed ? (
            // Found live during this pass's own verification (pre-existing,
            // not introduced here): this full-screen wrapper had no
            // pointer-events-none, so it silently absorbed every click
            // anywhere on screen — including the toolbar's Exit/Organize
            // buttons above it — whenever an empty room's notice was
            // showing, until Dismiss was clicked. Only the visible card
            // itself needs pointer-events-auto.
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
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
            left a huge empty gap next to a small cluster of pills.
            items-stretch (EK's ask, 2026-09-12): the three panels had visibly
            different heights since each shrink-wrapped its own content —
            stretching them to the row's tallest is a pure cross-axis change,
            independent of the width behavior the comment above already
            covers. */}
        <div className="flex flex-wrap items-stretch gap-3">
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

          {/* flex (not just w-[260px]): the outer flex row's items-stretch
              only stretches its DIRECT children — this wrapper was a plain
              block div, so it grew invisibly while ControlPanel's own
              bordered box inside it stayed shrink-wrapped to its content,
              which is why Source still looked shorter than Room (EK's
              report, 2026-09-12). Making the wrapper itself `flex` makes
              its single child a flex item too, stretching (the flex
              default) to fill the wrapper's now-equal height. */}
          <div className="flex w-[260px] shrink-0">
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
              {/* 2026-09-11 pass, work order §4 "editing the room's display
                  name": `title` is a real persisted column on the Hall row
                  (see virtualRooms.ts's renameHall) — a brand-new, never-
                  saved room has no row yet to rename, so this stays a
                  plain explanatory line until Save Hall creates one. */}
              {currentHallId ? (
                <div className="mt-1">
                  <label htmlFor="vltd-room-name" className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                    Room name
                  </label>
                  <input
                    id="vltd-room-name"
                    value={halls.find((h) => h.id === currentHallId)?.title ?? ""}
                    onChange={(event) => renameCurrentHall(event.target.value)}
                    maxLength={60}
                    className="h-8 w-full rounded-[6px] bg-[color:var(--input)] px-2.5 text-xs ring-1 ring-[color:var(--border)]"
                  />
                  {nameSaveState !== "idle" ? (
                    <div
                      className={[
                        "mt-1 text-[11px] font-semibold",
                        nameSaveState === "error" ? "text-amber-300" : "text-[color:var(--muted)]",
                      ].join(" ")}
                    >
                      {nameSaveState === "saving" ? "Saving name…" : nameSaveState === "error" ? "Couldn't save the name — try again." : "Name saved."}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-[11px] leading-4 text-[color:var(--muted)]">
                  Save this room as a Hall to give it its own name.
                </p>
              )}
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
                {isMuseumMapAdmin ? (
                  // Map = the real, shared VLTD Museum floor plan — admin/owner
                  // only for now (EK, 2026-09-11). An ordinary account only has
                  // Room mode, so there's nothing to toggle for them.
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
                ) : null}
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
                  <option value="loft">Industrial Loft</option>
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

        {/* 2026-09-11 Gallery Map / Room-Editing pass: the old "Arrange Shelf
            Order" sidebar is retired — its add/move/remove behavior now
            lives in the 3D room's own Organize overlay (see the
            organizeOverlay block below, in roomView), and its explicit Save
            action moved next to Organize/Done in the room's own toolbar.
            The 3D room/map now gets the entire workspace width. */}
        {roomView}
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
      {/* Keyboard/phone fallback for moving a selected item, and the
          Replace/Cancel confirmation for dropping onto an occupied
          destination — both shared with the museum room popup via
          organizeSlots.tsx (Shared Museum Room Editor consolidation pass,
          2026-09-12). */}
      <OrganizeMoveMenu groups={slotGroups} slotItems={slotItems} organizer={organizer} />
      <OrganizeReplaceConfirm organizer={organizer} />
      {/* Screen-reader live region for save results and room-only removals —
          "Announce save results and room-only removals with a polite live
          region." Visually hidden, always present so a text change (even a
          repeat) is reliably announced. */}
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
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
