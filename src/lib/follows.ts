"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "follows";

/** Number of people following this profile. */
export async function getFollowerCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  // Fix (2026-09-30): the previous HEAD+count:"exact" form was
  // reproducibly 503ing on the live site, confirmed live and repeatedly —
  // not by guessing at the query shape (an earlier attempt narrowed
  // select("*") to select("id"), which did NOT fix it, since the real
  // problem was never the selected column). Directly isolated the actual
  // cause: the *identical* query as a GET (no head:true) succeeds every
  // time, while the HEAD form fails 100% of the time in the live app
  // context specifically — confirmed via curl outside the browser (single,
  // sequential, concurrent, with browser-matching headers) never
  // reproducing it either, meaning it's specific to how the real app/
  // browser issues a HEAD request here, not the query itself. Switched to
  // a plain GET with count:"exact" and .limit(1) — PostgREST returns the
  // full exact count in Content-Range regardless of the row limit applied
  // to the body, so this returns the correct count while downloading at
  // most one row instead of the whole matching set. Errors are now
  // surfaced (logged), not silently swallowed by `count ?? 0` alone.
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact" })
    .eq("followed_id", profileId)
    .limit(1);
  if (error) {
    console.error("getFollowerCount failed:", error);
    return 0;
  }
  return count ?? 0;
}

/** Number of people this profile follows. */
export async function getFollowingCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact" })
    .eq("follower_id", profileId)
    .limit(1);
  if (error) {
    console.error("getFollowingCount failed:", error);
    return 0;
  }
  return count ?? 0;
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  if (!followerId || !followedId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from(TABLE)
    .select("id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  return Boolean(data);
}

export async function followProfile(followerId: string, followedId: string): Promise<boolean> {
  if (!followerId || !followedId || followerId === followedId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .insert({ follower_id: followerId, followed_id: followedId });
  // Unique constraint violation means already following - treat as success.
  return !error || error.code === "23505";
}

export async function unfollowProfile(followerId: string, followedId: string): Promise<boolean> {
  if (!followerId || !followedId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);
  return !error;
}
