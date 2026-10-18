"use client";

import { WorkspaceActions } from "@/components/vault/VaultWorkspace";
import { PillButton } from "@/components/ui/PillButton";
import { useEffect, useMemo, useState } from "react";
import { useHashTarget } from "@/lib/useHashTarget";
import Link from "next/link";

import { MonthlyBars } from "@/components/ui/MonthlyBars";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { getStoredActiveProfileId } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { getPrimaryImageUrl, loadItems, saveItem, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { SALES_KEY, buildSoldItems, cost, hasKnownCost, profitOf, readSales, removeSaleRecord, saleFees, soldStats, writeSales, type SoldItem } from "@/lib/soldItems";


function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return `${n < 0 && Math.round(n) !== 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
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

// ─── Analytics helpers ────────────────────────────────────────────────────────

function groupByMonth(items: SoldItem[]) {
  const map = new Map<string, { revenue: number; profit: number; count: number; known: number }>();
  for (const item of items) {
    const d = new Date(Number(item.soldAt));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = map.get(key) ?? { revenue: 0, profit: 0, count: 0, known: 0 };
    prev.revenue += Number(item.soldPrice ?? 0);
    if (hasKnownCost(item)) { prev.profit += profitOf(item); prev.known += 1; }
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
    if (hasKnownCost(item)) prev.profit += profitOf(item);
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

// ─── Analytics panel ──────────────────────────────────────────────────────────

function AnalyticsPanel({ items }: { items: SoldItem[] }) {
  const monthly = groupByMonth(items);
  const byUniverse = groupByUniverse(items);
  const roiPct = items.length > 0
    ? (() => {
        // Only sales with a recorded cost: a sale with no cost is not "all profit".
        const known = items.filter(hasKnownCost);
        const net = known.reduce((s, i) => s + profitOf(i), 0);
        const c = known.reduce((s, i) => s + cost(i), 0);
        return c > 0 ? (net / c) * 100 : null;
      })()
    : null;
  const bestItem = [...items].filter(hasKnownCost).sort((a, b) => profitOf(b) - profitOf(a))[0];

  if (items.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {/* Monthly revenue chart */}
      <div className="min-w-0 rounded-[8px] p-3 ring-1 ring-[color:var(--theme-border)]" style={{ background: "var(--theme-elevated)" }}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
          Monthly Revenue
        </div>
        <MonthlyBars
          months={monthly.map(([key, v]) => ({ key, value: v.revenue }))}
          ariaLabel={"Revenue by month: " + monthly.map(([k, v]) => `${k} ${money(v.revenue)}`).join(", ")}
        />
        {monthly.length === 1 ? (
          <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>One month of sales so far.</div>
        ) : null}
      </div>

      {/* Monthly profit chart */}
      <div className="min-w-0 rounded-[8px] p-3 ring-1 ring-[color:var(--theme-border)]" style={{ background: "var(--theme-elevated)" }}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted2)" }}>
          Monthly Profit/Loss
        </div>
        <MonthlyBars
          signed
          months={monthly.map(([key, v]) => ({ key, value: v.known > 0 ? v.profit : null }))}
          ariaLabel={"Profit or loss by month: " + monthly.map(([k, v]) => `${k} ${v.known > 0 ? money(v.profit) : "no recorded cost"}`).join(", ")}
        />
        <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
          Profit is after estimated fees. Only sales with a recorded cost count.
        </div>
      </div>

      {/* By universe */}
      {byUniverse.length > 0 && (
        <div
          className="min-w-0 rounded-[8px] p-3 ring-1 ring-[color:var(--theme-border)]"
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
        className="min-w-0 rounded-[8px] p-3 ring-1 ring-[color:var(--theme-border)] flex flex-col gap-3"
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
              +{money(profitOf(bestItem))} profit
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="inline-flex min-w-0 items-baseline gap-2 rounded-[8px] px-3 py-1.5 ring-1 ring-[color:var(--theme-border)]" style={{ background: "var(--theme-elevated)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">{label}</span>
      <span
        className="text-[15px] font-extrabold leading-none vltd-keep-color"
        style={{ "--vltd-keep-color": tone === "gain" ? "var(--status-gain, #54C98A)" : tone === "loss" ? "var(--status-loss, #E05252)" : "var(--fg)" } as React.CSSProperties}
      >
        {value}
      </span>
    </div>
  );
}

// The same compact card the Vault uses (brushed surface, status badge top-left, title and subtitle styles), with the sale on the bottom row.
function SoldCard({
  item,
  onReturnToVault,
  onViewImage,
}: {
  item: SoldItem;
  onReturnToVault: (item: SoldItem) => void;
  onViewImage: (item: SoldItem, imageUrl: string) => void;
}) {
  const profit = profitOf(item);
  const fees = saleFees(item);
  const universe = inferSoldUniverse(item);
  const detailHref = `/vault/item/${item.id}?sold=1`;
  const imageUrl = getPrimaryImageUrl(item as unknown as VaultItem) || item.imageFrontUrl || "";
  const imageBox = "relative block h-[150px] w-full overflow-hidden rounded-[8px] bg-black/24 vltd-dark-surface";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[4px] vltd-brushed p-3 transition hover:-translate-y-0.5">
      <span className="absolute left-2 top-2 z-10 rounded-full bg-amber-500/18 px-1.5 py-0.5 text-[8px] font-semibold text-amber-100 ring-1 ring-amber-400/30">
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
          className={imageBox}
          aria-label={`View image for ${item.title}`}
        >
          <ProgressiveImage src={imageUrl} alt={item.title} className="h-full w-full" imageClassName="object-contain object-center" draggable={false} />
        </button>
      ) : (
        <Link href={detailHref} className={imageBox} aria-label={`Open ${item.title}`}>
          <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">No image</span>
        </Link>
      )}

      <Link href={detailHref} className="mt-3 min-w-0">
        <div className="line-clamp-1 text-[15px] font-semibold leading-tight vltd-keep-color" style={{ "--vltd-keep-color": "var(--vault-title-color)" } as React.CSSProperties}>
          {item.title}
        </div>
        <div className="mt-1 line-clamp-1 text-[11px] font-semibold vltd-keep-color" style={{ "--vltd-keep-color": "var(--data-color)" } as React.CSSProperties}>
          {UNIVERSE_LABEL[universe] ?? "Misc"} · {itemMeta(item)}
        </div>
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2 gap-y-2">
        <div className="min-w-0">
          <div className="text-[18px] font-semibold leading-none text-[color:var(--fg)]">{money(item.soldPrice)}</div>
          {hasKnownCost(item) ? (
            <div
              className="mt-1 text-[11px] font-semibold leading-none vltd-keep-color"
              style={{ "--vltd-keep-color": profit >= 0 ? "var(--status-gain, #54C98A)" : "var(--status-loss, #E05252)" } as React.CSSProperties}
            >
              {profit >= 0 ? "+" : ""}
              {money(profit)} profit
            </div>
          ) : (
            <div className="mt-1 text-[11px] font-semibold leading-none text-[color:var(--muted2)]" title="No purchase price is recorded for this item, so its profit is unknown.">
              Profit unknown (no cost)
            </div>
          )}
          <div
            className="mt-1 truncate text-[10px] font-semibold text-[color:var(--muted2)]"
            title={fees > 0 ? `Profit is after about ${money(fees)} in ${item.soldPlatform} seller fees (estimate from current fee tables)` : undefined}
          >
            {new Date(item.soldAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
            {fees > 0 && ` · ${money(fees)} fees`}
          </div>
        </div>

        <PillButton
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onReturnToVault(item);
          }}
        >
          Return
        </PillButton>
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
  // Until the account has been read once, an empty list means "not loaded yet", not "nothing sold".
  const [hydrated, setHydrated] = useState(false);

  function load() {
    setItems(buildSoldItems());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncVaultItemsFromSupabase().finally(() => {
        load();
        setHydrated(true);
      });
    }, 0);
    window.addEventListener("vltd:vault-updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("vltd:vault-updated", load);
    };
  }, []);

  const stats = useMemo(() => soldStats(items), [items]);
  useHashTarget(hydrated);

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
    <>
    <WorkspaceActions><PillButton href="/sales">Sales History</PillButton></WorkspaceActions>
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1480px] px-4 pb-4 sm:px-6 lg:px-8">
        <section id="sales-analytics" className="flex flex-col gap-3">
          {/* Compact summary: content-sized chips, not four stretched tiles */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <SummaryChip label="Sold" value={String(stats.count)} />
            <SummaryChip label="Revenue" value={money(stats.realizedRevenue)} />
            <SummaryChip label="Cost basis" value={money(stats.totalCost)} />
            <SummaryChip label="Realized profit" value={(stats.totalProfit >= 0 ? "+" : "") + money(stats.totalProfit)} tone={stats.totalProfit >= 0 ? "gain" : "loss"} />
          </div>

          <AnalyticsPanel items={items} />

          {status ? (
            <div className="rounded-[8px] bg-gold/10 px-3 py-2 text-sm text-cyan-100 ring-1 ring-cyan-300/20">
              {status}
            </div>
          ) : null}
        </section>

        <section className="mt-3">
          {/* Search + filter bar */}
          {items.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                aria-label="Search sold items"
                className="h-11 w-full rounded-[8px] bg-[color:var(--input)] px-3 text-[13px] ring-1 ring-[color:var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] sm:w-[180px] md:h-9"
                style={{ borderColor: "var(--theme-border)" }}
              />
              {universeOptions.length > 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {universeOptions.map((u) => (
                    <PillButton key={u} variant={universeFilter === u ? "active" : "default"} onClick={() => setUniverseFilter(u)}>{u}</PillButton>
                  ))}
                </div>
              )}
            </div>
          )}
          {items.length === 0 ? (
            <div className="rounded-[18px] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              {hydrated ? "No sold items yet." : <span role="status">Loading sold items…</span>}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-[18px] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No items match your filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
              <span className="rounded-[7px] bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-[color:var(--border)]">
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
    </>
  );
}
