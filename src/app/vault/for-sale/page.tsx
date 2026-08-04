"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";

import {
  generateEbayListing,
  itemToListingInput,
} from "@/lib/listingGenerator";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { getPrimaryImageUrl, loadItems, saveItem, type VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

type Platform = "EBAY" | "WHATNOT" | "MERCARI" | "DISCOGS" | "PWCC" | "FACEBOOK";
type SaleRecord = VaultItem & { soldPrice: number; soldAt: number; salePlatform?: string };

const PLATFORMS: { key: Platform; label: string; emoji: string }[] = [
  { key: "EBAY",     label: "eBay",     emoji: "🛒" },
  { key: "WHATNOT",  label: "Whatnot",  emoji: "📺" },
  { key: "MERCARI",  label: "Mercari",  emoji: "📦" },
  { key: "DISCOGS",  label: "Discogs",  emoji: "🎵" },
  { key: "PWCC",     label: "PWCC",     emoji: "🏆" },
  { key: "FACEBOOK", label: "Facebook", emoji: "👥" },
];

// Per-platform required / recommended fields
function platformGaps(item: VaultItem, platform: Platform): string[] {
  const gaps: string[] = [];
  const inp = itemToListingInput(item);
  const price = Number(item.askingPrice ?? item.currentValue ?? item.estimatedValue ?? 0);

  // Universal
  if (!item.title?.trim())       gaps.push("Title missing");
  if (!price)                    gaps.push("Price not set");

  // Platform-specific
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
    if (!item.category?.toLowerCase().includes("music") && !(item.universe ?? "").toLowerCase().includes("music")) {
      gaps.push("Item may not be music-related");
    }
    if (!item.serialNumber) gaps.push("Catalog / serial number");
    if (!item.grade?.trim()) gaps.push("Media condition");
  }
  if (platform === "PWCC") {
    if (!/psa|bgs|cgc|beckett|slab/i.test(item.grade ?? "")) gaps.push("Graded item preferred");
    if (!item.certNumber) gaps.push("Cert number required");
    if (price < 500)            gaps.push("Value typically ≥ $500");
  }
  if (platform === "FACEBOOK") {
    if (!item.notes?.trim())    gaps.push("Description / notes");
  }

  return gaps;
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

// ─── ReadinessBar ─────────────────────────────────────────────────────────────

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "var(--theme-gold)" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[10px] font-semibold" style={{ color }}>{score}%</span>
    </div>
  );
}

// ─── PlatformChip ─────────────────────────────────────────────────────────────

