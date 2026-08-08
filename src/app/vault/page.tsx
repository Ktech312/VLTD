"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ItemIntelligencePanel from "@/components/ItemIntelligencePanel";
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import RestoreVaultButton from "@/components/RestoreVaultButton";
import SellItemButton from "@/components/SellItemButton";
import VaultExportButton from "@/components/VaultExportButton";
import VaultWallView from "@/components/VaultWallView";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { universePlaceholder } from "@/lib/itemPlaceholder";
import SwipeStack from "@/components/SwipeStack";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, TAXONOMY, getCategories, isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import { migrateExistingVaultImagesToSupabase } from "@/lib/vaultMigration";
import {
  enqueueVaultItemSync,
  getPendingVaultSyncCount,
  processVaultSyncQueue,
} from "@/lib/vaultSyncQueue";
import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";
import {
  loadItems,
  saveItem,
  saveItems,
  syncVaultItemsFromSupabase,
  type VaultItem,
} from "@/lib/vaultModel";
import { hasSupabaseEnv, VAULT_ITEMS_TABLE } from "@/lib/vaultCloud";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";
const SALES_KEY = "vltd_sales_history";
const FOCUS_LS_KEY = "vltd_primary_focus";
const VISIBLE_UNIVERSE_CHIPS_LS_KEY = "vltd_visible_universe_chips";

type SortMode = "newest" | "value_desc" | "value_asc" | "gain_desc" | "gain_asc" | "title";
type ReadinessFilter = "all" | "high" | "moderate" | "low";
type UniverseFilter = "ALL" | UniverseKey;
type VaultViewMode = "wall" | "gallery" | "shelf" | "flip";
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

