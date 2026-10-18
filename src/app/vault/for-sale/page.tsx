"use client";

import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";

import { itemToListingInput } from "@/lib/listingGenerator";
import { INSIGHTS_AMBER } from "@/lib/insightsPalette";
import { marketplacesFor, type MarketplaceId } from "@/lib/marketplaces";
import { resolveCategoryLabel } from "@/lib/taxonomy";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { getPrimaryImageUrl, loadItems, saveItem, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

type Platform = "EBAY" | "WHATNOT" | "MERCARI" | "DISCOGS" | "PWCC";
type SaleRecord = VaultItem & { soldPrice: number; soldAt: number; salePlatform?: string };

const PLATFORM_OF: Record<MarketplaceId, Platform> = { ebay: "EBAY", mercari: "MERCARI", whatnot: "WHATNOT", pwcc: "PWCC", discogs: "DISCOGS" };
const PLATFORM_LABEL: Record<Platform, string> = { EBAY: "eBay", WHATNOT: "Whatnot", MERCARI: "Mercari", DISCOGS: "Discogs", PWCC: "Fanatics Collect" };

// Only the marketplaces that suit this item's category (the same rule Cost to Sell and Listing Copy use: lib/marketplaces.ts).
function marketsFor(item: VaultItem): Platform[] {
  const place = { universe: item.universe, category: resolveCategoryLabel(item), subcategory: item.subcategoryLabel };
  return marketplacesFor(place).map((id) => PLATFORM_OF[id]);
}

// Per-marketplace required / recommended fields
function platformGaps(item: VaultItem, platform: Platform): string[] {
  const gaps: string[] = [];
  const inp = itemToListingInput(item);
  const price = Number(item.askingPrice ?? item.currentValue ?? item.estimatedValue ?? 0);

  // Universal
  if (!item.title?.trim())       gaps.push("Title missing");
  if (!price)                    gaps.push("Price not set");

  // Marketplace-specific
  if (platform === "EBAY") {
    if (!item.grade?.trim())     gaps.push("Condition / grade");
    if (!item.notes?.trim() && !inp.description?.trim()) gaps.push("Item description");
    if (!item.category && !item.categoryLabel) gaps.push("Category");
    if (/psa|bgs|cgc|beckett/i.test(item.grade ?? "") && !item.certNumber) gaps.push("Cert number (graded)");
  }
  if (platform === "WHATNOT") {
    if (!item.grade?.trim())     gaps.push("Condition / grade");
    if (!item.universe && !item.category) gaps.push("Universe or category");
  }
  if (platform === "MERCARI") {
    if (!item.grade?.trim())     gaps.push("Condition / grade");
    if (!item.notes?.trim() && !inp.description?.trim()) gaps.push("Item description");
  }
  if (platform === "DISCOGS") {
    if (!item.serialNumber) gaps.push("Catalog / serial number");
    if (!item.grade?.trim()) gaps.push("Media condition");
  }
  if (platform === "PWCC") {
    if (!/psa|bgs|cgc|beckett|slab/i.test(item.grade ?? "")) gaps.push("Graded item preferred");
    if (!item.certNumber) gaps.push("Cert number required");
    if (price < 500)            gaps.push("Value typically ≥ $500");
  }

  return gaps;
}

// One explanation per item: what is missing for ALL the marketplaces that fit it, then what only some of them also want.
function readinessReport(item: VaultItem) {
  const markets = marketsFor(item);
  const per = markets.map((p) => ({ p, gaps: platformGaps(item, p) }));
  const common = per.length ? per[0].gaps.filter((g) => per.every((x) => x.gaps.includes(g))) : [];
  const extra = per.map((x) => ({ p: x.p, gaps: x.gaps.filter((g) => !common.includes(g)) })).filter((x) => x.gaps.length > 0);
  return { markets, common, extra, readyEverywhere: per.length > 0 && per.every((x) => x.gaps.length === 0) };
}

function readinessScore(item: VaultItem): number {
  let score = 0;
  if (item.title?.trim())        score += 20;
  const price = Number(item.askingPrice ?? item.currentValue ?? 0);
  if (price > 0)                 score += 20;
  if (item.grade?.trim())        score += 20;
  const hasPhoto = !!getPrimaryImageUrl(item);
  if (hasPhoto)                  score += 20;
  if (item.notes?.trim()) score += 20;
  return score;
}

function money(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
}
function parseMoney(s: string) {
  const v = Number(s.replace(/[^0-9.-]/g, "").trim());
  return Number.isFinite(v) ? v : undefined;
}
function readSales(): SaleRecord[] {
  try { const p: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]"); return Array.isArray(p) ? (p as SaleRecord[]) : []; }
  catch { return []; }
}
function writeSales(d: SaleRecord[]) { localStorage.setItem(SALES_KEY, JSON.stringify(d)); }

const AMBER = INSIGHTS_AMBER;

// ─── ReadinessBar: green when ready, amber when information is missing (missing information is not a loss) ───

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : AMBER;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[10px] font-semibold vltd-keep-color" style={{ "--vltd-keep-color": color } as React.CSSProperties}>{score}%</span>
    </div>
  );
}

