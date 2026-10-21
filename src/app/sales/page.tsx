"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSales, type SaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, getPrimaryImageUrl, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";
import { buildSoldItems, saleOutcome, type SoldItem } from "@/lib/soldItems";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "—" only for an amount that is not known; an explicit $0 is shown as $0. */
function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

/**
 * One row of the history. The Sold page, Home and this page all read the same sale from the item itself (src/lib/soldItems.ts), so
 * revenue, cost, fees and profit agree. Older ledger rows that belong to no item in the Vault are listed too.
 */
type SalesRow = { key: string; itemId: string; item: SoldItem; revenueKnown: boolean; ledgerOnly: boolean };

function buildRows(): SalesRow[] {
  const sold = buildSoldItems();
  const soldIds = new Set(sold.map((x) => String(x.id)));
  const known = new Set(loadItems({ includeAllProfiles: true }).map((i) => String(i.id)));
  const rows: SalesRow[] = sold.map((x) => ({ key: String(x.id), itemId: String(x.id), item: x, revenueKnown: true, ledgerOnly: false }));
  for (const r of loadSales()) {
    const ref = String(r.itemId || r.id);
    // A ledger row for an item that is in the Vault is that item's own sale (listed above) or a stale copy of one that was returned.
    if (soldIds.has(ref) || known.has(ref)) continue;
    rows.push({
      key: r.id,
      itemId: String(r.itemId || r.id),
      revenueKnown: typeof r.salePrice === "number" && Number.isFinite(r.salePrice),
      ledgerOnly: true,
      item: { id: r.id, title: r.title ?? "Untitled", universe: r.universe, categoryLabel: r.categoryLabel, purchasePrice: r.purchasePrice, soldPrice: Number(r.salePrice ?? 0), soldAt: r.soldAt, soldPlatform: r.platform },
    });
  }
  return rows.sort((a, b) => Number(b.item.soldAt) - Number(a.item.soldAt));
}

/** Profit after the acquisition cost and estimated seller fees, or null when it cannot be known (no recorded cost, or no recorded sale price). */
function profit(r: SalesRow): number | null {
  if (!r.revenueKnown) return null;
  return saleOutcome(r.item).profit;
}

