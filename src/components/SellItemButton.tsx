"use client";

import { useState } from "react";
import type { VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

function getSales() {
  try {
    return JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
  } catch {
    return [];
  }
}

function setSales(data) {
  localStorage.setItem(SALES_KEY, JSON.stringify(data));
}

export default function SellItemButton({ item }) {
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

      const items = JSON.parse(localStorage.getItem("vltd_vault_items_v1") || "[]");
      const updated = items.filter((i) => i.id !== item.id);
      localStorage.setItem("vltd_vault_items_v1", JSON.stringify(updated));

      window.dispatchEvent(new Event("vltd:vault-updated"));
    } catch (e) {
      console.error(e);
      alert("Failed to sell item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleSell} disabled={loading}>
      {loading ? "Selling..." : "Sell Item"}
    </button>
  );
}
