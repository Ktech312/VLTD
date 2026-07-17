"use client";

import { useEffect, useState } from "react";

import InsightsOverview from "@/components/portfolio/InsightsOverview";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

export default function PortfolioPage() {
  const [items, setItems] = useState<VaultItem[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      // Instant paint from the local cache, then refresh from the real vault.
      setItems(loadItems());
      try {
        await syncVaultItemsFromSupabase();
      } catch {
        /* offline — the local cache still renders */
      }
      if (active) setItems(loadItems());
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return <InsightsOverview items={items} />;
}
