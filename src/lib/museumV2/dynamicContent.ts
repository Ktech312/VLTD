// Museum Runtime V2 (2026-09-23) — dynamic room content.
// Places a room's real, live museum_room_items (admin-curated Vault items)
// onto its wall slots at render time — the SAME engine
// (computeRoomPlacementSlots/placeItemsAtSlots, campusRoomBuilder.ts) the
// legacy live campus and the Museum Builder editor both already use, so a
// V2 room's item layout can never disagree with either of those. This is
// what keeps a procedurally-built room's artwork/labels genuinely dynamic
// (fetched fresh, not baked) rather than frozen at some past publish.
//
// Deliberately NOT used for POP_CULTURE's own item content in this pass —
// see roomStreaming.ts's own comment for why (the existing Publish pipeline
// bakes whatever was placed in Museum Builder's preview scene AT publish
// time, items included, with no marker in the exported .glb distinguishing
// "item mesh" from "furniture mesh" that this file could use to strip and
// replace them safely). This module exists so TCG and HUB — the two
// preloaded neighbor rooms, neither baked in this pass — get their real,
// live item content exactly as the legacy campus renders it today, and so
// it's the ready fallback path for POP_CULTURE itself if its own
// baked_asset_url is ever missing.
//
// Case/shelf furniture (museumRoomFurniture.ts's buildDisplayCase/
// buildShelfBoard) is out of scope for this first V2 pass — every room this
// runtime currently builds only needs wall-slot placement to match its real
// production content (case_capacity/shelf_capacity are 0 for TCG and HUB
// today), so that furniture path was left unported rather than carried over
// unused and unverified.

import * as THREE from "three";

import { getEnabledRoomItems, type MuseumRoomItem } from "@/lib/museumCampusConfig";
import {
  computeRoomPlacementSlots,
  placeItemsAtSlots,
  type ArtworkFrameStyle,
  type PlacementSlot,
  type RoomLightGroups,
} from "@/lib/campusRoomBuilder";
import { deriveRoomDoorways, type CampusRoomId } from "@/lib/campusLayout";

// Ported verbatim from VltdMuseumCampus.tsx's own local buildSlotAssignments
// (not exported there) — merges a room's curated items into its generated
// placement slots, an item pinned to a slot_id keeps that exact position,
// anything else auto-fills whatever slots are still empty in slot order.
function buildSlotAssignments(
  slots: PlacementSlot[],
  items: MuseumRoomItem[]
): Map<string, { url: string; label?: string }> {
  const validIds = new Set(slots.map((s) => s.id));
  const bySlot = new Map<string, { url: string; label?: string }>();
  const unassigned: MuseumRoomItem[] = [];
  for (const item of items) {
    if (item.slot_id && validIds.has(item.slot_id) && !bySlot.has(item.slot_id)) {
      bySlot.set(item.slot_id, { url: item.image_url, label: item.title });
    } else {
      unassigned.push(item);
    }
  }
  let cursor = 0;
  for (const slot of slots) {
    if (bySlot.has(slot.id)) continue;
    if (cursor >= unassigned.length) break;
    bySlot.set(slot.id, { url: unassigned[cursor].image_url, label: unassigned[cursor].title });
    cursor += 1;
  }
  return bySlot;
}

export async function placeDynamicRoomItems(
  scene: THREE.Scene,
  textureLoader: THREE.TextureLoader,
  groups: RoomLightGroups,
  roomId: CampusRoomId,
  wallThickness: number,
  eyeHeight: number,
  itemCapacity: number,
  isCancelled: () => boolean,
  frameStyle: ArtworkFrameStyle = "classic"
): Promise<void> {
  const items = await getEnabledRoomItems(roomId);
  if (isCancelled() || items.length === 0 || itemCapacity <= 0) return;

  const doorways = deriveRoomDoorways(roomId);
  const wallSlots = computeRoomPlacementSlots(roomId, doorways, wallThickness, eyeHeight, itemCapacity);
  if (wallSlots.length === 0) return;

  const bySlot = buildSlotAssignments(wallSlots, items);
  placeItemsAtSlots(scene, textureLoader, groups, wallSlots, bySlot, isCancelled, frameStyle);
}
