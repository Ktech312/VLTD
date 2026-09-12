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
  // Shared Museum Room Editor pass (2026-09-12): which generated placement
  // slot (campusRoomBuilder.ts's computeRoomPlacementSlots) this item is
  // pinned to. Undefined/null for any row saved before that migration ran,
  // or if the migration hasn't run at all yet — those items keep displaying
  // via the existing automatic proportional layout (selectRoomItems below
  // falls back to a plain select without this column if it 404s).
  slot_id?: string | null;
};

// Fails-soft column gate (2026-09-12): tries the extended select (with
// slot_id) first; if that column doesn't exist yet (this migration hasn't
// been run), retries the ORIGINAL select so the already-live SPORTS display
// never breaks because of a column this app added but EK hasn't migrated
// yet. Same "assume nothing has run" rule as every other fetch in this file.
async function selectRoomItems(roomId: string, onlyEnabled: boolean): Promise<MuseumRoomItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    let query = supabase
      .from("museum_room_items")
      .select("id, room_id, title, image_url, enabled, sort_order, slot_id")
      .eq("room_id", roomId);
    if (onlyEnabled) query = query.eq("enabled", true);
    const { data, error } = await query.order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as MuseumRoomItem[];
  } catch {
    try {
      let query = supabase
        .from("museum_room_items")
        .select("id, room_id, title, image_url, enabled, sort_order")
        .eq("room_id", roomId);
      if (onlyEnabled) query = query.eq("enabled", true);
      const { data } = await query.order("sort_order", { ascending: true });
      return (data ?? []) as MuseumRoomItem[];
    } catch {
      return [];
    }
  }
}

export async function getEnabledRoomItems(roomId: string): Promise<MuseumRoomItem[]> {
  return selectRoomItems(roomId, true);
}

/** Every item for a room, enabled or not — the room editor needs to show
 * and toggle disabled items too, unlike the museum's own display (above),
 * which only ever renders enabled ones. */
export async function getAllRoomItems(roomId: string): Promise<MuseumRoomItem[]> {
  return selectRoomItems(roomId, false);
}

/** Places (or moves) a real vault item into one explicit placement slot —
 * the room editor's "+"/drop action. Upserts on (room_id, slot_id) so
 * re-picking an occupied slot replaces it rather than creating a duplicate
 * row; if the migration's unique index isn't in place yet, falls back to a
 * plain insert (never crashes the editor, just isn't perfectly idempotent
 * until EK runs the migration). Never touches the source vault item itself
 * — this only ever writes a curated copy row, same as the existing item
 * form did. */
export async function setRoomItemSlot(
  roomId: string,
  slotId: string,
  item: { title: string; image_url: string },
  sortOrder: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const payload = {
    room_id: roomId,
    slot_id: slotId,
    title: item.title,
    image_url: item.image_url,
    enabled: true,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("museum_room_items").upsert(payload, { onConflict: "room_id,slot_id" });
  if (!error) return { ok: true };
  // onConflict target doesn't exist yet (migration not run) — degrade to a
  // plain insert rather than fail the save outright.
  const { error: insertError } = await supabase.from("museum_room_items").insert(payload);
  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true };
}

/** Removes whatever item currently occupies a slot — "from the museum room
 * only," per the work order: this only ever deletes the curated copy row in
 * museum_room_items, never anything in the admin's own vault. */
