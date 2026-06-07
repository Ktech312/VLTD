"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadSales, type SaleRecord } from "@/lib/salesHistory";

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

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{label}</div>
      <div className="text-2xl font-black tabular-nums text-[color:var(--fg)]">{value}</div>
      {sub && <div className="text-[11px] text-[color:var(--muted)]">{sub}</div>}
    </div>
  );
}

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [sort, setSort] = useState<SortKey>("date");
  const [search, setSearch] = useState("");

  useEffect(() => { setSales(loadSales()); }, []);

  const stats = useMemo(() => {
    const totalSold = sales.reduce((sum, s) => sum + Number(s.salePrice ?? 0), 0);
    const totalCost = sales.reduce((sum, s) => sum + Number(s.purchasePrice ?? 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + profit(s), 0);
    const avgMargin = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(0) : null;
    const wins = sales.filter((s) => profit(s) > 0).length;
    const losses = sales.filter((s) => profit(s) < 0).length;
    return { totalSold, totalCost, totalProfit, avgMargin, wins, losses };
  }, [sales]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? sales.filter((s) =>
          (s.title ?? "").toLowerCase().includes(q) ||
          (s.universe ?? "").toLowerCase().includes(q)
        )
      : [...sales];
    if (sort === "date") result.sort((a, b) => b.soldAt - a.soldAt);
    else if (sort === "profit") result.sort((a, b) => profit(b) - profit(a));
    else if (sort === "sale") result.sort((a, b) => Number(b.salePrice ?? 0) - Number(a.salePrice ?? 0));
    return result;
  }, [sales, sort, search]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-[color:var(--muted2)]">
              <Link href="/vault" className="hover:underline">Vault</Link>
              <span>/</span>
              <span>Sales</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Sales History</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Every recorded sale, profit, and margin.</p>
          </div>
          <Link
            href="/vault"
            className="inline-flex h-9 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]"
          >
            ← Vault
          </Link>
        </div>

        {/* Stats bar */}
        {sales.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatPill label="Total Sold" value={fmtMoney(stats.totalSold)} sub={`${sales.length} sale${sales.length !== 1 ? "s" : ""}`} />
            <StatPill
              label="Total P&L"
              value={(stats.totalProfit >= 0 ? "+" : "") + fmtMoney(stats.totalProfit)}
              sub={stats.avgMargin !== null ? `${stats.avgMargin}% avg margin` : undefined}
            />
            <StatPill label="Wins" value={String(stats.wins)} sub="Profitable sales" />
            <StatPill label="Losses" value={String(stats.losses)} sub="Sold below cost" />
          </div>
        )}

        {/* Controls */}
        {sales.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 flex-1 rounded-full bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none min-w-[140px]"
            />
            <div className="flex gap-1.5">
              {(["date", "profit", "sale"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className="h-9 rounded-full px-3 text-[11px] font-semibold capitalize ring-1 transition"
                  style={sort === key
                    ? { background: "var(--theme-gold, #F5B548)", color: "#0B0B0B", border: "none" }
                    : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }
                  }
                >
                  {key === "date" ? "Date" : key === "profit" ? "Profit" : "Sale Price"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sales.length === 0 && (
          <div className="rounded-2xl bg-[color:var(--surface)] p-10 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-4xl mb-3">🏷️</div>
            <h2 className="text-lg font-semibold mb-1">No sales yet</h2>
            <p className="text-sm text-[color:var(--muted)] mb-5">Mark vault items as sold to start tracking your P&L here.</p>
            <Link href="/vault" className="inline-flex items-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
              Go to Vault
            </Link>
          </div>
        )}

        {/* Sale cards */}
        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((s) => {
              const p = profit(s);
              const m = margin(s);
              const isProfit = p > 0;
              const isLoss = p < 0;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{s.title ?? "Untitled"}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
                        {s.universe && <span>{s.universe}</span>}
                        <span>{fmtDate(s.soldAt)}</span>
                      </div>
                    </div>
                    {/* P&L badge */}
                    <div
                      className="shrink-0 rounded-full px-3 py-1 text-sm font-black tabular-nums"
                      style={{
                        background: isProfit
                          ? "rgba(74,222,128,0.12)"
                          : isLoss
                            ? "rgba(239,68,68,0.12)"
                            : "var(--pill)",
                        color: isProfit ? "#4ade80" : isLoss ? "#ef4444" : "var(--muted)",
                      }}
                    >
                      {isProfit ? "+" : ""}{fmtMoney(p)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[color:var(--muted)]">
                    <span>Bought <span className="font-semibold text-[color:var(--fg)]">{fmtMoney(s.purchasePrice)}</span></span>
                    <span>Sold <span className="font-semibold text-[color:var(--fg)]">{fmtMoney(s.salePrice)}</span></span>
                    {m !== null && (
                      <span>
                        Margin{" "}
                        <span
                          className="font-semibold"
                          style={{ color: Number(m) >= 0 ? "#4ade80" : "#ef4444" }}
                        >
                          {Number(m) >= 0 ? "+" : ""}{m}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && sales.length > 0 && (
          <div className="rounded-2xl bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] text-sm text-[color:var(--muted)]">
            No sales match &ldquo;{search}&rdquo;.
          </div>
        )}

      </div>
    </main>
  );
}
