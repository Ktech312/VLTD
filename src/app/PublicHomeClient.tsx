"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, initAuthListener } from "@/lib/auth";
import { useTheme } from "@/lib/ThemeContext";

import {
  GALLERY_EVENT,
  loadAllGalleries,
  refreshGalleriesFromSupabase,
  type Gallery,
} from "@/lib/galleryModel";
import { getVaultImagePublicUrl, isDirectBrowserImageUrl } from "@/lib/vaultCloud";
import VltdVaultLogoAnimation from "@/components/VltdVaultLogoAnimation";

type PublicGalleryCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
  itemCount: number;
  views: number;
  category: string;
};

type UniverseCard = {
  icon: string;
  title: string;
  meta: string;
  description: string;
};

const FEATURE_CARDS = [
  {
    icon: "▣",
    title: "AI Scanning",
    description: "Point at any item. AI identifies it, prices it, and adds it to your vault instantly.",
  },
  {
    icon: "▤",
    title: "Public Gallery",
    description: "Build a museum-style showcase with one link. Your private vault stays completely private.",
  },
  {
    icon: "↗",
    title: "Portfolio View",
    description: "Track cost basis, current value, and gain/loss across every item in every category.",
  },
  {
    icon: "☆",
    title: "Insurance Docs",
    description: "Generate complete insurance-ready documentation packets from your vault in seconds.",
  },
  {
    icon: "⟳",
    title: "Stream Mode",
    description: "Rapid-fire scanning for bulk drops. Add 50 items in a single session without breaking flow.",
  },
  {
    icon: "◎",
    title: "Auto-Lock Scanner",
    description: "Captures the sharpest frame automatically. No tapping, no blur, no retakes needed.",
  },
];

const VAULT_UNIVERSES: UniverseCard[] = [
  {
    icon: "🎭",
    title: "Pop Culture",
    meta: "Comics · Figures",
    description: "Marvel, DC, manga, figures, and entertainment collectibles.",
  },
  {
    icon: "🏆",
    title: "Sports",
    meta: "Cards · Autos",
    description: "Sports cards, jerseys, autographs, and game-used gear.",
  },
  {
    icon: "🃏",
    title: "TCG",
    meta: "Singles · Slabs",
    description: "Pokemon, Magic, Yu-Gi-Oh!, and graded cards.",
  },
  {
    icon: "🎵",
    title: "Music",
    meta: "Vinyl · Albums",
    description: "Vinyl, signed records, instruments, and artist collectibles.",
  },
  {
    icon: "💎",
    title: "Jewelry",
    meta: "Watches · Drops",
    description: "Watches, luxury accessories, apparel, and limited drops.",
  },
  {
    icon: "🎮",
    title: "Games",
    meta: "Consoles · Sealed",
    description: "Video games, consoles, controllers, and arcade pieces.",
  },
  {
    icon: "✨",
    title: "Misc",
    meta: "Unique · Mixed",
    description: "Coins, art, oddities, and anything unique.",
  },
];

const COMPARISON_ROWS = [
  ["Multi-category vault", "One category", "All 7 universes"],
  ["Portfolio analytics", "Basic", "Full P&L tracking"],
  ["Exhibition-style gallery", "No", "Yes"],
  ["Insurance documentation", "No", "Yes"],
  ["AI identification & pricing", "Manual", "Auto on scan"],
  ["Bulk drop / stream mode", "No", "Yes"],
  ["Auto-lock blur detection", "No", "Yes"],
  ["Public share link", "Partial", "One-tap share"],
  ["Team & multi-profile", "No", "Yes"],
];