function itemGain(item: VaultItem) {
  return Number(item.currentValue ?? 0) - totalCost(item);
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

function universeToSlug(key: UniverseKey): VaultUniverseSlug {
  return VAULT_UNIVERSES.find((entry) => entry.key === key)?.slug ?? "misc";
}

function universeFromSlug(value: unknown): UniverseKey {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  return VAULT_UNIVERSES.find((entry) => entry.slug === slug)?.key ?? "MISC";
}

function normalizeUniverseText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directUniverseMatch(value: unknown): UniverseKey | "" {
  const text = normalizeUniverseText(value);
  if (!text) return "";

  if (["pop culture", "pop", "comics", "comic", "comic books", "toys", "figures", "figure", "funko", "manga", "marvel", "dc", "art cards"].includes(text)) return "POP_CULTURE";
  if (["sports", "sports cards", "memorabilia", "jerseys", "jersey", "game used", "autographs"].includes(text)) return "SPORTS";
  if (["tcg", "trading card game", "pokemon", "pokémon", "mtg", "magic", "magic the gathering", "yugioh", "yu gi oh", "bo jackson arena"].includes(text)) return "TCG";
  if (["music", "vinyl", "vinyl records", "record", "records", "album", "albums", "lp", "cd", "cds", "instruments"].includes(text)) return "MUSIC";
  if (["jewelry apparel", "jewelry and apparel", "jewelry", "apparel", "watches", "watch", "bags", "bag", "streetwear", "luxury"].includes(text)) return "JEWELRY_APPAREL";
  if (["games", "game", "video games", "video game", "console", "consoles", "cartridge", "cartridges", "arcade", "handhelds"].includes(text)) return "GAMES";
  if (["built botany", "built and botany", "handmade", "plants", "crafts", "botany", "garden"].includes(text)) return "BUILT_BOTANY";
  if (["misc", "miscellaneous", "other", "uncategorized", "unknown", "collectors choice"].includes(text)) return "MISC";
  if (["automotive", "gears and gasoline", "gears gasoline", "cars", "car", "classic cars", "motorcycles", "motorcycle", "bicycles", "bicycle", "vehicle", "vehicles"].includes(text)) return "AUTOMOTIVE";
  if (["art", "painting", "paintings", "sculpture", "sculptures", "fine art", "prints", "original art"].includes(text)) return "ART";

  return "";
}
function normalizeUniverse(value: unknown): UniverseKey {
  return directUniverseMatch(value) || "MISC";
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

function inferVaultUniverse(item: VaultItem): UniverseKey {
  const existing = normalizeUniverse(item.universe);
  if (existing !== "MISC") return existing;

  const direct = directUniverseMatch(item.categoryLabel || item.customCategoryLabel || item.category || item.subcategoryLabel);
  if (direct) return direct;

  const text = normalizeUniverseText([
    item.category,
    item.categoryLabel,
    item.customCategoryLabel,
    item.subcategoryLabel,
    item.title,
    item.subtitle,
    item.number,
    item.grade,
    item.notes,
    item.purchaseSource,
    item.purchaseLocation,
  ].filter(Boolean).join(" "));

  const hasAny = (terms: string[]) => terms.some((term) => text.includes(term));

  if (hasAny(["comic", "comics", "cgc", "cbcs", "variant cover", "first appearance", "issue", "spawn", "batman", "superman", "spider man", "x men", "marvel", " dc ", "funko", "figure", "toy", "statue", "manga"])) return "POP_CULTURE";
  if (hasAny(["sports card", "rookie", "refractor", "panini", "topps", "jersey", "game used", "autograph", "psa", "bgs", "sgc", "baseball", "basketball", "football", "soccer", "hockey"])) return "SPORTS";
  if (hasAny(["pokemon", "pokémon", "magic the gathering", " mtg ", "yugioh", "yu gi oh", "trading card game", " tcg ", "bo jackson arena", "foil", "serialized", "base set"])) return "TCG";
  if (hasAny(["vinyl", "record", "records", "album", "albums", " lp ", "signed lp", "cd ", "guitar", "instrument", "turntable"])) return "MUSIC";
  if (hasAny(["watch", "watches", "jewelry", "apparel", "bag", "bags", "streetwear", "vintage clothing", "limited drop", "luxury"])) return "JEWELRY_APPAREL";
  if (hasAny(["video game", "game cartridge", "sealed game", "console", "nintendo", "playstation", "xbox", "sega", "atari", "cartridge", "disc only", "controller", "arcade"])) return "GAMES";
  if (hasAny(["handmade", "handcrafted", "ceramic", "pottery", "woodwork", "plant", "succulent", "cactus", "terrarium", "bonsai", "tropical", "air plant", "resin", "craft"])) return "BUILT_BOTANY";

  return "MISC";
}

function universeForItem(item: VaultItem): UniverseKey {
  const rawUniverse = typeof item.universe === "string" ? item.universe.trim() : "";
  if (rawUniverse) return normalizeUniverse(rawUniverse);
  return inferVaultUniverse(item);
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

function effectiveMarketValue(item: VaultItem) {
  if (typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue)) {
    return item.estimatedValue;
  }
  if (typeof item.currentValue === "number" && Number.isFinite(item.currentValue)) {
    return item.currentValue;
  }
  return 0;
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

function CameraIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.75 7.25 10.1 5.5h3.8l1.35 1.75h2.25A2.5 2.5 0 0 1 20 9.75v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.25v-6.5a2.5 2.5 0 0 1 2.5-2.5h2.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.75a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
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

  return `${universe} · ${category}`;
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

  useEffect(() => {
    setValueDraft(String(Number(item.currentValue ?? 0)));
  }, [item.currentValue]);

  async function saveValueInline() {
    const nextValue = parseMoneyInput(valueDraft);
    if (nextValue === Number(item.currentValue ?? 0)) {
      setEditingField("");
      return;
    }
    await onSaveItem({ ...item, currentValue: nextValue });
    setEditingField("");
  }

  async function handleDelete() {
    const ok = window.confirm(`Delete "${item.title}"?`);
    if (!ok) return;
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
  const marketValue = Number(item.currentValue ?? 0);
  const gain = itemGain(item);
  const showGain = Math.abs(gain) > 0.49;
  const detailHref = isSold ? `/vault/item/${item.id}?sold=1` : `/vault/item/${item.id}`;

  return (
    <div
      className={[
        "group relative flex flex-col overflow-hidden rounded-[4px] vltd-brushed p-3 transition hover:-translate-y-0.5",
        displayMode === "shelf" ? "min-h-[264px]" : displayMode === "flip" ? "min-h-[340px] hover:[transform:rotateY(2deg)_translateY(-2px)]" : "min-h-[324px]",
        marketValue > 0 ? "border-l-2 border-l-[color:var(--status-cyan)]" : "",
      ].join(" ")}
    >
      {/* Status badge — top LEFT to avoid colliding with hover action buttons */}
      <span className={["absolute left-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ring-1", statusClass].join(" ")}>
        {statusLabel}
      </span>

      {/* Hover action buttons — top RIGHT, clear of status badge */}
      <div className="absolute right-1.5 top-1.5 z-20 hidden items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete item"
          title="Delete item"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white ring-1 ring-red-500/40 disabled:opacity-50"
        >
          {isDeleting ? (
            <span className="text-[9px]">...</span>
          ) : (
            <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M5 1h5M1 3h13M2.5 3l1 9.5a1 1 0 001 .5h6a1 1 0 001-.5l1-9.5M5.5 6v4M9.5 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      <div className={["relative z-0 overflow-visible rounded-[8px]", displayMode === "shelf" ? "h-[138px]" : displayMode === "flip" ? "h-[212px]" : "h-[190px]"].join(" ")}>
        <Link href={detailHref} className="absolute inset-x-0 top-0 bottom-[-58px] z-0 block overflow-hidden rounded-[8px] bg-black/24">
          {image ? (
            <ProgressiveImage
              src={image}
              alt={item.title}
              className="h-full w-full"
              imageClassName="object-contain object-center transition duration-500 group-hover:scale-[1.035]"
              draggable={false}
            />
          ) : (
            <div className="relative h-full w-full">
              <img src={universePlaceholder(item.universe)} alt="" className="h-full w-full object-cover opacity-[0.22]" draggable={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                <CameraIcon className="h-5 w-5" />
                <span>Add photo</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      <div className="relative z-10 mt-2 flex h-5 items-center">
        <ItemVisibilityToggle item={item} />
      </div>

      <Link href={detailHref} className="relative z-10 mt-1 min-w-0">
        <div className="line-clamp-1 text-[15px] font-semibold leading-tight text-text-primary">
          {item.title}
        </div>
        <div className="mt-1 line-clamp-1 text-[11px] font-medium text-cyan-100/55">
          {itemCardSubtitle(item)}
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
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
              className="h-6 w-20 rounded-md bg-[color:var(--pill)] px-2 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingField("value")}
              className="block text-left text-[20px] font-semibold leading-none text-[color:var(--data-color)] hover:text-gold-light"
            >
              {marketValue > 0 ? formatMoney(marketValue) : "No value"}
            </button>
          )}
          <div className={showGain ? (gain >= 0 ? "mt-1 text-[10px] font-bold leading-none text-emerald-300" : "mt-1 text-[10px] font-bold leading-none text-red-300") : "mt-1 text-[10px] font-bold leading-none text-[color:var(--muted)]"}>
            {showGain ? `${gain >= 0 ? "+" : ""}${formatMoney(gain)}` : "—"}
          </div>
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
          style={{ background: "rgba(203,208,213,0.08)", border: "1px solid rgba(203,208,213,0.15)", color: "#61656B" }}
        >
          <span>Universes:</span>
          <span style={{ color: "#C8CDD2" }}>TCG - Sports - Comics - Music - Games - Jewelry - Misc</span>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <PillButton
            href="/capture"
            className="w-full gap-2 sm:w-auto"
            style={{ background: "#C8CDD2", color: "#0B0B0B" }}
          >
            <CameraIcon className="h-5 w-5" />
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
  const totalValue = items.reduce((sum, item) => sum + effectiveMarketValue(item), 0);
  const totalCostValue = items.reduce((sum, item) => sum + totalCost(item), 0);
  const totalGain = totalValue - totalCostValue;
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
  const low = Number(item.valueLow ?? item.lastCompValue ?? (value > 0 ? value * 0.85 : 0));
  const median = Number(item.valueMedian ?? value);
  const high = Number(item.valueHigh ?? (value > 0 ? value * 1.15 : 0));
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
    <section className="fixed inset-x-2 bottom-[calc(var(--bottomnav-h,120px)+8px)] z-40 max-h-[74vh] overflow-y-auto rounded-[14px] border border-[color:var(--theme-gold-border)] bg-[rgba(3,11,14,0.94)] p-2 shadow-[0_-18px_60px_rgba(0,0,0,0.46)] backdrop-blur-xl lg:static lg:inset-x-auto lg:bottom-2 lg:z-30 lg:mx-auto lg:mt-5 lg:max-h-none lg:w-fit lg:overflow-visible lg:sticky">
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
                  <CameraIcon className="h-5 w-5" />
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
              <span className="text-sm leading-none" style={{ color: "#8E835F" }}>⋮</span>
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px]" style={{ color: "#B9AE86" }}>{itemMeta(item)}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.grade ? <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#ECEDEF" }}>{item.grade}</span> : null}
              {item.variant ? <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#ECEDEF" }}>{item.variant}</span> : null}
              <span className="rounded-[5px] px-1.5 py-0.5 text-[10px] ring-1 ring-[color:var(--border)]" style={{ color: "#C8CDD2" }}>{item.isPublic ? "Public" : "Private"}</span>
            </div>
            <div className="mt-3 text-[21px] font-bold leading-none" style={{ color: "#44D9F2" }}>{formatMoney(value)}</div>
            <div className="mt-1 text-[11px]" style={{ color: gain >= 0 ? "var(--color-gain, #4CAF82)" : "var(--color-loss, #E05252)" }}>
              {paid > 0 ? `${gain >= 0 ? "+" : ""}${gainPct.toFixed(1)}% this year` : "Add cost basis for return"}
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
                        {row.complete ? "✓" : "!"}
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
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] text-emerald-300 ring-1 ring-emerald-400/50">↗</span>
              Public Gallery
            </span>
            <ItemVisibilityToggle item={item} />
          </div>
          <Link href={detailHref} className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: "#C8CDD2" }}>
            View public page <span aria-hidden="true">↗</span>
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={detailHref} className="inline-flex min-h-[28px] w-auto items-center justify-center gap-2 rounded-[7px] px-3 text-[11px] font-semibold ring-1 ring-[color:var(--theme-gold-border)]" style={{ color: "#C8CDD2" }}>
              Create Listing
            </Link>
            <button type="button" onClick={exportItemData} className="inline-flex min-h-[28px] w-auto items-center justify-center gap-2 rounded-[7px] px-3 text-[11px] font-semibold ring-1 ring-[color:var(--theme-gold-border)]" style={{ color: "#C8CDD2" }}>
              Export Data
            </button>
          </div>
          <Link href={detailHref} className="mt-2.5 inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: "#C8CDD2" }}>
            More actions <span aria-hidden="true">⌄</span>
          </Link>
        </div>
        </div>
      </div>
    </section>
  );
}

export default function VaultPage() {
  const [focusKey] = useState<UniverseKey | null>(() => readFocusUniverseKey());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("ALL");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [gradedOnly, setGradedOnly] = useState(false);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showSoldItems, setShowSoldItems] = useState(false);
  const [sales, setSales] = useState<SaleInfo[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [vaultViewMode, setVaultViewMode] = useState<VaultViewMode>("shelf");
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

  function refresh() {
    setItems(loadItems());
    setSales(readSales());
    setPendingSyncCount(getPendingVaultSyncCount());
  }

  async function hydrateAll() {
    refresh();
    if (promoteLegacySalesToItems()) {
      refresh();
    }
    await processVaultSyncQueue();
    await syncVaultItemsFromSupabase();
    if (ensureVaultItemUniverses()) {
      await processVaultSyncQueue();
    }
    refresh();
  }

  useEffect(() => {
    void hydrateAll();

    function onActiveProfileChange() {
      void hydrateAll();
    }

    function onVaultUpdate() {
      void hydrateAll();
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

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const saleMap = Object.fromEntries(sales.map((sale) => [String(sale.id), sale]));
    const next = items.filter((item) => {
      const isSold = Boolean(saleInfoForItem(item, saleMap));
      if (!showSoldItems && isSold) return false;
      if (universeFilter !== "ALL" && universeForItem(item) !== universeFilter) return false;
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
  }, [items, query, universeFilter, gradedOnly, uncategorizedOnly, sortMode, readinessFilter, intelligenceMap, sales, showSoldItems]);

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
      return next;
    });
  }

  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalCostValue = filteredItems.reduce((sum, item) => sum + totalCost(item), 0);
    const totalValue = filteredItems.reduce((sum, item) => sum + effectiveMarketValue(item), 0);
    const totalGain = totalValue - totalCostValue;
    const universeCount = new Set(filteredItems.map((item) => universeForItem(item))).size;
    const insuranceReadyCount = filteredItems.filter((item) => {
      const intelligence = intelligenceMap[item.id];
      return (intelligence?.readiness ?? "Low") === "High";
    }).length;
    const needsReviewCount = filteredItems.filter((item) => {
      const intelligence = intelligenceMap[item.id];
      return (intelligence?.readiness ?? "Low") !== "High";
    }).length;
    const insuranceReadyPct = totalItems ? Math.round((insuranceReadyCount / totalItems) * 100) : 0;
    return {
      totalItems,
      totalCost: totalCostValue,
      totalValue,
      totalGain,
      universeCount,
      insuranceReadyCount,
      insuranceReadyPct,
      needsReviewCount,
    };
  }, [filteredItems, intelligenceMap]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    universeFilter !== "ALL" ||
    readinessFilter !== "all" ||
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

  async function handleSaveItem(nextItem: VaultItem) {
    saveItem(nextItem);
    enqueueVaultItemSync(nextItem.id);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));

    if (hasSupabaseEnv()) {
      await processVaultSyncQueue();
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  async function handleDeleteItem(target: VaultItem) {
    const next = loadItems({ includeAllProfiles: true }).filter((entry) => String(entry.id) !== String(target.id));
    saveItems(next);
    setItems((prev) => prev.filter((entry) => String(entry.id) !== String(target.id)));

    if (hasSupabaseEnv()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        try {
          await supabase.from(VAULT_ITEMS_TABLE).delete().eq("id", target.id);
        } catch {
          // leave local delete in place
        }
      }
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

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
      const remaining = loadItems({ includeAllProfiles: true }).filter((entry) => !idsToDelete.has(String(entry.id)));
      saveItems(remaining);
      setItems((prev) => prev.filter((entry) => !idsToDelete.has(String(entry.id))));

      if (hasSupabaseEnv()) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          await Promise.all(
            toDelete.map(async (item) => {
              try {
                await supabase.from(VAULT_ITEMS_TABLE).delete().eq("id", item.id);
              } catch {
                // ignore individual delete failures
              }
            })
          );
        }
      }

      window.dispatchEvent(new Event("vltd:vault-updated"));
    } finally {
      setIsDeleting(false);
      setDeleteConfirmPending(false);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  }

  async function handleMassMove() {
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
    const movedItems = updated.filter((item) => selectedIds.has(item.id));
    for (const item of movedItems) {
      saveItem(item);
      enqueueVaultItemSync(item.id);
    }
    setItems(updated);

    if (hasSupabaseEnv()) {
      await processVaultSyncQueue();
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
    setSelectedIds(new Set());
    setSelectMode(false);
    setMoveTargetUniverse("");
    setMoveTargetCategory("");
    setMoveTargetSubcategory("");
  }

  function handleClearFilters() {
    setQuery("");
    setUniverseFilter("ALL");
    setReadinessFilter("all");
    setGradedOnly(false);
    setUncategorizedOnly(false);
    setSortMode("newest");
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5">
        <section className="mb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-[2.7rem] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] sm:text-[3.3rem]">
                    Vault
                  </h1>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">Every item you own, documented and searchable.</p>
                </div>
              </div>
              {items.length > 0 ? (
                <div className="mt-3 hidden flex-wrap gap-2 text-xs text-[color:var(--muted)] sm:flex">
                  <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">{privateCount} private</span>
                  <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">{publicCount} public</span>
                  <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">Public links only show items you unlock</span>
                </div>
              ) : null}
            </div>
            {/* Actions — below the title on mobile, right-aligned on the title row on desktop */}
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              <VaultExportButton />
              <Link href="/vault/halls" className="inline-flex items-center justify-center gap-1.5 rounded-[7px] bg-[color:var(--pill)] px-3 py-1 text-sm font-semibold ring-1 ring-[color:var(--border)]"><Glyph name="building" size={14} />Halls</Link>
              <Link href="/vault/for-sale" className="inline-flex items-center justify-center rounded-[7px] bg-[color:var(--pill)] px-3 py-1 text-sm font-semibold ring-1 ring-[color:var(--border)]">For Sale</Link>
              <Link href="/vault/import" className="inline-flex items-center justify-center rounded-[7px] bg-[color:var(--pill)] px-3 py-1 text-sm font-semibold ring-1 ring-[color:var(--border)]">Import</Link>
              <Link href="/vault/sold" className="inline-flex items-center justify-center rounded-[7px] bg-[color:var(--pill)] px-3 py-1 text-sm font-semibold ring-1 ring-[color:var(--border)]">Sold</Link>
              {/* Quick Add sits next to Add Item — the two "add" actions grouped together */}
              <Link href="/vault/quick" className="inline-flex items-center justify-center rounded-[7px] bg-[color:var(--pill-active-bg)] px-3 py-1 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]">Quick Add</Link>
              {/* Add Item — the single primary add on the page */}
              <Link href="/capture" className="vltd-action-module shrink-0">
                <span className="vltd-action-module__plate !py-1.5">Add Item</span>
                <span className="vltd-action-module__block"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
              </Link>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
            <div className="relative shrink-0">
              <div className="inline-flex gap-2">
                <button
                  type="button"
                  onClick={() => setUniverseFilter("ALL")}
                  className={["inline-flex min-h-[42px] items-center rounded-[7px] px-4 text-sm font-semibold ring-1", universeFilter === "ALL" ? "bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)] ring-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setShowUniverseMenu((value) => !value)}
                  className="hidden min-h-[42px] items-center rounded-[7px] px-4 text-sm font-semibold ring-1 sm:inline-flex"
                  style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
                  aria-expanded={showUniverseMenu}
                >
                  Show v
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
                          className="flex min-h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-2 text-sm"
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
                className={["inline-flex min-h-[42px] shrink-0 items-stretch gap-2 overflow-hidden rounded-[7px] pr-4 text-sm font-semibold ring-1", universeFilter === category.key ? "bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)] ring-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}
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
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>
                Total Value
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-[color:var(--data-color)] sm:mt-2.5 sm:text-3xl">{formatMoney(stats.totalValue)}</div>
              <div className={(stats.totalGain >= 0 ? "text-emerald-300" : "text-red-300") + " mt-0.5 text-[11px] sm:text-sm"}>{stats.totalGain >= 0 ? "+" : ""}{formatMoney(stats.totalGain)}</div>
            </div>
            <div className="w-[140px] shrink-0 vltd-brushed p-2.5 sm:w-auto sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
                Items
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] sm:mt-2.5 sm:text-3xl">{stats.totalItems}</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">{stats.universeCount} {stats.universeCount === 1 ? "universe" : "universes"}</div>
            </div>
            <div className="w-[140px] shrink-0 vltd-brushed vltd-status-cyan p-2.5 sm:w-auto sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z"/></svg>
                Insurance Ready
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-[color:var(--data-color)] sm:mt-2.5 sm:text-3xl">{stats.insuranceReadyPct}%</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">{stats.insuranceReadyCount} of {stats.totalItems} items</div>
            </div>
            <div className="w-[140px] shrink-0 vltd-brushed p-2.5 sm:w-auto sm:p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] sm:text-[11px] sm:tracking-[0.18em]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
                Needs Review
              </div>
              <div className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] sm:mt-2.5 sm:text-3xl">{stats.needsReviewCount}</div>
              <div className="mt-0.5 text-[11px] text-[color:var(--muted)] sm:text-sm">Items missing info</div>
            </div>
          </div>

          <div className="mt-3 rounded-[14px] border p-3" style={{ background: "var(--theme-card)", borderColor: "var(--theme-border)" }}>
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
                      ["shelf", "Shelf"],
                      ["flip", "Flip"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVaultViewMode(mode)}
                      className="min-h-[30px] rounded-[7px] px-3 py-1 text-[12px] font-semibold transition"
                      style={vaultViewMode === mode
                        ? { background: "var(--theme-gold-subtle, rgba(203,208,213,0.12))", color: "var(--theme-gold, #C8CDD2)" }
                        : { background: "transparent", color: "var(--muted)" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="min-h-[38px] w-full sm:w-[180px] rounded-[8px] bg-[color:var(--input)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                style={{ borderColor: "var(--theme-border)" }}
              />
              <select
                value={universeFilter}
                onChange={(e) => setUniverseFilter(e.target.value as UniverseFilter)}
                className="min-h-[38px] w-auto rounded-[8px] bg-[color:var(--input)] px-3 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
              >
                <option value="ALL">All Universes</option>
                {VAULT_UNIVERSES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {UNIVERSE_LABEL[category.key] ?? category.key}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="min-h-[38px] w-auto rounded-[8px] bg-[color:var(--input)] px-3 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="value_desc">Value ↓</option>
                <option value="value_asc">Value ↑</option>
                <option value="gain_desc">Gain ↓</option>
                <option value="gain_asc">Gain ↑</option>
                <option value="title">Title A-Z</option>
              </select>
              <button
                type="button"
                onClick={() => setGradedOnly((v) => !v)}
                className="inline-flex min-h-[36px] items-center gap-1.5 px-1 text-sm font-medium transition"
                style={gradedOnly ? { color: "var(--theme-gold, #C8CDD2)" } : { color: "var(--fg-muted)" }}
              >
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                  style={gradedOnly ? { background: "var(--theme-gold, #C8CDD2)" } : { border: "1.5px solid var(--border)", background: "transparent" }}
                >
                  {gradedOnly && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                Graded <span className="text-[11px] opacity-65">{gradedCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setUncategorizedOnly((v) => !v)}
                className="inline-flex min-h-[36px] items-center gap-1.5 px-1 text-sm font-medium transition"
                style={uncategorizedOnly ? { color: "var(--theme-gold, #C8CDD2)" } : { color: "var(--fg-muted)" }}
              >
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                  style={uncategorizedOnly ? { background: "var(--theme-gold, #C8CDD2)" } : { border: "1.5px solid var(--border)", background: "transparent" }}
                >
                  {uncategorizedOnly && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                Uncategorized <span className="text-[11px] opacity-65">{uncategorizedCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSoldItems((value) => !value)}
                className="inline-flex min-h-[36px] items-center gap-1.5 px-1 text-sm font-medium transition"
                style={showSoldItems ? { color: "var(--theme-gold, #C8CDD2)" } : { color: "var(--fg-muted)" }}
              >
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                  style={showSoldItems ? { background: "var(--theme-gold, #C8CDD2)" } : { border: "1.5px solid var(--border)", background: "transparent" }}
                >
                  {showSoldItems && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                Show Sold <span className="text-[11px] opacity-65">{soldCount}</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {filteredItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); setMoveTargetUniverse(""); setMoveTargetCategory(""); setMoveTargetSubcategory(""); setDeleteConfirmPending(false); }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full transition"
                    style={selectMode ? { background: "rgba(203,208,213,0.18)", color: "#C8CDD2" } : { background: "var(--pill)", color: "var(--muted)" }}
                    aria-label="Select items"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M2.5 3.75l1.2 1.2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                  </button>
                  {selectMode && selectedIds.size > 0 && (
                    <>
                      {deleteConfirmPending ? (
                        <>
                          <span className="text-xs font-semibold" style={{ color: "#f87171" }}>
                            Delete {selectedIds.size} {selectedIds.size === 1 ? "item" : "items"}?
                          </span>
                          <button
                            type="button"
                            onClick={() => void confirmMassDelete()}
                            disabled={isDeleting}
                            className="inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-bold text-white"
                            style={{ background: "#dc2626", opacity: isDeleting ? 0.6 : 1 }}
                          >
                            {isDeleting ? "Deleting…" : "Yes, Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPending(false)}
                            disabled={isDeleting}
                            className="inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-semibold ring-1 ring-[color:var(--border)]"
                            style={{ background: "var(--pill)", color: "var(--muted)" }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleMassDelete}
                          className="inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-semibold text-white"
                          style={{ background: "#dc2626" }}
                        >
                          Delete {selectedIds.size}
                        </button>
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
                        <option value="">Sub</option>
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
                        <option value="">Type</option>
                        {moveTargetUniverse && isUniverseKey(moveTargetUniverse) && moveTargetCategory && TAXONOMY[moveTargetUniverse][moveTargetCategory]?.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      {moveTargetUniverse && (
                        <button
                          type="button"
                          onClick={() => void handleMassMove()}
                          className="inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-semibold"
                          style={{ background: "rgba(203,208,213,0.18)", color: "#C8CDD2", border: "1px solid rgba(203,208,213,0.4)" }}
                        >
                          Move
                        </button>
                      )}
                    </>
                  )}
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => { setSelectMode(false); setSelectedIds(new Set()); setMoveTargetUniverse(""); setMoveTargetCategory(""); setMoveTargetSubcategory(""); setDeleteConfirmPending(false); }}
                      className="inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-medium ring-1 ring-[color:var(--border)]"
                      style={{ background: "var(--pill)", color: "var(--muted)" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <VaultEmptyState hasFilters={false} onClearFilters={handleClearFilters} />
        ) : vaultViewMode === "wall" ? (
          <VaultWallView items={items} saleMap={saleMap} />
        ) : filteredItems.length === 0 ? (
          <VaultEmptyState hasFilters={hasActiveFilters} onClearFilters={handleClearFilters} />
        ) : vaultViewMode === "flip" ? (
          <section className="mt-4">
            <div className="mx-auto max-w-3xl">
              <SwipeStack
                items={filteredItems}
                mode="vault"
                onOpen={(item) => {
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
                vaultViewMode === "shelf"
                  ? "gap-2 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                  : "gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
              ].join(" ")}
            >
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="relative"
                    onClick={(e) => {
                      // Open the quick-look on a real tap only. A scroll gesture
                      // isn't a click, so scrolling anywhere on the card is safe.
                      // Skip taps on interactive children: the image/title links
                      // navigate to the full item page; value/Sell do their thing.
                      if ((e.target as HTMLElement).closest("a, button, input")) return;
                      setSelectedDetailId(item.id);
                      setIsDetailDrawerDismissed(false);
                    }}
                  >
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelectItem(item.id)}
                        className="absolute inset-0 z-40 flex items-center justify-center rounded-[10px]"
                        style={{ background: isSelected ? "rgba(203,208,213,0.18)" : "rgba(0,0,0,0.04)" }}
                      >
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={isSelected
                            ? { background: "#C8CDD2", boxShadow: "0 0 0 2px rgba(203,208,213,0.5)" }
                            : { background: "rgba(255,255,255,0.15)", border: "2px solid rgba(203,208,213,0.55)" }}
                        >
                          {isSelected && (
                            <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 5.5l4 4L13 1" stroke="#1A0F00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                        </span>
                      </button>
                    )}
                    <VaultCard
                      item={item}
                      readiness={intelligenceMap[item.id]?.readiness ?? "Low"}
                      sale={saleInfoForItem(item, saleMap)}
                      onSaveItem={handleSaveItem}
                      onDeleteItem={handleDeleteItem}
                      displayMode={vaultViewMode}
                    />
                  </div>
                );
              })}
            </div>
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
    </main>
  );
}