function PlatformChip({ platform, item }: { platform: Platform; label: string; item: VaultItem }) {
  const gaps = platformGaps(item, platform);
  const ready = gaps.length === 0;
  return (
    <div
      className="rounded-lg px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={ready
        ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
        : { background: "rgba(248,113,113,0.12)", color: "#f87171" }}
    >
      {PLATFORMS.find(p => p.key === platform)?.emoji} {PLATFORMS.find(p => p.key === platform)?.label}
    </div>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  platform,
  onMarkSold,
}: {
  item: VaultItem;
  platform: Platform | "ALL";
  onMarkSold: (item: VaultItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [askingInput, setAskingInput] = useState(
    item.askingPrice != null ? String(item.askingPrice) : ""
  );
  const [priceSaved, setPriceSaved] = useState(false);
  const imageUrl = getPrimaryImageUrl(item);
  const score = readinessScore(item);
  const price = Number(item.askingPrice ?? item.currentValue ?? item.estimatedValue ?? 0);

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

  const platformsToShow = platform === "ALL" ? (["EBAY", "WHATNOT", "MERCARI"] as Platform[]) : [platform];
  const activePlatformGaps = platform === "ALL"
    ? platformGaps(item, "EBAY")
    : platformGaps(item, platform);

  return (
    <article
      className="rounded-2xl ring-1 ring-[color:var(--border)] transition"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: 72, height: 72, background: "var(--pill)" }}>
          {imageUrl
            ? <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <div className="flex h-full w-full items-center justify-center text-xs" style={{ color: "var(--muted)" }}>No photo</div>
          }
          {!imageUrl && (
            <div className="absolute inset-0 flex items-end justify-center pb-1">
              <span className="rounded px-1 text-[8px] font-bold" style={{ background: "rgba(248,113,113,0.9)", color: "#fff" }}>No photo</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--fg)" }}>{item.title}</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                {[item.universe, item.grade, price > 0 ? money(price) : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold" style={{ color: price > 0 ? "var(--theme-gold)" : "var(--muted)" }}>
                {price > 0 ? money(price) : "—"}
              </div>
            </div>
          </div>

          {/* Readiness bar */}
          <div className="mt-2">
            <ReadinessBar score={score} />
          </div>

          {/* Platform chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {platformsToShow.map(p => (
              <PlatformChip key={p} platform={p} label={p} item={item} />
            ))}
          </div>

          {/* Top gaps */}
          {activePlatformGaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {activePlatformGaps.slice(0, 3).map(g => (
                <span key={g} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <Glyph name="warning" size={10} /> {g}
                </span>
              ))}
              {activePlatformGaps.length > 3 && (
                <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: "var(--muted)" }}>
                  +{activePlatformGaps.length - 3} more
                </span>
              )}
            </div>
          )}
          {activePlatformGaps.length === 0 && (
            <div className="mt-2 text-[10px] font-semibold" style={{ color: "#4ade80" }}>✓ Ready to list</div>
          )}
        </div>
      </div>

      {/* Expanded platform detail */}
      {expanded && platform === "ALL" && (
        <div className="border-t border-[color:var(--border)] px-4 py-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PLATFORMS.map(({ key, label, emoji }) => {
              const gaps = platformGaps(item, key);
              return (
                <div key={key} className="rounded-xl p-2.5 ring-1" style={{ background: "var(--pill)", borderColor: gaps.length === 0 ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.2)" }}>
                  <div className="text-xs font-semibold" style={{ color: gaps.length === 0 ? "#4ade80" : "#f87171" }}>
                    {emoji} {label}
                  </div>
                  {gaps.length === 0
                    ? <div className="mt-1 text-[10px]" style={{ color: "#4ade80" }}>Ready</div>
                    : gaps.map(g => <div key={g} className="mt-0.5 text-[10px]" style={{ color: "#f87171" }}>• {g}</div>)
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] px-3 py-2">
        {/* Asking price quick-set */}
        <div className="flex items-center gap-1 rounded-xl ring-1 ring-[color:var(--border)] overflow-hidden" style={{ background: "var(--pill)" }}>
          <span className="pl-2 text-xs" style={{ color: "var(--muted)" }}>$</span>
          <input
            type="number"
            min="0"
            step="1"
            value={askingInput}
            onChange={(e) => setAskingInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePriceSet()}
            placeholder="Ask price"
            className="w-20 bg-transparent py-1.5 pr-1 text-xs focus:outline-none"
            style={{ color: "var(--fg)" }}
          />
          <button
            type="button"
            onClick={handlePriceSet}
            className="px-2 py-1.5 text-xs font-semibold transition"
            style={{ background: priceSaved ? "rgba(74,222,128,0.2)" : "var(--theme-gold)", color: priceSaved ? "#4ade80" : "#0B0B0B" }}
          >
            {priceSaved ? "✓" : "Set"}
          </button>
        </div>
        <Link
          href={`/vault/item/${encodeURIComponent(item.id)}`}
          className="inline-flex items-center gap-1 rounded-[7px] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)]"
          style={{ background: "var(--pill)", color: "var(--fg)" }}
        >
          Edit item
        </Link>
        <button
          type="button"
          onClick={() => onMarkSold(item)}
          className="inline-flex items-center gap-1 rounded-[7px] px-3 py-1.5 text-xs font-semibold transition"
          style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
        >
          Mark sold
        </button>
        {platform === "ALL" && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-xs"
            style={{ color: "var(--muted)" }}
          >
            {expanded ? "Hide platforms ▲" : "All platforms ▼"}
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForSalePage() {
  const [items, setItems] = useState<VaultItem[]>(() => loadItems().filter(i => i.status === "FOR_SALE"));
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [status, setStatus] = useState("");

  const stats = useMemo(() => {
    const readyPerPlatform = Object.fromEntries(
      PLATFORMS.map(({ key }) => [key, items.filter(i => platformGaps(i, key).length === 0).length])
    );
    const scores = items.map(readinessScore);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const totalAsk = items.reduce((s, i) => s + Number(i.askingPrice ?? i.currentValue ?? 0), 0);
    const fullyReady = items.filter(i => readinessScore(i) === 100).length;
    return { readyPerPlatform, avgScore, totalAsk, fullyReady };
  }, [items]);

  const displayed = useMemo(() => {
    if (platform === "ALL") return items;
    return items.filter(i => platformGaps(i, platform).length < 5); // show all, sorted by readiness
  }, [items, platform]);

  async function handleMarkSold(item: VaultItem) {
    const priceInput = window.prompt("Sale price:", String(Number(item.askingPrice ?? item.currentValue ?? 0) || ""));
    if (!priceInput) return;
    const soldPrice = parseMoney(priceInput);
    if (soldPrice === undefined) { setStatus("Invalid price."); return; }
    const platformInput = window.prompt("Platform (eBay, Whatnot, in person…):", "eBay");
    const salePlatform = platformInput?.trim() || undefined;
    const soldItem: VaultItem = { ...item, status: "SOLD", soldPrice, soldAt: Date.now() };
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
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>For Sale</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Listing Readiness</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Per-platform gap analysis for your {items.length} for-sale item{items.length !== 1 ? "s" : ""}.
          </p>

          {/* Stats bar */}
          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-5">
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--theme-gold)" }}>{items.length}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>for sale</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{stats.fullyReady}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>fully ready</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{stats.avgScore}%</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>avg readiness</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>{money(stats.totalAsk)}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>asking total</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {status && (
          <div className="mb-4 rounded-xl px-4 py-2.5 text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>
            {status}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-2xl px-6 py-14 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="flex justify-center opacity-60"><Glyph name="tag" size={36} /></div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>No items marked for sale</div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Open any vault item and change its status to "For Sale" to see it here.</p>
            <Link href="/vault" className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}>
              Go to Vault →
            </Link>
          </div>
        ) : (
          <>
            {/* Platform readiness matrix */}
            <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Platform readiness</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PLATFORMS.map(({ key, label, emoji }) => {
                  const ready = stats.readyPerPlatform[key] ?? 0;
                  const pct = items.length ? Math.round((ready / items.length) * 100) : 0;
                  return (
                    <button
                      key={key}
                      onClick={() => setPlatform(platform === key ? "ALL" : key)}
                      className="rounded-xl p-2.5 text-center transition ring-1"
                      style={
                        platform === key
                          ? { background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d", borderColor: "transparent" }
                          : { background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }
                      }
                    >
                      <div className="text-base">{emoji}</div>
                      <div className="mt-1 text-[10px] font-semibold">{label}</div>
                      <div className="text-xs font-bold" style={platform === key ? {} : { color: pct === 100 ? "#4ade80" : pct >= 50 ? "var(--theme-gold)" : "#f87171" }}>
                        {ready}/{items.length}
                      </div>
                    </button>
                  );
                })}
              </div>
              {platform !== "ALL" && (
                <button onClick={() => setPlatform("ALL")} className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  ← Show all platforms
                </button>
              )}
            </div>

            {/* Item list */}
            <div className="mt-4 flex flex-col gap-3">
              {displayed
                .slice()
                .sort((a, b) => {
                  const gA = platform === "ALL" ? platformGaps(a, "EBAY").length : platformGaps(a, platform).length;
                  const gB = platform === "ALL" ? platformGaps(b, "EBAY").length : platformGaps(b, platform).length;
                  if (gA !== gB) return gA - gB; // ready first
                  return readinessScore(b) - readinessScore(a);
                })
                .map(item => (
                  <ItemCard key={item.id} item={item} platform={platform} onMarkSold={handleMarkSold} />
                ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
