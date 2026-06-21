"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TABLE = "appreciations";

/**
 * Appreciations ("Vibe") - a lightweight, reversible reaction on a public
 * item. One row per (item, profile) pair; toggling just inserts/deletes
 * that row rather than tracking a separate boolean, so the count is always
 * just `count(*) where item_id = ...`.
 */

export async function getAppreciationCount(itemId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("item_id", itemId);
  return count ?? 0;
}

/** Batch-loads counts for many items at once - for feed/grid rendering. */
export async function getAppreciationCounts(itemIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (itemIds.length === 0) return counts;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return counts;

  const { data } = await supabase.from(TABLE).select("item_id").in("item_id", itemIds);
  for (const row of data ?? []) {
    const id = String((row as Record<string, unknown>).item_id ?? "");
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function hasAppreciated(itemId: string, profileId: string): Promise<boolean> {
  if (!profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from(TABLE)
    .select("id")
    .eq("item_id", itemId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

/** Batch-loads which of the given items the profile has already appreciated. */
export async function getAppreciatedSet(itemIds: string[], profileId: string): Promise<Set<string>> {
  const set = new Set<string>();
  if (!profileId || itemIds.length === 0) return set;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return set;

  const { data } = await supabase
    .from(TABLE)
    .select("item_id")
    .eq("profile_id", profileId)
    .in("item_id", itemIds);
  for (const row of data ?? []) {
    set.add(String((row as Record<string, unknown>).item_id ?? ""));
  }
  return set;
}

export async function appreciateItem(itemId: string, profileId: string): Promise<boolean> {
  if (!profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .insert({ item_id: itemId, profile_id: profileId });
  // Unique constraint violation means it's already appreciated - treat as success.
  return !error || error.code === "23505";
}

export async function unappreciateItem(itemId: string, profileId: string): Promise<boolean> {
  if (!profileId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("item_id", itemId)
    .eq("profile_id", profileId);
  return !error;
}
