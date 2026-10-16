"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AddItemActions from "@/components/AddItemActions";
import SeasonalBanner from "@/components/SeasonalBanner";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import { getOnboardingStatus } from "@/lib/auth";
import { loadGalleries, refreshGalleriesFromSupabase, type Gallery } from "@/lib/galleryModel";
import { LEARN_ARTICLES } from "@/lib/learnContent";
import { listLoungePosts, type LoungePost } from "@/lib/loungePosts";
import { priceCheckIsStale } from "@/lib/pricingMvp";
import { syncPublicProfile } from "@/lib/publicProfile";
import { buildSoldItems, soldStats } from "@/lib/soldItems";
import { activeItems, computeVaultStats, effectiveMarketValue, readValueMode, totalsValue, writeValueMode, type ValueMode } from "@/lib/vaultStats";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
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

function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

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
      <span style={{ fontFamily: C.r, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color }}>{value}</span>
      <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{caption}</span>
      {extra}
      <span style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: C.gold }}>{go} ›</span>
    </Link>
  );
}

// ── A labelled destination: where the detail behind the summary lives ──
function DestinationCard({ href, title, text, glyph }: { href: string; title: string; text: string; glyph: "chart" | "tag" | "clock" }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-start gap-3 rounded-[8px] p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)]"
      style={{ border: `1px solid ${C.bd2}`, background: C.elevated, textDecoration: "none", color: "inherit" }}
    >
      <span style={{ flex: "none", color: C.gold, marginTop: 1 }}><Glyph name={glyph} size={22} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{title} ›</span>
        <span style={{ display: "block", fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{text}</span>
      </span>
    </Link>
  );
}

