// web/src/lib/demoVault.ts
export type Category = "COMICS" | "SPORTS" | "POKEMON" | "MTG" | "CUSTOM";

export type VaultItem = {
  id: string;
  category: Category;
  customCategoryLabel?: string;
  title: string;
  subtitle?: string; // series/set
  number?: string; // issue/card number
  grade?: string;
  purchasePrice: number;
  currentValue: number;
  categoryContextLabel: string; // used for loss context
  valueChange30dPct: number; // +12.3 or -8.4
};

export const DEMO_ITEMS: VaultItem[] = [
  {
    id: "c1",
    category: "COMICS",
    title: "Amazing Spider-Man",
    subtitle: "Key Issue",
    number: "#300",
    grade: "CGC 9.6",
    purchasePrice: 220,
    currentValue: 285,
    categoryContextLabel: "Comics (Modern Keys)",
    valueChange30dPct: 7.5,
  },
  {
    id: "c2",
    category: "COMICS",
    title: "Batman",
    subtitle: "Key Issue",
    number: "#423",
    grade: "CGC 9.4",
    purchasePrice: 180,
    currentValue: 150,
    categoryContextLabel: "Comics (Modern Keys)",
    valueChange30dPct: -12.2,
  },
  {
    id: "s1",
    category: "SPORTS",
    title: "Michael Jordan",
    subtitle: "Fleer",
    number: "1986 #57",
    grade: "PSA 8",
    purchasePrice: 900,
    currentValue: 1125,
    categoryContextLabel: "Sports Cards (Vintage)",
    valueChange30dPct: 4.8,
  },
  {
    id: "p1",
    category: "POKEMON",
    title: "Charizard",
    subtitle: "Base Set",
    number: "#4/102",
    grade: "PSA 9",
    purchasePrice: 650,
    currentValue: 610,
    categoryContextLabel: "Pokémon (Vintage)",
    valueChange30dPct: -6.0,
  },
  {
    id: "m1",
    category: "MTG",
    title: "Underground Sea",
    subtitle: "Revised",
    number: "",
    grade: "NM",
    purchasePrice: 520,
    currentValue: 590,
    categoryContextLabel: "MTG (Reserved List)",
    valueChange30dPct: 3.2,
  },
  {
    id: "x1",
    category: "CUSTOM",
    customCategoryLabel: "Art Cards",
    title: "Artist Proof",
    subtitle: "Limited Print",
    number: "AP-12",
    grade: "Mint",
    purchasePrice: 45,
    currentValue: 80,
    categoryContextLabel: "Collector’s Choice",
    valueChange30dPct: 9.1,
  },
  // --- More Comics ---
  { id: "c3", category: "COMICS", title: "X-Men", subtitle: "Key Issue", number: "#1", grade: "CGC 6.5", purchasePrice: 1200, currentValue: 1450, categoryContextLabel: "Comics (Silver Age)", valueChange30dPct: 3.1 },
  { id: "c4", category: "COMICS", title: "Fantastic Four", subtitle: "Key Issue", number: "#48", grade: "CGC 5.0", purchasePrice: 900, currentValue: 980, categoryContextLabel: "Comics (Silver Age)", valueChange30dPct: 1.8 },
  { id: "c5", category: "COMICS", title: "The Walking Dead", subtitle: "Key Issue", number: "#1", grade: "CGC 9.2", purchasePrice: 420, currentValue: 510, categoryContextLabel: "Comics (Modern Keys)", valueChange30dPct: 4.2 },
  { id: "c6", category: "COMICS", title: "Spawn", subtitle: "Key Issue", number: "#1", grade: "CGC 9.8", purchasePrice: 180, currentValue: 220, categoryContextLabel: "Comics (90s)", valueChange30dPct: 2.6 },
  { id: "c7", category: "COMICS", title: "Daredevil", subtitle: "Key Issue", number: "#1", grade: "CGC 4.0", purchasePrice: 800, currentValue: 760, categoryContextLabel: "Comics (Silver Age)", valueChange30dPct: -1.9 },
  { id: "c8", category: "COMICS", title: "Teenage Mutant Ninja Turtles", subtitle: "Key Issue", number: "#1", grade: "CGC 7.0", purchasePrice: 1600, currentValue: 1900, categoryContextLabel: "Comics (Indie Keys)", valueChange30dPct: 5.9 },
  { id: "c9", category: "COMICS", title: "Iron Man", subtitle: "Key Issue", number: "#1", grade: "CGC 6.0", purchasePrice: 540, currentValue: 520, categoryContextLabel: "Comics (Silver Age)", valueChange30dPct: -0.7 },
  { id: "c10", category: "COMICS", title: "Venom: Lethal Protector", subtitle: "Mini-Series", number: "#1", grade: "NM", purchasePrice: 18, currentValue: 35, categoryContextLabel: "Comics (90s)", valueChange30dPct: 6.4 },

  // --- More Sports Cards ---
  { id: "s2", category: "SPORTS", title: "LeBron James", subtitle: "Topps Chrome", number: "2003 Rookie", grade: "PSA 9", purchasePrice: 260, currentValue: 310, categoryContextLabel: "Sports Cards (Modern)", valueChange30dPct: 2.2 },
  { id: "s3", category: "SPORTS", title: "Tom Brady", subtitle: "Bowman", number: "2000 Rookie", grade: "PSA 8", purchasePrice: 480, currentValue: 430, categoryContextLabel: "Sports Cards (Modern)", valueChange30dPct: -3.5 },
  { id: "s4", category: "SPORTS", title: "Kobe Bryant", subtitle: "Topps", number: "1996 Rookie", grade: "PSA 9", purchasePrice: 240, currentValue: 285, categoryContextLabel: "Sports Cards (90s)", valueChange30dPct: 4.1 },
  { id: "s5", category: "SPORTS", title: "Shohei Ohtani", subtitle: "Topps", number: "2018 Rookie", grade: "PSA 10", purchasePrice: 120, currentValue: 155, categoryContextLabel: "Sports Cards (Modern)", valueChange30dPct: 3.7 },
  { id: "s6", category: "SPORTS", title: "Stephen Curry", subtitle: "Topps", number: "2009 Rookie", grade: "PSA 9", purchasePrice: 140, currentValue: 160, categoryContextLabel: "Sports Cards (Modern)", valueChange30dPct: 1.1 },
  { id: "s7", category: "SPORTS", title: "Patrick Mahomes", subtitle: "Optic", number: "2017 Rookie", grade: "PSA 10", purchasePrice: 95, currentValue: 80, categoryContextLabel: "Sports Cards (Modern)", valueChange30dPct: -5.6 },

  // --- More Pokémon ---
  { id: "p2", category: "POKEMON", title: "Blastoise", subtitle: "Base Set", number: "#2/102", grade: "PSA 8", purchasePrice: 160, currentValue: 180, categoryContextLabel: "Pokémon (Vintage)", valueChange30dPct: 2.0 },
  { id: "p3", category: "POKEMON", title: "Venusaur", subtitle: "Base Set", number: "#15/102", grade: "PSA 9", purchasePrice: 140, currentValue: 135, categoryContextLabel: "Pokémon (Vintage)", valueChange30dPct: -1.2 },
  { id: "p4", category: "POKEMON", title: "Pikachu", subtitle: "Promo", number: "Special", grade: "NM", purchasePrice: 12, currentValue: 22, categoryContextLabel: "Pokémon (Modern)", valueChange30dPct: 8.3 },
  { id: "p5", category: "POKEMON", title: "Lugia", subtitle: "Neo Genesis", number: "#9", grade: "PSA 9", purchasePrice: 220, currentValue: 260, categoryContextLabel: "Pokémon (Vintage)", valueChange30dPct: 3.9 },
  { id: "p6", category: "POKEMON", title: "Rayquaza", subtitle: "EX", number: "Secret Rare", grade: "NM", purchasePrice: 55, currentValue: 70, categoryContextLabel: "Pokémon (Modern)", valueChange30dPct: 4.4 },
  { id: "p7", category: "POKEMON", title: "Gengar", subtitle: "Fossil", number: "#5/62", grade: "PSA 8", purchasePrice: 75, currentValue: 68, categoryContextLabel: "Pokémon (Vintage)", valueChange30dPct: -2.6 },

  // --- More MTG ---
  { id: "m2", category: "MTG", title: "Volcanic Island", subtitle: "Revised", number: "", grade: "NM", purchasePrice: 650, currentValue: 710, categoryContextLabel: "MTG (Reserved List)", valueChange30dPct: 2.9 },
  { id: "m3", category: "MTG", title: "Tropical Island", subtitle: "Revised", number: "", grade: "LP", purchasePrice: 590, currentValue: 560, categoryContextLabel: "MTG (Reserved List)", valueChange30dPct: -1.4 },
  { id: "m4", category: "MTG", title: "Mox Diamond", subtitle: "Stronghold", number: "", grade: "NM", purchasePrice: 420, currentValue: 460, categoryContextLabel: "MTG (Reserved List)", valueChange30dPct: 3.3 },
  { id: "m5", category: "MTG", title: "Gaea’s Cradle", subtitle: "Urza’s Saga", number: "", grade: "NM", purchasePrice: 780, currentValue: 820, categoryContextLabel: "MTG (Reserved List)", valueChange30dPct: 1.6 },
  { id: "m6", category: "MTG", title: "Sol Ring", subtitle: "Commander", number: "", grade: "NM", purchasePrice: 3, currentValue: 6, categoryContextLabel: "MTG (Staples)", valueChange30dPct: 5.0 },
  { id: "m7", category: "MTG", title: "The One Ring", subtitle: "LTR", number: "", grade: "NM", purchasePrice: 55, currentValue: 42, categoryContextLabel: "MTG (Modern)", valueChange30dPct: -7.9 },

  // --- More Collector’s Choice / Misc ---
  { id: "x2", category: "CUSTOM", customCategoryLabel: "Art Cards", title: "Signed Sketch Card", subtitle: "Convention", number: "SC-07", grade: "Mint", purchasePrice: 90, currentValue: 120, categoryContextLabel: "Collector’s Choice", valueChange30dPct: 6.7 },
  { id: "x3", category: "CUSTOM", customCategoryLabel: "Art Cards", title: "Limited Artist Print", subtitle: "Numbered", number: "12/50", grade: "Mint", purchasePrice: 35, currentValue: 30, categoryContextLabel: "Collector’s Choice", valueChange30dPct: -1.8 },
  { id: "x4", category: "CUSTOM", customCategoryLabel: "Sketch Covers", title: "Blank Cover Sketch", subtitle: "Original Art", number: "", grade: "NM", purchasePrice: 110, currentValue: 150, categoryContextLabel: "Collector’s Choice", valueChange30dPct: 4.9 },
  { id: "x5", category: "CUSTOM", customCategoryLabel: "Art Cards", title: "Foil Art Variant", subtitle: "Limited Print", number: "LV-3", grade: "Mint", purchasePrice: 25, currentValue: 40, categoryContextLabel: "Collector’s Choice", valueChange30dPct: 7.1 },
  
];

export function getTotals(items: VaultItem[]) {
  const totalValue = items.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCost = items.reduce((sum, i) => sum + i.purchasePrice, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  const biggestGainer = [...items].sort(
    (a, b) => (b.currentValue - b.purchasePrice) - (a.currentValue - a.purchasePrice)
  )[0];

  const biggestLoser = [...items].sort(
    (a, b) => (a.currentValue - a.purchasePrice) - (b.currentValue - b.purchasePrice)
  )[0];

  // “Holding strong” if all items have near-zero movement
  const hasMovement = items.some((i) => Math.abs(i.valueChange30dPct) >= 0.5);

  return { totalValue, totalCost, totalGain, totalGainPct, biggestGainer, biggestLoser, hasMovement };
}

export function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}