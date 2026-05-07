"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { getPrimaryImageUrl, loadItems, saveItem, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";

const SALES_KEY = "vltd_sales_history";

type SoldItem = {
  id: string;
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  customCategoryLabel?: string;
  subcategoryLabel?: string;
  imageFrontUrl?: string;
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  soldPrice: number;
  soldAt: number;
  itemId?: string;
};

type SoldStats = {
  count: number;
  realizedRevenue: number;
  totalCost: number;
  totalProfit: number;
};

function money(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function cost(i: SoldItem) {
  return (
    Number(i.purchasePrice ?? 0) +
    Number(i.purchaseTax ?? 0) +
    Number(i.purchaseShipping ?? 0) +
    Number(i.purchaseFees ?? 0)
  );
}

function normalizeUniverseText(value: unknown) {
  return String(value ?? "")
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

function inferSoldUniverse(item: SoldItem): UniverseKey {
  const rawUniverse = typeof item.universe === "string" ? item.universe.trim() : "";
  if (rawUniverse) return normalizeUniverse(rawUniverse);

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

function itemMeta(item: SoldItem) {
  const primary = [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
  if (primary) return primary;
  const fallback = [
    item.categoryLabel || item.customCategoryLabel,
    item.subcategoryLabel,
  ]
    .filter(Boolean)
    .join(" • ");
  return fallback || "Sold item record";
}

function readSales(): SoldItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(data) ? (data as SoldItem[]) : [];
  } catch {
    return [];
  }
}

function writeSales(items: SoldItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(items));
  } catch {
    // Sales history is a compatibility cache. Cloud item state remains primary.
  }
}

function removeSaleRecord(itemId: string) {
  writeSales(
    readSales().filter((sale) => String(sale.id) !== String(itemId) && String(sale.itemId ?? "") !== String(itemId))
  );
}

function soldItemFromVaultItem(item: VaultItem): SoldItem | null {
  if (item.status !== "SOLD" && !item.soldAt && item.soldPrice === undefined) return null;

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    universe: item.universe,
    category: item.category,
    categoryLabel: item.categoryLabel,
    customCategoryLabel: item.customCategoryLabel,
    subcategoryLabel: item.subcategoryLabel,
    imageFrontUrl: getPrimaryImageUrl(item) || item.imageFrontUrl,
    purchasePrice: item.purchasePrice,
    purchaseTax: item.purchaseTax,
    purchaseShipping: item.purchaseShipping,
    purchaseFees: item.purchaseFees,
    soldPrice: Number(item.soldPrice ?? 0),
    soldAt: Number(item.soldAt ?? Date.now()),
  };
}

function buildSoldItems() {
  const byId = new Map<string, SoldItem>();

  for (const item of loadItems({ includeAllProfiles: true })) {
    const sold = soldItemFromVaultItem(item);
    if (sold) byId.set(String(sold.id), sold);
  }

  for (const sale of readSales()) {
    if (!byId.has(String(sale.id))) byId.set(String(sale.id), sale);
  }

  return Array.from(byId.values()).sort((a, b) => Number(b.soldAt) - Number(a.soldAt));
}

function soldStats(items: SoldItem[]): SoldStats {
  return items.reduce(
    (stats, item) => {
      const itemCost = cost(item);
      stats.count += 1;
      stats.realizedRevenue += Number(item.soldPrice ?? 0);
      stats.totalCost += itemCost;
      stats.totalProfit += Number(item.soldPrice ?? 0) - itemCost;
      return stats;
    },
    { count: 0, realizedRevenue: 0, totalCost: 0, totalProfit: 0 }
  );
}

function SoldCard({
  item,
  onReturnToVault,
  onViewImage,
}: {
  item: SoldItem;
  onReturnToVault: (item: SoldItem) => void;
  onViewImage: (item: SoldItem, imageUrl: string) => void;
}) {
  const profit = item.soldPrice - cost(item);
  const universe = inferSoldUniverse(item);
  const detailHref = `/vault/item/${item.id}?sold=1`;
  const imageUrl = getPrimaryImageUrl(item as unknown as VaultItem) || item.imageFrontUrl || "";

  return (
    <article
      className="group relative flex h-[174px] flex-col overflow-hidden rounded-[14px] border border-white/8 bg-[#07101d]/88 p-2 shadow-[0_10px_24px_rgba(0,0,0,0.22)] ring-1 ring-cyan-400/10 transition hover:-translate-y-0.5 hover:ring-cyan-300/30"
    >
      <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-amber-100 ring-1 ring-amber-400/30">
        SOLD
      </span>

      {imageUrl ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onViewImage(item, imageUrl);
          }}
          className="block h-[78px] overflow-hidden rounded-[10px] bg-black/18"
          aria-label={`View image for ${item.title}`}
        >
          <div className="flex h-full items-center justify-center bg-black/10 p-1">
            <ProgressiveImage
              src={imageUrl}
              alt={item.title}
              className="h-full w-full"
              imageClassName="object-contain object-center"
              draggable={false}
            />
          </div>
        </button>
      ) : (
        <Link href={detailHref} className="block h-[78px] overflow-hidden rounded-[10px] bg-black/18">
          <div className="flex h-full items-center justify-center bg-black/10 p-1">
            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold text-[color:var(--muted)]">
              No image
            </div>
          </div>
        </Link>
      )}

      <Link href={detailHref} className="mt-2 min-w-0">
        <div className="line-clamp-1 text-[13px] font-extrabold leading-tight text-white sm:text-[14px]">
          {item.title}
        </div>
        <div className="mt-0.5 line-clamp-1 text-[10px] font-medium text-cyan-100/55">
          {UNIVERSE_LABEL[universe] ?? "Misc"} - {itemMeta(item)}
        </div>
      </Link>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-none text-white">{money(item.soldPrice)}</div>
          <div className={profit >= 0 ? "mt-1 text-[10px] font-bold leading-none text-emerald-300" : "mt-1 text-[10px] font-bold leading-none text-red-300"}>
            {profit >= 0 ? "+" : ""}
            {money(profit)}
          </div>
          <div className="mt-1 text-[9px] font-semibold text-[color:var(--muted2)]">
            {new Date(item.soldAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "2-digit",
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onReturnToVault(item);
          }}
          className="shrink-0 rounded-full bg-cyan-400/14 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100 ring-1 ring-cyan-300/25 transition hover:bg-cyan-400/22"
        >
          Return
        </button>
      </div>
    </article>
  );
}

