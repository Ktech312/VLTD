"use client";

import { PillButton } from "@/components/ui/PillButton";
import { useState } from "react";

import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { saveItem, type VaultItem } from "@/lib/vaultModel";
import { showToast } from "@/lib/toast";
import { parseMoneyInput } from "@/lib/moneyInput";
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

export default function SellItemButton({ item }: { item: VaultItem }) {
  const [loading, setLoading] = useState(false);

  async function handleSell() {
    const priceInput = window.prompt("Enter sale price:");
    if (priceInput === null) return;

    // Required and checked: blank, letters, malformed numbers and negatives are refused (an explicit 0 is a real $0 sale).
    const checked = parseMoneyInput(priceInput, { label: "Sale price" });
    if (!checked.ok) {
      showToast(`${checked.message} Nothing was marked sold.`);
      return;
    }
    if (checked.blank) {
      showToast("Enter the sale price (0 if it sold for nothing). Nothing was marked sold.");
      return;
    }
    const salePrice = checked.value;
    // Same question the For Sale page asks; drives the Sold page fee estimate.
    const platformInput = window.prompt("Where did it sell? (eBay, Whatnot, in person…)", "eBay");
    if (platformInput === null) return;
    const soldPlatform = platformInput.trim() || undefined;

    setLoading(true);

    try {
      const sales = readSales();
      const soldAt = Date.now();
      const soldItem: VaultItem = {
        ...item,
        status: "SOLD",
        soldPrice: salePrice,
        soldAt,
        soldPlatform,
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
    <PillButton size="compact" variant="danger" onClick={() => void handleSell()} disabled={loading}>
      {loading ? "Selling..." : "Sell"}
    </PillButton>
  );
}
