// Map free-text AI classifications onto the app's taxonomy so scan results can
// auto-fill the Universe / Category / Subcategory dropdowns.

import {
  UNIVERSE_KEYS,
  UNIVERSE_LABEL,
  getCategories,
  getSubcategories,
  isUniverseKey,
  type UniverseKey,
} from "@/lib/taxonomy";

/** Best-effort match of a free-text universe string to a known UniverseKey. */
export function matchVisionUniverse(text: string): UniverseKey | "" {
  const value = String(text ?? "").trim();
  if (!value) return "";
  const upper = value.toUpperCase().replace(/[\s-]+/g, "_");
  if (isUniverseKey(upper)) return upper;
  for (const key of UNIVERSE_KEYS) {
    if (UNIVERSE_LABEL[key].toLowerCase() === value.toLowerCase()) return key;
  }
  const v = value.toLowerCase();
  if (v.includes("tcg") || v.includes("pokemon") || v.includes("magic") || v.includes("mtg") || v.includes("yu-gi") || v.includes("yugioh") || v.includes("lorcana") || v.includes("non sport")) return "TCG";
  if (v.includes("comic") || v.includes("toy") || v.includes("figure") || v.includes("funko") || v.includes("pop culture")) return "POP_CULTURE";
  if (v.includes("sport") || v.includes("jersey") || v.includes("baseball") || v.includes("basketball") || v.includes("football")) return "SPORTS";
  if (v.includes("music") || v.includes("vinyl") || v.includes("record") || v.includes("album")) return "MUSIC";
  if (v.includes("game") || v.includes("console") || v.includes("nintendo") || v.includes("playstation") || v.includes("xbox")) return "GAMES";
  if (v.includes("auto") || v.includes("car") || v.includes("motorcycle") || v.includes("vehicle") || v.includes("gasoline") || v.includes("gears")) return "AUTOMOTIVE";
  if (v.includes("art") || v.includes("painting") || v.includes("sculpture") || v.includes("print")) return "ART";
  if (v.includes("jewel") || v.includes("watch") || v.includes("apparel") || v.includes("sneaker") || v.includes("streetwear")) return "JEWELRY_APPAREL";
  if (v.includes("plant") || v.includes("whisky") || v.includes("bourbon") || v.includes("botany") || v.includes("bar")) return "BUILT_BOTANY";
  return "";
}

function fuzzyPick(options: string[], text: string): string {
  const lower = String(text ?? "").toLowerCase().trim();
  if (!lower) return "";
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  return (
    options.find((o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase())) ?? ""
  );
}

export function matchVisionCategory(universe: UniverseKey, text: string): string {
  if (!universe) return "";
  return fuzzyPick(getCategories(universe), text);
}

export function matchVisionSubcategory(universe: UniverseKey, category: string, text: string): string {
  if (!universe || !category) return "";
  return fuzzyPick(getSubcategories(universe, category), text);
}

/** Resolve a full universe/category/subcategory triple from loose AI text. */
export function resolveVisionTaxonomy(input: {
  universe?: string;
  category?: string;
  subcategory?: string;
}): { universe: UniverseKey | ""; categoryLabel: string; subcategoryLabel: string } {
  const universe = matchVisionUniverse(input.universe ?? "");
  const categoryLabel = universe ? matchVisionCategory(universe, input.category ?? "") : "";
  const subcategoryLabel =
    universe && categoryLabel ? matchVisionSubcategory(universe, categoryLabel, input.subcategory ?? "") : "";
  return { universe, categoryLabel, subcategoryLabel };
}
