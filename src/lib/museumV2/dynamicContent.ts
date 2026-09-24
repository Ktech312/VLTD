// Museum Runtime V2 (2026-09-23, architecture-separation pass 2026-09-24)
// — dynamic room content. Places a room's real, live museum_room_items
// (admin-curated Vault items) onto its wall slots at render time — the
// SAME engine (computeRoomPlacementSlots/placeItemsAtSlots,
// campusRoomBuilder.ts) the legacy live campus and the Museum Builder
// editor both already use, so a V2 room's item layout can never disagree
// with either of those. This is what keeps a room's artwork/labels
// genuinely dynamic (fetched fresh every time the room loads, not baked)
// — used for EVERY room this runtime builds, POP_CULTURE included: its
// Publish pipeline now excludes item content entirely (see
// MuseumBuilder.tsx's handlePublish() and campusRoomBuilder.ts's
// MuseumItemClickRef comment), so its real content always comes from here,
// exactly like TCG/HUB.
//
// Each placed item is tagged with a MuseumItemClickRef (see
// campusRoomBuilder.ts) so interaction.ts can raycast a click straight to
// the real museum_room_items row (and, if known, the real vault_items row)
// it came from — this is what makes item clicking work.
//
// Case/shelf furniture (museumRoomFurniture.ts's buildDisplayCase/
// buildShelfBoard) is out of scope for this pass — every room this runtime
// currently builds only needs wall-slot placement to match its real
// production content (case_capacity/shelf_capacity are 0 for TCG/HUB/
// POP_CULTURE today), so that furniture path was left unported rather than
// carried over unused and unverified.

import * as THREE from "three";

import { getEnabledRoomItems, type MuseumRoomItem } from "@/lib/museumCampusConfig";
import {
  computeRoomPlacementSlots,
  placeItemsAtSlots,
  type ArtworkFrameStyle,
  type MuseumItemClickRef,
  type PlacementSlot,
  type RoomLightGroups,
} from "@/lib/campusRoomBuilder";
import { deriveRoomDoorways, type CampusRoomId } from "@/lib/campusLayout";

function clickRefFor(item: MuseumRoomItem): MuseumItemClickRef {
  return {
    museumItemId: item.id,
    vaultItemId: item.vault_item_id ?? null,
    title: item.title,
    imageUrl: item.image_url,
    estimatedValue: item.estimated_value ?? null,
    showValue: item.show_value ?? false,
  };
}

// Ported verbatim from VltdMuseumCampus.tsx's own local buildSlotAssignments
// (not exported there) — merges a room's curated items into its generated
// placement slots, an item pinned to a slot_id keeps that exact position,
// anything else auto-fills whatever slots are still empty in slot order.
function buildSlotAssignments(
  slots: PlacementSlot[],
  items: MuseumRoomItem[]
): Map<string, { url: string; label?: string; itemRef: MuseumItemClickRef }> {
  const validIds = new Set(slots.map((s) => s.id));
  const bySlot = new Map<string, { url: string; label?: string; itemRef: MuseumItemClickRef }>();
  const unassigned: MuseumRoomItem[] = [];
  for (const item of items) {
    if (item.slot_id && validIds.has(item.slot_id) && !bySlot.has(item.slot_id)) {
      bySlot.set(item.slot_id, { url: item.image_url, label: item.title, itemRef: clickRefFor(item) });
    } else {
      unassigned.push(item);
    }
  }
  let cursor = 0;
  for (const slot of slots) {
    if (bySlot.has(slot.id)) continue;
    if (cursor >= unassigned.length) break;
    const item = unassigned[cursor];
    bySlot.set(slot.id, { url: item.image_url, label: item.title, itemRef: clickRefFor(item) });
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
