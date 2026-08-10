"use client";

import Link from "next/link";
import { Glyph, emojiGlyphName } from "@/components/ui/Glyph";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Feature = {
  id: string;
  number: number;
  emoji: string;
  name: string;
  location: string;
  locationHref: string;
  tagline: string;
  why: string;
  what: string[];
  value: string;
  category: "marketplace" | "vault" | "sales" | "goals" | "social";
};

const FEATURES: Feature[] = [
  {
    id: "registry-rank",
    number: 4,
    emoji: "👥",
    name: "Registry Rank",
    location: "Item Detail",
    locationHref: "/vault",
    tagline: "See how many collectors are tracking the same subject as your item.",
    why: "Your items are not just objects — they are part of living collector markets. Registry Rank surfaces that social context right on the item page.",
    what: [
      "Fetches live registry data for the item's subject tag",
      "Shows a clickable pill linking to the full registry leaderboard",
      "Displays a collector count next to a people icon: 'X collectors tracking'",
    ],
    value: "Social proof and market context at a glance — know whether you are holding something rare or widely collected.",
    category: "vault",
  },
  {
    id: "market-pulse",
    number: 1,
    emoji: "📊",
    name: "Market Pulse",
    location: "Discover",
    locationHref: "/discover",
    tagline: "A live snapshot of which collecting categories are hottest right now.",
    why: "Collectors should not have to browse blind. Market Pulse surfaces where activity is concentrated before you spend time digging.",
    what: [
      "6-column category grid: TCG, Sports, Music, Jewelry, Games, Pop Culture",
      "Proportional view bars relative to the top category",
      "HOT badge on the most-viewed category",
      "Appears between trending galleries and the main grid on the Discover page",
    ],
    value: "Know where the action is before you browse. Discover new categories you might be sleeping on.",
    category: "marketplace",
  },
  {
    id: "listing-readiness",
    number: 10,
    emoji: "✅",
    name: "Listing Readiness",
    location: "Vault / Readiness",
    locationHref: "/vault/readiness",
    tagline: "Know exactly what is standing between your listing and a sale.",
    why: "Sellers often do not know why their listings are not getting traction. Listing Readiness gives actionable pre-flight feedback.",
    what: [
      "Scores each FOR_SALE item 0-100 across 6 checks: title, price, photo, grade, description, subject",
      "Three levels: Ready (all required met + score >= 80), Almost (required met, < 80), Needs work (missing required)",
      "/vault/readiness: all listings sorted by score with filter tabs",
      "Inline readiness panel on item detail when status is For Sale",
    ],
    value: "No more guessing. Fix the 1-2 things that matter most before sharing your listing.",
    category: "vault",
  },
  {
    id: "goals",
    number: 11,
    emoji: "🎯",
    name: "Goals: Browse, Milestones & Notes",
    location: "Goals",
    locationHref: "/goals",
    tagline: "Turn collection goals into an actionable checklist with direct vault links.",
    why: "Goals were useful for tracking but did not help collectors take the next step toward completing them.",
    what: [
      "Browse vault button: jumps to pre-filtered vault by universe + subject",
      "Milestone tick marks at 25/50/75% on the progress bar",
      "Hint label: '4 more to 50%' showing items needed to reach the next milestone",
      "Notes display: personal reminders about why the goal matters",
      "Trophy badge on completion, green 'Almost there' badge when close",
    ],
    value: "One tap from a goal to the vault items that count toward it. Goals feel achievable, not abstract.",
    category: "goals",
  },
  {
    id: "grading-chips",
    number: 2,
    emoji: "🏷️",
    name: "Grading Service Chips",
    location: "Market",
    locationHref: "/market",
    tagline: "Instantly see which grading company authenticated each listed card.",
    why: "PSA, BGS, SGC, CGC each carry different reputations and price implications. Collectors need to know before clicking in.",
    what: [
      "PSA badge in blue",
      "BGS/Beckett badge in green",
      "SGC badge in orange",
      "CGC badge in purple",
      "CSG badge in pink",
      "Certified checkmark chip when a cert number is present",
    ],
    value: "Filter by grading service visually — no need to open each listing to check authentication.",
    category: "marketplace",
  },
  {
    id: "sales-history",
    number: 5,
    emoji: "📈",
    name: "Sales History: Sparkline & Stat Pills",
    location: "Sales",
    locationHref: "/sales",
    tagline: "Your complete sales performance at a glance — totals, trends, and P&L.",
    why: "Serious sellers need headline numbers and visual trends, not just a scrollable list of individual transactions.",
    what: [
      "Sparkline: mini SVG bar chart of monthly revenue for the last 12 months",
      "Stat pills: total sold, total P&L, win count, loss count",
      "P&L color-coded green (profit) or red (loss) per sale",
      "Thumbnails cross-referenced from the vault for each sale card",
    ],
    value: "Know your best and worst performers instantly. Track whether your selling activity is growing or contracting.",
    category: "sales",
  },
  {
    id: "sold-filters",
    number: 8,
    emoji: "🔍",
    name: "Sold Items Filter & Search",
    location: "Vault / Sold",
    locationHref: "/vault/sold",
    tagline: "Find any past sale in seconds, no matter how large your history.",
    why: "Once sold item counts grow past a few dozen, scrolling becomes impractical. Filtering keeps the archive useful.",
    what: [
      "Search by title — live filtering as you type",
      "Universe filter pills shown when more than 2 universes are represented",
      "Graceful empty state with clear messaging when no matches found",
    ],
    value: "Your sales history stays searchable no matter how long you have been selling.",
    category: "sales",
  },
  {
    id: "social-export",
    number: 9,
    emoji: "📤",
    name: "Social Export Share Button",
    location: "Item Detail → Share",
    locationHref: "/vault",
    tagline: "Generate a collector card image and share it to social — in one tap.",
    why: "Collectors were generating beautiful card images but then had to manually download and re-upload. The share button closes the loop.",
    what: [
      "Appears in the social export sheet when the Web Share API is available (mobile and some desktop)",
      "Fetches the rendered card image as a blob",
      "Creates a named file: vltd-[item-slug].png",
      "Invokes the native OS share sheet with the image attached",
    ],
    value: "On mobile: generate a card image and share to Instagram Stories, Twitter, or Messages without leaving VLTD.",
    category: "social",
  },
  {
    id: "freshness-badge",
    number: 3,
    emoji: "🕐",
    name: "Listing Freshness Badge",
    location: "Market",
    locationHref: "/market",
    tagline: "See how long a listing has been on the market before you inquire.",
    why: "Buyers want to know if they are looking at a fresh listing or something that has been sitting — it affects price negotiation and seller responsiveness.",
    what: [
      "Replaces the static 'FOR SALE' badge on each market listing card",
      "'Today' for same-day listings",
      "'3d ago', '2w ago', '1mo ago' labels for older listings",
    ],
    value: "Fresh listings signal active sellers. Stale listings signal negotiation opportunities.",
    category: "marketplace",
  },
  {
    id: "camera-live-view-vs-quick-add",
    number: 12,
    emoji: "📷",
    name: "Why Add's camera looks different from Quick Add's",
    location: "Add Item",
    locationHref: "/capture",
    tagline: "Both screens use the same live camera code, but one crops what you see live and the other doesn't — on purpose.",
    why: "Quick Add's camera fills the frame edge-to-edge with no gaps (it crops the picture to fit). The regular Add camera shows the full, uncropped frame instead, which can leave a small gap above and below the photo depending on the shape of your camera vs. the shape of the screen.",
    what: [
      "Quick Add never lets you fine-tune a crop afterward — it goes straight into a batch, so cropping the live view live costs nothing.",
      "Regular Add always shows you a crop-and-edit step after the photo, where you fine-tune exactly what gets saved. For that to work reliably, what you see live has to be the whole picture, not a pre-cropped guess.",
      "On a real phone, the rear camera already outputs video shaped to match how you're holding the phone, so this gap is usually minimal to invisible there — it shows up more on a desktop webcam (which is shaped like a wide rectangle) squeezed into a tall phone-shaped preview.",
    ],
    value: "Not a bug or a mismatched setting — the regular Add screen trades a small live-preview gap (on some cameras) for a guarantee that what you crop afterward is exactly what you saw, every time.",
    category: "vault",
  },
];

