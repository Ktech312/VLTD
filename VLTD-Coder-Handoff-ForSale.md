# VLTD — Task 4 + Task 5 Completion: For Sale Toggle & Listing Polish

Completes both partially-shipped tasks in one pass:
- **Task 4:** "Mark for Sale" toggle + dedicated For Sale view
- **Task 5:** Condition-specific listing language, shipping suggestions, eBay item specifics, variant fields in copy, gate panel behind For Sale

---

## Context: current status flow

VaultItem.status is currently `"COLLECTION" | "SOLD" | "WISHLIST"`. The existing `sellItem()` immediately removes the item and archives it as sold — there's no intermediate "listed for sale" state. That gap is what this ships.

---

## Step 1 — Add `FOR_SALE` to VaultItem status

**File:** `src/lib/vaultModel.ts`

Change:
```typescript
status?: "COLLECTION" | "SOLD" | "WISHLIST";
```
To:
```typescript
status?: "COLLECTION" | "FOR_SALE" | "SOLD" | "WISHLIST";
```

In `sanitizeVaultStatus()`, add:
```typescript
if (value === "COLLECTION" || value === "FOR_SALE" || value === "SOLD" || value === "WISHLIST") return value;
```

Also add `askingPrice?: number` to the VaultItem type — the price the owner wants to sell it for (separate from `currentValue`):
```typescript
askingPrice?: number;
```

And in `normalizeOne()`:
```typescript
askingPrice:
  typeof raw.askingPrice === "number" && Number.isFinite(raw.askingPrice) && raw.askingPrice > 0
    ? raw.askingPrice
    : undefined,
```

---

## Step 2 — "Mark for Sale" toggle on item detail

**File:** `src/app/vault/item/[id]/page.tsx`

Find the action button area (wherever "Edit", "Sell", "Delete" buttons live). Add a toggle:

```tsx
{/* For Sale toggle */}
{item.status !== "SOLD" && (
  <div
    className="flex items-center justify-between px-4 py-3 rounded-2xl ring-1"
    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
  >
    <div>
      <div className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
        {item.status === "FOR_SALE" ? "Listed for sale" : "Mark for sale"}
      </div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {item.status === "FOR_SALE"
          ? "Visible in your For Sale list and public gallery"
          : "Enables listing tools and For Sale badge"}
      </div>
    </div>
    <button
      type="button"
      onClick={() => {
        const nextStatus = item.status === "FOR_SALE" ? "COLLECTION" : "FOR_SALE";
        saveItem({ ...item, status: nextStatus });
        // Trigger a re-load / state update
        setItem((prev) => prev ? { ...prev, status: nextStatus } : prev);
      }}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200"
      style={{
        background: item.status === "FOR_SALE"
          ? "var(--theme-gold, #F5B548)"
          : "var(--pill)",
      }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ml-0.5"
        style={{
          transform: item.status === "FOR_SALE" ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  </div>
)}
```

If you want an asking price field to show when toggled on:

```tsx
{item.status === "FOR_SALE" && (
  <div className="mt-2">
    <label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--muted)" }}>
      ASKING PRICE (optional)
    </label>
    <input
      type="number"
      defaultValue={item.askingPrice ?? item.currentValue ?? ""}
      onBlur={(e) => {
        const val = parseFloat(e.target.value);
        if (Number.isFinite(val) && val > 0) {
          saveItem({ ...item, askingPrice: val });
        }
      }}
      placeholder={String(item.currentValue ?? "")}
      className="w-full rounded-xl px-3 py-2 text-[14px] ring-1 outline-none"
      style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
    />
  </div>
)}
```

---

## Step 3 — For Sale badge on vault cards

**File:** `src/app/vault/VaultInner.tsx` (the inline VaultCard component inside VaultInner)

In the card metadata area, after the Notable badge, add:

```tsx
{i.status === "FOR_SALE" && (
  <span
    className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
    style={{
      background: "rgba(74,222,128,0.12)",
      color: "#4ade80",
      borderColor: "rgba(74,222,128,0.35)",
    }}
  >
    For Sale
  </span>
)}
```

---

## Step 4 — "For Sale" filter view in Vault

**File:** `src/app/vault/VaultInner.tsx`

Add a "For Sale" quick-filter button in the existing filter bar, alongside the universe tabs. When active, it filters `filtered` to only `status === "FOR_SALE"` items.

```typescript
const [forSaleOnly, setForSaleOnly] = useState(false);
```

Add to the `filtered` pipeline (after existing filters, before chunk into rows):
```typescript
.filter((item) => forSaleOnly ? item.status === "FOR_SALE" : true)
```

Add button in the filter bar:
```tsx
<button
  type="button"
  onClick={() => setForSaleOnly((v) => !v)}
  className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition"
  style={forSaleOnly ? {
    background: "rgba(74,222,128,0.12)",
    color: "#4ade80",
    borderColor: "rgba(74,222,128,0.35)",
  } : {
    background: "var(--surface)",
    color: "var(--muted)",
    borderColor: "var(--border)",
  }}
>
  For Sale {forSaleOnly ? `· ${filtered.length}` : ""}
</button>
```

