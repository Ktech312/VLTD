import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

/**
 * The Curator's wishlist: one per profile, saved to the account (`wishlist`
 * table) with a local copy for instant loads. Holds hand-entered wants and
 * catalog picks (e.g. an upcoming comic marked Want / Pre-ordered), and can
 * be shared with a public link (see wishlistShare.ts).
 */
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
  /** Cover / stock image for catalog picks. */
  imageUrl?: string;
  /** "manual" (typed in) or a catalog, e.g. "metron" for comics. */
  source?: string;
  /** The catalog's own id for the item (Metron issue id). */
  externalId?: string;
  /** YYYY-MM-DD release date for upcoming catalog items. */
  releaseDate?: string;
  /** Want (default) or already pre-ordered. */
  status?: WishStatus;
};

export type WishStatus = "want" | "preordered";

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
      if (legacy && mayAdoptLegacyKey(LS_BASE, key)) {
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
  window.dispatchEvent(new Event("vltd:wishlist-updated"));
}

// ── Supabase sync (local cache always works) ────────────────────────
const BASE_COLUMNS = "id,title,target_price,notes,universe,category,subject,condition,priority,created_at";
const CATALOG_COLUMNS = ",image_url,source,external_id,release_date,status";

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

function catalogFields(item: WishlistItem) {
  return {
    image_url: item.imageUrl ?? null,
    source: item.source ?? "manual",
    external_id: item.externalId ?? null,
    release_date: item.releaseDate ?? null,
    status: item.status ?? "want",
  };
}

// Columns added by 20261011_wishlist_comics_and_sharing.sql. Until it's run,
// save the original columns so the wishlist still reaches the account.
function isMissingCatalogColumn(message: string | undefined) {
  return !!message && /(image_url|source|external_id|release_date|status)/i.test(message);
}

async function pushWish(item: WishlistItem): Promise<boolean> {
  try {
    const pid = activeProfileId();
    if (!pid) return false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;
    const full = await supabase.from("wishlist").upsert({ ...wishRow(item, pid), ...catalogFields(item) }, { onConflict: "id" });
    if (!full.error) return true;
    if (!isMissingCatalogColumn(full.error.message)) return false;
    const legacy = await supabase.from("wishlist").upsert(wishRow(item, pid), { onConflict: "id" });
    return !legacy.error;
  } catch {
    return false;
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

function rowToItem(r: Record<string, unknown>): WishlistItem {
  return {
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
    imageUrl: (r.image_url as string) ?? undefined,
    source: (r.source as string) ?? undefined,
    externalId: r.external_id != null ? String(r.external_id) : undefined,
    releaseDate: (r.release_date as string) ?? undefined,
    status: r.status === "preordered" ? "preordered" : r.status === "want" ? "want" : undefined,
  };
}

export async function syncWishlistFromSupabase(): Promise<WishlistItem[]> {
  if (typeof window === "undefined") return [];
  const local = loadWishlist();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    type Res = { data: unknown; error: { message: string } | null };
    const read = async (columns: string): Promise<Res> =>
      (await supabase.from("wishlist").select(columns).eq("profile_id", pid)) as unknown as Res;
    let res = await read(BASE_COLUMNS + CATALOG_COLUMNS);
    if (res.error && isMissingCatalogColumn(res.error.message)) {
      res = await read(BASE_COLUMNS);
    }
    const { error } = res;
    const data = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : null;
    if (error || !data) return local;
    if (data.length === 0) {
      for (const w of local) void pushWish(w);
      return local;
    }
    const remote = data.map(rowToItem);
    // Keep catalog fields a pre-migration row can't hold yet, from the local copy.
    const localById = new Map(local.map((w) => [w.id, w]));
    const items = remote.map((w) => ({ ...localById.get(w.id), ...w, ...pickDefined(localOnlyCatalog(localById.get(w.id)), w) }));
    items.sort((a, b) => b.createdAt - a.createdAt);
    saveWishlist(items);
    return items;
  } catch {
    return local;
  }
}

function localOnlyCatalog(w: WishlistItem | undefined): Partial<WishlistItem> {
  if (!w) return {};
  return { imageUrl: w.imageUrl, source: w.source, externalId: w.externalId, releaseDate: w.releaseDate, status: w.status };
}

/** Fill catalog fields the remote row is missing (undefined) from the local copy. */
function pickDefined(fromLocal: Partial<WishlistItem>, remote: WishlistItem): Partial<WishlistItem> {
  const out: Partial<WishlistItem> = {};
  for (const key of Object.keys(fromLocal) as (keyof WishlistItem)[]) {
    if (remote[key] === undefined && fromLocal[key] !== undefined) {
      (out as Record<string, unknown>)[key] = fromLocal[key];
    }
  }
  return out;
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
    source: "manual",
    ...fields,
  };
  const next = [item, ...loadWishlist()];
  saveWishlist(next);
  void pushWish(item);
  return item;
}

// Update fields on an existing wishlist item (target price, notes, priority).
// Persists locally and to Supabase, same as add/remove.
export function updateWishlistItem(
  id: string,
  patch: Partial<Pick<WishlistItem, "targetPrice" | "notes" | "priority" | "status">>
): WishlistItem[] {
  const next = loadWishlist().map((item) => (item.id === id ? { ...item, ...patch } : item));
  saveWishlist(next);
  const updated = next.find((item) => item.id === id);
  if (updated) void pushWish(updated);
  return next;
}

export function removeWishlistItem(id: string) {
  const next = loadWishlist().filter((i) => i.id !== id);
  saveWishlist(next);
  void deleteWishRow(id);
  return next;
}

// ── Catalog picks (Upcoming Comics etc.) ─────────────────────────────

export type CatalogPick = {
  source: string;
  externalId: string;
  title: string;
  imageUrl?: string;
  releaseDate?: string;
  universe?: string;
  category?: string;
  subject?: string;
};

/** Stable id so the same catalog item is one row per profile. */
export function catalogWishId(source: string, externalId: string) {
  const pid = activeProfileId();
  return `${source}_${externalId}_${pid.slice(0, 8)}`;
}

export function findCatalogWish(source: string, externalId: string): WishlistItem | undefined {
  return loadWishlist().find((w) => w.source === source && w.externalId === externalId);
}

/**
 * Put a catalog item on the wishlist as Want / Pre-ordered, or take it off
 * (null). Returns false if it could not be saved to the account.
 */
export async function setCatalogWish(pick: CatalogPick, status: WishStatus | null): Promise<boolean> {
  const existing = findCatalogWish(pick.source, pick.externalId);
  if (status === null) {
    if (existing) removeWishlistItem(existing.id);
    return true;
  }
  const item: WishlistItem = {
    ...(existing ?? { id: catalogWishId(pick.source, pick.externalId), createdAt: Date.now() }),
    title: pick.title,
    imageUrl: pick.imageUrl,
    releaseDate: pick.releaseDate,
    universe: pick.universe,
    category: pick.category,
    subject: pick.subject,
    source: pick.source,
    externalId: pick.externalId,
    status,
  };
  const others = loadWishlist().filter((w) => w.id !== item.id);
  saveWishlist([item, ...others]);
  return pushWish(item);
}
