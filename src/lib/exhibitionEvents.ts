"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "exhibition_events";

export type ExhibitionEventType = "published" | "announced";

export type ExhibitionEvent = {
  id: string;
  galleryId: string;
  profileId: string;
  type: ExhibitionEventType;
  metadata: Record<string, unknown>;
  createdAt: number;
};

function rowToEvent(row: Record<string, unknown>): ExhibitionEvent {
  return {
    id: String(row.id),
    galleryId: String(row.gallery_id),
    profileId: String(row.profile_id),
    type: (row.type as ExhibitionEventType) ?? "published",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at
      ? new Date(String(row.created_at)).getTime()
      : Date.now(),
  };
}

/**
 * Called automatically inside saveDraft() when an exhibition's visibility
 * transitions from any non-PUBLIC value to PUBLIC. Fires each time the
 * owner re-publishes (e.g. toggled private → public again) rather than
 * only on the true first publish - that's fine since it maps to real intent.
 */
export async function logExhibitionPublished(
  galleryId: string,
  profileId: string,
  title: string
): Promise<boolean> {
  if (!galleryId || !profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).insert({
    gallery_id: galleryId,
    profile_id: profileId,
    type: "published",
    metadata: { title },
  });
  return !error;
}

/**
 * Owner-triggered "let followers know I added items" announcement.
 * Intentionally manual - nothing fires automatically when items are added.
 */
export async function logExhibitionAnnouncement(
  galleryId: string,
  profileId: string,
  title: string,
  itemCount: number
): Promise<boolean> {
  if (!galleryId || !profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).insert({
    gallery_id: galleryId,
    profile_id: profileId,
    type: "announced",
    metadata: { title, itemCount },
  });
  return !error;
}

/** Fetch recent events for the given gallery IDs (owner's activity view). */
export async function listExhibitionEventsForGalleries(
  galleryIds: string[],
  limit = 12
): Promise<ExhibitionEvent[]> {
  if (galleryIds.length === 0) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from(TABLE)
    .select("id, gallery_id, profile_id, type, metadata, created_at")
    .in("gallery_id", galleryIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToEvent(r as Record<string, unknown>));
}
