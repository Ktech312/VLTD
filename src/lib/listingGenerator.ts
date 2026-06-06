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
  edition?: string;
  variant?: string;
  printRun?: string;
  isFirstEdition?: boolean;
  subject?: string;
  askingPrice?: number;
  universe?: string;
};

export type ListingOutput = {
  title: string;
  description: string;
  price: number;
  category: string;
  platform: "EBAY" | "ETSY" | "ICONA" | "WHATNOT" | "DISCOGS" | "MERCARI" | "FACEBOOK" | "PWCC";
  socialCaption: string;
  checklist: string[];
  warnings: string[];
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
  return Number(input.askingPrice ?? input.estimatedValue ?? input.currentValue ?? input.price ?? 0);
}

function listingTitle(input: ListingInput, maxLength = 80) {
  const base = cleanParts([
    input.title,
    input.subtitle,
    input.number ? `#${String(input.number).replace(/^#+/, "")}` : "",
    input.subject,
    input.isFirstEdition ? "1st Edition" : input.edition,
    input.variant,
    input.grade,
    input.certNumber ? `Cert ${input.certNumber}` : "",
  ]).join(" ");

  return base.length > maxLength ? `${base.slice(0, maxLength - 3).trim()}...` : base;
}

function conditionLanguage(input: ListingInput) {
  const grade = (input.grade ?? "").toLowerCase().trim();
  if (!grade) return "";

  const numericMatch = grade.match(/\b(10|9\.5|9|8\.5|8|7|6|5|4|3|2|1)\b/);
  if (numericMatch) {
    const n = Number(numericMatch[1]);
    if (n >= 9.5) return "Gem Mint condition. Sharp corners, clean surface, and premium presentation.";
    if (n >= 9) return "Mint condition with only minor handling or print imperfections expected at this grade.";
    if (n >= 8) return "Near Mint to Mint condition. Light handling wear may be present.";
    if (n >= 7) return "Near Mint condition. May show light edge wear or minor print defects.";
    if (n >= 5) return "Good to Excellent condition. Moderate wear is consistent with the recorded grade.";
    return "Played condition. Wear is consistent with the recorded grade.";
  }

  if (/gem|psa 10|bgs 10|cgc 10/i.test(grade)) return "Gem Mint. Premium condition with strong eye appeal.";
  if (/mint|nm\+|near mint/i.test(grade)) return "Near Mint or better. Minimal handling, no major defects noted.";
  if (/vg\+|vg |very good/i.test(grade)) return "Very Good condition. Light wear from handling may be visible.";
  if (/good|gd/i.test(grade)) return "Good condition. Noticeable wear but structurally intact.";
  if (/fair|poor|reading|played/i.test(grade)) return "As described. Please review all photos before purchase.";
  if (/sealed|factory sealed/i.test(grade)) return "Factory sealed. Never opened.";
  if (/slab|slabbed|psa|bgs|cgc|beckett/i.test(grade)) return "Professionally graded and encapsulated.";
  if (/raw|ungraded/i.test(grade)) return "Raw / ungraded. Please review photos for condition assessment.";

  return "";
}

function shippingNote(input: ListingInput) {
  const universe = (input.universe ?? "").toUpperCase();
  const grade = (input.grade ?? "").toLowerCase();
  const isSlabbed = /psa|bgs|cgc|beckett|slab/.test(grade);

  if (universe === "TCG" || universe === "SPORTS") {
    if (isSlabbed) return "Ships double-boxed with bubble wrap. Slab protection included. Estimated $8-14 tracked.";
    return "Ships in top loader and team bag inside a bubble mailer. Estimated $4-6 tracked.";
  }
  if (universe === "MUSIC") return "Ships in a record mailer with cardboard stiffeners. Estimated $8-12 tracked.";
  if (universe === "GAMES") return "Ships boxed with bubble wrap. Estimated $6-12 depending on size.";
  if (universe === "POP_CULTURE") return "Ships boxed with padding. Estimated $6-14 depending on item size.";
  if (universe === "JEWELRY_APPAREL") return "Ships in a padded envelope or small box. Estimated $4-8 tracked.";
  return "Ships securely packaged. Shipping cost varies by destination.";
}

function platformGuidance(input: ListingInput, platform: ListingOutput["platform"]) {
  const category = categoryLabel(input).toLowerCase();
  const price = askingPrice(input);

  if (platform === "PWCC") {
    if (price >= 500 || /psa|bgs|cgc|beckett|slab/i.test(input.grade ?? "")) {
      return "Best for higher-end graded cards and premium collectibles. Confirm consignment requirements before submitting.";
    }
    return "PWCC is usually strongest for graded or higher-value pieces; eBay may be better for broader demand.";
  }

  if (platform === "DISCOGS") return "Confirm exact pressing, catalog number, media condition, and sleeve condition before publishing.";
  if (platform === "WHATNOT") return "Use as a show note or auction description. Keep title short and condition clear for live buyers.";
  if (platform === "MERCARI") return "Good for simple fixed-price listings. Lead with condition, included accessories, and shipping clarity.";
  if (platform === "FACEBOOK") return "Best for local or group sales. Include pickup/shipping preference and payment terms.";
  if (platform === "ETSY" && (category.includes("vintage") || category.includes("handmade"))) return "Confirm the item fits Etsy category rules before listing.";
  return "Use marketplace-specific category and condition fields before publishing.";
}

