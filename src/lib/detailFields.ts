// Category-specific Details: which fields an item shows for its Universe / Category / Subcategory, and how their values are read and written.
//
// The field lists come from the reviewed research matrix (see scripts/build-detail-matrix.cjs and
// docs/design/category-details-research-2026-10-15/REVIEW.md). Rules that hold everywhere:
//  - every field is optional, and "unknown" is just empty (never 0, never "No");
//  - a field that points at an existing item field (watchBox, comicPublisher, year...) reads and writes that field, so
//    nothing already stored moves or is reinterpreted;
//  - every other field is kept in `item.specs`, keyed by a stable id;
//  - changing an item's category never removes a value: values for fields the new category does not list stay on the item and
//    show under "Other saved details".
import type { VaultItem } from "./vaultModel";
import {
  DETAIL_CATEGORY_ROWS,
  DETAIL_GENERIC_PROFILE,
  DETAIL_HINTS,
  DETAIL_LABELS,
  DETAIL_OPTION_SETS,
  DETAIL_PROFILES,
  DETAIL_ROWS,
  DETAIL_TARGETS,
  DETAIL_UNITS,
  type RawDetailField,
} from "./detailFieldMatrix.generated";
import { TAXONOMY, UNIVERSE_LABEL, isUniverseKey, type UniverseKey } from "./taxonomy";

export type DetailControl = "text" | "choice" | "yesno" | "multiline" | "year" | "date" | "integer" | "measure";

export type DetailField = {
  /** Existing item field name, or "s:<id>" for a value kept in `item.specs`. */
  target: string;
  /** The item field name when this field is stored on the item itself. */
  key?: keyof VaultItem;
  /** The id inside `item.specs` when this field is stored there. */
  specId?: string;
  label: string;
  control: DetailControl;
  options?: string[];
  hint?: string;
  unit?: string;
  primary: boolean;
  /** Existing yes/no fields hold true / false / nothing. */
  boolean: boolean;
};

export type DetailProfile = {
  primary: DetailField[];
  additional: DetailField[];
  all: DetailField[];
  source: "subcategory" | "category" | "generic";
  universe?: UniverseKey;
  category?: string;
  subcategory?: string;
};

const CONTROL: Record<string, DetailControl> = {
  t: "text",
  s: "choice",
  y: "yesno",
  m: "multiline",
  r: "year",
  d: "date",
  n: "integer",
  u: "measure",
};

// Existing item fields that hold true / false.
const BOOLEAN_KEYS = new Set<string>([
  "sportsIsRelic", "sportsIsAuto", "toyBoxIncluded", "toyAccessoriesIncluded", "toyIsComplete", "memorabiliaWitnessed", "memorabiliaGameUsed",
  "vinylInserts", "vinylGatefold", "artIsFramed", "artIsSigned", "watchBox", "watchPapers", "watchFullSet", "bagAuthCard", "bagDustbag", "bagBox",
  "apparelWorn", "coinKeyDate", "gameIsSealed", "gameIsCIB", "gameHasManual", "consoleCables", "consoleBox", "consoleTested",
]);

function decode(raw: RawDetailField): DetailField {
  const target = DETAIL_TARGETS[raw[0]];
  const isSpec = target.startsWith("s:");
  const optionsIndex = raw[3];
  const hintIndex = raw[5];
  const unitIndex = raw[6];
  const control = CONTROL[raw[2]] ?? "text";
  return {
    target,
    key: isSpec ? undefined : (target as keyof VaultItem),
    specId: isSpec ? target.slice(2) : undefined,
    label: DETAIL_LABELS[raw[1]],
    control,
    options: optionsIndex >= 0 ? DETAIL_OPTION_SETS[optionsIndex] : undefined,
    hint: hintIndex >= 0 ? DETAIL_HINTS[hintIndex] : undefined,
    unit: unitIndex >= 0 ? DETAIL_UNITS[unitIndex] : undefined,
    primary: raw[4] === 1,
    boolean: !isSpec && BOOLEAN_KEYS.has(target),
  };
}

