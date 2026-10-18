"use client";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph } from "@/components/ui/Glyph";

import {
  generateEbayListing,
  itemToListingInput,
} from "@/lib/listingGenerator";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { getPrimaryImageUrl, loadItems, saveItem, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

const SALES_KEY = "vltd_sales_history";

type Platform = "EBAY" | "WHATNOT" | "MERCARI" | "DISCOGS" | "PWCC" | "FACEBOOK";
type SaleRecord = VaultItem & { soldPrice: number; soldAt: number; salePlatform?: string };

const PLATFORMS: { key: Platform; label: string; icon: AppIconName }[] = [
  { key: "EBAY",     label: "eBay",     icon: "cart" },
  { key: "WHATNOT",  label: "Whatnot",  icon: "play" },
  { key: "MERCARI",  label: "Mercari",  icon: "box" },
  { key: "DISCOGS",  label: "Discogs",  icon: "music" },
  { key: "PWCC",     label: "PWCC",     icon: "trophy" },
  { key: "FACEBOOK", label: "Facebook", icon: "users" },
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
      <span className="inline-flex items-center gap-1">
        {(() => { const icon = PLATFORMS.find(p => p.key === platform)?.icon; return icon ? <AppIcon name={icon} size={12} /> : null; })()}
        {PLATFORMS.find(p => p.key === platform)?.label}
      </span>
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
            {PLATFORMS.map(({ key, label, icon }) => {
              const gaps = platformGaps(item, key);
              return (
                <div key={key} className="rounded-xl p-2.5 ring-1" style={{ background: "var(--pill)", borderColor: gaps.length === 0 ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.2)" }}>
                  <div className="text-xs font-semibold" style={{ color: gaps.length === 0 ? "#4ade80" : "#f87171" }}>
                    <span className="inline-flex items-center gap-1"><AppIcon name={icon} size={12} />{label}</span>
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
          <PillButton size="compact" variant={priceSaved ? "success" : "active"} onClick={handlePriceSet} ariaLabel={priceSaved ? "Price saved" : "Set price"}>
            {priceSaved ? <AppIcon name="checkmark" size={14} /> : "Set"}
          </PillButton>
        </div>
        <PillButton href={`/vault/item/${encodeURIComponent(item.id)}`}>Edit item</PillButton>
        <PillButton onClick={() => onMarkSold(item)} style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", boxShadow: "none" }}>Mark sold</PillButton>
        {platform === "ALL" && (
          <PillButton className="ml-auto" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide platforms" : "All platforms"}<AppIcon name={expanded ? "chevronUp" : "chevronDown"} size={16} /></PillButton>
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
    <div className="" style={{ background: "var(--bg)" }}>
      <div>
        <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
          {/* Stats bar */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-5">
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

        {items.length === 0 && !hydrated ? (
          <div role="status" className="rounded-2xl px-6 py-14 text-center text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--muted)" }}>
            Loading your items…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl px-6 py-14 text-center ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="flex justify-center opacity-60"><Glyph name="tag" size={36} /></div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>No items marked for sale</div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Open any vault item and change its status to "For Sale" to see it here.</p>
            <PillButton variant="active" href="/vault" className="mt-6">Go to Vault →</PillButton>
          </div>
        ) : (
          <>
            {/* Platform readiness matrix */}
            <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Platform readiness</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PLATFORMS.map(({ key, label, icon }) => {
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
                      <div className="flex justify-center"><AppIcon name={icon} size={18} /></div>
                      <div className="mt-1 text-[10px] font-semibold">{label}</div>
                      <div className="text-xs font-bold" style={platform === key ? {} : { color: pct === 100 ? "#4ade80" : pct >= 50 ? "var(--theme-gold)" : "#f87171" }}>
                        {ready}/{items.length}
                      </div>
                    </button>
                  );
                })}
              </div>
              {platform !== "ALL" && (
                <PillButton className="mt-3" onClick={() => setPlatform("ALL")}><AppIcon name="arrowLeft" size={16} />Show all platforms</PillButton>
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
