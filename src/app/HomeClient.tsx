"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BiggestMoversPanel from "@/components/BiggestMoversPanel";
import { getOnboardingStatus } from "@/lib/auth";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

function formatMoney(value?: number) {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function totalCost(item: VaultItem) {
  return Number(item.purchasePrice ?? 0) + Number(item.purchaseTax ?? 0) + Number(item.purchaseShipping ?? 0) + Number(item.purchaseFees ?? 0);
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

  if (loading) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]"><div className="mx-auto max-w-6xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">Loading dashboard...</div></main>;
  if (error) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]"><div className="mx-auto max-w-6xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-6 text-red-200">{error}</div></main>;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Home</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hi{displayName ? `, ${displayName}` : ""}</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">{profileType === "business" ? "Run your collection like an asset system." : "Track your vault and grow your portfolio."}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Items</div><div className="mt-2 text-2xl font-semibold">{stats.totalItems}</div></div>
            <div className="rounded-[20px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Cost</div><div className="mt-2 text-2xl font-semibold">{formatMoney(stats.totalCostValue)}</div></div>
            <div className="rounded-[20px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Value</div><div className="mt-2 text-2xl font-semibold">{formatMoney(stats.totalValue)}</div></div>
            <div className="rounded-[20px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Gain</div><div className="mt-2 text-2xl font-semibold">{stats.totalGain >= 0 ? "+" : ""}{formatMoney(stats.totalGain)}</div></div>
          </div>
        </section>
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Quick Actions</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Link href="/vault/quick" className="rounded-2xl bg-[color:var(--pill-active-bg)] px-4 py-4 text-sm font-semibold text-[color:var(--fg)]">Quick Add</Link><Link href="/vault/import" className="rounded-2xl bg-[color:var(--pill)] px-4 py-4 text-sm font-medium ring-1 ring-[color:var(--border)]">Import</Link><Link href="/vault" className="rounded-2xl bg-[color:var(--pill)] px-4 py-4 text-sm font-medium ring-1 ring-[color:var(--border)]">Open Vault</Link><Link href="/account" className="rounded-2xl bg-[color:var(--pill)] px-4 py-4 text-sm font-medium ring-1 ring-[color:var(--border)]">Account Settings</Link></div></div>
          <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]"><div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Collector Setup</div><div className="mt-4 text-sm text-[color:var(--muted)]">Primary focus: <span className="text-[color:var(--fg)]">{primaryFocus || "Not set yet"}</span></div></div>
        </section>
        <section className="mt-6">
          <BiggestMoversPanel items={items} />
        </section>
      </div>
    </main>
  );
}
