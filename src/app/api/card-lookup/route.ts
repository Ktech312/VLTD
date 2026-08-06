import { NextRequest, NextResponse } from "next/server";

/** Real-database card identification for TCG singles — the "Cards" analog of
 *  /api/comic-lookup (Metron/GCD for comics). Scans a card's printed
 *  title/collector-number (OCR, see src/lib/scanners/tcgCardParser.ts) and
 *  looks it up against the actual public card database for that game so the
 *  result is real data (official name/set/rarity/price), not a guess.
 *
 *  Two games are wired so far — the two with a free, keyless public API:
 *  - Magic: The Gathering → Scryfall (api.scryfall.com, no key required).
 *  - Pokemon → the Pokemon TCG API (api.pokemontcg.io, works without a key
 *    at a lower rate limit; set POKEMONTCG_API_KEY to raise it).
 *  Yu-Gi-Oh/Lorcana/One Piece/etc. aren't covered yet — no equivalent free
 *  API was wired in for them, so those still fall back to generic OCR.
 */

export type CardLookupResult = {
  game: "mtg" | "pokemon";
  name: string;
  setName: string;
  setCode?: string;
  number: string;
  rarity?: string;
  typeLine?: string;
  imageUrl?: string;
  priceUsd?: string;
  sourceUrl: string;
};

type ScryfallCard = {
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity?: string;
  type_line?: string;
  scryfall_uri: string;
  image_uris?: { normal?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; small?: string } }>;
  prices?: { usd?: string | null; usd_foil?: string | null };
};

function normalizeScryfallCard(card: ScryfallCard): CardLookupResult {
  const imageUrl =
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    undefined;

  return {
    game: "mtg",
    name: card.name,
    setName: card.set_name,
    setCode: card.set?.toUpperCase(),
    number: card.collector_number,
    rarity: card.rarity,
    typeLine: card.type_line,
    imageUrl,
    priceUsd: card.prices?.usd ?? card.prices?.usd_foil ?? undefined,
    sourceUrl: card.scryfall_uri,
  };
}

async function lookupMtg(
  opts: { set?: string; number?: string; name?: string },
  signal: AbortSignal
): Promise<CardLookupResult | null> {
  const set = opts.set?.trim().toLowerCase();
  const number = opts.number?.trim();

  if (set && number) {
    const res = await fetch(
      `https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`,
      { signal, next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const card = (await res.json()) as ScryfallCard;
      return normalizeScryfallCard(card);
    }
    // A bad set/number OCR guess is common — fall through to name search below.
  }

  if (opts.name?.trim()) {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(opts.name.trim())}`,
      { signal, next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const card = (await res.json()) as ScryfallCard;
      return normalizeScryfallCard(card);
    }
  }

  return null;
}

type PokemonCard = {
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  set: { name: string; id: string };
  images?: { large?: string; small?: string };
  tcgplayer?: { url?: string; prices?: Record<string, { market?: number | null }> };
};

function normalizePokemonCard(card: PokemonCard): CardLookupResult {
  const priceEntry = card.tcgplayer?.prices
    ? Object.values(card.tcgplayer.prices).find((v) => typeof v?.market === "number")
    : undefined;

  return {
    game: "pokemon",
    name: card.name,
    setName: card.set?.name ?? "",
    setCode: card.set?.id?.toUpperCase(),
    number: card.number,
    rarity: card.rarity,
    typeLine: card.supertype,
    imageUrl: card.images?.large ?? card.images?.small ?? undefined,
    priceUsd: priceEntry?.market != null ? priceEntry.market.toFixed(2) : undefined,
    sourceUrl: card.tcgplayer?.url ?? `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/${card.set?.id}/`,
  };
}

async function lookupPokemon(
  opts: { name?: string; number?: string },
  signal: AbortSignal
): Promise<CardLookupResult | null> {
  const name = opts.name?.trim();
  if (!name) return null;

  const clauses = [`name:"${name.replace(/"/g, "")}"`];
  if (opts.number?.trim()) clauses.push(`number:${opts.number.trim()}`);

  const headers: Record<string, string> = {};
  const apiKey = process.env.POKEMONTCG_API_KEY?.trim();
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const params = new URLSearchParams({ q: clauses.join(" "), pageSize: "5" });
  let res = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    signal,
    headers,
    next: { revalidate: 3600 },
  });

  // A wrong OCR'd number can filter out the real match — retry name-only.
  if (res.ok) {
    const data = (await res.json()) as { data?: PokemonCard[] };
    if (data.data?.length) return normalizePokemonCard(data.data[0]);
  }

  if (opts.number?.trim()) {
    const nameOnlyParams = new URLSearchParams({ q: clauses[0], pageSize: "5" });
    res = await fetch(`https://api.pokemontcg.io/v2/cards?${nameOnlyParams}`, {
      signal,
      headers,
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: PokemonCard[] };
      if (data.data?.length) return normalizePokemonCard(data.data[0]);
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game")?.trim().toLowerCase();
  const set = searchParams.get("set") ?? undefined;
  const number = searchParams.get("number") ?? undefined;
  const name = searchParams.get("name") ?? undefined;

  if (game !== "mtg" && game !== "pokemon") {
    return NextResponse.json({ error: "Provide ?game=mtg or ?game=pokemon" }, { status: 400 });
  }
  if (!name && !(set && number)) {
    return NextResponse.json(
      { error: "Provide ?name=... and/or ?set=...&number=..." },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const result =
      game === "mtg"
        ? await lookupMtg({ set, number, name }, controller.signal)
        : await lookupPokemon({ name, number }, controller.signal);

    clearTimeout(timeout);

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Card lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Card database timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
