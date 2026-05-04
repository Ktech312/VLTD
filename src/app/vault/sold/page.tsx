"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SALES_KEY = "vltd_sales_history";

type SoldItem = {
  id?: string;
  title?: string;
  soldPrice?: number | string | null;
  purchasePrice?: number | string | null;
  purchaseTax?: number | string | null;
  purchaseShipping?: number | string | null;
  purchaseFees?: number | string | null;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function cost(item: SoldItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

export default function SoldPage() {
  const [items, setItems] = useState<SoldItem[]>([]);

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
      setItems(Array.isArray(data) ? data : []);
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
    return items.reduce((sum, item) => {
      return sum + (Number(item.soldPrice ?? 0) - cost(item));
    }, 0);
  }, [items]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Vault</div>
        <h1 className="text-3xl font-semibold tracking-tight">Sold Items</h1>
        <div className="text-sm text-[color:var(--muted)]">Total Profit: {money(totalProfit)}</div>
      </div>

      <div className="grid gap-3">
        {items.map((item, index) => {
          const profit = Number(item.soldPrice ?? 0) - cost(item);
          const key = item.id || `${item.title || "sold-item"}-${index}`;

          return (
            <Link
              key={key}
              href="/vault/item/?sold=1"
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:bg-[color:var(--pill)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold">{item.title || "Untitled item"}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">Sold: {money(item.soldPrice)}</div>
                </div>
                <div className={profit >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
                  {profit >= 0 ? "+" : ""}{money(profit)}
                </div>
              </div>
            </Link>
          );
        })}

        {!items.length ? (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)]">
            No sold items yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
