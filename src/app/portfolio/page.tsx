"use client";

import { useEffect, useState } from "react";

import InsightsOverview from "@/components/portfolio/InsightsOverview";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

export default function PortfolioPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  // Until the account has been read once, an empty list means "not loaded yet", not "no items".
  const [loaded, setLoaded] = useState(false);

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
      if (active) {
        setItems(loadItems());
        setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return <InsightsOverview items={items} loading={!loaded} />;
}
