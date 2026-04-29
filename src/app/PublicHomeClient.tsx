"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Gallery } from "@/lib/galleryModel";

type PublicGalleryCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
  itemCount: number;
  views: number;
  universe: VaultUniverseKey;
};

type VaultUniverseKey =
  | "POP_CULTURE"
  | "SPORTS"
  | "TCG"
  | "MUSIC"
  | "JEWELRY_APPAREL"
  | "GAMES"
  | "MISC";

type VaultUniverseLanding = {
  key: VaultUniverseKey;
  label: string;
  slug: string;
  description: string;
  example: string;
};

type VaultCloudRuntime = Pick<
  typeof import("@/lib/vaultCloud"),
  "getVaultImagePublicUrl" | "isDirectBrowserImageUrl"
>;

const FEATURE_LABELS = [
  "Scan collectibles into a structured vault",
  "Build public galleries without giving away private inventory",
  "Track value, provenance, proof images, and collection context",
];

const VAULT_UNIVERSES: VaultUniverseLanding[] = [
  {
    key: "POP_CULTURE",
    label: "Pop Culture",
    slug: "pop-culture",
    description:
      "Comics, figures, art cards, posters, props, and entertainment collectibles.",
    example: "Comics / figures / art cards",
  },
  {
    key: "SPORTS",
    label: "Sports",
    slug: "sports",
    description:
      "Sports cards, memorabilia, jerseys, autographs, game-used items, and team collections.",
    example: "Cards / autos / memorabilia",
  },
  {
    key: "TCG",
    label: "TCG",
    slug: "tcg",
    description:
      "Pokémon, Magic, Yu-Gi-Oh!, sealed product, slabs, singles, and trading card games.",
    example: "Singles / slabs / sealed",
  },
  {
    key: "MUSIC",
    label: "Music",
    slug: "music",
    description:
      "Vinyl, albums, signed records, instruments, music memorabilia, and artist collections.",
    example: "Vinyl / albums / memorabilia",
  },
  {
    key: "JEWELRY_APPAREL",
    label: "Jewelry / Apparel",
    slug: "jewelry-apparel",
    description:
      "Watches, jewelry, luxury accessories, streetwear, vintage apparel, and limited drops.",
    example: "Watches / apparel / drops",
  },
  {
    key: "GAMES",
    label: "Games",
    slug: "games",
    description:
      "Video games, consoles, cartridges, controllers, arcade pieces, and sealed games.",
    example: "Games / consoles / sealed",
  },
  {
    key: "MISC",
    label: "Misc",
    slug: "misc",
    description:
      "Everything unique, uncategorized, experimental, or not yet assigned to a primary universe.",
    example: "Unique / mixed / uncategorized",
  },
];

const FALLBACK_GALLERIES: PublicGalleryCard[] = [
  {
    id: "sample-comics",
    title: "Silver Age Wall",
    description:
      "A public-style gallery for comics, slabs, key issues, and supporting notes.",
    href: "/signup",
    image: "/themes/classic-shelf-wall.webp",
    itemCount: 18,
    views: 0,
    universe: "POP_CULTURE",
  },
  {
    id: "sample-cards",
    title: "Graded Card Showcase",
    description:
      "A clean presentation for cards, certs, grades, and high-signal collection stories.",
    href: "/signup",
    image: "/themes/midnight-shelf-wall.webp",
    itemCount: 24,
    views: 0,
    universe: "TCG",
  },
  {
    id: "sample-vault",
    title: "Collector Vault Preview",
    description:
      "A public window into the collection while private cost and storage details stay protected.",
    href: "/signup",
    image: "/themes/walnut-shelf-wall.webp",
    itemCount: 32,
    views: 0,
    universe: "MISC",
  },
];

function resolveSnapshotImage(gallery: Gallery, cloud: VaultCloudRuntime) {
  const snapshot = gallery.publicItemSnapshots?.find(
    (item) =>
      item.imageFrontUrl ||
      item.imageBackUrl ||
      item.imageFrontStoragePath ||
      item.primaryImageKey,
  );

  const directUrl = snapshot?.imageFrontUrl || snapshot?.imageBackUrl || "";
  if (directUrl && cloud.isDirectBrowserImageUrl(directUrl)) return directUrl;

  const storagePath =
    snapshot?.imageFrontStoragePath || snapshot?.primaryImageKey || "";
  if (storagePath) return cloud.getVaultImagePublicUrl(storagePath);

  return "";
}

