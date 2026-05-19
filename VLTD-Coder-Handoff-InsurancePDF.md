# VLTD — Insurance Documentation PDF Export

Generates a printable, insurer-ready PDF for any vault item or the full collection. Referenced across Tasks 1, 6, and 0A but never spec'd as a standalone feature. This is a real differentiator — no free multi-category collector app produces an insurance-grade document.

Uses browser `window.print()` into a hidden iframe (no PDF library dependency). Output is a clean, print-optimized HTML page the browser converts to PDF.

---

## Context

Current export state:
- `vaultExport.ts` — CSV + JSON (data only, no formatting)
- No PDF output exists anywhere in the codebase

What insurers need in a valuation document:
1. Cover page — collector name, date, total insured value, item count
2. Per-item sections — photo, title/category, grade/condition, certified value with source, comparables, notes
3. Comparable sales table — supporting evidence for the stated value
4. Condition reasoning — from AI assessment or manual entry

---

## Step 1 — Create `src/lib/insurancePdf.ts`

All the data-gathering and HTML-building logic. Zero React.

```typescript
import { formatPrice } from "@/lib/pricingMvp";
import { UNIVERSE_LABEL } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

export type InsurancePdfOptions = {
  collectorName?: string;
  asOfDate?: string;           // defaults to today
  includeNotes?: boolean;
  includeComparables?: boolean;
};

function safeDate(ts?: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function effectiveValue(item: VaultItem): number {
  return (
    item.valueMedian ??
    item.currentValue ??
    item.estimatedValue ??
    item.lastCompValue ??
    0
  );
}

function universeLabel(item: VaultItem): string {
  const key = item.universe?.toUpperCase();
  if (!key) return item.categoryLabel ?? "—";
  return (UNIVERSE_LABEL as Record<string, string>)[key] ?? key;
}

function itemHtml(item: VaultItem, idx: number, opts: InsurancePdfOptions): string {
  const value = effectiveValue(item);
  const comparables = item.comparables ?? [];
  const hasComparables = opts.includeComparables && comparables.length > 0;

  const imageHtml = item.imageFrontUrl
    ? `<img src="${item.imageFrontUrl}" class="item-image" alt="${item.title}" />`
    : `<div class="item-image-placeholder"></div>`;

  const comparableRows = hasComparables
    ? comparables
        .map(
          (c) => `
      <tr>
        <td>${c.source}</td>
        <td>$${c.salePrice.toLocaleString()}</td>
        <td>${c.condition ?? "—"}</td>
        <td>${c.saleDate ?? "—"}</td>
      </tr>`
        )
        .join("")
    : "";

  const valueRangeLine =
    item.valueLow || item.valueHigh
      ? `<div class="value-range">Range: ${formatPrice(item.valueLow)} – ${formatPrice(item.valueHigh)}</div>`
      : "";

  return `