function margin(r: SalesRow): string | null {
  if (!r.revenueKnown) return null;
  const m = saleOutcome(r.item).margin;
  return m === null ? null : m.toFixed(0);
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type SortKey = "date" | "profit" | "sale";

// ─── Mini bar sparkline ───────────────────────────────────────────────────────

function groupByMonth(sales: SalesRow[]) {
  const map = new Map<string, number>();
  for (const s of sales) {
    const d = new Date(s.item.soldAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + (s.revenueKnown ? Number(s.item.soldPrice ?? 0) : 0));
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
}

function MiniSparkline({ sales }: { sales: SalesRow[] }) {
  const monthly = groupByMonth(sales);
  if (monthly.length < 2) return null;
  const values = monthly.map((m) => m[1]);
  const max = Math.max(...values, 1);
  const h = 36;
  const w = 100 / values.length;
  return (
    <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--muted)" }}>
        Revenue — last {monthly.length}mo
      </div>
      <svg viewBox={`0 0 100 ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }}>
        {values.map((v, i) => {
          const barH = Math.max(2, (v / max) * h);
          return (
            <rect key={i} x={i * w + 0.5} y={h - barH} width={w - 1} height={barH}
              fill="var(--theme-gold)" opacity={v > 0 ? 0.85 : 0.15} rx="2" />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9px]" style={{ color: "var(--muted)" }}>
        <span>{monthly[0]?.[0]}</span>
        <span>{monthly[monthly.length - 1]?.[0]}</span>
      </div>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-2xl font-black tabular-nums" style={{ color: accent ? "var(--theme-gold)" : "var(--fg)" }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

// ─── Sale card ────────────────────────────────────────────────────────────────

function SaleCard({ row, imageUrl }: { row: SalesRow; imageUrl?: string }) {
  const outcome = saleOutcome(row.item);
  const p = profit(row);
  const m = margin(row);
  const isProfit = p !== null && p > 0;
  const isLoss = p !== null && p < 0;
  const itemHref = `/vault/item/${row.itemId}`;
  const sale = { title: row.item.title, universe: row.item.universe, categoryLabel: row.item.categoryLabel, soldAt: Number(row.item.soldAt) };

  return (
    <div className="rounded-2xl ring-1 ring-[color:var(--border)] overflow-hidden transition hover:ring-[color:var(--theme-gold-border)]"
      style={{ background: "var(--surface)" }}>
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <Link href={itemHref} className="shrink-0 block w-[72px] bg-black/20">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={sale.title ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--pill)" }}>
              <Glyph name="tag" size={22} />
            </div>
          )}
        </Link>

        <div className="flex flex-1 min-w-0 flex-col justify-between gap-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={itemHref} className="block truncate font-semibold text-sm hover:underline max-md:-my-3 max-md:py-3" style={{ color: "var(--fg)" }}>
                {sale.title ?? "Untitled"}
              </Link>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[11px]" style={{ color: "var(--muted)" }}>
                {sale.universe && <span>{sale.universe}</span>}
                {sale.categoryLabel && sale.categoryLabel !== sale.universe && (
                  <><span>·</span><span>{sale.categoryLabel}</span></>
                )}
                <span>·</span>
                <span>{fmtDate(sale.soldAt)}</span>
              </div>
            </div>
            {/* P&L badge */}
            <div
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums"
              style={{
                background: isProfit ? "rgba(74,222,128,0.12)" : isLoss ? "rgba(239,68,68,0.12)" : "var(--pill)",
                color: isProfit ? "#4ade80" : isLoss ? "#ef4444" : "var(--muted)",
              }}
            >
              {p === null ? "Profit unknown" : `${isProfit ? "+" : ""}${fmtMoney(p)}`}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
            <span>Cost <span className="font-semibold" style={{ color: "var(--fg)" }}>{fmtMoney(outcome.cost)}</span></span>
            <span>Sold <span className="font-semibold" style={{ color: "var(--fg)" }}>{row.revenueKnown ? fmtMoney(outcome.revenue) : "—"}</span></span>
            {outcome.fees > 0 && row.revenueKnown ? <span>Est. fees <span className="font-semibold" style={{ color: "var(--fg)" }}>{fmtMoney(outcome.fees)}</span></span> : null}
            {m !== null && (
              <span>
                Margin{" "}
                <span className="font-semibold" style={{ color: Number(m) >= 0 ? "#4ade80" : "#ef4444" }}>
                  {Number(m) >= 0 ? "+" : ""}{m}%
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, VaultItem>>(new Map());
  const [sort, setSort] = useState<SortKey>("date");
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState("All");
  // Sales recorded from the Vault, For Sale and Sold pages live on the Sold page, not in this older list.
  const [soldOnSoldPage, setSoldOnSoldPage] = useState(0);

  useEffect(() => {
    const countSold = () => setSoldOnSoldPage(buildSoldItems().length);
    countSold();
    // In a browser that has not loaded the Vault yet the sold items are not here until the cloud copy arrives.
    void syncVaultItemsFromSupabase().then(() => countSold()).catch(() => undefined);
    window.addEventListener("vltd:vault-updated", countSold);
    setSales(buildRows());
    const items = loadItems({ includeAllProfiles: true });
    const map = new Map<string, VaultItem>();
    for (const item of items) map.set(item.id, item);
    setItemMap(map);
    let active = true;
    const refresh = () => { if (active) setSales(buildRows()); };
    void syncSalesFromSupabase().then(refresh);
    void syncVaultItemsFromSupabase().then(refresh).catch(() => undefined);
    window.addEventListener("vltd:vault-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("vltd:vault-updated", countSold);
    };
  }, []);

  // Totals count only what is known: a sale with no recorded cost has an unknown profit (left out of the P&L, wins and losses, and said so),
  // never a profit equal to its price.
  const stats = useMemo(() => {
    const totalSold = sales.reduce((sum, s) => sum + (s.revenueKnown ? Number(s.item.soldPrice ?? 0) : 0), 0);
    let totalCost = 0, totalProfit = 0, known = 0, costForMargin = 0, wins = 0, losses = 0;
    for (const s of sales) {
      const p = profit(s);
      if (p === null) continue;
      const o = saleOutcome(s.item);
      known += 1;
      totalCost += o.cost ?? 0;
      totalProfit += p;
      if ((o.cost ?? 0) > 0) costForMargin += o.cost ?? 0;
      if (p > 0) wins += 1;
      if (p < 0) losses += 1;
    }
    const avgMargin = costForMargin > 0 ? ((totalProfit / costForMargin) * 100).toFixed(0) : null;
    return { totalSold, totalCost, totalProfit, avgMargin, wins, losses, known, unknown: sales.length - known };
  }, [sales]);

  // Universe options for filter
  const universes = useMemo(() => {
    const seen = new Set<string>();
    for (const s of sales) {
      const u = s.item.universe || s.item.categoryLabel;
      if (u) seen.add(u);
    }
    return ["All", ...Array.from(seen).sort()];
  }, [sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = [...sales];
    if (q) {
      result = result.filter(
        (s) =>
          (s.item.title ?? "").toLowerCase().includes(q) ||
          (s.item.universe ?? "").toLowerCase().includes(q) ||
          (s.item.categoryLabel ?? "").toLowerCase().includes(q)
      );
    }
    if (universeFilter !== "All") {
      result = result.filter((s) => s.item.universe === universeFilter || s.item.categoryLabel === universeFilter);
    }
    if (sort === "date") result.sort((a, b) => Number(b.item.soldAt) - Number(a.item.soldAt));
    else if (sort === "profit") result.sort((a, b) => (profit(b) ?? Number.NEGATIVE_INFINITY) - (profit(a) ?? Number.NEGATIVE_INFINITY));
    else if (sort === "sale") result.sort((a, b) => Number(b.item.soldPrice ?? 0) - Number(a.item.soldPrice ?? 0));
    return result;
  }, [sales, sort, search, universeFilter]);

  return (
    <main className="" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--muted)" }}>
              <Link href="/vault" className="hover:underline vltd-tap-y">Vault</Link>
              <span>/</span>
              <Link href="/vault/sold" className="hover:underline vltd-tap-y">Sold Items</Link>
              <span>/</span>
              <span>Sales History</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Sales History</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Every recorded sale, profit, and margin.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/vault/sold" className="inline-flex h-11 md:h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}>
              Sold Items
            </Link>
            <Link href="/vault" className="inline-flex h-11 md:h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}>
              ← Vault
            </Link>
          </div>
        </div>

        {/* Stats */}
        {sales.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatPill label="Total Sold" value={fmtMoney(stats.totalSold)} sub={`${sales.length} sale${sales.length !== 1 ? "s" : ""}`} />
              <StatPill
                label="Total P&L"
                value={(stats.totalProfit >= 0 ? "+" : "") + fmtMoney(stats.totalProfit)}
                sub={[stats.avgMargin !== null ? `${stats.avgMargin}% avg margin` : "", stats.unknown > 0 ? `${stats.unknown} with unknown cost not counted` : ""].filter(Boolean).join(" · ") || undefined}
                accent={stats.totalProfit > 0}
              />
              <StatPill label="Wins" value={String(stats.wins)} sub="Profitable sales" />
              <StatPill label="Losses" value={String(stats.losses)} sub="Below cost" />
            </div>
            <div className="mb-4">
              <MiniSparkline sales={sales} />
            </div>
          </>
        )}

        {/* Controls */}
        {sales.length > 0 && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sales…"
              className="h-11 md:h-9 max-sm:flex-none sm:flex-1 rounded-full px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none min-w-[140px]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}
            />
            <div className="flex flex-wrap gap-1.5">
              {/* Sort buttons */}
              {(["date", "profit", "sale"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className="h-11 md:h-9 rounded-full px-3 text-[11px] font-semibold capitalize ring-1 transition"
                  style={sort === key
                    ? { background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d", borderColor: "transparent" }
                    : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }
                  }
                >
                  {key === "date" ? "Date" : key === "profit" ? "Profit" : "Sale Price"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category filter pills */}
        {universes.length > 2 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {universes.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUniverseFilter(u)}
                className="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition max-md:min-h-11"
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

        {/* Empty state */}
        {sales.length === 0 && (
          <div className="rounded-2xl p-10 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="mb-3 flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="tag" size={40} /></div>
            <h2 className="text-lg font-semibold mb-1">{soldOnSoldPage > 0 ? "Your sales are on the Sold page" : "No sales yet"}</h2>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>{soldOnSoldPage > 0 ? `${soldOnSoldPage} sold ${soldOnSoldPage === 1 ? "item" : "items"}, with revenue, profit and analytics, are listed there.` : "Mark vault items as sold to start tracking your P&L here."}</p>
            <Link href={soldOnSoldPage > 0 ? "/vault/sold" : "/vault"} className="inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}>
              {soldOnSoldPage > 0 ? "Open Sold" : "Go to Vault"}
            </Link>
          </div>
        )}

        {/* Sale cards */}
        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((s) => {
              const vaultItem = itemMap.get(s.itemId);
              const imageUrl = vaultItem ? getPrimaryImageUrl(vaultItem) || undefined : undefined;
              return <SaleCard key={s.key} row={s} imageUrl={imageUrl} />;
            })}
          </div>
        )}

        {filtered.length === 0 && sales.length > 0 && (
          <div className="rounded-2xl p-8 text-center ring-1 ring-[color:var(--border)] text-sm" style={{ background: "var(--surface)", color: "var(--muted)" }}>
            No sales match your filter.
          </div>
        )}

      </div>
    </main>
  );
}