const decodedProfiles = new Map<number, DetailField[]>();
function profileFields(index: number): DetailField[] {
  let hit = decodedProfiles.get(index);
  if (!hit) {
    hit = DETAIL_PROFILES[index].map(decode);
    decodedProfiles.set(index, hit);
  }
  return hit;
}

function toProfile(fields: DetailField[], source: DetailProfile["source"], where: Partial<DetailProfile>): DetailProfile {
  return {
    primary: fields.filter((f) => f.primary),
    additional: fields.filter((f) => !f.primary),
    all: fields,
    source,
    ...where,
  };
}

// ── Finding the profile ──────────────────────────────────────────────────────────────────────────────────────────────────
const norm = (text: unknown) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

// Names older items were saved with that the current taxonomy spells differently.
const CATEGORY_ALIASES: Array<{ category: string; universe?: UniverseKey; names: string[] }> = [
  { category: "Toys & Figures", universe: "POP_CULTURE", names: ["Toys", "Toys and Figures", "Action Figures"] },
  { category: "Bags & Luggage", universe: "JEWELRY_APPAREL", names: ["Bags", "Handbags"] },
  { category: "Collectors Choice", universe: "MISC", names: ["Collector's Choice", "Collectors' Choice", "COLLECTORS_CHOICE"] },
  { category: "Painting", universe: "ART", names: ["Art & Prints", "Art and Prints", "Fine Art"] },
];

type TaxonomyIndex = {
  categoryByUniverse: Map<string, Map<string, string>>;
  subByCategory: Map<string, Map<string, string>>;
  universesByCategory: Map<string, UniverseKey[]>;
};
let taxonomyIndex: TaxonomyIndex | null = null;
function indexTaxonomy(): TaxonomyIndex {
  if (taxonomyIndex) return taxonomyIndex;
  const categoryByUniverse = new Map<string, Map<string, string>>();
  const subByCategory = new Map<string, Map<string, string>>();
  const universesByCategory = new Map<string, UniverseKey[]>();
  for (const universe of Object.keys(TAXONOMY) as UniverseKey[]) {
    const categories = new Map<string, string>();
    for (const [category, subs] of Object.entries(TAXONOMY[universe])) {
      categories.set(norm(category), category);
      universesByCategory.set(norm(category), [...(universesByCategory.get(norm(category)) ?? []), universe]);
      const subMap = new Map<string, string>();
      for (const sub of subs) subMap.set(norm(sub), sub);
      subByCategory.set(`${universe}|${category}`, subMap);
    }
    for (const alias of CATEGORY_ALIASES) {
      if (alias.universe !== universe) continue;
      for (const name of alias.names) categories.set(norm(name), alias.category);
    }
    categoryByUniverse.set(universe, categories);
  }
  taxonomyIndex = { categoryByUniverse, subByCategory, universesByCategory };
  return taxonomyIndex;
}

function findUniverse(value: unknown): UniverseKey | undefined {
  const raw = String(value ?? "").trim().toUpperCase();
  if (isUniverseKey(raw)) return raw;
  const wanted = norm(value);
  if (!wanted) return undefined;
  for (const key of Object.keys(UNIVERSE_LABEL) as UniverseKey[]) {
    if (norm(UNIVERSE_LABEL[key]) === wanted) return key;
  }
  return undefined;
}

