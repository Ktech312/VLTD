# VLTD — Landing Page Rewrite

**Philosophy:** The current landing page was written before half the features shipped. Stream Mode, the auto-lock HaulScanner, public vault URLs, and the insurance PDF are all real and live — none of them appear on the homepage. The comparison table says "Others" but VLTD has analyzed 14 specific competitors. This rewrite fixes the copy, expands the features section, and adds the new sections needed to convert a serious collector.

**Files changed:** 1 (`src/app/PublicHomeClient.tsx`)

---

## What changes

- **Hero**: sharpened, speaks to serious collectors specifically
- **Feature cards**: expanded from 4 to 6, adds Stream Mode + Public Vault URL
- **Scanner callout**: new section with the auto-lock HaulScanner detail — the most exciting feature for collectors coming from competitors
- **Vault universes grid**: unchanged structure, updated copy
- **Comparison table**: more rows, clearer claims, adds the features that actually differentiate
- **Social proof section**: new — collector quote placeholder + stat chips
- **CTA**: stronger close
- **Footer**: cleaned up, link fixes

---

## Updated constants — replace in `PublicHomeClient.tsx`

### FEATURE_CARDS (6 cards, was 4)

```ts
const FEATURE_CARDS = [
  {
    icon: "◈",
    title: "Auto-Lock Scanner",
    description:
      "Open Quick Add. The camera locks when your item is in frame — snap, tag, done. Haul through a stack in minutes.",
  },
  {
    icon: "▤",
    title: "Public Vault",
    description:
      "Share a link. Visitors see your Museum view — only the items you've made public. No login required.",
  },
  {
    icon: "↗",
    title: "Portfolio View",
    description:
      "Cost basis, current value, gain/loss, ROI. Every item tracked. Every universe totaled. Export anytime.",
  },
  {
    icon: "☆",
    title: "Insurance Docs",
    description:
      "One tap generates a printable insurance packet: cover page, per-item sections, values, grades, and photos.",
  },
  {
    icon: "▶",
    title: "Stream Mode",
    description:
      "Fullscreen cinematic reveal at your own URL. Tap to reveal value. Built for live streams, haul posts, and reveals.",
  },
  {
    icon: "◎",
    title: "AI Condition Grading",
    description:
      "Universe-specific grading scales — PSA, CGC, Goldmine, WATA. AI reads the condition and explains the grade.",
  },
];
```

### VAULT_UNIVERSES (unchanged content, update descriptions slightly)

```ts
const VAULT_UNIVERSES: UniverseCard[] = [
  {
    icon: "🎭",
    title: "Pop Culture",
    meta: "Comics · Figures · Art Cards",
    description: "Marvel, DC, manga, Funko, artist proofs, and entertainment collectibles — with CGC grading built in.",
  },
  {
    icon: "🏆",
    title: "Sports",
    meta: "Cards · Autos · Game-Used",
    description: "Sports cards, jerseys, autographs, and game-used gear — PSA, BGS, SGC grading supported.",
  },
  {
    icon: "🃏",
    title: "TCG",
    meta: "Singles · Sealed · Slabs",
    description: "Pokemon, Magic, Yu-Gi-Oh!, sealed products, and graded singles from every major set.",
  },
  {
    icon: "🎵",
    title: "Music",
    meta: "Vinyl · Albums · Instruments",
    description: "First pressings, signed albums, box sets, instruments — Goldmine grading standard included.",
  },
  {
    icon: "💎",
    title: "Jewelry & Apparel",
    meta: "Watches · Bags · Limited Drops",
    description: "Watches, luxury accessories, streetwear, vintage pieces, and limited-run drops.",
  },
  {
    icon: "🎮",
    title: "Games",
    meta: "Consoles · Cartridges · Sealed",
    description: "Video games, consoles, controllers, and sealed games — WATA grading support built in.",
  },
  {
    icon: "✨",
    title: "Misc",
    meta: "Coins · Art · Oddities",
    description: "Coins, prints, stamps, art, and anything that doesn't fit neatly elsewhere. Still tracked properly.",
  },
];
```