Also add "FOR_SALE" to the exclusion list for any filters that currently exclude SOLD/WISHLIST:
- Wherever `item.status !== "SOLD"` is checked, consider whether FOR_SALE should also be included.
- In `SubjectRankingsWidget` / `subjectRankings.ts`, FOR_SALE items should still count toward rankings.

---

## Step 5 — Upgrade listingGenerator.ts

**File:** `src/lib/listingGenerator.ts`

### 5a — Add variant + edition + shipping to ListingInput

```typescript
export type ListingInput = {
  // ... existing fields ...
  edition?: string;
  variant?: string;
  printRun?: string;
  isFirstEdition?: boolean;
  subject?: string;
  askingPrice?: number;    // explicit asking price if owner set one
  universe?: string;       // for shipping suggestions
};
```

Update `itemToListingInput()`:
```typescript
export function itemToListingInput(item: VaultItem): ListingInput {
  return {
    title: item.title,
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    certNumber: item.certNumber,
    serialNumber: item.serialNumber,
    category: item.category,
    categoryLabel: item.categoryLabel,
    subcategoryLabel: item.subcategoryLabel,
    notes: item.notes,
    currentValue: item.currentValue,
    estimatedValue: item.estimatedValue,
    purchasePrice: item.purchasePrice,
    askingPrice: item.askingPrice,
    edition: item.edition,
    variant: item.variant,
    printRun: item.printRun,
    isFirstEdition: item.isFirstEdition,
    subject: item.subject,
    universe: item.universe,
  };
}
```

### 5b — Add condition-specific language

```typescript
function conditionLanguage(input: ListingInput): string {
  const grade = (input.grade ?? "").toLowerCase().trim();
  if (!grade) return "";

  // PSA / BGS numeric grades (cards)
  const numericMatch = grade.match(/\b(10|9\.5|9|8\.5|8|7|6|5|4|3|2|1)\b/);
  if (numericMatch) {
    const n = parseFloat(numericMatch[1]);
    if (n >= 9.5) return "Gem Mint condition. Sharp corners, clean surface, perfect centering.";
    if (n >= 9) return "Mint condition. Minor print lines acceptable at this grade.";
    if (n >= 8) return "Near Mint to Mint. Light play or handling wear may be present.";
    if (n >= 7) return "Near Mint condition. May show light edge wear or minor print defects.";
    if (n >= 5) return "Good to Excellent condition. Moderate wear consistent with the grade.";
    return "Played condition. Wear consistent with graded assessment.";
  }

  // Named grades
  if (/gem|psa 10|bgs 10|cgc 10/i.test(grade)) return "Gem Mint. Flawless surfaces, perfect corners.";
  if (/mint|nm\+|near mint/i.test(grade)) return "Near Mint or better. Minimal handling, no creases.";
  if (/vg\+|vg |very good/i.test(grade)) return "Very Good condition. Light wear from handling.";
  if (/good|gd/i.test(grade)) return "Good condition. Noticeable wear but structurally intact.";
  if (/fair|poor|reading|played/i.test(grade)) return "As described. Recommend reviewing all photos before purchase.";

  // Sealed / slabbed
  if (/sealed|factory sealed/i.test(grade)) return "Factory sealed. Never opened.";
  if (/slab|slabbed|psa|bgs|cgc|beckett/i.test(grade)) return "Professionally graded and encapsulated.";
  if (/raw|ungraded/i.test(grade)) return "Raw / ungraded. Please review photos for condition assessment.";

  return "";
}
```

### 5c — Add shipping suggestions

```typescript
function shippingNote(input: ListingInput): string {
  const universe = (input.universe ?? "").toUpperCase();
  const grade = (input.grade ?? "").toLowerCase();
  const isSlabbed = /psa|bgs|cgc|beckett|slab/.test(grade);

  if (universe === "TCG" || universe === "SPORTS") {
    if (isSlabbed) return "Ships double-boxed with bubble wrap. Slab protection included. $8–14 tracked.";
    return "Ships in top loader + team bag inside bubble mailer. $4–6 tracked.";
  }
  if (universe === "MUSIC") return "Ships in record mailer with cardboard stiffeners. $8–12 tracked.";
  if (universe === "GAMES") return "Ships boxed with bubble wrap. $6–12 depending on size.";
  if (universe === "POP_CULTURE") return "Ships boxed with padding. $6–14 depending on item size.";
  if (universe === "JEWELRY_APPAREL") return "Ships in padded envelope or small box. $4–8 tracked.";
  return "Ships securely packaged. Shipping cost varies — message for quote.";
}
```

### 5d — Add eBay item specifics

