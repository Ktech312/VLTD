"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingStatus } from "@/lib/auth";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => (
    <div className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] p-4 text-sm text-[color:var(--muted)]">
      Loading movers...
    </div>
  ),
});

function formatMoney(value?: number) {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function totalCost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

function statToneClass(tone?: "primary" | "gain" | "quiet") {
  if (tone === "primary") {
    return "border-[rgba(82,214,244,0.34)] bg-[linear-gradient(180deg,rgba(24,49,82,0.95),rgba(13,27,48,0.92))] shadow-[0_18px_48px_rgba(82,214,244,0.08)]";
  }
  if (tone === "gain") {
    return "border-emerald-400/35 bg-[linear-gradient(180deg,rgba(13,48,39,0.82),rgba(11,31,31,0.90))]";
  }
  return "border-[color:var(--border)] bg-[rgba(15,29,49,0.82)]";
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
    const gainPct = totalCostValue > 0 ? (totalGain / totalCostValue) * 100 : 0;
    return { totalItems, totalCostValue, totalValue, totalGain, gainPct };
  }, [items]);

  const recentItems = useMemo(() => {
    return [...items]
      .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
      .slice(0, 4);
  }, [items]);

  const summaryLine = stats.totalGain >= 0
    ? `Your vault is up ${formatMoney(stats.totalGain)} overall.`
    : `Your vault is down ${formatMoney(Math.abs(stats.totalGain))} overall.`;

  if (loading) {
    return (
      <main className="vltd-page-depth min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] p-5 text-[color:var(--muted)]">
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="vltd-page-depth min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-5 text-red-100">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-5 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(12,26,45,0.92),rgba(8,18,32,0.92))] p-4 shadow-[0_22px_72px_rgba(0,0,0,0.26)] sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Dashboard</div>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
                Hi{displayName ? `, ${displayName}` : ""}
              </h1>
              <p className="mt-1.5 text-base font-medium text-[color:var(--muted)]">{summaryLine}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.38)] px-3 py-2 text-sm text-[color:var(--muted)]">
              <span className="text-[color:var(--muted2)]">Focus</span>{" "}
              <span className="font-semibold text-white">{primaryFocus || (profileType === "business" ? "Business" : "Collection")}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-[20px] border p-4 ${statToneClass("quiet")}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Items</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{stats.totalItems}</div>
              <div className="mt-0.5 text-xs text-[color:var(--muted2)]">in vault</div>
            </div>
            <div className={`rounded-[20px] border p-4 ${statToneClass("quiet")}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Invested</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{formatMoney(stats.totalCostValue)}</div>
              <div className="mt-0.5 text-xs text-[color:var(--muted2)]">cost basis</div>
            </div>
            <div className={`rounded-[20px] border p-4 ${statToneClass("primary")}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Value</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{formatMoney(stats.totalValue)}</div>
              <div className="mt-0.5 text-xs text-[color:var(--muted2)]">current est.</div>
            </div>
            <div className={`rounded-[20px] border p-4 ${statToneClass("gain")}`}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Gain / Loss</div>
              <div className={stats.totalGain >= 0 ? "mt-2 text-2xl font-black tracking-[-0.04em] text-emerald-300" : "mt-2 text-2xl font-black tracking-[-0.04em] text-rose-300"}>
                {stats.totalGain >= 0 ? "+" : ""}{formatMoney(stats.totalGain)}
              </div>
              <div className="mt-0.5 text-xs text-emerald-300/70">
                {stats.totalCostValue > 0 ? `${stats.gainPct >= 0 ? "+" : ""}${stats.gainPct.toFixed(1)}% return` : "add costs for return"}
              </div>
            </div>
          </div>

          <Link
            href="/capture"
            className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-[20px] bg-[linear-gradient(90deg,#52d6f4,#4bc7e9)] px-4 py-3 text-[#05101e] shadow-[0_16px_42px_rgba(82,214,244,0.20)] transition hover:-translate-y-0.5 hover:brightness-105"
          >
            <span className="flex items-center gap-3 text-base font-black">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#06101d]/10">▣</span>
              Smart Scan — add any item to your VLTD vault instantly
            </span>
            <span className="hidden text-sm font-black sm:inline">Scan item →</span>
          </Link>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <section className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.78)] p-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">Quick Actions</div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Link href="/vault/quick" className="rounded-2xl border border-[rgba(82,214,244,0.22)] bg-[rgba(82,214,244,0.09)] px-3 py-3 text-center text-sm font-black text-[color:var(--accent)] transition hover:bg-[rgba(82,214,244,0.14)]">Quick Add</Link>
                <Link href="/vault/import" className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.26)] px-3 py-3 text-center text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">Import</Link>
                <Link href="/vault" className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.26)] px-3 py-3 text-center text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">Vault</Link>
                <Link href="/museum" className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.26)] px-3 py-3 text-center text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">Gallery</Link>
                <Link href="/vault/add" className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.26)] px-3 py-3 text-center text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">Add Item</Link>
                <Link href="/account" className="rounded-2xl border border-[color:var(--border)] bg-[rgba(5,11,21,0.26)] px-3 py-3 text-center text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">Account</Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.78)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">Recently Added</div>
                <Link href="/vault" className="text-sm font-semibold text-[color:var(--muted2)] transition hover:text-[color:var(--accent)]">View all →</Link>
              </div>

              {recentItems.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--muted)]">
                  No items yet. Start with Quick Add or Smart Scan.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/vault/item/${item.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-[rgba(18,38,66,0.74)] px-3.5 py-2.5 transition hover:bg-[rgba(27,54,88,0.9)]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[color:var(--fg)]">{item.title}</div>
                        <div className="mt-0.5 text-xs text-[color:var(--muted2)]">{item.universe || item.category || "Collectible"}</div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-[color:var(--muted)]">
                        {formatMoney(item.currentValue ?? item.estimatedValue ?? 0)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <BiggestMoversPanel items={items} />
        </div>
      </div>
    </main>
  );
}