### COMPARISON_ROWS (expanded — 9 rows, was 6)

```ts
const COMPARISON_ROWS: [string, string, string][] = [
  ["Feature",                       "Most apps",   "VLTD"],
  ["Multi-category vault",          "One category", "All categories"],
  ["Portfolio analytics + ROI",     "None",         "Built in"],
  ["Public gallery & museum view",  "None",         "Shareable link"],
  ["Insurance documentation PDF",   "None",         "One tap"],
  ["Auto-lock HaulScanner",         "Manual entry", "Camera auto-locks"],
  ["Stream Mode / reveal view",     "None",         "Built in"],
  ["Universe-specific grading",     "None",         "PSA · CGC · WATA · Goldmine"],
  ["AI condition grading",          "Partial",      "With explanation"],
  ["Data export (CSV + JSON)",      "Locked/paid",  "Always free"],
];
```

Note: the first element of this array is now the column header row — update the table renderer to treat index 0 as a header row (bold, uppercase tracking, different background). See the JSX update below.

---

## Updated JSX sections — full replacements

### 1 — Hero section

Find and replace the entire hero block (the section with "The vault for serious collectors"):

```tsx
{/* ── Hero ── */}
<section className="mx-auto max-w-3xl px-4 pt-20 pb-12 text-center sm:pt-28">
  <div
    className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.12em]"
    style={{ background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.25)", color: "#F5B548" }}
  >
    FREE TO START · NO CREDIT CARD
  </div>

  <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
    Every collectible.<br />
    One vault.
  </h1>

  <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--muted)" }}>
    VLTD is the vault for serious collectors — TCG, sports cards, comics, vinyl, games, watches, and everything in between. Track value, generate insurance docs, and share your collection publicly.
  </p>

  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
    <Link
      href="/signup"
      className="inline-flex min-h-[48px] items-center justify-center rounded-full px-8 text-[15px] font-bold transition hover:opacity-90"
      style={{ background: "#F5B548", color: "#0B0B0B" }}
    >
      Start your vault — free
    </Link>
    <Link
      href="/discover"
      className="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-medium ring-1 transition hover:bg-[color:var(--pill)]"
      style={{ color: "var(--fg)", borderColor: "var(--border)" }}
    >
      Browse collections
    </Link>
  </div>

  <p className="mt-4 text-xs" style={{ color: "var(--muted2)" }}>
    Free forever for personal collectors · No credit card · No ads
  </p>
</section>
```

### 2 — Feature cards grid (6 cards)

Find and replace the feature cards section:

```tsx
{/* ── Feature cards ── */}
<section className="mx-auto max-w-5xl px-4 pb-16">
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {FEATURE_CARDS.map((card) => (
      <div
        key={card.title}
        className="rounded-[22px] p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{ background: "rgba(245,181,72,0.12)", border: "1px solid rgba(245,181,72,0.2)" }}
        >
          <span style={{ color: "#F5B548" }}>{card.icon}</span>
        </div>
        <div className="text-[15px] font-bold" style={{ color: "var(--fg)" }}>{card.title}</div>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {card.description}
        </p>
      </div>
    ))}
  </div>
</section>
```

### 3 — Scanner callout (NEW section — add between feature cards and vault universes)

