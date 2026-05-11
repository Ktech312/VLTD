
"use client";

import ExportListingButton from "@/components/ExportListingButton";

export default function MarketplaceListingPanel({ item }: { item: any }) {
  return (
    <div className="rounded-xl p-4 bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
      <div className="font-semibold mb-3">Marketplace Export</div>
      <ExportListingButton item={item} />
    </div>
  );
}
