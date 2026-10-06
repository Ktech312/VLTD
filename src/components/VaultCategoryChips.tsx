"use client";

import { useMemo } from "react";

import type { VaultItem } from "@/lib/vaultModel";

export function vaultItemCategory(item: VaultItem) {
  return String(item.categoryLabel || item.customCategoryLabel || item.category || "").trim();
}

export function vaultItemSubcategory(item: VaultItem) {
  return String(item.subcategoryLabel || "").trim();
}

/**
 * Category, then subcategory chips for a Vault list. The choices come from what is really in the
 * items you are looking at, so imported labels show up too. Same chip style as the exhibit picker.
 */
export default function VaultCategoryChips({
  items,
  category,
  subcategory,
  onCategory,
  onSubcategory,
}: {
  items: VaultItem[];
  category: string;
  subcategory: string;
  onCategory: (value: string) => void;
  onSubcategory: (value: string) => void;
}) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const name = vaultItemCategory(item);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const subcategories = useMemo(() => {
    if (!category) return [];
    const counts = new Map<string, number>();
    for (const item of items) {
      if (vaultItemCategory(item) !== category) continue;
      const name = vaultItemSubcategory(item);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items, category]);

  if (categories.length === 0) return null;

  const chipClass = (active: boolean) =>
    [
      "vltd-selectable shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
      active
        ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)]"
        : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
    ].join(" ");

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Category">
        {categories.map(([name, count]) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => {
              onCategory(category === name ? "" : name);
              onSubcategory("");
            }}
            className={chipClass(category === name)}
          >
            {name} <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>
      {subcategories.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Subcategory">
          {subcategories.map(([name, count]) => (
            <button
              key={name}
              type="button"
              aria-pressed={subcategory === name}
              onClick={() => onSubcategory(subcategory === name ? "" : name)}
              className={chipClass(subcategory === name)}
            >
              {name} <span className="opacity-60">{count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
