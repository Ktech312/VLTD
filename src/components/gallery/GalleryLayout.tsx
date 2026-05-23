"use client";

import { useState } from "react";
import Link from "next/link";

import FavoriteButton from "@/components/FavoriteButton";
import { type VaultItem } from "@/lib/vaultModel";
import { type GalleryLayout as GalleryLayoutType } from "@/lib/galleryLayout";

function itemImage(i: VaultItem) {
  return i.imageFrontUrl || i.imageBackUrl || "";
}

function itemMeta(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
}

function favoriteMetadata(item: VaultItem) {
  return {
    title: item.title,
    subtitle: item.subtitle,
    image: item.imageFrontUrl || item.imageBackUrl || "",
  };
}

function resolveLayoutType(layout: GalleryLayoutType | string | null | undefined) {
  if (!layout) return "GRID";
  if (typeof layout === "string") {
    return layout.toUpperCase();
  }
  if (typeof layout === "object" && "type" in layout) {
    return String((layout as any).type ?? "GRID").toUpperCase();
  }
  return "GRID";
}

// Comment bubble SVG
function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// Thingsbook-style hero + filmstrip layout
function ThingsbookGrid({ items, hrefPrefix }: { items: VaultItem[]; hrefPrefix: string }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));
  const hero = items[safeIdx];
  if (!hero) return null;

  const heroImg = itemImage(hero);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
      {/* Hero card — portrait, links to item detail */}
      <Link
        href={`${hrefPrefix}/${hero.id}`}
        className="block shrink-0 overflow-hidden rounded-[26px] bg-[color:var(--surface)] shadow-[0_16px_42px_rgba(0,0,0,0.18)] ring-2 ring-[color:var(--theme-gold,#F5B548)] transition hover:-translate-y-0.5 md:w-72"
      >
        {heroImg ? (
          <img
            src={heroImg}
            alt={hero.title}
            className="aspect-[3/4] w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-black/10 text-sm text-[color:var(--muted)]">
            No image
          </div>
        )}
        <div className="px-5 py-4">
          <div className="font-semibold leading-snug">{hero.title}</div>
          {itemMeta(hero) ? (
            <div className="mt-1 text-xs text-[color:var(--muted)]">{itemMeta(hero)}</div>
          ) : null}
        </div>
      </Link>

      {/* Right side: item info + filmstrip */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <div className="text-2xl font-semibold leading-tight">{hero.title}</div>
          {itemMeta(hero) ? (
            <div className="mt-1.5 text-sm text-[color:var(--muted)]">{itemMeta(hero)}</div>
          ) : null}
          <div className="mt-2 text-xs opacity-50">{items.length} item{items.length !== 1 ? "s" : ""}</div>
        </div>

        {/* Horizontal filmstrip */}
        <div
          className="no-scrollbar flex gap-3 overflow-x-auto pb-2 pt-1"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
          } as React.CSSProperties}
        >
          {items.map((item, idx) => {
            const img = itemImage(item);
            const isSelected = idx === safeIdx;
            return (
              <div key={item.id} className="flex shrink-0 flex-col items-center gap-1.5">
                {/* Thumbnail button */}
                <button
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`overflow-hidden rounded-xl transition hover:scale-105 active:scale-95 ${
                    isSelected
                      ? "ring-2 ring-[color:var(--theme-gold,#F5B548)] shadow-[0_6px_18px_rgba(245,181,72,0.3)] opacity-100"
                      : "ring-1 ring-[color:var(--border)] opacity-60 hover:opacity-100"
                  }`}
                  style={{ width: 62, height: 84 }}
                  aria-label={item.title}
                >
                  {img ? (
                    <img
                      src={img}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/10 text-[9px] text-[color:var(--muted)]">
                      —
                    </div>
                  )}
                </button>

                {/* Like + Comment */}
                <div className="flex items-center gap-1.5">
                  <FavoriteButton
                    contentType="item"
                    contentId={String(item.id)}
                    metadata={favoriteMetadata(item)}
                    compact
                  />
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--muted)] opacity-50 transition hover:opacity-100"
                    aria-label="Comment"
                  >
                    <CommentIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function GalleryLayout({
  layout,
  items,
  hrefPrefix = "/vault/item",
}: {
  layout: GalleryLayoutType | string;
  items: VaultItem[];
  hrefPrefix?: string;
}) {
  const layoutType = resolveLayoutType(layout);

  if (layoutType === "SPOTLIGHT") {
    return (
      <div className="grid gap-12">
        {items.map((i) => (
          <Link
            key={i.id}
            href={`${hrefPrefix}/${i.id}`}
            className="grid items-center gap-8 rounded-[26px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.14)] md:grid-cols-2"
          >
            {itemImage(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={itemImage(i)}
                alt={i.title}
                className="rounded-2xl"
                draggable={false}
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-black/10 text-sm text-[color:var(--muted)]">
                No image
              </div>
            )}
            <div>
              <div className="text-3xl font-semibold">{i.title}</div>
              {itemMeta(i) ? (
                <div className="mt-2 text-base text-[color:var(--muted)]">{itemMeta(i)}</div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (layoutType === "TIMELINE") {
    return (
      <div className="grid gap-6">
        {items.map((i, index) => (
          <Link
            key={i.id}
            href={`${hrefPrefix}/${i.id}`}
            className="flex items-start gap-6 rounded-[22px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
          >
            <div className="w-10 shrink-0 text-sm opacity-50">{index + 1}</div>
            <div className="min-w-0">
              <div className="font-semibold">{i.title}</div>
              {itemMeta(i) ? (
                <div className="text-sm text-[color:var(--muted)]">{itemMeta(i)}</div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (layoutType === "EDITORIAL") {
    return (
      <div className="grid gap-16">
        {items.map((i) => (
          <Link
            key={i.id}
            href={`${hrefPrefix}/${i.id}`}
            className="block rounded-[26px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.14)]"
          >
            {itemImage(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={itemImage(i)}
                alt={i.title}
                className="mb-6 rounded-2xl"
                draggable={false}
              />
            ) : null}
            <h2 className="text-3xl font-semibold">{i.title}</h2>
            {itemMeta(i) ? (
              <div className="mt-2 text-base text-[color:var(--muted)]">{itemMeta(i)}</div>
            ) : null}
          </Link>
        ))}
      </div>
    );
  }

  // Default:
  // Default: Thingsbook-style hero + filmstrip
  return <ThingsbookGrid items={items} hrefPrefix={hrefPrefix} />;
}
