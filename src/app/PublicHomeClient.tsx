"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  GALLERY_EVENT,
  loadAllGalleries,
  refreshGalleriesFromSupabase,
  type Gallery,
} from "@/lib/galleryModel";
import { getVaultImagePublicUrl, isDirectBrowserImageUrl } from "@/lib/vaultCloud";

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
    description: "Point at any item. AI identifies it automatically.",
  },
  {
    icon: "▤",
    title: "Public Gallery",
    description: "Build a showcase. Your private vault stays private.",
  },
  {
    icon: "↗",
    title: "Portfolio View",
    description: "Track cost, value, and gain across every item.",
  },
  {
    icon: "☆",
    title: "Insurance Docs",
    description: "Generate complete insurance packets built in.",
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
    description: "Pokémon, Magic, Yu-Gi-Oh!, and graded cards.",
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
  ["Multi-category vault", "×", "✓"],
  ["Portfolio analytics", "×", "✓"],
  ["Gallery & showcase", "×", "✓"],
  ["Insurance documentation", "×", "✓"],
  ["AI scanning", "Partial", "✓"],
  ["Team workspace", "×", "✓"],
];

const FALLBACK_GALLERIES: PublicGalleryCard[] = [
  {
    id: "sample-pop-culture",
    title: "Pop Culture Collection",
    description: "Museum-style public display for comics, figures, and key collectibles.",
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
      ...(gallery.publicItemSnapshots ?? []).flatMap((item) => [item.title, item.subtitle, item.grade]),
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
    (item) => item.imageFrontUrl || item.imageBackUrl || item.imageFrontStoragePath || item.primaryImageKey,
  );

  const directUrl = snapshot?.imageFrontUrl || snapshot?.imageBackUrl || "";
  if (directUrl && isDirectBrowserImageUrl(directUrl)) return directUrl;

  const storagePath = snapshot?.imageFrontStoragePath || snapshot?.primaryImageKey || "";
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
    href: token ? `/museum/share/${encodeURIComponent(token)}` : `/gallery/${encodeURIComponent(gallery.id)}`,
    image: galleryImage(gallery),
    itemCount: gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0,
    views: gallery.analytics?.views ?? 0,
    category: inferCategory(gallery),
  };
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-black tracking-[0.08em] text-white">
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
      className="group overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] transition hover:-translate-y-1 hover:border-[rgba(82,214,244,0.34)] hover:bg-[rgba(20,39,66,0.94)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-black/20">
        <img
          src={gallery.image}
          alt={gallery.title}
          className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-85"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="text-sm font-black text-[color:var(--fg)]">{gallery.title}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">
          {gallery.category} · {gallery.itemCount} pieces · {gallery.views} views
        </div>
      </div>
    </Link>
  );
}

