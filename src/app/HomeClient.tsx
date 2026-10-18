"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AddItemActions from "@/components/AddItemActions";
import ExhibitionCarousel from "@/components/home/ExhibitionCarousel";
import SwipeStrip from "@/components/home/SwipeStrip";
import { loadActivityEvents, type ActivityEventRecord } from "@/lib/activityEvents";
import { UNIVERSE_LABEL, isUniverseKey } from "@/lib/taxonomy";
import SeasonalBanner from "@/components/SeasonalBanner";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import { getOnboardingStatus, getStoredActiveProfileId } from "@/lib/auth";
import { loadGalleries, refreshGalleriesFromSupabase, type Gallery } from "@/lib/galleryModel";
import { LEARN_ARTICLES } from "@/lib/learnContent";
import { listLoungePosts, type LoungePost } from "@/lib/loungePosts";
import { priceCheckIsStale } from "@/lib/pricingMvp";
import { syncPublicProfile } from "@/lib/publicProfile";
import { INSIGHTS_BREAKDOWN_COLORS, INSIGHTS_GREEN, INSIGHTS_RED, INSIGHTS_REVENUE } from "@/lib/insightsPalette";
import { buildSoldItems, hasKnownCost, profitOf, soldStats } from "@/lib/soldItems";
import { activeItems, computeVaultStats, describeGainExclusions, effectiveMarketValue, readValueMode, totalsValue, writeValueMode, type ValueMode } from "@/lib/vaultStats";
import { loadItems, syncVaultItemsFromSupabaseChecked, type VaultItem } from "@/lib/vaultModel";
import { currentLocalOwner } from "@/lib/localDataOwner";
import { storedSessionUserId } from "@/lib/sessionGuard";
import { getPendingVaultSyncCount } from "@/lib/vaultSyncQueue";

const FOCUS_LS_KEY = "vltd_primary_focus";

// ── Design tokens (home-only) ─────────────────────────────────────
// Every colour comes from the runtime theme variables, so Graphite, Gunmetal and Titanium, light and dark,
// all read correctly without a separate stylesheet correcting them.
const C = {
  card: "var(--theme-card, rgba(3,8,14,0.95))",
  elevated: "var(--theme-elevated, rgba(6,12,20,0.96))",
  bd: "var(--theme-border, rgba(203,208,213,0.22))",
  bd2: "rgba(203,208,213,0.12)",
  gold: "var(--theme-gold, #C8CDD2)",
  muted: "var(--theme-text-secondary, #9BA0A6)",
  text: "var(--theme-text-primary, #ECEDEF)",
  green: "#52C27A",
  red: "#E05252",
  r: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)",
} as const;

const panelBg = "var(--theme-card, linear-gradient(165deg, rgba(42,46,52,0.96), rgba(20,22,26,0.97)))";
const premiumBorder = "1px solid var(--theme-gold-border, rgba(203,208,213,0.42))";
const premiumShadow = "0 22px 66px rgba(0,0,0,0.38), inset 0 1px 0 rgba(237,239,241,0.08)";

function formatMoney(v?: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v ?? 0));
}

// "Recently added" means when the item was added to the Vault, never when it was last edited or re-priced. Records that
// predate the created-at field carry the time in their id (item_<13 digits>); anything else sorts last rather than guessing.
function itemTimestamp(item: VaultItem) {
  const created = Number(item.createdAt);
  if (Number.isFinite(created) && created > 0) return created;
  const m = /(?:^|\D)(\d{13})(?:\D|$)/.exec(String(item.id ?? ""));
  const fromId = m ? Number(m[1]) : 0;
  return fromId > 946684800000 && fromId < Date.now() + 86400000 ? fromId : 0;
}

const RECENT_LIMIT = 24;
// How long Home waits for the cloud download when this device has nothing of this person's to show yet (the Vault uses the same 20 s).
const HOME_CLOUD_WAIT_MS = 20_000;

function timeAgo(timestamp: number) {
  if (!timestamp) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function excerpt(text: string, max = 120) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + "…" : flat;
}

