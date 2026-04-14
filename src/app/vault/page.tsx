"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ItemIntelligencePanel from "@/components/ItemIntelligencePanel";
import RestoreVaultButton from "@/components/RestoreVaultButton";
import SellItemButton from "@/components/SellItemButton";
import { PillButton } from "@/components/ui/PillButton";
import { confidenceLabel, confidenceTone, formatPriceUpdatedAt } from "@/lib/pricingMvp";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { computeItemIntelligence } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { migrateExistingVaultImagesToSupabase } from "@/lib/vaultMigration";
import { getPendingVaultSyncCount, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
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

type SortMode = "newest" | "value_desc" | "value_asc" | "gain_desc" | "gain_asc" | "title";
type ReadinessFilter = "all" | "high" | "medium" | "low";
type UniverseFilter = "ALL" | UniverseKey;
type InlineField = "" | "value" | "cost";

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

function normalizeUniverse(value: unknown): UniverseKey {
  const raw = String(value ?? "").toUpperCase();
  if (
    raw === "POP_CULTURE" ||
    raw === "SPORTS" ||
    raw === "TCG" ||
    raw === "MUSIC" ||
    raw === "JEWELRY_APPAREL" ||
    raw === "GAMES" ||
    raw === "MISC"
  ) {
    return raw;
  }
  return "MISC";
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
  return "bg-white/10 text-white/75 ring-white/10";
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

function priceSourceLabel(item: VaultItem) {
  if (item.priceSource?.trim()) return item.priceSource.trim();
  if (typeof item.lastCompValue === "number" && Number.isFinite(item.lastCompValue)) return "Last comp";
  if (typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue)) return "Estimate";
  return "No pricing source";
}

function CardMetric({
  label,
  editing,
  value,
  onStartEdit,
  inputValue,
  onInputChange,
  onSave,
  onCancel,
}: {
  label: string;
  editing: boolean;
  value: string;
  onStartEdit: () => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg bg-black/15 px-2 py-1.5 ring-1 ring-black/10">
      <div className="text-[10px] text-[color:var(--muted2)]">{label}</div>
      {editing ? (
        <div className="mt-1">
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            className="h-7 w-full rounded-md bg-[color:var(--pill)] px-2 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          className="mt-0.5 block text-left text-[11px] font-medium text-[color:var(--fg)] hover:text-cyan-300"
        >
          {value}
        </button>
      )}
    </div>
  );
}

function VaultCard({
  item,
  readiness,
  onSaveItem,
  onDeleteItem,
}: {
  item: VaultItem;
  readiness: string;
  onSaveItem: (item: VaultItem) => Promise<void>;
  onDeleteItem: (item: VaultItem) => Promise<void>;
}) {
  const image = useResolvedVaultImage(item);

  const [editingField, setEditingField] = useState<InlineField>("");
  const [valueDraft, setValueDraft] = useState(String(Number(item.currentValue ?? 0)));
  const [costDraft, setCostDraft] = useState(String(totalCost(item)));
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setValueDraft(String(Number(item.currentValue ?? 0)));
    setCostDraft(String(totalCost(item)));
  }, [item.currentValue, item.purchasePrice, item.purchaseTax, item.purchaseShipping, item.purchaseFees]);

  async function saveValueInline() {
    const nextValue = parseMoneyInput(valueDraft);
    if (nextValue === Number(item.currentValue ?? 0)) {
      setEditingField("");
      return;
    }
    await onSaveItem({ ...item, currentValue: nextValue });
    setEditingField("");
  }

  async function saveCostInline() {
    const nextCost = parseMoneyInput(costDraft);
    const currentCost = totalCost(item);
    if (nextCost === currentCost) {
      setEditingField("");
      return;
    }

    await onSaveItem({
      ...item,
      purchasePrice: nextCost,
      purchaseTax: 0,
      purchaseShipping: 0,
      purchaseFees: 0,
    });
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

  return (
    <div className="group relative overflow-hidden rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.024),rgba(255,255,255,0.01))] p-2 shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
      {item.isNew ? (
        <div className="absolute right-2 top-2 z-20 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          NEW
        </div>
      ) : null}

      <div className="absolute right-2 top-2 z-10 hidden items-center gap-1 group-hover:flex">
        <Link
          href={`/vault/item/${item.id}`}
          className="inline-flex h-7 items-center justify-center rounded-full bg-black/60 px-2.5 text-[11px] text-white ring-1 ring-white/10 backdrop-blur"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex h-7 items-center justify-center rounded-full bg-red-600/90 px-2.5 text-[11px] text-white ring-1 ring-red-500/40"
        >
          {isDeleting ? "..." : "Delete"}
        </button>
      </div>

      <Link href={`/vault/item/${item.id}`} className="block">
        <div className="mb-2 overflow-hidden rounded-[10px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),rgba(255,255,255,0.012)_45%,rgba(0,0,0,0.16)_100%)]">
          <div className="flex h-[96px] items-center justify-center bg-black/10 p-2 sm:h-[102px] lg:h-[110px] xl:h-[118px]">
            {image ? (
              <img
                src={image}
                alt={item.title}
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-[color:var(--muted)]">
                No image
              </div>
            )}
          </div>
        </div>

        <div className="line-clamp-2 pr-10 text-[13px] font-semibold leading-tight">
          {item.title}
        </div>

        <div className="mt-1 line-clamp-2 min-h-[28px] text-[11px] text-[color:var(--muted)]">
          {itemMeta(item)}
        </div>
      </Link>

      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
        <CardMetric
          label="Value"
          editing={editingField === "value"}
          value={formatMoney(Number(item.currentValue ?? 0))}
          onStartEdit={() => setEditingField("value")}
          inputValue={valueDraft}
          onInputChange={setValueDraft}
          onSave={() => void saveValueInline()}
          onCancel={() => {
            setValueDraft(String(Number(item.currentValue ?? 0)));
            setEditingField("");
          }}
        />
        <CardMetric
          label="Cost"
          editing={editingField === "cost"}
          value={formatMoney(totalCost(item))}
          onStartEdit={() => setEditingField("cost")}
          inputValue={costDraft}
          onInputChange={setCostDraft}
          onSave={() => void saveCostInline()}
          onCancel={() => {
            setCostDraft(String(totalCost(item)));
            setEditingField("");
          }}
        />
        <div className="rounded-lg bg-black/15 px-2 py-1.5 ring-1 ring-black/10">
          <div className="text-[10px] text-[color:var(--muted2)]">Gain</div>
          <div className="mt-0.5 text-[11px] font-medium">
            {itemGain(item) >= 0 ? "+" : ""}
            {formatMoney(itemGain(item))}
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-lg bg-black/15 px-2 py-1.5 ring-1 ring-black/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] text-[color:var(--muted2)]">Pricing MVP</div>
            <div className="mt-0.5 text-[11px] font-medium text-[color:var(--fg)]">
              {formatMoney(effectiveMarketValue(item))}
            </div>
          </div>
          {item.priceConfidence ? (
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[10px] ring-1",
                confidenceTone(item.priceConfidence),
              ].join(" ")}
            >
              {confidenceLabel(item.priceConfidence)}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[color:var(--muted)]">
          <span className="truncate">{priceSourceLabel(item)}</span>
          <span>{formatPriceUpdatedAt(item.priceUpdatedAt)}</span>
        </div>

        {typeof item.lastCompValue === "number" && Number.isFinite(item.lastCompValue) ? (
          <div className="mt-1 text-[10px] text-[color:var(--muted)]">
            Last comp {formatMoney(item.lastCompValue)}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className={["rounded-full px-2 py-0.5 text-[10px] ring-1", readinessTone(readiness)].join(" ")}>
          {readiness}
        </span>
        <span className="text-[10px] text-[color:var(--muted)]">
          {UNIVERSE_LABEL[normalizeUniverse(item.universe)]}
        </span>
      </div>

      <div className="mt-1.5">
        <SellItemButton item={item} />
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
          <div className="rounded-[14px] bg-black/10 p-4 ring-1 ring-white/8">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">1</div>
            <div className="mt-1 text-sm font-medium">Create an item</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Start with title, category, and value.
            </div>
          </div>
          <div className="rounded-[14px] bg-black/10 p-4 ring-1 ring-white/8">
            <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">2</div>
            <div className="mt-1 text-sm font-medium">Add pricing</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              Save estimate, source, confidence, and notes.
            </div>
          </div>
          <div className="rounded-[14px] bg-black/10 p-4 ring-1 ring-white/8">
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

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("ALL");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [gradedOnly, setGradedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  function refresh() {
    setItems(loadItems());
    setPendingSyncCount(getPendingVaultSyncCount());
  }

  async function hydrateAll() {
    refresh();
    await processVaultSyncQueue();
    await syncVaultItemsFromSupabase();
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
    const next = items.filter((item) => {
      if (universeFilter !== "ALL" && item.universe !== universeFilter) return false;
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
  }, [items, query, universeFilter, gradedOnly, sortMode, readinessFilter, intelligenceMap]);

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
      MISC: 0,
    };
    for (const item of items) counts[normalizeUniverse(item.universe)] += 1;
    return counts;
  }, [items]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    universeFilter !== "ALL" ||
    readinessFilter !== "all" ||
    gradedOnly ||
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

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <section className="relative overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT</div>
                <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:text-[1.9rem]">
                  Vault Inventory
                </h1>
                <div className="mt-1.5 text-sm text-[color:var(--muted)]">
                  Operator-first view. Dense, editable, fast.
                </div>
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
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
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[14px] bg-black/16 p-2.5 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED ITEMS</div>
                <div className="mt-1 text-lg font-semibold">{stats.totalItems}</div>
              </div>
              <div className="rounded-[14px] bg-black/16 p-2.5 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED COST</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalCost)}</div>
              </div>
              <div className="rounded-[14px] bg-black/16 p-2.5 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED VALUE</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(stats.totalValue)}</div>
              </div>
              <div className="rounded-[14px] bg-black/16 p-2.5 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">FILTERED GAIN</div>
                <div className="mt-1 text-lg font-semibold">
                  {stats.totalGain >= 0 ? "+" : ""}
                  {formatMoney(stats.totalGain)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">CLOUD + OFFLINE STATUS</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Queue: <span className="font-semibold text-[color:var(--fg)]">{pendingSyncCount}</span>
                {" • "}
                {isOnline === null ? "Checking..." : isOnline ? "Online" : "Offline"}
              </div>
              {syncStatus ? <div className="mt-2 text-sm text-[color:var(--fg)]">{syncStatus}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <PillButton onClick={() => void hydrateAll()}>Sync Now</PillButton>
              <PillButton onClick={() => void runMigration()} disabled={isMigrating}>
                {isMigrating ? "Migrating..." : "Repair / Migrate Images"}
              </PillButton>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.7fr))]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vault items..."
              className="min-h-[40px] w-full rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <select
              value={universeFilter}
              onChange={(e) => setUniverseFilter(e.target.value as UniverseFilter)}
              className="min-h-[40px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="ALL">All Universes</option>
              {(Object.keys(UNIVERSE_LABEL) as UniverseKey[]).map((key) => (
                <option key={key} value={key}>
                  {UNIVERSE_LABEL[key]} ({universeCounts[key]})
                </option>
              ))}
            </select>
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value as ReadinessFilter)}
              className="min-h-[40px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="all">All Readiness</option>
              <option value="high">High Readiness</option>
              <option value="medium">Medium Readiness</option>
              <option value="low">Low Readiness</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-[40px] rounded-xl bg-[color:var(--input)] px-4 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="value_desc">Value ↓</option>
              <option value="value_asc">Value ↑</option>
              <option value="gain_desc">Gain ↓</option>
              <option value="gain_asc">Gain ↑</option>
              <option value="title">Title A-Z</option>
            </select>
            <PillButton
              variant={gradedOnly ? "active" : "default"}
              onClick={() => setGradedOnly((v) => !v)}
              className="min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium text-[color:var(--fg)]"
            >
              {gradedOnly ? "Graded: On" : "Graded Only"}
            </PillButton>
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

        {filteredItems.length === 0 ? (
          <VaultEmptyState hasFilters={hasActiveFilters} onClearFilters={handleClearFilters} />
        ) : (
          <section className="mt-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredItems.map((item) => {
                const intelligence = intelligenceMap[item.id];
                const readiness = intelligence?.readiness ?? "Low";

                return (
                  <VaultCard
                    key={item.id}
                    item={item}
                    readiness={readiness}
                    onSaveItem={handleSaveItem}
                    onDeleteItem={handleDeleteItem}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}