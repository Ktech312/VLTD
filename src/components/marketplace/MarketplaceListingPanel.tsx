
"use client";

import ExportListingButton from "@/components/ExportListingButton";
import type { VaultItem } from "@/lib/vaultModel";

export default function MarketplaceListingPanel({ item }: { item: VaultItem }) {
  return (
    <div className="rounded-xl p-4 bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
      <div className="font-semibold mb-3">Marketplace Export</div>
      <ExportListingButton item={item} />
    </div>
  );
}
