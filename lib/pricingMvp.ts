export type PriceConfidence = "low" | "medium" | "high";

export type PricingMvpFields = {
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceUpdatedAt?: number;
  priceNotes?: string;
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
}): PricingMvpFields {
  const hasMeaningfulValue = hasPricingData(input);

  return {
    estimatedValue: input.estimatedValue,
    lastCompValue: input.lastCompValue,
    priceSource: String(input.priceSource ?? "").trim() || undefined,
    priceConfidence: input.priceConfidence,
    priceUpdatedAt: hasMeaningfulValue ? Date.now() : undefined,
    priceNotes: String(input.priceNotes ?? "").trim() || undefined,
  };
}

export function effectivePricingValue(input: Pick<PricingMvpFields, "estimatedValue" | "lastCompValue">): number | undefined {
  if (typeof input.estimatedValue === "number" && Number.isFinite(input.estimatedValue)) return input.estimatedValue;
  if (typeof input.lastCompValue === "number" && Number.isFinite(input.lastCompValue)) return input.lastCompValue;
  return undefined;
}
