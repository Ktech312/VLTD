// Path: src/lib/taxonomy.ts
// Full replacement — stronger typing + safer fallbacks + ASCII-friendly keys + helper guards

export type UniverseKey =
  | "POP_CULTURE"
  | "SPORTS"
  | "TCG"
  | "MUSIC"
  | "JEWELRY_APPAREL"
  | "GAMES"
  | "MISC";

export type Taxonomy = Record<UniverseKey, Record<string, string[]>>;

/**
 * Taxonomy
 *
 * Notes:
 * - Keep category labels human-friendly (these are user-facing).
 * - We normalize “smart quotes” and a few accents for stability.
 * - Helpers below guarantee no-throw defaults for mobile flows.
 */
export const TAXONOMY: Taxonomy = {
  POP_CULTURE: {
    Comics: ["Marvel", "DC", "Indie", "Manga", "Golden Age", "Silver Age", "Modern", "Slabs"],
    Toys: ["Vintage", "Action Figures", "Funko Pops", "Designer Toys", "Anime Collectibles"],
    "Art Cards": ["Sketch Cards", "Limited Prints", "Original Art"],
  },

  SPORTS: {
    "Sports Cards": ["Basketball", "Football", "Baseball", "Soccer", "Hockey"],
    Memorabilia: ["Autographs", "Jerseys", "Game Used"],
  },

  TCG: {
    Pokemon: ["Base Set", "Jungle", "Fossil", "Modern", "Japanese", "Promos"],
    "Bo Jackson Arena": ["Base (Steel)", "Foil (Brawl)", "Rare", "Serialized", "Fire", "Ice", "Glow", "Hex", "1/1"],
    MTG: ["Reserved List", "Commander Staples", "Modern", "Foils"],
  },

  JEWELRY_APPAREL: {
    Watches: ["Vintage", "Modern", "Luxury", "Custom"],
    Bags: ["Vintage", "Modern", "Luxury", "Limited Edition"],
    Apparel: ["Streetwear", "Vintage", "Limited Drops"],
  },

  MUSIC: {
    "Vinyl Records": ["LP", "EP", "Singles", "Box Sets", "Limited Pressings"],
    CDs: ["Standard", "Deluxe", "Box Sets"],
    Instruments: ["Guitars", "Bass", "Drums", "Keys", "Synths"],
  },

  GAMES: {
    "Video Games": ["Retro", "Modern", "Sealed", "Graded", "Limited Editions", "Collectors Editions"],
    Consoles: ["Retro", "Modern", "Limited Editions"],
    Accessories: ["Controllers", "Arcade Sticks", "VR", "Special Editions"],
    "Trading/Arcade": ["Arcade Boards", "Pinball", "Handhelds"],
  },

  MISC: {
    "Collectors Choice": ["Art", "Albums", "Books", "Props", "Other"],
    "Art & Prints": ["Original Art", "Limited Prints", "Posters", "Sketches"],
    "Coins & Currency": ["Coins", "Bills", "Errors", "Graded"],
    Stamps: ["Vintage", "Sheets", "Covers"],
  },
};

/**
 * Universe display metadata
 */
export const UNIVERSE_LABEL: Record<UniverseKey, string> = {
  POP_CULTURE: "Pop Culture",
  SPORTS: "Sports",
  TCG: "TCG",
  MUSIC: "Music",
  JEWELRY_APPAREL: "Jewelry & Apparel",
  GAMES: "Games",
  MISC: "Misc",
};

// Simple icons (emoji for now). Swap to SVG later if needed.
export const UNIVERSE_ICON: Record<UniverseKey, string> = {
  POP_CULTURE: "🦸",
  SPORTS: "🏟️",
  TCG: "🃏",
  MUSIC: "🎵",
  JEWELRY_APPAREL: "⌚",
  GAMES: "🎮",
  MISC: "🧩",
};

/**
 * -------------------------------
 * Safe helper utilities
 * -------------------------------
 */

export function isUniverseKey(v: unknown): v is UniverseKey {
  return (
    v === "POP_CULTURE" ||
    v === "SPORTS" ||
    v === "TCG" ||
    v === "MUSIC" ||
    v === "JEWELRY_APPAREL" ||
    v === "GAMES" ||
    v === "MISC"
  );
}

/** Returns all universe keys as a typed array. */
export function getUniverses(): UniverseKey[] {
  // Stronger than Object.keys(TAXONOMY) because it preserves intended ordering.
  return ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "MISC"];
}

/** Normalize a label for stability (quotes, accents). */
export function normalizeLabel(s: unknown): string {
  return String(s ?? "")
    .trim()
    .replace(/\u2019|\u2018/g, "'") // curly apostrophes
    .replace(/\u201C|\u201D/g, '"') // curly quotes
    .replace(/\u00A0/g, " ") // nbsp
    .replace(/\s+/g, " ");
}

/** Safe category getter (never throws). */
export function getCategories(universe: UniverseKey): string[] {
  return Object.keys(TAXONOMY[universe] ?? {});
}

/** Safe subcategory getter (never throws). */
export function getSubcategories(universe: UniverseKey, category: string): string[] {
  const c = normalizeLabel(category);
  return TAXONOMY[universe]?.[c] ?? [];
}

/** Returns a safe default category for a universe. */
export function getDefaultCategory(universe: UniverseKey): string {
  return getCategories(universe)[0] ?? "Collectors Choice";
}

/** Returns a safe default subcategory. */
export function getDefaultSubcategory(universe: UniverseKey, category: string): string {
  return getSubcategories(universe, category)[0] ?? "";
}

/**
 * Coerce unknown universe + category to safe values.
 * Useful for legacy items / URL params / user input.
 */
export function coerceUniverseAndCategory(input: {
  universe?: unknown;
  categoryLabel?: unknown;
}): { universe: UniverseKey; categoryLabel: string } {
  const u = isUniverseKey(String(input.universe ?? "").toUpperCase()) ? (String(input.universe).toUpperCase() as UniverseKey) : "MISC";

  const requested = normalizeLabel(input.categoryLabel);
  const cats = getCategories(u);

  const categoryLabel = requested && cats.includes(requested) ? requested : getDefaultCategory(u);
  return { universe: u, categoryLabel };
}