export default function SoldPage() {
  const [items, setItems] = useState<SoldItem[]>(() => buildSoldItems());
  const [status, setStatus] = useState("");
  const [imagePreview, setImagePreview] = useState<{ title: string; imageUrl: string } | null>(null);

  function load() {
    setItems(buildSoldItems());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncVaultItemsFromSupabase().finally(load);
    }, 0);
    window.addEventListener("vltd:vault-updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("vltd:vault-updated", load);
    };
  }, []);

  const stats = useMemo(() => soldStats(items), [items]);

  async function handleReturnToVault(item: SoldItem) {
    const confirmed = window.confirm(`Return "${item.title}" to the Vault and remove its sold status?`);
    if (!confirmed) return;

    const existing = loadItems({ includeAllProfiles: true }).find((entry) => String(entry.id) === String(item.id));
    const restored: VaultItem = {
      ...(existing ?? (item as unknown as VaultItem)),
      id: item.id,
      title: item.title || existing?.title || "Restored item",
      status: "COLLECTION",
      soldPrice: undefined,
      soldAt: undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    saveItem(restored);
    removeSaleRecord(item.id);
    setItems((prev) => prev.filter((entry) => String(entry.id) !== String(item.id)));
    setStatus(`Returned ${restored.title} to Vault.`);

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase
        .from("vault_items")
        .update({
          status: "COLLECTION",
          sold_price: null,
          sold_at: null,
        })
        .eq("id", item.id);

      if (error) {
        setStatus(`${error.message} Returned locally only.`);
      }
    }

    enqueueVaultItemSync(restored.id);
    await processVaultSyncQueue();
    await syncVaultItemsFromSupabase();
    load();
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <section className="relative overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]">
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SOLD VAULT</div>
                <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight sm:text-[1.9rem]">
                  Sold Items
                </h1>
                <div className="mt-1.5 text-sm text-[color:var(--muted)]">
                  Realized sales history using the same compact management layout as Vault.
                </div>
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
                <Link
                  href="/vault"
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                >
                  Back to Vault
                </Link>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[14px] bg-black/15 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Sold</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{stats.count}</div>
              </div>
              <div className="rounded-[14px] bg-black/15 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Revenue</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{money(stats.realizedRevenue)}</div>
              </div>
              <div className="rounded-[14px] bg-black/15 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Cost Basis</div>
                <div className="mt-1 text-lg font-extrabold leading-none">{money(stats.totalCost)}</div>
              </div>
              <div className="rounded-[14px] bg-black/15 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Realized Profit</div>
                <div className={stats.totalProfit >= 0 ? "mt-1 text-lg font-extrabold leading-none text-emerald-300" : "mt-1 text-lg font-extrabold leading-none text-red-300"}>
                  {stats.totalProfit >= 0 ? "+" : ""}
                  {money(stats.totalProfit)}
                </div>
              </div>
            </div>

            {status ? (
              <div className="rounded-[14px] bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 ring-1 ring-cyan-300/20">
                {status}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-3">
          {items.length === 0 ? (
            <div className="rounded-[18px] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              No sold items yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {items.map((item) => (
                <SoldCard
                  key={item.id}
                  item={item}
                  onReturnToVault={(target) => void handleReturnToVault(target)}
                  onViewImage={(target, imageUrl) => setImagePreview({ title: target.title, imageUrl })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {imagePreview ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
          aria-label="Close image preview"
        >
          <span className="relative block max-h-[88vh] w-full max-w-4xl rounded-[24px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <span className="mb-3 flex items-center justify-between gap-3">
              <span className="line-clamp-1 text-left text-sm font-semibold text-white">{imagePreview.title}</span>
              <span className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-[color:var(--border)]">
                Close
              </span>
            </span>
            <span className="block max-h-[78vh] overflow-hidden rounded-[18px] bg-black/30">
              <ProgressiveImage
                src={imagePreview.imageUrl}
                alt={imagePreview.title}
                className="h-[78vh] w-full"
                imageClassName="object-contain object-center"
                draggable={false}
              />
            </span>
          </span>
        </button>
      ) : null}
    </main>
  );
}
