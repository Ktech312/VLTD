/**
 * Shared number/currency formatters.
 * Module-level Intl instances are cached — one allocation per bundle load
 * instead of one per render call.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const PCT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** $1,234 — returns "" for falsy/non-finite values */
export function fmtUsd(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return USD.format(n);
}

/** $1.2K / $1.2M — compact for space-constrained UI */
export function fmtUsdCompact(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "";
  return USD_COMPACT.format(n);
}

/** +12.3% / −4.5% */
export function fmtPct(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return PCT.format(n / 100);
}

/** Returns "-" for zero/falsy — useful for table cells */
export function fmtUsdOrDash(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "-";
  return USD.format(n);
}
