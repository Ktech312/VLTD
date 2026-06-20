# VLTD — Task 6: Multi-Marketplace Price Sources

Upgrades the pricing layer from a single manual estimate to a low/median/high value range with per-category source suggestions, multi-source entry, source attribution display, and comparable sales for insurance packets. No external API calls required — all manual entry, but the UI tells collectors exactly where to look for each item type.

---

## Context: current pricing state

`src/lib/pricingMvp.ts` tracks:
- `estimatedValue?: number` — single number
- `lastCompValue?: number` — one recent comp
- `priceSource?: string` — free text ("eBay sold")
- `priceConfidence?: "low" | "medium" | "high"`
- `priceNotes?: string`
- `priceUpdatedAt?: number`

`PricingMvpCard.tsx` renders this as a 4-cell read view + edit form.

The upgrades: value range (low/median/high), per-universe source suggestions, multiple comparable sales, source attribution chips.

---

## Step 1 — Upgrade `src/lib/pricingMvp.ts`

### 1a — Add new types

```typescript
export type PriceComparable = {
  source: string;          // "eBay", "PWCC", "Discogs", etc.
  salePrice: number;
  saleDate?: string;       // "2024-11" or "Nov 2024" — free text
  condition?: string;      // grade/condition at time of sale
  url?: string;            // optional link
  notes?: string;
};

export type PricingSource = {
  platform: string;       // "eBay Sold Listings" | "PWCC" | etc.
  value: number;
  confidence: PriceConfidence;
  fetchedAt?: number;
  notes?: string;
};

// Upgrade PricingMvpFields to include range + sources
export type PricingMvpFields = {
  // Existing (keep backward compat)
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceUpdatedAt?: number;
  priceNotes?: string;

  // New range fields
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;

  // New multi-source
  priceSources?: PricingSource[];

  // Comparable sales (for insurance)
  comparables?: PriceComparable[];
};
```

### 1b — Add source suggestion logic

```typescript
export type MarketplaceSuggestion = {
  platform: string;
  url: string;
  searchHint: string;   // what to search for
  note: string;         // why this source
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
  const searchQuery = encodeURIComponent((title ?? "") + (grade ? ` ${grade}` : ""));

  const ebay: MarketplaceSuggestion = {
    platform: "eBay Sold Listings",
    url: `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&LH_Sold=1&LH_Complete=1`,
    searchHint: `"${title ?? ""}" ${grade ?? ""}`.trim(),
    note: "Best volume — use Completed Listings filter",
  };

  if (u === "SPORTS" || u === "TCG") {
    const results: MarketplaceSuggestion[] = [ebay];

    if (isSlabbed) {
      results.push({
        platform: "PWCC Marketplace",
        url: `https://www.pwccmarketplace.com/search?q=${searchQuery}`,
        searchHint: `${title ?? ""} ${grade ?? ""}`.trim(),
        note: "Best for graded cards — premium auction comps",
      });
      results.push({
        platform: "MySlabs",
        url: `https://www.myslabs.com/`,
        searchHint: "Search by cert number for exact grade history",
        note: "Cert-level transaction history for graded cards",
      });
    } else {
      results.push({
        platform: "130point",
        url: `https://www.130point.com/sales/`,
        searchHint: `${title ?? ""}`.trim(),
        note: "Aggregated eBay sold — useful for raw cards",
      });
    }
    return results;
  }

  if (u === "MUSIC" || c.includes("vinyl") || c.includes("record")) {
    return [
      ebay,
      {
        platform: "Discogs",
        url: `https://www.discogs.com/search/?q=${searchQuery}&type=all&format=Vinyl`,
        searchHint: `${title ?? ""}`.trim(),
        note: "Primary source for vinyl — check Sales History on each listing",
      },
    ];
  }

  if (u === "POP_CULTURE" && c.includes("comic")) {
    return [
      ebay,
      {
        platform: "MyComicShop",
        url: `https://www.mycomicshop.com/search?q=${searchQuery}`,
        searchHint: `${title ?? ""}`.trim(),
        note: "Good for raw comics — dealer buy prices",
      },
      {
        platform: "CovrPrice",
        url: `https://covrprice.com/`,
        searchHint: `${title ?? ""}`.trim(),
        note: "Aggregated comic comps with FMV ranges",
      },
    ];
  }

  if (u === "GAMES") {
    return [
      ebay,
      {
        platform: "PriceCharting",
        url: `https://www.pricecharting.com/search-products?q=${searchQuery}`,
        searchHint: `${title ?? ""}`.trim(),
        note: "Best for video games — loose / CIB / sealed pricing tiers",
      },
    ];
  }

  // Default
  return [ebay];
}
```

### 1c — Add range helpers

```typescript
export function effectiveValueRange(fields: PricingMvpFields): {
  low?: number;
  median?: number;
  high?: number;
} {
  // Prefer new range fields; fall back to legacy single value
  if (fields.valueLow !== undefined || fields.valueMedian !== undefined || fields.valueHigh !== undefined) {
    return { low: fields.valueLow, median: fields.valueMedian, high: fields.valueHigh };
  }
  const single = fields.estimatedValue ?? fields.lastCompValue;
  if (single !== undefined) return { median: single };
  return {};
}