```typescript
function ebayItemSpecifics(input: ListingInput): string {
  const lines: string[] = [];

  if (input.grade) lines.push(`Condition/Grade: ${input.grade}`);
  if (input.certNumber) lines.push(`Cert Number: ${input.certNumber}`);
  if (input.serialNumber) lines.push(`Serial/ISBN: ${input.serialNumber}`);
  if (input.isFirstEdition) lines.push("Edition: 1st Edition");
  else if (input.edition) lines.push(`Edition: ${input.edition}`);
  if (input.variant) lines.push(`Variant: ${input.variant}`);
  if (input.printRun) lines.push(`Print Run: ${input.printRun}`);
  if (input.subject) lines.push(`Featured: ${input.subject}`);

  if (lines.length === 0) return "";
  return "\n\n── Item Specifics ──\n" + lines.join("\n");
}
```

### 5e — Update `listingDescription()` to use the new helpers

```typescript
function listingDescription(input: ListingInput, platform: string) {
  const category = categoryLabel(input);
  const price = askingPrice(input);
  const value = money(price);
  const conditionNote = conditionLanguage(input);
  const shipping = shippingNote(input);
  const specifics = platform === "EBAY" ? ebayItemSpecifics(input) : "";

  const lines = [
    `${input.title}${input.subtitle ? ` — ${input.subtitle}` : ""}`,
    "",
    conditionNote,
    "",
    `Category: ${category}${input.subcategoryLabel ? ` / ${input.subcategoryLabel}` : ""}`,
    input.number ? `Number / Issue: #${input.number}` : "",
    input.isFirstEdition ? "First Edition / First Print" : (input.edition ? `Edition: ${input.edition}` : ""),
    input.variant ? `Variant: ${input.variant}` : "",
    input.printRun ? `Print Run: ${input.printRun}` : "",
    input.certNumber ? `Certification #: ${input.certNumber}` : "",
    value ? `Asking Price: ${value}` : "",
    "",
    shipping,
    "",
    input.notes || "Collector-owned item from a cataloged VLTD vault. Please review all photos carefully.",
    specifics,
    "",
    `Listed via VLTD — The Multi-Category Collector's Vault.`,
  ];

  return lines.filter((line, i) => line !== "" || lines[i - 1] !== "").join("\n").trim();
}
```

### 5f — Update asking price logic

```typescript
function askingPrice(input: ListingInput) {
  return Number(input.askingPrice ?? input.estimatedValue ?? input.currentValue ?? input.price ?? 0);
}
```

### 5g — Add Whatnot + PWCC + Discogs listings

```typescript
export function generateWhatnotListing(input: ListingInput): ListingOutput {
  return buildListing(input, "WHATNOT" as any, "Collectibles", 60);
}

export function generateDiscogslisting(input: ListingInput): ListingOutput {
  return buildListing(input, "DISCOGS" as any, "Vinyl & Music", 100);
}
```

Update `ListingOutput` platform union:
```typescript
platform: "EBAY" | "ETSY" | "ICONA" | "WHATNOT" | "DISCOGS";
```

---

## Step 6 — Gate listing panel behind For Sale toggle

**File:** wherever `ExportListingButton` or the listing copy panel is rendered on the item detail page.

Wrap it so it only shows when `item.status === "FOR_SALE"`:

```tsx
{item.status === "FOR_SALE" ? (
  <ExportListingButton item={item} />
) : (
  <div
    className="rounded-2xl p-4 ring-1 text-center"
    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
  >
    <div className="text-[13px]" style={{ color: "var(--muted)" }}>
      Mark this item for sale to generate listing copy
    </div>
  </div>
)}
```

---

## Step 7 — Export / CSV update

**File:** `src/lib/vaultExport.ts`

Add `askingPrice` to the CSV columns. The status column already exists — `FOR_SALE` will appear naturally.

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/lib/vaultModel.ts src/lib/listingGenerator.ts src/app/vault/VaultInner.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] Toggle appears on item detail for COLLECTION and FOR_SALE items, not SOLD
- [ ] Toggle switches status between COLLECTION and FOR_SALE, persists on reload
- [ ] Asking price field shows when FOR_SALE, saves correctly
- [ ] FOR_SALE badge appears on vault cards
- [ ] "For Sale" filter button in vault shows only FOR_SALE items
- [ ] FOR_SALE items still appear in subject rankings (not excluded)
- [ ] Listing copy panel shows only when item.status === "FOR_SALE"
- [ ] Generated eBay listing description includes condition language, shipping note, item specifics section
- [ ] `askingPrice` used as price when set, falls back to currentValue
- [ ] Variant/edition/printRun appear in listing description when present
- [ ] CSV export includes `askingPrice` column

Commit: `feat: for sale toggle, for sale vault view, listing copy polish`

---

## Files changed summary

| File | Change |
|------|--------|
| `src/lib/vaultModel.ts` | Add `FOR_SALE` to status union, add `askingPrice?: number` |
| `src/lib/listingGenerator.ts` | Add variant/edition/askingPrice to input; conditionLanguage(), shippingNote(), ebayItemSpecifics(); Whatnot + Discogs listings; updated description builder |
| `src/lib/vaultExport.ts` | Add `askingPrice` to CSV columns |
| `src/app/vault/item/[id]/page.tsx` | For Sale toggle, asking price field, listing panel gate |
| `src/app/vault/VaultInner.tsx` | For Sale badge on cards, `forSaleOnly` filter state + button |