// ── One money figure: label, number, short caption, and a link to the breakdown behind it ──
function MoneyTile({ href, label, value, tone = "default", ghost = false, caption, extra, go }: { href: string; label: string; value: React.ReactNode; tone?: "default" | "gold" | "gain" | "loss"; ghost?: boolean; caption: string; extra?: React.ReactNode; go: string }) {
  const color = ghost ? C.muted : tone === "gold" ? C.gold : tone === "gain" ? C.green : tone === "loss" ? C.red : C.text;
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col gap-1 rounded-[6px] p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)]"
      style={{ border: `1px solid ${C.bd2}`, background: C.elevated, textDecoration: "none", color: "inherit" }}
    >
      <span style={{ fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 800 }}>{label}</span>
      {/* vltd-keep-color + its variable: the light-theme text rule would otherwise turn green/red/grey figures the same dark colour */}
      <span className="vltd-keep-color" style={{ fontFamily: C.r, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color, "--vltd-keep-color": color } as React.CSSProperties}>{value}</span>
      <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{caption}</span>
      {extra}
      <span style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: C.gold }}>{go} ›</span>
    </Link>
  );
}

// ── A summary panel that is also the link to the full page behind it ──
function SummaryPanel({ href, title, glyph, children }: { href: string; title: string; glyph: "chart" | "tag" | "clock"; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] min-w-0 flex-col gap-2 rounded-[8px] p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)]"
      style={{ border: `1px solid ${C.bd2}`, background: C.elevated, textDecoration: "none", color: "inherit" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.gold }}>
        <Glyph name={glyph} size={18} />
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{title} ›</span>
      </span>
      {children}
    </Link>
  );
}

// A row of labelled bars drawn from real numbers: label, bar (width = share of the largest), value.
function MiniBars({ rows }: { rows: { label: string; value: number; text: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {rows.map((r, i) => (
        <span key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,92px) 1fr auto", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: C.bd2, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(3, Math.round((r.value / max) * 100))}%`, background: INSIGHTS_BREAKDOWN_COLORS[i % INSIGHTS_BREAKDOWN_COLORS.length], borderRadius: 4 }} />
          </span>
          <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{r.text}</span>
        </span>
      ))}
    </span>
  );
}

// Month columns for the sales panel: the last six calendar months. Two series per month, told apart by colour AND by the legend:
// revenue (blue) and profit (green) or loss (red, drawn the same way but red). Heights share one scale. Profit counts only sales with a recorded cost.
type SalesMonth = { label: string; revenue: number; profit: number; known: number };
function MonthColumns({ months }: { months: SalesMonth[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.known > 0 ? Math.abs(m.profit) : 0)));
  const anyLoss = months.some((m) => m.known > 0 && m.profit < 0);
  const h = (v: number) => (v > 0 ? `${Math.max(4, Math.round((v / max) * 44))}px` : "2px");
  const money = (n: number) => (n < 0 ? "-" : "") + formatMoney(Math.abs(n));
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "grid", gridTemplateColumns: `repeat(${months.length}, 1fr)`, alignItems: "end", gap: 6, height: 64 }} role="img" aria-label={"Revenue and profit by month: " + months.map((m) => `${m.label} revenue ${formatMoney(m.revenue)}, ${m.known > 0 ? "profit " + money(m.profit) : "no profit recorded"}`).join("; ")}>
        {months.map((m) => (
          <span key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
            <span aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, width: "100%", height: 46 }}>
              <span style={{ width: "100%", maxWidth: 14, height: h(m.revenue), background: m.revenue > 0 ? INSIGHTS_REVENUE : C.bd2, borderRadius: 3 }} />
              <span style={{ width: "100%", maxWidth: 14, height: m.known > 0 ? h(Math.abs(m.profit)) : "2px", background: m.known > 0 && m.profit !== 0 ? (m.profit < 0 ? INSIGHTS_RED : INSIGHTS_GREEN) : C.bd2, borderRadius: 3 }} />
            </span>
            <span aria-hidden="true" style={{ fontSize: 10, color: C.muted }}>{m.label}</span>
          </span>
        ))}
      </span>
      <span aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 10.5, color: C.muted }}>
        <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: INSIGHTS_REVENUE, marginRight: 4 }} />Revenue</span>
        <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: INSIGHTS_GREEN, marginRight: 4 }} />Profit</span>
        {anyLoss ? <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: INSIGHTS_RED, marginRight: 4 }} />Loss</span> : null}
      </span>
    </span>
  );
}

