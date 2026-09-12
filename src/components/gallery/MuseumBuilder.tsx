"use client";

// Museum Builder (2026-09-12) — EK's direct instruction after using the
// in-Gallery-Builder museum room popup: "duplicate this page but instead
// call it Museum Builder... Leave the original Gallery Builder alone
// though for now." This is a structural duplicate of the Gallery Builder's
// own page shell (identity card, Source panel, Room panel, toolbar over the
// 3D view) but every place the Gallery Builder points at a personal
// Hall/Exhibition, this points at the real shared VLTD Museum instead.
//
// Reused, not reinvented:
//   - MuseumRoomPopup.tsx's real-room-rendering approach: the same
//     buildRoomShell/buildNeutralShell/buildSharedWall/buildRoomTrim shell
//     construction and the same "only build wall segments touching this one
//     room" scoping. Not a literal import of MuseumRoomPopup itself (that
//     component is its own full-screen popup with its own Done button/
//     bottom bar — this page needs the Gallery Builder's identity-card/
//     Source/Room/toolbar shell around the same 3D view instead), so the
//     scene-setup effect below is a parallel copy of that approach, not a
//     modification of that file — MuseumRoomPopup.tsx itself is completely
//     untouched.
//   - First-round-fixes pass (2026-09-12): EK's first live test found the
//     popup's drag-to-look-only camera (fine for that smaller popup) not
//     enough here — she needs to actually move around the room. Camera is
//     now real drag-to-look PLUS scroll-to-step and WASD movement, built
//     from visitorController.ts's own shared math — applyDrag/aimCamera
//     (unchanged from the original pass), plus buildKeyboardMoveDirection/
//     easeTowardTargets/WHEEL_STEP/facingDirection, the exact same
//     functions VltdMuseumCampus.tsx's real walkable campus and
//     VirtualGalleryRoom.tsx's own accepted room both already use — not a
//     second movement implementation. Collision is a simple rectangular
//     clamp against this room's own real bounds (campusLayout.ts's
//     roomBounds), the same technique VirtualGalleryRoom.tsx's own
//     clampPosition uses for its single room (a fixed box, not the
//     walkable campus's room-graph isWalkable() check) — enough to keep the
//     camera from clipping through this one room's own walls, which is all
//     a single-room editor needs; no doorway-to-doorway campus navigation.
//   - organizeSlots.tsx's Organize system (useSlotOrganizer,
//     OrganizeSlotOverlay, OrganizeMoveMenu, OrganizeReplaceConfirm) —
//     completely unchanged, exactly like MuseumRoomPopup.tsx already uses.
//   - campusRoomBuilder.ts's computeRoomPlacementSlots() for wall-hung
//     capacity, plus two additive sibling functions from the original pass —
//     computeRoomShelfSlots()/computeRoomCaseSlots() — for the shelf/case
//     feature-parity gap, reusing the exact same computeUsableWallSpans()/
//     distributeAcrossSpans() distribution math.
//   - First-round-fixes pass (2026-09-12), row-alignment fix: EK's screenshot
//     showed wall items stacked with mismatched height/sizing — root cause
//     was that computeRoomPlacementSlots' own per-wall horizontal
//     distribution (correct, kept as-is) was never combined with a real
//     fixed VERTICAL row system. computeRoomPlacementSlots now takes an
//     optional `rowCount` argument (1/2/3) that this page alone passes —
//     every row height is the personal Gallery Builder's own hand-tuned
//     SHELF_ROW_Y table and shelfItemY() (src/lib/galleryRoomSlots.ts),
//     reused directly, not re-derived (museumStandard.ts's MUSEUM_EYE_HEIGHT
//     is the exact same 3.6 the personal room's own eyeHeight uses, so no
//     unit conversion was needed). Every other existing caller of this
//     function (VltdMuseumCampus.tsx's real live museum, MuseumRoomPopup.tsx)
//     never passes `rowCount` and is byte-for-byte unaffected — see that
//     argument's own comment in campusRoomBuilder.ts.
//   - VirtualGalleryRoom.tsx's own shelf-board/display-case furniture
//     recipe — ported (not redesigned) into src/lib/museumRoomFurniture.ts,
//     generalized to any room's own real wall coordinates instead of the
//     personal room's fixed ones. The new Shelves checkbox (this pass)
//     draws one more of these same boards (buildShelfBoard, unchanged) per
//     wall-item row via campusRoomBuilder.ts's new wallRowBoardHeights() —
//     a pure visual toggle on the existing wall slots, not a new slot kind
//     and not the separate Shelf-items/Case-items capacity sliders.
//   - The personal Gallery Builder's real Wallpaper upload flow
//     (handleWallpaperUpload/fileToRoomWallpaper/uploadHallWallpaper in
//     VirtualGalleryRoom.tsx) is what the Background control mirrors now.
//     The original pass's invented "BACKGROUND: Neutral/Warm Ivory/Cool
//     Slate/Charcoal" swatch dropdown (campusRoomBuilder.ts's
//     ROOM_BACKGROUND_OPTIONS/backgroundWallColorHex — a real, separate,
//     already-accepted feature of the Map's own RoomEditorModal.tsx, not
//     invented there) has been removed from THIS page entirely; this page
//     no longer imports either. Only the real custom-wallpaper-image upload
//     remains, unchanged: it already called uploadHallWallpaper() into the
//     same "room-wallpapers" Storage bucket the personal Hall's own
//     Wallpaper button uses.
//   - museum_room_items/museum_room_meta via the SAME existing functions
//     MuseumRoomPopup.tsx and RoomEditorModal.tsx already call
//     (getEnabledRoomItems/setRoomItemSlot/clearRoomItemSlot/getRoomMeta) —
//     none of those are modified, only new sibling setters are added
//     (setRoomCapacities/setRoomBackgroundImage/setRoomWallLayout) for the
//     per-room settings this page introduces.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import * as THREE from "three";
import { ChevronDown, ChevronUp, DoorOpen, Grid3X3, Layers3, MonitorUp, Paintbrush, Save } from "lucide-react";

