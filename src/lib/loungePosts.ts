"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { resolveAvatarSrc } from "@/lib/avatarResolve";

const TABLE = "lounge_posts";

export type LoungePostKind = "question" | "update";

export type LoungePost = {
  id: string;
  profileId: string;
  kind: LoungePostKind;
  body: string;
  createdAt: number;
  authorName: string;
  authorUsername: string;
  authorAvatarSrc: string | null;
};

function normalizeKind(value: unknown): LoungePostKind {
  return value === "question" ? "question" : "update";
}

function mapRow(row: Record<string, unknown>): LoungePost {
  const author = (row.profiles ?? {}) as Record<string, unknown>;
  const profileId = String(row.profile_id ?? "");
  const displayName = String(author.display_name || author.username || "Collector");
  return {
    id: String(row.id),
    profileId,
    kind: normalizeKind(row.kind),
    body: String(row.body ?? ""),
    createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : 0,
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

/** Most recent Lounge posts (Ask/Update), newest first. Real, persisted,
 *  visible to everyone — the backend for "Ask the Lounge" / "Post Update". */
export async function listLoungePosts(limit = 30): Promise<LoungePost[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, profile_id, kind, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}

export async function addLoungePost(
  profileId: string,
  kind: LoungePostKind,
  body: string
): Promise<LoungePost | null> {
  const trimmed = body.trim();
  if (!profileId || !trimmed) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ profile_id: profileId, kind, body: trimmed })
    .select("id, profile_id, kind, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .single();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Hides a post — allowed only for the post's own author (enforced
 *  server-side inside hide_lounge_post(), not just by this client check). */
export async function hideLoungePost(postId: string): Promise<boolean> {
  if (!postId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("hide_lounge_post", { p_post_id: postId });
  return !error;
}
