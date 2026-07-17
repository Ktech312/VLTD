"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSales, type SaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { Glyph } from "@/components/ui/Glyph";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number | undefined) {
  const v = Number(n ?? 0);
  if (!v) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function profit(s: SaleRecord) {
  return Number(s.salePrice ?? 0) - Number(s.purchasePrice ?? 0);
}

function margin(s: SaleRecord) {
  const cost = Number(s.purchasePrice ?? 0);
  if (!cost) return null;
  return ((profit(s) / cost) * 100).toFixed(0);
}

type SortKey = "date" | "profit" | "sale";

// ─── Mini bar sparkline ───────────────────────────────────────────────────────

function groupByMonth(sales: SaleRecord[]) {
  const map = new Map<string, number>();
  for (const s of sales) {
    const d = new Date(s.soldAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + Number(s.salePrice ?? 0));
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
}

function MiniSparkline({ sales }: { sales: SaleRecord[] }) {
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

function SaleCard({ sale, imageUrl }: { sale: SaleRecord; imageUrl?: string }) {
  const p = profit(sale);
  const m = margin(sale);
  const isProfit = p > 0;
  const isLoss = p < 0;
  const itemHref = `/vault/item/${sale.itemId || sale.id}`;

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
            <div className="flex h-full w-full items-center justify-center text-xl" style={{ background: "var(--pill)" }}>
              🏷️
            </div>
          )}
        </Link>

        <div className="flex flex-1 min-w-0 flex-col justify-between gap-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={itemHref} className="block truncate font-semibold text-sm hover:underline" style={{ color: "var(--fg)" }}>
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
              {isProfit ? "+" : ""}{fmtMoney(p)}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
            <span>Bought <span className="font-semibold" style={{ color: "var(--fg)" }}>{fmtMoney(sale.purchasePrice)}</span></span>
            <span>Sold <span className="font-semibold" style={{ color: "var(--fg)" }}>{fmtMoney(sale.salePrice)}</span></span>
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
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, VaultItem>>(new Map());
  const [sort, setSort] = useState<SortKey>("date");
  const [search, setSearch] = useState("");
  const [universeFilter, setUniverseFilter] = useState("All");

  useEffect(() => {
    const records = loadSales();
    setSales(records);
    const items = loadItems({ includeAllProfiles: true });
    const map = new Map<string, VaultItem>();
    for (const item of items) map.set(item.id, item);
    setItemMap(map);
    let active = true;
    void syncSalesFromSupabase().then(() => {
      if (active) setSales(loadSales());
    });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalSold = sales.reduce((sum, s) => sum + Number(s.salePrice ?? 0), 0);
    const totalCost = sales.reduce((sum, s) => sum + Number(s.purchasePrice ?? 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + profit(s), 0);
    const avgMargin = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(0) : null;
    const wins = sales.filter((s) => profit(s) > 0).length;
    const losses = sales.filter((s) => profit(s) < 0).length;
    return { totalSold, totalCost, totalProfit, avgMargin, wins, losses };
  }, [sales]);

  // Universe options for filter
  const universes = useMemo(() => {
    const seen = new Set<string>();
    for (const s of sales) {
      const u = s.universe || s.categoryLabel;
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
          (s.title ?? "").toLowerCase().includes(q) ||
          (s.universe ?? "").toLowerCase().includes(q) ||
          (s.categoryLabel ?? "").toLowerCase().includes(q)
      );
    }
    if (universeFilter !== "All") {
      result = result.filter((s) => s.universe === universeFilter || s.categoryLabel === universeFilter);
    }
    if (sort === "date") result.sort((a, b) => b.soldAt - a.soldAt);
    else if (sort === "profit") result.sort((a, b) => profit(b) - profit(a));
    else if (sort === "sale") result.sort((a, b) => Number(b.salePrice ?? 0) - Number(a.salePrice ?? 0));
    return result;
  }, [sales, sort, search, universeFilter]);

  return (
    <main className="" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--muted)" }}>
              <Link href="/vault" className="hover:underline">Vault</Link>
              <span>/</span>
              <Link href="/vault/sold" className="hover:underline">Sold Items</Link>
              <span>/</span>
              <span>Sales History</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Sales History</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Every recorded sale, profit, and margin.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/vault/sold" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}>
              Sold Items
            </Link>
            <Link href="/vault" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]"
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
                sub={stats.avgMargin !== null ? `${stats.avgMargin}% avg margin` : undefined}
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
              className="h-9 flex-1 rounded-full px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none min-w-[140px]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}
            />
            <div className="flex flex-wrap gap-1.5">
              {/* Sort buttons */}
              {(["date", "profit", "sale"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className="h-9 rounded-full px-3 text-[11px] font-semibold capitalize ring-1 transition"
                  style={sort === key
                    ? { background: "var(--theme-gold)", color: "#0B0B0B", borderColor: "transparent" }
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
                className="rounded-full px-3 py-1 text-xs font-semibold ring-1 transition"
                style={universeFilter === u
                  ? { background: "var(--theme-gold)", color: "#0B0B0B", borderColor: "transparent" }
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
            <h2 className="text-lg font-semibold mb-1">No sales yet</h2>
            <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>Mark vault items as sold to start tracking your P&L here.</p>
            <Link href="/vault" className="inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)" }}>
              Go to Vault
            </Link>
          </div>
        )}

        {/* Sale cards */}
        {filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((s) => {
              const vaultItem = itemMap.get(s.itemId || s.id);
              const imageUrl = vaultItem ? getPrimaryImageUrl(vaultItem) || undefined : undefined;
              return <SaleCard key={s.id} sale={s} imageUrl={imageUrl} />;
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