<div class="item-block ${idx > 0 ? "page-break" : ""}">
  <div class="item-header">
    <span class="item-number">#${idx + 1}</span>
    <div class="item-title-block">
      <div class="item-title">${item.title}${item.subtitle ? ` — ${item.subtitle}` : ""}</div>
      <div class="item-meta">${universeLabel(item)}${item.categoryLabel ? ` · ${item.categoryLabel}` : ""}${item.number ? ` · #${item.number}` : ""}</div>
    </div>
    <div class="item-value-block">
      <div class="item-value">${formatPrice(value)}</div>
      <div class="item-value-label">Stated Value</div>
      ${valueRangeLine}
    </div>
  </div>

  <div class="item-body">
    ${imageHtml}
    <div class="item-details">
      <table class="details-table">
        ${item.grade ? `<tr><td>Grade / Condition</td><td>${item.grade}</td></tr>` : ""}
        ${item.conditionReason ? `<tr><td>Condition Notes</td><td>${item.conditionReason}${item.conditionSource === "ai" ? " (AI assessed)" : item.conditionSource === "manual" ? " (Manually assessed)" : ""}</td></tr>` : ""}
        ${item.certNumber ? `<tr><td>Certification #</td><td>${item.certNumber}</td></tr>` : ""}
        ${item.serialNumber ? `<tr><td>Serial / ISBN</td><td>${item.serialNumber}</td></tr>` : ""}
        ${item.edition ? `<tr><td>Edition</td><td>${item.edition}</td></tr>` : ""}
        ${item.variant ? `<tr><td>Variant</td><td>${item.variant}</td></tr>` : ""}
        ${item.printRun ? `<tr><td>Print Run</td><td>${item.printRun}</td></tr>` : ""}
        ${item.isFirstEdition ? `<tr><td>First Edition</td><td>Yes</td></tr>` : ""}
        ${item.subject ? `<tr><td>Subject / Featured</td><td>${item.subject}</td></tr>` : ""}
        ${item.priceSource ? `<tr><td>Value Source</td><td>${item.priceSource}</td></tr>` : ""}
        ${item.priceUpdatedAt ? `<tr><td>Valuation Date</td><td>${safeDate(item.priceUpdatedAt)}</td></tr>` : ""}
        ${item.purchasePrice ? `<tr><td>Purchase Price</td><td>${formatPrice(item.purchasePrice)}</td></tr>` : ""}
        ${item.purchaseSource ? `<tr><td>Purchased From</td><td>${item.purchaseSource}</td></tr>` : ""}
        ${item.createdAt ? `<tr><td>Added to Vault</td><td>${safeDate(item.createdAt)}</td></tr>` : ""}
      </table>

      ${opts.includeNotes && item.notes ? `<div class="item-notes"><strong>Notes:</strong> ${item.notes}</div>` : ""}
    </div>
  </div>

  ${hasComparables ? `
  <div class="comparables">
    <div class="comparables-title">Comparable Sales</div>
    <table class="comparables-table">
      <thead>
        <tr><th>Source</th><th>Sale Price</th><th>Condition</th><th>Date</th></tr>
      </thead>
      <tbody>${comparableRows}</tbody>
    </table>
  </div>` : ""}
