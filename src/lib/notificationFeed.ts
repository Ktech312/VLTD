"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { listRecentCommentsForExhibitions } from "@/lib/comments";

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

/* ── Unified alerts feed: follows + messages + bugs ──────────────── */

export type AlertKind = "follow" | "message" | "bug";

export type AlertItem = {
  id: string;
  kind: AlertKind;
  title: string;
  subtitle?: string;
  href?: string;
  createdAt: number;
};

/**
 * The combined Alerts feed:
 *  - follows  → new exhibitions from collectors you follow
 *  - message  → comments left on your exhibitions
 *  - bug      → bug reports (ALL of them, admin-only via /api/admin/bugs;
 *               a 403 for non-admins simply contributes nothing)
 * Each source is guarded, so one failing never breaks the others.
 */
export async function fetchAlerts(currentProfileId: string): Promise<AlertItem[]> {
  const out: AlertItem[] = [];
  const supabase = getSupabaseBrowserClient();

  // 1. Follows
  try {
    const feed = await fetchFollowingFeed(currentProfileId, 20);
    for (const f of feed) {
      out.push({
        id: `follow-${f.id}`,
        kind: "follow",
        title: f.type === "announced" ? "Updated exhibition" : "New exhibition",
        subtitle: [f.collectorName ? `by ${f.collectorName}` : "", f.galleryTitle]
          .filter(Boolean)
          .join(" · "),
        href: f.publicToken ? `/museum/share/${f.publicToken}` : `/museum/${f.galleryId}/guest`,
        createdAt: f.createdAt,
      });
    }
  } catch {
    /* ignore */
  }

  // 2. Messages — comments on your exhibitions
  try {
    if (supabase && currentProfileId) {
      const { data: gal } = await supabase
        .from("galleries")
        .select("id, title")
        .eq("profile_id", currentProfileId);
      const galleries = (gal ?? []) as { id: string; title: string | null }[];
      const ids = galleries.map((g) => g.id);
      if (ids.length > 0) {
        const titleById = new Map(galleries.map((g) => [g.id, g.title ?? "your exhibition"]));
        const comments = await listRecentCommentsForExhibitions(ids, 20);
        for (const c of comments) {
          const snippet = c.body.slice(0, 60) + (c.body.length > 60 ? "…" : "");
          out.push({
            id: `msg-${c.id}`,
            kind: "message",
            title: "New comment",
            subtitle: `“${snippet}” on ${titleById.get(c.exhibitionId) ?? "your exhibition"}`,
            href: `/museum/${c.exhibitionId}`,
            createdAt: c.createdAt,
          });
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Bugs — all reports (admins only; 403 for everyone else)
  try {
    const res = await fetch("/api/admin/bugs", { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as {
        rows?: { id: string; message: string; status: string; page_path: string | null; created_at: string }[];
      };
      for (const b of json.rows ?? []) {
        const snippet = (b.message ?? "").slice(0, 70) + ((b.message ?? "").length > 70 ? "…" : "");
        out.push({
          id: `bug-${b.id}`,
          kind: "bug",
          title: b.status && b.status !== "open" ? `Bug · ${b.status}` : "Bug report",
          subtitle: [snippet, b.page_path ? `— ${b.page_path}` : ""].filter(Boolean).join(" "),
          href: "/admin/bugs",
          createdAt: new Date(b.created_at).getTime(),
        });
      }
    }
  } catch {
    /* ignore */
  }

  // 4. Your own bug reports — a reply or resolution from the admin. Every
  // reporter is a signed-in user, so this reads their own rows directly
  // (RLS: "read own bug_reports", user_id = auth.uid()) — works for anyone,
  // not just admins.
  try {
    if (supabase) {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (uid) {
        const { data: mine } = await supabase
          .from("bug_reports")
          .select("id, message, status, admin_reply, admin_replied_at, updated_at, created_at")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false })
          .limit(20);
        for (const b of (mine ?? []) as {
          id: string; message: string; status: string; admin_reply: string | null;
          admin_replied_at: string | null; updated_at: string | null; created_at: string;
        }[]) {
          if (b.status !== "resolved" && !b.admin_reply) continue; // nothing to tell them yet
          const snippet = (b.admin_reply ?? b.message ?? "").slice(0, 70) + ((b.admin_reply ?? b.message ?? "").length > 70 ? "…" : "");
          out.push({
            id: `mybug-${b.id}`,
            kind: "bug",
            title: b.admin_reply ? "Reply to your bug report" : "Your bug report was resolved",
            subtitle: snippet,
            createdAt: new Date(b.admin_replied_at || b.updated_at || b.created_at).getTime(),
          });
        }
      }
    }
  } catch {
    /* ignore */
  }

  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
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
