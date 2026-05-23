"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import VaultMuseumView from "@/components/VaultMuseumView";
import {
  fetchPublicProfile,
  fetchPublicVaultItems,
  type PublicProfile,
} from "@/lib/publicProfile";
import type { UniverseKey } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

export default function PublicVaultPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const [nextProfile, nextItems] = await Promise.all([
          fetchPublicProfile(profileId),
          fetchPublicVaultItems(profileId),
        ]);

        if (!active) return;
        setProfile(nextProfile);
        setItems(nextItems);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Public vault could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [profileId]);

  function handleFilterToUniverse(_universe: UniverseKey) {
    // Public vault shares are already intentionally filtered to public items.
  }

  const displayName = profile?.displayName || "Collector";
  const avatarEmoji = profile?.avatarEmoji || "🗝️";

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)]/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--pill)] text-2xl ring-1 ring-[color:var(--border)]">
            {avatarEmoji}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{displayName}</div>
            <div className="text-xs text-[color:var(--muted)]">
              {loading ? "Loading public vault..." : `${items.length} public ${items.length === 1 ? "item" : "items"}`}
            </div>
          </div>
          <Link
            href="/"
            className="ml-auto inline-flex h-8 items-center rounded-full bg-[color:var(--pill)] px-3 text-[11px] font-bold tracking-[0.16em] text-[color:var(--theme-gold,#F5B548)] ring-1 ring-[color:var(--border)]"
          >
            VLTD
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {message ? (
          <div className="rounded-[20px] bg-[color:var(--surface)] p-6 text-sm text-red-200 ring-1 ring-red-400/20">
            {message}
          </div>
        ) : loading ? (
          <div className="rounded-[20px] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            Loading public vault...
          </div>
        ) : items.length ? (
          <VaultMuseumView items={items} onFilterToUniverse={handleFilterToUniverse} />
        ) : (
          <div className="rounded-[24px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)]">
              Public Vault
            </div>
            <h1 className="mt-2 text-2xl font-semibold">No public items yet</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">
              This collector has not shared any vault items publicly.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