import {
  computeCampusWallSegments,
  deriveRoomDoorways,
  roomBounds,
  roomById,
  EDITABLE_ROOM_IDS,
  EYE_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
  type CampusRoomId,
} from "@/lib/campusLayout";
import {
  DEFAULT_ITEMS_PER_ROOM,
  clearRoomItemSlot,
  getEnabledRoomItems,
  getItemsPerRoom,
  getRoomMeta,
  setRoomBackgroundImage,
  setRoomCapacities,
  setRoomItemSlot,
  setRoomWallLayout,
  type MuseumRoomItem,
} from "@/lib/museumCampusConfig";
import {
  buildNeutralShell,
  buildRoomShell,
  buildRoomTrim,
  buildSharedWall,
  computeRoomCaseSlots,
  computeRoomPlacementSlots,
  computeRoomShelfSlots,
  computeRoomShelfSpans,
  createWallMaterial,
  placeItemsAtSlots,
  visitorFacingRoomName,
  wallRowBoardHeights,
  HUB_FINISH,
  NEUTRAL_LEGACY_FINISH,
  NEUTRAL_PREVIEW_FINISH,
  type PlacementSlot,
  type RoomFinish,
  type RoomLightGroups,
  type RoomModule,
  type RoomRowCount,
} from "@/lib/campusRoomBuilder";
import { buildDisplayCase, buildShelfBoard, createShelfMaterial, placeItemsInCases } from "@/lib/museumRoomFurniture";
import { MUSEUM_PITCH_LIMIT, MUSEUM_WALK_SPEED } from "@/lib/museumStandard";
import {
  aimCamera,
  applyDrag,
  buildKeyboardMoveDirection,
  easeTowardTargets,
  facingDirection,
  WHEEL_STEP,
} from "@/lib/visitorController";
import { uploadHallWallpaper } from "@/lib/virtualRooms";
import { getPrimaryImageUrl, loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { OrganizeMoveMenu, OrganizeReplaceConfirm, OrganizeSlotOverlay, useSlotOrganizer, type OrganizeSlotGroup } from "./organizeSlots";
import { ItemPickerSheet } from "./ItemPickerSheet";

// Same per-room finish/focal-wall mapping MuseumRoomPopup.tsx and
// VltdMuseumCampus.tsx both already use — kept as its own tiny local copy
// here too (a 3-line categorization table, not the interaction logic the
// work order's consolidation is actually about), consistent with how
// MuseumRoomPopup.tsx itself already justifies keeping its own copy rather
// than a shared import.
function baseFinishForRoom(roomId: CampusRoomId): RoomFinish {
  if (roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION") return NEUTRAL_PREVIEW_FINISH;
  if (roomId === "HUB") return HUB_FINISH;
  return NEUTRAL_LEGACY_FINISH;
}
function isConvertedRoom(roomId: CampusRoomId): boolean {
  return roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION";
}
function focalWallFor(roomId: CampusRoomId) {
  return roomId === "SPORTS" ? ("south" as const) : undefined;
}

const MIN_ITEM_CAPACITY = 2;
const MAX_ITEM_CAPACITY = 24;
const MAX_SHELF_CAPACITY = 12;
const MAX_CASE_CAPACITY = 6;

/** Small, self-contained resize-to-JPEG helper for the custom-background
 * upload below — VirtualGalleryRoom.tsx has an equivalent
 * (fileToRoomWallpaper), but it's a private, unexported function in a file
 * this work order requires stay completely untouched, so this is a fresh
 * (deliberately tiny) copy of the same idea rather than a reach into that
 * file. The actual upload destination (uploadHallWallpaper, the Storage
 * bucket it writes to) IS reused directly, unchanged — only this
 * client-side resize step is duplicated. */
function fileToResizedDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not prepare the image."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function MuseumBuilder() {
  const editableRooms = useMemo(() => EDITABLE_ROOM_IDS.map((id) => roomById(id)), []);
  const [roomId, setRoomId] = useState<CampusRoomId>(editableRooms[0]?.id ?? "POP_CULTURE");

  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [ready, setReady] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);

  const [wallSlots, setWallSlots] = useState<PlacementSlot[]>([]);
  const [shelfSlots, setShelfSlots] = useState<PlacementSlot[]>([]);
  const [caseSlots, setCaseSlots] = useState<PlacementSlot[]>([]);
  const [caseEligible, setCaseEligible] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, MuseumRoomItem>>({});

  const [itemCapacity, setItemCapacity] = useState(DEFAULT_ITEMS_PER_ROOM);
  const [shelfCapacity, setShelfCapacity] = useState(0);
  const [caseCapacity, setCaseCapacity] = useState(0);
  const [capacitySaveState, setCapacitySaveState] = useState<SaveState>("idle");

  // First-round-fixes pass (2026-09-12): the new Single/Dual/Three-row wall-
  // item selector and Shelves-board checkbox — independent of the capacity
  // sliders above (those control HOW MANY items; these control how the wall
  // ones are arranged/furnished). Defaults match Museum Builder's own
  // existing look (3 rows, no shelf board) so a room nobody has touched yet
  // renders exactly as it always has.
  const [rowCount, setRowCount] = useState<RoomRowCount>(3);
  const [wallShelvesEnabled, setWallShelvesEnabled] = useState(false);
  const [rowSaveState, setRowSaveState] = useState<SaveState>("idle");

  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundSaveState, setBackgroundSaveState] = useState<SaveState>("idle");
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");

  const [pickerSlotIdx, setPickerSlotIdx] = useState<number | null>(null);
  const [itemSaveState, setItemSaveState] = useState<SaveState>("idle");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  function announce(message: string) {
    setLiveAnnouncement((current) => (current === message ? `${message} ` : message));
  }

  // Vault source — same "instant cache, then real sync" pattern
  // MuseumRoomPopup.tsx and VirtualGalleryRoom.tsx both already use.
  useEffect(() => {
    setVaultItems(loadItems());
    void syncVaultItemsFromSupabase().then((synced) => {
      if (synced.length > 0) setVaultItems(synced);
    });
  }, []);

  async function refreshAssignments(slots: PlacementSlot[]) {
    const items = await getEnabledRoomItems(roomId);
    const bySlot: Record<string, MuseumRoomItem> = {};
    for (const item of items) {
      if (item.slot_id && slots.some((s) => s.id === item.slot_id)) bySlot[item.slot_id] = item;
    }
    setAssignments(bySlot);
  }

  // Tracks the last capacity values known to match the database (just
  // loaded, or just successfully saved) so the debounced persist effect
  // below can tell "the user actually changed something" apart from "these
  // state setters just ran because a different room finished loading" —
  // comparing against a remembered flag would misfire if the new room
  // happens to share the same numbers as the old one (state wouldn't even
  // change, so a flag-based "skip the next persist" would stay armed and
  // silently eat the NEXT real edit instead).
  const lastKnownCapacityRef = useRef<{ roomId: CampusRoomId; item: number; shelf: number; caseCap: number } | null>(null);
  // Same "known-good vs. just-loaded-vs-just-edited" tracking as
  // lastKnownCapacityRef above, for the new row/shelf settings — kept as its
  // own ref (not folded into lastKnownCapacityRef) since they save through
  // their own setRoomWallLayout() call, independent of the capacity sliders.
  const lastKnownRowSettingsRef = useRef<{ roomId: CampusRoomId; row: RoomRowCount; shelves: boolean } | null>(null);

  // Loads this room's own capacity/background/row overrides on room switch.
  // Slot geometry itself is recomputed by the effect right below, which
  // reacts to these same capacity/row state values — so loading and a live
  // slider/control edit both flow through one single place that turns them
  // into slots, instead of two separate copies of that math.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [meta, globalDefault] = await Promise.all([getRoomMeta(roomId), getItemsPerRoom()]);
      if (cancelled) return;
      const nextItem = meta?.item_capacity ?? globalDefault;
      const nextShelf = meta?.shelf_capacity ?? 0;
      const nextCase = meta?.case_capacity ?? 0;
      lastKnownCapacityRef.current = { roomId, item: nextItem, shelf: nextShelf, caseCap: nextCase };
      setItemCapacity(nextItem);
      setShelfCapacity(nextShelf);
      setCaseCapacity(nextCase);
      setBackgroundImageUrl(meta?.background_image_url ?? null);
      const savedRowCount = meta?.wall_row_count;
      const nextRowCount: RoomRowCount = savedRowCount === 1 || savedRowCount === 2 || savedRowCount === 3 ? savedRowCount : 3;
      const nextShelvesEnabled = meta?.wall_shelves_enabled ?? false;
      lastKnownRowSettingsRef.current = { roomId, row: nextRowCount, shelves: nextShelvesEnabled };
      setRowCount(nextRowCount);
      setWallShelvesEnabled(nextShelvesEnabled);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // The one place capacity/row-count (loaded OR edited) turns into real
  // slot geometry — computeRoomPlacementSlots/computeRoomShelfSlots/
  // computeRoomCaseSlots are all pure functions of these inputs, so this is
  // what makes the sliders AND the row selector live: change either, slots
  // redistribute immediately.
  useEffect(() => {
    const doorways = deriveRoomDoorways(roomId);
    const nextWallSlots = computeRoomPlacementSlots(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT, itemCapacity, focalWallFor(roomId), rowCount);
    const nextShelfSlots = shelfCapacity > 0 ? computeRoomShelfSlots(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT, shelfCapacity) : [];
    const eligible = computeRoomCaseSlots(roomId, doorways, WALL_THICKNESS, 1).length > 0;
    const nextCaseSlots = eligible && caseCapacity > 0 ? computeRoomCaseSlots(roomId, doorways, WALL_THICKNESS, caseCapacity) : [];
    setCaseEligible(eligible);
    setWallSlots(nextWallSlots);
    setShelfSlots(nextShelfSlots);
    setCaseSlots(nextCaseSlots);
    void refreshAssignments([...nextWallSlots, ...nextShelfSlots, ...nextCaseSlots]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, itemCapacity, shelfCapacity, caseCapacity, rowCount]);

  // Debounced persist of capacity changes — same "one debounced write"
  // convention already used elsewhere in this app's autosave flows, so
  // dragging a slider doesn't fire a write per tick. Compares against
  // lastKnownCapacityRef (set on load AND on a successful save below), not
  // a one-shot flag, so switching to a room that happens to share the same
  // numbers as the last one can never leave a later real edit unsaved.
  useEffect(() => {
    const last = lastKnownCapacityRef.current;
    if (last && last.roomId === roomId && last.item === itemCapacity && last.shelf === shelfCapacity && last.caseCap === caseCapacity) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setCapacitySaveState("saving");
      void setRoomCapacities(roomId, { item_capacity: itemCapacity, shelf_capacity: shelfCapacity, case_capacity: caseCapacity }).then((result) => {
        if (result.ok) lastKnownCapacityRef.current = { roomId, item: itemCapacity, shelf: shelfCapacity, caseCap: caseCapacity };
        setCapacitySaveState(result.ok ? "saved" : "error");
        if (result.ok) window.setTimeout(() => setCapacitySaveState((s) => (s === "saved" ? "idle" : s)), 1600);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [roomId, itemCapacity, shelfCapacity, caseCapacity]);

  // Debounced persist of the row selector / Shelves checkbox — same
  // convention as the capacity debounce above, its own independent ref/save
  // state so the two never race or skip each other's writes.
  useEffect(() => {
    const last = lastKnownRowSettingsRef.current;
    if (last && last.roomId === roomId && last.row === rowCount && last.shelves === wallShelvesEnabled) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setRowSaveState("saving");
      void setRoomWallLayout(roomId, { wall_row_count: rowCount, wall_shelves_enabled: wallShelvesEnabled }).then((result) => {
        if (result.ok) lastKnownRowSettingsRef.current = { roomId, row: rowCount, shelves: wallShelvesEnabled };
        setRowSaveState(result.ok ? "saved" : "error");
        if (result.ok) window.setTimeout(() => setRowSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [roomId, rowCount, wallShelvesEnabled]);

  async function handleBackgroundUpload(file?: File | null) {
    if (!file) return;
    setBackgroundError("");
    setBackgroundUploading(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      // Reuses virtualRooms.ts's uploadHallWallpaper() directly — the same
      // function and "room-wallpapers" Storage bucket the Gallery Builder's
      // own personal-Hall Wallpaper feature already uses, so a background
      // uploaded here lives in the same shared location, not a second,
      // museum-only upload path.
      const publicUrl = await uploadHallWallpaper(dataUrl);
      if (!publicUrl) {
        setBackgroundError("Upload failed — try a smaller image.");
        setBackgroundUploading(false);
        return;
      }
      setBackgroundImageUrl(publicUrl);
      setBackgroundSaveState("saving");
      const result = await setRoomBackgroundImage(roomId, publicUrl);
      setBackgroundSaveState(result.ok ? "saved" : "error");
      if (result.ok) window.setTimeout(() => setBackgroundSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : "Could not load that image.");
    } finally {
      setBackgroundUploading(false);
    }
  }

  async function handleBackgroundImageClear() {
    setBackgroundImageUrl(null);
    setBackgroundSaveState("saving");
    const result = await setRoomBackgroundImage(roomId, null);
    setBackgroundSaveState(result.ok ? "saved" : "error");
    if (result.ok) window.setTimeout(() => setBackgroundSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
  }

  // Combined, ordered slot list — wall, then shelf, then case — the single
  // fixed order both the Organize overlay's numbering and the 3D scene's
  // own item placement below agree on.
  const allSlots = useMemo(() => [...wallSlots, ...shelfSlots, ...caseSlots], [wallSlots, shelfSlots, caseSlots]);

  const slotItems = useMemo(
    () => allSlots.map((slot) => {
      const item = assignments[slot.id];
      return item ? { title: item.title } : null;
    }),
    [allSlots, assignments]
  );

  const slotGroups: OrganizeSlotGroup[] = useMemo(() => {
    const groups: OrganizeSlotGroup[] = [];
    const wallOrder: PlacementSlot["wall"][] = ["north", "south", "east", "west"];
    const wallLabels: Record<PlacementSlot["wall"], string> = { north: "North Wall", south: "South Wall", east: "East Wall", west: "West Wall" };
    for (const wall of wallOrder) {
      const indices = allSlots.map((s, idx) => ({ s, idx })).filter((e) => e.s.wall === wall && (e.s.kind ?? "wall") === "wall").map((e) => e.idx);
      if (indices.length > 0) groups.push({ label: wallLabels[wall], indices });
    }
    const shelfIndices = allSlots.map((s, idx) => ({ s, idx })).filter((e) => e.s.kind === "shelf").map((e) => e.idx);
    if (shelfIndices.length > 0) groups.push({ label: "Shelves", indices: shelfIndices });
    const caseIndices = allSlots.map((s, idx) => ({ s, idx })).filter((e) => e.s.kind === "case").map((e) => e.idx);
    if (caseIndices.length > 0) groups.push({ label: "Display Cases", indices: caseIndices });
    return groups;
  }, [allSlots]);

  async function persistMove(fromIdx: number, toIdx: number) {
    const fromSlot = allSlots[fromIdx];
    const toSlot = allSlots[toIdx];
    const source = assignments[fromSlot?.id ?? ""];
    if (!fromSlot || !toSlot || !source) return;
    setItemSaveState("saving");
    const placed = await setRoomItemSlot(roomId, toSlot.id, { title: source.title, image_url: source.image_url }, 0);
    const cleared = placed.ok ? await clearRoomItemSlot(roomId, fromSlot.id) : { ok: false };
    setItemSaveState(placed.ok && cleared.ok ? "saved" : "error");
    if (placed.ok) {
      await refreshAssignments(allSlots);
      window.setTimeout(() => setItemSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  async function persistRemove(idx: number) {
    const slot = allSlots[idx];
    if (!slot) return;
    setItemSaveState("saving");
    const result = await clearRoomItemSlot(roomId, slot.id);
    setItemSaveState(result.ok ? "saved" : "error");
    if (result.ok) {
      await refreshAssignments(allSlots);
      window.setTimeout(() => setItemSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  const organizer = useSlotOrganizer({
    slotItems,
    announce,
    onMove: (fromIdx, toIdx) => void persistMove(fromIdx, toIdx),
    onReplace: (fromIdx, toIdx) => void persistMove(fromIdx, toIdx),
    onRemove: (idx) => void persistRemove(idx),
  });

  // Scene setup — real room shell + trim (only the wall segments touching
  // THIS room, same as MuseumRoomPopup.tsx), a drag-to-look + WASD/scroll
  // walking camera, shelf/case furniture, and the currently-assigned items.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || allSlots.length === 0) return undefined;

    const room = roomById(roomId);
    const spawn = { x: room.x + room.w / 2, z: room.z + room.d / 2 };
    const finish = baseFinishForRoom(roomId);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1420);
    scene.fog = new THREE.Fog(0x0b1420, 20, 70);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 200);
    camera.rotation.order = "YXZ";
    const cameraBody = new THREE.Vector3(spawn.x, EYE_HEIGHT, spawn.z);
    camera.position.copy(cameraBody);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbcd6ef, 0x12294a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.6);
    sun.position.set(40, 60, 20);
    scene.add(sun);

    let groups: RoomLightGroups;
    if (isConvertedRoom(roomId)) {
      const roomModule: RoomModule = {
        room, doorways: deriveRoomDoorways(roomId), wallHeight: WALL_HEIGHT, wallThickness: WALL_THICKNESS, eyeHeight: EYE_HEIGHT, finish,
      };
      groups = buildRoomShell(scene, roomModule);
    } else {
      buildNeutralShell(scene, room, WALL_HEIGHT, finish, true);
      const lights = new THREE.Group();
      scene.add(lights);
      groups = { full: lights, preview: new THREE.Group() };
    }

    const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: NEUTRAL_PREVIEW_FINISH.frameColor, roughness: 0.65, metalness: 0.04 });
    const ownMaterial = createWallMaterial(finish);
    const neighborMaterials = new Map<CampusRoomId, THREE.Material>();
    function materialFor(id: CampusRoomId): THREE.Material {
      if (id === roomId) return ownMaterial;
      const cached = neighborMaterials.get(id);
      if (cached) return cached;
      const material = createWallMaterial(baseFinishForRoom(id));
      neighborMaterials.set(id, material);
      return material;
    }
    const relevantSegments = computeCampusWallSegments().filter((s) => s.roomA === roomId || s.roomB === roomId);
    for (const segment of relevantSegments) {
      const materialA = materialFor(segment.roomA);
      const materialB = segment.roomB ? materialFor(segment.roomB) : null;
      buildSharedWall(scene, segment, materialA, materialB, doorFrameMaterial, { wallHeight: WALL_HEIGHT, wallThickness: WALL_THICKNESS, style: "ordinary" });
    }
    buildRoomTrim(scene, room, relevantSegments, finish, WALL_HEIGHT, WALL_THICKNESS, isConvertedRoom(roomId));

    // A custom uploaded background image — Museum Builder's own preview
    // only (this scene, not the live public museum's VltdMuseumCampus.tsx,
    // which this pass deliberately does not touch) — overrides the wall
    // material's map once it loads.
    let cancelledBg = false;
    if (backgroundImageUrl) {
      new THREE.TextureLoader().load(backgroundImageUrl, (texture) => {
        if (cancelledBg) return;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        ownMaterial.map = texture;
        ownMaterial.color.setHex(0xffffff);
        ownMaterial.needsUpdate = true;
      });
    }

    // Shelf furniture — one board per usable wall span, whenever the
    // separate "Shelf items" capacity slider is in use for this room (ported
    // box/material recipe, see museumRoomFurniture.ts). Unrelated to the
    // Shelves checkbox below — this is the already-working shelf-resting-
    // item feature, untouched.
    if (shelfSlots.length > 0) {
      const shelfMaterial = createShelfMaterial();
      const shelfY = EYE_HEIGHT * 0.42;
      const doorways = deriveRoomDoorways(roomId);
      for (const span of computeRoomShelfSpans(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT)) {
        buildShelfBoard(scene, span, shelfY, WALL_THICKNESS, shelfMaterial);
      }
    }

    // Shelves checkbox (2026-09-12 fixes pass) — a pure visual toggle on the
    // EXISTING wall-item slots (wallSlots), not a different slot system: one
    // more board per usable wall span per row currently in use, drawn at
    // that row's own real shelf-board height (wallRowBoardHeights(), the
    // SHELF_ROW_Y values themselves — see campusRoomBuilder.ts) so it sits
    // directly under the items already hanging at that row. Same
    // buildShelfBoard/createShelfMaterial furniture as the Shelf-items
    // feature above, just called at the wall-row heights instead of the
    // fixed shelf-item height.
    if (wallShelvesEnabled && wallSlots.length > 0) {
      const wallShelfMaterial = createShelfMaterial();
      const doorways = deriveRoomDoorways(roomId);
      const wallSpans = computeRoomShelfSpans(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT);
      for (const boardY of wallRowBoardHeights(rowCount)) {
        for (const span of wallSpans) {
          buildShelfBoard(scene, span, boardY, WALL_THICKNESS, wallShelfMaterial);
        }
      }
    }

    // Case furniture — one cabinet+glass case per case slot.
    for (const slot of caseSlots) buildDisplayCase(scene, slot.x, slot.z);

    let cancelled = false;
    const textureLoader = new THREE.TextureLoader();
    const bySlot = new Map<string, { url: string; label?: string }>();
    for (const [slotId, item] of Object.entries(assignments)) bySlot.set(slotId, { url: item.image_url, label: item.title });
    // Wall + shelf slots both hang as framed pieces — placeItemsAtSlots is
    // the protected live-museum read path (untouched here, just reused);
    // case items are visually different (lying flat under glass), placed
    // by the new placeItemsInCases instead.
    placeItemsAtSlots(scene, textureLoader, groups, [...wallSlots, ...shelfSlots], bySlot, () => cancelled);
    placeItemsInCases(scene, textureLoader, caseSlots, bySlot, () => cancelled);

    // Camera (first-round-fixes pass, 2026-09-12): drag-to-look PLUS real
    // movement — scroll-to-step and WASD — built from visitorController.ts's
    // own shared functions, the exact ones VltdMuseumCampus.tsx's walkable
    // campus and VirtualGalleryRoom.tsx's accepted room already use (applyDrag/
    // aimCamera unchanged from the original pass; buildKeyboardMoveDirection/
    // easeTowardTargets/WHEEL_STEP/facingDirection new to this page). Collision
    // is a simple rectangular clamp against THIS room's own real bounds
    // (roomBounds) — the same technique the accepted personal room's own
    // clampPosition uses for its one fixed-size room, adapted here to whatever
    // size the current museum room actually is, since every campus room is a
    // different footprint — enough to keep the camera from clipping through
    // this room's own walls; no doorway-to-doorway campus walkability needed
    // for a single-room editor.
    let yaw = 0;
    let targetYaw = 0;
    let pitch = 0;
    let targetPitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const targetCameraBody = cameraBody.clone();
    const pressedKeys = new Set<string>();
    const bounds = roomBounds(room);
    // Keeps the camera's eye point (not its feet) at least this far inside
    // each wall face — comfortably clear of both the wall itself and any
    // furniture (shelf boards/display cases) built flush against it.
    const CAMERA_WALL_MARGIN = 0.8;

    function clampToRoom(position: THREE.Vector3) {
      position.x = Math.max(bounds.x0 + CAMERA_WALL_MARGIN, Math.min(bounds.x1 - CAMERA_WALL_MARGIN, position.x));
      position.z = Math.max(bounds.z0 + CAMERA_WALL_MARGIN, Math.min(bounds.z1 - CAMERA_WALL_MARGIN, position.z));
      return position;
    }

    function onPointerDown(event: PointerEvent) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
    function onPointerMove(event: PointerEvent) {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      const next = applyDrag(dx, dy, targetYaw, targetPitch, MUSEUM_PITCH_LIMIT);
      targetYaw = next.targetYaw;
      targetPitch = next.targetPitch;
    }
    function onPointerUp() {
      dragging = false;
    }
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Scroll-to-step forward/back — same fixed WHEEL_STEP-per-event nudge to
    // targetCameraBody the accepted room's own onWheel/moveCamera use (eases
    // in over subsequent frames via easeTowardTargets below), not the raw
    // deltaY magnitude.
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const amount = event.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      targetCameraBody.add(facingDirection(targetYaw).multiplyScalar(amount));
      targetCameraBody.y = EYE_HEIGHT;
      clampToRoom(targetCameraBody);
    }
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // WASD — continuous, held-key movement. Mutates cameraBody directly each
    // frame (no easing lag, same as the accepted room's own continuous WASD),
    // then syncs targetCameraBody to match so a subsequent wheel nudge eases
    // from wherever WASD left off instead of snapping back to a stale target.
    function movementKeyToken(event: KeyboardEvent): string | null {
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") return "forward";
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") return "back";
      if (event.key.toLowerCase() === "a") return "left";
      if (event.key.toLowerCase() === "d") return "right";
      return null;
    }
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
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
    // A held key's keyup can be missed if focus leaves the window while it's
    // down (alt-tab, clicking browser chrome) — without this it would read
    // as permanently "held," same fix the accepted room/campus both apply.
    function onWindowBlur() {
      pressedKeys.clear();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    let raf = 0;
    let lastFrameTime = performance.now();
    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;

      if (pressedKeys.size > 0) {
        const move = buildKeyboardMoveDirection(
          {
            forward: pressedKeys.has("forward"),
            back: pressedKeys.has("back"),
            left: pressedKeys.has("left"),
            right: pressedKeys.has("right"),
          },
          targetYaw
        );
        if (move.lengthSq() > 0) {
          move.multiplyScalar(MUSEUM_WALK_SPEED * dt);
          cameraBody.add(move);
          cameraBody.y = EYE_HEIGHT;
          clampToRoom(cameraBody);
          targetCameraBody.copy(cameraBody);
        }
      }

      const eased = easeTowardTargets(yaw, targetYaw, pitch, targetPitch, cameraBody, targetCameraBody);
      yaw = eased.yaw;
      pitch = eased.pitch;
      aimCamera(camera, cameraBody, yaw, pitch);
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    setReady(true);

    return () => {
      cancelled = true;
      cancelledBg = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            const maps = material as Partial<Record<"map" | "bumpMap" | "emissiveMap", THREE.Texture | null>>;
            maps.map?.dispose();
            maps.bumpMap?.dispose();
            maps.emissiveMap?.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [roomId, wallSlots, shelfSlots, caseSlots, assignments, backgroundImageUrl, allSlots.length, rowCount, wallShelvesEnabled]);

  // Same rAF projection technique MuseumRoomPopup.tsx/VirtualGalleryRoom.tsx
  // both already use for their own Organize overlays.
  useEffect(() => {
    if (!ready || allSlots.length === 0) return undefined;
    let raf = 0;
    const tmp = new THREE.Vector3();
    function tick() {
      const camera = cameraRef.current;
      const mount = mountRef.current;
      if (camera && mount) {
        const rect = mount.getBoundingClientRect();
        organizer.slotRefs.current.forEach((el, index) => {
          const slot = allSlots[index];
          if (!el) return;
          if (!slot) {
            el.style.display = "none";
            return;
          }
          tmp.set(slot.x, slot.y, slot.z);
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
  }, [ready, allSlots, organizer.slotRefs]);

  async function handlePickItem(ids: string[]) {
    if (pickerSlotIdx === null) return;
    const slot = allSlots[pickerSlotIdx];
    const id = ids[0];
    const item = vaultItems.find((v) => v.id === id);
    const image = item ? getPrimaryImageUrl(item) : "";
    if (!slot || !item || !image) {
      setPickerSlotIdx(null);
      return;
    }
    setItemSaveState("saving");
    const result = await setRoomItemSlot(roomId, slot.id, { title: item.title, image_url: image }, 0);
    setItemSaveState(result.ok ? "saved" : "error");
    setPickerSlotIdx(null);
    organizer.setOrganizeSelectedSlot(null);
    if (result.ok) {
      await refreshAssignments(allSlots);
      window.setTimeout(() => setItemSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  const pickableItems = useMemo(() => vaultItems.filter((item) => Boolean(getPrimaryImageUrl(item))), [vaultItems]);
  const placedCount = Object.keys(assignments).length;
  const currentRoom = roomById(roomId);

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="w-[300px] shrink-0 rounded-[8px] border bg-[color:var(--theme-card)] p-3 shadow-[var(--shadow-soft)]" style={{ borderColor: "var(--theme-border)" }}>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--muted2)]">
              <Layers3 size={12} />
              VLTD Museum
            </div>
            <h1 className="mt-1 text-xl font-black uppercase leading-[0.92] tracking-normal">Museum Builder</h1>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <MetricTile label="Placed" value={`${placedCount}/${allSlots.length}`} />
              <MetricTile label="Room" value={visitorFacingRoomName(currentRoom.label)} />
              <MetricTile label="Mode" value="3D" />
            </div>
          </div>

          <div className="flex w-[260px] shrink-0">
            <ControlPanel title="Source" icon={<DoorOpen size={15} />}>
              <select
                value={roomId}
                onChange={(event) => setRoomId(event.target.value as CampusRoomId)}
                className="h-8 w-full rounded-[6px] bg-[color:var(--input)] px-2.5 text-xs ring-1 ring-[color:var(--border)]"
              >
                <optgroup label="Museum Rooms">
                  {editableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {visitorFacingRoomName(room.label)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-[11px] leading-4 text-[color:var(--muted)]">
                The real shared VLTD Museum — every change here saves live to that room.
              </p>
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
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <CapacitySlider label="Wall items" value={itemCapacity} min={MIN_ITEM_CAPACITY} max={MAX_ITEM_CAPACITY} onChange={setItemCapacity} />
                  <CapacitySlider label="Shelf items" value={shelfCapacity} min={0} max={MAX_SHELF_CAPACITY} onChange={setShelfCapacity} />
                  {caseEligible ? (
                    <CapacitySlider label="Case items" value={caseCapacity} min={0} max={MAX_CASE_CAPACITY} onChange={setCaseCapacity} />
                  ) : (
                    <span className="text-[10px] font-semibold text-[color:var(--muted)]" title="This room's floor plan has no wall long enough, clear of doorways, for a safe display-case run.">
                      Cases not available in this room
                    </span>
                  )}
                  {capacitySaveState === "saving" ? <span className="text-[11px] font-semibold text-cyan-300">Saving…</span> : null}
                  {capacitySaveState === "saved" ? <span className="text-[11px] font-semibold text-emerald-300">Saved</span> : null}
                  {capacitySaveState === "error" ? <span className="text-[11px] font-semibold text-red-300">Save failed</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--muted2)]">Rows</span>
                    <div className="w-[168px]">
                      <Segmented
                        value={String(rowCount)}
                        options={[
                          ["1", "Single"],
                          ["2", "Dual"],
                          ["3", "Three"],
                        ]}
                        onChange={(value) => setRowCount(Number(value) as RoomRowCount)}
                      />
                    </div>
                  </div>
                  <label className="flex h-6 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold ring-1 ring-[color:var(--border)]">
                    <input
                      type="checkbox"
                      checked={wallShelvesEnabled}
                      onChange={(event) => setWallShelvesEnabled(event.target.checked)}
                      className="h-3 w-3 accent-cyan-400"
                    />
                    Shelves
                  </label>
                  {rowSaveState === "saving" ? <span className="text-[11px] font-semibold text-cyan-300">Saving…</span> : null}
                  {rowSaveState === "saved" ? <span className="text-[11px] font-semibold text-emerald-300">Saved</span> : null}
                  {rowSaveState === "error" ? <span className="text-[11px] font-semibold text-red-300">Save failed</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="flex h-6 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold ring-1 ring-[color:var(--border)] transition hover:bg-black/10">
                    <Paintbrush size={12} />
                    {backgroundUploading ? "Uploading…" : "Wallpaper"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={backgroundUploading}
                      onChange={(event) => {
                        void handleBackgroundUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {backgroundImageUrl ? (
                    <button
                      type="button"
                      onClick={() => void handleBackgroundImageClear()}
                      className="flex h-6 items-center rounded-[5px] bg-[color:var(--input)] px-2 text-[11px] font-bold text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
                    >
                      Remove
                    </button>
                  ) : null}
                  {backgroundSaveState === "saved" ? <span className="text-[11px] font-semibold text-emerald-300">Saved</span> : null}
                  {backgroundError ? <div className="basis-full text-[11px] font-semibold text-red-300">{backgroundError}</div> : null}
                </div>
              </div>
            ) : null}
          </ControlPanel>
        </div>

        <section
          className="overflow-hidden rounded-[8px] border shadow-[0_30px_90px_rgba(0,0,0,0.34)] xl:self-start"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <div className="relative min-h-[600px]">
            <div ref={mountRef} className="absolute inset-0" style={{ touchAction: "none" }} />

            {!ready ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
                Building {visitorFacingRoomName(currentRoom.label)}…
              </div>
            ) : null}

            {isOrganizing && allSlots.length > 0 ? (
              <OrganizeSlotOverlay slotCount={allSlots.length} slotItems={slotItems} organizer={organizer} onOpenPicker={(idx) => setPickerSlotIdx(idx)} />
            ) : null}

            <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
              <div className="pointer-events-none flex items-center gap-2 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur">
                <Layers3 size={14} />
                {visitorFacingRoomName(currentRoom.label)}
              </div>
              <Link
                href="/museum/vltd"
                className="flex items-center gap-1.5 rounded-[6px] bg-black/42 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/12 backdrop-blur transition hover:bg-black/60"
                title="Exit to the live museum"
              >
                <DoorOpen size={14} />
                Exit
              </Link>
              <button
                type="button"
                onClick={() => setIsOrganizing((current) => !current)}
                aria-pressed={isOrganizing}
                className={[
                  "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition",
                  isOrganizing ? "bg-[#4FD3EE] text-[#06171d]" : "bg-black/42 text-white ring-1 ring-white/12 hover:bg-black/60",
                ].join(" ")}
                title="Show numbered positions and add, move, or remove items"
              >
                <Grid3X3 size={14} />
                {isOrganizing ? "Done" : "Organize"}
              </button>
              <div
                className={[
                  "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur",
                  itemSaveState === "error" ? "bg-red-500/85 text-white" : "bg-black/42 text-white ring-1 ring-white/12",
                ].join(" ")}
                title="This room saves each change immediately — there is no separate Save step"
              >
                <Save size={14} />
                {itemSaveState === "saving" ? "Saving…" : itemSaveState === "error" ? "Save Failed" : "Autosaved"}
              </div>
            </div>
          </div>
        </section>
      </div>

      <OrganizeMoveMenu groups={slotGroups} slotItems={slotItems} organizer={organizer} />
      <OrganizeReplaceConfirm organizer={organizer} />

      {pickerSlotIdx !== null ? (
        <ItemPickerSheet
          allItems={pickableItems}
          confirmedIds={[]}
          mode="single"
          maxItems={1}
          pickerTitle={`${visitorFacingRoomName(currentRoom.label)} — position ${pickerSlotIdx + 1}`}
          onConfirm={(ids) => void handlePickItem(ids)}
          onClose={() => {
            setPickerSlotIdx(null);
            organizer.setOrganizeSelectedSlot(null);
          }}
        />
      ) : null}

      <div aria-live="polite" className="sr-only">{liveAnnouncement}</div>
    </main>
  );
}

// Small local shell helpers, patterned after VirtualGalleryRoom.tsx's own
// (unexported) ControlPanel/Segmented/Metric so this new page's identity
// card/panels read visually consistent with the Gallery Builder's shell —
// duplicated here rather than imported since those are private, unexported
// functions in a file this work order requires stay untouched.
function ControlPanel({
  title, icon, action, children,
}: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex-1 rounded-[8px] border bg-[color:var(--theme-card)] p-2.5 shadow-[var(--shadow-soft)]" style={{ borderColor: "var(--theme-border)" }}>
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] bg-[color:var(--input)] p-2 ring-1 ring-[color:var(--border)]">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--muted2)]">{label}</div>
      <div className="truncate text-sm font-black">{value}</div>
    </div>
  );
}

// Same segmented-control look/behavior as VirtualGalleryRoom.tsx's own
// (unexported) Segmented — duplicated here per this file's own header note
// rather than imported, since that's a private function in a file this work
// order requires stay untouched. Used for the new Rows selector (Single/
// Dual/Three) below.
function Segmented({
  value, options, onChange,
}: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
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

function CapacitySlider({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px] font-bold">
      <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-[0.1em] text-[color:var(--muted2)]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-[120px] accent-cyan-400"
      />
      <span className="w-5 text-right tabular-nums">{value}</span>
    </label>
  );
}
