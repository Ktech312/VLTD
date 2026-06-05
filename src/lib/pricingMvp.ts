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
