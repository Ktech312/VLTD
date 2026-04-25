"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SALES_KEY = "vltd_sales_history";

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function cost(item: any) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

export default function SoldPage() {
  const [items, setItems] = useState<any[]>([]);

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
      setItems(data);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    window.addEventListener("vltd:vault-updated", load);
    return () => window.removeEventListener("vltd:vault-updated", load);
  }, []);

  const totalProfit = useMemo(() => {
    return items.reduce((sum, i) => {
      return sum + (Number(i.soldPrice ?? 0) - cost(i));
    }, 0);
  }, [items]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-5xl px-4 py-8">

        <h1 className="text-2xl font-semibold">Sold Items</h1>
        <div className="mt-2 text-sm text-[color:var(--muted)]">
          Total Realized Profit: {money(totalProfit)}
        </div>

        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const profit = Number(item.soldPrice ?? 0) - cost(item);

            return (
              <Link
                key={item.id}
                href={`/vault/item/${item.id}?sold=1`}
                className="flex items-center gap-4 rounded-xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]"
              >
                {item.imageFrontUrl && (
                  <img
                    src={item.imageFrontUrl}
                    className="h-16 w-16 rounded object-cover"
                  />
                )}

                <div className="flex-1">
                  <div className="font-semibold">{item.title}</div>

                  <div className="text-sm text-[color:var(--muted)]">
                    Sold: {money(item.soldPrice)}
                  </div>

                  <div
                    className={`text-sm ${
                      profit >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {profit >= 0 ? "+" : ""}
                    {money(profit)}
                  </div>

                  <div className="text-xs text-[color:var(--muted2)]">
                    {new Date(item.soldAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}

          {items.length === 0 && (
            <div className="text-sm text-[color:var(--muted)]">
              No sold items yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}