// A quiet text control (no pill around it) with a 44px touch area on a phone.
function TextAction({ onClick, children, ariaExpanded, ariaControls }: { onClick: () => void; children: React.ReactNode; ariaExpanded?: boolean; ariaControls?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className="min-h-[44px] rounded-[4px] px-1 text-[12px] font-semibold underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)] md:min-h-0"
      style={{ color: C.gold, background: "transparent" }}
    >
      {children}
    </button>
  );
}

// ── Card with a header: label, then a compact text link beside it ("Recently added · View Vault →"); an optional action stays on the right ──
function Block({ label, labelLink, action, children }: { label: string; labelLink?: { href: string; text: string; ariaLabel?: string }; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: panelBg, border: premiumBorder, borderRadius: 8, overflow: "hidden", boxShadow: premiumShadow, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.bd2}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 10, letterSpacing: "1.8px", textTransform: "uppercase", color: C.muted, fontWeight: 800 }}>{label}</h2>
          {labelLink ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{ color: C.muted }}>·</span>
              <Link href={labelLink.href} aria-label={labelLink.ariaLabel} className="inline-flex min-h-[44px] items-center rounded-[4px] text-[12px] font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)] md:min-h-0" style={{ color: C.gold, textDecoration: "none" }}>
                {labelLink.text} →
              </Link>
            </span>
          ) : null}
        </div>
        {action ?? null}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>{children}</div>
    </section>
  );
}

const quiet: React.CSSProperties = { padding: "14px 16px", fontSize: 13, color: C.muted };

