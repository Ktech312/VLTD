"use client";

// Real cloud-saved 3D Room Builder rooms ("Halls" in the UI) — EK's ask
// 2026-08-24: the builder's old "Save Room Draft" only ever wrote to one
// fixed slot in the browser's own local storage — no name, overwritten by
// any save regardless of what you were working on, invisible on any other
// device. See 20260824_virtual_rooms.sql for the table/RLS/storage bucket
// this reads and writes, and VirtualGalleryRoom.tsx's save flow for how a
// Hall gets named/linked to an Exhibition on its first save.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";

export type VirtualRoomRow = {
  id: string;
  profileId: string;
  galleryId: string | null;
  title: string;
  roomStyle: string;
  roomLayout: string;
  viewMode: string;
  showValues: boolean;
  selectedIds: string[];
  wallpaperUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const HALL_COLUMNS =
  "id, profile_id, gallery_id, title, room_style, room_layout, view_mode, show_values, selected_ids, wallpaper_url, created_at, updated_at";

function rowToHall(row: Record<string, unknown>): VirtualRoomRow {
  return {
    id: String(row.id),
    profileId: String(row.profile_id ?? ""),
    galleryId: row.gallery_id ? String(row.gallery_id) : null,
    title: String(row.title ?? "Untitled Hall"),
    roomStyle: String(row.room_style ?? "vault"),
    roomLayout: String(row.room_layout ?? "storefront"),
    viewMode: String(row.view_mode ?? "room"),
    showValues: !!row.show_values,
    selectedIds: Array.isArray(row.selected_ids) ? (row.selected_ids as string[]) : [],
    wallpaperUrl: row.wallpaper_url ? String(row.wallpaper_url) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/** Every Hall the active profile owns (or is a team member of), newest first. */
export async function listMyHalls(): Promise<VirtualRoomRow[]> {
  const profileId = getStoredActiveProfileId();
  if (!profileId) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("virtual_rooms")
    .select(HALL_COLUMNS)
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => rowToHall(row as Record<string, unknown>));
}

export type HallSaveInput = {
  galleryId: string | null;
  roomStyle: string;
  roomLayout: string;
  viewMode: string;
  showValues: boolean;
  selectedIds: string[];
  wallpaperUrl: string | null;
};

/** Creates a brand-new named Hall, returns the full saved row (or null on failure). */
export async function createHall(title: string, input: HallSaveInput): Promise<VirtualRoomRow | null> {
  const profileId = getStoredActiveProfileId();
  if (!profileId) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("virtual_rooms")
    .insert({
      profile_id: profileId,
      gallery_id: input.galleryId,
      title,
      room_style: input.roomStyle,
      room_layout: input.roomLayout,
      view_mode: input.viewMode,
      show_values: input.showValues,
      selected_ids: input.selectedIds,
      wallpaper_url: input.wallpaperUrl,
    })
    .select(HALL_COLUMNS)
    .single();

  if (error || !data) return null;
  return rowToHall(data as Record<string, unknown>);
}

/** Quietly updates an already-saved Hall in place — never touches its title. */
export async function updateHall(id: string, input: HallSaveInput): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("virtual_rooms")
    .update({
      gallery_id: input.galleryId,
      room_style: input.roomStyle,
      room_layout: input.roomLayout,
      view_mode: input.viewMode,
      show_values: input.showValues,
      selected_ids: input.selectedIds,
      wallpaper_url: input.wallpaperUrl,
    })
    .eq("id", id);

  return !error;
}

// Wallpapers are held in component state as a `data:` URL (see
// fileToRoomWallpaper in VirtualGalleryRoom.tsx — a resized, re-encoded
// JPEG, not the original file). Storing that whole blob inline in the
// virtual_rooms row would bloat every load of the room; every other image
// in this app (vault items, avatars, documents) already goes through real
// Storage instead, so a Hall's wallpaper does too. Only called when the
// current wallpaper is still a fresh `data:` URL — an already-uploaded
// wallpaper (loaded back from a saved Hall) is already a real URL and
// skips this entirely.
export async function uploadHallWallpaper(dataUrl: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid) return null;

  let blob: Blob;
  try {
    blob = await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }

  // Folder is auth.uid(), matching every other storage bucket's own
  // convention in this app — see 20260824_virtual_rooms.sql.
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from("room-wallpapers").upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) return null;

  const { data } = supabase.storage.from("room-wallpapers").getPublicUrl(path);
  return data.publicUrl;
}
