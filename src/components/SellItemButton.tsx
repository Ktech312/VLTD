"use client";

import { useState } from "react";

import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { saveItem, type VaultItem } from "@/lib/vaultModel";
import { showToast } from "@/lib/toast";
import { dispatchItemSold } from "@/hooks/useAutoShareTrigger";

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
      showToast("Invalid price.");
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
      dispatchItemSold(soldItem, salePrice);
    } catch (error) {
      console.error(error);
      showToast("Failed to mark item sold.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSell()}
      disabled={loading}
      // The literal "bg-red" substring in this class name matters beyond
      // styling: theme-override.css has a `.theme-light body button:not([class*="bg-red"])`
      // rule that force-overrides button text color, and this is the exact
      // escape hatch it checks for — dropping it (as an earlier pass here
      // briefly did) silently re-breaks this button's color in light theme.
      className="inline-flex min-h-7 items-center justify-center rounded-[7px] bg-red-500/15 px-3 py-1 text-xs font-semibold transition disabled:opacity-50"
      style={{
        color: "var(--status-loss, #E05252)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--status-loss, #E05252) 38%, transparent)",
      }}
    >
      {loading ? "Selling..." : "Sell"}
    </button>
  );
}
