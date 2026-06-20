"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductCategory =
  | "all"
  | "sleeves"
  | "slabs"
  | "display"
  | "storage"
  | "binders"
  | "tools"
  | "grading";

type Product = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  tags: string[];
  price: string;
  emoji: string;
  description: string;
  url: string;
  badge?: string;
};

const CATEGORIES: { key: ProductCategory; label: string; emoji: string }[] = [
  { key: "all",     label: "All",          emoji: "🛍️" },
  { key: "sleeves", label: "Card Sleeves",  emoji: "🃏" },
  { key: "slabs",   label: "Slabs & Cases", emoji: "🔲" },
  { key: "display", label: "Display Cases", emoji: "🏛️" },
  { key: "storage", label: "Storage Boxes", emoji: "📦" },
  { key: "binders", label: "Binders",       emoji: "📒" },
  { key: "tools",   label: "Tools",         emoji: "🔧" },
  { key: "grading", label: "Grading Prep",  emoji: "⭐" },
];

const PRODUCTS: Product[] = [
  // ── Sleeves ──────────────────────────────────────────────────────────────
  {
    id: "sleeve-dragon-perfect",
    name: "Dragon Shield Perfect Fit Sealable",
    brand: "Dragon Shield",
    category: "sleeves",
    tags: ["TCG", "Sports"],
    price: "$7–$9",
    emoji: "🐉",
    description: "Inner sleeves for double-sleeving. Sealable to lock cards in place.",
    url: "https://www.amazon.com/s?k=dragon+shield+perfect+fit+sealable",
    badge: "Best Seller",
  },
  {
    id: "sleeve-dragon-matte",
    name: "Dragon Shield Matte Sleeves",
    brand: "Dragon Shield",
    category: "sleeves",
    tags: ["TCG", "Sports"],
    price: "$10–$14",
    emoji: "🛡️",
    description: "100-pack premium matte finish. Non-glare surface perfect for shuffling.",
    url: "https://www.amazon.com/s?k=dragon+shield+matte+sleeves+100",
  },
  {
    id: "sleeve-ultra-pro-penny",
    name: "Ultra PRO Penny Sleeves",
    brand: "Ultra PRO",
    category: "sleeves",
    tags: ["TCG", "Sports", "Budget"],
    price: "$2–$5",
    emoji: "💰",
    description: "100-pack basic poly sleeves. Great for bulk storage or budget protection.",
    url: "https://www.amazon.com/s?k=ultra+pro+penny+sleeves+100",
  },
  {
    id: "sleeve-magnetic-one",
    name: "One-Touch Magnetic Card Holder",
    brand: "Ultra PRO",
    category: "sleeves",
    tags: ["Sports", "TCG", "Display"],
    price: "$1–$3 each",
    emoji: "🧲",
    description: "Rigid magnetic snap case. Perfect for single-card display and protection.",
    url: "https://www.amazon.com/s?k=ultra+pro+one+touch+magnetic+card+holder",
    badge: "Popular",
  },

  // ── Slabs ─────────────────────────────────────────────────────────────────
  {
    id: "slab-psa-sub",
    name: "PSA Grading Submission",
    brand: "PSA",
    category: "slabs",
    tags: ["Sports", "TCG"],
    price: "From $25/card",
    emoji: "🏆",
    description: "The gold standard. PSA-graded cards carry the highest market premiums.",
    url: "https://www.psacard.com/services/tradingcardgrading",
    badge: "Most Trusted",
  },
  {
    id: "slab-bgs-sub",
    name: "BGS / Beckett Grading",
    brand: "Beckett",
    category: "slabs",
    tags: ["Sports", "TCG"],
    price: "From $22/card",
    emoji: "📊",
    description: "Sub-grades for centering, corners, edges, and surface. Loved by vintage sports collectors.",
    url: "https://www.beckett.com/grading",
  },
  {
    id: "slab-cgc-sub",
    name: "CGC Comics Grading",
    brand: "CGC",
    category: "slabs",
    tags: ["Comics"],
    price: "From $38/book",
    emoji: "💥",
    description: "Industry leader for comic book grading. Universal label for standard issues.",
    url: "https://www.cgccomics.com/submit/",
  },
  {
    id: "slab-wata-sub",
    name: "WATA Games Grading",
    brand: "WATA",
    category: "slabs",
    tags: ["Games"],
    price: "From $50/game",
    emoji: "🎮",
    description: "Certified grading for video games and cartridges. Seal rating + box grade.",
    url: "https://www.watagames.com/",
  },

  // ── Display Cases ─────────────────────────────────────────────────────────
  {
    id: "display-wall-mount",
    name: "Wall-Mount Acrylic Card Display",
    brand: "Various",
    category: "display",
    tags: ["Sports", "TCG", "Vinyl"],
    price: "$15–$40",
    emoji: "🖼️",
    description: "UV-blocking acrylic frames designed for wall display of graded or raw cards.",
    url: "https://www.amazon.com/s?k=wall+mount+acrylic+card+display+frame",
  },
  {
    id: "display-case-acrylic",
    name: "Acrylic Graded Card Stand",
    brand: "Various",
    category: "display",
    tags: ["Sports", "TCG"],
    price: "$5–$15",
    emoji: "🔲",
    description: "Desk stand for graded slabs. Angled or upright styles available.",
    url: "https://www.amazon.com/s?k=acrylic+graded+card+stand+display",
  },
  {
    id: "display-vinyl-frame",
    name: "Vinyl Record Wall Frame",
    brand: "Various",
    category: "display",
    tags: ["Vinyl"],
    price: "$12–$30",
    emoji: "🎵",
    description: "Display your most prized records on the wall. Floats record in front of sleeves.",
    url: "https://www.amazon.com/s?k=vinyl+record+wall+display+frame",
    badge: "Fan Fave",
  },
  {
    id: "display-funko-case",
    name: "Funko Pop! Acrylic Protector Case",
    brand: "Various",
    category: "display",
    tags: ["Toys"],
    price: "$5–$12",
    emoji: "🗿",
    description: "Clear acrylic cases sized for standard Funko Pop boxes. UV-resistant options available.",
    url: "https://www.amazon.com/s?k=funko+pop+acrylic+protector+case",
  },

  // ── Storage Boxes ─────────────────────────────────────────────────────────
  {
    id: "storage-800ct",
    name: "BCW 800-Count Storage Box",
    brand: "BCW",
    category: "storage",
    tags: ["Sports", "TCG"],
    price: "$3–$6",
    emoji: "📦",
    description: "Corrugated cardboard storage boxes. Holds ~800 single-sleeved cards or 400 double-sleeved.",
    url: "https://www.amazon.com/s?k=bcw+800+count+card+storage+box",
    badge: "Best Value",
  },
  {
    id: "storage-longbox-comic",
    name: "BCW Short Comic Book Box",
    brand: "BCW",
    category: "storage",
    tags: ["Comics"],
    price: "$7–$12",
    emoji: "📚",
    description: "Acid-free corrugated boxes designed for comic book storage. Holds ~175 bagged & boarded comics.",
    url: "https://www.amazon.com/s?k=bcw+short+comic+book+box",
  },
  {
    id: "storage-vinyl-crate",
    name: "Vinyl Record Storage Crate",
    brand: "Various",
    category: "storage",
    tags: ["Vinyl"],
    price: "$25–$60",
    emoji: "🗃️",
    description: "Wooden or plastic crates sized for 12\" LPs. Holds 50–80 records upright.",
    url: "https://www.amazon.com/s?k=vinyl+record+storage+crate+wood",
  },

  // ── Binders ───────────────────────────────────────────────────────────────
  {
    id: "binder-ultra-pro-9",
    name: "Ultra PRO 9-Pocket Binder",
    brand: "Ultra PRO",
    category: "binders",
    tags: ["TCG", "Sports"],
    price: "$12–$25",
    emoji: "📓",
    description: "9-pocket pages for 360-card binders. D-ring or O-ring options. Available in many colors.",
    url: "https://www.amazon.com/s?k=ultra+pro+9+pocket+binder+trading+cards",
  },
  {
    id: "binder-vault-x",
    name: "Vault X 9-Pocket Exo-Tec Binder",
    brand: "Vault X",
    category: "binders",
    tags: ["TCG", "Sports"],
    price: "$20–$35",
    emoji: "🔐",
    description: "Side-loading pockets and a zippered outer shell. Prevents cards from falling out.",
    url: "https://www.amazon.com/s?k=vault+x+exo-tec+9+pocket+binder",
    badge: "Collector Fave",
  },
  {
    id: "binder-comic",
    name: "Comic Book Storage Binder",
    brand: "BCW",
    category: "binders",
    tags: ["Comics"],
    price: "$15–$20",
    emoji: "🦸",
    description: "3-inch D-ring binder with comic-sized pockets. Stores up to 28 bagged comics.",
    url: "https://www.amazon.com/s?k=comic+book+binder+storage",
  },

  // ── Tools ─────────────────────────────────────────────────────────────────
  {
    id: "tools-cotton-gloves",
    name: "Cotton Handling Gloves",
    brand: "Various",
    category: "tools",
    tags: ["All"],
    price: "$5–$10",
    emoji: "🧤",
    description: "Lint-free cotton gloves for handling raw cards, books, and vinyl without skin oils.",
    url: "https://www.amazon.com/s?k=cotton+handling+gloves+archival",
  },
  {
    id: "tools-loupe",
    name: "10x Jeweler's Loupe",
    brand: "Various",
    category: "tools",
    tags: ["All"],
    price: "$8–$20",
    emoji: "🔍",
    description: "10x magnification for inspecting card edges, surface scratches, and print defects.",
    url: "https://www.amazon.com/s?k=10x+jewelers+loupe+magnifying+glass",
  },
  {
    id: "tools-uv-light",
    name: "UV Black Light Flashlight",
    brand: "Various",
    category: "tools",
    tags: ["Sports", "TCG", "Comics"],
    price: "$10–$25",
    emoji: "🔦",
    description: "Reveals restoration, trimming, and reprints invisible to the naked eye.",
    url: "https://www.amazon.com/s?k=uv+blacklight+flashlight+authentication",
  },
  {
    id: "tools-centering-tool",
    name: "Card Centering Tool",
    brand: "Various",
    category: "tools",
    tags: ["Sports", "TCG"],
    price: "$5–$15",
    emoji: "📐",
    description: "Precision ruler for measuring left/right and top/bottom centering percentages pre-submission.",
    url: "https://www.amazon.com/s?k=card+centering+tool+grading",
  },

  // ── Grading Prep ─────────────────────────────────────────────────────────
  {
    id: "grading-submission-sleeves",
    name: "Grading Submission Sleeves",
    brand: "PSA / BGS",
    category: "grading",
    tags: ["Sports", "TCG"],
    price: "$5–$10",
    emoji: "📫",
    description: "Specially sized poly sleeves for submission packaging. Fits PSA and BGS requirements.",
    url: "https://www.amazon.com/s?k=card+grading+submission+sleeves",
  },
  {
    id: "grading-team-bags",
    name: "Resealable Team Bags",
    brand: "Ultra PRO",
    category: "grading",
    tags: ["Sports", "TCG", "Comics"],
    price: "$5–$12",
    emoji: "🗂️",
    description: "Acid-free resealable poly bags for comics and oversized cards. Standard grading requirement.",
    url: "https://www.amazon.com/s?k=ultra+pro+team+bags+resealable",
  },
  {
    id: "grading-bubble-mailer",
    name: "Bubble Mailers 6x9\"",
    brand: "Various",
    category: "grading",
    tags: ["All"],
    price: "$8–$15 /25pk",
    emoji: "✉️",
    description: "Padded self-sealing mailers for safely shipping cards, comics, and small items.",
    url: "https://www.amazon.com/s?k=bubble+mailers+6x9+shipping",
  },
  {
    id: "grading-card-saver",
    name: "Card Saver I Semi-Rigid Holders",
    brand: "Card Saver",
    category: "grading",
    tags: ["Sports", "TCG"],
    price: "$10–$15 /200pk",
    emoji: "🦺",
    description: "Semi-rigid Card Saver I holders required by PSA and many other graders for submission.",
    url: "https://www.amazon.com/s?k=card+saver+1+semi+rigid+holders",
    badge: "PSA Required",
  },
];

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)] hover:shadow-lg"
      style={{ background: "var(--surface)" }}
    >
      {/* Emoji thumbnail */}
      <div
        className="flex items-center justify-center text-5xl"
        style={{
          background: "var(--pill)",
          aspectRatio: "4 / 3",
          minHeight: 0,
        }}
      >
        {product.emoji}
      </div>

      <div className="flex flex-col flex-1 gap-2 p-3">
        {/* Badge */}
        {product.badge && (
          <span
            className="self-start rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
          >
            {product.badge}
          </span>
        )}

        {/* Name */}
        <div className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--fg)" }}>
          {product.name}
        </div>
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          {product.brand}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {product.tags.map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{ background: "var(--pill)", color: "var(--muted)" }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="text-[11px] line-clamp-2 flex-1" style={{ color: "var(--muted)" }}>
          {product.description}
        </div>

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="text-sm font-bold" style={{ color: "var(--theme-gold)" }}>
            {product.price}
          </div>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-[color:var(--border)] group-hover:ring-[color:var(--theme-gold)] transition"
            style={{ background: "var(--pill)", color: "var(--fg)" }}
          >
            Shop →
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShopPage() {
  const [category, setCategory] = useState<ProductCategory>("all");
  const [search, setSearch] = useState("");

  const displayed = PRODUCTS.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm" style={{ color: "var(--muted)" }}>VLTD</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Shop</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Collector&apos;s Shop</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Essential supplies for protecting, storing, and displaying your collection.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="rounded-xl px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", minWidth: 200 }}
            />
          </div>

          {/* Category tabs */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const count = c.key === "all" ? PRODUCTS.length : PRODUCTS.filter((p) => p.category === c.key).length;
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition inline-flex items-center gap-1"
                  style={{
                    background: category === c.key ? "var(--theme-gold)" : "var(--pill)",
                    color: category === c.key ? "#0B0B0B" : "var(--fg)",
                  }}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                  <span className="text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>No products match your search.</div>
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              className="mt-3 text-sm underline"
              style={{ color: "var(--theme-gold)" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
              {displayed.length} product{displayed.length !== 1 ? "s" : ""}
              {search && <span> matching &ldquo;{search}&rdquo;</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {displayed.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mx-auto max-w-6xl px-4 pb-12 text-center text-xs" style={{ color: "var(--muted)" }}>
        VLTD links to Amazon and grading company websites for convenience. VLTD does not sell these products
        directly and earns no commissions. All prices are approximate and may vary.
      </div>
    </div>
  );
}
