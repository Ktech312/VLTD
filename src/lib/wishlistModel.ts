import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";
import { idNamespaceOf } from "@/lib/wantsCore";

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
  /** Wanted (default), Preordered (arranged by the person with a shop; VLTD places no order), Acquired, or Skipped (kept, not deleted). */
  status?: WishStatus;
  /** How many copies are wanted (default 1) and how many are in the Vault already. */
  quantity?: number;
  quantityAcquired?: number;
  /** Series or product line. */
  series?: string;
  /** Edition, cover or variant. */
  edition?: string;
  /** A release window when there is no exact date, e.g. "Q1 2027". Unknown stays unknown. */
  releaseWindow?: string;
  /** Where to buy or read about it (opens outside VLTD). */
  sourceUrl?: string;
  shop?: string;
  /** Category-specific details, only the ones that apply (era, maker, set, format...). */
  details?: Record<string, string>;
  skippedAt?: number;
  /** The Vault records created when copies were acquired (so a repeat save never creates a second one). */
  acquiredItemIds?: string[];
  /** The Following rule that added this want. */
  ruleId?: string;
  /** Source identity, e.g. "metron:issue:181794", so a refresh never adds the same release twice. */
  sourceIdentity?: string;
  /** Fields the person changed by hand; a refresh never overwrites these. */
  edited?: string[];
  /** The price expected for one copy (cover, retail or a quote). Unknown stays unknown, never $0. Not the same as the target price. */
  price?: number;
  updatedAt?: number;
  /** Device-only: the extra fields above have been uploaded to an account that can hold them. */
  extrasInCloud?: boolean;
};

export type WishStatus = "want" | "preordered" | "acquired" | "skipped";

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

/** The piece of the active profile that goes into ids worked out from what a want is (see idNamespaceOf). */
export function wantIdNamespace(): string {
  return idNamespaceOf(activeProfileId());
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
// Three column tiers, newest first. The extras (quantity, edition, release window, source link, shop, details, skipped/acquired records, rule link, source
// identity, edited fields, expected price) need 20261024_wishlist_pull_list.sql; the catalog columns need 20261011_wishlist_comics_and_sharing.sql. Until a tier
// exists in the database, what it would hold stays on this device and is merged back in on every read, so nothing is lost and nothing is shown twice.
const BASE_COLUMNS = "id,title,target_price,notes,universe,category,subject,condition,priority,created_at";
const CATALOG_COLUMNS = ",image_url,source,external_id,release_date,status";
const EXTRA_COLUMNS =
  ",quantity,quantity_acquired,series,edition,release_window,source_url,shop,details,skipped_at,acquired_item_ids,rule_id,source_identity,edited,expected_price,updated_at";

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

function extraFields(item: WishlistItem) {
  return {
    quantity: item.quantity ?? 1,
    quantity_acquired: item.quantityAcquired ?? 0,
    series: item.series ?? null,
    edition: item.edition ?? null,
    release_window: item.releaseWindow ?? null,
    source_url: item.sourceUrl ?? null,
    shop: item.shop ?? null,
    details: item.details ?? null,
    skipped_at: item.skippedAt ? new Date(item.skippedAt).toISOString() : null,
    acquired_item_ids: item.acquiredItemIds ?? [],
    rule_id: item.ruleId ?? null,
    source_identity: item.sourceIdentity ?? null,
    edited: item.edited ?? [],
    expected_price: item.price ?? null,
    updated_at: new Date(item.updatedAt || Date.now()).toISOString(),
  };
}

// A column (or the widened status check) the database does not have yet.
function isMissingColumn(message: string | undefined) {
  return !!message && /column|schema cache|constraint|does not exist/i.test(message);
}

// An outbox on this device: a want that was saved or deleted here but whose upload has not been confirmed is remembered, so going offline (or a failed
// request) never loses it and a later read never undoes it. It is retried on every read.
type Pending = { up: string[]; del: string[] };
function pendingKey() {
  const pid = activeProfileId();
  return pid ? `vltd_wishlist_pending:${pid}` : "vltd_wishlist_pending";
}
function readPending(): Pending {
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingKey()) ?? "{}") as Partial<Pending>;
    return { up: Array.isArray(parsed.up) ? parsed.up : [], del: Array.isArray(parsed.del) ? parsed.del : [] };
  } catch {
    return { up: [], del: [] };
  }
}
function writePending(p: Pending) {
  try {
    localStorage.setItem(pendingKey(), JSON.stringify({ up: [...new Set(p.up)], del: [...new Set(p.del)] }));
  } catch {
    /* storage unavailable */
  }
}
function markUp(id: string) { const p = readPending(); writePending({ up: [...p.up, id], del: p.del.filter((x) => x !== id) }); }
function clearUp(id: string) { const p = readPending(); writePending({ up: p.up.filter((x) => x !== id), del: p.del }); }
function markDel(id: string) { const p = readPending(); writePending({ up: p.up.filter((x) => x !== id), del: [...p.del, id] }); }
function clearDel(id: string) { const p = readPending(); writePending({ up: p.up, del: p.del.filter((x) => x !== id) }); }