export function displayPrimaryValue(fields: PricingMvpFields): number | undefined {
  return fields.valueMedian ?? fields.estimatedValue ?? fields.lastCompValue;
}

export function normalizePriceSources(value: unknown): PricingSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is PricingSource =>
      s &&
      typeof s === "object" &&
      typeof s.platform === "string" &&
      typeof s.value === "number"
  );
}

export function normalizeComparables(value: unknown): PriceComparable[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is PriceComparable =>
      c &&
      typeof c === "object" &&
      typeof c.source === "string" &&
      typeof c.salePrice === "number"
  );
}
```

Also update `normalizeOne()` in `vaultModel.ts` to call `normalizePriceSources` and `normalizeComparables` when deserializing items from localStorage.

---

## Step 2 — Update `PricingMvpCard.tsx`

Full replacement of the component. Key changes: source suggestions, range fields, comparables list.

### 2a — Import new helpers

```typescript
import {
  buildPricingPatch,
  confidenceLabel,
  confidenceTone,
  displayPrimaryValue,
  effectiveValueRange,
  formatPrice,
  formatPriceUpdatedAt,
  getPricingSuggestions,
  normalizeComparables,
  normalizePriceSources,
  normalizePriceConfidence,
  parsePriceInput,
  type PriceComparable,
  type PriceConfidence,
  type PricingMvpFields,
  type PricingSource,
} from "@/lib/pricingMvp";
```

### 2b — Add props for item context

```typescript
export default function PricingMvpCard({
  value,
  compact = false,
  title = "PRICING",
  universe,
  categoryLabel,
  grade,
  itemTitle,
  onSave,
}: {
  value: PricingMvpFields;
  compact?: boolean;
  title?: string;
  universe?: string;
  categoryLabel?: string;
  grade?: string;
  itemTitle?: string;
  onSave?: (patch: PricingMvpFields) => void | Promise<void>;
})
```

Pass these from the item detail page when rendering PricingMvpCard:
```tsx
<PricingMvpCard
  value={pricingFields}
  universe={item.universe}
  categoryLabel={item.categoryLabel}
  grade={item.grade}
  itemTitle={item.title}
  onSave={handlePricingSave}
