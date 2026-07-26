"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { getPrimaryImageUrl, loadItems, saveItem, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";

const SALES_KEY = "vltd_sales_history";

type SoldItem = {
  id: string;
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  customCategoryLabel?: string;
  subcategoryLabel?: string;
  imageFrontUrl?: string;
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  soldPrice: number;
  soldAt: number;
  itemId?: string;
};

type SoldStats = {
  count: number;
  realizedRevenue: number;
  totalCost: number;
  totalProfit: number;
};

function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function cost(i: SoldItem) {
  return (
    Number(i.purchasePrice ?? 0) +
    Number(i.purchaseTax ?? 0) +
    Number(i.purchaseShipping ?? 0) +
    Number(i.purchaseFees ?? 0)
  );
}

function normalizeUniverseText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directUniverseMatch(value: unknown): UniverseKey | "" {
  const text = normalizeUniverseText(value);
  if (!text) return "";

  if (["pop culture", "pop", "comics", "comic", "comic books", "toys", "figures", "figure", "funko", "manga", "marvel", "dc", "art cards"].includes(text)) return "POP_CULTURE";
  if (["sports", "sports cards", "memorabilia", "jerseys", "jersey", "game used", "autographs"].includes(text)) return "SPORTS";
  if (["tcg", "trading card game", "pokemon", "pokémon", "mtg", "magic", "magic the gathering", "yugioh", "yu gi oh", "bo jackson arena"].includes(text)) return "TCG";
  if (["music", "vinyl", "vinyl records", "record", "records", "album", "albums", "lp", "cd", "cds", "instruments"].includes(text)) return "MUSIC";
  if (["jewelry apparel", "jewelry and apparel", "jewelry", "apparel", "watches", "watch", "bags", "bag", "streetwear", "luxury"].includes(text)) return "JEWELRY_APPAREL";
  if (["games", "game", "video games", "video game", "console", "consoles", "cartridge", "cartridges", "arcade", "handhelds"].includes(text)) return "GAMES";
  if (["misc", "miscellaneous", "other", "uncategorized", "unknown", "collectors choice"].includes(text)) return "MISC";

  return "";
}

function normalizeUniverse(value: unknown): UniverseKey {
  return directUniverseMatch(value) || "MISC";
}

function inferSoldUniverse(item: SoldItem): UniverseKey {
  const rawUniverse = typeof item.universe === "string" ? item.universe.trim() : "";
  if (rawUniverse) return normalizeUniverse(rawUniverse);

  const direct = directUniverseMatch(item.categoryLabel || item.customCategoryLabel || item.category || item.subcategoryLabel);
  if (direct) return direct;

  const text = normalizeUniverseText([
    item.category,
    item.categoryLabel,
    item.customCategoryLabel,
    item.subcategoryLabel,
    item.title,
    item.subtitle,
    item.number,
    item.grade,
  ].filter(Boolean).join(" "));

  const hasAny = (terms: string[]) => terms.some((term) => text.includes(term));

  if (hasAny(["comic", "comics", "cgc", "cbcs", "variant cover", "first appearance", "issue", "spawn", "batman", "superman", "spider man", "x men", "marvel", " dc ", "funko", "figure", "toy", "statue", "manga"])) return "POP_CULTURE";
  if (hasAny(["sports card", "rookie", "refractor", "panini", "topps", "jersey", "game used", "autograph", "psa", "bgs", "sgc", "baseball", "basketball", "football", "soccer", "hockey"])) return "SPORTS";
  if (hasAny(["pokemon", "pokémon", "magic the gathering", " mtg ", "yugioh", "yu gi oh", "trading card game", " tcg ", "bo jackson arena", "foil", "serialized", "base set"])) return "TCG";
  if (hasAny(["vinyl", "record", "records", "album", "albums", " lp ", "signed lp", "cd ", "guitar", "instrument", "turntable"])) return "MUSIC";
  if (hasAny(["watch", "watches", "jewelry", "apparel", "bag", "bags", "streetwear", "vintage clothing", "limited drop", "luxury"])) return "JEWELRY_APPAREL";
  if (hasAny(["video game", "game cartridge", "sealed game", "console", "nintendo", "playstation", "xbox", "sega", "atari", "cartridge", "disc only", "controller", "arcade"])) return "GAMES";

  return "MISC";
}