</div>`;
}

export function buildInsurancePdfHtml(
  items: VaultItem[],
  opts: InsurancePdfOptions = {}
): string {
  const date = opts.asOfDate ?? new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalValue = items.reduce((sum, i) => sum + effectiveValue(i), 0);
  const collectorName = opts.collectorName?.trim() || "VLTD Collector";

  const itemsHtml = items
    .map((item, idx) => itemHtml(item, idx, opts))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Insurance Documentation — ${collectorName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; background: #fff; font-size: 12pt; }

  .cover { page-break-after: always; padding: 80px 60px; display: flex; flex-direction: column; justify-content: space-between; min-height: 100vh; }
  .cover-logo { font-size: 11pt; letter-spacing: 0.3em; text-transform: uppercase; color: #888; margin-bottom: 60px; }
  .cover-title { font-size: 28pt; font-weight: bold; line-height: 1.2; margin-bottom: 16px; }
  .cover-subtitle { font-size: 14pt; color: #555; margin-bottom: 60px; }
  .cover-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; }
  .cover-stat-label { font-size: 9pt; letter-spacing: 0.2em; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .cover-stat-value { font-size: 20pt; font-weight: bold; }
  .cover-footer { font-size: 10pt; color: #aaa; }
  .cover-disclaimer { margin-top: 24px; font-size: 9pt; color: #999; line-height: 1.6; max-width: 500px; }

  .item-block { padding: 40px 60px; }
  .page-break { page-break-before: always; }

  .item-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
  .item-number { font-size: 10pt; color: #aaa; min-width: 28px; padding-top: 4px; }
  .item-title-block { flex: 1; }
  .item-title { font-size: 16pt; font-weight: bold; line-height: 1.3; }
  .item-meta { font-size: 10pt; color: #666; margin-top: 4px; }
  .item-value-block { text-align: right; flex-shrink: 0; }
  .item-value { font-size: 20pt; font-weight: bold; }
  .item-value-label { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
  .value-range { font-size: 9pt; color: #aaa; margin-top: 4px; }

  .item-body { display: flex; gap: 24px; }
  .item-image { width: 160px; height: 220px; object-fit: contain; border: 1px solid #e5e5e5; flex-shrink: 0; }
  .item-image-placeholder { width: 160px; height: 220px; background: #f5f5f5; border: 1px solid #e5e5e5; flex-shrink: 0; }
  .item-details { flex: 1; }
  .details-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .details-table td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
  .details-table td:first-child { color: #666; width: 38%; }
  .item-notes { margin-top: 12px; font-size: 10pt; color: #555; line-height: 1.5; }

  .comparables { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
  .comparables-title { font-size: 9pt; letter-spacing: 0.2em; text-transform: uppercase; color: #888; margin-bottom: 10px; }
  .comparables-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .comparables-table th { text-align: left; padding: 6px 10px; background: #f9f9f9; border: 1px solid #e5e5e5; font-weight: 600; }
  .comparables-table td { padding: 6px 10px; border: 1px solid #e5e5e5; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    .cover { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- Cover page -->
<div class="cover">
  <div>
    <div class="cover-logo">VLTD · The Collector's Vault</div>
    <div class="cover-title">Collection Insurance<br />Documentation</div>
    <div class="cover-subtitle">${collectorName} · ${date}</div>
  </div>

  <div class="cover-stats">
    <div>
      <div class="cover-stat-label">Total Items</div>
      <div class="cover-stat-value">${items.length.toLocaleString()}</div>
    </div>
    <div>
      <div class="cover-stat-label">Total Stated Value</div>
      <div class="cover-stat-value">${formatPrice(totalValue)}</div>
    </div>
    <div>
      <div class="cover-stat-label">Report Generated</div>
      <div class="cover-stat-value" style="font-size: 13pt; padding-top: 4px;">${date}</div>
    </div>
  </div>

  <div class="cover-footer">
    <div>This document was generated by VLTD (vltd.app) for insurance documentation purposes.</div>
    <div class="cover-disclaimer">
      Stated values are based on collector-entered pricing data, recent comparable sales, and/or AI-assisted valuation estimates. This document is not a certified appraisal. For high-value items, an independent professional appraisal may be required by your insurer.
    </div>
  </div>
</div>

<!-- Item pages -->
${itemsHtml}

</body>
</html>`;
}

export function printInsurancePdf(items: VaultItem[], opts: InsurancePdfOptions = {}) {
  const html = buildInsurancePdfHtml(items, opts);

  // Create hidden iframe, write HTML, trigger print dialog
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();

  // Wait for images to load before printing
  const images = Array.from(doc.querySelectorAll("img"));
  if (images.length === 0) {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  } else {
    let loaded = 0;
    const tryPrint = () => {
      loaded++;
      if (loaded >= images.length) {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }
    };
    images.forEach((img) => {
      img.onload = tryPrint;
      img.onerror = tryPrint;
    });
  }
}
```

---

## Step 2 — Create `src/components/InsurancePdfButton.tsx`

Button that opens an options sheet then triggers the print dialog:

```tsx
"use client";

import { useState } from "react";
import { printInsurancePdf } from "@/lib/insurancePdf";
import type { VaultItem } from "@/lib/vaultModel";

type Props = {
  items: VaultItem[];       // single item or full vault
  collectorName?: string;
  label?: string;           // button text override
};

