
import type { VaultItem } from "@/lib/vaultModel";

export type ListingInput = {
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  certNumber?: string;
  serialNumber?: string;
  category?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  description?: string;
  notes?: string;
  price?: number;
  currentValue?: number;
  estimatedValue?: number;
  purchasePrice?: number;
};

export type ListingOutput = {
  title: string;
  description: string;
  price: number;
  category: string;
  platform: "EBAY" | "ETSY" | "ICONA";
  socialCaption: string;
};

function money(value?: number) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function cleanParts(parts: Array<string | number | undefined | null>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
}

function categoryLabel(input: ListingInput) {
  return input.categoryLabel || input.category || "Collectibles";
}

function askingPrice(input: ListingInput) {
  return Number(input.estimatedValue ?? input.currentValue ?? input.price ?? 0);
}

function listingTitle(input: ListingInput, maxLength = 80) {
  const base = cleanParts([
    input.title,
    input.subtitle,
    input.number ? `#${String(input.number).replace(/^#+/, "")}` : "",
    input.grade,
    input.certNumber ? `Cert ${input.certNumber}` : "",
  ]).join(" ");

  return base.length > maxLength ? `${base.slice(0, maxLength - 1).trim()}…` : base;
}

function listingDescription(input: ListingInput, platform: string) {
  const category = categoryLabel(input);
  const value = money(askingPrice(input));
  const cost = money(input.purchasePrice);
  const lines = [
    `${input.title}${input.subtitle ? ` - ${input.subtitle}` : ""}`,
    "",
    `Category: ${category}${input.subcategoryLabel ? ` / ${input.subcategoryLabel}` : ""}`,
    input.number ? `Number / issue: ${input.number}` : "",
    input.grade ? `Condition / grade: ${input.grade}` : "",
    input.certNumber ? `Certification: ${input.certNumber}` : "",
    input.serialNumber ? `Serial / ISBN: ${input.serialNumber}` : "",
    value ? `Suggested asking price: ${value}` : "",
    cost ? `Recorded cost basis: ${cost}` : "",
    "",
    input.notes || input.description || "Collector-owned item from a cataloged VLTD vault. Review photos for exact condition and included materials.",
    "",
    `Prepared for ${platform}. Please confirm final condition, shipping terms, and marketplace-specific item details before publishing.`,
  ];

  return lines.filter((line, index) => line || lines[index - 1]).join("\n").trim();
}

function socialCaption(input: ListingInput) {
  const value = money(askingPrice(input));
  return cleanParts([
    input.title,
    input.grade,
    value ? `asking ${value}` : "",
    "#VLTD",
  ]).join(" · ");
}

function buildListing(input: ListingInput, platform: ListingOutput["platform"], defaultCategory: string, maxTitleLength = 80): ListingOutput {
  return {
    title: listingTitle(input, maxTitleLength),
    description: listingDescription(input, platform),
    price: askingPrice(input),
    category: categoryLabel(input) || defaultCategory,
    platform,
    socialCaption: socialCaption(input),
  };
}

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
  };
}

export function generateEbayListing(input: ListingInput): ListingOutput {
  return {
    ...buildListing(input, "EBAY", "Collectibles", 80),
  };
}

export function generateEtsyListing(input: ListingInput): ListingOutput {
  return {
    ...buildListing(input, "ETSY", "Vintage", 140),
  };
}

export function generateIconaListing(input: ListingInput): ListingOutput {
  return {
    ...buildListing(input, "ICONA", "Auction", 100),
  };
}
