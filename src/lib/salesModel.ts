// Unified sales ledger — the single source of truth for sold-item records.
//
// Backed by Supabase (public.sales), scoped per profile, with a localStorage
// cache. Replaces the three legacy stores (salesLedger / salesHistory /
// historyModel), which are now thin adapters over this model. On first load it
// migrates any existing legacy local records so nothing is lost.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type Sale = {
  id: string;
  itemId?: string;
  title?: string;
  universe?: string;
  category?: string;
  grade?: string;
  certNumber?: string;
  purchasePrice?: number;
  salePrice?: number;
  profit?: number;
  soldAt: number;
  platform?: string;
  notes?: string;
};

const LS_BASE = "vltd_sales_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

// Legacy per-device stores we migrate from (one time).
const LEGACY_KEYS = ["vltd_sales_ledger_v1", "vltd_sales_history", "vltd_sale_history_v1"];

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

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

function genId() {
  return `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(raw: Record<string, unknown>): Sale {
  const purchasePrice = num(raw.purchasePrice);
  const salePrice = num(raw.salePrice);
  const profit =
    num(raw.profit) ??
    (salePrice != null || purchasePrice != null ? (salePrice ?? 0) - (purchasePrice ?? 0) : undefined);
  return {
    id: String(raw.id ?? genId()),
    itemId: raw.itemId != null ? String(raw.itemId) : undefined,
    title: raw.title != null ? String(raw.title) : undefined,
    universe: raw.universe != null ? String(raw.universe) : undefined,
    // legacy salesHistory used `categoryLabel`; ledger used `category`
    category:
      raw.category != null
        ? String(raw.category)
        : raw.categoryLabel != null
          ? String(raw.categoryLabel)
          : undefined,
    grade: raw.grade != null ? String(raw.grade) : undefined,
    certNumber: raw.certNumber != null ? String(raw.certNumber) : undefined,
    purchasePrice,
    salePrice,
    profit,
    soldAt: num(raw.soldAt) ?? num(raw.saleDate) ?? num(raw.createdAt) ?? Date.now(),
    platform: raw.platform != null ? String(raw.platform) : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
  };
}

function readRaw(): Sale[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = window.localStorage.getItem(key);
    if (!raw && key !== LS_BASE) {
      const legacy = window.localStorage.getItem(LS_BASE);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) {
      // One-time migration from the three legacy per-device stores.
      const migrated = migrateLegacyLocal();
      if (migrated.length > 0) {
        writeRaw(migrated);
        return migrated;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((r) => normalize(r)) : [];
  } catch {
    return [];
  }
}

function migrateLegacyLocal(): Sale[] {
  if (typeof window === "undefined") return [];
  const byId = new Map<string, Sale>();
  for (const key of LEGACY_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const r of parsed) {
        const sale = normalize(r as Record<string, unknown>);
        if (!byId.has(sale.id)) byId.set(sale.id, sale);
      }
    } catch {
      /* ignore a corrupt legacy store */
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.soldAt - a.soldAt);
}

function writeRaw(sales: Sale[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(), JSON.stringify(sales));
  } catch {
    /* ignore */
  }
}

export function loadSales(): Sale[] {
  return readRaw().sort((a, b) => b.soldAt - a.soldAt);
}

export function saveSales(sales: Sale[]) {
  const normalized = sales.map((s) => normalize(s as unknown as Record<string, unknown>));
  writeRaw(normalized);
  void reconcileServer(normalized);
}

// ── Supabase sync (best-effort; local cache always works) ───────────
function saleRow(s: Sale, pid: string) {
  return {
    id: s.id,
    profile_id: pid,
    item_id: s.itemId ?? null,
    title: s.title ?? null,
    universe: s.universe ?? null,
    category: s.category ?? null,
    grade: s.grade ?? null,
    cert_number: s.certNumber ?? null,
    purchase_price: s.purchasePrice ?? null,
    sale_price: s.salePrice ?? null,
    profit: s.profit ?? null,
    sold_at: new Date(s.soldAt || Date.now()).toISOString(),
    platform: s.platform ?? null,
    notes: s.notes ?? null,
  };
}

async function pushSale(s: Sale) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("sales").upsert(saleRow(s, pid), { onConflict: "id" });
  } catch {
    /* table may not exist yet — local still holds it */
  }
}

async function deleteSaleRow(id: string) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("sales").delete().eq("id", id).eq("profile_id", pid);
  } catch {
    /* ignore */
  }
}

// After a saveSales() that may have removed rows (e.g. undo), delete any server
// rows no longer present locally, and upsert the current set.
async function reconcileServer(current: Sale[]) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.from("sales").select("id").eq("profile_id", pid);
    const localIds = new Set(current.map((s) => s.id));
    const serverIds: string[] = Array.isArray(data) ? data.map((r: { id: string }) => String(r.id)) : [];
    for (const id of serverIds) {
      if (!localIds.has(id)) void deleteSaleRow(id);
    }
    for (const s of current) void pushSale(s);
  } catch {
    /* ignore */
  }
}

export function addSale(partial: Partial<Sale> & { soldAt?: number }): Sale {
  const sale: Sale = normalize({
    ...partial,
    id: partial.id ?? genId(),
    soldAt: partial.soldAt ?? Date.now(),
  } as Record<string, unknown>);
  const next = [sale, ...readRaw().filter((s) => s.id !== sale.id)];
  writeRaw(next);
  void pushSale(sale);
  return sale;
}

export function removeSaleById(id: string) {
  writeRaw(readRaw().filter((s) => s.id !== id));
  void deleteSaleRow(id);
}

export async function syncSalesFromSupabase(): Promise<Sale[]> {
  if (typeof window === "undefined") return [];
  const local = loadSales();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id,item_id,title,universe,category,grade,cert_number,purchase_price,sale_price,profit,sold_at,platform,notes"
      )
      .eq("profile_id", pid)
      .order("sold_at", { ascending: false });
    if (error || !data) return local;

    if (data.length === 0) {
      // Server empty — seed it from local (incl. anything just migrated).
      for (const s of local) void pushSale(s);
      return local;
    }

    const serverSales: Sale[] = data.map((r: Record<string, unknown>) =>
      normalize({
        id: r.id,
        itemId: r.item_id,
        title: r.title,
        universe: r.universe,
        category: r.category,
        grade: r.grade,
        certNumber: r.cert_number,
        purchasePrice: r.purchase_price,
        salePrice: r.sale_price,
        profit: r.profit,
        soldAt: r.sold_at ? Date.parse(String(r.sold_at)) : undefined,
        platform: r.platform,
        notes: r.notes,
      })
    );

    const byId = new Map<string, Sale>();
    for (const s of serverSales) byId.set(s.id, s);
    // Keep any local-only rows and push them up.
    for (const s of local) {
      if (!byId.has(s.id)) {
        byId.set(s.id, s);
        void pushSale(s);
      }
    }
    const merged = Array.from(byId.values()).sort((a, b) => b.soldAt - a.soldAt);
    writeRaw(merged);
    return merged;
  } catch {
    return local;
  }
}

export function getSalesMetrics() {
  const sales = loadSales();
  const totalRevenue = sales.reduce((s, r) => s + (r.salePrice ?? 0), 0);
  const totalCost = sales.reduce((s, r) => s + (r.purchasePrice ?? 0), 0);
  return {
    totalSold: sales.length,
    totalRevenue,
    totalCost,
    totalProfit: totalRevenue - totalCost,
  };
}