const FALLBACK_GALLERIES: PublicGalleryCard[] = [
  {
    id: "sample-pop-culture",
    title: "Pop Culture Collection",
    description: "Exhibition-style public display for comics, figures, and key collectibles.",
    href: "/signup",
    image: "/themes/classic-shelf-wall.webp",
    itemCount: 7,
    views: 24,
    category: "Pop Culture",
  },
  {
    id: "sample-tcg",
    title: "TCG Slabs",
    description: "A clean gallery for slabs, singles, grades, and cert details.",
    href: "/signup",
    image: "/themes/midnight-shelf-wall.webp",
    itemCount: 12,
    views: 18,
    category: "TCG",
  },
  {
    id: "sample-sports",
    title: "Sports Memorabilia",
    description: "A public showcase for cards, autos, jerseys, and signed gear.",
    href: "/signup",
    image: "/themes/walnut-shelf-wall.webp",
    itemCount: 5,
    views: 11,
    category: "Sports",
  },
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferCategory(gallery: Gallery) {
  const text = normalizeText(
    [
      gallery.title,
      gallery.description,
      gallery.themePack,
      ...(gallery.publicItemSnapshots ?? []).flatMap((item) => [
        item.title,
        item.subtitle,
        item.grade,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (/pokemon|magic|yugioh|tcg|card|slab/.test(text)) return "TCG";
  if (/sports|rookie|jersey|autograph|memorabilia|baseball|basketball|football/.test(text)) return "Sports";
  if (/vinyl|album|music|record|artist/.test(text)) return "Music";
  if (/watch|jewelry|apparel|streetwear|luxury/.test(text)) return "Jewelry";
  if (/game|console|nintendo|playstation|xbox|arcade/.test(text)) return "Games";
  if (/comic|marvel|dc|figure|toy|manga|poster|prop/.test(text)) return "Pop Culture";

  return "Misc";
}

function resolveSnapshotImage(gallery: Gallery) {
  const snapshot = gallery.publicItemSnapshots?.find(
    (item) =>
      item.imageFrontUrl ||
      item.imageBackUrl ||
      item.imageFrontStoragePath ||
      item.primaryImageKey,
  );

  const directUrl = snapshot?.imageFrontUrl || snapshot?.imageBackUrl || "";
  if (directUrl && isDirectBrowserImageUrl(directUrl)) return directUrl;

  const storagePath =
    snapshot?.imageFrontStoragePath || snapshot?.primaryImageKey || "";
  if (storagePath) return getVaultImagePublicUrl(storagePath);

  return "";
}

function galleryImage(gallery: Gallery) {
  if (gallery.coverImage) return gallery.coverImage;
  const snapshotImage = resolveSnapshotImage(gallery);
  if (snapshotImage) return snapshotImage;
  if (gallery.themePack === "walnut") return "/themes/walnut-shelf-wall.webp";
  if (gallery.themePack === "midnight") return "/themes/midnight-shelf-wall.webp";
  if (gallery.themePack === "cold-blue") return "/themes/cold-blue-bg.png";
  return "/themes/classic-shelf-wall.webp";
}

function toPublicCard(gallery: Gallery): PublicGalleryCard {
  const token = gallery.share?.publicToken;

  return {
    id: gallery.id,
    title: gallery.title,
    description:
      gallery.description?.trim() ||
      `${gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0} piece public collection.`,
    href: token
      ? `/museum/share/${encodeURIComponent(token)}`
      : `/gallery/${encodeURIComponent(gallery.id)}`,
    image: galleryImage(gallery),
    itemCount: gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0,
    views: gallery.analytics?.views ?? 0,
    category: inferCategory(gallery),
  };
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-black tracking-[0.08em] text-text-primary">
      <span className="vltd-brand-dot h-2.5 w-2.5" />
      <span>VLTD</span>
      <span className="text-[8px] text-[color:var(--muted2)]">TM</span>
    </div>
  );
}

function PublicGalleryTile({ gallery }: { gallery: PublicGalleryCard }) {
  return (
    <Link
      href={gallery.href}
      className="group overflow-hidden rounded-2xl transition hover:-translate-y-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.12),rgba(245,181,72,0.04)_34%,rgba(0,0,0,0.22)_100%)] p-3">
        <img
          src={gallery.image}
          alt={gallery.title}
          className="h-full w-full object-contain opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-95"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>{gallery.title}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {gallery.category} · {gallery.itemCount} pieces · {gallery.views} views
        </div>
      </div>
    </Link>
  );
}

export default function PublicHomeClient() {
  const { theme } = useTheme();
  const cardBg = theme.bgCard;
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    initAuthListener();
    getCurrentUser().then(({ data: { user } }) => {
      if (user) {
        setSignedIn(true);
        router.replace("/dashboard");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  useEffect(() => {
    function loadPublicGalleries() {
      setGalleries(
        loadAllGalleries()
          .filter(
            (gallery) =>
              gallery.state === "ACTIVE" && gallery.visibility === "PUBLIC",
          )
          .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0)),
      );
    }

    loadPublicGalleries();
    void refreshGalleriesFromSupabase(true).then(loadPublicGalleries);

    window.addEventListener(GALLERY_EVENT, loadPublicGalleries);
    return () => window.removeEventListener(GALLERY_EVENT, loadPublicGalleries);
  }, []);

  const galleryCards = useMemo(() => {
    const live = galleries.slice(0, 6).map(toPublicCard);
    return live.length ? live : FALLBACK_GALLERIES;
  }, [galleries]);

  // Show nothing while checking auth (prevents flash of marketing page for logged-in users)
  if (!authChecked) {
    return <div className="min-h-screen bg-[color:var(--bg)]" />;
  }

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      <section className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/learn"
              className="hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Learn
            </Link>
            {!signedIn && (
              <>
                <Link
                  href="/login"
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold whitespace-nowrap text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="vltd-primary-button rounded-full px-4 py-2 text-sm font-black whitespace-nowrap transition"
                >
                  <span className="sm:hidden">Get started</span>
                  <span className="hidden sm:inline">Get started — free</span>
                </Link>
              </>
            )}
            {signedIn && (
              <Link
                href="/dashboard"
                className="vltd-primary-button rounded-full px-4 py-2 text-sm font-black whitespace-nowrap transition"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
          <VltdVaultLogoAnimation className="mx-auto mb-8" />

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(245,181,72,0.28)] px-4 py-2 text-xs font-medium text-[color:var(--accent)]" style={{ background: cardBg }}>
            <span className="vltd-brand-dot h-2 w-2" /> VLTD{" "}
            <span className="text-[color:var(--muted2)]">—</span> pronounced
            &ldquo;Vaulted&rdquo;
          </div>

          <h1 className="mx-auto mt-7 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.06em] text-text-primary sm:text-6xl lg:text-7xl">
            Scan. Vault. <span className="text-[color:var(--accent)]">Know what it&apos;s worth.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
            VLTD is the collector&apos;s operating system — AI scanning, full portfolio
            analytics, museum-style galleries, and insurance docs across every category.
            One vault. Every collectible.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition"
            >
              Create your vault — free
            </Link>
            <Link
              href="#public-galleries"
              className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
              style={{ background: cardBg }}
            >
              Browse public galleries →
            </Link>
          </div>
          <p className="mt-4 text-xs text-[color:var(--muted2)]">
            VLTD — free to start · no credit card required · every category supported
          </p>
        </div>
      </section>

      <section className="border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-7xl divide-y divide-[color:var(--border)] px-4 sm:px-6 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0 lg:px-8">
          {FEATURE_CARDS.map((feature) => (
            <div key={feature.title} className="px-2 py-7 md:px-6">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(245,181,72,0.22)] bg-[rgba(245,181,72,0.08)] text-[color:var(--accent)]">
                {feature.icon}
              </div>
              <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>{feature.title}</div>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            Vault Universes
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">
            Every category. One vault.
          </h2>
          <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
            Most apps handle one category. VLTD handles all of them — with the same
            financial tracking, gallery tools, and AI scanning across every collectible
            type.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VAULT_UNIVERSES.map((universe) => (
            <div
              key={universe.title}
              className="rounded-2xl p-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>
                    <span className="mr-2">{universe.icon}</span>
                    {universe.title}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
                    {universe.meta}
                  </div>
                </div>
                <span style={{ color: 'var(--muted)' }}>→</span>
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {universe.description}
              </p>
            </div>
          ))}
          <Link
            href="/signup"
            className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(245,181,72,0.34)] p-5 text-center text-[color:var(--accent)] transition hover:bg-[rgba(245,181,72,0.06)]"
            style={{ background: 'var(--surface)' }}
          >
            <span className="text-2xl">+</span>
            <span className="mt-2 text-sm font-black">Start your vault</span>
            <span className="text-xs text-[color:var(--muted2)]">Free to join</span>
          </Link>
        </div>
      </section>

      {/* ── Scanner callout — Drop Mode ──────────────────────────── */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(139,105,20,0.18) 0%, rgba(15,25,45,0.92) 50%, rgba(10,18,38,0.98) 100%)', border: '1px solid rgba(245,181,72,0.22)', boxShadow: '0 0 60px rgba(245,181,72,0.06)' }}>
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Left — copy */}
              <div className="flex flex-col justify-center px-8 py-10 lg:py-14">
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(245,181,72,0.28)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#F5B548', background: 'rgba(245,181,72,0.07)' }}>
                  ⟳ Drop Mode
                </div>
                <h2 className="text-3xl font-black tracking-[-0.04em] text-text-primary sm:text-4xl">
                  50 items in one sitting.
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-[color:var(--muted)]">
                  Stream Mode keeps the scanner live between items — point, lock, done. Auto-Lock detects the sharpest frame so you never tap the screen. Bulk drops that used to take hours now take minutes.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/signup" className="vltd-primary-button inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-black transition">
                    Start scanning — free
                  </Link>
                  <Link href="/learn" className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(245,181,72,0.28)] px-6 text-sm font-semibold transition hover:bg-[rgba(245,181,72,0.06)]" style={{ color: '#F5B548' }}>
                    Learn more →
                  </Link>
                </div>
              </div>
              {/* Right — feature list */}
              <div className="flex flex-col justify-center gap-4 border-t border-[rgba(245,181,72,0.12)] px-8 py-10 lg:border-l lg:border-t-0 lg:py-14">
                {[
                  { icon: "◎", title: "Auto-Lock Scanner", desc: "Captures the sharpest frame automatically. No tapping, no blur, no retakes." },
                  { icon: "⟳", title: "Stream Mode", desc: "Scanner stays live between items. Continuous flow for large drops." },
                  { icon: "▣", title: "AI Identification", desc: "Name, category, estimated value — filled in the moment it locks." },
                  { icon: "↗", title: "Instant Portfolio Update", desc: "Every scanned item updates your P&L in real time." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,181,72,0.22)] bg-[rgba(245,181,72,0.08)] text-base" style={{ color: '#F5B548' }}>
                      {icon}
                    </div>
                    <div>
                      <div className="text-sm font-black text-text-primary">{title}</div>
                      <p className="mt-0.5 text-sm leading-5 text-[color:var(--muted)]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="public-galleries" className="border-y" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: 'var(--muted)' }}>
              Public Galleries
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]" style={{ color: 'var(--fg)' }}>
              Your collection, displayed like it deserves.
            </h2>
            <p className="mt-3 text-base leading-7" style={{ color: 'var(--muted)' }}>
              Build a museum-style gallery inside VLTD. Share it with one link. Your
              vault stays completely private.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {galleryCards.slice(0, 3).map((gallery) => (
              <PublicGalleryTile key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof — 3 stats ────────────────────────────────── */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3" style={{ background: 'var(--border)' }}>
            {[
              { stat: "7", label: "Collecting universes", sub: "Every category, one vault" },
              { stat: "∞", label: "Items supported", sub: "No limits on vault size" },
              { stat: "1 link", label: "To share your gallery", sub: "Private vault, public showcase" },
            ].map(({ stat, label, sub }) => (
              <div key={label} className="flex flex-col items-center justify-center py-10 text-center" style={{ background: cardBg }}>
                <div className="text-5xl font-black tracking-[-0.05em]" style={{ color: '#F5B548' }}>{stat}</div>
                <div className="mt-2 text-sm font-black text-text-primary">{label}</div>
                <div className="mt-1 text-xs text-[color:var(--muted2)]">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
          Why VLTD
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">
          Every other app does one thing.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
          CLZ. Shiny. CollX. Misprint. Every competitor solves one category. VLTD
          solves all of them — together, in one vault.
        </p>

        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--border)] text-left" style={{ background: cardBg }}>
          {/* Header row */}
          <div className="grid grid-cols-[1fr_110px_110px] border-b border-[color:var(--border)] bg-[rgba(245,181,72,0.06)]">
            <div className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Feature</div>
            <div className="px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Others</div>
            <div className="bg-[rgba(245,181,72,0.10)] px-5 py-3 text-center text-[11px] font-black uppercase tracking-[0.22em] text-[color:var(--accent)]">
              VLTD
            </div>
          </div>
          {COMPARISON_ROWS.map(([feature, others, vltd]) => (
            <div
              key={feature}
              className="grid grid-cols-[1fr_110px_110px] border-b border-[color:var(--border)] last:border-b-0"
            >
              <div className="px-5 py-3.5 text-sm font-medium text-[color:var(--muted)]">{feature}</div>
              <div className="px-5 py-3.5 text-center text-sm text-[color:var(--muted2)]">
                {others}
              </div>
              <div className="bg-[rgba(245,181,72,0.04)] px-5 py-3.5 text-center text-sm font-semibold text-[color:var(--vltd-green)]">
                {vltd}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--border)] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
          Get Started
        </div>
        <h2 className="mx-auto mt-2 max-w-2xl text-2xl font-black leading-tight tracking-[-0.05em] text-text-primary sm:text-4xl">
          Your collection is worth tracking properly.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[color:var(--muted)]">
          Scan your first item in under 60 seconds. Free to start — no credit card,
          no category limit, no cap on vault size.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition"
          >
            Vault your collection — free
          </Link>
          <Link
            href="/login"
            className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
          >
            Sign in →
          </Link>
        </div>
        <p className="mt-4 text-xs text-[color:var(--muted2)]">
          Free forever · No credit card · All 7 universes included
        </p>
      </section>

      <footer className="border-t border-[color:var(--border)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <BrandMark />
              <p className="mt-1 max-w-xs text-xs text-[color:var(--muted2)]">
                The collector&apos;s operating system. Every category. One vault.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Product</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Sign up</Link>
                  <Link href="/login" className="text-[color:var(--muted)] hover:text-text-primary transition">Log in</Link>
                  <Link href="/learn" className="text-[color:var(--muted)] hover:text-text-primary transition">Learn</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Explore</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="#public-galleries" className="text-[color:var(--muted)] hover:text-text-primary transition">Galleries</Link>
                  <Link href="/discover" className="text-[color:var(--muted)] hover:text-text-primary transition">Discover</Link>
                  <Link href="/museum" className="text-[color:var(--muted)] hover:text-text-primary transition">Exhibitions</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Universes</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">TCG</Link>
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Sports</Link>
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Pop Culture</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-[color:var(--border)] pt-4 text-xs text-[color:var(--muted2)]">
            © 2026 VLTD. Pronounced “Vaulted.” — free to start · no credit card required
          </div>
        </div>
      </footer>
    </main>
  );
}
