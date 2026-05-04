"use client";

import { useState } from "react";
import type { VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";
const VAULT_ITEMS_KEY = "vltd_vault_items_v1";

type SoldVaultItem = VaultItem & {
  soldPrice: number;
  soldAt: number;
};

function getSales(): SoldVaultItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(data) ? (data as SoldVaultItem[]) : [];
  } catch {
    return [];
  }
}

function setSales(data: SoldVaultItem[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(data));
}

function getVaultItems(): VaultItem[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(VAULT_ITEMS_KEY) || "[]");
    return Array.isArray(data) ? (data as VaultItem[]) : [];
  } catch {
    return [];
  }
}

export default function SellItemButton({ item }: { item: VaultItem }) {
  const [loading, setLoading] = useState(false);

  function handleSell() {
    const priceInput = prompt("Enter sale price:");
    if (!priceInput) return;

    const salePrice = Number(priceInput);
    if (!Number.isFinite(salePrice)) {
      alert("Invalid price");
      return;
    }

    setLoading(true);

    try {
      const sales = getSales();

      sales.push({
        ...item,
        soldPrice: salePrice,
        soldAt: Date.now(),
      });

      setSales(sales);

      const items = getVaultItems();
      const updated = items.filter((vaultItem) => vaultItem.id !== item.id);
      localStorage.setItem(VAULT_ITEMS_KEY, JSON.stringify(updated));

      window.dispatchEvent(new Event("vltd:vault-updated"));
    } catch (error) {
      console.error(error);
      alert("Failed to sell item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleSell} disabled={loading}>
      {loading ? "Selling..." : "Sell Item"}
    </button>
  );
}
