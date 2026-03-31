// Path: src/components/gallery/GalleryShelfScene.tsx
"use client";

import Link from "next/link";

import type { VaultItem } from "@/lib/vaultModel";

import { resolveGalleryVisualTheme } from "@/components/gallery/galleryThemes";

function itemImage(item: VaultItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function itemMeta(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
}

export default function GalleryShelfScene({
  items,
  galleryHrefPrefix = "/vault/item",
  themeId,
  shelfStyleId,
  backdropStyleId,
  themePack,
  title,
  subtitle,
  guestMode = false,
}: {
  items: VaultItem[];
  galleryHrefPrefix?: string;
  themeId?: string | null;
  shelfStyleId?: string | null;
  backdropStyleId?: string | null;
  themePack?: string | null;
  title?: string;
  subtitle?: string;
  guestMode?: boolean;
}) {
  const resolved = resolveGalleryVisualTheme({
    themeId,
    shelfStyleId,
    backdropStyleId,
    themePack,
  });

  const theme = resolved.galleryTheme;
  const shelf = resolved.shelfStyle;
  const backdrop = resolved.backdropStyle;

  const topRow = items.slice(0, 4);
  const bottomRow = items.slice(4, 10);

  function renderShelfRow(rowItems: VaultItem[], rowLabel: string) {
    return (
      <div className="relative">
        <div
          className={[
            "relative rounded-[24px] p-5 ring-1 ring-white/10",
            theme.panelClass,
            theme.shelfGlowClass,
          ].join(" ")}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                {rowLabel}
              </div>
              <div className={["mt-1 text-lg font-semibold", theme.accentClass].join(" ")}>
                Collector Shelf
              </div>
            </div>

            {guestMode ? (
              <div className="rounded-full bg-black/20 px-3 py-1 text-[10px] tracking-[0.14em] ring-1 ring-white/10">
                GUEST VIEW
              </div>
            ) : (
              <div className="rounded-full bg-black/20 px-3 py-1 text-[10px] tracking-[0.14em] ring-1 ring-white/10">
                CURATED VIEW
              </div>
            )}
          </div>

          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {rowItems.map((item) => (
                <Link
                  key={item.id}
                  href={`${galleryHrefPrefix}/${item.id}`}
                  className={[
                    "group relative overflow-hidden rounded-[22px] p-3 ring-1 transition duration-300",
                    theme.cardClass,
                    "hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(0,0,0,0.26)]",
                  ].join(" ")}
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] bg-black/25">
                    {itemImage(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={itemImage(item)}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                        No image
                      </div>
                    )}

                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: theme.heroOverlay }}
                    />
                  </div>

                  <div className="mt-3">
                    <div className="line-clamp-2 text-base font-semibold">{item.title}</div>
                    <div className="mt-1 line-clamp-1 text-sm text-[color:var(--muted)]">
                      {itemMeta(item) || "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="pointer-events-none mt-5">
              <div className={["h-4 rounded-t-[18px]", shelf.lipClass].join(" ")} />
              <div className={["h-4 rounded-b-[18px]", shelf.shelfClass].join(" ")} />
              <div className="flex justify-between px-8">
                <div className={["h-10 w-2 rounded-b-full", shelf.supportClass].join(" ")} />
                <div className={["h-10 w-2 rounded-b-full", shelf.supportClass].join(" ")} />
                <div className={["h-10 w-2 rounded-b-full", shelf.supportClass].join(" ")} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
      <div className={["absolute inset-0", theme.roomClass].join(" ")} />
      <div className={["absolute inset-0", backdrop.wallClass].join(" ")} />
      <div className={["absolute inset-0", backdrop.vignetteClass].join(" ")} />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: theme.heroOverlay }}
      />

      <div className="relative px-5 py-6 sm:px-6 sm:py-7">
        {(title || subtitle) && (
          <div className="mb-6 max-w-3xl">
            {title ? <div className="text-2xl font-semibold sm:text-3xl">{title}</div> : null}
            {subtitle ? (
              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{subtitle}</div>
            ) : null}
          </div>
        )}

        <div className="grid gap-6">
          {topRow.length > 0 ? renderShelfRow(topRow, "FRONT WALL") : null}
          {bottomRow.length > 0 ? renderShelfRow(bottomRow, "SECOND WALL") : null}
        </div>
      </div>
    </section>
  );
}