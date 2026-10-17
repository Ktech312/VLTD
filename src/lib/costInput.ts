// One rule for a typed purchase cost, used by every screen and importer that takes one:
//   blank  = unknown (kept as blank, never turned into 0)
//   0      = free / explicitly nothing paid (kept as 0)
//   > 0    = the amount
//   < 0    = refused with a plain message (nothing is saved or imported with a negative cost)
// Existing saved records are never changed by this: it only checks what is being typed or imported now.

export const NEGATIVE_COST_MESSAGE =
  "A purchase cost can't be negative. Leave it blank if you don't know it, or enter 0 if it cost nothing.";

/** The number a typed amount means ("$1,250.50" -> 1250.5, "(5)" -> -5), or undefined when it has no number in it. */
export function typedAmount(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  const parenthesised = /^\(\s*[$£€¥]?\s*[\d.,]+\s*\)$/.test(text);
  const cleaned = text.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;
  return parenthesised ? -Math.abs(value) : value;
}

/** True when the typed text is a negative amount. Blank, 0 and positive amounts are fine. */
export function isNegativeCostText(raw: unknown): boolean {
  const value = typedAmount(raw);
  return value !== undefined && value < 0;
}

/**
 * Typed cost -> value for saving. `blank` stays undefined (unknown), `0` stays 0.
 * A negative amount is reported as `negative` and must be refused by the caller.
 */
export function parseCostInput(raw: unknown): { value?: number; negative: boolean } {
  const value = typedAmount(raw);
  if (value === undefined) return { negative: false };
  if (value < 0) return { negative: true };
  return { value, negative: false };
}
