import type { CardLookupResult } from "@/app/api/card-lookup/route";

export type { CardLookupResult };

async function fetchCardLookup(params: URLSearchParams): Promise<CardLookupResult | null> {
  const res = await fetch(`/api/card-lookup?${params}`);
  if (!res.ok) return null;

  const payload = (await res.json()) as { result?: CardLookupResult | null; error?: string };
  return payload.result ?? null;
}

/** Magic: The Gathering, via Scryfall. Pass set+number for an exact printing
 *  (e.g. set="MOM", number="94"); falls back to a fuzzy name match server-side
 *  if that specific printing isn't found. */
export async function lookupMtgCard(opts: {
  set?: string;
  number?: string;
  name?: string;
}): Promise<CardLookupResult | null> {
  const params = new URLSearchParams({ game: "mtg" });
  if (opts.set) params.set("set", opts.set);
  if (opts.number) params.set("number", opts.number);
  if (opts.name) params.set("name", opts.name);
  if (!opts.set && !opts.number && !opts.name) return null;

  return fetchCardLookup(params);
}

/** Pokemon, via the Pokemon TCG API. Name is required (Pokemon prints a set
 *  symbol, not a text set code, so we can't OCR a set to search by); number
 *  narrows the match when both a name and a collector number were read. */
export async function lookupPokemonCard(opts: {
  name?: string;
  number?: string;
}): Promise<CardLookupResult | null> {
  if (!opts.name?.trim()) return null;

  const params = new URLSearchParams({ game: "pokemon", name: opts.name });
  if (opts.number) params.set("number", opts.number);

  return fetchCardLookup(params);
}