```tsx
{/* ── Scanner callout ── */}
<section
  className="mx-4 mb-16 overflow-hidden rounded-[28px] sm:mx-auto sm:max-w-4xl"
  style={{ background: "linear-gradient(135deg, rgba(245,181,72,0.08), rgba(15,25,45,0.95))", border: "1px solid rgba(245,181,72,0.2)" }}
>
  <div className="grid sm:grid-cols-2">
    <div className="p-8 sm:p-10">
      <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(245,181,72,0.6)" }}>
        HAUL MODE
      </div>
      <h2 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ color: "var(--fg)" }}>
        Scan a stack in minutes.
      </h2>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Open Quick Add. Frame your item. When the scanner locks on — the corners glow gold — it captures automatically. Hit Next and you're on to the next card. Universe, category, and condition pre-filled by AI.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {["Auto-lock camera", "Frame presets: Card / Book / Jewelry / Art", "AI condition grading", "Batch review before saving"].map((tag) => (
          <span
            key={tag}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(245,181,72,0.10)", border: "1px solid rgba(245,181,72,0.2)", color: "#F5B548" }}
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        href="/signup"
        className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-90"
        style={{ background: "#F5B548", color: "#0B0B0B" }}
      >
        Try it free
      </Link>
    </div>

    {/* Visual — simple animated frame mockup */}
    <div className="flex items-center justify-center p-8">
      <div
        className="relative flex h-[200px] w-[160px] items-center justify-center rounded-[20px]"
        style={{ background: "rgba(10,18,35,0.95)", border: "1px solid rgba(245,181,72,0.15)" }}
      >
        {/* Frame corners — gold glow state */}
        {[
          "top-2 left-2 border-t-2 border-l-2 rounded-tl-[8px]",
          "top-2 right-2 border-t-2 border-r-2 rounded-tr-[8px]",
          "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-[8px]",
          "bottom-2 right-2 border-b-2 border-r-2 rounded-br-[8px]",
        ].map((cls) => (
          <div
            key={cls}
            className={`absolute h-6 w-6 ${cls}`}
            style={{ borderColor: "#F5B548", filter: "drop-shadow(0 0 4px rgba(245,181,72,0.6))" }}
          />
        ))}
        <div className="text-center">
          <div className="text-3xl">🃏</div>
          <div className="mt-2 text-[10px] font-bold tracking-widest" style={{ color: "#F5B548" }}>LOCKED</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

### 4 — Comparison table (update to handle header row and new rows)

Find the entire comparison table section and replace it:

```tsx
{/* ── Comparison table ── */}
<section className="mx-auto max-w-3xl px-4 pb-20">
  <div className="mb-8 text-center">
    <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--muted2)" }}>WHY VLTD</div>
    <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Built for collectors who are serious about their collection.</h2>
    <p className="mx-auto mt-3 max-w-lg text-sm" style={{ color: "var(--muted)" }}>
      Most apps cover one category and leave everything else out. VLTD was built from scratch to handle all of them — with features no single-category app has.
    </p>
  </div>

  <div
    className="overflow-hidden rounded-[22px]"
    style={{ border: "1px solid var(--border)" }}
  >
    {COMPARISON_ROWS.map((row, i) => (
      <div
        key={row[0]}
        className="grid grid-cols-[1fr_120px_120px] items-center gap-4 px-5 py-3.5"
        style={{
          background: i === 0
            ? "var(--surface)"
            : i % 2 === 0
            ? "rgba(245,181,72,0.025)"
            : "transparent",
          borderBottom: i < COMPARISON_ROWS.length - 1 ? "1px solid var(--border)" : "none",
        }}
      >
        <div
          className={i === 0 ? "text-[10px] uppercase tracking-[0.2em] font-semibold" : "text-sm"}
          style={{ color: i === 0 ? "var(--muted2)" : "var(--fg)" }}
        >
          {row[0]}
        </div>
        <div
          className={["text-center text-sm font-medium", i === 0 ? "text-[10px] uppercase tracking-[0.2em]" : ""].join(" ")}
          style={{ color: i === 0 ? "var(--muted2)" : "var(--muted)" }}
        >
          {row[1]}
        </div>
        <div
          className={["text-center text-sm font-bold", i === 0 ? "text-[10px] uppercase tracking-[0.2em]" : ""].join(" ")}
          style={{ color: i === 0 ? "var(--muted2)" : "#F5B548" }}
        >
          {row[2]}
        </div>
      </div>
    ))}
  </div>
