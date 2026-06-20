
"use client";

import ExportListingButton from "@/components/ExportListingButton";
import type { VaultItem } from "@/lib/vaultModel";

export default function ListingGeneratorPanel({ item }: { item: VaultItem }) {
  return <ExportListingButton item={item} />;
}