/** What taxonomy entry an item's saved names point to (null parts when they match nothing). */
export function matchTaxonomy(universe?: unknown, categoryLabel?: unknown, subcategoryLabel?: unknown) {
  const index = indexTaxonomy();
  let matchedUniverse = findUniverse(universe);
  const wantedCategory = norm(categoryLabel);
  let category: string | undefined;
  if (matchedUniverse && wantedCategory) category = index.categoryByUniverse.get(matchedUniverse)?.get(wantedCategory);
  if (!category && wantedCategory) {
    // The item's universe is missing or does not offer that category: a category name used by only one universe still identifies it.
    const owners = index.universesByCategory.get(wantedCategory);
    const aliasOwner = CATEGORY_ALIASES.find((a) => a.names.some((n) => norm(n) === wantedCategory));
    if (owners && owners.length === 1) {
      matchedUniverse = owners[0];
      category = index.categoryByUniverse.get(owners[0])?.get(wantedCategory);
    } else if (aliasOwner && aliasOwner.universe) {
      matchedUniverse = aliasOwner.universe;
      category = aliasOwner.category;
    }
  }
  const subcategory =
    matchedUniverse && category ? index.subByCategory.get(`${matchedUniverse}|${category}`)?.get(norm(subcategoryLabel)) : undefined;
  return { universe: matchedUniverse, category, subcategory };
}

/** The fields to show for an item in this place in the taxonomy. Falls back to the category's shared fields, then to a general set. */
export function resolveDetailProfile(universe?: unknown, categoryLabel?: unknown, subcategoryLabel?: unknown): DetailProfile {
  const hit = matchTaxonomy(universe, categoryLabel, subcategoryLabel);
  if (hit.universe && hit.category && hit.subcategory) {
    const index = DETAIL_ROWS[`${hit.universe}|${hit.category}|${hit.subcategory}`];
    if (index !== undefined) return toProfile(profileFields(index), "subcategory", hit);
  }
  if (hit.universe && hit.category) {
    const index = DETAIL_CATEGORY_ROWS[`${hit.universe}|${hit.category}`];
    if (index !== undefined) return toProfile(profileFields(index), "category", hit);
  }
  return toProfile(profileFields(DETAIL_GENERIC_PROFILE), "generic", hit);
}

export function resolveItemDetailProfile(item: Pick<VaultItem, "universe" | "categoryLabel" | "customCategoryLabel" | "subcategoryLabel">) {
  return resolveDetailProfile(item.universe, item.categoryLabel ?? item.customCategoryLabel, item.subcategoryLabel);
}

// ── Every field the app knows about (for values that no longer belong to the item's category) ────────────────────────────────
let libraryCache: Map<string, DetailField> | null = null;
export function detailFieldLibrary(): Map<string, DetailField> {
  if (libraryCache) return libraryCache;
  const library = new Map<string, DetailField>();
  for (let i = 0; i < DETAIL_PROFILES.length; i++) {
    for (const field of profileFields(i)) {
      if (!library.has(field.target)) library.set(field.target, { ...field, primary: false });
    }
  }
  libraryCache = library;
  return library;
}

// ── Values ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function itemSpecs(item: Pick<VaultItem, "specs">): Record<string, string> {
  return item.specs && typeof item.specs === "object" ? item.specs : {};
}

// The Add Item and Add manually forms record "Brand / Manufacturer / Publisher" in the general `brand` column. A category that has its own Brand row (toys, watches, handbags)
// reads that column when its own value is empty, so the brand typed on the form shows under "Brand" instead of under a Publisher / maker label. Nothing is copied or moved.
const OWN_BRAND_KEYS = new Set(["toyBrand", "watchBrand", "bagBrand"]);

