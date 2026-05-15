import { formatPrice } from "@/lib/pricingMvp";
import { UNIVERSE_LABEL } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

export type InsurancePdfOptions = {
  collectorName?: string;
  asOfDate?: string;
  includeNotes?: boolean;
  includeComparables?: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeDate(timestamp?: number) {
  if (!timestamp) return "-";
  try {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

function effectiveValue(item: VaultItem) {
  return item.valueMedian ?? item.currentValue ?? item.estimatedValue ?? item.lastCompValue ?? 0;
}

function universeLabel(item: VaultItem) {
  const key = item.universe?.toUpperCase();
  if (!key) return item.categoryLabel ?? "-";
  return (UNIVERSE_LABEL as Record<string, string>)[key] ?? key;
}

function detailRow(label: string, value: unknown) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(clean)}</td></tr>`;
}

function itemHtml(item: VaultItem, index: number, opts: InsurancePdfOptions) {
  const value = effectiveValue(item);
  const comparables = item.comparables ?? [];
  const hasComparables = Boolean(opts.includeComparables) && comparables.length > 0;

  const imageHtml = item.imageFrontUrl
    ? `<img src="${escapeHtml(item.imageFrontUrl)}" class="item-image" alt="${escapeHtml(item.title)}" />`
    : `<div class="item-image-placeholder"></div>`;

  const comparableRows = hasComparables
    ? comparables
        .map(
          (comp) => `
      <tr>
        <td>${escapeHtml(comp.source)}</td>
        <td>${escapeHtml(formatPrice(comp.salePrice))}</td>
        <td>${escapeHtml(comp.condition ?? "-")}</td>
        <td>${escapeHtml(comp.saleDate ?? "-")}</td>
      </tr>`
        )
        .join("")
    : "";

  const valueRangeLine =
    item.valueLow || item.valueHigh
      ? `<div class="value-range">Range: ${escapeHtml(formatPrice(item.valueLow))} - ${escapeHtml(formatPrice(item.valueHigh))}</div>`
      : "";

  const conditionNote = item.conditionReason
    ? `${item.conditionReason}${
        item.conditionSource === "ai"
          ? " (AI assessed)"
          : item.conditionSource === "manual"
            ? " (Manually assessed)"
            : ""
      }`
    : "";

  return `
<div class="item-block ${index > 0 ? "page-break" : ""}">
  <div class="item-header">
    <span class="item-number">#${index + 1}</span>
    <div class="item-title-block">
      <div class="item-title">${escapeHtml(item.title)}${item.subtitle ? ` - ${escapeHtml(item.subtitle)}` : ""}</div>
      <div class="item-meta">${escapeHtml(universeLabel(item))}${item.categoryLabel ? ` | ${escapeHtml(item.categoryLabel)}` : ""}${item.number ? ` | #${escapeHtml(item.number)}` : ""}</div>
    </div>
    <div class="item-value-block">
      <div class="item-value">${escapeHtml(formatPrice(value))}</div>
      <div class="item-value-label">Stated Value</div>
      ${valueRangeLine}
    </div>
  </div>

  <div class="item-body">
    ${imageHtml}
    <div class="item-details">
      <table class="details-table">
        ${detailRow("Grade / Condition", item.grade)}
        ${detailRow("Condition Notes", conditionNote)}
        ${detailRow("Certification #", item.certNumber)}
        ${detailRow("Serial / ISBN", item.serialNumber)}
        ${detailRow("Edition", item.edition)}
        ${detailRow("Variant", item.variant)}
        ${detailRow("Print Run", item.printRun)}
        ${item.isFirstEdition ? detailRow("First Edition", "Yes") : ""}
        ${detailRow("Subject / Featured", item.subject)}
        ${detailRow("Value Source", item.priceSource)}
        ${item.priceUpdatedAt ? detailRow("Valuation Date", safeDate(item.priceUpdatedAt)) : ""}
        ${item.purchasePrice ? detailRow("Purchase Price", formatPrice(item.purchasePrice)) : ""}
        ${detailRow("Purchased From", item.purchaseSource)}
        ${item.createdAt ? detailRow("Added to Vault", safeDate(item.createdAt)) : ""}
      </table>

      ${opts.includeNotes && item.notes ? `<div class="item-notes"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}
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

export function buildInsurancePdfHtml(items: VaultItem[], opts: InsurancePdfOptions = {}) {
  const date =
    opts.asOfDate ??
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const totalValue = items.reduce((sum, item) => sum + effectiveValue(item), 0);
  const collectorName = opts.collectorName?.trim() || "VLTD Collector";
  const itemsHtml = items.map((item, index) => itemHtml(item, index, opts)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Insurance Documentation - ${escapeHtml(collectorName)}</title>
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
  .cover-footer { font-size: 10pt; color: #777; }
  .cover-disclaimer { margin-top: 24px; font-size: 9pt; color: #888; line-height: 1.6; max-width: 520px; }
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
  .value-range { font-size: 9pt; color: #888; margin-top: 4px; }
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
<div class="cover">
  <div>
    <div class="cover-logo">VLTD | The Collector's Vault</div>
    <div class="cover-title">Collection Insurance<br />Documentation</div>
    <div class="cover-subtitle">${escapeHtml(collectorName)} | ${escapeHtml(date)}</div>
  </div>
  <div class="cover-stats">
    <div><div class="cover-stat-label">Total Items</div><div class="cover-stat-value">${items.length.toLocaleString()}</div></div>
    <div><div class="cover-stat-label">Total Stated Value</div><div class="cover-stat-value">${escapeHtml(formatPrice(totalValue))}</div></div>
    <div><div class="cover-stat-label">Report Generated</div><div class="cover-stat-value" style="font-size: 13pt; padding-top: 4px;">${escapeHtml(date)}</div></div>
  </div>
  <div class="cover-footer">
    <div>This document was generated by VLTD for insurance documentation purposes.</div>
    <div class="cover-disclaimer">Stated values are based on collector-entered pricing data, recent comparable sales, and/or AI-assisted valuation estimates. This document is not a certified appraisal. For high-value items, an independent professional appraisal may be required by your insurer.</div>
  </div>
</div>
${itemsHtml}
</body>
</html>`;
}

export function printInsurancePdf(items: VaultItem[], opts: InsurancePdfOptions = {}) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(buildInsurancePdfHtml(items, opts));
  doc.close();

  const printAndRemove = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };

  const images = Array.from(doc.querySelectorAll("img"));
  if (images.length === 0) {
    printAndRemove();
    return;
  }

  let settled = images.filter((image) => image.complete).length;
  if (settled >= images.length) {
    printAndRemove();
    return;
  }

  const onSettled = () => {
    settled += 1;
    if (settled >= images.length) printAndRemove();
  };

  images.forEach((image) => {
    if (image.complete) return;
    image.onload = onSettled;
    image.onerror = onSettled;
  });
}
