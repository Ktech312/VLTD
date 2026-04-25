"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

type SoldItem = {
  id: string;
  title: string;
  imageFrontUrl?: string;
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  soldPrice: number;
  soldAt: number;
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

function readSales(): SoldItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(data) ? (data as SoldItem[]) : [];
  } catch {
    return [];
  }
}

function soldItemFromVaultItem(item: VaultItem): SoldItem | null {
  if (item.status !== "SOLD" && !item.soldAt && item.soldPrice === undefined) return null;

  return {
    id: item.id,
    title: item.title,
    imageFrontUrl: item.imageFrontUrl,
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

export default function SoldPage() {
  const [items, setItems] = useState<SoldItem[]>(() => buildSoldItems());

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

  const totalProfit = useMemo(() => {
    return items.reduce((sum, i) => {
      return sum + (i.soldPrice - cost(i));
    }, 0);
  }, [items]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6">

        <h1 className="text-xl font-semibold">Sold Items</h1>
        <div className="mt-1 text-sm text-[color:var(--muted)]">
          Total Realized Profit: {money(totalProfit)}
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const profit = item.soldPrice - cost(item);

            return (
              <Link
                key={item.id}
                href={`/vault/item/${item.id}?sold=1`}
                className="flex items-center gap-3 rounded-lg bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
              >
                {item.imageFrontUrl && (
                  <img
                    src={item.imageFrontUrl}
                    alt={item.title}
                    className="h-14 w-14 rounded object-cover"
                  />
                )}

                <div className="flex-1">
                  <div className="font-medium">{item.title}</div>

                  <div className="text-xs text-[color:var(--muted)]">
                    Sold: {money(item.soldPrice)}
                  </div>

                  <div
                    className={`text-xs ${
                      profit >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {profit >= 0 ? "+" : ""}
                    {money(profit)}
                  </div>

                  <div className="text-[10px] text-[color:var(--muted2)]">
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