function itemMeta(item: SoldItem) {
  const primary = [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
  if (primary) return primary;
  const fallback = [
    item.categoryLabel || item.customCategoryLabel,
    item.subcategoryLabel,
  ]
    .filter(Boolean)
    .join(" • ");
  return fallback || "Sold item record";
}

function readSales(): SoldItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(data) ? (data as SoldItem[]) : [];
  } catch {
    return [];
  }
}

function writeSales(items: SoldItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(items));
  } catch {
    // Sales history is a compatibility cache. Cloud item state remains primary.
  }
}

function removeSaleRecord(itemId: string) {
  writeSales(
    readSales().filter((sale) => String(sale.id) !== String(itemId) && String(sale.itemId ?? "") !== String(itemId))
  );
}

function soldItemFromVaultItem(item: VaultItem): SoldItem | null {
  if (item.status !== "SOLD" && !item.soldAt && item.soldPrice === undefined) return null;

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    universe: item.universe,
    category: item.category,
    categoryLabel: item.categoryLabel,
    customCategoryLabel: item.customCategoryLabel,
    subcategoryLabel: item.subcategoryLabel,
    imageFrontUrl: getPrimaryImageUrl(item) || item.imageFrontUrl,
    purchasePrice: item.purchasePrice,
    purchaseTax: item.purchaseTax,
    purchaseShipping: item.purchaseShipping,
    purchaseFees: item.purchaseFees,
    soldPrice: Number(item.soldPrice ?? 0),
    soldAt: Number(item.soldAt ?? Date.now()),
  };
}

function buildSoldItems() {
  const byId = new Map<string, SoldItem>();

  for (const item of loadItems({ includeAllProfiles: true })) {
    const sold = soldItemFromVaultItem(item);
    if (sold) byId.set(String(sold.id), sold);
  }

  for (const sale of readSales()) {
    if (!byId.has(String(sale.id))) byId.set(String(sale.id), sale);
  }

  return Array.from(byId.values()).sort((a, b) => Number(b.soldAt) - Number(a.soldAt));
}

function soldStats(items: SoldItem[]): SoldStats {
  return items.reduce(
    (stats, item) => {
      const itemCost = cost(item);
      stats.count += 1;
      stats.realizedRevenue += Number(item.soldPrice ?? 0);
      stats.totalCost += itemCost;
      stats.totalProfit += Number(item.soldPrice ?? 0) - itemCost;
      return stats;
    },
    { count: 0, realizedRevenue: 0, totalCost: 0, totalProfit: 0 }
  );
}


// ─── Analytics helpers ────────────────────────────────────────────────────────

function groupByMonth(items: SoldItem[]) {
  const map = new Map<string, { revenue: number; profit: number; count: number }>();
  for (const item of items) {
    const d = new Date(Number(item.soldAt));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = map.get(key) ?? { revenue: 0, profit: 0, count: 0 };
    prev.revenue += Number(item.soldPrice ?? 0);
    prev.profit += Number(item.soldPrice ?? 0) - cost(item);
    prev.count += 1;
    map.set(key, prev);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12); // last 12 months
}

function groupByUniverse(items: SoldItem[]) {
  const map = new Map<string, { revenue: number; profit: number; count: number }>();
  for (const item of items) {
    const u = UNIVERSE_LABEL[inferSoldUniverse(item)] ?? "Other";
    const prev = map.get(u) ?? { revenue: 0, profit: 0, count: 0 };
    prev.revenue += Number(item.soldPrice ?? 0);
    prev.profit += Number(item.soldPrice ?? 0) - cost(item);
    prev.count += 1;
    map.set(u, prev);
  }
  return Array.from(map.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
}

function avgDaysToSell(items: SoldItem[]) {
  // Approximate: use soldAt vs createdAt if available — fallback to 0
  const withDays = items.filter((i) => i.soldAt);
  if (withDays.length === 0) return null;
  // We don't have purchaseDate in SoldItem so just show median hold time
  return null;
}

// ─── Sparkline bar chart (pure SVG, no deps) ──────────────────────────────────

function MiniBarChart({
  data,
  color = "var(--theme-gold)",
  height = 48,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * w + 0.5}
            y={height - barH}
            width={w - 1}
            height={barH}
            fill={color}
            opacity={v > 0 ? 0.85 : 0.15}
            rx="2"
          />
        );
      })}
    </svg>
  );
}

