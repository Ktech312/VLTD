"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type FeedNotification = {
  id: string;
  type: "published" | "announced";
  galleryId: string;
  profileId: string;
  galleryTitle: string;
  itemCount?: number;
  collectorName?: string;
  publicToken?: string;
  createdAt: number;
};

type EventRow = {
  id: string;
  type: string;
  gallery_id: string;
  profile_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileRow = {
  profile_id: string;
  display_name: string | null;
};

type GalleryRow = {
  id: string;
  public_token: string | null;
};

const PLACEHOLDERS = new Set(["collector", "user", "vltd user", "vltd collector", ""]);

function cleanName(raw: string | null): string {
  const v = (raw ?? "").trim();
  return PLACEHOLDERS.has(v.toLowerCase()) ? "" : v;
}

/**
 * Fetch recent exhibition events from profiles the current user follows.
 * Uses exhibition_events + follows tables — no separate notifications table needed.
 */
export async function fetchFollowingFeed(
  currentProfileId: string,
  limit = 20
): Promise<FeedNotification[]> {
  if (!currentProfileId) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  // 1. Get list of followed profile IDs
  const { data: followRows } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", currentProfileId)
    .limit(100);

  const followedIds = (followRows ?? []).map((r: { followed_id: string }) => r.followed_id);
  if (followedIds.length === 0) return [];

  // 2. Fetch recent exhibition events from those profiles
  const { data: eventRows } = await supabase
    .from("exhibition_events")
    .select("id, type, gallery_id, profile_id, metadata, created_at")
    .in("profile_id", followedIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  const events: EventRow[] = (eventRows ?? []) as EventRow[];
  if (events.length === 0) return [];

  // 3. Enrich with profile names (batch)
  const uniqueProfileIds = [...new Set(events.map(e => e.profile_id))];
  const { data: profileRows } = await supabase
    .from("public_profiles")
    .select("profile_id, display_name")
    .in("profile_id", uniqueProfileIds);

  const profileMap = new Map<string, string>(
    ((profileRows ?? []) as ProfileRow[]).map(p => [p.profile_id, cleanName(p.display_name)])
  );

  // 4. Enrich with gallery public tokens (batch)
  const uniqueGalleryIds = [...new Set(events.map(e => e.gallery_id))];
  const { data: galleryRows } = await supabase
    .from("galleries")
    .select("id, public_token")
    .in("id", uniqueGalleryIds);

  const galleryMap = new Map<string, string | null>(
    ((galleryRows ?? []) as GalleryRow[]).map(g => [g.id, g.public_token])
  );

  return events.map(e => ({
    id: e.id,
    type: (e.type === "announced" ? "announced" : "published") as FeedNotification["type"],
    galleryId: e.gallery_id,
    profileId: e.profile_id,
    galleryTitle: String(e.metadata?.title ?? "Exhibition"),
    itemCount: typeof e.metadata?.itemCount === "number" ? e.metadata.itemCount : undefined,
    collectorName: profileMap.get(e.profile_id) || undefined,
    publicToken: galleryMap.get(e.gallery_id) ?? undefined,
    createdAt: new Date(e.created_at).getTime(),
  }));
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
