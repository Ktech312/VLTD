"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingStatus } from "@/lib/auth";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const BiggestMoversPanel = dynamic(() => import("@/components/BiggestMoversPanel"), {
  loading: () => (
    <div className="rounded-[24px] border border-[#1E1E1E] bg-[#141414] p-4 text-sm text-[#A0956B]">
      Loading movers…
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

/* ── Stat chip — compact single-row format ─────────────── */
function StatChip({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "gold" | "gain" | "loss";
}) {
  const valueColor =
    tone === "gold"
      ? "#F5B548"
      : tone === "gain"
      ? "#4CAF82"
      : tone === "loss"
      ? "#E05252"
      : "#F0EAD6";

  const borderColor =
    tone === "gold"
      ? "rgba(245,181,72,0.28)"
      : tone === "gain"
      ? "rgba(76,175,130,0.24)"
      : tone === "loss"
      ? "rgba(224,82,82,0.24)"
      : "#2A2418";

  const bgColor =
    tone === "gold"
      ? "rgba(245,181,72,0.07)"
      : tone === "gain"
      ? "rgba(76,175,130,0.06)"
      : tone === "loss"
      ? "rgba(224,82,82,0.06)"
      : "#141414";

  const boxShadow =
    tone === "gold"
      ? "0 4px 20px rgba(245,181,72,0.10)"
      : tone === "gain"
      ? "0 4px 16px rgba(76,175,130,0.08)"
      : "none";

  return (
    <div
      className="flex flex-col gap-0.5 rounded-[16px] border px-3.5 py-2.5 flex-1 min-w-0"
      style={{ background: bgColor, borderColor, boxShadow }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A0956B]">{label}</span>
      <span className="text-lg font-black tracking-[-0.04em] leading-none" style={{ color: valueColor }}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-[#A0956B]">{sub}</span>}
    </div>
  );
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
        if (!status.isAuthenticated) { router.replace("/login"); return; }
        if (status.needsOnboarding) { router.replace("/onboarding"); return; }
        setDisplayName(status.activeProfile?.display_name ?? "");
        setProfileType(status.activeProfile?.profile_type ?? "");
        setPrimaryFocus(status.activeProfile?.primary_focus ?? "");
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

  const gainTone = stats.totalGain >= 0 ? "gain" : "loss";
  const gainPrefix = stats.totalGain >= 0 ? "+" : "";
  const summaryLine = stats.totalGain >= 0
    ? `Your vault is up ${formatMoney(stats.totalGain)} overall.`
    : `Your vault is down ${formatMoney(Math.abs(stats.totalGain))} overall.`;

  /* ── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-[#1E1E1E] bg-[#141414] p-5 text-[#A0956B]">
          Loading dashboard…
        </div>
      </main>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (error) {
    return (
      <main className="min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-5 text-red-100">
          {error}
        </div>
      </main>
    );
  }

  /* ── Render ──────────────────────────────────────────── */
  return (
    <main className="min-h-screen px-4 py-5 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">

        {/* ── Hero section ─────────────────────────────── */}
        <section
          className="rounded-[28px] border p-4 sm:p-5"
          style={{
            background: "linear-gradient(180deg, rgba(20,16,8,0.98) 0%, rgba(14,12,6,0.98) 100%)",
            borderColor: "rgba(245,181,72,0.18)",
            boxShadow: "0 0 0 1px rgba(245,181,72,0.08), 0 24px 80px rgba(0,0,0,0.55), 0 0 60px rgba(245,181,72,0.05)",
          }}
        >
          {/* Greeting row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[#A0956B]">
                Welcome back,
              </p>
              <h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">
                {displayName || "Collector"}
              </h1>
              <p className="mt-1 text-sm text-[#A0956B]">{summaryLine}</p>
            </div>

            {/* Focus badge — hidden when no valid focus value */}
            {primaryFocus && primaryFocus.toLowerCase() !== "null" && (
              <div
                className="shrink-0 rounded-2xl border px-3 py-1.5 text-right"
                style={{ borderColor: "rgba(245,181,72,0.22)", background: "rgba(245,181,72,0.07)" }}
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#A0956B]">Focus</p>
                <p className="text-sm font-bold text-[#F5B548]">{primaryFocus}</p>
              </div>
            )}
          </div>

          {/* Compact stats row */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <StatChip label="Items"    value={String(stats.totalItems)} sub="in vault" />
            <StatChip label="Invested" value={formatMoney(stats.totalCostValue)} sub="cost basis" />
            <StatChip label="Value"    value={formatMoney(stats.totalValue)} sub="current est." tone="gold" />
            <StatChip
              label="Gain / Loss"
              value={`${gainPrefix}${formatMoney(stats.totalGain)}`}
              sub={stats.totalCostValue > 0 ? `${gainPrefix}${stats.gainPct.toFixed(1)}% return` : "add costs"}
              tone={gainTone}
            />
          </div>

          {/* Smart Scan CTA — dark gold glow bar */}
          <Link
            href="/capture"
            className="mt-4 flex min-h-[52px] items-center justify-between gap-3 rounded-[18px] px-4 py-3 font-semibold no-select transition hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, rgba(139,105,20,0.25) 0%, rgba(200,148,31,0.15) 50%, rgba(139,105,20,0.25) 100%)',
              border: '1px solid var(--theme-gold-border, rgba(245,181,72,0.35))',
              boxShadow: '0 0 20px rgba(245,181,72,0.15)',
              color: 'var(--theme-gold, #F5B548)',
            }}
          >
            <span className="flex items-center gap-3 text-sm font-semibold">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--theme-gold-subtle, rgba(245,181,72,0.10))', border: '1px solid var(--theme-gold-border, rgba(245,181,72,0.25))' }}
              >
                ▣
              </span>
              Smart Scan — add any item to your VLTD vault instantly
            </span>
            <span className="hidden shrink-0 text-sm font-semibold sm:inline">Scan →</span>
          </Link>

          {/* Quick action pills */}
          <div className="mt-3 flex gap-2">
            <Link
              href="/museum"
              className="flex-1 rounded-[14px] border py-2.5 text-center text-sm font-semibold transition hover:brightness-110"
              style={{
                borderColor: "rgba(245,181,72,0.28)",
                background: "rgba(245,181,72,0.09)",
                color: "#F5B548",
              }}
            >
              Explore Exhibitions
            </Link>
            <Link
              href="/vault"
              className="flex-1 rounded-[14px] border border-[#1E1E1E] bg-[#141414] py-2.5 text-center text-sm font-semibold text-[#A0956B] transition hover:text-text-primary hover:border-[rgba(255,255,255,0.14)]"
            >
              Go to Vault
            </Link>
          </div>
        </section>

        {/* ── Featured Exhibition ───────────────────────── */}
        <section
          className="relative overflow-hidden rounded-[24px] border p-5"
          style={{
            background: "linear-gradient(135deg, rgba(20,16,8,0.98) 0%, rgba(16,12,4,0.98) 100%)",
            borderColor: "rgba(245,181,72,0.16)",
          }}
        >
          {/* Warm glow in corner */}
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(245,181,72,0.12) 0%, transparent 70%)",
              filter: "blur(24px)",
            }}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.30em] text-[#A0956B]">
                Featured Exhibition
              </p>
              <h2 className="mt-1.5 text-xl font-black tracking-[-0.03em] text-text-primary">
                Your Museum Awaits
              </h2>
              <p className="mt-1 max-w-[340px] text-sm leading-relaxed text-[#A0956B]">
                Curate and display your collection for the world. Create exhibitions that tell the story of what you collect.
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <Link
                  href="/museum/new"
                  className="rounded-full px-4 py-2 text-sm font-black vltd-gold-btn"
                >
                  Create Exhibition
                </Link>
                <Link
                  href="/museum"
                  className="rounded-full border border-[rgba(245,181,72,0.22)] px-4 py-2 text-sm font-semibold text-[#F5B548] transition hover:bg-[rgba(245,181,72,0.09)]"
                >
                  View all →
                </Link>
              </div>
            </div>

            {/* Decorative vault icon */}
            <div
              className="hidden shrink-0 sm:flex h-20 w-20 items-center justify-center rounded-2xl border text-3xl"
              style={{
                borderColor: "rgba(245,181,72,0.22)",
                background: "rgba(245,181,72,0.07)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              🏛
            </div>
          </div>
        </section>

        {/* ── Two-column: actions + recent / movers ─────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Left column */}
          <div className="space-y-4">

            {/* Quick Actions */}
            <section
              className="rounded-[24px] border border-[#1E1E1E] p-4"
              style={{ background: "#141414" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">
                Quick Actions
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Quick Add", href: "/vault/quick", accent: true },
                  { label: "Import",    href: "/vault/import" },
                  { label: "Vault",     href: "/vault" },
                  { label: "Gallery",   href: "/museum" },
                  { label: "Add Item",  href: "/vault/add" },
                  { label: "Account",   href: "/account" },
                ].map(({ label, href, accent }) => (
                  <Link
                    key={href + label}
                    href={href}
                    className="rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition"
                    style={accent
                      ? {
                          borderColor: "rgba(245,181,72,0.28)",
                          background: "rgba(245,181,72,0.09)",
                          color: "#F5B548",
                        }
                      : {
                          borderColor: "#1E1E1E",
                          background: "rgba(14,14,14,0.60)",
                          color: "#A0956B",
                        }
                    }
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>

            {/* Recently Added */}
            <section
              className="rounded-[24px] border border-[#1E1E1E] p-4"
              style={{ background: "#141414" }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A0956B]">
                  Recently Added
                </p>
                <Link
                  href="/vault"
                  className="text-sm font-semibold text-[#A0956B] transition hover:text-[#F5B548]"
                >
                  View all →
                </Link>
              </div>

              {recentItems.length === 0 ? (
                <div
                  className="mt-3 rounded-2xl border border-dashed p-4 text-sm text-[#A0956B]"
                  style={{ borderColor: "#1E1E1E" }}
                >
                  No items yet. Start with Quick Add or Smart Scan.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/vault/item/${item.id}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-transparent px-3.5 py-2.5 transition"
                      style={{ background: "rgba(20,20,20,0.80)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(245,181,72,0.14)";
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(30,28,20,0.90)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = "transparent";
                        (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,20,20,0.80)";
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
                        <p className="mt-0.5 text-xs text-[#A0956B]">
                          {item.universe || item.category || "Collectible"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: "#52D6F4" }}>
                        {formatMoney(item.currentValue ?? item.estimatedValue ?? 0)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column — biggest movers */}
          <BiggestMoversPanel items={items} />
        </div>
      </div>
    </main>
  );
}
