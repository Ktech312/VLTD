import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type WishlistItem = {
  id: string;
  title: string;
  targetPrice?: number;
  notes?: string;
  createdAt: number;
  universe?: string;
  category?: string;
  subject?: string;
  condition?: "any" | "raw" | "graded" | "nm" | "ex";
  priority?: "low" | "medium" | "high";
};

const LS_BASE = "vltd_wishlist";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function lsKey(): string {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

export function loadWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LS_BASE) {
      const legacy = localStorage.getItem(LS_BASE);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWishlist(items: WishlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(lsKey(), JSON.stringify(items));
}

// ── Supabase sync (best-effort; local cache always works) ───────────
function wishRow(item: WishlistItem, pid: string) {
  return {
    id: item.id,
    profile_id: pid,
    title: item.title,
    target_price: item.targetPrice ?? null,
    notes: item.notes ?? null,
    universe: item.universe ?? null,
    category: item.category ?? null,
    subject: item.subject ?? null,
    condition: item.condition ?? null,
    priority: item.priority ?? null,
    created_at: new Date(item.createdAt || Date.now()).toISOString(),
  };
}

async function pushWish(item: WishlistItem) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("wishlist").upsert(wishRow(item, pid), { onConflict: "id" });
  } catch {
    /* table may not exist yet — local still holds it */
  }
}

async function deleteWishRow(id: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("wishlist").delete().eq("id", id).eq("profile_id", pid);
  } catch {
    /* ignore */
  }
}

export async function syncWishlistFromSupabase(): Promise<WishlistItem[]> {
  if (typeof window === "undefined") return [];
  const local = loadWishlist();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const { data, error } = await supabase
      .from("wishlist")
      .select("id,title,target_price,notes,universe,category,subject,condition,priority,created_at")
      .eq("profile_id", pid);
    if (error || !data) return local;
    if (data.length === 0) {
      for (const w of local) void pushWish(w);
      return local;
    }
    const items: WishlistItem[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      targetPrice: r.target_price != null ? Number(r.target_price) : undefined,
      notes: (r.notes as string) ?? undefined,
      universe: (r.universe as string) ?? undefined,
      category: (r.category as string) ?? undefined,
      subject: (r.subject as string) ?? undefined,
      condition: (r.condition as WishlistItem["condition"]) ?? undefined,
      priority: (r.priority as WishlistItem["priority"]) ?? undefined,
      createdAt: Date.parse(String(r.created_at)) || Date.now(),
    }));
    items.sort((a, b) => b.createdAt - a.createdAt);
    saveWishlist(items);
    return items;
  } catch {
    return local;
  }
}

export function addWishlistItem(
  fields: Pick<
    WishlistItem,
    "title" | "targetPrice" | "notes" | "universe" | "category" | "subject" | "condition" | "priority"
  >
): WishlistItem {
  const item: WishlistItem = {
    id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...fields,
  };
  const next = [item, ...loadWishlist()];
  saveWishlist(next);
  void pushWish(item);
  return item;
}

export function removeWishlistItem(id: string) {
  const next = loadWishlist().filter((i) => i.id !== id);
  saveWishlist(next);
  void deleteWishRow(id);
  return next;
}
