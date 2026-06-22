"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "follows";

/** Number of people following this profile. */
export async function getFollowerCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
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
    .select("*", { count: "exact", head: true })
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
