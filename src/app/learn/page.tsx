import Link from "next/link";
import type { Metadata } from "next";

import { TAXONOMY, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Collector Universe Guide — VLTD",
  description:
    "Learn how VLTD organizes collectibles across Pop Culture, Sports, TCG, Music, Games, Jewelry & Apparel, and Misc. Find your universe and start building your vault.",
};

const UNIVERSE_ICONS: Record<UniverseKey, string> = {
  POP_CULTURE: "🎭",
  SPORTS: "🏆",
  TCG: "🃏",
  MUSIC: "🎵",
  JEWELRY_APPAREL: "💎",
  GAMES: "🎮",
  MISC: "✦",
};

const UNIVERSE_DESCRIPTIONS: Record<UniverseKey, string> = {
  POP_CULTURE:
    "Comics, action figures, Funko Pops, anime collectibles, sketch cards, and entertainment memorabilia. If it has a fan base, it belongs here.",
  SPORTS:
    "Sports cards, autographs, game-used jerseys, and memorabilia across all major leagues. Graded slabs and raw cards both welcome.",
  TCG:
    "Trading card games — Pokemon, Magic: The Gathering, Yu-Gi-Oh!, and specialty sets like Bo Jackson Arena. Singles, sealed product, and graded slabs.",
  MUSIC:
    "Vinyl records, CDs, instruments, and artist collectibles. From first pressings to signed albums to vintage guitars.",
  JEWELRY_APPAREL:
    "Watches, luxury bags, streetwear, and limited-release apparel. High-value wearables with provenance worth documenting.",
  GAMES:
    "Video games, consoles, and accessories across every era. Retro sealed games, graded cartridges, limited editions, and arcade boards.",
  MISC:
    "Art prints, coins, currency, stamps, props, and anything that doesn't fit a single category. Every collection has these.",
};

const GRADING_GUIDES = [
  {
    label: "CGC / CBCS",
    universe: "Comics",
    grades: ["10.0 Gem Mint", "9.8 Near Mint/Mint", "9.6 Near Mint+", "9.4 Near Mint", "8.0 Very Fine", "6.0 Fine", "4.0 Very Good", "2.0 Good"],
  },
  {
    label: "PSA",
    universe: "Sports Cards & TCG",
    grades: ["PSA 10 Gem Mint", "PSA 9 Mint", "PSA 8 NM-MT", "PSA 7 NM", "PSA 6 EX-MT", "PSA 5 EX", "PSA 4 VG-EX", "PSA 3 VG", "PSA 2 Good", "PSA 1 Poor"],
  },
  {
    label: "BGS / Beckett",
    universe: "Sports Cards & TCG",
    grades: ["BGS 10 Pristine", "BGS 9.5 Gem Mint", "BGS 9 Mint", "BGS 8.5 NM-MT+", "BGS 8 NM-MT", "BGS 7.5 NM+", "BGS 7 NM"],
  },
  {
    label: "Raw Condition",
    universe: "General",
    grades: ["Gem Mint (GM)", "Near Mint (NM)", "Very Fine (VF)", "Fine (F)", "Very Good (VG)", "Good (G)", "Fair (FR)", "Poor (PR)"],
  },
];

const TIPS = [
  {
    icon: "▣",
    title: "Photograph both sides",
    body: "Front and back matter for grading and insurance. Add a detail shot of any flaws, signatures, or certification labels.",
  },
  {
    icon: "✦",
    title: "Record the cert number",
    body: "PSA, CGC, BGS, and BCCG cert numbers link to registry records. VLTD stores them so you can verify any item instantly.",
  },
  {
    icon: "↗",
    title: "Set a purchase price",
    body: "Even an estimate helps your portfolio math. Purchase price + current value = real gain/loss across your collection.",
  },
  {
    icon: "☆",
    title: "Use notes for provenance",
    body: "Where you bought it, who owned it, what makes it special. Notes travel with the item through insurance docs and gallery listings.",
  },
];

