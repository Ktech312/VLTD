"use client";

import { VaultNav } from "@/components/SectionNav";
import AddItemActions from "@/components/AddItemActions";
import VaultToolsMenu from "@/components/VaultToolsMenu";
import { LocalNav } from "@/components/ui/LocalNav";
import { PillButton } from "@/components/ui/PillButton";
import VaultCategoryChips, { chipKey, vaultItemCategory, vaultItemSubcategory } from "@/components/VaultCategoryChips";
import { normalizeUniverse, universeForItem } from "@/lib/universeMatch";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import SellItemButton from "@/components/SellItemButton";
import VaultWallView from "@/components/VaultWallView";
import { AppIcon } from "@/components/ui/AppIcon";
import { SelectCircle } from "@/components/ui/SelectCircle";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { universePlaceholder } from "@/lib/itemPlaceholder";
import SwipeStack from "@/components/SwipeStack";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, TAXONOMY, getCategories, isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { showToast } from "@/lib/toast";
import { REVIEW_CHECKLIST, REVIEW_CHECKLIST_NOTE, REVIEW_GAPS, REVIEW_GAP_FILTERS, REVIEW_GAP_HEADING, REVIEW_GAP_PILL, REVIEW_GAP_ROW, matchesReview, reviewCounts, reviewGaps, type ReviewFilter, type ReviewGap } from "@/lib/vaultReview";
import { activeItems, collectibleItems, describeGainExclusions, effectiveMarketValue, readValueMode, summarizeValues, writeValueMode, type ValueMode } from "@/lib/vaultStats";
import { priceCheckIsStale } from "@/lib/pricingMvp";
import { migrateExistingVaultImagesToSupabase } from "@/lib/vaultMigration";
import {
  commitVaultItemEdits,
  enqueueVaultItemSync,
  getPendingVaultSyncCount,
  processVaultSyncQueue,
  requeueSpecsDeviceOnly,
} from "@/lib/vaultSyncQueue";
import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";
import {
  loadItems,
  saveItem,
  saveItems,
  syncVaultItemsFromSupabaseChecked,
  type VaultItem,
  markPendingMoves,
  clearPendingMoves,
} from "@/lib/vaultModel";
import { hasSupabaseEnv } from "@/lib/vaultCloud";
import { deleteVaultItemEverywhere, deleteVaultItemsEverywhere } from "@/lib/vaultActions";
import { getOnboardingStatus, getStoredActiveProfileId, listMyProfiles, type ProfileRow } from "@/lib/auth";
import { readUniversePrefs, saveDisplayedUniverses } from "@/lib/universePrefs";
import { currentLocalOwner } from "@/lib/localDataOwner";
import { storedSessionUserId } from "@/lib/sessionGuard";

// How long the page waits for the account check and for the cloud before it stops waiting and says so.
const ACCOUNT_CHECK_TIMEOUT_MS = 12_000;
const CLOUD_PULL_TIMEOUT_MS = 20_000;
// With nothing yet to show, after this long the loading state says it is taking longer than usual.
const SLOW_LOAD_NOTICE_MS = 6_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";
const SALES_KEY = "vltd_sales_history";
const FOCUS_LS_KEY = "vltd_primary_focus";
const VIEW_MODE_KEY = "vltd_vault_view_mode";
const VISIBLE_UNIVERSE_CHIPS_LS_KEY = "vltd_visible_universe_chips";
const INITIAL_VISIBLE_ITEM_COUNT = 60;
// The first screen draws this many cards at once; the rest of the first page follows in small slices (the reset effect below).
const FIRST_PAINT_ITEM_COUNT = 24;
const VISIBLE_ITEM_INCREMENT = 60;

type SortMode = "newest" | "value_desc" | "value_asc" | "gain_desc" | "gain_asc" | "title";
const SUMMARY_CARD_FOCUS =
  "block w-full rounded-[inherit] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--theme-gold,#C8CDD2)]";
type ReadinessFilter = "all" | "high" | "moderate" | "low";
type UniverseFilter = "ALL" | UniverseKey;
// The private Vault has three views. (Shelf and Museum were removed; saved choices of those fall back to Wall.)
type VaultViewMode = "wall" | "gallery" | "flip";
type InlineField = "" | "value" | "cost";
type SaleInfo = {
  id: string;
  soldPrice?: number;
  soldAt?: number;
};

function readSales(): SaleInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SaleInfo[]) : [];
  } catch {
    return [];
  }
}

const MONEY_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
function formatMoney(value?: number) {
  return MONEY_FORMAT.format(Number(value ?? 0));
}

function totalCost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function itemGain(item: VaultItem) {
  return effectiveMarketValue(item) > 0 ? effectiveMarketValue(item) - totalCost(item) : 0;
}
type VaultUniverseSlug = "pop-culture" | "sports" | "tcg" | "music" | "jewelry-apparel" | "games" | "built-botany" | "misc" | "automotive" | "art";

type VaultUniverseEntry = {
  key: UniverseKey;
  slug: VaultUniverseSlug;
  description: string;
  href: string;
  thumbnailSrc: string;
};

const VAULT_UNIVERSES: VaultUniverseEntry[] = [
  {
    key: "POP_CULTURE",
    slug: "pop-culture",
    description: "Comics, toys, art cards, character collectibles, slabs, variants, and pop-culture pieces.",
    href: "/vault/pop-culture",
    thumbnailSrc: "/universe-thumbnails/pop-culture.png",
  },
  {
    key: "SPORTS",
    slug: "sports",
    description: "Sports cards, jerseys, autos, game-used items, memorabilia, and athlete collectibles.",
    href: "/vault/sports",
    thumbnailSrc: "/universe-thumbnails/sports.png",
  },
  {
    key: "TCG",
    slug: "tcg",
    description: "Pokemon, MTG, Bo Jackson Arena, sealed products, slabs, singles, foils, and promos.",
    href: "/vault/tcg",
    thumbnailSrc: "/universe-thumbnails/tcg.png",
  },
  {
    key: "MUSIC",
    slug: "music",
    description: "Vinyl records, CDs, instruments, signed albums, box sets, and music collectibles.",
    href: "/vault/music",
    thumbnailSrc: "/universe-thumbnails/music.png",
  },
  {
    key: "JEWELRY_APPAREL",
    slug: "jewelry-apparel",
    description: "Watches, bags, apparel, streetwear, vintage pieces, luxury items, and limited drops.",
    href: "/vault/jewelry-apparel",
    thumbnailSrc: "/universe-thumbnails/jewelry-apparel.png",
  },
  {
    key: "GAMES",
    slug: "games",
    description: "Video games, consoles, cartridges, controllers, sealed games, and arcade/handheld pieces.",
    href: "/vault/games",
    thumbnailSrc: "/universe-thumbnails/games.png",
  },
  {
    key: "BUILT_BOTANY",
    slug: "built-botany",
    description: "Handmade items, crafts, plants, terrariums, garden tools, and living collectibles.",
    href: "/vault/built-botany",
    thumbnailSrc: "/universe-thumbnails/built-botany.png",
  },
  {
    key: "MISC",
    slug: "misc",
    description: "Everything that cannot be confidently assigned to another Universe yet.",
    href: "/vault/misc",
    thumbnailSrc: "/universe-thumbnails/misc.png",
  },
  {
    key: "AUTOMOTIVE",
    slug: "automotive",
    description: "Classic cars, motorcycles, bicycles, hot rods, car parts, and vehicle collectibles.",
    href: "/vault/automotive",
    thumbnailSrc: "/universe-thumbnails/automotive.png",
  },
  {
    key: "ART",
    slug: "art",
    description: "Original paintings, sculptures, limited prints, art cards, and fine art collectibles.",
    href: "/vault/art",
    thumbnailSrc: "/universe-thumbnails/art.png",
  },
];

function universeDisplayName(key: UniverseKey) {
  return UNIVERSE_LABEL[key] ?? "Misc";
}

export function universeFromSlug(value: unknown): UniverseKey {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  return VAULT_UNIVERSES.find((entry) => entry.slug === slug)?.key ?? "MISC";
}

function readFocusUniverseKey(): UniverseKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FOCUS_LS_KEY) ?? "";
    if (!raw || raw.toLowerCase() === "null") return null;
    const key = normalizeUniverse(raw);
    return key !== "MISC" ? key : null;
  } catch {
    return null;
  }
}

function sameItemContent(a: VaultItem, b: VaultItem) {
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    const x = left[key];
    const y = right[key];
    if (x === y) continue;
    if (typeof x !== "object" || x === null || typeof y !== "object" || y === null) return false;
    if (JSON.stringify(x) !== JSON.stringify(y)) return false;
  }
  return true;
}

function reuseUnchangedItems(prev: VaultItem[], next: VaultItem[]): VaultItem[] {
  if (prev.length === 0) return next;
  const before = new Map(prev.map((item) => [String(item.id), item]));
  let identical = prev.length === next.length;
  const merged = next.map((item, index) => {
    const old = before.get(String(item.id));
    if (old && sameItemContent(old, item)) {
      if (prev[index] !== old) identical = false;
      return old;
    }
    identical = false;
    return item;
  });
  return identical ? prev : merged;
}

function ensureVaultItemUniverses() {
  const allItems = loadItems({ includeAllProfiles: true });
  let changed = false;
  const changedIds: string[] = [];

  const nextItems = allItems.map((item) => {
    const nextUniverse = universeForItem(item);
    if (normalizeUniverse(item.universe) === nextUniverse) return item;
    changed = true;
    changedIds.push(item.id);
    return { ...item, universe: nextUniverse };
  });

  if (!changed) return false;

  saveItems(nextItems);
  for (const id of changedIds) enqueueVaultItemSync(id);
  return true;
}

function getCreatedAtMs(item: VaultItem) {
  const raw = (item as VaultItem & { createdAt?: unknown }).createdAt;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  if (typeof item.id === "string" && /^\d+$/.test(item.id)) {
    const num = Number(item.id);
    if (Number.isFinite(num) && num > 1_000_000_000) return num;
  }
  return 0;
}

function readinessTone(readiness: string) {
  if (readiness === "High") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  if (readiness === "Moderate") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  return "bg-white/10 text-[color:var(--theme-text-secondary)] ring-[color:var(--theme-border)]";
}

function itemMeta(item: VaultItem) {
  const primary = [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
  if (primary) return primary;
  const fallback = [
    item.categoryLabel || item.customCategoryLabel,
    item.subcategoryLabel,
    item.storageLocation,
  ]
    .filter(Boolean)
    .join(" • ");
  return fallback || "Basic item record";
}

function parseMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function PercentDonut({ percent }: { percent: number }) {
  const size = 58;
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative flex h-14 w-14 items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(82,214,244,0.16)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--data-color)"
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="relative text-sm font-semibold">{clamped}%</span>
    </div>
  );
}

function saleInfoForItem(item: VaultItem, saleMap: Record<string, SaleInfo | undefined>): SaleInfo | null {
  if (item.status === "SOLD" || item.soldAt || item.soldPrice !== undefined) {
    return {
      id: item.id,
      soldPrice: item.soldPrice,
      soldAt: item.soldAt,
    };
  }

  return saleMap[item.id] ?? null;
}

function promoteLegacySalesToItems() {
  if (typeof window === "undefined") return false;

  const sales = readSales();
  if (sales.length === 0) return false;

  const saleMap = new Map(sales.map((sale) => [String(sale.id), sale]));
  let changed = false;

  for (const item of loadItems({ includeAllProfiles: true })) {
    const sale = saleMap.get(String(item.id));
    if (!sale) continue;

    const soldPrice = Number(sale.soldPrice ?? item.soldPrice ?? 0);
    const soldAt = Number(sale.soldAt ?? item.soldAt ?? Date.now());
    const nextItem: VaultItem = {
      ...item,
      status: "SOLD",
      soldPrice: Number.isFinite(soldPrice) ? soldPrice : 0,
      soldAt: Number.isFinite(soldAt) ? soldAt : Date.now(),
    };

    if (
      item.status === nextItem.status &&
      Number(item.soldPrice ?? 0) === Number(nextItem.soldPrice ?? 0) &&
      Number(item.soldAt ?? 0) === Number(nextItem.soldAt ?? 0)
    ) {
      continue;
    }

    saveItem(nextItem);
    enqueueVaultItemSync(nextItem.id);
    changed = true;
  }

  return changed;
}

