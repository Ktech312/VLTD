"use client";

import { useMemo } from "react";

import type { VaultItem } from "@/lib/vaultModel";

export function vaultItemCategory(item: VaultItem) {
  return String(item.categoryLabel || item.customCategoryLabel || item.category || "").trim();
}

export function vaultItemSubcategory(item: VaultItem) {
  return String(item.subcategoryLabel || "").trim();
}

/** Labels that differ only by capital letters are the same category: compare with this key. */
export function chipKey(value: string) {
  return value.trim().toLowerCase();
}

/** One chip per category, however it was capitalised; shown with its most common spelling. */
export function chipOptions(values: string[]): { key: string; label: string; count: number }[] {
  const byKey = new Map<string, { counts: Map<string, number>; count: number }>();
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = chipKey(clean);
    const entry = byKey.get(key) ?? { counts: new Map<string, number>(), count: 0 };
    entry.counts.set(clean, (entry.counts.get(clean) ?? 0) + 1);
    entry.count += 1;
    byKey.set(key, entry);
  }
  return Array.from(byKey.entries())
    .map(([key, entry]) => {
      const label = Array.from(entry.counts.entries()).sort(
        (a, b) => b[1] - a[1] || Number(/^[A-Z]/.test(b[0])) - Number(/^[A-Z]/.test(a[0]))
      )[0][0];
      return { key, label, count: entry.count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Category, then subcategory chips for a Vault list. Pick as many as you like; with none picked,
 * everything shows. The choices come from what is really in the items, so imported labels show up.
 */
export default function VaultCategoryChips({
  items,
  categories: selectedCategories,
  subcategories: selectedSubcategories,
  onCategories,
  onSubcategories,
}: {
  items: VaultItem[];
  categories: string[];
  subcategories: string[];
  onCategories: (keys: string[]) => void;
  onSubcategories: (keys: string[]) => void;
}) {
  const categoryOptions = useMemo(() => chipOptions(items.map(vaultItemCategory)), [items]);

  const subcategoryOptions = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    return chipOptions(
      items
        .filter((item) => selectedCategories.includes(chipKey(vaultItemCategory(item))))
        .map(vaultItemSubcategory)
    );
  }, [items, selectedCategories]);

  if (categoryOptions.length === 0) return null;

  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

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
        {categoryOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={selectedCategories.includes(option.key)}
            onClick={() => {
              onCategories(toggle(selectedCategories, option.key));
              onSubcategories([]);
            }}
            className={chipClass(selectedCategories.includes(option.key))}
          >
            {option.label} <span className="opacity-60">{option.count}</span>
          </button>
        ))}
      </div>
      {subcategoryOptions.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Subcategory">
          {subcategoryOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={selectedSubcategories.includes(option.key)}
              onClick={() => onSubcategories(toggle(selectedSubcategories, option.key))}
              className={chipClass(selectedSubcategories.includes(option.key))}
            >
              {option.label} <span className="opacity-60">{option.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