</section>
```

### 5 — Social proof section (NEW — add before the final CTA)

```tsx
{/* ── Social proof ── */}
<section className="mx-auto max-w-4xl px-4 pb-20">
  <div className="grid gap-4 sm:grid-cols-3">
    {[
      { stat: "7", label: "Collection types", sub: "TCG · Sports · Comics · Music · Games · Jewelry · Misc" },
      { stat: "∞", label: "Items per vault", sub: "No limits on personal vaults, ever" },
      { stat: "Free", label: "To start", sub: "No credit card required to sign up" },
    ].map((item) => (
      <div
        key={item.label}
        className="rounded-[20px] p-6 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="text-4xl font-black" style={{ color: "#F5B548" }}>{item.stat}</div>
        <div className="mt-1 text-sm font-semibold" style={{ color: "var(--fg)" }}>{item.label}</div>
        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{item.sub}</div>
      </div>
    ))}
  </div>
</section>
```

### 6 — Final CTA section

Find and replace the bottom CTA:

```tsx
{/* ── Final CTA ── */}
<section
  className="mx-4 mb-16 rounded-[28px] px-8 py-14 text-center sm:mx-auto sm:max-w-2xl"
  style={{ background: "var(--surface)", border: "1px solid rgba(245,181,72,0.2)" }}
>
  <div className="text-[11px] tracking-[0.22em]" style={{ color: "rgba(245,181,72,0.6)" }}>
    GET STARTED
  </div>
  <h2 className="mt-3 text-3xl font-bold sm:text-4xl" style={{ color: "var(--fg)" }}>
    Your collection deserves a proper vault.
  </h2>
  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
    Free to start. No credit card. Every category from day one.
  </p>
  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
    <Link
      href="/signup"
      className="inline-flex min-h-[48px] items-center justify-center rounded-full px-8 text-[15px] font-bold transition hover:opacity-90"
      style={{ background: "#F5B548", color: "#0B0B0B" }}
    >
      Create your vault
    </Link>
    <Link
      href="/discover"
      className="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[15px] font-medium ring-1 transition hover:bg-[color:var(--pill)]"
      style={{ color: "var(--fg)", borderColor: "var(--border)" }}
    >
      Browse collections
    </Link>
  </div>
</section>
```

### 7 — Footer cleanup

Replace the existing footer with:

```tsx
{/* ── Footer ── */}
<footer
  className="border-t px-4 py-8 text-center text-xs"
  style={{ borderColor: "var(--border)", color: "var(--muted2)" }}
>
  <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
    <Link href="/login" className="hover:text-[color:var(--fg)]">Log in</Link>
    <Link href="/signup" className="hover:text-[color:var(--fg)]">Sign up</Link>
    <Link href="/discover" className="hover:text-[color:var(--fg)]">Discover</Link>
    <Link href="/learn" className="hover:text-[color:var(--fg)]">Learn</Link>
  </div>
  <div>© {new Date().getFullYear()} VLTD. Built for collectors.</div>
</footer>
```

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Hero renders — two CTAs visible, no overflow
- [ ] 6 feature cards in a 2-col (mobile) / 3-col (desktop) grid
- [ ] Scanner callout section renders between feature cards and vault universes
- [ ] Scanner callout: 4 tag pills visible, "Try it free" CTA works
- [ ] Comparison table: header row (row[0]) styled differently — uppercase, muted color
- [ ] Comparison table: 9 data rows below header, alternating background
- [ ] Social proof: 3 stat cards in a row (or stacked mobile)
- [ ] Final CTA: two buttons, correct hrefs (/signup, /discover)
- [ ] Footer: 4 links — Log in, Sign up, Discover, Learn — all valid routes
- [ ] No TypeScript errors
- [ ] `npm run build` clean

Commit: `feat: landing page rewrite — 6 feature cards, scanner callout, expanded comparison table, social proof, updated hero and CTA`
