"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "follows";

/** Number of people following this profile. */
export async function getFollowerCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  // Overnight QA pass (2026-09-22): this exact query (HEAD + count:"exact" +
  // select("*")) was reproducibly returning 503 on the live site - confirmed
  // via 3 separate page loads, all failing the same way, while the sibling
  // GET query (different select/filter shape) succeeded every time. Schema
  // itself is fine (both follower_id and followed_id are indexed, RLS is a
  // plain public-read policy) - narrowing the select from "*" to "id" (a
  // real column, doesn't change what's counted) is the standard fix for
  // this class of PostgREST HEAD-count quirk. count ?? 0 already meant this
  // failure was silent (wrong "0 followers" instead of a visible error),
  // which is why it went unnoticed until checked directly.
  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("followed_id", profileId);
  return count ?? 0;
}

/** Number of people this profile follows. */
export async function getFollowingCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("follower_id", profileId);
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
