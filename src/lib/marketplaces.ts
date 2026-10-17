// Which marketplaces make sense for an item. One list, used by the Cost to Sell panel and the Listing Copy chips.
//
// What was checked against each marketplace's own pages (October 2026):
//   Discogs        - only sells music releases that match an entry in its music database ("How To Sell Music On Discogs").
//   Fanatics Collect - Buy Now lists "sports cards, TCG, pop culture cards, comic books, memorabilia, and more".
//   eBay, Mercari, Whatnot - general marketplaces; every category is offered. Each one still has its own list of items it
//                    will not allow (firearms, alcohol, live plants...). That list was NOT audited here: check it before listing.
// "Custom" (your own fee percentage) is always available.

import { normalizeLabel } from "@/lib/taxonomy";

export type ItemPlace = {
  universe?: string;
  /** The category name, for example "Comics" (use resolveCategoryLabel). */
  category?: string;
  subcategory?: string;
};

const has = (value: string | undefined, pattern: RegExp) => pattern.test(normalizeLabel(value).toLowerCase());

/** Discogs: physical music releases (vinyl, CDs, cassettes...). Not instruments, posters, tickets or players. */
export function discogsFits(place: ItemPlace): boolean {
  return String(place.universe ?? "").toUpperCase() === "MUSIC" && has(place.category, /audio formats?|record|vinyl|music/) && !has(place.category, /player|instrument|print|ephemera/);
}

/** Fanatics Collect Buy Now: cards (sports, TCG, non-sport, art cards), comic books and memorabilia. */
export function fanaticsCollectFits(place: ItemPlace): boolean {
  const universe = String(place.universe ?? "").toUpperCase();
  const category = normalizeLabel(place.category).toLowerCase();
  if (universe === "SPORTS") return /card|memorabilia/.test(category);
  if (universe === "TCG") return !/accessor/.test(category);
  if (universe === "POP_CULTURE") return /^comics$|art cards/.test(category);
  if (universe === "ART") return /art cards/.test(category);
  return false;
}

export type MarketplaceId = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs";

/** The marketplaces to offer for this item, in display order. */
export function marketplacesFor(place: ItemPlace): MarketplaceId[] {
  const out: MarketplaceId[] = ["ebay", "mercari", "whatnot"];
  if (fanaticsCollectFits(place)) out.push("pwcc");
  if (discogsFits(place)) out.push("discogs");
  return out;
}

/** What to try first, and the one-line reason shown under the figures. */
export function marketplaceAdvice(place: ItemPlace): { suggested: MarketplaceId; note: string } {
  if (discogsFits(place)) return { suggested: "discogs", note: "Discogs is built for music releases, with eBay as a broader fallback." };
  const category = normalizeLabel(place.category).toLowerCase();
  if (fanaticsCollectFits(place)) {
    if (/comic/.test(category)) return { suggested: "ebay", note: "Comics usually start with eBay; Whatnot and Fanatics Collect also take comic books." };
    return { suggested: "ebay", note: "Cards usually start with eBay; Fanatics Collect can make sense for higher-end graded pieces." };
  }
  return { suggested: "ebay", note: "eBay is the broadest default; Mercari and Whatnot are also open to most categories." };
}