function itemCardSubtitle(item: VaultItem) {
  const universe = universeDisplayName(universeForItem(item));
  const category =
    item.categoryLabel ||
    item.customCategoryLabel ||
    item.category ||
    item.subcategoryLabel ||
    itemMeta(item) ||
    "Collector's Choice";
  // Show the subtype (e.g. Vinyl Records) too when one is set and isn't just
  // the category repeated.
  const subtype =
    item.subcategoryLabel && item.subcategoryLabel !== category ? item.subcategoryLabel : "";

  return subtype ? `${universe} · ${category} · ${subtype}` : `${universe} · ${category}`;
}

function VaultCard({
  item,
  readiness,
  sale,
  onSaveItem,
  onDeleteItem,
  displayMode = "gallery",
}: {
  item: VaultItem;
  readiness: string;
  sale: SaleInfo | null;
  onSaveItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (item: VaultItem) => Promise<void>;
  displayMode?: Exclude<VaultViewMode, "wall">;
}) {
  const image = useResolvedVaultImage(item);
  const isSold = Boolean(sale);

  const [editingField, setEditingField] = useState<InlineField>("");
  const [valueDraft, setValueDraft] = useState(String(Number(item.currentValue ?? 0)));
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setValueDraft(String(Number(item.currentValue ?? 0)));
  }, [item.currentValue]);

  async function saveValueInline() {
    if (!valueDraft.trim()) {
      setValueDraft(String(Number(item.currentValue ?? 0)));
      setEditingField("");
      return;
    }
    const nextValue = parseMoneyInput(valueDraft);
    if (nextValue === Number(item.currentValue ?? 0)) {
      setEditingField("");
      return;
    }
    const edited: VaultItem = { ...item, currentValue: nextValue };
    if (typeof item.estimatedValue === "number") edited.estimatedValue = nextValue;
    if (typeof item.valueMedian === "number") edited.valueMedian = nextValue;
    await onSaveItem(edited);
    setEditingField("");
  }

  async function handleDelete() {
    setConfirmingDelete(false);
    setIsDeleting(true);
    try {
      await onDeleteItem(item);
    } finally {
      setIsDeleting(false);
    }
  }

  const statusLabel = isSold ? "SOLD" : item.isNew ? "NEW" : readiness;
  const statusClass = isSold
    ? "bg-amber-500/18 text-amber-100 ring-amber-400/30"
    : item.isNew
      ? "bg-red-600/18 text-red-100 ring-red-400/30"
      : readinessTone(readiness);
  const marketValue = effectiveMarketValue(item);
  const gain = itemGain(item);
  const detailHref = isSold ? `/vault/item/${item.id}?sold=1` : `/vault/item/${item.id}`;

  return (
    <div
      className={[
        "group relative flex flex-col overflow-hidden rounded-[4px] vltd-brushed p-3 transition hover:-translate-y-0.5",
        displayMode === "flip" ? "min-h-[340px] hover:[transform:rotateY(2deg)_translateY(-2px)]" : "min-h-[324px]",
        marketValue > 0 ? "border-l-2 border-l-[color:var(--status-cyan)]" : "",
      ].join(" ")}
    >
      {/* Status badge — top LEFT to avoid colliding with hover action buttons */}
      <span className={["absolute left-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ring-1", statusClass].join(" ")}>
        {statusLabel}
      </span>

      {/* Hover action buttons — top RIGHT, clear of status badge */}
      <div className={"absolute right-1.5 top-1.5 z-20 items-center gap-1 " + (confirmingDelete ? "flex" : "hidden group-hover:flex [@media(hover:none)]:flex")}>
        {confirmingDelete ? (
          <span className="flex items-center gap-1.5 rounded-full bg-black/85 px-2.5 py-1 text-[10px] font-semibold text-white">
            Delete this?
            <button type="button" onClick={handleDelete} className="text-red-400 hover:underline">Yes</button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="text-white/70 hover:underline">No</button>
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={isDeleting}
          aria-label="Delete item"
          title="Delete item"
          className={(confirmingDelete ? "hidden " : "") + "relative inline-flex h-7 w-7 items-center justify-center vltd-keep-color disabled:opacity-50 max-md:after:absolute max-md:after:-inset-2 max-md:after:content-['']"}
          style={{ "--vltd-keep-color": "#FF1744" } as React.CSSProperties}
        >
          {isDeleting ? (
            <span className="text-[9px]">...</span>
          ) : (
            <AppIcon name="delete" size={15} strokeWidth={1.8} className="vltd-keep-color" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }} />
          )}
        </button>
      </div>

      <div className={["relative z-0 overflow-visible rounded-[8px]", displayMode === "flip" ? "h-[212px]" : "h-[190px]"].join(" ")}>
        <Link href={detailHref} className="absolute inset-x-0 top-0 bottom-[-58px] z-0 block overflow-hidden rounded-[8px] bg-black/24 vltd-dark-surface">
          {image ? (
            <ProgressiveImage
              src={image}
              alt={item.title}
              deferOffscreen
              className="h-full w-full"
              imageClassName="object-contain object-center transition duration-500 group-hover:scale-[1.035]"
              draggable={false}
            />
          ) : (
            <div className="relative h-full w-full">
              <img src={universePlaceholder(item.universe)} alt="" className="h-full w-full object-cover opacity-[0.22]" draggable={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                <AppIcon name="camera" size={20} className="h-5 w-5" />
                <span>Add photo</span>
              </div>
            </div>
          )}
        </Link>

        {/* Visibility toggle: pushed into the photo's actual bottom-left
            corner (the photo bleeds -58px past this box) - no background
            chip, just the bare symbol per EK's instruction. */}
        <div className="absolute z-20" style={{ left: 3, bottom: -55 }}>
          <ItemVisibilityToggle item={item} align="corner" />
        </div>
      </div>

      <Link href={detailHref} className="relative z-10 mt-[68px] min-w-0">
        <div className="line-clamp-1 text-[15px] font-semibold leading-tight vltd-keep-color" style={{ "--vltd-keep-color": "var(--vault-title-color)" } as React.CSSProperties}>
          {item.title}
        </div>
        <div className="mt-1 line-clamp-1 text-[11px] font-semibold vltd-keep-color" style={{ "--vltd-keep-color": "var(--data-color)" } as React.CSSProperties}>
          {itemCardSubtitle(item)}
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div className="min-w-0">
          {editingField === "value" ? (
            <input
              autoFocus
              value={valueDraft}
              onChange={(e) => setValueDraft(e.target.value)}
              onBlur={() => void saveValueInline()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveValueInline();
                if (e.key === "Escape") {
                  setValueDraft(String(Number(item.currentValue ?? 0)));
                  setEditingField("");
                }
              }}
              aria-label="Value" className="h-9 w-24 rounded-[8px] bg-[color:var(--pill)] px-2 text-[13px] ring-1 ring-[color:var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] md:h-7"
            />
          ) : (
            // Single number: the current value itself, colored by gain/loss
            // (green up, red down) instead of a separate, often-redundant
            // "+$X" line underneath it — EK found two numbers confusing,
            // especially when they showed the same figure twice.
            <button
              type="button"
              onClick={() => setEditingField("value")}
              className={[
                "relative block text-left font-semibold leading-none hover:opacity-80 vltd-keep-color max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-3 max-md:after:content-['']",
                marketValue > 0 || totalCost(item) > 0 ? "text-[20px]" : "text-[15px]",
              ].join(" ")}
              title={marketValue <= 0 && totalCost(item) > 0 ? "Purchase price. Not priced yet. Tap to add a value." : undefined}
              style={{
                "--vltd-keep-color":
                  marketValue <= 0
                    ? totalCost(item) > 0
                      ? "var(--muted2, #8C9298)"
                      : "var(--status-gain, #54C98A)"
                    : gain >= 0
                      ? "var(--status-gain, #54C98A)"
                      : "var(--status-loss, #E05252)",
              } as React.CSSProperties}
            >
              {marketValue > 0 ? formatMoney(marketValue) : totalCost(item) > 0 ? formatMoney(totalCost(item)) : "+ Add Value"}
            </button>
          )}
        </div>

        {isSold ? (
          <div className="shrink-0 rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-400/20">
            Sold {formatMoney(sale?.soldPrice)}
          </div>
        ) : (
          <SellItemButton item={item} />
        )}
      </div>
    </div>
  );
}

// Ticking one item in select mode re-renders the whole page; without this every
// one of the (thousands of) cards re-rendered too, which is the select lag.
const MemoVaultCard = memo(VaultCard);

// One cell of the Gallery grid. Memoised so adding 60 more cells does not re-render the hundreds already shown.
const GalleryCell = memo(function GalleryCell({
  item,
  readiness,
  sale,
  selected,
  selectMode,
  missingText,
  displayMode,
  onSaveItem,
  onDeleteItem,
  onToggleSelect,
  onOpenDetail,
}: {
  item: VaultItem;
  readiness: ReturnType<typeof computeItemIntelligence>["readiness"] | string;
  sale: SaleInfo | null;
  selected: boolean;
  selectMode: boolean;
  missingText: string | null;
  displayMode: string;
  onSaveItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (item: VaultItem) => Promise<void>;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <div
      // Cards far off screen skip layout and painting: with hundreds of cards the page used to take about a second to respond to "Show more".
      className="relative [content-visibility:auto] [contain-intrinsic-size:auto_330px]"
      onClick={(e) => {
        // Open the quick-look on a real tap only. A scroll gesture
        // isn't a click, so scrolling anywhere on the card is safe.
        // Skip taps on interactive children: the image/title links
        // navigate to the full item page; value/Sell do their thing.
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        onOpenDetail(item.id);
      }}
    >
      {selectMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(item.id)}
          aria-pressed={selected}
          aria-label={"Select " + item.title}
          className="absolute inset-0 z-40 flex items-center justify-center rounded-[10px]"
          style={{ background: selected ? "rgba(203,208,213,0.18)" : "rgba(0,0,0,0.04)" }}
        >
          <SelectCircle selected={selected} />
        </button>
      )}
      <MemoVaultCard
        item={item}
        readiness={readiness as never}
        sale={sale}
        onSaveItem={onSaveItem}
        onDeleteItem={onDeleteItem}
        displayMode={displayMode as never}
      />
      {missingText ? <div className="mt-1 px-1 text-[11px] font-medium text-amber-300">Missing: {missingText}</div> : null}
    </div>
  );
});

// Shown only until the first hydrateAll() pass finishes — without this, a
// cold load rendered VaultEmptyState ("Your vault is empty...") for however
// long the sync took, which read as a broken/empty account rather than a
// still-loading one (NYCC launch blocker: mobile access gate feeling stalled).
function VaultLoadingSkeleton({ slow = false }: { slow?: boolean }) {
  return (
    <section className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" aria-label="Loading your vault">
      {slow ? (
        <p className="col-span-full text-sm text-[color:var(--muted)]" role="status">
          Still loading your Vault. This is taking longer than usual. Your items are safe.
        </p>
      ) : null}
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className="aspect-square animate-pulse rounded-[14px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]"
        />
      ))}
    </section>
  );
}

// Shown when there is nothing saved on this device yet AND the cloud could not be reached (or the account check timed out).
// It must not look like an empty Vault: the items are safe, they just have not arrived.
function VaultLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]" role="alert">
      <div className="mx-auto max-w-xl text-center">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">COULD NOT LOAD</div>
        <h2 className="mt-2 text-2xl font-semibold">We could not load your Vault just now</h2>
        <div className="mt-2 text-sm text-[color:var(--muted)]">
          Your items are safe. Check your connection and try again.
        </div>
        <div className="mt-5 flex justify-center">
          <PillButton variant="primary" onClick={onRetry}>
            Try again
          </PillButton>
        </div>
      </div>
    </section>
  );
}

function VaultEmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
        <div className="mx-auto max-w-xl text-center">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">NO MATCHES</div>
          <h2 className="mt-2 text-2xl font-semibold">No items match your current filters</h2>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Try clearing filters or searching with a broader term.
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <PillButton variant="primary" onClick={onClearFilters}>
              Clear Filters
            </PillButton>
            <PillButton href="/capture">
              Add Item
            </PillButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">EMPTY VAULT</div>
        <h2 className="mt-2 text-2xl font-semibold">Your vault is empty. Let&apos;s fix that.</h2>
        <div className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
          Scan an item with the camera, add it manually, or import an existing spreadsheet. VLTD keeps everything local-first and syncs when cloud storage is available.
        </div>
        <div
          className="mt-3 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs"
          style={{ background: "rgba(203,208,213,0.08)", border: "1px solid rgba(203,208,213,0.15)", color: "var(--theme-text-muted, #61656B)" }}
        >
          <span>Universes:</span>
          <span style={{ color: "var(--theme-gold, #C8CDD2)" }}>TCG - Sports - Comics - Music - Games - Jewelry - Misc</span>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <PillButton
            href="/capture"
            className="w-full gap-2 sm:w-auto"
            style={{ background: "#C8CDD2", color: "#0B0B0B" }}
          >
            <AppIcon name="camera" size={20} className="h-5 w-5" />
            Scan your first item
          </PillButton>
          <div className="flex flex-wrap justify-center gap-2">
            <PillButton href="/vault/quick">
              Quick Add
            </PillButton>
            <PillButton href="/vault/add">
              Add manually
            </PillButton>
            <PillButton href="/vault/import">
              Import
            </PillButton>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">1</div>
            <div className="mt-1 text-sm font-medium">Create an item</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Start with Universe, category, title, and value.
            </div>
          </div>
          <div className="rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">2</div>
            <div className="mt-1 text-sm font-medium">Add pricing</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Save estimate, source, confidence, and notes.
            </div>
          </div>
          <div className="rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">3</div>
            <div className="mt-1 text-sm font-medium">Browse and edit</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Open the item detail page and attach images later.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UniverseOverviewCard({
  category,
  items,
  className = "",
  isFocus = false,
}: {
  category: (typeof VAULT_UNIVERSES)[number];
  items: VaultItem[];
  className?: string;
  isFocus?: boolean;
}) {
  const thumbnailImage = category.thumbnailSrc;
  const countedItems = activeItems(items);
  const summary = summarizeValues(countedItems, readValueMode());
  const totalValue = summary.totalValue;
  const totalCostValue = summary.totalCost;
  const totalGain = summary.totalGain;
  const hasItems = items.length > 0;
  const showGain = Math.abs(totalGain) > 0.49;

  return (
    <Link
      href={category.href}
      className={["group overflow-hidden rounded-[18px] p-2 ring-1 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5", className].filter(Boolean).join(" ")}
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        borderColor: "var(--theme-border, rgba(203,208,213,0.12))",
      }}
    >
      {/* Top section: image + content side by side */}
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5">
        {/* Image — shorter so value strip has room below */}
        <div
          className="overflow-hidden rounded-[12px]"
          style={{ height: 88, background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(203,208,213,0.08))" }}
        >
          {thumbnailImage ? (
            <ProgressiveImage
              src={thumbnailImage}
              alt={`${universeDisplayName(category.key)} cover`}
              className="h-full w-full"
              imageClassName="object-cover transition duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] font-semibold" style={{ color: "var(--theme-text-muted, #61656B)" }}>
              <span className="text-lg leading-none" style={{ color: "var(--theme-gold, #C8CDD2)", opacity: 0.7 }}>+</span>
              <span>{hasItems ? universeDisplayName(category.key) : "Add"}</span>
            </div>
          )}
        </div>

        {/* Right: label, name, description, item count (no pill border) */}
        <div className="flex min-w-0 flex-col py-0.5 pr-1">
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--theme-text-muted, #61656B)" }}>Universe</div>
          <h2 className="mt-0.5 text-[15px] font-semibold leading-tight" style={{ color: "var(--theme-gold, #C8CDD2)" }}>
            {universeDisplayName(category.key)}
            {isFocus && (
              <span className="ml-1.5 text-[10px] font-medium" style={{ color: "var(--theme-text-muted, #61656B)" }}>· Focus</span>
            )}
          </h2>
          <div className="mt-1 line-clamp-2 text-[11px] leading-[1.4]" style={{ color: "var(--theme-text-muted, #61656B)" }}>
            {hasItems ? category.description : "No items yet. Tap to start adding."}
          </div>
          {/* Item count — plain text, no pill frame */}
          <div className="mt-auto pt-1 text-[11px] font-semibold" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      {/* Bottom value strip — full width, left to right */}
      <div
        className="mt-2 rounded-[10px] px-2.5 py-1.5"
        style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(203,208,213,0.08))" }}
      >
        <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted, #61656B)" }}>Value</div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-extrabold leading-none" style={{ color: "var(--theme-text-primary, #ECEDEF)" }}>
            {hasItems ? formatMoney(totalValue) : "—"}
          </div>
          <div
            className="text-right text-[12px] font-bold leading-none"
            style={{ color: showGain ? (totalGain >= 0 ? "var(--color-gain, #4CAF82)" : "var(--color-loss, #E05252)") : "var(--theme-text-muted, #61656B)" }}
          >
            {showGain ? `${totalGain >= 0 ? "+" : ""}${formatMoney(totalGain)}` : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}

function documentationStatus(item: VaultItem) {
  const photos = item.images?.length ?? (item.imageFrontUrl || item.imageBackUrl ? 1 : 0);
  const rows = [
    { label: `Photos (${photos})`, complete: photos > 0 },
    { label: "Cert / Grade", complete: Boolean(item.grade || item.certNumber) },
    { label: "Condition Notes", complete: Boolean(item.condition || item.conditionReason || item.notes) },
    { label: "Purchase Info", complete: totalCost(item) > 0 || Boolean(item.purchaseSource || item.purchaseLocation || item.orderNumber) },
    { label: "Insurance Document", complete: Boolean(item.orderNumber || item.storageLocation), warn: true },
  ];
  const completeCount = rows.filter((row) => row.complete).length;
  const percent = Math.round((completeCount / rows.length) * 100);
  return { rows, percent };
}

function VaultSelectionDrawer({
  item,
  readiness,
  onClose,
}: {
  item: VaultItem;
  readiness: string;
  onClose: () => void;
}) {
  const image = useResolvedVaultImage(item);
  const value = effectiveMarketValue(item);
  const paid = totalCost(item);
  const gain = value - paid;
  const gainPct = paid > 0 ? (gain / paid) * 100 : 0;
  // Only real comparable data: no made-up low and high around the value.
  const low = Number(item.valueLow ?? item.lastCompValue ?? 0);
  const median = Number(item.valueMedian ?? value);
  const high = Number(item.valueHigh ?? 0);
  const docs = documentationStatus(item);
  const detailHref = `/vault/item/${item.id}`;

  function exportItemData() {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(item.title || "vault-item").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "vault-item"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="fixed inset-x-2 bottom-[calc(var(--bottomnav-h,120px)+8px)] z-40 max-h-[74vh] overflow-y-auto rounded-[14px] border border-[color:var(--theme-gold-border)] bg-[rgba(3,11,14,0.94)] p-2 shadow-[0_-18px_60px_rgba(0,0,0,0.46)] backdrop-blur-xl lg:static lg:inset-x-auto lg:bottom-2 lg:z-30 lg:mx-auto lg:mt-5 lg:max-h-none lg:w-fit lg:overflow-visible lg:sticky vltd-dark-surface">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close item details"
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-base leading-none transition"
        style={{ color: "#C8CDD2" }}
      >
        ×
      </button>

      <div className="grid gap-3 pr-6 lg:grid-cols-[430px_auto] lg:justify-start">
        <div className="flex min-w-0 gap-4 px-2.5 py-2.5">
          <Link href={detailHref} className="relative h-[150px] w-[106px] shrink-0 overflow-hidden rounded-[8px] border border-[color:var(--theme-gold-border)] bg-black/30">
            {image ? (
              <ProgressiveImage src={image} alt={item.title} className="h-full w-full" imageClassName="object-cover object-center" draggable={false} />
            ) : (
              <div className="relative h-full w-full">
                <img src={universePlaceholder(item.universe)} alt="" className="h-full w-full object-cover opacity-[0.22]" draggable={false} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  <AppIcon name="camera" size={20} className="h-5 w-5" />
                  Add photo
                </div>
              </div>
            )}
          </Link>

          <div className="min-w-0 py-0">
            <div className="flex items-center gap-2">
              <Link href={detailHref} className="line-clamp-1 text-[18px] font-semibold leading-tight" style={{ color: "#ECEDEF" }}>
                {item.title}
              </Link>
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px]" style={{ color: "#B9AE86" }}>{itemMeta(item)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.grade ? <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#ECEDEF" }}>{item.grade}</span> : null}
              {item.variant ? <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#ECEDEF" }}>{item.variant}</span> : null}
              <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#C8CDD2" }}>{item.isPublic ? "Public" : "Private"}</span>
            </div>
            <div className="mt-3 text-[21px] font-bold leading-none" style={{ color: value > 0 ? "#44D9F2" : "#8C9298" }} title={value <= 0 && paid > 0 ? "Purchase price. Not priced yet." : undefined}>{value > 0 ? formatMoney(value) : paid > 0 ? `${formatMoney(paid)} paid` : "Not valued"}</div>
            <div className="mt-1 text-[11px]" style={{ color: gain >= 0 ? "var(--color-gain, #4CAF82)" : "var(--color-loss, #E05252)" }}>
              {value <= 0 ? "Add a value to see return" : paid > 0 ? `${gain >= 0 ? "+" : ""}${gainPct.toFixed(1)}% since purchase` : "Add cost basis for return"}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 overflow-hidden rounded-[12px] border border-[color:var(--border)] lg:w-fit lg:grid-cols-[minmax(0,270px)_minmax(0,320px)_auto]">
        <div className="px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#C8CDD2" }}>Value Evidence</div>
          <div className="mt-3 grid grid-cols-3 gap-5 text-[11px]">
            <div>
              <div style={{ color: "#9E946E" }}>Low</div>
              <div className="mt-2 text-[12px] font-semibold" style={{ color: "#ECEDEF" }}>{low > 0 ? formatMoney(low) : "—"}</div>
            </div>
            <div>
              <div style={{ color: "#9E946E" }}>Median</div>
              <div className="mt-2 text-[18px] font-bold leading-none" style={{ color: "#44D9F2" }}>{median > 0 ? formatMoney(median) : "—"}</div>
            </div>
            <div>
              <div style={{ color: "#9E946E" }}>High</div>
              <div className="mt-2 text-[12px] font-semibold" style={{ color: "#ECEDEF" }}>{high > 0 ? formatMoney(high) : "—"}</div>
            </div>
          </div>
          <div className="mt-3 text-[10px]" style={{ color: "#9E946E" }}>
            Confidence: {item.priceConfidence || readiness} · {item.comparables?.length ?? 0} comps
          </div>
          <Link href={detailHref} className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: "#C8CDD2" }}>
            View details <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="relative px-4 py-2.5 before:absolute before:left-0 before:top-1/2 before:h-11 before:w-px before:-translate-y-1/2 before:bg-[color:var(--border)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#C8CDD2" }}>Documentation</div>
          <div className="mt-2.5 grid grid-cols-[72px_minmax(0,1fr)] gap-4">
            <div className="flex flex-col items-center gap-0.5">
              <PercentDonut percent={docs.percent} />
              <div className="text-[10px]" style={{ color: "#9E946E" }}>Complete</div>
            </div>
            <div className="min-w-0">
              <div className="space-y-1 text-[11px]">
                {docs.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className={["inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold", row.complete ? "bg-emerald-500/80 text-black" : "bg-red-500/90 text-white"].join(" ")}>
                        <AppIcon name={row.complete ? "checkmark" : "warning"} size={10} strokeWidth={3} />
                      </span>
                      <span className="truncate" style={{ color: "#ECEDEF" }}>{row.label}</span>
                    </span>
                    {!row.complete && row.warn ? <span className="text-[10px]" style={{ color: "#C8CDD2" }}>Missing</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Link href={detailHref} className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: "#C8CDD2" }}>
            View all docs <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="relative px-4 py-2.5 before:absolute before:left-0 before:top-1/2 before:h-11 before:w-px before:-translate-y-1/2 before:bg-[color:var(--border)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#C8CDD2" }}>Share / Sell</div>
          <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: "#ECEDEF" }}>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"><AppIcon name="externalLink" size={10} /></span>
              Public Exhibition
            </span>
            <ItemVisibilityToggle item={item} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportItemData} className="inline-flex min-h-[28px] w-auto items-center justify-center gap-2 rounded-[7px] px-3 text-[11px] font-semibold ring-1 ring-[color:var(--theme-gold-border)]" style={{ color: "#C8CDD2" }}>
              Export Data
            </button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The Vault list. On /vault it shows everything with universe chips; on /vault/<universe> it is
 * the same screen locked to that one universe (no chips, universe title, a way back to all).
 */
