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

function formatValue(v: number | string | null | undefined) {
  if (!v) return null;
  const n = Number(v);
  if (!n) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function resolveLayoutType(layout: GalleryLayoutType | string | null | undefined) {
  if (!layout) return "GRID";
  if (typeof layout === "string") return layout.toUpperCase();
  if (typeof layout === "object" && "type" in layout) {
    return String((layout as Record<string, unknown>).type ?? "GRID").toUpperCase();
  }
  return "GRID";
}

/* ── Shelf grid — 3-column card layout like reference ─────── */
function ShelfGrid({ items, hrefPrefix, title }: { items: VaultItem[]; hrefPrefix: string; title?: string }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-4xl opacity-20">&#127963;</span>
        <p className="text-sm text-[#A0956B]">No items in this gallery yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Title pill */}
      {title && (
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(245,181,72,0.25))" }} />
          <div
            className="flex items-center gap-1.5 rounded-full border px-4 py-1"
            style={{ borderColor: "rgba(245,181,72,0.35)", background: "rgba(245,181,72,0.07)" }}
          >
            <span className="text-[9px] font-black uppercase tracking-[0.38em]" style={{ color: "#F5B548" }}>
              {title}
            </span>
          </div>
          <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(245,181,72,0.25))" }} />
        </div>
      )}

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((item) => {
          const img = itemImage(item);
          const val = formatValue(item.currentValue ?? item.estimatedValue);
          const meta = itemMeta(item);

          return (
            <Link
              key={item.id}
              href={hrefPrefix + "/" + item.id}
              className="flex flex-col overflow-hidden rounded-[14px] border transition-transform duration-150 active:scale-95"
              style={{
                background: "rgba(11,18,34,0.95)",
                borderColor: "rgba(245,181,72,0.16)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
              }}
            >
              {/* Portrait image */}
              <div className="relative overflow-hidden" style={{ paddingBottom: "133%" }}>
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-[10px] text-[#A0956B]">
                    &#8212;
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col gap-1 px-2 pb-2 pt-2">
                <p className="line-clamp-2 text-[10px] font-bold leading-snug text-[#F0EAD6]">{item.title}</p>
                {meta ? (
                  <p className="truncate text-[8px] leading-tight text-[#A0956B]">{meta}</p>
                ) : null}
                {val && (
                  <div
                    className="mt-0.5 rounded-full py-0.5 text-center text-[9px] font-black tracking-wide"
                    style={{ background: "rgba(245,181,72,0.13)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.22)" }}
                  >
                    {val}
                  </div>
                )}
              </div>

              {/* Like + Comment row */}
              <div
                className="flex items-center justify-center gap-2.5 px-2 py-1.5"
                style={{ borderTop: "1px solid rgba(245,181,72,0.09)" }}
              >
                <FavoriteButton
                  contentType="item"
                  contentId={String(item.id)}
                  metadata={favoriteMetadata(item)}
                  compact
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Thingsbook hero+filmstrip (kept for non-GRID layouts that opt in) ── */
function ThingsbookGrid({ items, hrefPrefix }: { items: VaultItem[]; hrefPrefix: string }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));
  const hero = items[safeIdx];
  if (!hero) return null;
  const heroImg = itemImage(hero);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
      <Link
        href={hrefPrefix + "/" + hero.id}
        className="block shrink-0 overflow-hidden rounded-[26px] bg-[color:var(--surface)] shadow-[0_16px_42px_rgba(0,0,0,0.18)] ring-2 ring-[color:var(--theme-gold,#F5B548)] transition hover:-translate-y-0.5 md:w-72"
      >
        {heroImg ? (
          <img src={heroImg} alt={hero.title} className="aspect-[3/4] w-full object-cover" draggable={false} />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-black/10 text-sm text-[color:var(--muted)]">No image</div>
        )}
        <div className="px-5 py-4">
          <div className="font-semibold leading-snug">{hero.title}</div>
          {itemMeta(hero) ? <div className="mt-1 text-xs text-[color:var(--muted)]">{itemMeta(hero)}</div> : null}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <div className="text-2xl font-semibold leading-tight">{hero.title}</div>
          {itemMeta(hero) ? <div className="mt-1.5 text-sm text-[color:var(--muted)]">{itemMeta(hero)}</div> : null}
          <div className="mt-2 text-xs opacity-50">{items.length} item{items.length !== 1 ? "s" : ""}</div>
        </div>
        <div
          className="no-scrollbar flex gap-3 overflow-x-auto pb-2 pt-1"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" } as React.CSSProperties}
        >
          {items.map((item, idx) => {
            const img = itemImage(item);
            const isSelected = idx === safeIdx;
            return (
              <div key={item.id} className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={"overflow-hidden rounded-xl transition hover:scale-105 active:scale-95 " + (isSelected
                    ? "ring-2 ring-[color:var(--theme-gold,#F5B548)] shadow-[0_6px_18px_rgba(245,181,72,0.3)] opacity-100"
                    : "ring-1 ring-[color:var(--border)] opacity-60 hover:opacity-100")}
                  style={{ width: 62, height: 84 }}
                  aria-label={item.title}
                >
                  {img ? (
                    <img src={img} alt={item.title} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/10 text-[9px] text-[color:var(--muted)]">&#8212;</div>
                  )}
                </button>
                <div className="flex items-center gap-1.5">
                  <FavoriteButton contentType="item" contentId={String(item.id)} metadata={favoriteMetadata(item)} compact />
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
  title,
}: {
  layout: GalleryLayoutType | string;
  items: VaultItem[];
  hrefPrefix?: string;
  title?: string;
}) {
  const layoutType = resolveLayoutType(layout);

  if (layoutType === "SPOTLIGHT") {
    return (
      <div className="grid gap-12">
        {items.map((i) => (
          <Link
            key={i.id}
            href={hrefPrefix + "/" + i.id}
            className="grid items-center gap-8 rounded-[26px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.14)] md:grid-cols-2"
          >
            {itemImage(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={itemImage(i)} alt={i.title} className="rounded-2xl" draggable={false} />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-black/10 text-sm text-[color:var(--muted)]">No image</div>
            )}
            <div>
              <div className="text-3xl font-semibold">{i.title}</div>
              {itemMeta(i) ? <div className="mt-2 text-base text-[color:var(--muted)]">{itemMeta(i)}</div> : null}
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
            href={hrefPrefix + "/" + i.id}
            className="flex items-start gap-6 rounded-[22px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
          >
            <div className="w-10 shrink-0 text-sm opacity-50">{index + 1}</div>
            <div className="min-w-0">
              <div className="font-semibold">{i.title}</div>
              {itemMeta(i) ? <div className="text-sm text-[color:var(--muted)]">{itemMeta(i)}</div> : null}
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
            href={hrefPrefix + "/" + i.id}
            className="block rounded-[26px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.14)]"
          >
            {itemImage(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={itemImage(i)} alt={i.title} className="mb-6 rounded-2xl" draggable={false} />
            ) : null}
            <h2 className="text-3xl font-semibold">{i.title}</h2>
            {itemMeta(i) ? <div className="mt-2 text-base text-[color:var(--muted)]">{itemMeta(i)}</div> : null}
          </Link>
        ))}
      </div>
    );
  }

  if (layoutType === "THINGSBOOK") {
    return <ThingsbookGrid items={items} hrefPrefix={hrefPrefix} />;
  }

  // Default GRID: 3-column shelf layout
  return <ShelfGrid items={items} hrefPrefix={hrefPrefix} title={title} />;
}