/** The text form of a field's value for editing: "" when empty, "yes" / "no" for yes-no fields. */
export function readDetail(item: VaultItem, field: DetailField): string {
  if (field.specId) {
    const value = itemSpecs(item)[field.specId];
    return typeof value === "string" ? value : "";
  }
  let raw = (item as Record<string, unknown>)[field.key as string];
  if ((raw === undefined || raw === null || String(raw).trim() === "") && OWN_BRAND_KEYS.has(String(field.key))) raw = (item as Record<string, unknown>).brand;
  if (field.boolean) return raw === true ? "yes" : raw === false ? "no" : "";
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

export function hasDetailValue(item: VaultItem, field: DetailField) {
  return readDetail(item, field).trim() !== "";
}

/** What to show for a value that is read-only: yes-no words, the unit if the field has one, "—" when empty. */
export function displayDetail(item: VaultItem, field: DetailField): string {
  const value = readDetail(item, field).trim();
  if (!value) return "—";
  if (field.control === "yesno") return value === "yes" ? "Yes" : value === "no" ? "No" : value;
  return value;
}

/** Turns what was typed or chosen into the text that is kept. */
export function cleanDetailInput(field: DetailField, raw: string): string {
  let value = raw.replace(/\r\n/g, "\n");
  if (field.control === "integer") value = value.replace(/[^0-9]/g, "");
  if (field.control === "yesno") value = value === "yes" || value === "no" ? value : "";
  return field.control === "multiline" ? value.trim() : value.trim().replace(/\s+/g, " ");
}

/**
 * The change to save for one field. Only that field is touched: specs are merged into the ones already on the item, so editing one
 * never rewrites or drops another.
 */
export function detailPatch(item: VaultItem, field: DetailField, raw: string): Partial<VaultItem> {
  const value = cleanDetailInput(field, raw);
  if (field.specId) {
    const specs = { ...itemSpecs(item) };
    if (value) specs[field.specId] = value;
    else delete specs[field.specId];
    // An emptied set stays `{}` (not removed) so clearing the last value reaches the cloud too.
    return { specs };
  }
  const key = field.key as string;
  if (field.boolean) return { [key]: value === "yes" ? true : value === "no" ? false : undefined } as Partial<VaultItem>;
  // Clearing a category's own Brand row also clears the general brand it was showing, so a cleared value does not come straight back.
  if (!value && OWN_BRAND_KEYS.has(key)) return { [key]: undefined, brand: undefined } as Partial<VaultItem>;
  return { [key]: value || undefined } as Partial<VaultItem>;
}

/** Applies several edits to one item (each patch builds on the previous so specs edits merge). */
export function applyDetailEdits(item: VaultItem, edits: Array<{ field: DetailField; value: string }>): Partial<VaultItem> {
  let current = item;
  let patch: Partial<VaultItem> = {};
  for (const { field, value } of edits) {
    const next = detailPatch(current, field, value);
    patch = { ...patch, ...next };
    current = { ...current, ...next };
  }
  return patch;
}

/** A readable label for a stored spec id the app no longer lists anywhere. */
export function labelForSpecId(id: string) {
  const text = id.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : id;
}

/**
 * Saved values that belong to fields the item's current category does not list (it was moved, or the value came from an import).
 * They are shown, not discarded.
 */
export function otherSavedDetails(item: VaultItem, profile: DetailProfile): DetailField[] {
  const inProfile = new Set(profile.all.map((f) => f.target));
  const library = detailFieldLibrary();
  const found: DetailField[] = [];
  const profileShowsBrand = profile.all.some((f) => OWN_BRAND_KEYS.has(String(f.key)));
  for (const [target, field] of library) {
    if (inProfile.has(target)) continue;
    // The general brand is already shown on the category's own Brand row, so it is not listed twice.
    if (target === "brand" && profileShowsBrand) continue;
    if (hasDetailValue(item, field)) found.push(target === "brand" ? { ...field, label: "Brand / maker / publisher" } : field);
  }
  const specs = itemSpecs(item);
  for (const [id, value] of Object.entries(specs)) {
    const target = `s:${id}`;
    if (inProfile.has(target) || library.has(target)) continue;
    if (typeof value === "string" && value.trim()) {
      found.push({ target, specId: id, label: labelForSpecId(id), control: "text", primary: false, boolean: false });
    }
  }
  return found;
}

/** Wording for a field's empty editor placeholder. */
export function detailPlaceholder(field: DetailField) {
  if (field.hint) return field.hint;
  switch (field.control) {
    case "year":
      return "1998 or 1990s";
    case "date":
      return "1998, 1998-06 or 1998-06-14";
    case "measure":
      return field.unit ? `Number in ${field.unit}` : "Number and unit, e.g. 40 mm";
    case "integer":
      return "Number";
    default:
      return "";
  }
}
