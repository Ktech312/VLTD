"use client";

import { useParams } from "next/navigation";

import VaultListView, { isKnownUniverseSlug, universeFromSlug } from "../VaultListView";
import { PillButton } from "@/components/ui/PillButton";

export default function VaultUniversePage() {
  const params = useParams<{ universe: string }>();
  if (!isKnownUniverseSlug(params.universe)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center text-[color:var(--fg)]">
        <div role="alert" data-testid="universe-not-found" className="rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)]">
          <h1 className="text-2xl font-semibold">That universe doesn&apos;t exist</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Check the address, or go back to your Vault.</p>
          <div className="mt-5 flex justify-center"><PillButton variant="primary" href="/vault">Back to the Vault</PillButton></div>
        </div>
      </main>
    );
  }
  return <VaultListView lockedUniverse={universeFromSlug(params.universe)} />;
}