function flagExtrasInCloud(id: string) {
  const items = loadWishlist();
  if (!items.some((w) => w.id === id && w.extrasInCloud !== true)) return;
  saveWishlist(items.map((w) => (w.id === id ? { ...w, extrasInCloud: true } : w)));
}

async function pushWish(item: WishlistItem): Promise<boolean> {
  markUp(item.id);
  try {
    const pid = activeProfileId();
    if (!pid) return false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return false;
    const { extrasInCloud: _local, ...clean } = item; // eslint-disable-line @typescript-eslint/no-unused-vars
    const tiers = [
      { ...wishRow(clean, pid), ...catalogFields(clean), ...extraFields(clean) },
      { ...wishRow(clean, pid), ...catalogFields(clean) },
      wishRow(clean, pid),
    ];
    for (let i = 0; i < tiers.length; i++) {
      const res = await supabase.from("wishlist").upsert(tiers[i], { onConflict: "id" });
      if (!res.error) {
        clearUp(item.id);
        if (i === 0) flagExtrasInCloud(item.id);
        return true;
      }
      if (!isMissingColumn(res.error.message)) return false;
    }
    return false;
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
    const { error } = await supabase.from("wishlist").delete().eq("id", id).eq("profile_id", pid);
    if (!error) clearDel(id);
  } catch {
    /* stays in the outbox and is retried */
  }
}

function dayOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value.slice(0, 10) : undefined;
}

function rowToItem(r: Record<string, unknown>): WishlistItem {
  const status = r.status === "preordered" || r.status === "acquired" || r.status === "skipped" ? (r.status as WishStatus) : r.status === "want" ? "want" : undefined;
  const item: WishlistItem = {
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
    releaseDate: dayOrUndefined(r.release_date),
    status,
  };
  if ("quantity" in r) {
    item.quantity = r.quantity != null ? Number(r.quantity) : undefined;
    item.quantityAcquired = r.quantity_acquired != null ? Number(r.quantity_acquired) : undefined;
    item.series = (r.series as string) ?? undefined;
    item.edition = (r.edition as string) ?? undefined;
    item.releaseWindow = (r.release_window as string) ?? undefined;
    item.sourceUrl = (r.source_url as string) ?? undefined;
    item.shop = (r.shop as string) ?? undefined;
    item.details = r.details && typeof r.details === "object" ? (r.details as Record<string, string>) : undefined;
    item.skippedAt = r.skipped_at ? Date.parse(String(r.skipped_at)) || undefined : undefined;
    item.acquiredItemIds = Array.isArray(r.acquired_item_ids) && r.acquired_item_ids.length ? (r.acquired_item_ids as string[]) : undefined;
    item.ruleId = (r.rule_id as string) ?? undefined;
    item.sourceIdentity = (r.source_identity as string) ?? undefined;
    item.edited = Array.isArray(r.edited) && r.edited.length ? (r.edited as string[]) : undefined;
    item.price = r.expected_price != null ? Number(r.expected_price) : undefined;
    item.updatedAt = Date.parse(String(r.updated_at)) || undefined;
  }
  return item;
}