export default function PublicHomeClient() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);

  useEffect(() => {
    function loadPublicGalleries() {
      setGalleries(
        loadAllGalleries()
          .filter((gallery) => gallery.state === "ACTIVE" && gallery.visibility === "PUBLIC")
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

  return (
    <main className="vltd-page-depth min-h-screen text-[color:var(--fg)]">
      <section className="vltd-page-grid border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">
              Log in
            </Link>
            <Link href="/signup" className="vltd-primary-button rounded-full px-5 py-2 text-sm font-black transition">
              Get started — free
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(82,214,244,0.28)] bg-[rgba(10,22,39,0.82)] px-4 py-2 text-xs font-medium text-[color:var(--accent)]">
            <span className="vltd-brand-dot h-2 w-2" /> VLTD <span className="text-[color:var(--muted2)]">—</span> pronounced “Vaulted”
          </div>

          <h1 className="mx-auto mt-7 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
            The vault for <span className="text-[color:var(--accent)]">serious collectors.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
            Track every item across every category. Build a stunning public gallery. Know exactly what your collection is worth. All in one place.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
              Create your vault — free
            </Link>
            <Link href="#public-galleries" className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] bg-[rgba(10,22,39,0.72)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-white">
              Browse public galleries →
            </Link>
          </div>
          <p className="mt-4 text-xs text-[color:var(--muted2)]">VLTD — free to start · no credit card required · every category supported</p>
        </div>
      </section>

      <section className="border-b border-[color:var(--border)] bg-[rgba(7,16,31,0.76)]">
        <div className="mx-auto grid max-w-7xl divide-y divide-[color:var(--border)] px-4 sm:px-6 md:grid-cols-4 md:divide-x md:divide-y-0 lg:px-8">
          {FEATURE_CARDS.map((feature) => (
            <div key={feature.title} className="px-2 py-7 md:px-6">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(82,214,244,0.22)] bg-[rgba(82,214,244,0.10)] text-[color:var(--accent)]">
                {feature.icon}
              </div>
              <div className="text-sm font-black text-white">{feature.title}</div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Vault Universes</div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Every category. One vault.</h2>
          <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
            Most apps handle one category. VLTD handles all of them — with the same financial tracking, gallery tools, and AI scanning across every collectible type.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VAULT_UNIVERSES.map((universe) => (
            <div key={universe.title} className="rounded-2xl border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-white"><span className="mr-2">{universe.icon}</span>{universe.title}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">{universe.meta}</div>
                </div>
                <span className="text-[color:var(--muted2)]">→</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">{universe.description}</p>
            </div>
          ))}
          <Link href="/signup" className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(82,214,244,0.34)] bg-[rgba(10,22,39,0.54)] p-5 text-center text-[color:var(--accent)] transition hover:bg-[rgba(82,214,244,0.08)]">
            <span className="text-2xl">+</span>
            <span className="mt-2 text-sm font-black">Start your vault</span>
            <span className="text-xs text-[color:var(--muted2)]">Free to join</span>
          </Link>
        </div>
      </section>

      <section id="public-galleries" className="border-y border-[color:var(--border)] bg-[rgba(5,11,21,0.42)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Public Galleries</div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Your collection, displayed like it deserves.</h2>
            <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
              Build a museum-style gallery inside VLTD. Share it with one link. Your vault stays completely private.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {galleryCards.slice(0, 3).map((gallery) => (
              <PublicGalleryTile key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Why VLTD</div>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Every other app does one thing.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
          CLZ. Shiny. CollX. Misprint. Every competitor solves one category. VLTD solves all of them — together, in one vault.
        </p>

        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[rgba(10,22,39,0.72)] text-left">
          <div className="grid grid-cols-[1fr_100px_100px] border-b border-[color:var(--border)] bg-[rgba(82,214,244,0.08)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">
            <div className="px-5 py-3">Feature</div>
            <div className="px-5 py-3 text-center">Others</div>
            <div className="bg-[rgba(82,214,244,0.10)] px-5 py-3 text-center text-[color:var(--accent)]">VLTD</div>
          </div>
          {COMPARISON_ROWS.map(([feature, others, vltd]) => (
            <div key={feature} className="grid grid-cols-[1fr_100px_100px] border-b border-[color:var(--border)] last:border-b-0">
              <div className="px-5 py-4 text-sm text-[color:var(--muted)]">{feature}</div>
              <div className="px-5 py-4 text-center text-sm text-[color:var(--muted2)]">{others}</div>
              <div className="bg-[rgba(82,214,244,0.045)] px-5 py-4 text-center text-sm text-[color:var(--vltd-green)]">{vltd}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--border)] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Get Started</div>
        <h2 className="mx-auto mt-2 max-w-2xl text-4xl font-black leading-tight tracking-[-0.05em] text-white">Your collection deserves a real home.</h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[color:var(--muted)]">VLTD is built for collectors who take their collection seriously. Free to start. No credit card needed.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">Create your vault — it&apos;s free</Link>
          <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-white">Already have an account</Link>
        </div>
      </section>

      <footer className="border-t border-[color:var(--border)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[color:var(--muted2)] sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-white">Log in</Link>
            <Link href="/signup" className="hover:text-white">Sign up</Link>
            <Link href="#public-galleries" className="hover:text-white">Galleries</Link>
          </div>
          <div className="italic">© 2026 VLTD. Pronounced “Vaulted.”</div>
        </div>
      </footer>
    </main>
  );
}
