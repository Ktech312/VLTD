// Cross-category vault search — the engine behind /vault/halls' "build a
// hall from search terms" flow.
//
// EK's spec: type a term ("Marvel"), matching items show up, all selected
// by default. Type a SECOND term ("Spiderman") and items matching THAT term
// get ADDED to the result set too, even if they weren't tagged Marvel --
// each term is an independent OR match, not a narrowing AND filter. Matches
// against title, subtitle, subject, category/universe, every
// manufacturer/brand-ish field across every universe (comics publisher, toy
// brand, vinyl label, watch brand, sports team, etc.), and tags -- so it
// works for Music/instruments/plants/bar items/anything, not just
// pop-culture franchises. Also needs to treat "Spider-Man"/"Spider Man"/
// "Spiderman" as the same term.
//
// Universe/Category are a separate AND filter on top of the OR'd terms
// (narrows the result set further, doesn't add to it).

import { UNIVERSE_LABEL } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

/** Strips everything but letters/digits and lowercases, so "Spider-Man",
 *  "Spider Man", and "Spiderman" all normalize to the same token. This is
 *  deliberately aggressive (also merges e.g. "X-Men"/"Xmen") -- for a
 *  personal-vault search over a few hundred items, false-positive matches
 *  cost nothing (item stays selected, user can deselect); a missed match
 *  costs a franchise not showing up at all, which is the worse failure. */
export function normalizeSearchToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Every text-ish field worth searching, across every universe. Deliberately
 *  broad -- a generic search has to cover Music/instruments/plants/bar
 *  items/etc, not just the pop-culture-heavy fields. */
function searchableFields(item: VaultItem): string[] {
  return [
    item.title,
    item.subtitle,
    item.subject,
    item.categoryLabel,
    item.category,
    item.customCategoryLabel,
    item.subcategoryLabel,
    item.universe ? UNIVERSE_LABEL[item.universe as keyof typeof UNIVERSE_LABEL] : undefined,
    item.notes,
    item.storageLocation,
    item.edition,
    item.variant,
    item.itemType,
    // Manufacturer/brand-ish fields, one per universe -- this is the part
    // that makes it work for everything, not just comics/toys/anime.
    item.comicPublisher,
    item.toyBrand,
    item.toyLine,
    item.vinylLabel,
    item.watchBrand,
    item.bagBrand,
    item.sportsTeam,
    item.sportsSport,
    item.gamePublisher,
    item.artCardArtist,
    item.coinCountry,
    item.coinMint,
    item.memorabiliaTeam,
    ...(item.tags ?? []),
    ...(item.itemAttributes ?? []),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Cache the normalized corpus per item for the duration of one search call
 *  (rebuilt fresh each call -- vaults are small enough this is cheap, and it
 *  avoids stale-corpus bugs if an item's fields changed between searches). */
function buildCorpus(item: VaultItem): string {
  return normalizeSearchToken(searchableFields(item).join(" "));
}

export type VaultSearchFilters = {
  universe?: string;
  categoryLabel?: string;
};

export type VaultSearchTermResult = {
  term: string;
  matchedItemIds: Set<string>;
};

/** Runs each term independently against the vault and returns which items
 *  each term matched (OR semantics live in the caller: union the sets).
 *  Universe/Category filters are applied here as an AND on top of every
 *  term, since they narrow rather than add. */
export function searchVaultItemsByTerms(
  items: VaultItem[],
  terms: string[],
  filters: VaultSearchFilters = {}
): VaultSearchTermResult[] {
  const filtered = items.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) return false;
    if (filters.categoryLabel && item.categoryLabel !== filters.categoryLabel) return false;
    return true;
  });

  const corpusByItem = new Map<string, string>();
  for (const item of filtered) corpusByItem.set(item.id, buildCorpus(item));

  return terms.map((term) => {
    const needle = normalizeSearchToken(term);
    const matchedItemIds = new Set<string>();
    if (needle) {
      for (const item of filtered) {
        if (corpusByItem.get(item.id)?.includes(needle)) matchedItemIds.add(item.id);
      }
    }
    return { term, matchedItemIds };
  });
}

/** Convenience wrapper: union of every term's matches (the actual OR
 *  result set), plus a per-item map of which terms matched it (so the UI
 *  can show "matched: Marvel, Spiderman" chips on a result). */
export function searchVaultItems(
  items: VaultItem[],
  terms: string[],
  filters: VaultSearchFilters = {}
): { results: VaultItem[]; matchedTermsByItemId: Map<string, string[]> } {
  const perTerm = searchVaultItemsByTerms(items, terms, filters);
  const matchedTermsByItemId = new Map<string, string[]>();

  for (const { term, matchedItemIds } of perTerm) {
    for (const id of matchedItemIds) {
      const existing = matchedTermsByItemId.get(id);
      if (existing) existing.push(term);
      else matchedTermsByItemId.set(id, [term]);
    }
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const results = [...matchedTermsByItemId.keys()]
    .map((id) => byId.get(id))
    .filter((item): item is VaultItem => Boolean(item));

  return { results, matchedTermsByItemId };
}