export default function InsurancePdfButton({ items, collectorName, label }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(collectorName ?? "");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeComparables, setIncludeComparables] = useState(true);
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    try {
      printInsurancePdf(items, {
        collectorName: name,
        includeNotes,
        includeComparables,
      });
    } finally {
      setTimeout(() => {
        setPrinting(false);
        setOpen(false);
      }, 1000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-4 py-2 text-[13px] font-semibold ring-1 transition"
        style={{
          background: "var(--surface)",
          color: "var(--fg)",
          borderColor: "var(--border)",
        }}
      >
        {label ?? "Insurance PDF"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-6 space-y-4"
            style={{ background: "var(--surface)" }}
          >
            <div className="text-[15px] font-bold" style={{ color: "var(--fg)" }}>
              Export Insurance Documentation
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {items.length} item{items.length !== 1 ? "s" : ""} · Opens print dialog (save as PDF)
            </div>

            {/* Collector name */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted)" }}>
                COLLECTOR NAME (shown on cover)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name or business"
                className="w-full rounded-xl px-3 py-2 text-[14px] ring-1 outline-none"
                style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
              />
            </div>

            {/* Options */}
            {[
              { label: "Include item notes", value: includeNotes, set: setIncludeNotes },
              { label: "Include comparable sales", value: includeComparables, set: setIncludeComparables },
            ].map(({ label, value, set }) => (
              <button
                key={label}
                type="button"
                onClick={() => set((v) => !v)}
                className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 ring-1"
                style={{ background: "var(--pill)", borderColor: "var(--border)" }}
              >
                <span className="text-[13px]" style={{ color: "var(--fg)" }}>{label}</span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: value ? "var(--theme-gold, #F5B548)" : "var(--muted)" }}
                >
                  {value ? "On" : "Off"}
                </span>
              </button>
            ))}

            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="w-full rounded-2xl py-3 text-[14px] font-semibold disabled:opacity-50"
              style={{ background: "var(--theme-gold, #F5B548)", color: "#000" }}
            >
              {printing ? "Opening print dialog..." : "Generate PDF"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-center text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## Step 3 — Wire into item detail page

**File:** `src/app/vault/item/[id]/page.tsx`

In the action buttons area near "Edit", "Share", etc., add:

```tsx
import InsurancePdfButton from "@/components/InsurancePdfButton";

// Inside the component, where item is loaded:
{item && (
  <InsurancePdfButton
    items={[item]}
    label="Insurance Doc"
  />
)}
```

---

## Step 4 — Wire into vault export (full collection)

**File:** `src/components/VaultExportButton.tsx` or vault page header

Add insurance PDF to the export dropdown alongside CSV/JSON:

```tsx
import InsurancePdfButton from "@/components/InsurancePdfButton";

// Inside the dropdown:
<InsurancePdfButton
  items={allItems}
  label="Insurance PDF (full vault)"
/>
```

---

## Step 5 — Add `priceSource` defaulting in `vaultExport.ts`

Update `CSV_COLUMNS` to include the new range + comparable fields (from Task 6 handoff):

```typescript
const CSV_COLUMNS: (keyof VaultItem)[] = [
  // ... existing ...
  "valueLow",
  "valueMedian",
  "valueHigh",
  // comparables is an array — serialize separately in the download function
];
```

---

## Files changed summary

| File | Change |
|------|--------|
| `src/lib/insurancePdf.ts` | New — HTML builder + `printInsurancePdf()` via iframe |
| `src/components/InsurancePdfButton.tsx` | New — button + options sheet |
| `src/app/vault/item/[id]/page.tsx` | Add `InsurancePdfButton` for single-item export |
| `src/components/VaultExportButton.tsx` | Add `InsurancePdfButton` for full vault export |

---

## Verify

```bash
npx tsc --noEmit
npx eslint src/lib/insurancePdf.ts src/components/InsurancePdfButton.tsx --max-warnings=0
npm run build
```

Test checklist:
- [ ] "Insurance Doc" button visible on item detail page
- [ ] Options sheet opens — name field, notes toggle, comparables toggle
- [ ] Print dialog fires after clicking "Generate PDF"
- [ ] Cover page shows: collector name, date, item count, total value
- [ ] Each item gets its own page section with title, meta, value, details table
- [ ] Item image renders in the PDF (if present on the item)
- [ ] Condition notes + source label show correctly
- [ ] Comparable sales table renders if `includeComparables` is on and data exists
- [ ] Items with no comparables or no images degrade gracefully (placeholder box / no table)
- [ ] Full vault export via VaultExportButton includes InsurancePdfButton in dropdown
- [ ] Works with single item and with full 100+ item vaults

Commit: `feat: insurance documentation PDF export — per-item and full vault`
