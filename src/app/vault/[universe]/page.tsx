"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import ItemIntelligencePanel from "@/components/ItemIntelligencePanel";
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import RestoreVaultButton from "@/components/RestoreVaultButton";
import SellItemButton from "@/components/SellItemButton";
import SwipeStack from "@/components/SwipeStack";
import { PillButton } from "@/components/ui/PillButton";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import VaultMuseumView from "@/components/VaultMuseumView";
import VaultWrappedSheet from "@/components/VaultWrappedSheet";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, TAXONOMY, getCategories, isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import {
  enqueueVaultItemSync,
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
const VIEW_MODE_KEY = "vltd_vault_view_mode";

type SortMode = "newest" | "value_desc" | "value_asc" | "gain_desc" | "gain_asc" | "title";
type UniverseFilter = "ALL" | UniverseKey;
type ViewMode = "museum" | "shelf" | "swipe";
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

  return "";
}
function normalizeUniverse(value: unknown): UniverseKey {
  return directUniverseMatch(value) || "MISC";
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
  onNavigate,
}: {
  item: VaultItem;
  readiness: string;
  sale: SaleInfo | null;
  onSaveItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (item: VaultItem) => Promise<void>;
  onNavigate?: () => void;
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

  const marketValue = Number(item.currentValue ?? 0);
  const gain = itemGain(item);
  const showGain = Math.abs(gain) > 0.49;
  const detailHref = isSold ? `/vault/item/${item.id}?sold=1` : `/vault/item/${item.id}`;

  return (
    <div
      className={[
        "group relative flex h-[174px] flex-col overflow-hidden rounded-[14px] border border-[color:var(--border)] bg-[color:var(--theme-card)] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-gold/10 transition hover:-translate-y-0.5 hover:ring-cyan-300/30",
        marketValue > 0 ? "border-l-2 border-l-emerald-400/55" : "border-l border-l-[color:var(--border)]",
      ].join(" ")}
    >
      <div className="absolute right-1.5 top-1.5 z-20 hidden items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete item"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white ring-1 ring-red-500/40 disabled:opacity-50"
        >
          {isDeleting
            ? <span className="text-[9px]">…</span>
            : <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M5 1h5M1 3h13M2.5 3l1 9.5a1 1 0 001 .5h6a1 1 0 001-.5l1-9.5M5.5 6v4M9.5 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>
      </div>

      <Link href={detailHref} onClick={onNavigate} className="relative block h-[78px] overflow-hidden rounded-[10px] bg-black/18">
        <div className="block h-full">
          {image ? (
            <ProgressiveImage
              src={image}
              alt={item.title}
              className="h-full w-full"
              imageClassName="object-contain object-center"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
              <CameraIcon className="h-5 w-5" />
              <span>No photo</span>
            </div>
          )}
        </div>
        <div className="absolute left-1.5 top-1.5 z-30" onClick={(e) => e.preventDefault()}>
          <ItemVisibilityToggle item={item} />
        </div>
      </Link>

      <Link href={detailHref} className="mt-2 min-w-0" onClick={onNavigate}>
        <div className="line-clamp-1 text-[13px] font-extrabold leading-tight text-text-primary sm:text-[14px]">
          {item.title}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[10px] font-medium text-cyan-100/55">
          {itemCardSubtitle(item)}
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
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
              className="block text-left text-[13px] font-extrabold leading-none text-text-primary hover:text-gold-light"
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
            <Link
              href="/vault/add"
              className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium ring-1 ring-[color:var(--border)]"
            >
              Add Item
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">EMPTY VAULT</div>
        <h2 className="mt-2 text-2xl font-semibold">You have no items yet</h2>
        <div className="mt-2 text-sm text-[color:var(--muted)]">
          Start with Quick Add for the fastest path, or use Add for scan-assisted entry with pricing and images.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/vault/quick"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
          >
            Quick Add
          </Link>
          <Link
            href="/vault/add"
            className="vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
          >
            Add Item
          </Link>
          <Link
            href="/vault/import"
            className="vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition"
          >
            Import
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[14px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">1</div>
            <div className="mt-1 text-sm font-medium">Create an item</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Start with Universe, category, title, and value.
            </div>
          </div>
          <div className="rounded-[14px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">2</div>
            <div className="mt-1 text-sm font-medium">Add pricing</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Save estimate, source, confidence, and notes.
            </div>
          </div>
          <div className="rounded-[14px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
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
}: {
  category: (typeof VAULT_UNIVERSES)[number];
  items: VaultItem[];
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
      className="group overflow-hidden rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:ring-gold/30"
    >
      <div className="grid min-h-[124px] grid-cols-[92px_minmax(0,1fr)] gap-3 sm:grid-cols-[104px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[14px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
          {thumbnailImage ? (
            <ProgressiveImage
              src={thumbnailImage}
              alt={`${universeDisplayName(category.key)} cover`}
              className="h-full min-h-[124px] w-full"
              imageClassName="object-cover transition duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="flex h-full min-h-[124px] flex-col items-center justify-center gap-1 px-3 text-center text-[11px] font-semibold text-[color:var(--muted)]">
              <span className="text-xl leading-none text-cyan-200/55">+</span>
              <span>{hasItems ? universeDisplayName(category.key) : "Add items"}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between py-1 pr-1">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Universe</div>
                <h2 className="mt-1 text-xl font-semibold leading-tight text-gold-light">{universeDisplayName(category.key)}</h2>
              </div>
              <div className="rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold ring-1 ring-[color:var(--border)]">
                {items.length} {items.length === 1 ? "item" : "items"}
              </div>
            </div>
            <div className="mt-2 line-clamp-2 text-xs text-[color:var(--muted)]">
              {hasItems ? category.description : "No items here yet. Tap to start adding to this universe."}
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted2)]">Value</div>
              <div className="mt-0.5 text-lg font-extrabold leading-none text-[color:var(--fg)]">
                {hasItems ? formatMoney(totalValue) : "—"}
              </div>
            </div>
            <div className={showGain ? (totalGain >= 0 ? "text-right text-sm font-bold text-emerald-300" : "text-right text-sm font-bold text-red-300") : "text-right text-sm font-bold text-[color:var(--muted)]"}>
              {showGain ? `${totalGain >= 0 ? "+" : ""}${formatMoney(totalGain)}` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function VaultUniversePage() {
  const params = useParams<{ universe: string }>();
  const router = useRouter();
  const activeUniverse = universeFromSlug(params.universe);
  const activeUniverseName = universeDisplayName(activeUniverse);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("ALL");
  const [gradedOnly, setGradedOnly] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetUniverse, setMoveTargetUniverse] = useState<string>("");
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>("");
  const [moveTargetSubcategory, setMoveTargetSubcategory] = useState<string>("");
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("museum");
  const [showSoldItems, setShowSoldItems] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [sales, setSales] = useState<SaleInfo[]>([]);
  function refresh() {
    setItems(loadItems());
    setSales(readSales());
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
      void hydrateAll();
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
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "museum" || saved === "shelf" || saved === "swipe") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

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
      if (universeForItem(item) !== activeUniverse) return false;
      if (universeFilter !== "ALL" && universeForItem(item) !== universeFilter) return false;
      if (gradedOnly && !item.grade) return false;
      if (showUncategorized && (item.categoryLabel || item.category)) return false;
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
  }, [items, query, universeFilter, gradedOnly, sortMode, intelligenceMap, sales, showSoldItems, activeUniverse]);

  const saleMap = useMemo(
    () => Object.fromEntries(sales.map((sale) => [String(sale.id), sale])),
    [sales]
  );

  // ─── Scroll restoration ────────────────────────────────────────────────────
  // Next.js App Router has two back-navigation paths:
  //
  //   A) Fresh remount  — component unmounted, then remounts on back.
  //      useEffect([], []) fires → reads sessionStorage → restores.
  //
  //   B) Router cache   — component stays mounted while on item page.
  //      useEffect([], []) does NOT re-fire on back.
  //      BUT window "popstate" fires every time back is pressed,
  //      even when the component is cached. We handle it there.
  //
  // applyScrollRestore re-applies scrollTo every 100ms for 1s to beat
  // any late scrollTo(0,0) calls from Next.js, and polls until the page
  // is tall enough (items may still be loading from IndexedDB).
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // The page content scrolls inside .vltd-content-wrap (PullToRefresh div),
    // NOT on window. All previous attempts used window.scrollY / window.scrollTo
    // which targeted the wrong element — that's why they all failed.
    function getScroller() {
      return document.querySelector<HTMLElement>(".vltd-content-wrap");
    }

    function applyScrollRestore(target: number) {
      let attempts = 0;
      function poll() {
        const el = getScroller();
        if (el) {
          if (el.scrollHeight >= target || attempts >= 30) {
            el.scrollTop = target;
          }
        }
        if (++attempts < 10) setTimeout(poll, 100);
      }
      setTimeout(poll, 50);
    }

    // Save on any outbound link click
    function saveOnClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("a[href]")) {
        const el = getScroller();
        sessionStorage.setItem("vltd_vault_scroll_y", String(el ? el.scrollTop : 0));
      }
    }
    document.addEventListener("click", saveOnClick, true);

    // PATH B — router cache: component stayed mounted while on item page.
    // popstate fires when user presses Back even when component didn't remount.
    function onPopState() {
      const raw = sessionStorage.getItem("vltd_vault_scroll_y");
      if (!raw) return;
      const target = parseInt(raw, 10);
      if (isNaN(target) || target <= 0) return;
      sessionStorage.removeItem("vltd_vault_scroll_y");
      applyScrollRestore(target);
    }
    window.addEventListener("popstate", onPopState);

    // PATH A — fresh remount: popstate fired before this listener existed,
    // so the key is still in sessionStorage. Read it here on mount.
    const raw = sessionStorage.getItem("vltd_vault_scroll_y");
    if (raw) {
      const target = parseInt(raw, 10);
      if (!isNaN(target) && target > 0) {
        sessionStorage.removeItem("vltd_vault_scroll_y");
        applyScrollRestore(target);
      }
    }

    return () => {
      document.removeEventListener("click", saveOnClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function saveScrollPosition() {
    const el = document.querySelector<HTMLElement>(".vltd-content-wrap");
    sessionStorage.setItem("vltd_vault_scroll_y", String(el ? el.scrollTop : 0));
  }

  function handleMassDelete() {
    if (selectedIds.size === 0) return;
    // Don't use window.confirm — it's blocked in PWA/iframe contexts on mobile.
    // Show an inline confirmation bar instead.
    setDeleteConfirmPending(true);
  }

  async function confirmMassDelete() {
    const toDelete = items.filter((item) => selectedIds.has(item.id));
    if (toDelete.length === 0) { setDeleteConfirmPending(false); return; }
    const idsToDelete = new Set(toDelete.map((i) => String(i.id)));

    setIsDeleting(true);
    try {
      // Single localStorage read → filter → single write (instead of N reads/writes)
      const remaining = loadItems({ includeAllProfiles: true }).filter(
        (entry) => !idsToDelete.has(String(entry.id))
      );
      saveItems(remaining);

      // Update React state once
      setItems((prev) => prev.filter((entry) => !idsToDelete.has(String(entry.id))));

      // Parallel Supabase deletes (instead of sequential awaits)
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

      // Single event dispatch at the end
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

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const soldCount = useMemo(
    () => items.filter((item) => saleInfoForItem(item, saleMap)).length,
    [items, saleMap]
  );

  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalCostValue = filteredItems.reduce((sum, item) => sum + totalCost(item), 0);
    const totalValue = filteredItems.reduce((sum, item) => sum + effectiveMarketValue(item), 0);
    const totalGain = totalValue - totalCostValue;
    return { totalItems, totalCost: totalCostValue, totalValue, totalGain };
  }, [filteredItems]);

  const featuredItem = useMemo(() => {
    if (filteredItems.length === 0) return null;
    return [...filteredItems].sort((a, b) => {
      const aInt = intelligenceMap[a.id];
      const bInt = intelligenceMap[b.id];
      const aScore = (aInt?.valueScore ?? 0) + (aInt?.gainScore ?? 0);
      const bScore = (bInt?.valueScore ?? 0) + (bInt?.gainScore ?? 0);
      if (bScore !== aScore) return bScore - aScore;
      return effectiveMarketValue(b) - effectiveMarketValue(a);
    })[0];
  }, [filteredItems, intelligenceMap]);

  const universeCounts = useMemo(() => {
    const counts: Record<UniverseKey, number> = {
      POP_CULTURE: 0,
      SPORTS: 0,
      TCG: 0,
      MUSIC: 0,
      JEWELRY_APPAREL: 0,
      GAMES: 0,
      BUILT_BOTANY: 0,
      MISC: 0,
      AUTOMOTIVE: 0,
      ART: 0,
    };
    for (const item of items) counts[universeForItem(item)] += 1;
    return counts;
  }, [items]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    gradedOnly ||
    showUncategorized ||
    showSoldItems ||
    sortMode !== "newest";

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

  function handleClearFilters() {
    setQuery("");
    setGradedOnly(false);
    setShowUncategorized(false);
    setSortMode("newest");
  }

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <section className="relative overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT UNIVERSE</div>
                <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:text-[1.9rem]">
                  {activeUniverseName}
                </h1>
                <div className="mt-1.5 text-sm text-[color:var(--muted)]">
                  Items in this Universe. Change an item&apos;s Universe and it moves immediately.
                </div>
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
                <Link
                  href="/vault"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  All Universes
                </Link>
                <Link
                  href="/vault/add"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Add
                </Link>
                <Link
                  href="/vault/quick"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
                >
                  Quick Add
                </Link>
                <Link
                  href="/vault/import"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Import
                </Link>
                <Link
                  href="/vault/sold"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Sold
                </Link>
                <RestoreVaultButton />
                <button
                  type="button"
                  onClick={() => setWrappedOpen(true)}
                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)]"
                >
                  ✦ Wrapped
                </button>
              </div>
            </div>

            {wrappedOpen && <VaultWrappedSheet onClose={() => setWrappedOpen(false)} />}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              <div className="rounded-[14px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED ITEMS</div>
                <div className="mt-1 text-lg font-semibold">{stats.totalItems}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED COST</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalCost)}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED VALUE</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalValue)}</div>
              </div>
              <div className="rounded-[14px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED GAIN</div>
                <div className="mt-1 text-lg font-semibold">
                  {stats.totalGain >= 0 ? "+" : ""}
                  {formatMoney(stats.totalGain)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {featuredItem ? (
          <div className="mt-3">
            <ItemIntelligencePanel
              item={featuredItem}
              intelligence={intelligenceMap[featuredItem.id] ?? null}
            />
          </div>
        ) : null}


        <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="min-h-[40px] w-[180px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-[40px] w-auto rounded-xl bg-[color:var(--input)] px-3 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="value_desc">Value ↓</option>
              <option value="value_asc">Value ↑</option>
              <option value="gain_desc">Gain ↓</option>
              <option value="gain_asc">Gain ↑</option>
              <option value="title">Title A-Z</option>
            </select>
            {/* Graded checkbox — moved up from row 2 */}
            <button
              type="button"
              onClick={() => setGradedOnly((v) => !v)}
              className="inline-flex min-h-[36px] items-center gap-1.5 px-1 text-sm font-medium transition"
              style={gradedOnly ? { color: "var(--theme-gold, #F5B548)" } : { color: "var(--fg-muted)" }}
            >
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                style={gradedOnly
                  ? { background: "var(--theme-gold, #F5B548)" }
                  : { border: "1.5px solid var(--border)", background: "transparent" }}
              >
                {gradedOnly && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              Graded
            </button>
            {/* Uncategorized checkbox */}
            <button
              type="button"
              onClick={() => setShowUncategorized((v) => !v)}
              className="inline-flex min-h-[36px] items-center gap-1.5 px-1 text-sm font-medium transition"
              style={showUncategorized ? { color: "var(--theme-gold, #F5B548)" } : { color: "var(--fg-muted)" }}
            >
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                style={showUncategorized
                  ? { background: "var(--theme-gold, #F5B548)" }
                  : { border: "1.5px solid var(--border)", background: "transparent" }}
              >
                {showUncategorized && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              Uncategorized
            </button>
            {/* View bar — moved up from row 2 */}
            {filteredItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-[color:var(--input)] px-2 py-1 ring-1 ring-[color:var(--border)]">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                  View
                </span>
                {(
                  [
                    ["museum", "Gallery"],
                    ["shelf", "Shelf"],
                    ["swipe", "Flip"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className="min-h-[30px] rounded-full px-3 py-1 text-[12px] font-semibold transition"
                    style={
                      viewMode === mode
                        ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", color: "var(--theme-gold, #F5B548)" }
                        : { background: "transparent", color: "var(--muted)" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PillButton
              variant={showSoldItems ? "active" : "default"}
              onClick={() => setShowSoldItems((value) => !value)}
              className="min-h-[36px] rounded-full px-4 py-2 text-sm font-medium text-[color:var(--fg)]"
            >
              {showSoldItems ? `Hide Sold Items (${soldCount})` : `Show Sold Items (${soldCount})`}
            </PillButton>
            {/* Bulk select — checkboxes icon + inline actions */}
            {filteredItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); setMoveTargetUniverse(""); setMoveTargetCategory(""); setMoveTargetSubcategory(""); }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full transition"
                  style={selectMode
                    ? { background: "rgba(245,181,72,0.18)", color: "#F5B548" }
                    : { background: "var(--pill)", color: "var(--muted)" }}
                  aria-label="Select items"
                >
                  {/* Multi-select / checkboxes icon */}
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
                          className="inline-flex h-8 items-center rounded-full px-3 text-xs font-bold text-white"
                          style={{ background: "#dc2626", opacity: isDeleting ? 0.6 : 1 }}
                        >
                          {isDeleting ? "Deleting…" : "Yes, Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmPending(false)}
                          disabled={isDeleting}
                          className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ring-1 ring-[color:var(--border)]"
                          style={{ background: "var(--pill)", color: "var(--muted)" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleMassDelete}
                        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-white"
                        style={{ background: "#dc2626" }}
                      >
                        Delete {selectedIds.size}
                      </button>
                    )}
                    <select
                      value={moveTargetUniverse}
                      onChange={(e) => { setMoveTargetUniverse(e.target.value); setMoveTargetCategory(""); setMoveTargetSubcategory(""); }}
                      className="h-8 rounded-full bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
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
                      className="h-8 rounded-full bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
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
                      className="h-8 rounded-full bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)] focus:outline-none"
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
                        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold"
                        style={{ background: "rgba(245,181,72,0.18)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.4)" }}
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
                    className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium ring-1 ring-[color:var(--border)]"
                    style={{ background: "var(--pill)", color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

        </section>

        {filteredItems.length === 0 ? (
          <VaultEmptyState hasFilters={hasActiveFilters} onClearFilters={handleClearFilters} />
        ) : (
          <section className="mt-3">
            {viewMode === "museum" ? (
              <VaultMuseumView
                items={filteredItems}
                onFilterToUniverse={(universe) => {
                  setUniverseFilter("ALL");
                  router.push(`/vault/${universeToSlug(universe)}`);
                }}
              />
            ) : viewMode === "swipe" ? (
              <div className="mx-auto max-w-sm">
                <SwipeStack
                  items={filteredItems}
                  mode="vault"
                  onOpen={(item) => {
                    router.push(`/vault/item/${item.id}`);
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredItems.map((item) => {
                  const intelligence = intelligenceMap[item.id];
                  const readiness = intelligence?.readiness ?? "Low";
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <div key={item.id} className="relative">
                      {selectMode && (
                        <button
                          type="button"
                          onClick={() => toggleSelectItem(item.id)}
                          className="absolute inset-0 z-40 flex items-center justify-center rounded-[14px]"
                          style={{ background: isSelected ? "rgba(245,181,72,0.18)" : "rgba(0,0,0,0.04)" }}
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                            style={isSelected
                              ? { background: "#F5B548", boxShadow: "0 0 0 2px rgba(245,181,72,0.5)" }
                              : { background: "rgba(255,255,255,0.15)", border: "2px solid rgba(245,181,72,0.55)" }}
                          >
                            {isSelected && (
                              <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 5.5l4 4L13 1" stroke="#1A0F00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </span>
                        </button>
                      )}
                      <VaultCard
                        item={item}
                        readiness={readiness}
                        sale={saleInfoForItem(item, saleMap)}
                        onSaveItem={handleSaveItem}
                        onDeleteItem={handleDeleteItem}
                        onNavigate={saveScrollPosition}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