export async function clearRoomItemSlot(roomId: string, slotId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("museum_room_items").delete().eq("room_id", roomId).eq("slot_id", slotId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
  // Shared Museum Room Editor pass (2026-09-12): an optional per-room
  // background/wall-finish choice (see ROOM_BACKGROUNDS in
  // campusRoomBuilder.ts). Undefined/null — no override, no migration yet,
  // or no choice saved — always means "keep the room's current default
  // finish," never a broken/blank wall.
  background_id?: string | null;
  // Museum Builder pass (2026-09-12): per-room overrides for EK's "a slider
  // to set how many items this room shows" ask — wall/shelf/case item
  // capacity, independent of the global museum_campus_config default
  // (getItemsPerRoom() above). Undefined/null for any of these — no
  // override, no migration yet — always falls back to the existing global
  // default (wall) or 0/disabled (shelf/case), never breaks a room that
  // hasn't been touched by Museum Builder yet. See
  // 20260912_museum_room_capacity_and_background.sql.
  item_capacity?: number | null;
  shelf_capacity?: number | null;
  case_capacity?: number | null;
  // A custom uploaded wallpaper image for this room, sharing the exact same
  // Supabase Storage bucket ("room-wallpapers") and upload path the Gallery
  // Builder's own personal-Hall Wallpaper feature already uses (see
  // virtualRooms.ts's uploadHallWallpaper, reused as-is by Museum Builder —
  // not a second, museum-only upload path) — EK's ask that "if I add a new
  // background to one, the other should also be able to access it."
  // Undefined/null means "use background_id (or the room's default finish)
  // instead," same safe-default rule as background_id itself.
  background_image_url?: string | null;
};

// Fails-soft column cascade (extended 2026-09-12, Museum Builder pass): try
// every column this file knows about, then retry with progressively fewer
// columns on a Postgrest "column does not exist" error, down to the
// original bare (room_id, title, description) select — so this never
// breaks regardless of which of the columns below EK has actually migrated
// yet, in any order.
const ROOM_META_COLUMNS_FULL =
  "room_id, title, description, background_id, item_capacity, shelf_capacity, case_capacity, background_image_url";
const ROOM_META_COLUMNS_WITH_BACKGROUND = "room_id, title, description, background_id";
const ROOM_META_COLUMNS_BASE = "room_id, title, description";

async function selectRoomMeta(roomId: string): Promise<MuseumRoomMeta | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  for (const columns of [ROOM_META_COLUMNS_FULL, ROOM_META_COLUMNS_WITH_BACKGROUND, ROOM_META_COLUMNS_BASE]) {
    try {
      const { data, error } = await supabase
        .from("museum_room_meta")
        .select(columns)
        .eq("room_id", roomId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MuseumRoomMeta | null) ?? null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function getRoomMeta(roomId: string): Promise<MuseumRoomMeta | null> {
  return selectRoomMeta(roomId);
}

/** Every room's meta override in one query, keyed by room_id — used by the
 * Map to show a custom title where one's been set, without a round trip
 * per room. */
export async function getAllRoomMeta(): Promise<Record<string, MuseumRoomMeta>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  async function fetchAll(columns: string) {
    const { data, error } = await supabase!.from("museum_room_meta").select(columns);
    if (error) throw error;
    return (data ?? []) as unknown as MuseumRoomMeta[];
  }
  for (const columns of [ROOM_META_COLUMNS_FULL, ROOM_META_COLUMNS_WITH_BACKGROUND, ROOM_META_COLUMNS_BASE]) {
    try {
      const rows = await fetchAll(columns);
      const byRoomId: Record<string, MuseumRoomMeta> = {};
      for (const row of rows) byRoomId[row.room_id] = row;
      return byRoomId;
    } catch {
      continue;
    }
  }
  return {};
}

/** Saves a room's per-kind item-capacity overrides (Museum Builder's
 * capacity sliders) independently of its title/background — same one-row-
 * upserted-by-room_id shape every other per-room setting in this file
 * already uses. Pass `null` for any field to clear that override back to
 * its fallback (the global default for wall capacity, disabled for
 * shelf/case). */
export async function setRoomCapacities(
  roomId: string,
  capacities: { item_capacity?: number | null; shelf_capacity?: number | null; case_capacity?: number | null }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("museum_room_meta")
    .upsert({ room_id: roomId, ...capacities, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Saves a room's custom uploaded wallpaper image URL (or `null` to clear
 * it back to the preset background_id/default finish). The image itself is
 * uploaded via virtualRooms.ts's own uploadHallWallpaper() — the exact same
 * function and Storage bucket the Gallery Builder's personal-Hall Wallpaper
 * feature already uses — this only ever persists the resulting public URL. */
export async function setRoomBackgroundImage(roomId: string, imageUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("museum_room_meta")
    .upsert({ room_id: roomId, background_image_url: imageUrl, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Saves a room's background choice independently of its title/description
 * — changing SPORTS's background must never touch COLLECTION/CARDS/HUB/etc,
 * satisfied here the same way title already is: one upserted row keyed by
 * room_id. Pass `null` to reset to the room's default finish. */
export async function setRoomBackground(roomId: string, backgroundId: string | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("museum_room_meta")
    .upsert({ room_id: roomId, background_id: backgroundId, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
