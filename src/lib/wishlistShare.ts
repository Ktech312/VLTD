"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";

// Public share link for the active profile's wishlist
// (20261011_wishlist_comics_and_sharing.sql: wishlist_shares + get_shared_wishlist).

export type SharedWish = {
  title: string;
  imageUrl?: string;
  universe?: string;
  category?: string;
  subject?: string;
  releaseDate?: string;
  status: "want" | "preordered";
  source?: string;
};

function randomToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

export function wishlistShareUrl(token: string) {
  return `${window.location.origin}/wishlist/${token}`;
}

/** Current share token for the active profile, or null if not shared. */
export async function loadWishlistShareToken(): Promise<{ token: string | null; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  const pid = getStoredActiveProfileId();
  if (!supabase || !pid) return { token: null, error: "Not signed in." };
  const { data, error } = await supabase.from("wishlist_shares").select("token").eq("profile_id", pid).maybeSingle();
  if (error) return { token: null, error: error.message };
  return { token: (data as { token?: string } | null)?.token ?? null };
}

/** Turn sharing on (reuses the existing link if there is one). */
export async function enableWishlistShare(): Promise<{ token: string | null; error?: string }> {
  const existing = await loadWishlistShareToken();
  if (existing.token || existing.error) return existing;
  const supabase = getSupabaseBrowserClient();
  const pid = getStoredActiveProfileId();
  if (!supabase || !pid) return { token: null, error: "Not signed in." };
  const token = randomToken();
  const { error } = await supabase.from("wishlist_shares").insert({ profile_id: pid, token });
  if (error) return { token: null, error: error.message };
  return { token };
}

/** Turn sharing off: the old link stops working. */
export async function disableWishlistShare(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  const pid = getStoredActiveProfileId();
  if (!supabase || !pid) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("wishlist_shares").delete().eq("profile_id", pid);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Read a shared wishlist by its link token (works signed out). */
export async function loadSharedWishlist(token: string): Promise<{ owner: string | null; items: SharedWish[]; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { owner: null, items: [], error: "Unavailable." };
  const [owner, rows] = await Promise.all([
    supabase.rpc("get_shared_wishlist_owner", { p_token: token }),
    supabase.rpc("get_shared_wishlist", { p_token: token }),
  ]);
  if (rows.error) return { owner: null, items: [], error: rows.error.message };
  const items = ((rows.data ?? []) as Record<string, unknown>[]).map((r) => ({
    title: String(r.title ?? ""),
    imageUrl: (r.image_url as string) ?? undefined,
    universe: (r.universe as string) ?? undefined,
    category: (r.category as string) ?? undefined,
    subject: (r.subject as string) ?? undefined,
    releaseDate: (r.release_date as string) ?? undefined,
    status: (r.status === "preordered" ? "preordered" : "want") as SharedWish["status"],
    source: (r.source as string) ?? undefined,
  }));
  return { owner: (owner.data as string | null) ?? null, items };
}