// ── Card with a header: label on the left, one link on the right ──
function Block({ label, link, children }: { label: string; link?: { href: string; text: string }; children: React.ReactNode }) {
  return (
    <section style={{ background: panelBg, border: premiumBorder, borderRadius: 8, overflow: "hidden", boxShadow: premiumShadow }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.bd2}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ fontSize: 10, letterSpacing: "1.8px", textTransform: "uppercase", color: C.muted, fontWeight: 800 }}>{label}</h2>
        {link ? <PillButton href={link.href}>{link.text}</PillButton> : null}
      </div>
      {children}
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

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const status = await getOnboardingStatus();
        if (!status.isAuthenticated) { router.replace("/login"); return; }
        if (status.needsOnboarding) { router.replace("/onboarding"); return; }
        const profile = status.activeProfile;
        setDisplayName(profile?.display_name ?? "");
        try { window.localStorage.setItem(FOCUS_LS_KEY, profile?.primary_focus ?? ""); } catch { /* ignore */ }
        await syncVaultItemsFromSupabase();
        void syncPublicProfile(profile?.id ?? undefined);
        if (!active) return;
        setItems(loadItems());
        setPendingSync(getPendingVaultSyncCount());
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
    return () => { active = false; };
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
    return { totalItems: s.itemCount, totalCost: s.totalCost, totalValue: s.totalValue, totalGain: s.totalGain, gainPct: s.gainPct, costBase: s.costBase, gainItemCount: s.gainItemCount, pricedCount: s.pricedCount, ghostCount: s.ghostCount };
  }, [items, valueMode]);
  // Realized sales: the same numbers as /vault/sold (shared code). Never mixed with the estimates above.
  const sales = useMemo(() => {
    const s = soldStats(buildSoldItems(items));
    return { count: s.count, revenue: s.realizedRevenue, profit: s.totalProfit };
  }, [items]);
  const [basisOpen, setBasisOpen] = useState(false);

  // Recently added and the price-check notice describe what you currently own: sold, supply and wishlist records are left out,
  // the same rule the Vault, Insights and the recap use.
  const owned = useMemo(() => activeItems(items), [items]);
  const recent = useMemo(() => [...owned].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)).slice(0, 6), [owned]);
  const staleChecks = useMemo(() => owned.filter((item) => effectiveMarketValue(item) > 0 && priceCheckIsStale(item)).length, [owned]);

  // Unrealized change: only items with BOTH a value and a cost; the display setting below never changes it.
  const gainKnown = stats.gainItemCount > 0 && stats.gainPct !== null;
  const gainTone = stats.totalGain >= 0 ? ("gain" as const) : ("loss" as const);
  const gainSign = stats.totalGain >= 0 ? "+" : "-";
  const gainText = gainKnown ? (
    <>
      {gainSign}{formatMoney(Math.abs(stats.totalGain))} <span style={{ fontSize: 15, fontWeight: 700 }}>({gainSign}{Math.abs(stats.gainPct ?? 0).toFixed(1)}%)</span>
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

        {/* 1. Collection overview: item count, four separate money figures, labelled destinations, entry controls */}
        <section aria-label="Collection overview" style={{ background: C.elevated, border: premiumBorder, borderRadius: 10, padding: "24px 26px", boxShadow: premiumShadow }}>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>
            {stats.totalItems === 0 ? "Your vault is ready," : "Welcome back,"}
          </div>
          <h1 style={{ fontFamily: C.r, fontSize: 36, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>{displayName || "Curator"}</h1>

          {stats.totalItems === 0 && sales.count === 0 ? (
            <p style={{ fontSize: 15, color: C.muted, marginTop: 10 }}>Scan your first item to start building a real collection record.</p>
          ) : (
            <>
              <div style={{ marginTop: 10 }}>
                <PillButton href="/vault" ariaLabel={`Open your Vault: ${stats.totalItems} ${stats.totalItems === 1 ? "item" : "items"}`}>{stats.totalItems} {stats.totalItems === 1 ? "item" : "items"} · Open Vault</PillButton>
              </div>

              <h2 style={{ marginTop: 20, fontSize: 11, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>Collection overview</h2>
              <div className="mt-2 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <MoneyTile href="/portfolio#cost-breakdown" label="Purchase cost" value={formatMoney(stats.totalCost)} caption="What you paid, with tax, shipping and fees" go="Cost breakdown" />
                <MoneyTile href="/portfolio#value-history" label="Estimated value" value={valueMode === "priced" && stats.pricedCount === 0 ? "—" : formatMoney(stats.totalValue)} tone="gold" ghost={valueIsGhost} caption={valueCaption} go="Value history" />
                <MoneyTile href="/portfolio#movers" label="Unrealized change" value={gainText} tone={gainKnown ? gainTone : "default"} ghost={!gainKnown} caption={gainKnown ? `On ${stats.gainItemCount} of ${stats.totalItems} items · cost basis ${formatMoney(stats.costBase)}` : "Needs an item with both a value and a cost"} go="Biggest movers" />
                <MoneyTile
                  href="/vault/sold#sales-analytics"
                  label="Sales revenue"
                  value={sales.count > 0 ? formatMoney(sales.revenue) : "—"}
                  caption={sales.count > 0 ? `${sales.count} sold` : "No sales yet"}
                  extra={sales.count > 0 ? (
                    <span style={{ fontSize: 12, lineHeight: 1.35, color: C.muted }}>
                      Profit <b style={{ color: sales.profit >= 0 ? C.green : C.red }}>{sales.profit >= 0 ? "+" : "-"}{formatMoney(Math.abs(sales.profit))}</b> after estimated fees
                    </span>
                  ) : undefined}
                  go="Sales analytics"
                />
              </div>

              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.muted }}>Value basis: {basis}</span>
                <PillButton onClick={toggleValueMode}>{valueMode === "fill" ? "Show priced only" : "Include unpriced"}</PillButton>
                <PillButton onClick={() => setBasisOpen((open) => !open)} ariaExpanded={basisOpen} ariaControls="home-basis-explainer">What does this change?</PillButton>
              </div>
              {basisOpen ? (
                <div id="home-basis-explainer" style={{ marginTop: 10, border: `1px solid ${C.bd2}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>
                  <p><b style={{ color: C.text }}>Purchase cost</b>: every item you own. The setting does not change it.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Estimated value</b>: <i>Include unpriced</i> counts items without a value at their purchase price, in grey. <i>Priced only</i> leaves them out, so the number is smaller.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Unrealized change</b>: value minus cost, measured only on items that have both a value and a cost (the caption says how many and their cost). The setting does not change it.</p>
                  <p style={{ marginTop: 6 }}><b style={{ color: C.text }}>Sales revenue</b>: real sales only, never mixed with estimates. Profit is after estimated seller fees. The setting does not change it. Sold items are never in the other three figures.</p>
                </div>
              ) : null}

              <h2 style={{ marginTop: 20, fontSize: 11, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>Go deeper</h2>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <DestinationCard href="/portfolio" title="Insights" text="Value history, biggest movers, stale prices and documentation" glyph="chart" />
                <DestinationCard href="/vault/sold#sales-analytics" title="Sales analytics" text="Revenue and profit after estimated fees, by month" glyph="tag" />
                <DestinationCard href="/activity" title="Activity" text="Recent value changes, sales and additions" glyph="clock" />
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span className="hidden md:inline-flex"><AddItemActions /></span>
          </div>
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

        {/* 2. Recently added: up to six items; a short row you can swipe on a phone */}
        <Block label="Recently added" link={{ href: "/vault", text: "View Vault" }}>
          {recent.length === 0 ? (
            <div style={quiet}>No items yet. Add your first collectible.</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto p-3 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6">
              {recent.map((item) => {
                const v = totalsValue(item);
                return (
                  <Link key={item.id} href={"/vault/item/" + item.id} className="w-[132px] shrink-0 md:w-auto" style={{ display: "block", textDecoration: "none", border: `1px solid ${C.bd}`, borderRadius: 8, background: C.elevated, overflow: "hidden" }}>
                    <div style={{ height: 120, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                      {item.imageFrontUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageFrontUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : <Glyph name="box" size={22} />}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{v.amount > 0 ? (v.isGhost ? formatMoney(v.amount) + " at cost" : formatMoney(v.amount)) : "Not valued"}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Block>

        {/* 3. Your exhibitions: one compact preview */}
        <Block label="Your exhibitions" link={{ href: "/museum", text: "View all" }}>
          <div style={{ padding: 14, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {galleries.length > 0 ? (
              <Link href={"/gallery/" + galleries[0].id} style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ width: 96, height: 72, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.bd}`, background: C.card, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                  {galleries[0].coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={galleries[0].coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : <Glyph name="exhibition" size={22} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: C.r, fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{galleries[0].title || "Untitled"}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{galleries[0].itemIds?.length ?? 0} piece{(galleries[0].itemIds?.length ?? 0) === 1 ? "" : "s"}</div>
                </div>
              </Link>
            ) : (
              <div style={{ flex: "1 1 260px", fontSize: 13, color: C.muted }}>No exhibitions yet. Show a few pieces from your vault.</div>
            )}
            <PillButton href="/museum/new">Create exhibition</PillButton>
          </div>
        </Block>

        {/* 4 and 5. From the Lounge, and a Learn preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Block label="From the Lounge" link={{ href: "/community-board", text: "Open Lounge" }}>
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

          <Block label="Learn" link={{ href: "/learn", text: "Open Learn" }}>
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
