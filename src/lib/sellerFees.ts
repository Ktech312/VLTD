// Marketplace seller-fee tables -- one copy, shared by the Cost to Sell panel
// and the Sold page profit-after-fees estimate.

export type Channel = "ebay" | "mercari" | "whatnot" | "pwcc" | "discogs" | "custom";

/**
 * Seller fee tables, checked October 2026. eBay and Discogs commissions were read from their own fee pages;
 * Whatnot, Mercari and Fanatics Collect come from published guides (Whatnot's commission now depends on your
 * four-week sales tier). Marketplaces change these, so each line says where it came from, and "Custom" lets you
 * type your own percentage.
 * Fees are worked out on the sale price you enter (include shipping if you charge the buyer for it).
 */
export type FeeBreakdown = { total: number; summary: string };
export type FeeRule = (gross: number, category?: string) => FeeBreakdown;

const money2 = (n: number) => `$${n.toFixed(2)}`;

export const FEE_RULES: Record<Exclude<Channel, "custom">, FeeRule> = {
  // eBay: trading cards, comics and CCG are 13.25% up to $7,500 and 2.35% above, plus $0.30 per order up to $10 or $0.40 over.
  ebay: (gross) => {
    const base = Math.min(gross, 7500) * 0.1325 + Math.max(gross - 7500, 0) * 0.0235;
    const perOrder = gross <= 0 ? 0 : gross <= 10 ? 0.3 : 0.4;
    return { total: base + perOrder, summary: `13.25% (2.35% over $7,500) + ${money2(perOrder)} per order (from eBay's fee page)` };
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
  pwcc: (gross) => ({ total: gross * 0.06, summary: "6% Buy Now (12% if it sells well above market value) (published guides; confirm in your account)" }),
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
export function estimateSaleFees(platform: string | undefined, salePrice: number, category?: string): number {
  const channel = feeChannelFor(platform);
  if (!channel || !(salePrice > 0)) return 0;
  return Math.round(FEE_RULES[channel](salePrice, category).total * 100) / 100;
}
