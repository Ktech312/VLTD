// Shared hashtag suggestion engine — universe/category/title-keyword based.
// Originally lived only inside SocialExportSheet.tsx (suggestions for a
// social-media caption, computed fresh each time, never saved). Extracted
// here so the SAME suggestions can also become real, saved, searchable
// VaultItem.tags at creation time and in the item-page tag editor, instead
// of two drifting copies of "what hashtags fit this item."

import type { VaultItem } from "@/lib/vaultModel";

const UNIVERSE_TAGS: Record<string, string[]> = {
  POP_CULTURE:      ["collectibles", "popcollector", "comicbooks", "toycollector", "hobbylife"],
  SPORTS:           ["sportscards", "cardcollector", "hobbylife", "waxlife", "sportscard"],
  TCG:              ["tradingcards", "tcg", "cardcollector", "hobbylife", "pokemoncards"],
  MUSIC:            ["vinyl", "recordcollector", "vinylcollection", "audiophile", "musiccollector"],
  JEWELRY_APPAREL:  ["luxury", "watches", "streetwear", "luxurycollector", "fashioncollector"],
  GAMES:            ["gamecollector", "retrogaming", "videogames", "gamer", "sealedgames"],
  MISC:             ["collector", "rare", "vintage", "unique", "finds"],
};

const CATEGORY_TAGS: Record<string, string[]> = {
  "Comics":         ["comics", "comicbooks", "graphicnovel", "marvel", "dc"],
  "Toys":           ["toys", "actionfigures", "vintagetoys", "toycollector"],
  "Art Cards":      ["artcards", "sketchcard", "originalart"],
  "Sports Cards":   ["sportscards", "baseballcards", "basketballcards", "footballcards"],
  "Memorabilia":    ["memorabilia", "autograph", "signed", "gameworn"],
  "Pokemon":        ["pokemon", "pokemoncards", "pikachu", "pokemontcg"],
  "MTG":            ["mtg", "magicthegathering", "magic"],
  "Bo Jackson Arena": ["bojacksonarena", "bja", "tcg"],
  "Vinyl Records":  ["vinyl", "records", "lp", "vinylcollector"],
  "CDs":            ["cds", "albumcollector", "music"],
  "Instruments":    ["guitar", "instruments", "musician"],
  "Video Games":    ["videogames", "retrogames", "gamer", "sealedgames"],
  "Consoles":       ["gamecollector", "retroconsole", "Nintendo", "PlayStation"],
  "Watches":        ["watches", "watchcollector", "horology", "luxury"],
  "Bags":           ["luxurybags", "handbags", "fashioncollector"],
  "Apparel":        ["streetwear", "sneakers", "limitededition"],
  "Funko Pops":     ["funko", "funkopop", "funkoverse", "popcollector"],
};

const TITLE_KEYWORD_TAGS: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /spider.?man|spiderman/i,   tags: ["spiderman", "marvel", "marvelcomics"] },
  { pattern: /batman|bruce wayne/i,       tags: ["batman", "dc", "dccomics"] },
  { pattern: /superman/i,                 tags: ["superman", "dc", "dccomics"] },
  { pattern: /pokemon|pikachu|charizard/i,tags: ["pokemon", "pokemoncards"] },
  { pattern: /star.?wars/i,              tags: ["starwars", "maytheforcebewithyou"] },
  { pattern: /marvel/i,                  tags: ["marvel", "marvelcomics"] },
  { pattern: /michael jordan|mj\b/i,     tags: ["michaeljordan", "nba", "basketballcards"] },
  { pattern: /lebron/i,                  tags: ["lebron", "nba", "basketballcards"] },
  { pattern: /brady|tom brady/i,         tags: ["tombrady", "nfl", "footballcards"] },
  { pattern: /graded|psa|bgs|cgc/i,      tags: ["graded", "gradedcards", "slabs"] },
  { pattern: /rookie/i,                  tags: ["rookiecard", "rookie", "rc"] },
  { pattern: /1st edition|first edition/i,tags: ["firstedition", "1stedition", "vintage"] },
  { pattern: /gold|foil/i,               tags: ["gold", "foil", "premium"] },
  { pattern: /signed|autograph/i,        tags: ["autograph", "signed", "authenticated"] },
  { pattern: /sealed|unopened/i,         tags: ["sealed", "unopened", "waxlife"] },
  { pattern: /nintendo|mario|zelda/i,    tags: ["nintendo", "mario", "retrogaming"] },
  { pattern: /funko/i,                   tags: ["funko", "funkopop", "popcollector"] },
  { pattern: /vinyl|record|lp/i,         tags: ["vinyl", "recordcollector", "vinyljunkie"] },
];

const ALWAYS_TAGS = ["VLTD", "collector", "vault"];

export function generateHashtags(item: VaultItem): string[] {
  const tags = new Set<string>(ALWAYS_TAGS);
  const univKey = (item.universe ?? "").toUpperCase();
  (UNIVERSE_TAGS[univKey] ?? []).forEach((t) => tags.add(t));
  const cat = item.category ?? item.categoryLabel ?? "";
  (CATEGORY_TAGS[cat] ?? []).forEach((t) => tags.add(t));
  const titleStr = `${item.title} ${item.subtitle ?? ""}`;
  for (const { pattern, tags: kTags } of TITLE_KEYWORD_TAGS) {
    if (pattern.test(titleStr)) kTags.forEach((t) => tags.add(t));
  }
  if (item.grade) tags.add("graded");
  return Array.from(tags).slice(0, 15);
}

/** A short, high-confidence subset (universe + category + keyword matches,
 *  NOT the generic ALWAYS_TAGS) -- what auto-tagging on save actually
 *  writes as real VaultItem.tags, so every item doesn't just get the same
 *  3 boilerplate tags. Caller can always add more via the tag editor. */
export function suggestAutoTags(item: VaultItem, max = 5): string[] {
  return generateHashtags(item)
    .filter((t) => !["VLTD", "collector", "vault"].includes(t))
    .slice(0, max);
}