/>
```

### 2c — Source suggestions panel

Add this inside the edit form, before the value fields:

```tsx
{/* Platform suggestions */}
{(universe || categoryLabel) && (() => {
  const suggestions = getPricingSuggestions(universe ?? "", categoryLabel ?? "", grade, itemTitle);
  return (
    <div>
      <div className="text-[11px] tracking-[0.14em] mb-2" style={{ color: "var(--muted2)" }}>
        WHERE TO LOOK
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <a
            key={s.platform}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between rounded-xl px-3 py-2.5 ring-1 gap-3"
            style={{ background: "var(--pill)", borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                {s.platform} ↗
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {s.note}
              </div>
            </div>
            <div className="text-[11px] flex-shrink-0 pt-0.5" style={{ color: "var(--muted)" }}>
              Search: {s.searchHint}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
})()}
```

### 2d — Low / Median / High fields

Replace the two-column `ESTIMATED VALUE` + `LAST COMP` fields with a three-column range:

```tsx
<div className="grid grid-cols-3 gap-2">
  <div className="grid gap-1.5">
    <label className="text-[11px] tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
      LOW
    </label>
    <input
      className={inputClass()}
      value={valueLowInput}
      onChange={(e) => setValueLowInput(e.target.value)}
      placeholder="80"
    />
  </div>
  <div className="grid gap-1.5">
    <label className="text-[11px] tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
      MEDIAN ★
    </label>
    <input
      className={inputClass()}
      value={valueMedianInput}
      onChange={(e) => setValueMedianInput(e.target.value)}
      placeholder="110"
    />
  </div>
  <div className="grid gap-1.5">
    <label className="text-[11px] tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
      HIGH
    </label>
    <input
      className={inputClass()}
      value={valueHighInput}
      onChange={(e) => setValueHighInput(e.target.value)}
      placeholder="150"
    />
  </div>
</div>
```

Keep the legacy `estimatedValue` field too (optional, collapsed under "Advanced") so existing data is preserved.

### 2e — Comparable sales entry

Below the notes field, add a comparables section:

```tsx
<div>
  <div className="flex items-center justify-between mb-2">
    <label className="text-[11px] tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
      COMPARABLE SALES
    </label>
    <button
      type="button"
      onClick={() => setComparableDraft([...comparableDraft, { source: "", salePrice: 0 }])}
      className="text-[11px] font-semibold"
      style={{ color: "var(--theme-gold, #F5B548)" }}
    >
      + Add Comp
    </button>
  </div>
  {comparableDraft.map((comp, idx) => (
    <div key={idx} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-end mb-2">
      <input
        className={inputClass()}
        placeholder="Source (eBay, PWCC…)"
        value={comp.source}
        onChange={(e) => updateComp(idx, "source", e.target.value)}
      />
      <input
        className={inputClass()}
        placeholder="Price"
        type="number"
        value={comp.salePrice || ""}
        onChange={(e) => updateComp(idx, "salePrice", parseFloat(e.target.value))}
      />
      <input
        className={inputClass()}
        placeholder="Date"
        value={comp.saleDate ?? ""}
        onChange={(e) => updateComp(idx, "saleDate", e.target.value)}
      />
      <button
        type="button"
        onClick={() => removeComp(idx)}
        className="h-10 w-8 text-[16px]"
        style={{ color: "var(--muted)" }}
      >
        ×
      </button>
    </div>
  ))}
</div>
```

State helpers:
```typescript
function updateComp(idx: number, key: keyof PriceComparable, value: unknown) {
  setComparableDraft((prev) =>
    prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c))
  );
}
function removeComp(idx: number) {
  setComparableDraft((prev) => prev.filter((_, i) => i !== idx));
}
```

### 2f — Read view: value range display

Replace the ESTIMATE cell in read view:

```tsx
{/* Value range */}
{(() => {
  const range = effectiveValueRange(value);
  return (
    <div className="rounded-[14px] p-3 ring-1 col-span-2 sm:col-span-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="text-[11px] tracking-[0.14em] mb-1" style={{ color: "var(--muted2)" }}>
        VALUE RANGE
      </div>
      {(range.low || range.median || range.high) ? (
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {range.low && (
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {formatPrice(range.low)}
            </span>
          )}
          {range.median && (
            <span className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
              {formatPrice(range.median)}
            </span>
          )}
          {range.high && (
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {formatPrice(range.high)}
            </span>
          )}
        </div>
      ) : (
        <div className="text-[18px] font-bold">—</div>
      )}
    </div>
  );
})()}
```

### 2g — Read view: comparables list

Below the existing grid, show comparables if any:

```tsx
{normalizeComparables(value.comparables).length > 0 && (
  <div>
    <div className="text-[11px] tracking-[0.14em] mb-2" style={{ color: "var(--muted2)" }}>
      COMPARABLE SALES
    </div>
    <div className="space-y-1.5">
      {normalizeComparables(value.comparables).map((comp, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl px-3 py-2 ring-1"
          style={{ background: "var(--pill)", borderColor: "var(--border)" }}
        >
          <div>
            <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
              {formatPrice(comp.salePrice)}
            </span>
            {comp.condition && (
              <span className="ml-2 text-[11px]" style={{ color: "var(--muted)" }}>
                {comp.condition}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              {comp.source}
            </div>
            {comp.saleDate && (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {comp.saleDate}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Step 3 — Update `buildPricingPatch()` in pricingMvp.ts

```typescript
export function buildPricingPatch(input: {
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceNotes?: string;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  comparables?: PriceComparable[];
  priceSources?: PricingSource[];
}): PricingMvpFields {
  const hasMeaningfulValue =
    hasPricingData(input) ||
    input.valueLow !== undefined ||
    input.valueMedian !== undefined ||
    input.valueHigh !== undefined;

  return {
    estimatedValue: input.estimatedValue,
    lastCompValue: input.lastCompValue,
    priceSource: String(input.priceSource ?? "").trim() || undefined,
    priceConfidence: input.priceConfidence,
    priceNotes: String(input.priceNotes ?? "").trim() || undefined,
    priceUpdatedAt: hasMeaningfulValue ? Date.now() : undefined,
    valueLow: input.valueLow,
    valueMedian: input.valueMedian,
    valueHigh: input.valueHigh,
    comparables: input.comparables?.length ? input.comparables : undefined,
    priceSources: input.priceSources?.length ? input.priceSources : undefined,
  };
}
```

---

## Step 4 — Update VaultItem normalization

**File:** `src/lib/vaultModel.ts` in `normalizeOne()`

After the existing pricing field normalizations, add:

```typescript
valueLow:
  typeof raw.valueLow === "number" && Number.isFinite(raw.valueLow) && raw.valueLow > 0
    ? raw.valueLow : undefined,
valueMedian:
  typeof raw.valueMedian === "number" && Number.isFinite(raw.valueMedian) && raw.valueMedian > 0
    ? raw.valueMedian : undefined,
valueHigh:
  typeof raw.valueHigh === "number" && Number.isFinite(raw.valueHigh) && raw.valueHigh > 0
    ? raw.valueHigh : undefined,
comparables: normalizeComparables(raw.comparables),
priceSources: normalizePriceSources(raw.priceSources),
```

Also add the fields to the `VaultItem` type:

```typescript
valueLow?: number;
valueMedian?: number;
valueHigh?: number;
comparables?: PriceComparable[];
priceSources?: PricingSource[];
```

Import `PriceComparable` and `PricingSource` from `pricingMvp.ts` at the top of `vaultModel.ts`.

---

## Step 5 — Insurance export: add comparable sales

**File:** `src/lib/vaultExport.ts`

In the CSV builder, add columns after `priceSource`:

```typescript
valueLow: item.valueLow ?? "",
valueMedian: item.valueMedian ?? "",
valueHigh: item.valueHigh ?? "",
comparables: (item.comparables ?? [])
  .map((c) => `${c.source} $${c.salePrice}${c.saleDate ? " (" + c.saleDate + ")" : ""}`)
  .join("; "),
```

In the item detail's insurance section (wherever insurance PDF or formatted output is generated), add a Comparable Sales table if `item.comparables?.length`:

```
COMPARABLE SALES
────────────────────────────────
eBay Sold    $125   PSA 9    Nov 2024
PWCC         $140   PSA 9    Oct 2024
```

---

## Step 6 — Portfolio value calculation uses median

**File:** `src/lib/portfolioMetrics.ts` (or wherever total portfolio value is computed)

Find where `currentValue` or `estimatedValue` is summed. Prefer `valueMedian` when present:

```typescript
function effectiveItemValue(item: VaultItem): number {
  return (
    item.valueMedian ??
    item.currentValue ??
    item.estimatedValue ??
    item.lastCompValue ??
    0
  );
}
```

Use `effectiveItemValue(item)` everywhere the portfolio total is computed. This makes the median the canonical value once collectors start using ranges.

---

## Files changed summary

| File | Change |
|------|--------|
| `src/lib/pricingMvp.ts` | Add `PriceComparable`, `PricingSource`, range fields, `getPricingSuggestions()`, `effectiveValueRange()`, `displayPrimaryValue()`, updated `buildPricingPatch()` |
| `src/lib/vaultModel.ts` | Add `valueLow/Median/High`, `comparables`, `priceSources` to VaultItem type + `normalizeOne()` |
| `src/components/PricingMvpCard.tsx` | Add universe/categoryLabel/grade/itemTitle props, platform suggestions panel, range fields, comparables entry + read view |
| `src/lib/vaultExport.ts` | Add range + comparables columns to CSV |
| `src/lib/portfolioMetrics.ts` | `effectiveItemValue()` prefers `valueMedian` |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/lib/pricingMvp.ts src/lib/vaultModel.ts src/components/PricingMvpCard.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Edit pricing → "WHERE TO LOOK" panel shows correct platforms for each universe (TCG, Music/vinyl, Comics, Games, default)
- [ ] Links open correct eBay/PWCC/Discogs/etc. search with item title pre-filled
- [ ] Low/Median/High fields save correctly and appear in read view
- [ ] Range display shows all three values with median bold
- [ ] "Add Comp" → comparable row appears; source/price/date fields save
- [ ] Comparables appear in read view as a list
- [ ] Existing items with only `estimatedValue` still display correctly (backward compat)
- [ ] Portfolio total uses `valueMedian` when set, falls back to `currentValue`
- [ ] CSV export includes `valueLow`, `valueMedian`, `valueHigh`, `comparables` columns
- [ ] Items with no pricing data show "—" gracefully

Commit: `feat: multi-source pricing — value range, platform suggestions, comparable sales`
