"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { resolveAvatarSrc } from "@/lib/avatarResolve";

const TABLE = "lounge_posts";

export type LoungePostKind = "question" | "update";
export type LoungeCategory = "discussion" | "question" | "showcase" | "news" | "help";
export type LoungeSort = "hot" | "new" | "top";

export type LoungePost = {
  id: string;
  profileId: string;
  kind: LoungePostKind;
  title: string;
  category: LoungeCategory;
  body: string;
  createdAt: number;
  score: number;
  commentCount: number;
  viewerVote: -1 | 0 | 1;
  authorName: string;
  authorUsername: string;
  authorAvatarSrc: string | null;
};

export type LoungeComment = {
  id: string;
  postId: string;
  profileId: string;
  parentId: string | null;
  body: string;
  createdAt: number;
  authorName: string;
  authorUsername: string;
  authorAvatarSrc: string | null;
};

function normalizeKind(value: unknown): LoungePostKind {
  return value === "question" ? "question" : "update";
}

function normalizeCategory(value: unknown, kind?: LoungePostKind): LoungeCategory {
  if (value === "question" || value === "showcase" || value === "news" || value === "help") return value;
  return kind === "question" ? "question" : "discussion";
}

function authorFromRow(row: Record<string, unknown>, profileKey = "profile_id") {
  const author = (row.profiles ?? {}) as Record<string, unknown>;
  const profileId = String(row[profileKey] ?? "");
  const displayName = String(author.display_name || author.username || "Collector");
  return {
    profileId,
    authorName: displayName,
    authorUsername: String(author.username ?? ""),
    authorAvatarSrc: resolveAvatarSrc({
      avatarUrl: (author.avatar_url as string) ?? null,
      avatarEmoji: (author.avatar_emoji as string) ?? null,
      profileId,
      displayName,
    }),
  };
}

function fallbackTitle(body: string) {
  const firstLine = body.split(/\r?\n/)[0]?.trim() || "Lounge discussion";
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine;
}

function mapPost(row: Record<string, unknown>, viewerVote: -1 | 0 | 1 = 0): LoungePost {
  const kind = normalizeKind(row.kind);
  const body = String(row.body ?? "");
  return {
    id: String(row.id),
    ...authorFromRow(row),
    kind,
    title: String(row.title || fallbackTitle(body)),
    category: normalizeCategory(row.category, kind),
    body,
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
    score: Number(row.score ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    viewerVote,
  };
}

function mapComment(row: Record<string, unknown>): LoungeComment {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    ...authorFromRow(row),
    parentId: row.parent_id ? String(row.parent_id) : null,
    body: String(row.body ?? ""),
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
  };
}

/** Real Lounge threads, visible to everyone. Existing pre-thread posts remain
 * readable through the fallback query until the launch migration is applied. */
export async function listLoungePosts(viewerProfileId = "", limit = 50): Promise<LoungePost[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const rich = await supabase
    .from(TABLE)
    .select("id, profile_id, kind, title, category, body, created_at, score, comment_count, profiles!lounge_posts_profile_id_fkey(display_name, username, avatar_url, avatar_emoji)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rich.error && Array.isArray(rich.data)) {
    const voteByPost = new Map<string, -1 | 1>();
    const postIds = rich.data.map((row) => String(row.id));
    if (viewerProfileId && postIds.length > 0) {
      const { data: ownVotes } = await supabase
        .from("lounge_post_votes")
        .select("post_id, value")
        .eq("profile_id", viewerProfileId)
        .in("post_id", postIds);
      (ownVotes ?? []).forEach((vote) => {
        const value = Number(vote.value);
        if (value === 1 || value === -1) voteByPost.set(String(vote.post_id), value);
      });
    }
    return rich.data.map((row) => mapPost(row as Record<string, unknown>, voteByPost.get(String(row.id)) ?? 0));
  }

  const legacy = await supabase
    .from(TABLE)
    .select("id, profile_id, kind, body, created_at, profiles!lounge_posts_profile_id_fkey(display_name, username, avatar_url, avatar_emoji)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (legacy.error || !Array.isArray(legacy.data)) return [];
  return legacy.data.map((row) => mapPost(row as Record<string, unknown>));
}

export async function addLoungePost(
  profileId: string,
  kind: LoungePostKind,
  title: string,
  body: string,
  category: LoungeCategory,
): Promise<LoungePost | null> {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!profileId || !trimmedTitle || !trimmedBody) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ profile_id: profileId, kind, title: trimmedTitle, body: trimmedBody, category })
    .select("id, profile_id, kind, title, category, body, created_at, score, comment_count, profiles!lounge_posts_profile_id_fkey(display_name, username, avatar_url, avatar_emoji)")
    .single();

  if (error || !data) {
    console.error("addLoungePost failed", error);
    return null;
  }
  return mapPost(data as Record<string, unknown>);
}

export async function setLoungeVote(postId: string, profileId: string, value: -1 | 0 | 1): Promise<boolean> {
  if (!postId || !profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  if (value === 0) {
    const { error } = await supabase.from("lounge_post_votes").delete().eq("post_id", postId).eq("profile_id", profileId);
    return !error;
  }

  const { error } = await supabase
    .from("lounge_post_votes")
    .upsert({ post_id: postId, profile_id: profileId, value, updated_at: new Date().toISOString() }, { onConflict: "post_id,profile_id" });
  return !error;
}

export async function listLoungeComments(postId: string): Promise<LoungeComment[]> {
  if (!postId) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("lounge_post_comments")
    .select("id, post_id, profile_id, parent_id, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapComment(row as Record<string, unknown>));
}

export async function addLoungeComment(postId: string, profileId: string, body: string, parentId: string | null = null): Promise<LoungeComment | null> {
  const trimmed = body.trim();
  if (!postId || !profileId || !trimmed) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lounge_post_comments")
    .insert({ post_id: postId, profile_id: profileId, parent_id: parentId, body: trimmed })
    .select("id, post_id, profile_id, parent_id, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .single();
  if (error || !data) {
    console.error("addLoungeComment failed", error);
    return null;
  }
  return mapComment(data as Record<string, unknown>);
}

export async function hideLoungeComment(commentId: string): Promise<boolean> {
  if (!commentId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("hide_lounge_comment", { p_comment_id: commentId });
  return !error;
}

/** Hides a post — author-only enforcement remains server-side. */
export async function hideLoungePost(postId: string): Promise<boolean> {
  if (!postId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("hide_lounge_post", { p_post_id: postId });
  return !error;
}