const CATEGORIES: { key: Feature["category"]; label: string; emoji: string }[] = [
  { key: "vault", label: "Vault & Items", emoji: "🗝️" },
  { key: "marketplace", label: "Marketplace", emoji: "🛒" },
  { key: "sales", label: "Sales & Analytics", emoji: "📈" },
  { key: "goals", label: "Goals", emoji: "🎯" },
  { key: "social", label: "Social & Export", emoji: "📤" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: Feature["category"] }) {
  const cat = CATEGORIES.find((c) => c.key === category);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1"
      style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
    >
      {cat ? <Glyph name={emojiGlyphName(cat.emoji)} size={15} className="mr-1.5 inline align-[-2px]" /> : null}{cat?.label}
    </span>
  );
}

function WhatList({ items }: { items: string[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <span className="mt-0.5 shrink-0 text-[10px] font-bold" style={{ color: "var(--theme-gold)" }}>&#9658;</span>
          {item}
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div
      id={feature.id}
      className="scroll-mt-6 rounded-[28px] ring-1 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="px-6 pt-6 pb-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span style={{ color: "var(--theme-gold)" }}><Glyph name={emojiGlyphName(feature.emoji)} size={28} /></span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>{feature.name}</h2>
                <CategoryBadge category={feature.category} />
              </div>
              <Link
                href={feature.locationHref}
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold transition hover:underline"
                style={{ color: "var(--theme-gold)" }}
              >
                {feature.location} &rarr;
              </Link>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1"
            style={{ background: "var(--pill)", color: "var(--muted2)", borderColor: "var(--border)" }}
          >
            #{String(feature.number).padStart(2, "0")}
          </span>
        </div>
        <p className="mt-3 text-base font-medium leading-7" style={{ color: "var(--fg)" }}>
          {feature.tagline}
        </p>
      </div>

      {/* Body */}
      <div className="grid gap-0 divide-y sm:divide-y-0 sm:grid-cols-2 sm:divide-x" style={{ borderColor: "var(--border)" }}>
        <div className="px-6 py-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--muted2)" }}>
            What it does
          </div>
          <WhatList items={feature.what} />
        </div>
        <div className="px-6 py-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--muted2)" }}>
            Why it was built
          </div>
          <p className="text-sm leading-6" style={{ color: "var(--muted)" }}>{feature.why}</p>
          <div
            className="mt-4 rounded-2xl px-4 py-3 ring-1"
            style={{
              background: "rgba(203,208,213,0.06)",
              borderColor: "rgba(203,208,213,0.2)",
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(203,208,213,0.7)" }}>
              Value
            </div>
            <p className="text-sm leading-5 font-medium" style={{ color: "var(--fg)" }}>{feature.value}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = [
  "registry-rank",
  "market-pulse",
  "listing-readiness",
  "goals",
  "grading-chips",
  "sales-history",
  "sold-filters",
  "social-export",
  "freshness-badge",
];

export default function GuidePage() {
  const ordered = PRIORITY_ORDER
    .map((id) => FEATURES.find((f) => f.id === id))
    .filter((f): f is Feature => !!f);

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Hero header */}
      <div
        className="border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] mb-3" style={{ color: "var(--muted2)" }}>
            VLTD Feature Guide
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ color: "var(--fg)" }}>
            Everything your vault can do.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--muted)" }}>
            A practical guide to all {FEATURES.length} features built for serious collectors — from market intelligence to listing readiness to social export.
          </p>

          {/* Category nav */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const first = ordered.find((f) => f.category === cat.key);
              return first ? (
                <a
                  key={cat.key}
                  href={`#${first.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition hover:ring-[color:var(--theme-gold)]"
                  style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
                >
                  <Glyph name={emojiGlyphName(cat.emoji)} size={15} className="mr-1.5 inline align-[-2px]" />{cat.label}
                </a>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Quick index */}
        <div
          className="mb-10 rounded-[24px] p-5 ring-1"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "var(--muted2)" }}>
            Quick index
          </div>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((f) => (
              <a
                key={f.id}
                href={`#${f.id}`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-[color:var(--pill)]"
                style={{ color: "var(--fg)" }}
              >
                <span style={{ color: "var(--theme-gold)" }}><Glyph name={emojiGlyphName(f.emoji)} size={18} /></span>
                <span className="truncate font-medium">{f.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="flex flex-col gap-8">
          {ordered.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>

        {/* Footer CTA */}
        <div
          className="mt-12 rounded-[24px] px-6 py-8 text-center ring-1"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-2xl font-black" style={{ color: "var(--fg)" }}>Built for collectors who mean it.</div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            More features are on the way. AI cataloging, auction mode, and market alerts are all in development.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/vault"
              className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5"
              style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}
            >
              Go to Vault &rarr;
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold ring-1 transition hover:ring-[color:var(--theme-gold)]"
              style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
            >
              Discover
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