// ─── Analytics panel ──────────────────────────────────────────────────────────

function AnalyticsPanel({ items }: { items: SoldItem[] }) {
  const monthly = groupByMonth(items);
  const byUniverse = groupByUniverse(items);
  const roiPct = items.length > 0
    ? (() => {
        const rev = items.reduce((s, i) => s + Number(i.soldPrice ?? 0), 0);
        const c = items.reduce((s, i) => s + cost(i), 0);
        return c > 0 ? ((rev - c) / c) * 100 : null;
      })()
    : null;
  const bestItem = [...items].sort((a, b) => (b.soldPrice - cost(b)) - (a.soldPrice - cost(a)))[0];

  if (items.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {/* Monthly revenue chart */}
      {monthly.length > 1 && (
        <div
          className="rounded-[14px] p-4 ring-1 ring-[color:var(--theme-border)]"
          style={{ background: "var(--theme-elevated)" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
            Monthly Revenue
          </div>
          <MiniBarChart data={monthly.map((m) => m[1].revenue)} height={48} />
          <div className="mt-2 flex justify-between text-[9px]" style={{ color: "var(--muted)" }}>
            <span>{monthly[0]?.[0]}</span>
            <span>{monthly[monthly.length - 1]?.[0]}</span>
          </div>
        </div>
      )}

      {/* Monthly profit chart */}
      {monthly.length > 1 && (
        <div
          className="rounded-[14px] p-4 ring-1 ring-[color:var(--theme-border)]"
          style={{ background: "var(--theme-elevated)" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
            Monthly Profit/Loss
          </div>
          <MiniBarChart
            data={monthly.map((m) => Math.max(0, m[1].profit))}
            color="var(--theme-gold)"
            height={48}
          />
          <div className="mt-2 flex gap-3 flex-wrap text-[10px]" style={{ color: "var(--muted)" }}>
            {monthly.slice(-3).map(([k, v]) => (
              <span key={k}>
                <span className="font-semibold" style={{ color: v.profit >= 0 ? "rgb(52,211,153)" : "rgb(252,165,165)" }}>
                  {v.profit >= 0 ? "+" : ""}{money(v.profit)}
                </span>
                {" "}{k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* By universe */}
      {byUniverse.length > 0 && (
        <div
          className="rounded-[14px] p-4 ring-1 ring-[color:var(--theme-border)]"
          style={{ background: "var(--theme-elevated)" }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--muted2)" }}>
            Sales by Category
          </div>
          <div className="flex flex-col gap-2">
            {byUniverse.slice(0, 5).map(([u, v]) => {
              const maxRev = byUniverse[0]?.[1].revenue ?? 1;
              const pct = maxRev > 0 ? (v.revenue / maxRev) * 100 : 0;
              return (
                <div key={u}>
                  <div className="flex justify-between text-[11px] mb-0.5" style={{ color: "var(--fg)" }}>
                    <span>{u}</span>
                    <span className="font-semibold">{money(v.revenue)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--pill)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: "var(--theme-gold)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROI + best item */}
      <div
        className="rounded-[14px] p-4 ring-1 ring-[color:var(--theme-border)] flex flex-col gap-3"
        style={{ background: "var(--theme-elevated)" }}
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
            Overall ROI
          </div>
          <div
            className="mt-1 text-2xl font-extrabold"
            style={{ color: roiPct !== null && roiPct >= 0 ? "rgb(52,211,153)" : "rgb(252,165,165)" }}
          >
            {roiPct !== null ? `${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(1)}%` : "—"}
          </div>
        </div>
        {bestItem && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
              Best Sale
            </div>
            <div className="mt-0.5 text-[12px] font-semibold line-clamp-1" style={{ color: "var(--fg)" }}>
              {bestItem.title}
            </div>
            <div className="text-[11px]" style={{ color: "rgb(52,211,153)" }}>
              +{money(bestItem.soldPrice - cost(bestItem))} profit
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SoldCard({
  item,
  onReturnToVault,
  onViewImage,
}: {
  item: SoldItem;
  onReturnToVault: (item: SoldItem) => void;
  onViewImage: (item: SoldItem, imageUrl: string) => void;
}) {
  const profit = item.soldPrice - cost(item);
  const universe = inferSoldUniverse(item);
  const detailHref = `/vault/item/${item.id}?sold=1`;
  const imageUrl = getPrimaryImageUrl(item as unknown as VaultItem) || item.imageFrontUrl || "";

  return (
    <article
      className="group relative flex h-[250px] flex-col overflow-hidden rounded-[14px] border border-[color:var(--theme-border)] bg-[#141414]/88 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-gold/10 transition hover:-translate-y-0.5 hover:ring-cyan-300/30"
    >
      <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-amber-100 ring-1 ring-amber-400/30">
        SOLD
      </span>

      {imageUrl ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onViewImage(item, imageUrl);
          }}
          className="block h-[162px] overflow-hidden rounded-[10px] bg-black/18"
          aria-label={`View image for ${item.title}`}
        >
          <div className="flex h-full items-center justify-center bg-[color:var(--theme-elevated)] p-1">
            <ProgressiveImage
              src={imageUrl}
              alt={item.title}
              className="h-full w-full"
              imageClassName="object-contain object-center"
              draggable={false}
            />
          </div>
        </button>
      ) : (
        <Link href={detailHref} className="block h-[162px] overflow-hidden rounded-[10px] bg-black/18">
          <div className="flex h-full items-center justify-center bg-[color:var(--theme-elevated)] p-1">
            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold text-[color:var(--muted)]">
              No image
            </div>
          </div>
        </Link>
      )}

      <Link href={detailHref} className="mt-2 min-w-0">
        <div className="line-clamp-1 text-[13px] font-extrabold leading-tight text-text-primary sm:text-[14px]">
          {item.title}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[10px] font-medium text-cyan-100/55">
          {UNIVERSE_LABEL[universe] ?? "Misc"} - {itemMeta(item)}
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-none text-text-primary">{money(item.soldPrice)}</div>
          <div className={profit >= 0 ? "mt-1 text-[10px] font-bold leading-none text-emerald-300" : "mt-1 text-[10px] font-bold leading-none text-red-300"}>
            {profit >= 0 ? "+" : ""}
            {money(profit)}
          </div>
          <div className="mt-1 text-[9px] font-semibold text-[color:var(--muted2)]">
            {new Date(item.soldAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "2-digit",
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onReturnToVault(item);
          }}
          className="shrink-0 rounded-full bg-gold/14 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100 ring-1 ring-cyan-300/25 transition hover:bg-gold/22"
        >
          Return
        </button>
      </div>
    </article>
  );
}

export default function SoldPage() {
  const [items, setItems] = useState<SoldItem[]>(() => buildSoldItems());
  const [status, setStatus] = useState("");
  const [imagePreview, setImagePreview] = useState<{ title: string; imageUrl: string } | null>(null);
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState("All");

  function load() {
    setItems(buildSoldItems());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncVaultItemsFromSupabase().finally(load);
    }, 0);
    window.addEventListener("vltd:vault-updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("vltd:vault-updated", load);
    };
  }, []);

  const stats = useMemo(() => soldStats(items), [items]);

  const universeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const item of items) {
      const u = inferSoldUniverse(item);
      if (u) seen.add(UNIVERSE_LABEL[u] ?? u);
    }
    return ["All", ...Array.from(seen).sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const u = inferSoldUniverse(item);
      const uLabel = UNIVERSE_LABEL[u] ?? u;
      if (universeFilter !== "All" && uLabel !== universeFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !uLabel.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, universeFilter]);

  async function handleReturnToVault(item: SoldItem) {
    const confirmed = window.confirm(`Return "${item.title}" to the Vault and remove its sold status?`);
    if (!confirmed) return;

    const existing = loadItems({ includeAllProfiles: true }).find((entry) => String(entry.id) === String(item.id));
    const restored: VaultItem = {
      ...(existing ?? (item as unknown as VaultItem)),
      id: item.id,
      title: item.title || existing?.title || "Restored item",
      status: "COLLECTION",
      soldPrice: undefined,
      soldAt: undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    saveItem(restored);
    removeSaleRecord(item.id);
    setItems((prev) => prev.filter((entry) => String(entry.id) !== String(item.id)));
    setStatus(`Returned ${restored.title} to Vault.`);

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase
        .from("vault_items")
        .update({
          status: "COLLECTION",
          sold_price: null,
          sold_at: null,
        })
        .eq("id", item.id);

      if (error) {
        setStatus(`${error.message} Returned locally only.`);
      }
    }

    enqueueVaultItemSync(restored.id);
    await processVaultSyncQueue();
    await syncVaultItemsFromSupabase();
    load();
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <section className="relative overflow-hidden rounded-[18px] border border-[color:var(--theme-border)] bg-[color:var(--theme-card)] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SOLD VAULT</div>
                <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:text-[1.9rem]">
                  Sold Items
                </h1>
                <div className="mt-1.5 text-sm text-[color:var(--muted)]">
                  Realized sales history using the same compact management layout as Vault.
                </div>
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
                <Link
                  href="/sales"
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                >
                  Sales History
                </Link>
                <Link
                  href="/vault"
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                >
                  Back to Vault
                </Link>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[14px] bg-[color:var(--theme-elevated)] px-3 py-2 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Sold</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{stats.count}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--theme-elevated)] px-3 py-2 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Revenue</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{money(stats.realizedRevenue)}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--theme-elevated)] px-3 py-2 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Cost Basis</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{money(stats.totalCost)}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--theme-elevated)] px-3 py-2 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Realized Profit</div>
                <div className={stats.totalProfit >= 0 ? "mt-1 text-lg font-extrabold leading-none text-emerald-300" : "mt-1 text-lg font-extrabold leading-none text-red-300"}>
                  {stats.totalProfit >= 0 ? "+" : ""}
                  {money(stats.totalProfit)}
                </div>
              </div>
            </div>

            <AnalyticsPanel items={items} />

            {status ? (
              <div className="rounded-[14px] bg-gold/10 px-3 py-2 text-sm text-cyan-100 ring-1 ring-cyan-300/20">
                {status}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-3">
          {/* Search + filter bar */}
          {items.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sold items…"
                className="h-9 flex-1 rounded-full px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none min-w-[140px]"
                style={{ background: "var(--pill)", color: "var(--fg)" }}
              />
              {universeOptions.length > 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {universeOptions.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUniverseFilter(u)}
                      className="h-9 rounded-full px-3 text-xs font-semibold ring-1 transition"
                      style={universeFilter === u
                        ? { background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d", borderColor: "transparent" }
                        : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {items.length === 0 ? (
            <div className="rounded-[18px] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              No sold items yet.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-[18px] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No items match your filter.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredItems.map((item) => (
                <SoldCard
                  key={item.id}
                  item={item}
                  onReturnToVault={(target) => void handleReturnToVault(target)}
                  onViewImage={(target, imageUrl) => setImagePreview({ title: target.title, imageUrl })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {imagePreview ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
          aria-label="Close image preview"
        >
          <span className="relative block max-h-[88vh] w-full max-w-4xl rounded-[24px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <span className="mb-3 flex items-center justify-between gap-3">
              <span className="line-clamp-1 text-left text-sm font-semibold text-text-primary">{imagePreview.title}</span>
              <span className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-[color:var(--border)]">
                Close
              </span>
            </span>
            <span className="block max-h-[78vh] overflow-hidden rounded-[18px] bg-[color:var(--theme-card)]">
              <ProgressiveImage
                src={imagePreview.imageUrl}
                alt={imagePreview.title}
                className="h-[78vh] w-full"
                imageClassName="object-contain object-center"
                draggable={false}
              />
            </span>
          </span>
        </button>
      ) : null}
    </main>
  );
}