function normalizeUniverseText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferGalleryUniverse(gallery: Gallery): VaultUniverseKey {
  const text = normalizeUniverseText(
    [
      gallery.title,
      gallery.description,
      gallery.themePack,
      ...(gallery.publicItemSnapshots ?? []).flatMap((item) => [
        item.title,
        item.subtitle,
        item.number,
        item.grade,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

  const has = (terms: string[]) => terms.some((term) => text.includes(term));

  if (
    has([
      "pokemon",
      "pokémon",
      "magic",
      "mtg",
      "yugioh",
      "yu gi oh",
      "tcg",
      "trading card",
      "sealed product",
      "slab",
    ])
  )
    return "TCG";
  if (
    has([
      "sports",
      "rookie",
      "jersey",
      "panini",
      "topps",
      "baseball",
      "basketball",
      "football",
      "hockey",
      "soccer",
      "autograph",
      "memorabilia",
    ])
  )
    return "SPORTS";
  if (
    has([
      "vinyl",
      "music",
      "album",
      "record",
      "lp",
      "signed record",
      "instrument",
      "guitar",
      "artist",
    ])
  )
    return "MUSIC";
  if (
    has([
      "jewelry",
      "apparel",
      "watch",
      "watches",
      "streetwear",
      "luxury",
      "bag",
      "bags",
      "drop",
    ])
  )
    return "JEWELRY_APPAREL";
  if (
    has([
      "video game",
      "games",
      "console",
      "cartridge",
      "nintendo",
      "playstation",
      "xbox",
      "sega",
      "arcade",
    ])
  )
    return "GAMES";
  if (
    has([
      "comic",
      "comics",
      "batman",
      "spider",
      "marvel",
      "dc",
      "funko",
      "figure",
      "toy",
      "movie",
      "poster",
      "prop",
      "pop culture",
      "manga",
      "art card",
    ])
  )
    return "POP_CULTURE";

  return "MISC";
}

function galleryImage(gallery: Gallery, cloud: VaultCloudRuntime) {
  if (gallery.coverImage) return gallery.coverImage;
  const snapshotImage = resolveSnapshotImage(gallery, cloud);
  if (snapshotImage) return snapshotImage;
  if (gallery.themePack === "walnut") return "/themes/walnut-shelf-wall.webp";
  if (gallery.themePack === "midnight")
    return "/themes/midnight-shelf-wall.webp";
  if (gallery.themePack === "cold-blue") return "/themes/cold-blue-bg.png";
  return "/themes/classic-shelf-wall.webp";
}

function toPublicCard(
  gallery: Gallery,
  cloud: VaultCloudRuntime,
): PublicGalleryCard {
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
    image: galleryImage(gallery, cloud),
    itemCount:
      gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0,
    views: gallery.analytics?.views ?? 0,
    universe: inferGalleryUniverse(gallery),
  };
}

function PublicGalleryTile({ gallery }: { gallery: PublicGalleryCard }) {
  return (
    <Link
      href={gallery.href}
      className="group overflow-hidden rounded-lg bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:bg-[color:var(--pill)]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-black/20">
        <img
          src={gallery.image}
          alt={gallery.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-4">
        <div className="text-base font-semibold text-[color:var(--fg)]">
          {gallery.title}
        </div>
        <div className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--muted)]">
          {gallery.description}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted2)]">
          <span>
            {VAULT_UNIVERSES.find(
              (universe) => universe.key === gallery.universe,
            )?.label ?? "Misc"}
          </span>
          <span>{gallery.itemCount} pieces</span>
          <span>{gallery.views} views</span>
        </div>
      </div>
    </Link>
  );
}

function UniverseTile({
  universe,
  count,
}: {
  universe: VaultUniverseLanding;
  count: number;
}) {
  return (
    <a
      href="#public-galleries"
      className="group rounded-lg bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:bg-[color:var(--pill)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[color:var(--fg)]">
            {universe.label}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted2)]">
            {universe.example}
          </div>
        </div>
        <div className="rounded-full bg-black/20 px-2 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-300/15">
          {count}
        </div>
      </div>
      <div className="mt-3 line-clamp-3 text-sm leading-6 text-[color:var(--muted)]">
        {universe.description}
      </div>
    </a>
  );
}

