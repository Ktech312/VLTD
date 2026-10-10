export type PriceConfidence = "low" | "medium" | "high";

export type PriceComparable = {
  source: string;
  salePrice: number;
  saleDate?: string;
  condition?: string;
  url?: string;
  thumbnailUrl?: string;
  notes?: string;
};

export type PricingSource = {
  platform: string;
  value: number;
  confidence: PriceConfidence;
  fetchedAt?: number;
  notes?: string;
};

export type PricingMvpFields = {
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceUpdatedAt?: number;
  priceNotes?: string;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  priceSources?: PricingSource[];
  comparables?: PriceComparable[];
};

export function parsePriceInput(input: string): number | undefined {
  const cleaned = String(input ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

export function formatPrice(value?: number): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceUpdatedAt(value?: number): string {
  if (!value || !Number.isFinite(value)) return "—";

  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function normalizePriceConfidence(value?: string): PriceConfidence | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

export function confidenceTone(value?: PriceConfidence): string {
  if (value === "high") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  if (value === "medium") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  if (value === "low") return "bg-red-500/15 text-red-200 ring-red-400/20";
  return "bg-white/10 text-white/70 ring-white/10";
}

export function confidenceLabel(value?: PriceConfidence): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Unknown";
}

export function hasPricingData(input: PricingMvpFields): boolean {
  return (
    (typeof input.estimatedValue === "number" && Number.isFinite(input.estimatedValue)) ||
    (typeof input.lastCompValue === "number" && Number.isFinite(input.lastCompValue)) ||
    (typeof input.valueLow === "number" && Number.isFinite(input.valueLow)) ||
    (typeof input.valueMedian === "number" && Number.isFinite(input.valueMedian)) ||
    (typeof input.valueHigh === "number" && Number.isFinite(input.valueHigh)) ||
    (Array.isArray(input.priceSources) && input.priceSources.length > 0) ||
    (Array.isArray(input.comparables) && input.comparables.length > 0) ||
    Boolean(String(input.priceSource ?? "").trim()) ||
    Boolean(input.priceConfidence) ||
    Boolean(String(input.priceNotes ?? "").trim())
  );
}

export function buildPricingPatch(input: {
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceNotes?: string;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  priceSources?: PricingSource[];
  comparables?: PriceComparable[];
}): PricingMvpFields {
  const hasMeaningfulValue = hasPricingData(input);

  return {
    estimatedValue: input.estimatedValue,
    lastCompValue: input.lastCompValue,
    priceSource: String(input.priceSource ?? "").trim() || undefined,
    priceConfidence: input.priceConfidence,
    priceUpdatedAt: hasMeaningfulValue ? Date.now() : undefined,
    priceNotes: String(input.priceNotes ?? "").trim() || undefined,
    valueLow: input.valueLow,
    valueMedian: input.valueMedian,
    valueHigh: input.valueHigh,
    priceSources: normalizePriceSources(input.priceSources),
    comparables: normalizeComparables(input.comparables),
  };
}

export type MarketplaceSuggestion = {
  platform: string;
  url: string;
  searchHint: string;
  note: string;
};

export function getPricingSuggestions(
  universe: string,
  categoryLabel: string,
  grade?: string,
  title?: string
): MarketplaceSuggestion[] {
  const u = (universe ?? "").toUpperCase();
  const c = (categoryLabel ?? "").toLowerCase();
  const isSlabbed = /psa|bgs|cgc|beckett|slab/i.test(grade ?? "");
  const cleanTitle = String(title ?? "").trim();
  const searchQuery = encodeURIComponent(`${cleanTitle} ${grade ?? ""}`.trim());

  const ebay: MarketplaceSuggestion = {
    platform: "eBay Sold Listings",
    url: `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&LH_Sold=1&LH_Complete=1`,
    searchHint: `"${cleanTitle}" ${grade ?? ""}`.trim(),
    note: "Best volume; use Completed Listings filter.",
  };

  if (u === "SPORTS" || u === "TCG") {
    if (isSlabbed) {
      return [
        ebay,
        {
          platform: "PWCC Marketplace",
          url: `https://www.pwccmarketplace.com/search?q=${searchQuery}`,
          searchHint: `${cleanTitle} ${grade ?? ""}`.trim(),
          note: "Strong source for graded card auction comps.",
        },
        {
          platform: "MySlabs",
          url: "https://www.myslabs.com/",
          searchHint: "Search by cert number for exact grade history.",
          note: "Useful for graded slab transaction context.",
        },
      ];
    }

    return [
      ebay,
      {
        platform: "130point",
        url: "https://www.130point.com/sales/",
        searchHint: cleanTitle,
        note: "Aggregated sold data, helpful for raw cards.",
      },
    ];
  }

  if (u === "MUSIC" || c.includes("vinyl") || c.includes("record")) {
    return [
      ebay,
      {
        platform: "Discogs",
        url: `https://www.discogs.com/search/?q=${searchQuery}&type=all&format=Vinyl`,
        searchHint: cleanTitle,
        note: "Primary vinyl source; check sales history on the release page.",
      },
    ];
  }

  if (u === "POP_CULTURE" && c.includes("comic")) {
    return [
      ebay,
      {
        platform: "MyComicShop",
        url: `https://www.mycomicshop.com/search?q=${searchQuery}`,
        searchHint: cleanTitle,
        note: "Good for raw comics and dealer price context.",
      },
      {
        platform: "CovrPrice",
        url: "https://covrprice.com/",
        searchHint: cleanTitle,
        note: "Comic-focused comparable sales and FMV ranges.",
      },
    ];
  }

  if (u === "GAMES") {
    return [
      ebay,
      {
        platform: "PriceCharting",
        url: `https://www.pricecharting.com/search-products?q=${searchQuery}`,
        searchHint: cleanTitle,
        note: "Best quick reference for loose, CIB, and sealed tiers.",
      },
    ];
  }

  return [ebay];
}

export function effectiveValueRange(fields: PricingMvpFields): {
  low?: number;
  median?: number;
  high?: number;
} {
  if (
    fields.valueLow !== undefined ||
    fields.valueMedian !== undefined ||
    fields.valueHigh !== undefined
  ) {
    return {
      low: fields.valueLow,
      median: fields.valueMedian,
      high: fields.valueHigh,
    };
  }

  const single = fields.estimatedValue ?? fields.lastCompValue;
  return single !== undefined ? { median: single } : {};
}

export function displayPrimaryValue(fields: PricingMvpFields): number | undefined {
  return fields.valueMedian ?? fields.estimatedValue ?? fields.lastCompValue;
}

export function normalizePriceSources(value: unknown): PricingSource[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.filter((source): source is PricingSource => {
    if (!source || typeof source !== "object") return false;
    const record = source as Record<string, unknown>;
    return (
      typeof record.platform === "string" &&
      typeof record.value === "number" &&
      Number.isFinite(record.value)
    );
  });
  return sources.length ? sources : undefined;
}

export function normalizeComparables(value: unknown): PriceComparable[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const comparables = value.flatMap((comp) => {
    if (!comp || typeof comp !== "object") return [];
    const record = comp as Record<string, unknown>;
    const source = String(record.source ?? "").trim();
    const salePrice = Number(record.salePrice);
    if (!source || !Number.isFinite(salePrice) || salePrice <= 0) return [];

    return [{
      source,
      salePrice,
      saleDate: String(record.saleDate ?? "").trim() || undefined,
      condition: String(record.condition ?? "").trim() || undefined,
      url: String(record.url ?? "").trim() || undefined,
      thumbnailUrl: String(record.thumbnailUrl ?? "").trim() || undefined,
      notes: String(record.notes ?? "").trim() || undefined,
    }];
  });
  return comparables.length ? comparables : undefined;
}

export function effectivePricingValue(
  input: Pick<PricingMvpFields, "estimatedValue" | "lastCompValue" | "valueMedian">
): number | undefined {
  if (typeof input.valueMedian === "number" && Number.isFinite(input.valueMedian)) return input.valueMedian;
  if (typeof input.estimatedValue === "number" && Number.isFinite(input.estimatedValue)) return input.estimatedValue;
  if (typeof input.lastCompValue === "number" && Number.isFinite(input.lastCompValue)) return input.lastCompValue;
  return undefined;
}

// ── Search sites ──────────────────────────────────────────────────────────────
// Links only: each one opens a search in the user's own browser. VLTD never fetches these pages itself.

export type SearchSite = {
  id: string;
  label: string;
  /** Builds the search link for an item. */
  url: (query: string) => string;
  note: string;
};

export const SEARCH_SITES: SearchSite[] = [
  { id: "ebay-sold", label: "eBay sold", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`, note: "Completed and sold listings." },
  { id: "google", label: "Google", url: (q) => `https://www.google.com/search?q=${q}+sold+price`, note: "A general search for sold prices." },
  { id: "google-shopping", label: "Google Shopping", url: (q) => `https://www.google.com/search?tbm=shop&q=${q}`, note: "Current prices from many shops." },
  { id: "bing", label: "Bing", url: (q) => `https://www.bing.com/search?q=${q}+sold+price`, note: "A general search for sold prices." },
  { id: "duckduckgo", label: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${q}+sold+price`, note: "A general search for sold prices." },
  { id: "heritage", label: "Heritage Auctions", url: (q) => `https://www.ha.com/c/search-results.zx?Ntt=${q}`, note: "Auction results for higher-end items." },
  { id: "mercari-sold", label: "Mercari sold", url: (q) => `https://www.mercari.com/search/?keyword=${q}&status=sold_out`, note: "Sold listings on Mercari." },
  { id: "tcgplayer", label: "TCGplayer", url: (q) => `https://www.tcgplayer.com/search/all/product?q=${q}`, note: "Trading card market prices." },
  { id: "pricecharting", label: "PriceCharting", url: (q) => `https://www.pricecharting.com/search-products?q=${q}`, note: "Games, cards and comics price guide." },
  { id: "discogs", label: "Discogs", url: (q) => `https://www.discogs.com/search/?q=${q}&type=all`, note: "Vinyl and music; check sales history on the release page." },
  { id: "mycomicshop", label: "MyComicShop", url: (q) => `https://www.mycomicshop.com/search?q=${q}`, note: "Comic dealer prices." },
  { id: "130point", label: "130point", url: () => "https://www.130point.com/sales/", note: "Sold card sales." },
  { id: "worthpoint", label: "WorthPoint", url: (q) => `https://www.worthpoint.com/search?query=${q}`, note: "Past sale prices (some need an account)." },
];

export type CustomSearchSite = { label: string; /** Use {query} where the item's name goes. */ url: string };
export type SearchSitePrefs = { ids: string[]; custom: CustomSearchSite[] };

export function searchQueryFor(title?: string, grade?: string) {
  return encodeURIComponent(`${String(title ?? "").trim()} ${grade ?? ""}`.trim());
}

/** The links to show: the user's own choice if they made one, otherwise the sensible defaults for the item. */
export function resolveSearchLinks(
  defaults: MarketplaceSuggestion[],
  prefs: SearchSitePrefs | null,
  title?: string,
  grade?: string
): { key: string; label: string; url: string; note: string }[] {
  const q = searchQueryFor(title, grade);
  if (!prefs || (prefs.ids.length === 0 && prefs.custom.length === 0)) {
    const base = defaults.map((d) => ({ key: d.platform, label: d.platform, url: d.url, note: d.note }));
    const google = SEARCH_SITES.find((site) => site.id === "google");
    if (google && !base.some((b) => /google/i.test(b.label))) base.push({ key: "google", label: google.label, url: google.url(q), note: google.note });
    return base;
  }
  const picked = SEARCH_SITES.filter((site) => prefs.ids.includes(site.id)).map((site) => ({ key: site.id, label: site.label, url: site.url(q), note: site.note }));
  const custom = prefs.custom
    .filter((c) => c.label.trim() && /^https?:\/\//i.test(c.url.trim()))
    .map((c, i) => ({ key: `custom-${i}`, label: c.label.trim(), url: c.url.trim().split("{query}").join(q), note: "Your own search site." }));
  return [...picked, ...custom];
}

// ── Paste sold results ───────────────────────────────────────────────────────
// The user copies a sold-listings page (eBay, Discogs and similar) and pastes the text. Only what they paste is read.

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December";
const DATE_WORDS = new RegExp(`((?:${MONTHS})\\.?\\s+\\d{1,2},?\\s+\\d{4})`, "i");
const DATE_SLASH = /(\d{1,2}\/\d{1,2}\/\d{2,4})/;
const DATE_ISO = /(\d{4}-\d{2}-\d{2})/;
const PRICE_ALONE = /^(?:US\s*)?\$\s?([\d,]+(?:\.\d{1,2})?)(?:\s*(?:to|-)\s*\$\s?[\d,.]+)?(?:\s*(?:or Best Offer|Buy It Now|Best offer accepted|Best Offer Accepted))?\s*$/i;
const PRICE_ANY = /\$\s?([\d,]+(?:\.\d{1,2})?)/;
const CONDITION_LINE = /^(Brand New|New|New with tags|Pre-Owned|Used|Open Box|Like New|Very Good|Good|Acceptable|Mint|Near Mint|Sealed|Graded|Not Specified)\b/i;
const SKIP_LINE = /^(\+|Free |or Best Offer|Buy It Now|Located in|View similar|Sell one like|Accepts offers|Sponsored|Opens in|Save|Last one|\d+ (watchers|sold)|Results matching|No exact matches)/i;

export type PastedComp = PriceComparable & { id: string };

function toMoney(text: string): number | undefined {
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function tidyDate(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\.(?=\s)/, "").trim();
}

export function parsePastedSoldResults(text: string, source: string): PastedComp[] {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out: PastedComp[] = [];
  const seen = new Set<string>();
  const push = (price: number | undefined, date: string | undefined, title: string | undefined, condition: string | undefined) => {
    if (!price) return;
    const key = `${price}|${date ?? ""}|${(title ?? "").slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `paste_${out.length}`,
      source,
      salePrice: price,
      saleDate: date,
      condition,
      notes: title ? title.slice(0, 120) : undefined,
    });
  };

  // eBay style: "Sold Aug 20, 2026", then the title, a condition line, then the price on its own line.
  for (let i = 0; i < lines.length; i += 1) {
    const sold = lines[i].match(/^(?:Sold|Ended)(?:\s+on)?\s+(.+)$/i);
    const dateMatch = sold ? sold[1].match(DATE_WORDS) || sold[1].match(DATE_SLASH) || sold[1].match(DATE_ISO) : null;
    if (!sold || !dateMatch) continue;
    const date = tidyDate(dateMatch[1]);
    let title: string | undefined;
    let condition: string | undefined;
    let price: number | undefined;
    for (let j = i + 1; j < Math.min(lines.length, i + 9); j += 1) {
      const line = lines[j];
      if (/^(?:Sold|Ended)(?:\s+on)?\s+/i.test(line) && (line.match(DATE_WORDS) || line.match(DATE_SLASH) || line.match(DATE_ISO))) break;
      const priceHit = line.match(PRICE_ALONE);
      if (priceHit) {
        price = toMoney(priceHit[1]);
        break;
      }
      if (SKIP_LINE.test(line)) continue;
      if (!title) title = line;
      else if (!condition && CONDITION_LINE.test(line)) condition = line;
    }
    push(price, date, title, condition);
  }
  if (out.length > 0) return out;

  // Any other layout: a line (or neighbouring lines) holding a date and a dollar price.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const dateMatch = line.match(DATE_WORDS) || line.match(DATE_SLASH) || line.match(DATE_ISO);
    if (!dateMatch) continue;
    const near = [line, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
    const priceHit = near.match(PRICE_ANY);
    if (!priceHit) continue;
    const title = line.replace(dateMatch[1], "").replace(PRICE_ANY, "").replace(/[|·•–-]+/g, " ").replace(/\s+/g, " ").trim();
    push(toMoney(priceHit[1]), tidyDate(dateMatch[1]), title || undefined, undefined);
  }
  return out;
}

export function summarizeComps(comps: PriceComparable[]): { n: number; low: number; median: number; high: number; from?: string; to?: string } | null {
  const prices = comps.map((c) => Number(c.salePrice)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const dated = comps
    .map((c) => (c.saleDate ? { t: Date.parse(c.saleDate), label: c.saleDate } : null))
    .filter((d): d is { t: number; label: string } => !!d && Number.isFinite(d.t))
    .sort((a, b) => a.t - b.t);
  return {
    n: prices.length,
    low: prices[0],
    median: Math.round(median * 100) / 100,
    high: prices[prices.length - 1],
    from: dated[0]?.label,
    to: dated[dated.length - 1]?.label,
  };
}
