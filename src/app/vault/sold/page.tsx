"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";

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
    imageFrontUrl: item.imageFrontUrl,
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

function SoldCard({ item }: { item: SoldItem }) {
  const profit = item.soldPrice - cost(item);
  const universe = inferSoldUniverse(item);

  return (
    <Link
      href={`/vault/item/${item.id}?sold=1`}
      className="group grid h-[102px] grid-cols-[78px_minmax(0,1fr)_74px] gap-2 overflow-hidden rounded-[14px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.024),rgba(255,255,255,0.01))] p-1.5 shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:border-cyan-400/25 hover:bg-white/[0.035]"
    >
      <div className="overflow-hidden rounded-[11px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),rgba(255,255,255,0.012)_48%,rgba(0,0,0,0.18)_100%)]">
        <div className="flex h-full items-center justify-center bg-black/10 p-1">
          {item.imageFrontUrl ? (
            <img
              src={item.imageFrontUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold text-[color:var(--muted)]">
              No image
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col py-0.5">
        <div className="min-w-0">
          <div className="line-clamp-1 text-[14px] font-semibold leading-tight text-cyan-300 sm:text-[15px]">
            {item.title}
          </div>
          <div className="mt-1 line-clamp-1 text-[11px] font-medium text-[color:var(--fg)]">
            {itemMeta(item)}
          </div>
        </div>

        <div className="mt-1 min-w-0">
          <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
            Universe
          </div>
          <div className="mt-0.5 truncate rounded-md bg-black/20 px-1.5 py-1 text-[9px] font-semibold text-[color:var(--fg)] ring-1 ring-white/10">
            {UNIVERSE_LABEL[universe] ?? "Misc"}
          </div>
        </div>

        <div className="mt-auto flex items-baseline gap-2 pt-1.5">
          <span className="text-[15px] font-extrabold leading-none text-[color:var(--fg)]">
            {money(item.soldPrice)}
          </span>
          <span className={profit >= 0 ? "text-[12px] font-bold leading-none text-emerald-300" : "text-[12px] font-bold leading-none text-red-300"}>
            {profit >= 0 ? "+" : ""}
            {money(profit)}
          </span>
        </div>
      </div>

      <div className="flex min-h-full flex-col items-end justify-between py-0.5 pr-0.5">
        <span className="rounded-full bg-amber-500/18 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-400/30">
          SOLD
        </span>
        <div className="text-right text-[9px] font-semibold leading-tight text-[color:var(--muted2)]">
          {new Date(item.soldAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "2-digit",
          })}
        </div>
      </div>
    </Link>
  );
}

export default function SoldPage() {
  const [items, setItems] = useState<SoldItem[]>(() => buildSoldItems());

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
                <SoldCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