export default function PublicHomeClient() {
  const [galleryCards, setGalleryCards] =
    useState<PublicGalleryCard[]>(FALLBACK_GALLERIES);

  const topGalleries = [...galleryCards]
    .sort(
      (a, b) =>
        b.views - a.views ||
        b.itemCount - a.itemCount ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 6);

  const universeCounts = VAULT_UNIVERSES.reduce(
    (acc, universe) => {
      acc[universe.key] = galleryCards.filter(
        (gallery) => gallery.universe === universe.key,
      ).length;
      return acc;
    },
    {} as Record<VaultUniverseKey, number>,
  );

  useEffect(() => {
    let isActive = true;
    let removeGalleryListener = () => {};

    async function loadPublicGalleries() {
      const [galleryModel, cloud] = await Promise.all([
        import("@/lib/galleryModel"),
        import("@/lib/vaultCloud"),
      ]);

      if (!isActive) return;

      function applyGalleries() {
        if (!isActive) return;

        const live = galleryModel
          .loadAllGalleries()
          .filter(
            (gallery) =>
              gallery.state === "ACTIVE" && gallery.visibility === "PUBLIC",
          )
          .sort(
            (a, b) =>
              Number(b.analytics?.views ?? 0) -
                Number(a.analytics?.views ?? 0) ||
              Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0),
          )
          .slice(0, 6)
          .map((gallery) => toPublicCard(gallery, cloud));

        setGalleryCards(live.length ? live : FALLBACK_GALLERIES);
      }

      applyGalleries();
      void galleryModel.refreshGalleriesFromSupabase(true).then(applyGalleries);
      window.addEventListener(galleryModel.GALLERY_EVENT, applyGalleries);
      removeGalleryListener = () =>
        window.removeEventListener(galleryModel.GALLERY_EVENT, applyGalleries);
    }

    void loadPublicGalleries();

    return () => {
      isActive = false;
      removeGalleryListener();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <section className="relative min-h-[74vh] overflow-hidden">
        <img
          src="/themes/classic-shelf-wall.webp"
          alt="VLTD public gallery wall"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.84),rgba(0,0,0,0.52),rgba(0,0,0,0.16))]" />
        <div className="relative mx-auto flex min-h-[74vh] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">
              Collector vaults, public galleries, private control
            </div>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              VLTD
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
              Turn Pop Culture, Sports, TCG, Music, Jewelry / Apparel, Games,
              and Misc collections into a private vault with polished public
              galleries built for sharing.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black"
              >
                Create a Vault
              </Link>
              <Link
                href="#public-galleries"
                className="inline-flex h-11 items-center justify-center rounded-full bg-black/30 px-5 text-sm font-semibold text-white ring-1 ring-white/20"
              >
                Browse Public Galleries
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {FEATURE_LABELS.map((label) => (
            <div key={label} className="text-sm text-[color:var(--muted)]">
              <span className="text-[color:var(--fg)]">VLTD</span>{" "}
              {label.toLowerCase()}.
            </div>
          ))}
        </div>
      </section>

      <section
        id="universes"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">
              Vault Universes
            </div>
            <h2 className="mt-2 text-3xl font-semibold">
              Browse by the same structure collectors use inside VLTD
            </h2>
          </div>
          <Link
            href="/signup"
            className="text-sm font-medium text-[color:var(--fg)] underline underline-offset-4"
          >
            Start building your own vault
          </Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VAULT_UNIVERSES.map((universe) => (
            <UniverseTile
              key={universe.key}
              universe={universe}
              count={universeCounts[universe.key] ?? 0}
            />
          ))}
        </div>
      </section>

      <section
        id="public-galleries"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">
              Top Public Galleries
            </div>
            <h2 className="mt-2 text-3xl font-semibold">
              Most viewed galleries from the community
            </h2>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-[color:var(--fg)] underline underline-offset-4"
          >
            Log in to manage your vault
          </Link>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topGalleries.map((gallery) => (
            <PublicGalleryTile key={gallery.id} gallery={gallery} />
          ))}
        </div>
      </section>
    </main>
  );
}
