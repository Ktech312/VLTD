import type { GlyphName } from "@/components/ui/Glyph";

// ── Learn content ───────────────────────────────────────────────────
// Real, self-contained collector guides. Every card on /learn opens one of
// these — nothing is a dead link. Content is educational and general; it is
// not personalized financial, legal, or investment advice.

export type LearnBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "callout"; text: string };

export type LearnKind = "featured" | "guide" | "playbook" | "quick";

export type LearnArticle = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  tag?: string;
  readMinutes: number;
  glyph: GlyphName;
  kind: LearnKind;
  image?: string; // optional cover image under /public (e.g. /learn/insurance-basics.jpg)
  body: LearnBlock[];
};

export const LEARN_ARTICLES: LearnArticle[] = [
  // ── Featured ──────────────────────────────────────────────────────
  {
    slug: "before-you-sell",
    image: "/learn/before-you-sell.jpg",
    title: "Before You Sell From Your Collection",
    dek: "Smart collectors prepare before they sell. Learn how to document, price, and present your items to get the best outcome — anywhere.",
    category: "Selling Smart",
    tag: "Selling Smart",
    readMinutes: 7,
    glyph: "tag",
    kind: "featured",
    body: [
      { type: "p", text: "Selling well is mostly preparation. The collectors who get strong, fair offers are the ones who can prove what an item is, what condition it's in, and where it's been — before a buyer ever asks. This guide walks through the work that pays off the most." },
      { type: "h", text: "1. Know exactly what you have" },
      { type: "p", text: "Pin down the specifics that drive value: title, set, year, edition or print run, grading company and grade, and cert number. A raw item and a graded one with the same face can sell for very different amounts. If it's slabbed, the cert number is your single most convincing detail — buyers can verify it in seconds." },
      { type: "h", text: "2. Document before you list" },
      { type: "p", text: "Photograph the front, the back, and any flaws honestly. Clear, well-lit photos do more to close a sale than any description. Note provenance — where you bought it, prior owners, and anything that makes it special. In VLTD, this record travels with the item into exports and listings, so you only do it once." },
      { type: "h", text: "3. Price from real sales, not wishes" },
      { type: "p", text: "Anchor your price to recent sold comps for the same item in the same condition — not asking prices, which are often aspirational. Look at the spread, weigh how many sales there were, and discount for any condition gap. See the Understanding Market Comps guide for how to read comps like a pro." },
      { type: "h", text: "4. Choose the right venue" },
      { type: "list", items: [
        "Auction houses (Heritage, Goldin) for high-value or rare pieces where competitive bidding works in your favor.",
        "Marketplaces (eBay, PWCC) for liquid, well-comped items where buyers already search.",
        "Direct-to-collector for niche items where the right buyer pays more than a general audience.",
      ] },
      { type: "h", text: "5. Present it like it matters" },
      { type: "p", text: "A complete record — grade, cert, provenance, sharp photos — signals a serious seller and reduces a buyer's risk. Lower perceived risk is what turns a lowball into a real offer." },
      { type: "callout", text: "Rule of thumb: never sell in a hurry from an incomplete record. An extra hour documenting and comping often changes the final number more than the venue does." },
    ],
  },

  // ── Guides ────────────────────────────────────────────────────────
  {
    slug: "insurance-basics",
    image: "/learn/insurance-basics.jpg",
    title: "Insurance Basics for Collectors",
    dek: "What insurers need, common pitfalls, and how to get covered.",
    category: "Insurance",
    readMinutes: 6,
    glyph: "shield",
    kind: "guide",
    body: [
      { type: "p", text: "A standard homeowner's or renter's policy usually covers collectibles only up to a small sublimit — often far below what a real collection is worth. Understanding how coverage works helps you avoid finding that out after a loss." },
      { type: "h", text: "How collectibles get covered" },
      { type: "list", items: [
        "Scheduled personal property: you list specific high-value items on a rider, each with a documented value. Best for standout pieces.",
        "Blanket / collections coverage: one limit across the whole collection, often through a specialty collectibles insurer.",
        "Homeowner's sublimit: the default, and usually the weakest — check the actual dollar cap before relying on it.",
      ] },
      { type: "h", text: "What insurers ask for" },
      { type: "p", text: "Expect to provide an itemized inventory with descriptions, condition, purchase price or appraised value, and photos. Cert numbers and grades strengthen a claim because they establish authenticity and condition independently." },
      { type: "h", text: "Common pitfalls" },
      { type: "list", items: [
        "Insuring at purchase price when current value is much higher (or lower).",
        "No photos or documentation, so a claim comes down to your word.",
        "Forgetting to update values as the market moves or as you add items.",
      ] },
      { type: "callout", text: "VLTD is built to produce exactly what insurers want — an itemized, photographed, valued record you can export. This guide is educational; confirm coverage details with a licensed insurer or appraiser." },
    ],
  },
  {
    slug: "pricing-with-confidence",
    image: "/learn/pricing-with-confidence.jpg",
    title: "Pricing With Confidence",
    dek: "Use data, comps, and condition to set strong, realistic prices.",
    category: "Pricing",
    readMinutes: 8,
    glyph: "chart",
    kind: "guide",
    body: [
      { type: "p", text: "A confident price is one you can defend with evidence. That means starting from what similar items actually sold for and adjusting for the things that make yours different." },
      { type: "h", text: "Start with sold, not listed" },
      { type: "p", text: "Listed prices tell you what sellers hope to get. Sold prices tell you what buyers actually paid. Always anchor to completed sales for the same item and grade." },
      { type: "h", text: "Adjust for condition" },
      { type: "p", text: "Condition is often the biggest single variable. A one-grade difference can move value dramatically at the top of the scale. Compare like-for-like: a PSA 9 to other PSA 9s, not to a 10 or a raw copy." },
      { type: "h", text: "Weigh the sample" },
      { type: "list", items: [
        "Many recent sales, tight range → trust the number.",
        "Few sales, wide range → treat it as a guess and price conservatively.",
        "One outlier high sale → ignore it unless you can repeat the conditions that caused it.",
      ] },
      { type: "h", text: "Account for timing and fees" },
      { type: "p", text: "Prices move with releases, seasons, and hype cycles. And remember the net: marketplace and consignment fees can take 10–20% off the top, so a headline sale price is not what lands in your pocket." },
      { type: "callout", text: "Set your number, then sanity-check it against the last five real sales. If you can't point to comps that support it, it's a wish, not a price." },
    ],
  },
  {
    slug: "photographing-items",
    image: "/learn/photographing-items.jpg",
    title: "Photographing Items Like a Pro",
    dek: "Lighting, angles, and gear tips for clear, insurer-ready photos.",
    category: "Documentation",
    readMinutes: 5,
    glyph: "eye",
    kind: "guide",
    body: [
      { type: "p", text: "Good photos sell items and back up insurance claims. You don't need a studio — you need even light, a clean background, and a repeatable setup." },
      { type: "h", text: "Light" },
      { type: "p", text: "Soft, even light beats bright, direct light. Shoot near a large window in daytime, or use two lamps at 45 degrees to cancel shadows. Avoid on-camera flash, which flattens detail and creates glare on slabs and glossy surfaces." },
      { type: "h", text: "Angles and coverage" },
      { type: "list", items: [
        "Front, straight-on, filling the frame.",
        "Back, same framing.",
        "Detail shots of flaws, signatures, and certification labels.",
        "The cert number and grade label, readable and in focus.",
      ] },
      { type: "h", text: "Reduce glare on graded slabs" },
      { type: "p", text: "Tilt the slab slightly and move your light source rather than the item until the reflection slides off the label. A piece of white paper as a bounce fills shadows without adding hotspots." },
      { type: "callout", text: "Honesty photographs better than perfection. Showing a flaw clearly builds buyer trust and protects you from 'not as described' disputes." },
    ],
  },
  {
    slug: "storage-and-labels",
    image: "/learn/storage-and-labels.jpg",
    title: "Storage & QR Labels",
    dek: "Best practices to protect your collection and stay organized.",
    category: "Storage",
    readMinutes: 4,
    glyph: "box",
    kind: "guide",
    body: [
      { type: "p", text: "Storage protects value, and organization protects your sanity. A collection you can't find or verify is hard to insure, show, or sell." },
      { type: "h", text: "Protect the item" },
      { type: "list", items: [
        "Stable, moderate temperature and low humidity — avoid attics, garages, and basements.",
        "Out of direct sunlight to prevent fading.",
        "Archival-safe holders, sleeves, and boxes; avoid PVC and acidic materials.",
      ] },
      { type: "h", text: "Label so you can find it" },
      { type: "p", text: "A QR label on a box or shelf that links back to its VLTD record turns a wall of identical boxes into an instant lookup. Scan and you see exactly what's inside, its value, and its documentation." },
      { type: "callout", text: "The goal: any item findable in under a minute, and any box's contents provable without opening it." },
    ],
  },
  {
    slug: "building-exhibitions",
    image: "/learn/building-exhibitions.jpg",
    title: "Building Great Exhibitions",
    dek: "Curate compelling rooms that engage your audience.",
    category: "Showcase",
    readMinutes: 6,
    glyph: "exhibition",
    kind: "guide",
    body: [
      { type: "p", text: "An exhibition is a story, not a spreadsheet. The best ones give visitors a reason to care about what they're seeing." },
      { type: "h", text: "Pick a through-line" },
      { type: "p", text: "Group by theme, era, artist, or a personal narrative — 'the hunt for a complete run,' 'rookies of a decade,' 'everything signed in person.' A clear angle makes even a small collection memorable." },
      { type: "h", text: "Sequence for impact" },
      { type: "list", items: [
        "Open with a hero piece that hooks attention.",
        "Build context in the middle — the supporting cast and the story.",
        "Close on something that lands emotionally or completes the arc.",
      ] },
      { type: "h", text: "Write real captions" },
      { type: "p", text: "A sentence of context — why this piece matters, how you found it — does more than a price tag ever will. Let people in on what you know." },
      { type: "callout", text: "Curate, don't dump. Ten pieces with a story beat a hundred shown at random." },
    ],
  },
  {
    slug: "market-comps",
    image: "/learn/market-comps.jpg",
    title: "Understanding Market Comps",
    dek: "How comps work and how to read them like a pro.",
    category: "Market Insights",
    readMinutes: 7,
    glyph: "search",
    kind: "guide",
    body: [
      { type: "p", text: "A comp — short for comparable sale — is a recent transaction of an item like yours. Comps are how the whole market agrees on value. Reading them well is the difference between a fair price and a guess." },
      { type: "h", text: "What makes a good comp" },
      { type: "list", items: [
        "Same item: same set, year, edition, and variant.",
        "Same condition: same grader and grade, or genuinely equivalent raw condition.",
        "Recent: within weeks or a few months, since markets move.",
        "Actual sold price, not an asking price.",
      ] },
      { type: "h", text: "Read the distribution, not one number" },
      { type: "p", text: "Look at the range and the count of sales. A cluster of similar prices is a reliable signal. A single high sale surrounded by lower ones is usually noise — a bidding war, a rare error, or a private motivation you can't replicate." },
      { type: "h", text: "Adjust honestly" },
      { type: "p", text: "If your copy is a half-grade lower, a different variant, or missing an insert, discount for it. Buyers will, so you should too." },
      { type: "callout", text: "Trust the median of many, not the maximum of one." },
    ],
  },

  // ── Playbooks ─────────────────────────────────────────────────────
  {
    slug: "getting-started",
    title: "Getting Started",
    dek: "Your first 7 steps in VLTD.",
    category: "Playbook",
    readMinutes: 5,
    glyph: "sparkle",
    kind: "playbook",
    body: [
      { type: "p", text: "New to VLTD? Do these seven things and your collection goes from a pile of stuff to a documented, valued, shareable vault." },
      { type: "steps", items: [
        "Add your first item — scan a photo or enter it manually.",
        "Set the details that matter: universe, category, grade, and cert number.",
        "Add a purchase price so your portfolio math works.",
        "Photograph front, back, and any flaws.",
        "Set a current value from recent comps.",
        "Build a public gallery or exhibition to show it off.",
        "Turn on insurance readiness so your record is claim-ready.",
      ] },
      { type: "callout", text: "You don't have to do it all at once. Add a few items, get the rhythm, and the rest follows." },
    ],
  },
  {
    slug: "protect-your-collection",
    title: "Protect Your Collection",
    dek: "Insurance, storage, and documentation.",
    category: "Playbook",
    readMinutes: 6,
    glyph: "shield",
    kind: "playbook",
    body: [
      { type: "p", text: "Protection is three layers: the physical item, the record that proves it, and the coverage that pays if something goes wrong." },
      { type: "steps", items: [
        "Store items in stable, archival-safe conditions out of sunlight and humidity.",
        "Photograph and document every item, including flaws and cert numbers.",
        "Record purchase price and keep current values updated.",
        "Export an itemized, valued inventory for your insurer.",
        "Schedule high-value pieces or add specialty collectibles coverage.",
        "Re-check values and coverage as the collection grows.",
      ] },
      { type: "callout", text: "See Insurance Basics for Collectors for how coverage actually works. Confirm specifics with a licensed insurer or appraiser." },
    ],
  },
  {
    slug: "value-with-confidence",
    title: "Value With Confidence",
    dek: "Pricing, comps, and market timing.",
    category: "Playbook",
    readMinutes: 6,
    glyph: "chart",
    kind: "playbook",
    body: [
      { type: "p", text: "Confident valuation is a habit, not a one-time guess. This playbook keeps your numbers honest and current." },
      { type: "steps", items: [
        "Find recent sold comps for the exact item and grade.",
        "Read the range and the count — trust clusters, discount outliers.",
        "Adjust for your item's specific condition and variant.",
        "Subtract fees to understand your real net.",
        "Update the value in your vault so your portfolio reflects reality.",
        "Watch release and season timing before you buy or sell.",
      ] },
      { type: "callout", text: "Dig deeper in Pricing With Confidence and Understanding Market Comps." },
    ],
  },
  {
    slug: "share-and-showcase",
    title: "Share & Showcase",
    dek: "Exhibitions, galleries, and stream mode.",
    category: "Playbook",
    readMinutes: 5,
    glyph: "exhibition",
    kind: "playbook",
    body: [
      { type: "p", text: "Your collection is more fun shared. VLTD gives you a few ways to put it in front of people." },
      { type: "steps", items: [
        "Curate a public gallery around a clear theme.",
        "Build an exhibition with a hero piece and a real through-line.",
        "Write captions that give each item context.",
        "Share the link anywhere — social, forums, or direct to a collector.",
        "Use stream mode when you're showing live.",
      ] },
      { type: "callout", text: "Building Great Exhibitions covers how to curate rooms people actually remember." },
    ],
  },
  {
    slug: "sell-anywhere",
    title: "Sell Anywhere",
    dek: "List, export, and close the deal.",
    category: "Playbook",
    readMinutes: 6,
    glyph: "tag",
    kind: "playbook",
    body: [
      { type: "p", text: "When you're ready to sell, a complete record lets you list anywhere without redoing the work." },
      { type: "steps", items: [
        "Confirm the item's details, grade, and cert are accurate.",
        "Price it from recent sold comps in the same condition.",
        "Export the record and photos for your chosen venue.",
        "Pick the right venue for the item — auction, marketplace, or direct.",
        "List with honest condition notes and sharp photos.",
        "Track the sale so your portfolio and history stay accurate.",
      ] },
      { type: "callout", text: "Read Before You Sell From Your Collection for the full pre-sale checklist." },
    ],
  },

  // ── Quick guides ──────────────────────────────────────────────────
  {
    slug: "scan-and-add",
    title: "Scan & Add Items",
    dek: "From photos to a complete record.",
    category: "Quick Guide",
    readMinutes: 3,
    glyph: "search",
    kind: "quick",
    body: [
      { type: "p", text: "The fastest way to build your vault is to let a photo do the first draft." },
      { type: "steps", items: [
        "Open Scan and photograph the item.",
        "Review the details it pulls — title, set, and category.",
        "Fix anything that's off and add the grade or cert number.",
        "Add a purchase price and save it to your vault.",
      ] },
      { type: "callout", text: "Scan gets you 80% of the way; a quick review makes the record accurate and insurable." },
    ],
  },
  {
    slug: "insurance-readiness",
    title: "Insurance Readiness Checklist",
    dek: "Make sure you're fully protected.",
    category: "Quick Guide",
    readMinutes: 3,
    glyph: "check",
    kind: "quick",
    body: [
      { type: "p", text: "Run this checklist before you assume you're covered." },
      { type: "list", items: [
        "Every high-value item is photographed, front and back.",
        "Grades and cert numbers are recorded.",
        "Purchase prices and current values are filled in.",
        "You can export an itemized, valued inventory.",
        "Standout pieces are scheduled or on a specialty policy.",
        "Values are current, not years out of date.",
      ] },
      { type: "callout", text: "If any box is unchecked, start there. Insurance Basics explains why each one matters." },
    ],
  },
  {
    slug: "export-and-sell",
    title: "Export & Sell Anywhere",
    dek: "List on eBay, Heritage, PWCC, and more.",
    category: "Quick Guide",
    readMinutes: 3,
    glyph: "cart",
    kind: "quick",
    body: [
      { type: "p", text: "Your VLTD record is portable. Export once, list anywhere." },
      { type: "steps", items: [
        "Open the item and choose Export.",
        "Grab the photos and the detail sheet.",
        "Paste into your marketplace or auction listing.",
        "Add honest condition notes and your comp-based price.",
      ] },
      { type: "callout", text: "A complete, honest listing lowers buyer risk — which is what gets you real offers." },
    ],
  },
];

// ── Lookups & groupings ─────────────────────────────────────────────
export function getArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug);
}

export const FEATURED_ARTICLE = LEARN_ARTICLES.find((a) => a.kind === "featured")!;
export const GUIDE_ARTICLES = LEARN_ARTICLES.filter((a) => a.kind === "guide");
export const PLAYBOOK_ARTICLES = LEARN_ARTICLES.filter((a) => a.kind === "playbook");
export const QUICK_ARTICLES = LEARN_ARTICLES.filter((a) => a.kind === "quick");