export default function LearnPage() {
  const universeKeys = Object.keys(TAXONOMY) as UniverseKey[];

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      {/* ── Nav ── */}
      <nav className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-black tracking-[-0.04em] text-text-primary">
            VLTD
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-5 py-2 text-sm font-bold transition"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
            >
              Get started — free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="border-b border-[color:var(--border)] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(245,181,72,0.28)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--theme-gold, #F5B548)" }} />
            Collector Universe Guide
          </div>
          <h1 className="text-4xl font-black leading-[0.96] tracking-[-0.045em] text-text-primary sm:text-5xl lg:text-6xl">
            Every collectible<br />has a home in VLTD.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[color:var(--muted)]">
            VLTD organizes collections into seven universes. Each universe has categories and subcategories built to match how collectors actually talk about their items.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-sm font-bold"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
            >
              Start your vault — free
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--border)] px-7 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>

      {/* ── Universe grid ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            The Seven Universes
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {universeKeys.map((key) => {
              const categories = Object.entries(TAXONOMY[key]);
              return (
                <div
                  key={key}
                  className="rounded-[22px] border border-[color:var(--border)] bg-vault-card p-5"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{UNIVERSE_ICONS[key]}</span>
                    <div>
                      <div className="text-base font-black text-text-primary">{UNIVERSE_LABEL[key]}</div>
                      <div className="text-[11px] text-[color:var(--muted2)]">
                        {categories.length} {categories.length === 1 ? "category" : "categories"}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    {UNIVERSE_DESCRIPTIONS[key]}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {categories.map(([label, subcats]) => (
                      <div key={label} className="group relative">
                        <span className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-text-primary">
                          {label}
                          {subcats.length > 0 && (
                            <span className="ml-1.5 text-[10px] text-[color:var(--muted2)]">
                              +{subcats.length}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Subcategory details */}
                  <div className="mt-4 space-y-2">
                    {categories.map(([label, subcats]) =>
                      subcats.length > 0 ? (
                        <div key={label} className="rounded-xl bg-[color:var(--surface)] px-3 py-2 ring-1 ring-[color:var(--border)]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                            {label}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {subcats.map((sub) => (
                              <span
                                key={sub}
                                className="rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Grading guide ── */}
      <section className="border-t border-[color:var(--border)] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            Grading Scales
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)]">
            VLTD stores grades exactly as entered. These are the common scales used by major grading companies and collectors.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GRADING_GUIDES.map((guide) => (
              <div
                key={guide.label}
                className="rounded-[18px] border border-[color:var(--border)] bg-vault-card p-4"
              >
                <div className="text-sm font-black text-text-primary">{guide.label}</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--muted2)]">{guide.universe}</div>
                <ul className="mt-3 space-y-1">
                  {guide.grades.map((grade) => (
                    <li key={grade} className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                      <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: "var(--theme-gold, #F5B548)" }} />
                      {grade}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Collecting tips ── */}
      <section className="border-t border-[color:var(--border)] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            Tips for a Strong Record
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIPS.map((tip) => (
              <div
                key={tip.title}
                className="rounded-[18px] border border-[color:var(--border)] bg-vault-card p-5"
              >
                <div
                  className="mb-3 grid h-10 w-10 place-items-center rounded-[12px] text-lg"
                  style={{
                    background: "var(--theme-gold-subtle, rgba(245,181,72,0.08))",
                    border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.2))",
                  }}
                >
                  {tip.icon}
                </div>
                <div className="text-sm font-black text-text-primary">{tip.title}</div>
                <p className="mt-1.5 text-xs leading-5 text-[color:var(--muted)]">{tip.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-[color:var(--border)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black leading-tight tracking-[-0.04em] text-text-primary">
            Ready to vault your collection?
          </h2>
          <p className="mt-4 text-base leading-7 text-[color:var(--muted)]">
            VLTD is free to start. AI scanning, public galleries, and portfolio tracking included.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full px-8 text-sm font-bold"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
            >
              Create your vault — free
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[color:var(--border)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[color:var(--muted2)] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-black tracking-[-0.04em] text-text-primary">VLTD</span>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-text-primary">Log in</Link>
            <Link href="/signup" className="hover:text-text-primary">Sign up</Link>
            <Link href="/learn" className="hover:text-text-primary">Learn</Link>
          </div>
          <div className="italic">© 2026 VLTD. Pronounced "Vaulted."</div>
        </div>
      </footer>
    </main>
  );
}
