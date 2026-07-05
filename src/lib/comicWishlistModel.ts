"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";

export type ComicWishlistItem = {
  id: string;
  metronId: number;
  series: string;
  number: string;
  publisher: string | null;
  storeDate: string | null;
  imageUrl: string | null;
  addedAt: string;
};

type DbRow = {
  id: string;
  metron_id: number;
  series: string;
  number: string;
  publisher: string | null;
  store_date: string | null;
  image_url: string | null;
  added_at: string;
};

function rowToItem(row: DbRow): ComicWishlistItem {
  return {
    id: row.id,
    metronId: row.metron_id,
    series: row.series,
    number: row.number,
    publisher: row.publisher,
    storeDate: row.store_date,
    imageUrl: row.image_url,
    addedAt: row.added_at,
  };
}

/** Load all wishlist items for the signed-in user, newest first. */
export async function loadComicWishlist(): Promise<ComicWishlistItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comic_wishlist")
    .select("*")
    .order("added_at", { ascending: false });
  if (error || !data) return [];
  return (data as DbRow[]).map(rowToItem);
}

/** Returns the set of metron_ids the user has wishlisted. Fast for UI checks. */
export async function loadWishlistedIds(): Promise<Set<number>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("comic_wishlist")
    .select("metron_id");
  if (error || !data) return new Set();
  return new Set((data as { metron_id: number }[]).map((r) => r.metron_id));
}

/** Add an upcoming issue to the wishlist. Safe to call if already added (upsert). */
export async function addToComicWishlist(
  issue: UpcomingIssue
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("comic_wishlist").upsert(
    {
      metron_id: issue.id,
      series: issue.series,
      number: issue.number,
      publisher: issue.publisher ?? null,
      store_date: issue.storeDate ?? null,
      image_url: issue.imageUrl ?? null,
    },
    { onConflict: "user_id,metron_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove an issue from the wishlist by its Metron ID. */
export async function removeFromComicWishlist(
  metronId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("comic_wishlist")
    .delete()
    .eq("metron_id", metronId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Toggle: add if absent, remove if present. Returns new wishlisted state. */
export async function toggleComicWishlist(
  issue: UpcomingIssue,
  currentlyWishlisted: boolean
): Promise<{ ok: boolean; nowWishlisted: boolean }> {
  if (currentlyWishlisted) {
    const { ok } = await removeFromComicWishlist(issue.id);
    return { ok, nowWishlisted: false };
  } else {
    const { ok } = await addToComicWishlist(issue);
    return { ok, nowWishlisted: true };
  }
}
