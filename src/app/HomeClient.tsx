"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingStatus } from "@/lib/auth";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => (
    <div className="rounded-[20px] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
      Loading movers...
    </div>
  ),
});

function formatMoney(value?: number) {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function totalCost(item: VaultItem) {
  return Number(item.purchasePrice ?? 0) + Number(item.purchaseTax ?? 0) + Number(item.purchaseShipping ?? 0) + Number(item.purchaseFees ?? 0);
}

function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

export default function HomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileType, setProfileType] = useState("");
  const [primaryFocus, setPrimaryFocus] = useState("");
  const [items, setItems] = useState<VaultItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const status = await getOnboardingStatus();
        if (!status.isAuthenticated) {
          router.replace("/login");
          return;
        }
        if (status.needsOnboarding) {
          router.replace("/onboarding");
          return;
        }
        setDisplayName(status.activeProfile?.display_name ?? "");
        setProfileType(status.activeProfile?.profile_type ?? "");
        setPrimaryFocus(String(status.activeProfile?.primary_focus ?? ""));
        await syncVaultItemsFromSupabase();
        setItems(loadItems());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalCostValue = items.reduce((sum, item) => sum + totalCost(item), 0);
    const totalValue = items.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
    const totalGain = totalValue - totalCostValue;
    return { totalItems, totalCostValue, totalValue, totalGain };
  }, [items]);

  const recentItems = useMemo(() => {
    return [...items]
      .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
      .slice(0, 5);
  }, [items]);

  if (loading) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]"><div className="mx-auto max-w-4xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">Loading dashboard...</div></main>;
  if (error) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]"><div className="mx-auto max-w-4xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div></main>;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-5 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Home</div>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi{displayName ? `, ${displayName}` : ""}</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{profileType === "business" ? "Run your collection like an asset system." : "Track your vault and grow your portfolio."}</p>
            </div>
            <div className="text-xs text-[color:var(--muted2)]">
              Focus: <span className="text-[color:var(--fg)]">{primaryFocus || "Not set"}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[18px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]"><div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Items</div><div className="mt-1 text-xl font-semibold">{stats.totalItems}</div></div>
            <div className="rounded-[18px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]"><div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Cost</div><div className="mt-1 text-xl font-semibold">{formatMoney(stats.totalCostValue)}</div></div>
            <div className="rounded-[18px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]"><div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Value</div><div className="mt-1 text-xl font-semibold">{formatMoney(stats.totalValue)}</div></div>
            <div className="rounded-[18px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]"><div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Gain</div><div className="mt-1 text-xl font-semibold">{stats.totalGain >= 0 ? "+" : ""}{formatMoney(stats.totalGain)}</div></div>
          </div>

          <Link href="/capture" className="mt-4 flex items-center justify-between rounded-[18px] bg-[color:var(--pill-active-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)]">
            <span>Smart Scan</span>
            <span className="text-xs font-medium text-[color:var(--muted)]">Capture, identify, and add faster</span>
          </Link>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="space-y-6">
            <section className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Quick Actions</div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Link href="/vault/quick" className="rounded-2xl bg-[color:var(--pill-active-bg)] px-3 py-3 text-center text-xs font-semibold text-[color:var(--fg)]">Quick Add</Link>
                <Link href="/vault/import" className="rounded-2xl bg-[color:var(--pill)] px-3 py-3 text-center text-xs font-medium ring-1 ring-[color:var(--border)]">Import</Link>
                <Link href="/vault" className="rounded-2xl bg-[color:var(--pill)] px-3 py-3 text-center text-xs font-medium ring-1 ring-[color:var(--border)]">Vault</Link>
                <Link href="/museum" className="rounded-2xl bg-[color:var(--pill)] px-3 py-3 text-center text-xs font-medium ring-1 ring-[color:var(--border)]">Gallery</Link>
                <Link href="/vault/add" className="rounded-2xl bg-[color:var(--pill)] px-3 py-3 text-center text-xs font-medium ring-1 ring-[color:var(--border)]">Add</Link>
                <Link href="/account" className="rounded-2xl bg-[color:var(--pill)] px-3 py-3 text-center text-xs font-medium ring-1 ring-[color:var(--border)]">Account</Link>
              </div>
            </section>

            <section className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Recently Added</div>
                <Link href="/vault" className="text-xs font-medium text-[color:var(--muted)] hover:text-[color:var(--fg)]">View all</Link>
              </div>

              {recentItems.length === 0 ? (
                <div className="mt-3 text-sm text-[color:var(--muted)]">No items yet. Start with Quick Add or Smart Scan.</div>
              ) : (
                <div className="mt-3 divide-y divide-[color:var(--border)]">
                  {recentItems.map((item) => (
                    <Link key={item.id} href={`/vault/item/${item.id}`} className="flex items-center justify-between gap-4 py-2 text-sm hover:text-[color:var(--fg)]">
                      <span className="min-w-0 truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs text-[color:var(--muted)]">{formatMoney(item.currentValue ?? item.estimatedValue ?? 0)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section>
            <BiggestMoversPanel items={items} />
          </section>
        </div>
      </div>
    </main>
  );
}
