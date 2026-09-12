"use client";

// Shared Museum Room Editor consolidation pass (2026-09-12): EK's direct
// correction on the prior two passes — "We keep the 3D gallery the way its
// is. We take all of its functionally, design, colors ect. and fit it to
// every room in the museum individually... The ADD Edit room should create
// a pop of that room, that has all the functionality of the 'Organize'
// button in the 3D gallery." This replaces RoomEditorModal.tsx's old
// `target=_blank` link to a full-page `/museum/vltd?edit=<roomId>` (which
// dropped the admin into the whole walkable, multi-room campus) with an
// in-page popup showing ONLY this one room — real geometry, real finish,
// camera fixed inside it (drag-to-look only, no walking) — running the
// exact same Organize overlay VirtualGalleryRoom.tsx uses, from
// organizeSlots.tsx, wired to museum_room_items via slot_id instead of a
// personal Hall's selectedIds array.
//
// What's reused vs. newly built:
//   - Reused, unchanged: computeRoomPlacementSlots()/placeItemsAtSlots()
//     (campusRoomBuilder.ts — the real per-room geometry-driven slot
//     generator EK confirmed must stay), buildRoomShell/buildNeutralShell/
//     buildSharedWall/buildRoomTrim (the same shell-building functions
//     VltdMuseumCampus.tsx itself calls), and the entire Organize
//     overlay/Move-menu/Replace-confirm from organizeSlots.tsx.
//   - Newly built (deliberately small): the scene-setup effect below only
//     builds walls/trim for the segments touching THIS room (not the whole
//     campus) and a drag-to-look-only camera (via visitorController.ts's
//     own applyDrag/aimCamera math — reused, not reinvented — with no
//     WASD/collision, since this is a fixed vantage point, not a walkable
//     space).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  computeCampusWallSegments,
  deriveRoomDoorways,
  roomById,
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
  setRoomItemSlot,
  type MuseumRoomItem,
} from "@/lib/museumCampusConfig";
import {
  buildNeutralShell,
  buildRoomShell,
  buildRoomTrim,
  buildSharedWall,
  computeRoomPlacementSlots,
  createWallMaterial,
  HUB_FINISH,
  NEUTRAL_LEGACY_FINISH,
  NEUTRAL_PREVIEW_FINISH,
  placeItemsAtSlots,
  type PlacementSlot,
  type RoomFinish,
  type RoomLightGroups,
  type RoomModule,
} from "@/lib/campusRoomBuilder";
import { MUSEUM_PITCH_LIMIT } from "@/lib/museumStandard";
import { applyDrag, aimCamera, YAW_EASE_RATE } from "@/lib/visitorController";
import { getPrimaryImageUrl, loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { OrganizeMoveMenu, OrganizeReplaceConfirm, OrganizeSlotOverlay, useSlotOrganizer, type OrganizeSlotGroup } from "./organizeSlots";
import { ItemPickerSheet } from "./ItemPickerSheet";

// Same room-category finish mapping VltdMuseumCampus.tsx's own
// baseFinishForRoom() uses (POP_CULTURE/TCG/COLLECTION get the "converted"
// preview finish + full light rig; HUB isn't editable so never reaches
// here; every other editable room gets the shared neutral legacy finish).
// Kept as its own tiny copy rather than an import — this is a 3-line
// categorization table, not the Organize interaction logic the work order
// is about consolidating.
function baseFinishForRoom(roomId: CampusRoomId): RoomFinish {
  if (roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION") return NEUTRAL_PREVIEW_FINISH;
  if (roomId === "HUB") return HUB_FINISH;
  return NEUTRAL_LEGACY_FINISH;
}
function isConvertedRoom(roomId: CampusRoomId): boolean {
  return roomId === "POP_CULTURE" || roomId === "TCG" || roomId === "COLLECTION";
}
// SPORTS is the one room with a dedicated doorless focal wall — same rule
// computeRoomPlacementSlots' own focalWall param exists for. Copied from
// VltdMuseumCampus.tsx's own focalWallFor(), same reasoning as the finish
// mapping above.
function focalWallFor(roomId: CampusRoomId) {
  return roomId === "SPORTS" ? ("south" as const) : undefined;
}

export default function MuseumRoomPopup({
  roomId,
  roomLabel,
  onClose,
}: {
  roomId: CampusRoomId;
  roomLabel: string;
  onClose: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [ready, setReady] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [slots, setSlots] = useState<PlacementSlot[]>([]);
  const [assignments, setAssignments] = useState<Record<string, MuseumRoomItem>>({});
  const [pickerSlotIdx, setPickerSlotIdx] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const capacityRef = useRef(DEFAULT_ITEMS_PER_ROOM);

  function announce(message: string) {
    setLiveAnnouncement((current) => (current === message ? `${message} ` : message));
  }

  // Same vault source the personal Gallery's own picker and the old
  // MuseumRoomItemPicker.tsx both used — loadItems() first (instant, from
  // whatever's cached), then the real Supabase sync, exactly like
  // VirtualGalleryRoom.tsx's own mount effect.
  useEffect(() => {
    setVaultItems(loadItems());
    void syncVaultItemsFromSupabase().then((synced) => {
      if (synced.length > 0) setVaultItems(synced);
    });
  }, []);

  async function refreshAssignments(currentSlots: PlacementSlot[]) {
    const items = await getEnabledRoomItems(roomId);
    const bySlot: Record<string, MuseumRoomItem> = {};
    for (const item of items) {
      if (item.slot_id && currentSlots.some((s) => s.id === item.slot_id)) bySlot[item.slot_id] = item;
    }
    setAssignments(bySlot);
  }

  useEffect(() => {
    let cancelled = false;
    void getItemsPerRoom().then((capacity) => {
      if (cancelled) return;
      capacityRef.current = capacity;
      const doorways = deriveRoomDoorways(roomId);
      const nextSlots = computeRoomPlacementSlots(roomId, doorways, WALL_THICKNESS, EYE_HEIGHT, capacity, focalWallFor(roomId));
      setSlots(nextSlots);
      void refreshAssignments(nextSlots);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Scene setup — builds ONLY this one room (its real shell/finish, and
  // only the wall segments that actually touch it), a fixed-position
  // camera with drag-to-look (no walking), and the currently-assigned
  // items via placeItemsAtSlots — the exact same function the live museum
  // display uses, so what an admin sees here matches what visitors see.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || slots.length === 0) return undefined;

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

    // Only the wall segments touching THIS room — a neighbor's face gets
    // its own real finish color (so a doorway reads correctly), but its
    // floor/ceiling/lighting are never built. This is the one thing that
    // makes this a focused single-room view instead of the whole walkable
    // campus.
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
      buildSharedWall(scene, segment, materialA, materialB, doorFrameMaterial, {
        wallHeight: WALL_HEIGHT, wallThickness: WALL_THICKNESS, style: "ordinary",
      });
    }
    buildRoomTrim(scene, room, relevantSegments, finish, WALL_HEIGHT, WALL_THICKNESS, isConvertedRoom(roomId));

    let cancelled = false;
    const textureLoader = new THREE.TextureLoader();
    const bySlot = new Map<string, { url: string; label?: string }>();
    for (const [slotId, item] of Object.entries(assignments)) {
      bySlot.set(slotId, { url: item.image_url, label: item.title });
    }
    placeItemsAtSlots(scene, textureLoader, groups, slots, bySlot, () => cancelled);

    // Drag-to-look only — no WASD, no collision, no wheel-step movement.
    // Reuses visitorController.ts's own applyDrag/aimCamera math (the exact
    // same drag-look formula the walkable campus and the personal Gallery
    // both use) rather than inventing a new one; just never wires up
    // movement keys or a position target, so the camera body itself never
    // moves from `cameraBody`.
    let yaw = 0;
    let targetYaw = 0;
    let pitch = 0;
    let targetPitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

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

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    let raf = 0;
    function tick() {
      yaw += (targetYaw - yaw) * YAW_EASE_RATE;
      pitch += (targetPitch - pitch) * YAW_EASE_RATE;
      aimCamera(camera, cameraBody, yaw, pitch);
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(tick);
    }
    raf = window.requestAnimationFrame(tick);
    setReady(true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
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
    // Deliberately re-runs when `slots`/`assignments` change (a save or the
    // initial slot computation) — this is one focused room, not a
    // multi-second full-campus build, so a full rebuild on every save is
    // cheap here (unlike VltdMuseumCampus.tsx's own mount-only effect).
  }, [roomId, slots, assignments]);

  // Slot items in array-index order, matching `slots` — the shape
  // useSlotOrganizer() expects (see organizeSlots.tsx).
  const slotItems = useMemo(
    () => slots.map((slot) => {
      const item = assignments[slot.id];
      return item ? { title: item.title } : null;
    }),
    [slots, assignments]
  );

  // "Wall" grouping for the Move menu — same idea as the personal Gallery's
  // own slotGroups, built from PlacementSlot's own `.wall` field instead of
  // a bespoke per-room wall table.
  const slotGroups: OrganizeSlotGroup[] = useMemo(() => {
    const order: PlacementSlot["wall"][] = ["north", "south", "east", "west"];
    const labels: Record<PlacementSlot["wall"], string> = { north: "North Wall", south: "South Wall", east: "East Wall", west: "West Wall" };
    return order
      .map((wall) => ({
        label: labels[wall],
        indices: slots.map((s, idx) => ({ s, idx })).filter((entry) => entry.s.wall === wall).map((entry) => entry.idx),
      }))
      .filter((group) => group.indices.length > 0);
  }, [slots]);

  async function persistMove(fromIdx: number, toIdx: number) {
    const fromSlot = slots[fromIdx];
    const toSlot = slots[toIdx];
    const source = assignments[fromSlot.id];
    if (!fromSlot || !toSlot || !source) return;
    setSaveState("saving");
    const placed = await setRoomItemSlot(roomId, toSlot.id, { title: source.title, image_url: source.image_url }, 0);
    const cleared = placed.ok ? await clearRoomItemSlot(roomId, fromSlot.id) : { ok: false };
    setSaveState(placed.ok && cleared.ok ? "saved" : "error");
    if (placed.ok) {
      await refreshAssignments(slots);
      window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  async function persistRemove(idx: number) {
    const slot = slots[idx];
    if (!slot) return;
    setSaveState("saving");
    const result = await clearRoomItemSlot(roomId, slot.id);
    setSaveState(result.ok ? "saved" : "error");
    if (result.ok) {
      await refreshAssignments(slots);
      window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  // The exact same Organize interaction/data layer VirtualGalleryRoom.tsx
  // now uses (organizeSlots.tsx) — onMove/onReplace share the same body
  // (setRoomItemSlot at the destination, then clearRoomItemSlot at the
  // source) because a "replace" and a plain "move" are the same upsert
  // here; the shared hook is what decides which one applies, from whether
  // the destination slot was already occupied.
  const organizer = useSlotOrganizer({
    slotItems,
    announce,
    onMove: (fromIdx, toIdx) => void persistMove(fromIdx, toIdx),
    onReplace: (fromIdx, toIdx) => void persistMove(fromIdx, toIdx),
    onRemove: (idx) => void persistRemove(idx),
  });

  async function handlePickItem(ids: string[]) {
    if (pickerSlotIdx === null) return;
    const slot = slots[pickerSlotIdx];
    const id = ids[0];
    const item = vaultItems.find((v) => v.id === id);
    const image = item ? getPrimaryImageUrl(item) : "";
    if (!slot || !item || !image) {
      setPickerSlotIdx(null);
      return;
    }
    setSaveState("saving");
    const result = await setRoomItemSlot(roomId, slot.id, { title: item.title, image_url: image }, 0);
    setSaveState(result.ok ? "saved" : "error");
    setPickerSlotIdx(null);
    organizer.setOrganizeSelectedSlot(null);
    if (result.ok) {
      await refreshAssignments(slots);
      window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1600);
    }
  }

  const pickableItems = useMemo(() => vaultItems.filter((item) => Boolean(getPrimaryImageUrl(item))), [vaultItems]);
  const placedCount = Object.keys(assignments).length;

  return (
    <div
      className="fixed inset-0 z-[300] bg-[#081527]"
      role="dialog"
      aria-modal="true"
      aria-label={`Add items / edit ${roomLabel}`}
    >
      <div ref={mountRef} className="absolute inset-0" style={{ touchAction: "none" }} />

      {!ready ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-white/70">
          Building {roomLabel}…
        </div>
      ) : null}

      {slots.length > 0 ? (
        <OrganizeSlotOverlay
          slotCount={slots.length}
          slotItems={slotItems}
          organizer={organizer}
          onOpenPicker={(idx) => setPickerSlotIdx(idx)}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70"
        >
          ← Done
        </button>
        <div className="rounded-full bg-black/55 px-4 py-2 text-right ring-1 ring-white/15 backdrop-blur">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Add items / edit room</div>
          <div className="text-sm font-semibold text-white">
            {roomLabel} · {placedCount}/{slots.length}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-4">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/70 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur">
          <span className="text-xs font-black uppercase tracking-[0.1em] text-white/70">
            Drag to look around · click a numbered position to add, move, or remove an item
          </span>
          {saveState === "saving" ? <span className="text-xs font-semibold text-cyan-200">Saving…</span> : null}
          {saveState === "saved" ? <span className="text-xs font-semibold text-emerald-300">Saved</span> : null}
          {saveState === "error" ? <span className="text-xs font-semibold text-red-300">Save failed — try again</span> : null}
        </div>
      </div>

      <OrganizeMoveMenu groups={slotGroups} slotItems={slotItems} organizer={organizer} />
      <OrganizeReplaceConfirm organizer={organizer} />

      {pickerSlotIdx !== null ? (
        <ItemPickerSheet
          allItems={pickableItems}
          confirmedIds={[]}
          mode="single"
          maxItems={1}
          pickerTitle={`${roomLabel} — position ${pickerSlotIdx + 1}`}
          onConfirm={(ids) => void handlePickItem(ids)}
          onClose={() => {
            setPickerSlotIdx(null);
            organizer.setOrganizeSelectedSlot(null);
          }}
        />
      ) : null}

      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>
    </div>
  );
}
