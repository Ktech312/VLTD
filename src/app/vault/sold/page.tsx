"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SALES_KEY = "vltd_sales_history";

function totalCost(item: any) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function getSalePrice(item: any) {
  return Number(item.soldPrice ?? item.salePrice ?? 0);
}

export default function SoldPage() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<
    "recent" | "profit_desc" | "profit_asc" | "az"
  >("recent");

  useEffect(() => {
    const raw = localStorage.getItem(SALES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    setItems(parsed);
  }, []);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const cost = totalCost(item);
      const soldPrice = getSalePrice(item);
      const profit = soldPrice - cost;

      return {
        ...item,
        soldPrice,
        cost,
        profit,
      };
    });
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    return enriched.filter((item) => {
      return (
        item.title?.toLowerCase().includes(q) ||
        item.categoryLabel?.toLowerCase().includes(q)
      );
    });
  }, [enriched, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];

    if (sortMode === "recent") {
      return list.sort((a, b) => b.soldAt - a.soldAt);
    }

    if (sortMode === "profit_desc") {
      return list.sort((a, b) => b.profit - a.profit);
    }

    if (sortMode === "profit_asc") {
      return list.sort((a, b) => a.profit - b.profit);
    }

    if (sortMode === "az") {
      return list.sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "")
      );
    }

    return list;
  }, [filtered, sortMode]);

  const totalProfit = useMemo(() => {
    return enriched.reduce((sum, i) => sum + i.profit, 0);
  }, [enriched]);

  function handleUnsell(index: number) {
    const raw = localStorage.getItem(SALES_KEY);
    const sales = raw ? JSON.parse(raw) : [];

    const item = sales[index];
    if (!item) return;

    const nextSales = sales.filter((_: any, i: number) => i !== index);
    localStorage.setItem(SALES_KEY, JSON.stringify(nextSales));

    const vaultRaw = localStorage.getItem("vltd_vault_items_v1");
    const vault = vaultRaw ? JSON.parse(vaultRaw) : [];

    vault.push({
      ...item,
      soldPrice: undefined,
      salePrice: undefined,
      soldAt: undefined,
    });

    localStorage.setItem("vltd_vault_items_v1", JSON.stringify(vault));

    setItems(nextSales);
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)] px-6 py-6">
      <div className="max-w-5xl mx-auto">

        <h1 className="text-2xl font-semibold mb-2">Sold Items</h1>

        <div className="mb-4 text-sm text-[color:var(--muted)]">
          Total Realized Profit: {" "}
          <span className="font-semibold text-[color:var(--fg)]">
            ${totalProfit.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sold items..."
            className="flex-1 min-h-[42px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
          />

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="min-h-[42px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
          >
            <option value="recent">Most Recent</option>
            <option value="profit_desc">Profit ↓</option>
            <option value="profit_asc">Profit ↑</option>
            <option value="az">A → Z</option>
          </select>

        </div>

        {sorted.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">
            No sold items yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-xl bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]"
              >

                <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                  {item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center text-xs text-[color:var(--muted)] h-full">
                      No Img
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={`/vault/item/${item.id}`}>
                    <div className="font-semibold truncate hover:underline">
                      {item.title}
                    </div>
                  </Link>

                  <div className="text-sm text-[color:var(--muted)]">
                    Sold: ${item.soldPrice.toLocaleString()}
                  </div>

                  <div
                    className={`text-sm ${
                      item.profit >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {item.profit >= 0 ? "+" : ""}
                    ${item.profit.toLocaleString()}
                  </div>

                  <div className="text-xs text-[color:var(--muted)]">
                    {new Date(item.soldAt).toLocaleDateString()}
                  </div>
                </div>

                <button
                  onClick={() => handleUnsell(index)}
                  className="rounded-full px-3 py-1 text-xs bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
                >
                  Return
                </button>

              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
