"use client";

import Link from "next/link";

import { type VaultItem } from "@/lib/vaultModel";
import { type GalleryLayout as GalleryLayoutType } from "@/lib/galleryLayout";

function itemImage(i: VaultItem) {
  return i.imageFrontUrl || i.imageBackUrl || "";
}

function itemMeta(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
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

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <article
          key={i.id}
          className="relative rounded-2xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.12)]"
        >
          <Link href={`${hrefPrefix}/${i.id}`} className="block">
            {itemImage(i) ? (
              <div className="mb-4 overflow-hidden rounded-[18px] bg-black/15">
                <img
                  src={itemImage(i)}
                  alt={i.title}
                  className="aspect-[3/4] w-full object-cover"
                  draggable={false}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="mb-4 flex aspect-[3/4] items-center justify-center rounded-[18px] bg-black/10 text-sm text-[color:var(--muted)]">
                No image
              </div>
            )}

            <div className="font-semibold">{i.title}</div>

            {itemMeta(i) ? (
              <div className="text-sm text-[color:var(--muted)]">{itemMeta(i)}</div>
            ) : null}
          </Link>
        </article>
      ))}
    </div>
  );
}
