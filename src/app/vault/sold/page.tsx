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

export default function SoldPage() {
  const [items, setItems] = useState<any[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "profit_desc">("recent");

  useEffect(() => {
    const raw = localStorage.getItem(SALES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    setItems(parsed);
  }, []);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const cost = totalCost(item);
      const profit = Number(item.salePrice ?? 0) - cost;

      return {
        ...item,
        cost,
        profit,
      };
    });
  }, [items]);

  const sorted = useMemo(() => {
    const list = [...enriched];

    if (sortMode === "recent") {
      return list.sort((a, b) => b.soldAt - a.soldAt);
    }

    return list.sort((a, b) => b.profit - a.profit);
  }, [enriched, sortMode]);

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
      salePrice: undefined,
      soldAt: undefined,
    });

    localStorage.setItem("vltd_vault_items_v1", JSON.stringify(vault));

    setItems(nextSales);
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  return (
    <main className="min-h-screen p-6 text-white">
      <h1 className="text-2xl font-semibold mb-2">Sold Items</h1>

      <div className="mb-4 text-sm opacity-80">
        Total Realized Profit:{" "}
        <span className="font-semibold">
          ${totalProfit.toLocaleString()}
        </span>
      </div>

      <div className="mb-6">
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as any)}
          className="rounded px-3 py-2 text-black"
        >
          <option value="recent">Most Recent</option>
          <option value="profit_desc">Highest Profit</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div>No sold items yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((item, index) => (
            <div key={index} className="rounded-xl border p-4">
              
              {/* CLICKABLE */}
              <Link href={`/vault/item/${item.id}`}>
                <div className="font-semibold hover:underline">
                  {item.title}
                </div>
              </Link>

              <div className="text-sm mt-1">
                Sold: ${item.salePrice}
              </div>

              <div
                className={`text-sm mt-1 ${
                  item.profit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {item.profit >= 0 ? "+" : ""}
                ${item.profit}
              </div>

              <div className="text-xs mt-2 opacity-70">
                {new Date(item.soldAt).toLocaleString()}
              </div>

              <button
                onClick={() => handleUnsell(index)}
                className="mt-4 w-full rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold hover:bg-blue-400"
              >
                Return to Vault
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}