export default function VaultListView({ lockedUniverse }: { lockedUniverse?: UniverseKey } = {}) {
  const [focusKey] = useState<UniverseKey | null>(() => readFocusUniverseKey());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>(lockedUniverse ?? "ALL");
  // Moving between universe routes reuses this component: follow the route.
  useEffect(() => {
    setUniverseFilter(lockedUniverse ?? "ALL");
  }, [lockedUniverse]);
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  // Opened by the "Insurance Ready" and "Needs Review" cards (or a link with ?review=...): the same rule as the card's count.
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [reviewGap, setReviewGap] = useState<ReviewGap | null>(null);
  const [gradedOnly, setGradedOnly] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [subFilter, setSubFilter] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showSoldItems, setShowSoldItems] = useState(false);
  // The current filters, kept in a ref so opening an item can remember them and Back can put them back.
  const filtersRef = useRef<Record<string, unknown>>({});
  filtersRef.current = { query, universeFilter, readinessFilter, reviewFilter, reviewGap, gradedOnly, uncategorizedOnly, categoryFilter, subFilter, sortMode, showSoldItems, locked: lockedUniverse ?? null };
  const [sales, setSales] = useState<SaleInfo[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [vaultViewMode, setVaultViewMode] = useState<VaultViewMode>("wall");
  const [myProfiles, setMyProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [confirmProfileMove, setConfirmProfileMove] = useState<ProfileRow | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(FIRST_PAINT_ITEM_COUNT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [moveTargetUniverse, setMoveTargetUniverse] = useState<string>("");
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>("");
  const [moveTargetSubcategory, setMoveTargetSubcategory] = useState<string>("");
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUniverseMenu, setShowUniverseMenu] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [isDetailDrawerDismissed, setIsDetailDrawerDismissed] = useState(false);
  const [visibleUniverseKeys, setVisibleUniverseKeys] = useState<UniverseKey[] | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(VISIBLE_UNIVERSE_CHIPS_LS_KEY) || "null");
      return Array.isArray(parsed) ? parsed.filter(isUniverseKey) : null;
    } catch {
      return null;
    }
  });

  function refresh(profileId?: string) {
    const next = loadItems(profileId ? { profileId } : undefined);
    // Re-reading the device copy gives new objects for the same items. Keep the ones that did not change (and the whole list,
    // when nothing did) so a re-read that found nothing new does not redraw every card.
    setItems((prev) => reuseUnchangedItems(prev, next));
    setSales(readSales());
    setPendingSyncCount(getPendingVaultSyncCount());
  }

  // Loading, in this order:
  //  1. The copy saved on this device, when it is recorded as belonging to the person signed in and a profile is chosen.
  //     Shown straight away (no network), so the Vault is usable while everything else happens.
  //  2. Who is signed in and which profile is active, checked with a time limit. A different answer replaces what is shown.
  //  3. Uploads waiting on this device and the cloud pull, in the background. They never hold the page; when they bring
  //     something new it is read back in.
  // A device copy that is not recorded as this person's is never shown. If there is nothing to show yet, the page says it is
  // loading, and if the cloud cannot be reached it says that (with a Try again button) instead of looking like an empty Vault.
  const hydrateSeq = useRef(0);
  const shownProfileRef = useRef("");
  const [loadFailed, setLoadFailed] = useState(false);
  // The account says nobody is signed in: the page must say so (the route check also sends the person to sign in), never "your vault is empty".
  const [signedOut, setSignedOut] = useState(false);
  const [loadSlow, setLoadSlow] = useState(false);

  function showDeviceCopy(profileId: string) {
    shownProfileRef.current = profileId;
    refresh(profileId);
    if (promoteLegacySalesToItems()) refresh(profileId);
  }

  async function hydrateAll() {
    const mine = ++hydrateSeq.current;
    const stillCurrent = () => mine === hydrateSeq.current;
    setLoadFailed(false);
    setSignedOut(false);
    setLoadSlow(false);
    window.setTimeout(() => {
      if (stillCurrent()) setLoadSlow(true);
    }, SLOW_LOAD_NOTICE_MS);

    // 1. This device's copy, if it is verifiably this person's.
    const signedInAs = storedSessionUserId();
    let profileId = "";
    const storedProfileId = getStoredActiveProfileId();
    if (signedInAs && storedProfileId && currentLocalOwner() === signedInAs) {
      profileId = storedProfileId;
      showDeviceCopy(profileId);
      if (loadItems({ profileId }).length > 0) setInitialLoadComplete(true);
    }

    // The cloud half (uploads, then the download). For one profile; it only changes the page while that is still the profile
    // being shown. Started at once when the profile is already known, so it runs alongside the account check, not after it.
    let target = profileId;
    async function finishCloud(forProfile: string) {
      let answered = false;
      try {
        // Changes waiting to be sent go first, exactly as before: a download that landed first would lay the cloud's older copy
        // over an edit that has not been sent yet (and the upload would then send the old values). The upload run ends with
        // a download of its own; the checked one below reuses it when nothing changed since.
        if (hasSupabaseEnv()) requeueSpecsDeviceOnly(); // items whose specialist details never reached the account go again
        if (hasSupabaseEnv() && getPendingVaultSyncCount() > 0) {
          await withTimeout(processVaultSyncQueue(), CLOUD_PULL_TIMEOUT_MS);
        }
        const result = await withTimeout(syncVaultItemsFromSupabaseChecked(forProfile), CLOUD_PULL_TIMEOUT_MS);
        answered = result.ok;
      } catch {
        answered = false;
      }
      if (stillCurrent()) setPendingSyncCount(getPendingVaultSyncCount());
      if (!stillCurrent() || target !== forProfile) return;
      if (ensureVaultItemUniverses()) void processVaultSyncQueue();
      showDeviceCopy(forProfile);
      const hasItems = loadItems({ profileId: forProfile }).length > 0;
      if (!answered && !hasItems) setLoadFailed(true);
      if (!answered && hasItems && hasSupabaseEnv()) {
        setSyncStatus("Could not reach the cloud just now. Showing what is saved on this device.");
      }
      setInitialLoadComplete(true);
    }
    let cloud: Promise<void> | null = null;
    if (profileId) cloud = finishCloud(profileId);

    // 2. Who is signed in, which profile (bounded; nothing already on screen waits for it).
    let status: Awaited<ReturnType<typeof getOnboardingStatus>> | null = null;
    try {
      status = await withTimeout(getOnboardingStatus(), ACCOUNT_CHECK_TIMEOUT_MS);
    } catch {
      status = null;
    }
    if (!stillCurrent()) return;

    if (status && !status.isAuthenticated) {
      // Signed out or the session ended: the route check sends the person to sign in. Nothing is shown for nobody.
      target = "";
      shownProfileRef.current = "";
      setItems([]);
      setSignedOut(true);
      setInitialLoadComplete(true);
      return;
    }
    const verifiedProfileId = status?.activeProfile?.id ?? "";
    if (verifiedProfileId && verifiedProfileId !== profileId) {
      // The profile in use is not the one remembered: show the right one and fetch for it.
      profileId = verifiedProfileId;
      target = verifiedProfileId;
      showDeviceCopy(verifiedProfileId);
      cloud = finishCloud(verifiedProfileId);
    } else if (verifiedProfileId && shownProfileRef.current !== profileId) {
      showDeviceCopy(profileId);
    }
    if (!profileId) {
      // Could not tell who this is or which profile (account check failed or timed out) and nothing verified is on screen.
      setLoadFailed(true);
      setInitialLoadComplete(true);
      return;
    }
    if (loadItems({ profileId }).length > 0) setInitialLoadComplete(true);
    if (!cloud) cloud = finishCloud(profileId);
    // With something to show the page is already usable; with nothing, wait for the answer (it ends in items, "empty" or
    // "could not load", never in an open-ended skeleton).
    if (loadItems({ profileId }).length === 0) await cloud;
  }

  useEffect(() => {
    if (initialLoadComplete) setLoadSlow(false);
  }, [initialLoadComplete]);

  useEffect(() => {
    void hydrateAll();

    function onActiveProfileChange() {
      void hydrateAll();
    }

    // Something changed the device copy (a save, a finished upload, another page). Read it again; no cloud round trip. This
    // used to start the whole upload-and-download sequence again, and finishing that fired this event again.
    let refreshTimer: number | undefined;
    function onVaultUpdate() {
      if (refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined;
        const signedInAs = storedSessionUserId();
        const profileId = getStoredActiveProfileId();
        if (!signedInAs || !profileId || currentLocalOwner() !== signedInAs || profileId !== shownProfileRef.current) {
          void hydrateAll(); // who or which profile changed: verify again before showing anything
          return;
        }
        refresh(profileId);
      }, 120);
    }

    function onOnline() {
      setSyncStatus("Back online. Syncing queued changes...");
      void hydrateAll().then(() => {
        setSyncStatus(
          getPendingVaultSyncCount() > 0
            ? "Some changes still waiting to sync."
            : "Cloud sync is up to date."
        );
      });
    }

    window.addEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
    window.addEventListener("vltd:vault-updated", onVaultUpdate);
    window.addEventListener("online", onOnline);

    return () => {
      hydrateSeq.current += 1; // an answer that arrives after the page is gone changes nothing
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
      window.removeEventListener("vltd:vault-updated", onVaultUpdate);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);
    function handleOnlineState() {
      setIsOnline(true);
    }
    function handleOfflineState() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnlineState);
    window.addEventListener("offline", handleOfflineState);
    return () => {
      window.removeEventListener("online", handleOnlineState);
      window.removeEventListener("offline", handleOfflineState);
    };
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(items.map((item) => String(item.id)));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const intelligenceMap = useMemo(() => {
    if (!items.length) return {};
    return computeItemIntelligence(items);
  }, [items]);

  // The view you picked is remembered. (Older saved values: "swipe" is now "flip".)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      // Anything else that was saved (the removed Shelf and Museum views, unknown values) falls back to Wall.
      const known: Record<string, VaultViewMode> = { wall: "wall", gallery: "gallery", flip: "flip", swipe: "flip" };
      setVaultViewMode(saved && known[saved] ? known[saved] : "wall");
    } catch {
      // storage unavailable: keep the default view
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, vaultViewMode);
    } catch {
      // storage unavailable
    }
  }, [vaultViewMode]);

  // Scroll restoration: open an item, press Back, and the list returns to the same spot.
  // The page scrolls inside .vltd-content-wrap, not the window. Two paths: a fresh remount reads
  // the saved spot on mount; a cached page gets popstate. The saved spot also remembers how many
  // items had been loaded, so the list is tall enough to scroll back to.
  const visibleCountRef = useRef(INITIAL_VISIBLE_ITEM_COUNT);
  useEffect(() => {
    visibleCountRef.current = visibleItemCount;
  }, [visibleItemCount]);
  useEffect(() => {
    function getScroller() {
      return document.querySelector<HTMLElement>(".vltd-content-wrap");
    }

    function applyScrollRestore(target: number) {
      let attempts = 0;
      function poll() {
        const el = getScroller();
        // Wait (up to ~5s) for the list to load and be tall enough, then jump once.
        if (el && (el.scrollHeight >= target || attempts >= 45)) {
          el.scrollTop = target;
          return;
        }
        if (++attempts < 50) setTimeout(poll, 100);
      }
      setTimeout(poll, 50);
    }

    function saveSpot() {
      try {
        const el = getScroller();
        sessionStorage.setItem("vltd_vault_scroll_y", String(el ? el.scrollTop : 0));
        sessionStorage.setItem("vltd_vault_scroll_count", String(visibleCountRef.current));
        sessionStorage.setItem("vltd_vault_filters", JSON.stringify(filtersRef.current));
      } catch {
        // storage unavailable
      }
    }

    function restoreFilters() {
      try {
        const saved = sessionStorage.getItem("vltd_vault_filters");
        if (!saved) return;
        sessionStorage.removeItem("vltd_vault_filters");
        const f = JSON.parse(saved) as Record<string, unknown>;
        // Only put them back on the same list they came from (all universes, or the same universe route).
        if ((f.locked ?? null) !== (lockedUniverse ?? null)) return;
        if (typeof f.query === "string") setQuery(f.query);
        if (!lockedUniverse && typeof f.universeFilter === "string") setUniverseFilter(f.universeFilter as UniverseFilter);
        if (typeof f.readinessFilter === "string") setReadinessFilter(f.readinessFilter as ReadinessFilter);
        if (f.reviewFilter === "insurance_ready" || f.reviewFilter === "needs_review") setReviewFilter(f.reviewFilter);
        if (typeof f.reviewGap === "string" && (REVIEW_GAP_FILTERS as string[]).includes(f.reviewGap)) setReviewGap(f.reviewGap as ReviewGap);
        if (typeof f.gradedOnly === "boolean") setGradedOnly(f.gradedOnly);
        if (typeof f.uncategorizedOnly === "boolean") setUncategorizedOnly(f.uncategorizedOnly);
        if (Array.isArray(f.categoryFilter)) setCategoryFilter(f.categoryFilter.filter((x): x is string => typeof x === "string"));
        if (Array.isArray(f.subFilter)) setSubFilter(f.subFilter.filter((x): x is string => typeof x === "string"));
        if (typeof f.sortMode === "string") setSortMode(f.sortMode as SortMode);
        if (typeof f.showSoldItems === "boolean") setShowSoldItems(f.showSoldItems);
      } catch {
        // storage unavailable
      }
    }

    function restoreSpot() {
      restoreFilters();
      try {
        const raw = sessionStorage.getItem("vltd_vault_scroll_y");
        if (!raw) return;
        const target = parseInt(raw, 10);
        const count = parseInt(sessionStorage.getItem("vltd_vault_scroll_count") ?? "", 10);
        sessionStorage.removeItem("vltd_vault_scroll_y");
        sessionStorage.removeItem("vltd_vault_scroll_count");
        if (!Number.isNaN(count) && count > INITIAL_VISIBLE_ITEM_COUNT) {
          setVisibleItemCount((current) => Math.max(current, count));
        }
        if (!Number.isNaN(target) && target > 0) applyScrollRestore(target);
      } catch {
        // storage unavailable
      }
    }

    function saveOnClick(event: MouseEvent) {
      if ((event.target as HTMLElement).closest("a[href]")) saveSpot();
    }

    document.addEventListener("click", saveOnClick, true);
    window.addEventListener("popstate", restoreSpot);
    restoreSpot();
    return () => {
      document.removeEventListener("click", saveOnClick, true);
      window.removeEventListener("popstate", restoreSpot);
    };
  }, []);

  // Profiles, so selected items can be moved between them (personal <-> business).
  useEffect(() => {
    setActiveProfileId(getStoredActiveProfileId());
    let active = true;
    void listMyProfiles().then(({ data }) => {
      if (active) setMyProfiles(data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    const saleMap = Object.fromEntries(sales.map((sale) => [String(sale.id), sale]));
    const next = items.filter((item) => {
      const isSold = Boolean(saleInfoForItem(item, saleMap));
      if (!showSoldItems && isSold) return false;
      if (universeFilter !== "ALL" && universeForItem(item) !== universeFilter) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(chipKey(vaultItemCategory(item)))) return false;
      if (subFilter.length > 0 && !subFilter.includes(chipKey(vaultItemSubcategory(item)))) return false;
      if (gradedOnly && !item.grade) return false;
      if (
        uncategorizedOnly &&
        (item.categoryLabel || item.customCategoryLabel || item.category || item.subcategoryLabel || item.universe)
      ) {
        return false;
      }
      const intelligence = intelligenceMap[item.id];
      const readiness = (intelligence?.readiness ?? "Low").toLowerCase();
      if (readinessFilter !== "all" && readiness !== readinessFilter) return false;
      if (q) {
        const text = [
          item.title,
          item.subtitle,
          item.number,
          item.grade,
          item.notes,
          item.category,
          item.categoryLabel,
          item.subcategoryLabel,
          item.universe,
          item.storageLocation,
          item.certNumber,
          item.serialNumber,
          item.purchaseSource,
          item.purchaseLocation,
          item.orderNumber,
          item.priceSource,
          item.priceNotes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    next.sort((a, b) => {
      if (sortMode === "newest") return getCreatedAtMs(b) - getCreatedAtMs(a);
      if (sortMode === "value_desc") return effectiveMarketValue(b) - effectiveMarketValue(a);
      if (sortMode === "value_asc") return effectiveMarketValue(a) - effectiveMarketValue(b);
      if (sortMode === "gain_desc") return itemGain(b) - itemGain(a);
      if (sortMode === "gain_asc") return itemGain(a) - itemGain(b);
      return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });

    return next;
  }, [items, query, universeFilter, categoryFilter, subFilter, gradedOnly, uncategorizedOnly, sortMode, readinessFilter, intelligenceMap, sales, showSoldItems]);

  // The list the summary cards open. The cards count `filteredBase` (everything the person has filtered by EXCEPT this), and this
  // applies the same rule to that same list, so a card's number is always the length of the list it opens.
  const filteredItems = useMemo(() => {
    if (reviewFilter === "all") return filteredBase;
    const counted = new Set(activeItems(filteredBase).map((item) => item.id));
    return filteredBase.filter((item) => counted.has(item.id) && matchesReview(item, reviewFilter, reviewGap));
  }, [filteredBase, reviewFilter, reviewGap]);

  const universeScopedItems = useMemo(
    () => (universeFilter === "ALL" ? [] : items.filter((item) => universeForItem(item) === universeFilter)),
    [items, universeFilter]
  );
  // A category only makes sense inside one universe: clear it when the universe changes.
  useEffect(() => {
    setCategoryFilter([]);
    setSubFilter([]);
  }, [universeFilter]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleItemCount),
    [filteredItems, visibleItemCount]
  );

  useEffect(() => {
    // Runs on the first render too: the first screen is already drawn, so the rest of the first page is a transition.
    startTransition(() => setVisibleItemCount(INITIAL_VISIBLE_ITEM_COUNT));
  }, [query, universeFilter, readinessFilter, reviewFilter, reviewGap, gradedOnly, uncategorizedOnly, sortMode, showSoldItems, vaultViewMode]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedDetailId(null);
      return;
    }

    // Clear a stale selection if the item left the list; never auto-select —
    // the quick-look stays hidden until the user taps an item.
    if (selectedDetailId && !filteredItems.some((item) => String(item.id) === String(selectedDetailId))) {
      setSelectedDetailId(null);
    }
  }, [filteredItems, selectedDetailId]);

  const saleMap = useMemo(
    () => Object.fromEntries(sales.map((sale) => [String(sale.id), sale])),
    [sales]
  );
  const soldCount = useMemo(
    () => items.filter((item) => saleInfoForItem(item, saleMap)).length,
    [items, saleMap]
  );
  const gradedCount = useMemo(
    () => items.filter((item) => Boolean(item.grade)).length,
    [items]
  );
  const uncategorizedCount = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.categoryLabel &&
          !item.customCategoryLabel &&
          !item.category &&
          !item.subcategoryLabel &&
          !item.universe
      ).length,
    [items]
  );
  const publicCount = useMemo(
    () => items.filter((item) => item.isPublic === true && !saleInfoForItem(item, saleMap)).length,
    [items, saleMap]
  );
  const privateCount = useMemo(
    () => items.filter((item) => item.isPublic !== true && !saleInfoForItem(item, saleMap)).length,
    [items, saleMap]
  );

  const universeGroups = useMemo(() => {
    const groups = VAULT_UNIVERSES.reduce(
      (acc, category) => {
        acc[category.key] = [];
        return acc;
      },
      {} as Record<UniverseKey, VaultItem[]>
    );

    for (const item of items) {
      if (saleInfoForItem(item, saleMap)) continue;
      groups[universeForItem(item)].push(item);
    }

    for (const category of VAULT_UNIVERSES) {
      groups[category.key].sort((a, b) => effectiveMarketValue(b) - effectiveMarketValue(a));
    }

    return groups;
  }, [items, saleMap]);

  const orderedUniverses = useMemo(() => {
    if (!focusKey) return VAULT_UNIVERSES;
    const idx = VAULT_UNIVERSES.findIndex((u) => u.key === focusKey);
    if (idx <= 0) return VAULT_UNIVERSES;
    const arr = [...VAULT_UNIVERSES];
    const [focusEntry] = arr.splice(idx, 1);
    arr.unshift(focusEntry);
    return arr;
  }, [focusKey]);

  const defaultVisibleUniverseKeys = useMemo(() => {
    const withItems = orderedUniverses
      .filter((category) => (universeGroups[category.key]?.length ?? 0) > 0)
      .map((category) => category.key);
    if (focusKey) return Array.from(new Set([focusKey, ...withItems]));
    return withItems.length ? withItems : orderedUniverses.map((category) => category.key);
  }, [focusKey, orderedUniverses, universeGroups]);

  const visibleUniverseKeySet = useMemo(
    () => new Set(visibleUniverseKeys ?? defaultVisibleUniverseKeys),
    [defaultVisibleUniverseKeys, visibleUniverseKeys]
  );

  const visibleUniverseChips = useMemo(
    () => orderedUniverses.filter((category) => visibleUniverseKeySet.has(category.key)),
    [orderedUniverses, visibleUniverseKeySet]
  );

  function updateVisibleUniverseKeys(updater: (current: UniverseKey[]) => UniverseKey[]) {
    setVisibleUniverseKeys((current) => {
      const base = current ?? defaultVisibleUniverseKeys;
      const next = Array.from(new Set(updater(base))).filter(isUniverseKey);
      window.localStorage.setItem(VISIBLE_UNIVERSE_CHIPS_LS_KEY, JSON.stringify(next));
      // Also saved to the profile (Settings > Preferences > Universes displayed), so every device agrees.
      const profileId = getStoredActiveProfileId();
      if (profileId) void saveDisplayedUniverses(profileId, next).catch(() => {});
      return next;
    });
  }

  // Universes displayed is a saved setting. When the profile has one, it decides which universe chips show here.
  useEffect(() => {
    let active = true;
    async function loadDisplayed() {
      try {
        const status = await getOnboardingStatus();
        if (!active || !status.activeProfile) return;
        const prefs = readUniversePrefs(status.activeProfile as unknown as Record<string, unknown>);
        if (prefs.displayed) {
          setVisibleUniverseKeys(prefs.displayed);
          window.localStorage.setItem(VISIBLE_UNIVERSE_CHIPS_LS_KEY, JSON.stringify(prefs.displayed));
        } else {
          setVisibleUniverseKeys(null);
          window.localStorage.removeItem(VISIBLE_UNIVERSE_CHIPS_LS_KEY);
        }
      } catch {
        /* keep what this device remembered */
      }
    }
    void loadDisplayed();
    return () => {
      active = false;
    };
  }, []);

  // Same switch as the Home page (remembered on this device): count un-priced
  // items at purchase price ("fill", default) or show priced items only.
  const [valueMode, setValueMode] = useState<ValueMode>("fill");
  useEffect(() => {
    const sync = () => setValueMode(readValueMode());
    sync();
    window.addEventListener("vltd:value-mode", sync);
    return () => window.removeEventListener("vltd:value-mode", sync);
  }, []);

  const stats = useMemo(() => {
    // Supplies (boxes, cases) stay in the list but never count toward the
    // collection's value, insurance readiness or review counts.
    const counted = activeItems(filteredBase);
    const totalItems = counted.length;
    const summary = summarizeValues(counted, valueMode);
    const totalCostValue = summary.totalCost;
    const totalValue = summary.totalValue;
    const totalGain = summary.totalGain;
    const universeCount = new Set(counted.map((item) => universeForItem(item))).size;
    const review = reviewCounts(counted);
    const insuranceReadyCount = review.ready;
    const needsReviewCount = review.needsReview;
    const insuranceReadyPct = totalItems ? Math.round((insuranceReadyCount / totalItems) * 100) : 0;
    const valuedCount = summary.pricedCount;
    const ghostCount = summary.ghostCount;
    const staleCheckCount = counted.filter((item) => effectiveMarketValue(item) > 0 && priceCheckIsStale(item)).length;
    return {
      staleCheckCount,
      totalItems,
      valuedCount,
      ghostCount,
      totalCost: totalCostValue,
      totalValue,
      totalGain,
      gainItemCount: summary.gainItemCount,
      gainCostBase: summary.costBase,
      gainExcludedText: describeGainExclusions({ noValueCount: summary.gainExcluded.noValue, noCostCount: summary.gainExcluded.noCost, zeroCostCount: summary.gainExcluded.zeroCost }),
      universeCount,
      insuranceReadyCount,
      insuranceReadyPct,
      needsReviewCount,
      gapCounts: review.byGap,
    };
  }, [filteredBase, valueMode]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    universeFilter !== (lockedUniverse ?? "ALL") ||
    categoryFilter.length > 0 ||
    subFilter.length > 0 ||
    readinessFilter !== "all" ||
    reviewFilter !== "all" ||
    gradedOnly ||
    uncategorizedOnly ||
    showSoldItems ||
    sortMode !== "newest";

  const selectedDetailItem =
    // Quick-look stays hidden until an item is tapped (desktop + mobile).
    filteredItems.find((item) => String(item.id) === String(selectedDetailId)) ?? null;
  const shouldShowSelectionDrawer =
    Boolean(selectedDetailItem) &&
    !isDetailDrawerDismissed &&
    vaultViewMode !== "wall" &&
    vaultViewMode !== "flip" &&
    filteredItems.length > 0;

  async function runMigration() {
    setIsMigrating(true);
    setSyncStatus("Migrating local-only images from this device to Supabase...");
    try {
      const result = await migrateExistingVaultImagesToSupabase();
      await hydrateAll();
      setSyncStatus(
        `Migration finished. ${result.migrated} image(s) migrated from this device, ${result.skipped} skipped.`
      );
    } finally {
      setIsMigrating(false);
    }
  }

  // Stable references (they only use state setters and module functions) so
  // the memoized VaultCard below is not re-rendered by every selection tick.
  const handleSaveItem = useCallback(async (nextItem: VaultItem) => {
    saveItem(nextItem);
    enqueueVaultItemSync(nextItem.id);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));

    if (hasSupabaseEnv()) {
      await processVaultSyncQueue();
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
  }, []);

  const handleDeleteItem = useCallback(async (target: VaultItem) => {
    setItems((prev) => prev.filter((entry) => String(entry.id) !== String(target.id)));
    const result = await deleteVaultItemEverywhere(target.id);
    if (!result.ok) {
      // deleteVaultItemEverywhere already restored the item in storage and
      // fired vltd:vault-updated, which hydrateAll() picks up — this just
      // surfaces why it came back instead of leaving it unexplained.
      setSyncStatus(result.error || "Could not delete this item from the cloud.");
    }
  }, []);

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMassDelete() {
    if (selectedIds.size === 0) return;
    setDeleteConfirmPending(true);
  }

  async function confirmMassDelete() {
    const toDelete = items.filter((item) => selectedIds.has(item.id));
    if (toDelete.length === 0) {
      setDeleteConfirmPending(false);
      return;
    }
    const idsToDelete = new Set(toDelete.map((item) => String(item.id)));

    setIsDeleting(true);
    try {
      setItems((prev) => prev.filter((entry) => !idsToDelete.has(String(entry.id))));
      const result = await deleteVaultItemsEverywhere(toDelete.map((item) => item.id));
      if (!result.ok) {
        setSyncStatus(result.error || "Could not delete some items from the cloud.");
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirmPending(false);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  }

  function handleMassMove() {
    if (!moveTargetUniverse || selectedIds.size === 0) return;
    const updated = items.map((item) => {
      if (!selectedIds.has(item.id)) return item;
      return {
        ...item,
        universe: moveTargetUniverse,
        ...(moveTargetCategory ? { category: moveTargetCategory, categoryLabel: moveTargetCategory } : {}),
        ...(moveTargetSubcategory ? { subcategoryLabel: moveTargetSubcategory } : {}),
      };
    });
    // One local save + one queue write for the whole batch, then show the
    // result right away. The cloud upload runs in the background; the queue is
    // stored, so it still finishes if the tab is closed and reopened.
    const movedCount = selectedIds.size;
    const movedTo = [UNIVERSE_LABEL[moveTargetUniverse as UniverseKey] ?? moveTargetUniverse, moveTargetCategory, moveTargetSubcategory].filter(Boolean).join(" · ");
    commitVaultItemEdits(updated.filter((item) => selectedIds.has(item.id)));
    showToast(`Moved ${movedCount} item${movedCount === 1 ? "" : "s"} to ${movedTo}`, 4000);
    setItems(updated);
    setSelectedIds(new Set());
    setSelectMode(false);
    setMoveTargetUniverse("");
    setMoveTargetCategory("");
    setMoveTargetSubcategory("");

    if (hasSupabaseEnv()) {
      void processVaultSyncQueue()
        .then((res) => {
          if (res && res.remaining > 0) {
            showToast(`${res.remaining} item${res.remaining === 1 ? "" : "s"} saved here but not uploaded yet. Will retry.`, 6000);
          }
          window.dispatchEvent(new Event("vltd:vault-updated"));
        })
        .catch(() => showToast("Moved here, but the upload failed. Will retry.", 6000));
    } else {
      window.dispatchEvent(new Event("vltd:vault-updated"));
    }
  }

  /** Move the selected items to another profile (personal <-> business). */
  function handleMoveToProfile(targetProfileId: string) {
    if (!targetProfileId || selectedIds.size === 0) return;
    const movedItems = items
      .filter((item) => selectedIds.has(item.id))
      // A moved item starts private in its new profile; it is never made public by the move.
      .map((item) => ({ ...item, profile_id: targetProfileId, isPublic: false }));
    markPendingMoves(movedItems.map((item) => item.id), targetProfileId);
    commitVaultItemEdits(movedItems);
    // An exhibit only holds its own profile's items, so the moved ones leave this profile's exhibits.
    void import("@/lib/galleryModel").then((m) => m.removeItemIdsFromAllGalleriesConfirmed(movedItems.map((item) => item.id)));
    // Moved items now belong to another profile: drop them from this view.
    setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setConfirmProfileMove(null);
    if (hasSupabaseEnv()) {
      const movedIds = movedItems.map((item) => item.id);
      void processVaultSyncQueue().then((result) => {
        if (result.remaining === 0) clearPendingMoves(movedIds);
        else showToast("The move is saved here and will finish uploading when you are back online.", 6000);
        window.dispatchEvent(new Event("vltd:vault-updated"));
      });
    } else {
      window.dispatchEvent(new Event("vltd:vault-updated"));
    }
  }

  function handleClearFilters() {
    setQuery("");
    setUniverseFilter(lockedUniverse ?? "ALL");
    setCategoryFilter([]);
    setSubFilter([]);
    setReadinessFilter("all");
    setReviewFilter("all");
    setReviewGap(null);
    setShowSoldItems(false);
    setGradedOnly(false);
    setUncategorizedOnly(false);
    setSortMode("newest");
  }

  /** Opens a summary card's list (or goes back to the complete list). */
  function openReview(next: ReviewFilter) {
    setReviewGap(null);
    setReviewFilter((current) => (current === next ? "all" : next));
    window.setTimeout(() => document.getElementById("vault-list-start")?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
  }
  function showCompleteList() {
    handleClearFilters();
    window.setTimeout(() => document.getElementById("vault-list-start")?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
  }

  // Stable handlers for the memoised Gallery cells.
  const toggleSelectRef = useRef(toggleSelectItem);
  toggleSelectRef.current = toggleSelectItem;
  const onToggleSelectStable = useCallback((id: string) => toggleSelectRef.current(id), []);
  const onOpenDetailStable = useCallback((id: string) => {
    setSelectedDetailId(id);
    setIsDetailDrawerDismissed(false);
  }, []);

  // A link such as /vault?review=needs_review (from Home) opens the same list the card opens.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("review");
    if (wanted === "needs_review" || wanted === "insurance_ready") setReviewFilter(wanted);
    const gap = params.get("gap");
    if (wanted === "needs_review" && (REVIEW_GAP_FILTERS as string[]).includes(gap ?? "")) setReviewGap(gap as ReviewGap);
  }, []);

  return (
    <>
      <PageHeader
        title={lockedUniverse ? universeDisplayName(lockedUniverse) : "Vault"}
        description={
          lockedUniverse
            ? VAULT_UNIVERSES.find((entry) => entry.key === lockedUniverse)?.description ?? "Items in this universe."
            : "Every item you own, documented and searchable."
        }
        contentClassName="max-w-[1480px]"
        actions={
          <>
            {lockedUniverse ? <PillButton href="/vault">All Universes</PillButton> : null}
            {/* On phones the persistent Add Item above the bottom bar replaces this one. */}
            <span className="hidden md:inline-flex"><AddItemActions /></span>
            <VaultToolsMenu />
          </>
        }
      />
      <VaultNav activeKey="items" />
      <main className="text-[color:var(--fg)]">
      {!initialLoadComplete ? (
        <div className="mx-auto max-w-[1480px] px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8" aria-label="Loading your vault summary">
          <section className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[12px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]"
              />
            ))}
          </section>
          <VaultLoadingSkeleton slow={loadSlow} />
        </div>
      ) : (
      <div className="mx-auto max-w-[1480px] px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8">
        <section className="mb-5">
          {items.length > 0 ? (
            <div className="mb-3 hidden flex-wrap gap-2 text-xs text-[color:var(--muted)] sm:flex">
              <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">{privateCount} private</span>
              <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">{publicCount} public</span>
              <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">Public links only show items you unlock</span>
            </div>
          ) : null}

          <div className={["mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible", lockedUniverse ? "hidden" : ""].join(" ")}>
            <div className="relative shrink-0">
              <div className="inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setUniverseFilter("ALL")}
                  className={["inline-flex min-h-11 items-center rounded-[8px] px-4 text-sm font-semibold ring-1", universeFilter === "ALL" ? "bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)] ring-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setShowUniverseMenu((value) => !value)}
                  className="hidden min-h-11 items-center gap-1.5 rounded-[8px] px-4 text-sm font-semibold ring-1 sm:inline-flex"
                  style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
                  aria-expanded={showUniverseMenu}
                  aria-haspopup="true"
                >
                  Show <AppIcon name="chevronDown" size={16} />
                </button>
              </div>

              {showUniverseMenu ? (
                <div
                  className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-[8px] p-2 shadow-2xl"
                  style={{
                    background: "var(--theme-card)",
                    border: "1px solid var(--theme-border)",
                  }}
                >
                  <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                    Show Universe Titles
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {orderedUniverses.map((category) => {
                      const checked = visibleUniverseKeySet.has(category.key);
                      return (
                        <label
                          key={category.key}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-sm md:min-h-9"
                          style={{ color: "var(--fg)" }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              updateVisibleUniverseKeys((current) =>
                                checked
                                  ? current.filter((key) => key !== category.key)
                                  : [...current, category.key]
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{UNIVERSE_LABEL[category.key] ?? category.key}</span>
                          <span className="text-[11px] opacity-65">{universeGroups[category.key]?.length ?? 0}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            {visibleUniverseChips.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setUniverseFilter(category.key)}
                className={["inline-flex min-h-11 shrink-0 items-stretch gap-2 overflow-hidden rounded-[8px] pr-4 text-sm font-semibold ring-1", universeFilter === category.key ? "bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)] ring-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}
              >
                <span className="w-[42px] overflow-hidden border-r bg-[color:var(--theme-elevated)]" style={{ borderColor: "var(--theme-gold-border, var(--theme-border))" }}>
                  <ProgressiveImage src={category.thumbnailSrc} alt="" className="h-full w-full" imageClassName="object-cover object-center" draggable={false} />
                </span>
                <span className="self-center">{UNIVERSE_LABEL[category.key] ?? category.key}</span>
                <span className="self-center text-[11px] opacity-65">{universeGroups[category.key]?.length ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible xl:grid-cols-4">
            <div className="w-[140px] shrink-0 vltd-brushed vltd-status-cyan p-2.5 sm:w-auto sm:p-4">
              <Link
                href="/portfolio"
                aria-label={`Total value ${formatMoney(stats.totalValue)}. Open the financial breakdown`}
                title="Open the financial breakdown (Insights)"
                className={SUMMARY_CARD_FOCUS}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                  <AppIcon name="price" size={12} strokeWidth={1.8} />
                  Total Value
                </div>
                {valueMode === "priced" && stats.valuedCount === 0 ? (
                  <>
                    <div className="mt-1.5 text-lg font-extrabold tracking-[-0.02em] text-[color:var(--muted)] sm:mt-2.5 sm:text-2xl">No items priced yet</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">Total cost {formatMoney(stats.totalCost)}</div>
                  </>
                ) : (
                  <>
                    <div
                      className={"mt-1.5 text-xl font-extrabold tracking-[-0.02em] sm:mt-2.5 sm:text-3xl " + (valueMode === "fill" && stats.ghostCount > 0 ? "text-[color:var(--muted)]" : "text-[color:var(--data-color)]")}
                      title={valueMode === "fill" && stats.ghostCount > 0 ? "Includes purchase price for items not priced yet" : undefined}
                    >{formatMoney(stats.totalValue)}</div>
                    <div className={(stats.gainItemCount === 0 ? "text-[color:var(--muted)]" : stats.totalGain >= 0 ? "text-emerald-300" : "text-red-300") + " mt-0.5 text-[11px] sm:text-sm"} data-testid="vault-gain">{stats.gainItemCount === 0 ? "—" : `${stats.totalGain >= 0 ? "+" : ""}${formatMoney(stats.totalGain)}`}</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--muted)]" data-testid="vault-gain-basis">
                      Change on {stats.gainItemCount} of {stats.totalItems} items · cost basis {formatMoney(stats.gainCostBase)}
                      {stats.gainExcludedText ? ` · not counted: ${stats.gainExcludedText}` : ""}
                    </div>
                    {stats.valuedCount < stats.totalItems ? (
                      <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                        {valueMode === "fill" ? `${stats.ghostCount} of ${stats.totalItems} at purchase price` : `${stats.valuedCount} of ${stats.totalItems} priced`}
                      </div>
                    ) : null}
                  </>
                )}
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--data-color)]">
                  Financial breakdown <AppIcon name="next" size={11} strokeWidth={2} />
                </span>
              </Link>
              {!(valueMode === "priced" && stats.valuedCount === 0) && stats.totalItems > 0 && stats.valuedCount < stats.totalItems ? (
                <PillButton size="compact" className="mt-1" onClick={() => writeValueMode(valueMode === "fill" ? "priced" : "fill")}>
                  {valueMode === "fill" ? "Show priced only" : "Include unpriced"}
                </PillButton>
              ) : null}
              {!(valueMode === "priced" && stats.valuedCount === 0) && stats.staleCheckCount > 0 ? (
                <div className="mt-0.5 text-[11px] text-amber-400">{stats.staleCheckCount} {stats.staleCheckCount === 1 ? "item hasn't" : "items haven't"} had a price check in 6 months</div>
              ) : null}
            </div>

            <div className={"w-[140px] shrink-0 vltd-brushed p-2.5 sm:w-auto sm:p-4 " + (!hasActiveFilters ? "ring-1 ring-[color:var(--pill-active-ring)]" : "")}>
              <button
                type="button"
                onClick={showCompleteList}
                aria-pressed={!hasActiveFilters}
                aria-label={`${stats.totalItems} items. Show the complete list${hasActiveFilters ? " (clears all filters)" : ""}`}
                title="Show the complete list"
                className={SUMMARY_CARD_FOCUS}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                  <AppIcon name="box" size={12} strokeWidth={1.8} />
                  Items
                </div>
                <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] sm:mt-2.5 sm:text-3xl">{stats.totalItems}</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">{stats.universeCount} {stats.universeCount === 1 ? "universe" : "universes"}</div>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--data-color)]">
                  {hasActiveFilters ? "Show all items" : "All items shown"}
                </span>
              </button>
            </div>

            <div className={"w-[140px] shrink-0 vltd-brushed vltd-status-cyan p-2.5 sm:w-auto sm:p-4 " + (reviewFilter === "insurance_ready" ? "ring-2 ring-[color:var(--pill-active-ring)]" : "")}>
              <button
                type="button"
                onClick={() => openReview("insurance_ready")}
                aria-pressed={reviewFilter === "insurance_ready"}
                aria-label={`Documentation complete: ${stats.insuranceReadyCount} of ${stats.totalItems} items have a photo, a value, a purchase price and an identifying detail. ${reviewFilter === "insurance_ready" ? "Showing them. Press to go back to the complete list" : "Show these items"}`}
                title="Show the items whose documentation is complete (photo, value, purchase price, identifying detail)"
                className={SUMMARY_CARD_FOCUS}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                  <AppIcon name="shield" size={12} strokeWidth={1.8} />
                  Documentation Complete
                </div>
                <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-[color:var(--data-color)] sm:mt-2.5 sm:text-3xl">{stats.insuranceReadyPct}%</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">{stats.insuranceReadyCount} of {stats.totalItems} items · 4-point checklist</div>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--data-color)]">
                  {reviewFilter === "insurance_ready" ? "Showing these" : "See checklist and items"} <AppIcon name="next" size={11} strokeWidth={2} />
                </span>
              </button>
            </div>

            <div className={"w-[140px] shrink-0 vltd-brushed p-2.5 sm:w-auto sm:p-4 " + (reviewFilter === "needs_review" ? "ring-2 ring-[color:var(--pill-active-ring)]" : "")}>
              <button
                type="button"
                onClick={() => openReview("needs_review")}
                aria-pressed={reviewFilter === "needs_review"}
                aria-label={`Needs review: ${stats.needsReviewCount} items missing part of the documentation checklist. ${reviewFilter === "needs_review" ? "Showing them. Press to go back to the complete list" : "Show these items"}`}
                title="Show the items that need review"
                className={SUMMARY_CARD_FOCUS}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                  <AppIcon name="warning" size={12} strokeWidth={1.8} />
                  Needs Review
                </div>
                <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] sm:mt-2.5 sm:text-3xl">{stats.needsReviewCount}</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">Items missing info</div>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--data-color)]">
                  {reviewFilter === "needs_review" ? "Showing these" : "See what is missing"} <AppIcon name="next" size={11} strokeWidth={2} />
                </span>
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-[9px] border p-3" style={{ background: "var(--theme-card)", borderColor: "var(--theme-border)" }}>
            <div className="flex flex-wrap items-center gap-2">
              {items.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[color:var(--input)] px-2 py-1 ring-1 ring-[color:var(--border)]">
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                    View
                  </span>
                  {(
                    [
                      ["wall", "Wall"],
                      ["gallery", "Gallery"],
                      ["flip", "Flip"],
                    ] as const
                  ).map(([mode, label]) => (
                    <PillButton key={mode} variant={vaultViewMode === mode ? "active" : "default"} pressed={vaultViewMode === mode} onClick={() => setVaultViewMode(mode)}>
                      {label}
                    </PillButton>
                  ))}
                </div>
              ) : null}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="h-11 w-full rounded-[8px] bg-[color:var(--input)] px-3 text-[13px] ring-1 ring-[color:var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] sm:w-[180px] md:h-9"
                aria-label="Search the vault"
                style={{ borderColor: "var(--theme-border)" }}
              />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                aria-label="Sort the vault" className="h-11 w-auto rounded-[8px] bg-[color:var(--input)] px-3 text-[13px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] md:h-9"
              >
                <option value="newest">Newest</option>
                <option value="value_desc">Value ↓</option>
                <option value="value_asc">Value ↑</option>
                <option value="gain_desc">Gain ↓</option>
                <option value="gain_asc">Gain ↑</option>
                <option value="title">Title A-Z</option>
              </select>
              <PillButton variant={gradedOnly ? "active" : "default"} pressed={gradedOnly} onClick={() => setGradedOnly((v) => !v)}>
                Graded <span className="text-[11px] opacity-70">{gradedCount}</span>
              </PillButton>
              <PillButton variant={uncategorizedOnly ? "active" : "default"} pressed={uncategorizedOnly} onClick={() => setUncategorizedOnly((v) => !v)}>
                Uncategorized <span className="text-[11px] opacity-70">{uncategorizedCount}</span>
              </PillButton>
              <PillButton variant={showSoldItems ? "active" : "default"} pressed={showSoldItems} onClick={() => setShowSoldItems((value) => !value)}>
                Show Sold <span className="text-[11px] opacity-70">{soldCount}</span>
              </PillButton>
            </div>

            {universeFilter !== "ALL" ? (
              <VaultCategoryChips
                items={universeScopedItems}
                categories={categoryFilter}
                subcategories={subFilter}
                onCategories={setCategoryFilter}
                onSubcategories={setSubFilter}
              />
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {filteredItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <PillButton
                    variant={selectMode ? "active" : "default"}
                    pressed={selectMode}
                    ariaLabel="Select items"
                    title="Select items"
                    className="w-11 px-0! md:w-9"
                    onClick={() => { if (selectMode) return; setSelectMode(true); setMoveTargetUniverse(""); setMoveTargetCategory(""); setMoveTargetSubcategory(""); setDeleteConfirmPending(false); }}
                  >
                    <AppIcon name="selectItems" size={16} strokeWidth={1.3} />
                  </PillButton>
                  {selectMode && selectedIds.size > 0 && (
                    <>
                      {deleteConfirmPending ? (
                        <>
                          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>
                            Delete {selectedIds.size} {selectedIds.size === 1 ? "item" : "items"}?
                          </span>
                          <PillButton variant="danger" onClick={() => void confirmMassDelete()} disabled={isDeleting}>
                            {isDeleting ? "Deleting…" : "Yes, Delete"}
                          </PillButton>
                          <PillButton onClick={() => setDeleteConfirmPending(false)} disabled={isDeleting}>Cancel</PillButton>
                        </>
                      ) : (
                        <PillButton variant="danger" onClick={handleMassDelete}>Delete {selectedIds.size}</PillButton>
                      )}
                      <select
                        value={moveTargetUniverse}
                        onChange={(e) => { setMoveTargetUniverse(e.target.value); setMoveTargetCategory(""); setMoveTargetSubcategory(""); }}
                        className="h-8 rounded-[7px] bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
                        style={{ color: moveTargetUniverse ? "var(--fg)" : "var(--muted)" }}
                      >
                        <option value="">Move {selectedIds.size} to…</option>
                        {(Object.keys(UNIVERSE_LABEL) as UniverseKey[]).map((key) => (
                          <option key={key} value={key}>{UNIVERSE_LABEL[key]}</option>
                        ))}
                      </select>
                      <select
                        value={moveTargetCategory}
                        onChange={(e) => { setMoveTargetCategory(e.target.value); setMoveTargetSubcategory(""); }}
                        className="h-8 rounded-[7px] bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
                        style={{ color: moveTargetCategory ? "var(--fg)" : "var(--muted)" }}
                        disabled={!moveTargetUniverse}
                      >
                        <option value="">Category</option>
                        {moveTargetUniverse && isUniverseKey(moveTargetUniverse) && getCategories(moveTargetUniverse).map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <select
                        value={moveTargetSubcategory}
                        onChange={(e) => setMoveTargetSubcategory(e.target.value)}
                        className="h-8 rounded-[7px] bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
                        style={{ color: moveTargetSubcategory ? "var(--fg)" : "var(--muted)" }}
                        disabled={!moveTargetCategory}
                      >
                        <option value="">Subcategory</option>
                        {moveTargetUniverse && isUniverseKey(moveTargetUniverse) && moveTargetCategory && TAXONOMY[moveTargetUniverse][moveTargetCategory]?.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      {moveTargetUniverse && (
                        <PillButton variant="active" onClick={handleMassMove}>Move {selectedIds.size}</PillButton>
                      )}
                      {confirmProfileMove ? (
                        <>
                          <span className="text-xs font-semibold" style={{ color: "#93c5fd" }}>
                            Move {selectedIds.size} to {confirmProfileMove.display_name}? They leave this profile.
                          </span>
                          <PillButton variant="active" onClick={() => handleMoveToProfile(confirmProfileMove.id)}>Yes, move</PillButton>
                          <PillButton onClick={() => setConfirmProfileMove(null)}>No</PillButton>
                        </>
                      ) : (
                        myProfiles.filter((profile) => profile.id !== activeProfileId).map((profile) => (
                          <PillButton key={profile.id} onClick={() => setConfirmProfileMove(profile)} title={`Move selected items to your ${profile.profile_type} profile`}>
                            <AppIcon name="next" size={16} /> {profile.display_name}
                          </PillButton>
                        ))
                      )}
                    </>
                  )}
                  {selectMode && (
                    <PillButton onClick={() => setSelectedIds(new Set(filteredItems.map((entry) => entry.id)))}>Select all {filteredItems.length}</PillButton>
                  )}
                                    {selectMode && (
                    <PillButton onClick={() => { setSelectMode(false); setSelectedIds(new Set()); setMoveTargetUniverse(""); setMoveTargetCategory(""); setMoveTargetSubcategory(""); setDeleteConfirmPending(false); }}>Cancel</PillButton>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <div id="vault-list-start" className="scroll-mt-24" />
        {items.length > 0 ? (
          <section aria-label="Active filters" className="mt-3">
            {reviewFilter !== "all" ? (
              <div role="status" className="rounded-[12px] p-3 text-sm ring-1 ring-[color:var(--pill-active-ring)]" style={{ background: "var(--theme-card)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {reviewFilter === "insurance_ready"
                      ? `Documentation complete: ${filteredItems.length} of ${stats.totalItems} ${stats.totalItems === 1 ? "item" : "items"}`
                      : `Needs review: ${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"}${reviewGap ? ` ${REVIEW_GAP_HEADING[reviewGap]}` : ""}`}
                  </div>
                  <PillButton size="compact" onClick={() => { setReviewFilter("all"); setReviewGap(null); }}>Back to all items</PillButton>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--muted)]">
                  {reviewFilter === "insurance_ready"
                    ? "An item’s documentation is complete when all four of these are recorded. Boxes and display supplies are not counted."
                    : "These items are missing part of the documentation checklist below. Choose a missing piece to narrow the list, or open an item to fill it in. Boxes and display supplies are not counted."}
                </p>
                <ol className="mt-2 grid gap-1 text-[12px] leading-snug sm:grid-cols-2" aria-label="Documentation checklist">
                  {REVIEW_GAPS.map((gap, index) => (
                    <li key={gap} className="flex gap-1.5">
                      <span className="shrink-0 font-semibold text-[color:var(--data-color)]">{index + 1}.</span>
                      <span><span className="font-semibold">{REVIEW_CHECKLIST[gap].title}</span> <span className="text-[color:var(--muted)]">– {REVIEW_CHECKLIST[gap].rule}</span></span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--muted)]">{REVIEW_CHECKLIST_NOTE}</p>
                {reviewFilter === "needs_review" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {REVIEW_GAP_FILTERS.map((gap) => (
                      <PillButton key={gap} size="compact" variant={reviewGap === gap ? "active" : "default"} pressed={reviewGap === gap} onClick={() => setReviewGap((current) => (current === gap ? null : gap))}>
                        {REVIEW_GAP_PILL[gap]} <span className="text-[11px] opacity-70">{stats.gapCounts[gap]}</span>
                      </PillButton>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <PillButton size="compact" href="/insurance">Open the insurance packet</PillButton>
                    <PillButton size="compact" href="/portfolio/insurance">Insurance summary</PillButton>
                  </div>
                )}
                {filteredItems.length === 0 ? (
                  <p className="mt-2 text-[13px] font-medium">
                    {reviewFilter === "insurance_ready"
                      ? "No items have all four checklist items yet. Choose Needs Review to see what each one is missing."
                      : reviewGap
                        ? `No items match "${REVIEW_GAP_PILL[reviewGap]}".`
                        : "Nothing needs review. Every item has all four checklist items."}
                  </p>
                ) : null}
              </div>
            ) : null}
            {hasActiveFilters ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-live="polite">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Filters</span>
                {query.trim() ? <PillButton size="compact" onClick={() => setQuery("")} ariaLabel={`Clear search ${query.trim()}`}>Search “{query.trim()}” <AppIcon name="close" size={12} /></PillButton> : null}
                {universeFilter !== (lockedUniverse ?? "ALL") ? <PillButton size="compact" onClick={() => setUniverseFilter(lockedUniverse ?? "ALL")} ariaLabel="Clear universe filter">{UNIVERSE_LABEL[universeFilter as UniverseKey] ?? universeFilter} <AppIcon name="close" size={12} /></PillButton> : null}
                {categoryFilter.length > 0 ? <PillButton size="compact" onClick={() => { setCategoryFilter([]); setSubFilter([]); }} ariaLabel="Clear category filter">{categoryFilter.length === 1 ? "1 category" : `${categoryFilter.length} categories`} <AppIcon name="close" size={12} /></PillButton> : null}
                {subFilter.length > 0 ? <PillButton size="compact" onClick={() => setSubFilter([])} ariaLabel="Clear subcategory filter">{subFilter.length === 1 ? "1 subcategory" : `${subFilter.length} subcategories`} <AppIcon name="close" size={12} /></PillButton> : null}
                {gradedOnly ? <PillButton size="compact" onClick={() => setGradedOnly(false)} ariaLabel="Clear graded filter">Graded only <AppIcon name="close" size={12} /></PillButton> : null}
                {uncategorizedOnly ? <PillButton size="compact" onClick={() => setUncategorizedOnly(false)} ariaLabel="Clear uncategorized filter">Uncategorized only <AppIcon name="close" size={12} /></PillButton> : null}
                {showSoldItems ? <PillButton size="compact" onClick={() => setShowSoldItems(false)} ariaLabel="Hide sold items again">Sold items shown <AppIcon name="close" size={12} /></PillButton> : null}
                {readinessFilter !== "all" ? <PillButton size="compact" onClick={() => setReadinessFilter("all")} ariaLabel="Clear value-rank filter">Value rank: {readinessFilter} <AppIcon name="close" size={12} /></PillButton> : null}
                {reviewFilter !== "all" ? <PillButton size="compact" onClick={() => { setReviewFilter("all"); setReviewGap(null); }} ariaLabel="Clear review filter">{reviewFilter === "insurance_ready" ? "Documentation complete" : "Needs review"}{reviewGap ? ` · ${REVIEW_GAP_PILL[reviewGap].toLowerCase()}` : ""} <AppIcon name="close" size={12} /></PillButton> : null}
                {sortMode !== "newest" ? <PillButton size="compact" onClick={() => setSortMode("newest")} ariaLabel="Back to newest first">Sorted: {sortMode.replace("_", " ")} <AppIcon name="close" size={12} /></PillButton> : null}
                <PillButton size="compact" variant="active" onClick={handleClearFilters}>Clear all</PillButton>
              </div>
            ) : null}
          </section>
        ) : null}

        {items.length === 0 && !initialLoadComplete ? (
          <VaultLoadingSkeleton />
        ) : items.length === 0 && signedOut ? (
          <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]" role="alert">
            <div className="mx-auto max-w-xl text-center">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SIGNED OUT</div>
              <h2 className="mt-2 text-2xl font-semibold">Sign in to see your Vault</h2>
              <div className="mt-2 text-sm text-[color:var(--muted)]">Your session has ended. Your items are safe.</div>
              <div className="mt-5 flex justify-center">
                <PillButton variant="primary" href="/login?next=%2Fvault">Sign in</PillButton>
              </div>
            </div>
          </section>
        ) : items.length === 0 && loadFailed ? (
          <VaultLoadError onRetry={() => void hydrateAll()} />
        ) : items.length === 0 ? (
          <VaultEmptyState hasFilters={false} onClearFilters={handleClearFilters} />
        ) : vaultViewMode === "wall" ? (
          <VaultWallView items={filteredItems} saleMap={saleMap} sortMode={sortMode} showSold={showSoldItems} />
        ) : filteredItems.length === 0 ? (
          <VaultEmptyState hasFilters={hasActiveFilters} onClearFilters={handleClearFilters} />
        ) : vaultViewMode === "flip" ? (
          <section className="mt-4">
            <div className="mx-auto max-w-3xl">
              <SwipeStack
                // A new search, filter or sort starts the stack at the first card (it used to keep the old position, e.g. "4 / 10").
                key={[query, universeFilter, categoryFilter.join(","), subFilter.join(","), gradedOnly, uncategorizedOnly, showSoldItems, sortMode, readinessFilter, reviewFilter, reviewGap].join("|")}
                items={filteredItems}
                mode="vault"
                onOpen={(item) => {
                  // This view opens the item by loading the page, so remember the filters first (the other views do it on the link click).
                  try {
                    sessionStorage.setItem("vltd_vault_filters", JSON.stringify(filtersRef.current));
                  } catch {
                    /* storage unavailable */
                  }
                  window.location.href = `/vault/item/${item.id}`;
                }}
              />
            </div>
          </section>
        ) : (
          <section className="mt-4">
            <div
              className={[
                "grid",
                "gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
              ].join(" ")}
            >
              {visibleItems.map((item) => (
                <GalleryCell
                  key={item.id}
                  item={item}
                  readiness={intelligenceMap[item.id]?.readiness ?? "Low"}
                  sale={saleInfoForItem(item, saleMap)}
                  selected={selectedIds.has(item.id)}
                  selectMode={selectMode}
                  missingText={reviewFilter === "needs_review" ? reviewGaps(item).map((gap) => REVIEW_GAP_ROW[gap]).join(", ") : null}
                  displayMode={vaultViewMode}
                  onSaveItem={handleSaveItem}
                  onDeleteItem={handleDeleteItem}
                  onToggleSelect={onToggleSelectStable}
                  onOpenDetail={onOpenDetailStable}
                />
              ))}
            </div>
            {visibleItems.length < filteredItems.length ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => startTransition(() => setVisibleItemCount((count) => count + VISIBLE_ITEM_INCREMENT))}
                  className="min-h-11 rounded-[9px] px-5 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                  style={{ background: "var(--pill)", color: "var(--text)" }}
                >
                  Show {Math.min(VISIBLE_ITEM_INCREMENT, filteredItems.length - visibleItems.length)} more
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                    {visibleItems.length} of {filteredItems.length}
                  </span>
                </button>
              </div>
            ) : null}
            {shouldShowSelectionDrawer && selectedDetailItem ? (
              <VaultSelectionDrawer
                item={selectedDetailItem}
                readiness={intelligenceMap[selectedDetailItem.id]?.readiness ?? "Low"}
                onClose={() => setIsDetailDrawerDismissed(true)}
              />
            ) : null}
          </section>
        )}
      </div>
      )}
      </main>
    </>
  );
}
