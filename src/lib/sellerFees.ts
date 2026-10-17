// Marketplace seller-fee tables -- one copy, shared by the Cost to Sell panel
// and the Sold page profit-after-fees estimate.

export type Channel = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs" | "custom";

/**
 * Seller fee tables. Each rule says how far it could be checked (status), October 2026:
 *  - "verified": every number was read from the marketplace's own page (eBay selling fees; Mercari "Fees on Mercari";
 *    Fanatics Collect "Buy Now fees").
 *  - "partly": the main rate is from the marketplace's own page, but something that changes the answer was NOT confirmed:
 *    Whatnot (8% is its published starting rate; the real rate depends on your four-week tier and category, and the US rate card
 *    could not be read; the "no commission above $1,500" line is a limited-time promotion for listed categories) and Discogs (the
 *    9% fee is from its page; the payment processor's 2.9% + $0.30 is an estimate, Discogs does not state it).
 * Nothing is presented as an established rate unless its status is "verified". Fees are worked out on the sale price you enter
 * (include shipping if you charge the buyer for it). A fee-percent override in the panel always wins over these tables.
 */
export type FeeStatus = "verified" | "partly";
export type FeeBreakdown = { total: number; summary: string; status: FeeStatus; /** Where the numbers were read. */ source: string; /** What was not confirmed (partly only). */ caveat?: string };
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
    // Jewelry, watches, handbags, guitars and bullion have their own eBay tiers that are not modelled: say so instead of presenting 13.6% as theirs.
    const own = /jewel|watch|bag|handbag|guitar|bass|instrument/.test(`${category ?? ""} ${subcategory ?? ""}`.toLowerCase()) || /bullion/i.test(String(subcategory ?? ""));
    return {
      total: base + perOrder,
      summary: `${Number((rate * 100).toFixed(2))}% (2.35% over $7,500) + ${money2(perOrder)} per order`,
      status: own ? "partly" : "verified",
      source: "eBay's selling fees page",
      ...(own ? { caveat: "eBay has its own fee tiers for this kind of item (jewelry, watches, handbags, guitars, bullion) that are not built in here, so the general 13.6% is only an estimate." } : {}),
    };
  },
  // Mercari: 10% of the item price plus buyer-paid shipping; no separate payment-processing fee for sellers.
  mercari: (gross) => ({ total: gross * 0.1, summary: "10% of item price + buyer-paid shipping, no separate processing fee", status: "verified", source: "Mercari's \"Fees on Mercari\" help page" }),
  // Whatnot: 8% starting commission + 2.9% + $0.30 processing on the full order. 0% commission on the part above $1,500 is a limited-time
  // promotion for listed categories (comics, toys, coins, card games, entertainment cards, sports singles, bags, jewelry).
  whatnot: (gross, category) => {
    const label = String(category ?? "").toLowerCase();
    const waived = /card|tcg|comic|coin/.test(label);
    const commissionBase = waived ? Math.min(gross, 1500) : gross;
    const processing = gross <= 0 ? 0 : gross * 0.029 + 0.3;
    return {
      total: commissionBase * 0.08 + processing,
      summary: `${waived ? "8% (0% on the part above $1,500, a limited-time promotion)" : "8%"} + 2.9% + $0.30 processing`,
      status: "partly",
      source: "Whatnot's seller fees and high-value-orders help pages",
      caveat: "8% is Whatnot's starting rate. Your real commission depends on your four-week sales tier and the category, and the US rate card could not be read here.",
    };
  },
  // Fanatics Collect (formerly PWCC): 6% on Buy Now sales priced under 120% of market value, 12% at or above (this cannot know market value).
  pwcc: (gross) => ({ total: gross * 0.06, summary: "6% Buy Now when priced under 120% of market value (12% at or above it)", status: "verified", source: "Fanatics Collect's Buy Now fees page" }),
  // Discogs: 9% of the sale (item and shipping), at least $0.10 and at most $150, plus the payment processor's fee.
  discogs: (gross) => ({
    total: gross <= 0 ? 0 : Math.min(150, Math.max(0.1, gross * 0.09)) + gross * 0.029 + 0.3,
    summary: "9% (min $0.10, max $150) + about 2.9% + $0.30 payment processing",
    status: "partly",
    source: "Discogs' selling fees page (the 9%)",
    caveat: "The 2.9% + $0.30 payment processing is an estimate: Discogs' pages do not state the rate your payment account charges.",
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
