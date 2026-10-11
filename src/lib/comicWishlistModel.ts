"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";

/** Where a saved upcoming issue stands for this Curator. */
export type ComicStatus = "want" | "preordered" | "own";

export const COMIC_STATUS_LABEL: Record<ComicStatus, string> = {
  want: "Want",
  preordered: "Pre-ordered",
  own: "Own",
};

export type ComicWishlistItem = {
  id: string;
  metronId: number;
  series: string;
  number: string;
  publisher: string | null;
  storeDate: string | null;
  imageUrl: string | null;
  addedAt: string;
  status: ComicStatus;
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
  status?: string | null;
};

function toStatus(value: unknown): ComicStatus {
  return value === "preordered" || value === "own" ? value : "want";
}

// Rows saved before 20261011_comic_wishlist_status.sql has no `status` column.
function isMissingStatusColumn(message: string | undefined) {
  return !!message && /status/i.test(message);
}

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
    status: toStatus(row.status),
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

/** metron_id -> status for every saved issue. Fast for UI checks. */
export async function loadComicStatuses(): Promise<Map<number, ComicStatus>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return new Map();
  const withStatus = await supabase.from("comic_wishlist").select("metron_id,status");
  if (!withStatus.error && withStatus.data) {
    return new Map(
      (withStatus.data as { metron_id: number; status: string | null }[]).map((r) => [r.metron_id, toStatus(r.status)])
    );
  }
  if (!isMissingStatusColumn(withStatus.error?.message)) return new Map();
  // Column not added yet: every saved row is a "want".
  const ids = await supabase.from("comic_wishlist").select("metron_id");
  if (ids.error || !ids.data) return new Map();
  return new Map((ids.data as { metron_id: number }[]).map((r) => [r.metron_id, "want" as const]));
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

/**
 * Set an upcoming issue's status, or clear it (null removes the saved row).
 * Safe to call repeatedly (upsert). `needsSql` = the status column isn't there
 * yet, so only "Want" can be saved until the migration is run.
 */
export async function setComicStatus(
  issue: UpcomingIssue,
  status: ComicStatus | null
): Promise<{ ok: boolean; error?: string; needsSql?: boolean }> {
  if (status === null) return removeFromComicWishlist(issue.id);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Not signed in." };
  const row = {
    metron_id: issue.id,
    series: issue.series,
    number: issue.number,
    publisher: issue.publisher ?? null,
    store_date: issue.storeDate ?? null,
    image_url: issue.imageUrl ?? null,
  };
  const { error } = await supabase
    .from("comic_wishlist")
    .upsert({ ...row, status }, { onConflict: "user_id,metron_id" });
  if (!error) return { ok: true };
  if (!isMissingStatusColumn(error.message)) return { ok: false, error: error.message };
  if (status !== "want") return { ok: false, needsSql: true, error: error.message };
  const retry = await supabase.from("comic_wishlist").upsert(row, { onConflict: "user_id,metron_id" });
  return retry.error ? { ok: false, error: retry.error.message } : { ok: true };
}
