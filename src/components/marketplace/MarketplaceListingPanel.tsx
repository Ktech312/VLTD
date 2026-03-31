
"use client";

import ExportListingButton from "@/components/ExportListingButton";

export default function MarketplaceListingPanel({ item }: { item: any }) {
  return (
    <div className="rounded-xl p-4 bg-black/20 ring-1 ring-white/10">
      <div className="font-semibold mb-3">Marketplace Export</div>
      <ExportListingButton item={item} />
    </div>
  );
}
