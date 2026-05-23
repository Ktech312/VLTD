"use client";

import { useState } from "react";

import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { saveItem, type VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

type SaleRecord = VaultItem & {
  soldPrice: number;
  soldAt: number;
};

function readSales(): SaleRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SaleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeSales(data: SaleRecord[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(data));
}

function parseMoney(input: string) {
  const value = Number(input.replace(/[^0-9.-]/g, "").trim());
  return Number.isFinite(value) ? value : undefined;
}

export default function SellItemButton({ item }: { item: VaultItem }) {
  const [loading, setLoading] = useState(false);

  async function handleSell() {
    const priceInput = window.prompt("Enter sale price:");
    if (!priceInput) return;

    const salePrice = parseMoney(priceInput);
    if (salePrice === undefined) {
      window.alert("Invalid price.");
      return;
    }

    setLoading(true);

    try {
      const sales = readSales();
      const soldAt = Date.now();
      const soldItem: VaultItem = {
        ...item,
        status: "SOLD",
        soldPrice: salePrice,
        soldAt,
      };

      const nextSale: SaleRecord = {
        ...soldItem,
        soldPrice: salePrice,
        soldAt,
      };

      writeSales([
        nextSale,
        ...sales.filter((sale) => String(sale.id) !== String(item.id)),
      ]);

      saveItem(soldItem);
      enqueueVaultItemSync(soldItem.id);
      await processVaultSyncQueue();

      window.dispatchEvent(new Event("vltd:vault-updated"));
    } catch (error) {
      console.error(error);
      window.alert("Failed to mark item sold.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSell()}
      disabled={loading}
      className="inline-flex min-h-7 items-center justify-center rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200 ring-1 ring-red-400/25 transition hover:bg-red-500/25 disabled:opacity-50"
    >
      {loading ? "Selling..." : "Sell"}
    </button>
  );
}