export function buildListingReadiness(input: ListingInput) {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!input.title?.trim()) missing.push("Title");
  if (!askingPrice(input)) missing.push("Asking price or current value");
  if (!input.grade?.trim()) warnings.push("Condition or grade is blank.");
  if (!input.notes?.trim() && !input.description?.trim()) warnings.push("Description notes are blank.");
  if (!input.categoryLabel && !input.category) warnings.push("Category is blank.");
  if (!input.certNumber && /psa|bgs|cgc|beckett|slab/i.test(input.grade ?? "")) warnings.push("Graded item has no cert number.");

  return { missing, warnings };
}

function ebayItemSpecifics(input: ListingInput) {
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
  return `\n\n-- Item Specifics --\n${lines.join("\n")}`;
}

function listingDescription(input: ListingInput, platform: ListingOutput["platform"]) {
  const category = categoryLabel(input);
  const value = money(askingPrice(input));
  const cost = money(input.purchasePrice);
  const conditionNote = conditionLanguage(input);
  const shipping = shippingNote(input);
  const specifics = platform === "EBAY" ? ebayItemSpecifics(input) : "";
  const guidance = platformGuidance(input, platform);

  const lines = [
    `${input.title}${input.subtitle ? ` - ${input.subtitle}` : ""}`,
    "",
    conditionNote,
    "",
    `Category: ${category}${input.subcategoryLabel ? ` / ${input.subcategoryLabel}` : ""}`,
    input.number ? `Number / issue: ${input.number}` : "",
    input.grade ? `Condition / grade: ${input.grade}` : "",
    input.isFirstEdition ? "First Edition / First Print" : input.edition ? `Edition: ${input.edition}` : "",
    input.variant ? `Variant: ${input.variant}` : "",
    input.printRun ? `Print Run: ${input.printRun}` : "",
    input.certNumber ? `Certification #: ${input.certNumber}` : "",
    input.serialNumber ? `Serial / ISBN: ${input.serialNumber}` : "",
    value ? `Asking price: ${value}` : "",
    cost ? `Recorded cost basis: ${cost}` : "",
    "",
    shipping,
    guidance,
    "",
    input.notes || input.description || "Collector-owned item from a cataloged VLTD vault. Please review all photos carefully.",
    specifics,
    "",
    `Prepared for ${platform}. Please confirm final condition, shipping terms, and marketplace-specific details before publishing.`,
    "Listed via VLTD - The Multi-Category Collector's Vault.",
  ];

  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n").trim();
}

function socialCaption(input: ListingInput) {
  const value = money(askingPrice(input));
  return cleanParts([
    input.title,
    input.subject,
    input.grade,
    value ? `asking ${value}` : "",
    "#VLTD",
  ]).join(" | ");
}

function buildListing(
  input: ListingInput,
  platform: ListingOutput["platform"],
  defaultCategory: string,
  maxTitleLength = 80
): ListingOutput {
  const readiness = buildListingReadiness(input);
  return {
    title: listingTitle(input, maxTitleLength),
    description: listingDescription(input, platform),
    price: askingPrice(input),
    category: categoryLabel(input) || defaultCategory,
    platform,
    socialCaption: socialCaption(input),
    checklist: readiness.missing,
    warnings: readiness.warnings,
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
    askingPrice: item.askingPrice,
    edition: item.edition,
    variant: item.variant,
    printRun: item.printRun,
    isFirstEdition: item.isFirstEdition,
    subject: item.subject,
    universe: item.universe,
  };
}

export function generateEbayListing(input: ListingInput): ListingOutput {
  return buildListing(input, "EBAY", "Collectibles", 80);
}

export function generateEtsyListing(input: ListingInput): ListingOutput {
  return buildListing(input, "ETSY", "Vintage", 140);
}

export function generateIconaListing(input: ListingInput): ListingOutput {
  return buildListing(input, "ICONA", "Auction", 100);
}

export function generateWhatnotListing(input: ListingInput): ListingOutput {
  return buildListing(input, "WHATNOT", "Collectibles", 60);
}

export function generateDiscogsListing(input: ListingInput): ListingOutput {
  return buildListing(input, "DISCOGS", "Vinyl & Music", 100);
}

export function generateMercariListing(input: ListingInput): ListingOutput {
  return buildListing(input, "MERCARI", "Collectibles", 80);
}

export function generateFacebookListing(input: ListingInput): ListingOutput {
  return buildListing(input, "FACEBOOK", "Marketplace", 90);
}

export function generatePwccListing(input: ListingInput): ListingOutput {
  return buildListing(input, "PWCC", "Auction", 80);
}