// ─── ItemCard: one compact card per item ──────────────────────────────────────

function ItemCard({ item, onMarkSold }: { item: VaultItem; onMarkSold: (item: VaultItem) => void }) {
  const [askingInput, setAskingInput] = useState(item.askingPrice != null ? String(item.askingPrice) : "");
  const [priceSaved, setPriceSaved] = useState(false);
  const askRef = useRef<HTMLInputElement>(null);
  const imageUrl = getPrimaryImageUrl(item);
  const score = readinessScore(item);
  const price = Number(item.askingPrice ?? item.currentValue ?? item.estimatedValue ?? 0);
  const report = useMemo(() => readinessReport(item), [item]);
  const editHref = `/vault/item/${encodeURIComponent(item.id)}`;

  function handlePriceSet() {
    const parsed = parseMoney(askingInput);
    const updated = { ...item, askingPrice: parsed };
    saveItem(updated);
    enqueueVaultItemSync(updated.id);
    void processVaultSyncQueue();
    window.dispatchEvent(new Event("vltd:vault-updated"));
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 2000);
  }

  const chipStyle = { background: "rgba(227,179,65,0.10)", border: "1px solid rgba(227,179,65,0.35)", "--vltd-keep-color": AMBER } as React.CSSProperties;
  const chipClass = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold vltd-keep-color hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--pill-active-ring)]";

  return (
    <article className="flex h-full min-w-0 flex-col rounded-[8px] p-3 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px]" style={{ background: "var(--pill)" }}>
          {imageUrl
            ? <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} /> // eslint-disable-line @next/next/no-img-element
            : <div className="flex h-full w-full items-center justify-center text-[10px]" style={{ color: "var(--muted)" }}>No photo</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--fg)" }}>{item.title}</div>
              <div className="mt-0.5 truncate text-xs" style={{ color: "var(--muted)" }}>
                {[item.universe, item.grade].filter(Boolean).join(" · ") || "No details yet"}
              </div>
            </div>
            <div className="shrink-0 text-sm font-bold" style={{ color: price > 0 ? "var(--theme-gold)" : "var(--muted)" }}>
              {price > 0 ? money(price) : "—"}
            </div>
          </div>
          <div className="mt-2"><ReadinessBar score={score} /></div>
        </div>
      </div>

      {/* One explanation: what is missing, with a direct action for each */}
      <div className="mb-3 mt-2.5 text-xs" style={{ color: "var(--muted)" }}>
        {report.readyEverywhere ? (
          <div className="font-semibold vltd-keep-color" style={{ "--vltd-keep-color": "#4ade80" } as React.CSSProperties}>
            <AppIcon name="checkmark" size={12} className="mr-1 inline" />Has everything the checklist asks for
          </div>
        ) : (
          <>
            {report.common.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Add:</span>
                {report.common.map((g) =>
                  g === "Price not set" ? (
                    <button key={g} type="button" className={chipClass} style={chipStyle} onClick={() => askRef.current?.focus()}>
                      <Glyph name="warning" size={10} /> Asking price
                    </button>
                  ) : (
                    <Link key={g} href={editHref} className={chipClass} style={chipStyle} title="Open the item to add this">
                      <Glyph name="warning" size={10} /> {g}
                    </Link>
                  ),
                )}
              </div>
            ) : null}
            {report.extra.map((x) => (
              <div key={x.p} className="mt-1">
                Also for {PLATFORM_LABEL[x.p]}: {x.gaps.join(", ")}
              </div>
            ))}
          </>
        )}
        <div className="mt-1.5 text-[11px]">
          Suits {report.markets.map((p) => PLATFORM_LABEL[p]).join(", ")}. This is a checklist: nothing is listed for you.
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-3">
        <div className="flex items-center gap-1 overflow-hidden rounded-[8px] ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
          <span className="pl-2 text-xs" style={{ color: "var(--muted)" }}>$</span>
          <input
            ref={askRef}
            type="number"
            min="0"
            step="1"
            value={askingInput}
            onChange={(e) => setAskingInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePriceSet()}
            placeholder="Asking price"
            aria-label="Asking price"
            className="w-28 bg-transparent py-1.5 pr-1 text-xs focus:outline-none"
            style={{ color: "var(--fg)" }}
          />
          <PillButton size="compact" variant={priceSaved ? "success" : "active"} onClick={handlePriceSet} ariaLabel={priceSaved ? "Price saved" : "Set asking price"}>
            {priceSaved ? <AppIcon name="checkmark" size={14} /> : "Set"}
          </PillButton>
        </div>
        <PillButton href={editHref}>Edit item</PillButton>
        <PillButton onClick={() => onMarkSold(item)} style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", boxShadow: "none" }}>Mark sold</PillButton>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span className="text-lg font-bold" style={{ color: accent ? "var(--theme-gold)" : "var(--fg)" }}>{value}</span>
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

