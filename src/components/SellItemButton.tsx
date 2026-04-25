"use client";

import { useState } from "react";

import { loadItems, saveItems, type VaultItem } from "@/lib/vaultModel";

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

  function handleSell() {
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
      const nextSale: SaleRecord = {
        ...item,
        soldPrice: salePrice,
        soldAt: Date.now(),
      };

      writeSales([
        nextSale,
        ...sales.filter((sale) => String(sale.id) !== String(item.id)),
      ]);

      const nextVaultItems = loadItems({ includeAllProfiles: true }).filter(
        (entry) => String(entry.id) !== String(item.id)
      );
      saveItems(nextVaultItems);

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
      onClick={handleSell}
      disabled={loading}
      className="w-full rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-400/30 transition hover:bg-red-500/30 disabled:opacity-50"
    >
      {loading ? "Selling..." : "Sell Item"}
    </button>
  );
}
