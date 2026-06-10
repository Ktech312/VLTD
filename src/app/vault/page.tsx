"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ItemIntelligencePanel from "@/components/ItemIntelligencePanel";
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import RestoreVaultButton from "@/components/RestoreVaultButton";
import SellItemButton from "@/components/SellItemButton";
import VaultExportButton from "@/components/VaultExportButton";
import { PillButton } from "@/components/ui/PillButton";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
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
import { getPublicVaultUrl, syncPublicProfile } from "@/lib/publicProfile";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";
const SALES_KEY = "vltd_sales_history";
const FOCUS_LS_KEY = "vltd_primary_focus";

type SortMode = "newest" | "value_desc" | "value_asc" | "gain_desc" | "gain_asc" | "title";
type ReadinessFilter = "all" | "high" | "medium" | "low";
type UniverseFilter = "ALL" | UniverseKey;
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
type VaultUniverseSlug = "pop-culture" | "sports" | "tcg" | "music" | "jewelry-apparel" | "games" | "misc";

type VaultUniverseEntry = {
  key: UniverseKey;
  slug: VaultUniverseSlug;
  description: string;
  href: string;
};

const VAULT_UNIVERSES: VaultUniverseEntry[] = [
  {
    key: "POP_CULTURE",
    slug: "pop-culture",
    description: "Comics, toys, art cards, character collectibles, slabs, variants, and pop-culture pieces.",
    href: "/vault/pop-culture",
  },
  {
    key: "SPORTS",
    slug: "sports",
    description: "Sports cards, jerseys, autos, game-used items, memorabilia, and athlete collectibles.",
    href: "/vault/sports",
  },
  {
    key: "TCG",
    slug: "tcg",
    description: "Pokemon, MTG, Bo Jackson Arena, sealed products, slabs, singles, foils, and promos.",
    href: "/vault/tcg",
  },
  {
    key: "MUSIC",
    slug: "music",
    description: "Vinyl records, CDs, instruments, signed albums, box sets, and music collectibles.",
    href: "/vault/music",
  },
  {
    key: "JEWELRY_APPAREL",
    slug: "jewelry-apparel",
    description: "Watches, bags, apparel, streetwear, vintage pieces, luxury items, and limited drops.",
    href: "/vault/jewelry-apparel",
  },
  {
    key: "GAMES",
    slug: "games",
    description: "Video games, consoles, cartridges, controllers, sealed games, and arcade/handheld pieces.",
    href: "/vault/games",
  },
  {
    key: "MISC",
    slug: "misc",
    description: "Everything that cannot be confidently assigned to another Universe yet.",
    href: "/vault/misc",
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
  if (["misc", "miscellaneous", "other", "uncategorized", "unknown", "collectors choice"].includes(text)) return "MISC";

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
  if (readiness === "Medium") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
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
}: {
  item: VaultItem;
  readiness: string;
  sale: SaleInfo | null;
  onSaveItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (item: VaultItem) => Promise<void>;
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
        "group relative flex h-[174px] flex-col overflow-hidden rounded-[14px] border border-[color:var(--theme-border)] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-gold/10 transition hover:-translate-y-0.5",
        marketValue > 0 ? "border-l-2 border-l-emerald-400/55" : "border-l border-l-white/8",
      ].join(" ")}
      style={{ background: "var(--theme-card, rgba(15,25,45,0.85))" }}
    >
      {/* Status badge — top LEFT to avoid colliding with hover action buttons */}
      <span className={["absolute left-2 top-2 z-10 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ring-1", statusClass].join(" ")}>
        {statusLabel}
      </span>

      {/* Hover action buttons — top RIGHT, clear of status badge */}
      <div className="absolute right-1.5 top-1.5 z-20 hidden items-center gap-1 group-hover:flex">
        <Link
          href={detailHref}
          className="inline-flex h-6 items-center justify-center rounded-full bg-black/70 px-2 text-[10px] text-text-primary ring-1 ring-[color:var(--theme-border)] backdrop-blur"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex h-6 items-center justify-center rounded-full bg-red-600/90 px-2 text-[10px] text-text-primary ring-1 ring-red-500/40"
        >
          {isDeleting ? "..." : "Delete"}
        </button>
      </div>

      <div className="relative h-[78px] overflow-hidden rounded-[10px] bg-black/18">
        <Link href={detailHref} className="block h-full">
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
        </Link>
        <div className="absolute right-1.5 top-1.5 z-30">
          <ItemVisibilityToggle item={item} />
        </div>
      </div>

      <Link href={detailHref} className="mt-2 min-w-0">
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
        <h2 className="mt-2 text-2xl font-semibold">Your vault is empty. Let&apos;s fix that.</h2>
        <div className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
          Scan an item with the camera, add it manually, or import an existing spreadsheet. VLTD keeps everything local-first and syncs when cloud storage is available.
        </div>
        <div
          className="mt-3 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs"
          style={{ background: "rgba(245,181,72,0.08)", border: "1px solid rgba(245,181,72,0.15)", color: "#A0956B" }}
        >
          <span>Universes:</span>
          <span style={{ color: "#F5B548" }}>TCG - Sports - Comics - Music - Games - Jewelry - Misc</span>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/capture"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-bold transition hover:opacity-90 sm:w-auto"
            style={{ background: "#F5B548", color: "#0B0B0B" }}
          >
            <CameraIcon className="h-5 w-5" />
            Scan your first item
          </Link>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/vault/quick"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
              style={{ color: "var(--fg)" }}
            >
              Quick Add
            </Link>
            <Link
              href="/vault/add"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
              style={{ color: "var(--fg)" }}
            >
              Add manually
            </Link>
            <Link
              href="/vault/import"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
              style={{ color: "var(--fg)" }}
            >
              Import
            </Link>
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
  const coverItem = items[0];
  const coverImage = useResolvedVaultImage(coverItem ?? null);
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
        borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      <div className="grid min-h-[124px] grid-cols-[92px_minmax(0,1fr)] gap-3 sm:grid-cols-[104px_minmax(0,1fr)]">
        <div
          className="overflow-hidden rounded-[14px]"
          style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(245,181,72,0.08))" }}
        >
          {coverImage ? (
            <ProgressiveImage
              src={coverImage}
              alt={`${universeDisplayName(category.key)} cover`}
              className="h-full min-h-[124px] w-full"
              imageClassName="object-cover transition duration-300 group-hover:scale-105"
              draggable={false}
            />
          ) : (
            <div className="flex h-full min-h-[124px] flex-col items-center justify-center gap-1 px-3 text-center text-[11px] font-semibold" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              <span className="text-xl leading-none" style={{ color: "var(--theme-gold, #F5B548)", opacity: 0.7 }}>+</span>
              <span>{hasItems ? universeDisplayName(category.key) : "Add items"}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between py-1 pr-1">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>Universe</div>
                <h2 className="mt-1 text-xl font-semibold leading-tight" style={{ color: "var(--theme-gold, #F5B548)" }}>
                  {universeDisplayName(category.key)}
                  {isFocus && (
                    <span className="ml-2 text-xs font-medium" style={{ color: "var(--theme-text-muted, #A0956B)" }}>· Your Focus</span>
                  )}
                </h2>
              </div>
              <div
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: "var(--theme-elevated, rgba(20,32,55,0.9))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))", color: "var(--theme-text-primary, #F0EAD6)" }}
              >
                {items.length} {items.length === 1 ? "item" : "items"}
              </div>
            </div>
            <div className="mt-2 line-clamp-2 text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
              {hasItems ? category.description : "No items here yet. Tap to start adding to this universe."}
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted, #A0956B)" }}>Value</div>
              <div className="mt-0.5 text-lg font-extrabold leading-none" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                {hasItems ? formatMoney(totalValue) : "—"}
              </div>
            </div>
            <div
              className="text-right text-sm font-bold"
              style={{ color: showGain ? (totalGain >= 0 ? "var(--color-gain, #4CAF82)" : "var(--color-loss, #E05252)") : "var(--theme-text-muted, #A0956B)" }}
            >
              {showGain ? `${totalGain >= 0 ? "+" : ""}${formatMoney(totalGain)}` : "—"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function VaultPage() {
  const [focusKey] = useState<UniverseKey | null>(() => readFocusUniverseKey());
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("ALL");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [gradedOnly, setGradedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showSoldItems, setShowSoldItems] = useState(false);
  const [sales, setSales] = useState<SaleInfo[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [shareMessage, setShareMessage] = useState("");

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
  }, [items, query, universeFilter, gradedOnly, sortMode, readinessFilter, intelligenceMap, sales, showSoldItems]);

  const saleMap = useMemo(
    () => Object.fromEntries(sales.map((sale) => [String(sale.id), sale])),
    [sales]
  );
  const soldCount = useMemo(
    () => items.filter((item) => saleInfoForItem(item, saleMap)).length,
    [items, saleMap]
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

  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const totalCostValue = filteredItems.reduce((sum, item) => sum + totalCost(item), 0);
    const totalValue = filteredItems.reduce((sum, item) => sum + effectiveMarketValue(item), 0);
    const totalGain = totalValue - totalCostValue;
    return { totalItems, totalCost: totalCostValue, totalValue, totalGain };
  }, [filteredItems]);


  const hasActiveFilters =
    query.trim().length > 0 ||
    universeFilter !== "ALL" ||
    readinessFilter !== "all" ||
    gradedOnly ||
    showSoldItems ||
    sortMode !== "newest";

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

  function handleClearFilters() {
    setQuery("");
    setUniverseFilter("ALL");
    setReadinessFilter("all");
    setGradedOnly(false);
    setSortMode("newest");
  }

  async function handleShareVault() {
    const url = getPublicVaultUrl();
    if (!url) {
      setShareMessage("No active profile");
      window.setTimeout(() => setShareMessage(""), 2000);
      return;
    }

    try {
      await syncPublicProfile();
      await navigator.clipboard.writeText(url);
      setShareMessage(publicCount > 0 ? "Copied!" : "Copied - no public items yet");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Could not copy link");
    }

    window.setTimeout(() => setShareMessage(""), 2000);
  }

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <section
          className="relative overflow-hidden rounded-[18px] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)] max-w-3xl mx-auto w-full"
          style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", border: "1px solid var(--theme-border, rgba(245,181,72,0.12))" }}
        >
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT</div>
                <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:text-[1.9rem]">
                  Vault Universes
                </h1>
                {items.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--muted)]">
                    <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">
                      {privateCount} private
                    </span>
                    <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">
                      {publicCount} public
                    </span>
                    <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 ring-1 ring-[color:var(--border)]">
                      Public links only show items you unlock
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                <button
                  type="button"
                  onClick={() => void handleShareVault()}
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  {shareMessage || "Share vault"}
                </button>
                <VaultExportButton />
                <Link
                  href="/vault/add"
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Add
                </Link>
                <Link
                  href="/vault/quick"
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
                >
                  Quick Add
                </Link>
                <Link
                  href="/vault/import"
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Import
                </Link>
                <Link
                  href="/vault/sold"
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  Sold
                </Link>
                <Link
                  href="/vault/for-sale"
                  className="inline-flex shrink-0 min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                >
                  For Sale
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED ITEMS</div>
                <div className="mt-1 text-lg font-semibold">{stats.totalItems}</div>
              </div>
              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED COST</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalCost)}</div>
              </div>
              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))', borderLeft: '3px solid #4CAF82' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED GAIN</div>
                <div className="mt-1 text-lg font-semibold">
                  {stats.totalGain >= 0 ? "+" : ""}
                  {formatMoney(stats.totalGain)}
                </div>
              </div>
              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED VALUE</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalValue)}</div>
              </div>
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <VaultEmptyState hasFilters={false} onClearFilters={handleClearFilters} />
        ) : (
          <section className="mt-3 max-w-3xl mx-auto w-full">
            <div className="grid grid-cols-2 gap-4">
              {orderedUniverses.map((category) => (
                <UniverseOverviewCard
                  key={category.key}
                  category={category}
                  items={universeGroups[category.key]}
                  isFocus={focusKey === category.key}
                  className=""
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