export default function ForSalePage() {
  const [items, setItems] = useState<VaultItem[]>(() => loadItems().filter(i => i.status === "FOR_SALE"));
  const [status, setStatus] = useState("");
  // Until the account has been read once, an empty list means "not loaded yet", not "nothing for sale".
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const reload = () => setItems(loadItems().filter((i) => i.status === "FOR_SALE"));
    void syncVaultItemsFromSupabase().catch(() => undefined).finally(() => {
      if (!active) return;
      reload();
      setHydrated(true);
    });
    window.addEventListener("vltd:vault-updated", reload);
    return () => {
      active = false;
      window.removeEventListener("vltd:vault-updated", reload);
    };
  }, []);

  const stats = useMemo(() => {
    const scores = items.map(readinessScore);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const totalAsk = items.reduce((s, i) => s + Number(i.askingPrice ?? i.currentValue ?? 0), 0);
    const fullyReady = items.filter(i => readinessScore(i) === 100).length;
    return { avgScore, totalAsk, fullyReady };
  }, [items]);

  // Items closest to ready first
  const sorted = useMemo(() => items.slice().sort((a, b) => readinessScore(b) - readinessScore(a)), [items]);

  async function handleMarkSold(item: VaultItem) {
    const priceInput = window.prompt("Sale price:", String(Number(item.askingPrice ?? item.currentValue ?? 0) || ""));
    if (!priceInput) return;
    const soldPrice = parseMoney(priceInput);
    if (soldPrice === undefined) { setStatus("Invalid price."); return; }
    const platformInput = window.prompt("Platform (eBay, Whatnot, in person…):", "eBay");
    const salePlatform = platformInput?.trim() || undefined;
    const soldItem: VaultItem = { ...item, status: "SOLD", soldPrice, soldAt: Date.now(), soldPlatform: salePlatform };
    const rec: SaleRecord = { ...soldItem, soldPrice, soldAt: Date.now(), salePlatform };
    writeSales([rec, ...readSales().filter(s => String(s.id) !== String(item.id))]);
    saveItem(soldItem);
    enqueueVaultItemSync(soldItem.id);
    setItems(cur => cur.filter(x => String(x.id) !== String(item.id)));
    await processVaultSyncQueue();
    window.dispatchEvent(new Event("vltd:vault-updated"));
    setStatus(`${item.title} sold for ${money(soldPrice)}${salePlatform ? ` on ${salePlatform}` : ""}.`);
  }

  return (
    <div data-for-sale style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-[1480px] px-4 pb-6 sm:px-6 lg:px-8">
        {items.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
            <Stat value={items.length} label="for sale" accent />
            <Stat value={stats.fullyReady} label="fully ready" />
            <Stat value={`${stats.avgScore}%`} label="avg readiness" />
            <Stat value={money(stats.totalAsk)} label="asking total" />
          </div>
        )}

        {status && (
          <div className="mb-3 rounded-[8px] px-4 py-2.5 text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>
            {status}
          </div>
        )}

        {items.length === 0 && !hydrated ? (
          <div role="status" className="rounded-[8px] px-6 py-8 text-center text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }}>
            Loading your items…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[8px] px-6 py-8 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="flex justify-center opacity-60"><Glyph name="tag" size={30} /></div>
            <div className="mt-3 text-base font-semibold" style={{ color: "var(--fg)" }}>No items marked for sale</div>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Open any vault item and change its status to &quot;For Sale&quot; to see it here.</p>
            <PillButton variant="active" href="/vault" className="mt-4">Go to Vault →</PillButton>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((item) => (
              <ItemCard key={item.id} item={item} onMarkSold={handleMarkSold} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
