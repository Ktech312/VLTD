"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import InsightsOverview from "@/components/portfolio/InsightsOverview";
import { LoadErrorCard, StaleDataNotice, useCloudRefresh } from "@/components/vault/CloudStatus";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { applyDisplayedUniverses, useDisplayedUniverses } from "@/lib/displayedUniverses";
import DisplayedUniversesNotice from "@/components/DisplayedUniversesNotice";

export default function PortfolioPage() {
  const [allItems, setItems] = useState<VaultItem[]>([]);
  // "Universes displayed" decides which universes Insights covers; the held-back items stay in the account.
  const { displayed: displayedUniverses, showAll: showAllUniverses } = useDisplayedUniverses();
  const universeView = useMemo(() => applyDisplayedUniverses(allItems, displayedUniverses), [allItems, displayedUniverses]);
  const items = universeView.shown;
  const reloadRef = useRef<() => void>(() => undefined);
  // The page asks the cloud once; "no items" is only believed once the cloud has answered. A failed answer is never shown as an empty collection.
  const cloud = useCloudRefresh(() => reloadRef.current());

  useEffect(() => {
    const reload = () => setItems(loadItems());
    reloadRef.current = reload;
    reload(); // instant paint from the saved copy
    window.addEventListener("vltd:vault-updated", reload);
    return () => window.removeEventListener("vltd:vault-updated", reload);
  }, []);

  if (allItems.length === 0 && cloud.state === "failed") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <LoadErrorCard what="insights" onRetry={cloud.retry} busy={cloud.busy} />
      </main>
    );
  }

  return (
    <>
      {cloud.state === "failed" && allItems.length > 0 ? (
        <div className="mx-auto max-w-[1480px] px-4 pt-3 sm:px-6 lg:px-8">
          <StaleDataNotice onRetry={cloud.retry} busy={cloud.busy} />
        </div>
      ) : null}
      {universeView.hiddenCount > 0 ? (
        <div className="mx-auto max-w-[1480px] px-4 pt-3 sm:px-6 lg:px-8">
          <DisplayedUniversesNotice hiddenCount={universeView.hiddenCount} hiddenUniverses={universeView.hiddenUniverses} onShowAll={showAllUniverses} />
        </div>
      ) : null}
      <InsightsOverview items={items} loading={cloud.state === "loading" && allItems.length === 0} />
    </>
  );
}
