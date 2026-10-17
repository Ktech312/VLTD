// Marketplace seller-fee tables -- one copy, shared by the Cost to Sell panel
// and the Sold page profit-after-fees estimate.

export type Channel = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs" | "custom";

/**
 * Seller fee tables, checked October 2026. eBay, Discogs, Whatnot (commission starts at 8%, 2.9% + $0.30 processing) and
 * Fanatics Collect were read from their own pages; Mercari comes from published guides, and the "no Whatnot commission above
 * $1,500" line below comes from published guides too (Whatnot's own page does not state it). Whatnot's commission depends on your
 * four-week sales tier. Marketplaces change these, so each line says where it came from, and "Custom" lets you
 * type your own percentage.
 * Fees are worked out on the sale price you enter (include shipping if you charge the buyer for it).
 */
export type FeeBreakdown = { total: number; summary: string };
export type FeeRule = (gross: number, category?: string, subcategory?: string) => FeeBreakdown;

const money2 = (n: number) => `$${n.toFixed(2)}`;

/**
 * eBay's main rate (a fraction), read from eBay's own selling-fees page in October 2026: comic books, trading cards, collectible
 * card games and coins pay 13.25% up to $7,500; books, magazines, movies and non-vinyl music pay 15.3%; most other categories pay
 * 13.6%. Above $7,500 each of these is 2.35% on the rest. Jewelry, watches, handbags, guitars and bullion have their own tiers
 * that are not modelled here: they use the 13.6% general rate.
 */
export function ebayRate(category?: string, subcategory?: string): number {
  const c = String(category ?? "").toLowerCase();
  const sub = String(subcategory ?? "").toLowerCase();
  if (/card|tcg|ccg|comic|coin|currency|non-?sport|sealed/.test(c) && !/accessor/.test(c) && !/bullion/.test(sub)) return 0.1325;
  if (/\b(books?|magazines?|movies?)\b/.test(c) || /\b(vhs|dvd|laser disc)\b/.test(sub)) return 0.153;
  if (/audio formats?|music/.test(c) && !/vinyl|record/.test(sub)) return 0.153;
  return 0.136;
}

export const FEE_RULES: Record<Exclude<Channel, "custom">, FeeRule> = {
  // eBay: category-dependent main rate (see ebayRate), plus $0.30 per order up to $10 or $0.40 over.
  ebay: (gross, category, subcategory) => {
    const rate = ebayRate(category, subcategory);
    const base = Math.min(gross, 7500) * rate + Math.max(gross - 7500, 0) * 0.0235;
    const perOrder = gross <= 0 ? 0 : gross <= 10 ? 0.3 : 0.4;
    return { total: base + perOrder, summary: `${Number((rate * 100).toFixed(2))}% (2.35% over $7,500) + ${money2(perOrder)} per order (from eBay's fee page)` };
  },
  // Mercari: a flat 10% of the sale, payment processing included.
  mercari: (gross) => ({ total: gross * 0.1, summary: "10% flat, payment processing included (published guides; confirm in your account)" }),
  // Whatnot: 8% commission (none on the part of a card, comic or coin sale above $1,500) + 2.9% + $0.30 payment processing.
  whatnot: (gross, category) => {
    const label = String(category ?? "").toLowerCase();
    const waived = /card|tcg|comic|coin/.test(label);
    const commissionBase = waived ? Math.min(gross, 1500) : gross;
    const processing = gross <= 0 ? 0 : gross * 0.029 + 0.3;
    return {
      total: commissionBase * 0.08 + processing,
      summary: `${waived ? "8% (none above $1,500)" : "8%"} + 2.9% + $0.30 processing. Whatnot's commission now depends on your four-week sales tier, so check your rate card`,
    };
  },
  // Fanatics Collect (formerly PWCC): 6% on Buy Now sales (12% if it sells well above market value, which this cannot know).
  pwcc: (gross) => ({ total: gross * 0.06, summary: "6% Buy Now when priced under 120% of market value, 12% at or above it (Fanatics Collect's support page; this assumes under)" }),
  // Discogs: 9% of the sale (item and shipping), at least $0.10 and at most $150, plus the payment processor's fee.
  discogs: (gross) => ({
    total: gross <= 0 ? 0 : Math.min(150, Math.max(0.1, gross * 0.09)) + gross * 0.029 + 0.3,
    summary: "9% (min $0.10, max $150; from Discogs' fee page) + about 2.9% + $0.30 payment processing (estimate)",
  }),
};

/** Turn a typed sale platform ("eBay", "whatnot live", "Fanatics") into a fee table, or null if unknown. */
export function feeChannelFor(platform?: string): Exclude<Channel, "custom"> | null {
  const p = String(platform ?? "").toLowerCase();
  if (!p) return null;
  if (p.includes("ebay")) return "ebay";
  if (p.includes("whatnot")) return "whatnot";
  if (p.includes("mercari")) return "mercari";
  if (p.includes("discogs")) return "discogs";
  if (p.includes("pwcc") || p.includes("fanatics")) return "pwcc";
  return null;
}

/**
 * Estimated seller fees for a recorded sale, using today's fee tables.
 * Unknown platforms (in person, a shop, blank) return 0 -- no guessing.
 */
export function estimateSaleFees(platform: string | undefined, salePrice: number, category?: string, subcategory?: string): number {
  const channel = feeChannelFor(platform);
  if (!channel || !(salePrice > 0)) return 0;
  return Math.round(FEE_RULES[channel](salePrice, category, subcategory).total * 100) / 100;
}