export async function syncWishlistFromSupabase(): Promise<WishlistItem[]> {
  if (typeof window === "undefined") return [];
  const local = loadWishlist();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const stillSame = captureIdentity();
    type Res = { data: unknown; error: { message: string } | null };
    const read = async (columns: string): Promise<Res> =>
      (await supabase.from("wishlist").select(columns).eq("profile_id", pid)) as unknown as Res;
    let extrasInDatabase = true;
    let res = await read(BASE_COLUMNS + CATALOG_COLUMNS + EXTRA_COLUMNS);
    if (res.error && isMissingColumn(res.error.message)) {
      extrasInDatabase = false;
      res = await read(BASE_COLUMNS + CATALOG_COLUMNS);
      if (res.error && isMissingColumn(res.error.message)) res = await read(BASE_COLUMNS);
    }
    const { error } = res;
    const data = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : null;
    if (error || !data) return local;
    if (!stillSame()) return local; // the person or profile changed while this was in flight: not theirs to save or push
    if (data.length === 0) {
      for (const w of local) void pushWish(w);
      return local;
    }
    const pending = readPending();
    const pendingUp = new Set(pending.up);
    const pendingDel = new Set(pending.del);
    const remote = data.map(rowToItem);
    for (const w of remote) if (pendingDel.has(w.id)) void deleteWishRow(w.id); // a delete that never reached the account: finish it
    // Fields a database that has not been upgraded yet cannot hold stay as the local copy has them.
    const localById = new Map(local.map((w) => [w.id, w]));
    const repush: WishlistItem[] = [];
    const items: WishlistItem[] = [];
    for (const w of remote) {
      if (pendingDel.has(w.id)) continue;
      const l = localById.get(w.id);
      if (l && pendingUp.has(w.id)) { items.push(l); repush.push(l); continue; } // saved here, not confirmed in the account: this device's copy wins and is sent again
      let merged = mergeRemote(l, w, extrasInDatabase);
      if (extrasInDatabase && l && l.extrasInCloud !== true && hasLocalExtras(l)) {
        // Saved before the account could hold these fields: send them now, and keep them meanwhile.
        merged = { ...merged, ...pickExtras(l) };
        repush.push(merged);
      } else if (extrasInDatabase && l && hasLocalExtras(l)) merged.extrasInCloud = true;
      items.push(merged);
    }
    const remoteIds = new Set(remote.map((w) => w.id));
    for (const l of local) if (pendingUp.has(l.id) && !remoteIds.has(l.id) && !pendingDel.has(l.id)) { items.push(l); repush.push(l); } // created offline: not lost
    items.sort((a, b) => b.createdAt - a.createdAt);
    saveWishlist(items);
    for (const w of repush) void pushWish(w);
    return items;
  } catch {
    return local;
  }
}

function hasLocalExtras(w: WishlistItem): boolean {
  return EXTRA_KEYS.some((k) => k !== "updatedAt" && w[k] !== undefined);
}
function pickExtras(w: WishlistItem): Partial<WishlistItem> {
  const out: Partial<WishlistItem> = {};
  for (const k of EXTRA_KEYS) if (w[k] !== undefined) (out as Record<string, unknown>)[k] = w[k];
  return out;
}

const EXTRA_KEYS: (keyof WishlistItem)[] = [
  "quantity", "quantityAcquired", "series", "edition", "releaseWindow", "sourceUrl", "shop", "details", "skippedAt", "acquiredItemIds", "ruleId", "sourceIdentity", "edited", "price", "updatedAt",
];
const CATALOG_KEYS: (keyof WishlistItem)[] = ["imageUrl", "source", "externalId", "releaseDate", "status"];

/**
 * Remote wins where the database holds the field. A field the database cannot hold yet (columns not added, or a status its check does not allow yet)
 * keeps the local value, so an Acquired or Skipped want is never turned back into Wanted by a read.
 */
export function mergeRemote(local: WishlistItem | undefined, remote: WishlistItem, extrasInDatabase: boolean): WishlistItem {
  if (!local) return remote;
  const out: WishlistItem = { ...local, ...remote };
  for (const key of CATALOG_KEYS) if (remote[key] === undefined && local[key] !== undefined) (out as Record<string, unknown>)[key] = local[key];
  if (!extrasInDatabase) {
    for (const key of EXTRA_KEYS) if (local[key] !== undefined) (out as Record<string, unknown>)[key] = local[key];
    if (local.status === "acquired" || local.status === "skipped") out.status = local.status;
  } else {
    for (const key of EXTRA_KEYS) if (remote[key] === undefined && local[key] !== undefined && key !== "skippedAt") (out as Record<string, unknown>)[key] = local[key];
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
  patch: Partial<Omit<WishlistItem, "id" | "createdAt">>
): WishlistItem[] {
  const next = loadWishlist().map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  saveWishlist(next);
  const updated = next.find((item) => item.id === id);
  if (updated) void pushWish(updated);
  return next;
}

/** Add (or replace) a complete want: used by the Pull List page, rule refreshes and Acquired. Same id = same row, so repeating it never makes a copy. */
export function saveWishlistItem(item: WishlistItem): WishlistItem[] {
  const next = [item, ...loadWishlist().filter((w) => w.id !== item.id)];
  saveWishlist(next);
  void pushWish(item);
  return next;
}

/** Add several at once (a rule refresh): one local write, one push each. */
export function saveWishlistItems(items: WishlistItem[]): WishlistItem[] {
  if (items.length === 0) return loadWishlist();
  const ids = new Set(items.map((i) => i.id));
  const next = [...items, ...loadWishlist().filter((w) => !ids.has(w.id))];
  saveWishlist(next);
  for (const item of items) void pushWish(item);
  return next;
}

export function removeWishlistItem(id: string) {
  const next = loadWishlist().filter((i) => i.id !== id);
  saveWishlist(next);
  markDel(id);
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
  // A want that was already received or skipped is not turned back into Wanted by a tap on Upcoming Comics.
  if (existing && (existing.status === "acquired" || existing.status === "skipped")) return true;
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
