import type { VaultItem } from "@/lib/vaultModel";
import type { UniverseKey } from "@/lib/taxonomy";

// One shared way to decide which universe an item belongs to. The Vault page and every
// universe page use this, so they can never disagree about where an item lives.

export function normalizeUniverseText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function directUniverseMatch(value: unknown): UniverseKey | "" {
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
  if (["automotive", "gears and gasoline", "gears gasoline", "cars", "car", "classic cars", "motorcycles", "motorcycle", "bicycles", "bicycle", "vehicle", "vehicles"].includes(text)) return "AUTOMOTIVE";
  if (["art", "painting", "paintings", "sculpture", "sculptures", "fine art", "prints", "original art"].includes(text)) return "ART";

  return "";
}
export function normalizeUniverse(value: unknown): UniverseKey {
  return directUniverseMatch(value) || "MISC";
}

export function inferVaultUniverse(item: VaultItem): UniverseKey {
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

export function universeForItem(item: VaultItem): UniverseKey {
  const rawUniverse = typeof item.universe === "string" ? item.universe.trim() : "";
  if (rawUniverse) return normalizeUniverse(rawUniverse);
  return inferVaultUniverse(item);
}

