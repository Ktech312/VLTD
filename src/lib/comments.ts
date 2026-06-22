"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "comments";

export type Comment = {
  id: string;
  exhibitionId: string;
  authorId: string;
  body: string;
  createdAt: number;
};

export async function listComments(exhibitionId: string): Promise<Comment[]> {
  if (!exhibitionId) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from(TABLE)
    .select("id, exhibition_id, author_id, body, created_at")
    .eq("exhibition_id", exhibitionId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      exhibitionId: String(r.exhibition_id),
      authorId: String(r.author_id),
      body: String(r.body ?? ""),
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : 0,
    };
  });
}

export async function addComment(
  exhibitionId: string,
  authorId: string,
  body: string
): Promise<Comment | null> {
  const trimmed = body.trim();
  if (!exhibitionId || !authorId || !trimmed) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ exhibition_id: exhibitionId, author_id: authorId, body: trimmed })
    .select("id, exhibition_id, author_id, body, created_at")
    .single();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    exhibitionId: String(r.exhibition_id),
    authorId: String(r.author_id),
    body: String(r.body ?? ""),
    createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
  };
}

/**
 * Hides a comment - allowed if the caller is the comment's author OR the
 * owner of the exhibition it was posted on. Authorization is enforced
 * server-side inside the hide_comment() RPC, not just by this check.
 */
export async function hideComment(commentId: string): Promise<boolean> {
  if (!commentId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("hide_comment", { p_comment_id: commentId });
  return !error;
}