export default function HomeClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  // null = still loading, "error" = could not load, array = loaded
  const [posts, setPosts] = useState<LoungePost[] | "error" | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [logged, setLogged] = useState<ActivityEventRecord[]>([]);

  useEffect(() => {
    let active = true;
    let shownProfile = "";
    async function load() {
      setLoading(true);
      setError("");
      try {
        const status = await getOnboardingStatus();
        if (!status.isAuthenticated) { router.replace("/login"); return; }
        if (status.needsOnboarding) { router.replace("/onboarding"); return; }
        const profile = status.activeProfile;
        shownProfile = profile?.id ?? "";
        setDisplayName(profile?.display_name ?? "");
        try { window.localStorage.setItem(FOCUS_LS_KEY, profile?.primary_focus ?? ""); } catch { /* ignore */ }
        // The copy saved on this device is shown at once when it verifiably belongs to this person; the cloud download then updates it.
        // Home used to wait for the download with no limit, so a download that never answered left it on "Loading Home…" for good.
        const signedInAs = storedSessionUserId();
        const deviceCopyUsable = !!signedInAs && !!profile?.id && currentLocalOwner() === signedInAs && loadItems().length > 0;
        const pull = syncVaultItemsFromSupabaseChecked().then((r) => r.ok).catch(() => false);
        let answered = true;
        if (deviceCopyUsable) {
          void pull.then(() => { if (active) { setItems(loadItems()); setPendingSync(getPendingVaultSyncCount()); } });
        } else {
          answered = await Promise.race([pull, new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), HOME_CLOUD_WAIT_MS))]);
        }
        void syncPublicProfile(profile?.id ?? undefined);
        if (!active) return;
        if (!deviceCopyUsable && !answered && loadItems().length === 0) {
          // Nothing on this device and the cloud did not answer: that is a failed load, not an empty collection.
          setError("We could not load your collection just now. Your items are safe: nothing has been changed or lost. Reload the page to try again.");
          return;
        }
        setItems(loadItems());
        setPendingSync(getPendingVaultSyncCount());
        try { setLogged(loadActivityEvents()); } catch { setLogged([]); }
        void refreshGalleriesFromSupabase(true).then(() => {
          if (active) setGalleries(loadGalleries().filter((g) => g.state === "ACTIVE"));
        });
        setGalleries(loadGalleries().filter((g) => g.state === "ACTIVE"));
        // Real posts only. Comment activity is not available here, so these are the most recent posts.
        void listLoungePosts(profile?.id ?? "", 20)
          .then((rows) => { if (active) setPosts([...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)); })
          .catch(() => { if (active) setPosts("error"); });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load Home.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();

    // Items that arrive after the first paint (a finished upload, a cloud download, another page saving) and a switch of the
    // active profile must change what Home shows without a reload. Reading the device copy is cheap, so it is debounced only.
    let refreshTimer: number | undefined;
    const onVaultUpdated = () => {
      if (refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        if (!active) return;
        setItems(loadItems());
        setPendingSync(getPendingVaultSyncCount());
      }, 120);
    };
    // Only a real change of the active profile (or sign-out) reloads; the one-time self-correction during load does not.
    const onProfileChanged = () => { if (active && getStoredActiveProfileId() !== shownProfile) void load(); };
    window.addEventListener("vltd:vault-updated", onVaultUpdated);
    window.addEventListener("vltd:active-profile", onProfileChanged);
    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      window.removeEventListener("vltd:vault-updated", onVaultUpdated);
      window.removeEventListener("vltd:active-profile", onProfileChanged);
    };
  }, [router]);

  // How totals treat un-priced items. "fill" (default): at purchase price. "priced": only items with a real value.
  const [valueMode, setValueMode] = useState<ValueMode>("fill");
  useEffect(() => {
    const sync = () => setValueMode(readValueMode());
    sync();
    window.addEventListener("vltd:value-mode", sync);
    return () => window.removeEventListener("vltd:value-mode", sync);
  }, []);
  const toggleValueMode = () => writeValueMode(valueMode === "fill" ? "priced" : "fill");

  // The same shared totals as the Vault and Insights (sold items excluded), so Home never counts differently.
  const stats = useMemo(() => {
    const s = computeVaultStats(items, valueMode);
    return { totalItems: s.itemCount, totalCost: s.totalCost, totalValue: s.totalValue, totalGain: s.totalGain, gainPct: s.gainPct, costBase: s.costBase, gainItemCount: s.gainItemCount, gainExcluded: s.gainExcluded, pricedCount: s.pricedCount, ghostCount: s.ghostCount };
  }, [items, valueMode]);
  // Realized sales: the same numbers as /vault/sold (shared code). Never mixed with the estimates above.
  const sales = useMemo(() => {
    const s = soldStats(buildSoldItems(items));
    return { count: s.count, revenue: s.realizedRevenue, profit: s.totalProfit, profitCount: s.profitCount, unknownCostCount: s.unknownCostCount };
  }, [items]);
  const [basisOpen, setBasisOpen] = useState(false);
  const soldRows = useMemo(() => buildSoldItems(items), [items]);

  // Recently added and the price-check notice describe what you currently own: sold, supply and wishlist records are left out,
  // the same rule the Vault, Insights and the recap use.
  const owned = useMemo(() => activeItems(items), [items]);
  const recentAll = useMemo(() => [...owned].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)), [owned]);
  const recent = useMemo(() => recentAll.slice(0, RECENT_LIMIT), [recentAll]);
  const latestAddedAt = recentAll.length > 0 ? itemTimestamp(recentAll[0]) : 0;
  const staleChecks = useMemo(() => owned.filter((item) => effectiveMarketValue(item) > 0 && priceCheckIsStale(item)).length, [owned]);

  // Unrealized change: only items with BOTH a value and a cost; the display setting below never changes it.
  const gainKnown = stats.gainItemCount > 0 && stats.gainPct !== null;
  const gainExcludedText = describeGainExclusions({ noValueCount: stats.gainExcluded.noValue, noCostCount: stats.gainExcluded.noCost, zeroCostCount: stats.gainExcluded.zeroCost });
  const gainTone = stats.totalGain >= 0 ? ("gain" as const) : ("loss" as const);
  const gainSign = stats.totalGain >= 0 ? "+" : "-";
  const gainText = gainKnown ? (
    <>
      {gainSign}{formatMoney(Math.abs(stats.totalGain))} <span className="vltd-keep-color" style={{ fontSize: 15, fontWeight: 700 }}>({gainSign}{Math.abs(stats.gainPct ?? 0).toFixed(1)}%)</span>
    </>
  ) : "—";
  const valueIsGhost = valueMode === "fill" && stats.ghostCount > 0;
  const valueCaption =
    stats.pricedCount === 0
      ? "No item has a value yet"
      : valueMode === "fill"
        ? stats.ghostCount > 0 ? `${stats.pricedCount} of ${stats.totalItems} priced · ${stats.ghostCount} counted at cost` : "All items priced"
        : `${stats.pricedCount} of ${stats.totalItems} priced · ${stats.ghostCount} left out`;
  // The valuation basis, stated plainly.
  const basis =
    valueMode === "fill"
      ? stats.ghostCount > 0
        ? `${stats.ghostCount} of ${stats.totalItems} counted at purchase price`
        : "All items priced"
      : `${stats.pricedCount} of ${stats.totalItems} priced`;

  const notices: { key: string; text: string; href: string; cta: string }[] = [];
  if (pendingSync > 0) notices.push({ key: "sync", text: `${pendingSync} change${pendingSync === 1 ? "" : "s"} waiting to upload to your account.`, href: "/account?section=data", cta: "Review sync" });
  if (staleChecks > 0) notices.push({ key: "price", text: `${staleChecks} valued item${staleChecks === 1 ? " has" : "s have"} not had a price check in 6 months.`, href: "/vault", cta: "Open Vault" });

  // Summary panels: only numbers that already exist in this account. Nothing is estimated or looked up.
  const mix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of owned) {
      const key = isUniverseKey(String(item.universe ?? "").toUpperCase()) ? String(item.universe).toUpperCase() : "MISC";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { total: owned.length, kinds: rows.length, top: rows.slice(0, 4).map(([key, value]) => ({ label: UNIVERSE_LABEL[key as keyof typeof UNIVERSE_LABEL] ?? key, value, text: String(value) })) };
  }, [owned]);
  const salesMonths = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: d.getFullYear() * 12 + d.getMonth(), label: d.toLocaleDateString("en-US", { month: "short" }), revenue: 0, profit: 0, known: 0 };
    });
    for (const row of soldRows) {
      const when = new Date(Number(row.soldAt));
      const key = when.getFullYear() * 12 + when.getMonth();
      const bucket = months.find((m) => m.key === key);
      if (bucket) {
        bucket.revenue += Number(row.soldPrice ?? 0);
        if (hasKnownCost(row)) { bucket.profit += profitOf(row); bucket.known += 1; }
      }
    }
    return months;
  }, [soldRows]);
  const recentActivity = useMemo(() => {
    const rows: { id: string; text: string; at: number; tone: string }[] = [];
    for (const item of owned) { const at = Number(item.createdAt ?? 0); if (at > 0) rows.push({ id: "a" + item.id, text: `Added ${item.title || "an item"}`, at, tone: INSIGHTS_REVENUE }); }
    for (const sold of soldRows) { const at = Number(sold.soldAt); if (at > 0) rows.push({ id: "s" + sold.id, text: `Sold ${sold.title || "an item"} for ${formatMoney(Number(sold.soldPrice ?? 0))}`, at, tone: INSIGHTS_GREEN }); }
    for (const event of logged) { if (event.timestamp > 0) rows.push({ id: "e" + event.id, text: [event.subtitle, event.title].filter(Boolean).join(": "), at: event.timestamp, tone: C.gold }); }
    return rows.sort((a, b) => b.at - a.at).slice(0, 4);
  }, [owned, soldRows, logged]);

  const learn = LEARN_ARTICLES[0];

  if (loading) return (
    <main style={{ minHeight: "100vh", padding: "32px 22px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: C.card, border: `1px solid ${C.bd}`, borderRadius: 10, padding: 16, fontSize: 13, color: C.muted }}>Loading Home…</div>
    </main>
  );
  if (error) return (
    <main style={{ minHeight: "100vh", padding: "32px 22px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.30)", borderRadius: 10, padding: 16, color: C.red }}>{error}</div>
    </main>
  );

  return (
    <main style={{ color: C.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }} className="px-4 py-5 sm:px-5 lg:px-7">

        <SeasonalBanner />

        {/* 1. Collection overview: heading with the add controls beside it, four separate money figures with the value-basis controls above them, then three summary panels that each open their full page */}
        <section aria-label="Collection overview" style={{ background: C.elevated, border: premiumBorder, borderRadius: 10, padding: "20px 24px 22px", boxShadow: premiumShadow }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>
                {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
              </div>
              <h1 style={{ fontFamily: C.r, fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 4 }}>{displayName || "Curator"}</h1>
              {stats.totalItems === 0 && sales.count === 0 ? null : (
                <div style={{ marginTop: 8 }}>
                  <PillButton href="/vault" ariaLabel={`Open your Vault: ${stats.totalItems} ${stats.totalItems === 1 ? "item" : "items"}`}>{stats.totalItems} {stats.totalItems === 1 ? "item" : "items"} · Open Vault</PillButton>
                </div>
              )}
            </div>
            <span className="hidden md:inline-flex"><AddItemActions /></span>
          </div>

          {stats.totalItems === 0 && sales.count === 0 ? (
            <p style={{ fontSize: 15, color: C.muted, marginTop: 10 }}>Scan your first item to start building a real collection record.</p>
          ) : (
            <>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px 16px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 11, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>Collection overview</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: C.muted }}>
                  <span>Value basis: {basis}</span>
                  <TextAction onClick={toggleValueMode}>{valueMode === "fill" ? "Show priced only" : "Include unpriced"}</TextAction>
                  <TextAction onClick={() => setBasisOpen((open) => !open)} ariaExpanded={basisOpen} ariaControls="home-basis-explainer">What does this change?</TextAction>
                </div>
              </div>
              {basisOpen ? (
                <div id="home-basis-explainer" style={{ marginTop: 8, border: `1px solid ${C.bd2}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>
                  <p><b style={{ color: C.text }}>Purchase cost</b>: every item you own. The setting does not change it.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Estimated value</b>: <i>Include unpriced</i> counts items without a value at their purchase price, in grey. <i>Priced only</i> leaves them out, so the number is smaller.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Unrealized change</b>: value minus cost, measured only on items that have both a value and a recorded cost (the caption says how many, their cost, and what was not counted: no value, no recorded cost, or a price entered as $0). The setting does not change it.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Sales revenue</b>: real sales only, never mixed with estimates. Profit is after estimated seller fees. The setting does not change it. Sold items are never in the other three figures.</p>
                </div>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <MoneyTile href="/portfolio#cost-breakdown" label="Purchase cost" value={formatMoney(stats.totalCost)} caption="What you paid, with tax, shipping and fees" go="Cost breakdown" />
                <MoneyTile href="/portfolio#value-history" label="Estimated value" value={valueMode === "priced" && stats.pricedCount === 0 ? "—" : formatMoney(stats.totalValue)} tone="gold" ghost={valueIsGhost} caption={valueCaption} go="Value history" />
                <MoneyTile href="/portfolio#movers" label="Unrealized change" value={gainText} tone={gainKnown ? gainTone : "default"} ghost={!gainKnown} caption={gainKnown ? `On ${stats.gainItemCount} of ${stats.totalItems} items · cost basis ${formatMoney(stats.costBase)}` : "Needs an item with both a value and a recorded cost"} extra={gainExcludedText ? <span style={{ fontSize: 12, lineHeight: 1.35, color: C.muted }}>Not counted: {gainExcludedText}</span> : undefined} go="Biggest movers" />
                <MoneyTile
                  href="/vault/sold#sales-analytics"
                  label="Sales revenue"
                  value={sales.count > 0 ? formatMoney(sales.revenue) : "—"}
                  caption={sales.count > 0 ? `${sales.count} sold` : "No sales yet"}
                  extra={sales.count > 0 ? (
                    <span style={{ fontSize: 12, lineHeight: 1.35, color: C.muted }}>
                      {sales.profitCount > 0 ? (
                        <>Profit <b style={{ color: sales.profit >= 0 ? C.green : C.red }}>{sales.profit >= 0 ? "+" : "-"}{formatMoney(Math.abs(sales.profit))}</b> after estimated fees</>
                      ) : (
                        <>Profit unknown: no cost recorded</>
                      )}
                      {sales.unknownCostCount > 0 && sales.profitCount > 0 ? <>. Not counted: {sales.unknownCostCount} sold without a recorded cost</> : null}
                    </span>
                  ) : undefined}
                  go="Sales analytics"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <SummaryPanel href="/portfolio" title="Insights" glyph="chart">
                  {mix.total === 0 ? (
                    <span style={{ fontSize: 12, color: C.muted }}>Add items to see how your collection is spread out.</span>
                  ) : (
                    <>
                      <MiniBars rows={mix.top} />
                      <span style={{ fontSize: 12, color: C.muted }}>{mix.total} {mix.total === 1 ? "item" : "items"} across {mix.kinds} {mix.kinds === 1 ? "universe" : "universes"}</span>
                    </>
                  )}
                </SummaryPanel>
                <SummaryPanel href="/vault/sold#sales-analytics" title="Sales analytics" glyph="tag">
                  {sales.count === 0 ? (
                    <span style={{ fontSize: 12, color: C.muted }}>No sales yet. Sales you record show up here by month.</span>
                  ) : (
                    <>
                      <MonthColumns months={salesMonths} />
                      <span style={{ fontSize: 12, color: C.muted }}>
                        {formatMoney(sales.revenue)} from {sales.count} sold · {sales.profitCount > 0 ? (<>profit <b style={{ color: sales.profit >= 0 ? C.green : C.red }}>{sales.profit >= 0 ? "+" : "-"}{formatMoney(Math.abs(sales.profit))}</b> after estimated fees{sales.unknownCostCount > 0 ? <> (not counting {sales.unknownCostCount} sold without a recorded cost)</> : null}</>) : <>profit unknown: no cost recorded</>}
                      </span>
                    </>
                  )}
                </SummaryPanel>
                <SummaryPanel href="/activity" title="Activity" glyph="clock">
                  {recentActivity.length === 0 ? (
                    <span style={{ fontSize: 12, color: C.muted }}>No activity yet. Additions, sales and value changes appear here.</span>
                  ) : (
                    <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {recentActivity.map((row) => (
                        <span key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, fontSize: 12 }}>
                          <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><i aria-hidden="true" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: row.tone, marginRight: 7 }} />{row.text}</span>
                          <span style={{ color: C.muted }}>{timeAgo(row.at)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </SummaryPanel>
              </div>
            </>
          )}
        </section>

        {/* Notices appear only when there is something to act on */}
        {notices.length > 0 ? (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -10 }}>
            {notices.map((n) => (
              <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 14px", borderRadius: 8, background: "rgba(240,195,106,0.10)", border: "1px solid rgba(240,195,106,0.35)", fontSize: 13 }}>
                <span>{n.text}</span>
                <PillButton href={n.href}>{n.cta}</PillButton>
              </div>
            ))}
          </div>
        ) : null}

        {/* 2 and 3. Recently added (left) and Your exhibitions (right) side by side on a desktop; stacked on a phone */}
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <Block label="Recently added" labelLink={{ href: "/vault", text: "View Vault" }}>
            {recent.length === 0 ? (
              <div style={quiet}>No items yet. Add your first collectible.</div>
            ) : (
              <div>
                <SwipeStrip label="Recently added items" caption={<span data-testid="recent-count">{recentAll.length.toLocaleString()} {recentAll.length === 1 ? "item" : "items"} in your Vault
                  {latestAddedAt > 0 ? <> · newest added {new Date(latestAddedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</> : null}
                  {recentAll.length > recent.length ? <> · browsing the newest {recent.length}</> : null}</span>}>
                  {recent.map((item) => {
                    const v = totalsValue(item);
                    return (
                      <Link key={item.id} href={"/vault/item/" + item.id} data-recent-item={item.id} draggable={false} className="w-[132px] shrink-0 snap-start" style={{ display: "block", textDecoration: "none", border: `1px solid ${C.bd}`, borderRadius: 8, background: C.elevated, overflow: "hidden" }}>
                        <div style={{ height: 120, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                          {item.imageFrontUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageFrontUrl} alt="" loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : <Glyph name="box" size={22} />}
                        </div>
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{v.amount > 0 ? (v.isGhost ? formatMoney(v.amount) + " at cost" : formatMoney(v.amount)) : "Not valued"}</div>
                        </div>
                      </Link>
                    );
                  })}
                </SwipeStrip>
              </div>
            )}
          </Block>

          <Block
            label="Your exhibitions"
            labelLink={{ href: "/museum", text: "All exhibitions", ariaLabel: "Open all exhibitions" }}
            action={<PillButton href="/museum/new">Create exhibition</PillButton>}
          >
            {galleries.length > 0 ? (
              <ExhibitionCarousel galleries={galleries} />
            ) : (
              <div style={quiet}>No exhibitions yet. Show a few pieces from your vault.</div>
            )}
          </Block>
        </div>

        {/* 4 and 5. From the Lounge, and a Learn preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Block label="From the Lounge" labelLink={{ href: "/community-board", text: "Open Lounge" }}>
            {posts === null ? (
              <div style={quiet}>Loading posts…</div>
            ) : posts === "error" ? (
              <div style={quiet}>Posts could not be loaded right now.</div>
            ) : posts.length === 0 ? (
              <div style={quiet}>No posts yet.</div>
            ) : (
              <div>
                <div style={{ padding: "8px 16px 0", fontSize: 10, letterSpacing: "1.4px", textTransform: "uppercase", color: C.muted, fontWeight: 800 }}>Recent posts</div>
                {posts.map((post) => (
                  <Link key={post.id} href={"/community-board?post=" + encodeURIComponent(post.id)} style={{ display: "block", padding: "12px 16px", textDecoration: "none", borderBottom: `1px solid ${C.bd2}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: C.muted }}>
                      <span style={{ fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.authorName}</span>
                      <span style={{ flexShrink: 0 }}>{timeAgo(post.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 3 }}>{post.title}</div>
                    {post.body ? <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{excerpt(post.body)}</div> : null}
                  </Link>
                ))}
              </div>
            )}
          </Block>

          <Block label="Learn" labelLink={{ href: "/learn", text: "Open Learn" }}>
            {learn ? (
              <Link href={"/learn/" + learn.slug} style={{ display: "block", padding: "14px 16px", textDecoration: "none" }}>
                <div style={{ fontSize: 11, color: C.muted }}>{learn.category} · {learn.readMinutes} min read</div>
                <div style={{ fontFamily: C.r, fontSize: 19, fontWeight: 700, color: C.text, marginTop: 4, lineHeight: 1.15 }}>{learn.title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{excerpt(learn.dek, 150)}</div>
              </Link>
            ) : (
              <div style={quiet}>Guides on documenting, pricing and protecting your collection.</div>
            )}
          </Block>
        </div>

      </div>
    </main>
  );
}
