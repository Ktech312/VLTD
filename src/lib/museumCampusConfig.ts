"use client";

// Admin-controlled config for the VLTD Museum public campus — EK's ask
// (2026-09-02): "I need to control this" for the Spotlight room's
// rotating programs, the Store room's items, and how many items show per
// category room, since these will change and grow over time. Managed at
// /admin/museum-campus. Backing tables are in
// 20260902_museum_campus_config.sql — EK runs migrations manually, so
// every fetch here falls back to a sane default if the table doesn't
// exist yet rather than breaking the campus page.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const DEFAULT_ITEMS_PER_ROOM = 8;

export type SpotlightProgram = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type StoreItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_label: string | null;
  link_url: string | null;
  enabled: boolean;
  sort_order: number;
};

export async function getItemsPerRoom(): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return DEFAULT_ITEMS_PER_ROOM;
  try {
    const { data } = await supabase
      .from("museum_campus_config")
      .select("items_per_room")
      .limit(1)
      .maybeSingle();
    const value = data?.items_per_room;
    return typeof value === "number" && value > 0 ? value : DEFAULT_ITEMS_PER_ROOM;
  } catch {
    return DEFAULT_ITEMS_PER_ROOM;
  }
}

export async function getActiveSpotlightPrograms(): Promise<SpotlightProgram[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_spotlight_programs")
      .select("id, title, description, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as SpotlightProgram[];
  } catch {
    return [];
  }
}

export async function getEnabledStoreItems(): Promise<StoreItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_store_items")
      .select("id, name, description, image_url, price_label, link_url, enabled, sort_order")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as StoreItem[];
  } catch {
    return [];
  }
}

// 2026-09-11: real, admin-curated items for a category room — starting with
// SPORTS, the first "proof room" replacing whichever personal vault happens
// to be signed in with actual curated content for the shared museum.
// `room_id` is a generic text column (see 20260911_museum_room_items.sql) so
// the same table/function covers every other room later.
export type MuseumRoomItem = {
  id: string;
  room_id: string;
  title: string;
  image_url: string;
  enabled: boolean;
  sort_order: number;
};

export async function getEnabledRoomItems(roomId: string): Promise<MuseumRoomItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_room_items")
      .select("id, room_id, title, image_url, enabled, sort_order")
      .eq("room_id", roomId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as MuseumRoomItem[];
  } catch {
    return [];
  }
}

/** Every item for a room, enabled or not — the room editor needs to show
 * and toggle disabled items too, unlike the museum's own display (above),
 * which only ever renders enabled ones. */
export async function getAllRoomItems(roomId: string): Promise<MuseumRoomItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_room_items")
      .select("id, room_id, title, image_url, enabled, sort_order")
      .eq("room_id", roomId)
      .order("sort_order", { ascending: true });
    return (data ?? []) as MuseumRoomItem[];
  } catch {
    return [];
  }
}

// 2026-09-12: EK's correction — the room editor (title/description + item
// curation) belongs directly on the Map, launched from each room's edit
// badge, not as a separate Admin Tools page (see the removed SPORTS-only
// section this replaces). `museum_room_meta` is an optional per-room
// override; a room with no row here just keeps its normal static label —
// this never touches the real museum scene's own destination signs
// (campusLayout.ts's static room.label), only the Map's own display.
export type MuseumRoomMeta = {
  room_id: string;
  title: string | null;
  description: string | null;
};

export async function getRoomMeta(roomId: string): Promise<MuseumRoomMeta | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("museum_room_meta")
      .select("room_id, title, description")
      .eq("room_id", roomId)
      .maybeSingle();
    return (data as MuseumRoomMeta | null) ?? null;
  } catch {
    return null;
  }
}

/** Every room's meta override in one query, keyed by room_id — used by the
 * Map to show a custom title where one's been set, without a round trip
 * per room. */
export async function getAllRoomMeta(): Promise<Record<string, MuseumRoomMeta>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  try {
    const { data } = await supabase.from("museum_room_meta").select("room_id, title, description");
    const byRoomId: Record<string, MuseumRoomMeta> = {};
    for (const row of (data ?? []) as MuseumRoomMeta[]) byRoomId[row.room_id] = row;
    return byRoomId;
  } catch {
    return {};
  }
}
