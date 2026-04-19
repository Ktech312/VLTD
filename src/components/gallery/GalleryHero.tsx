"use client";

import { getGalleryThemeLabel, type Gallery } from "@/lib/galleryModel";
import { resolveGalleryVisualTheme } from "@/components/gallery/galleryThemes";

export default function GalleryHero({
  gallery,
  eyebrow = "GALLERY",
  guestMode = false,
}: {
  gallery: Gallery;
  eyebrow?: string;
  guestMode?: boolean;
}) {
  const resolved = resolveGalleryVisualTheme({
    themePack: gallery.themePack,
  });

  const theme = resolved.galleryTheme;

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
      <div className={["absolute inset-0", theme.roomClass].join(" ")} />

      {gallery.coverImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gallery.coverImage}
            alt={gallery.title}
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/35" />
        </>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: theme.heroOverlay }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-8 sm:py-18">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] tracking-[0.26em] text-[color:var(--muted2)]">
              {eyebrow}
            </div>

            <div className="rounded-full bg-black/20 px-3 py-1 text-[10px] tracking-[0.14em] ring-1 ring-white/10">
              THEME {getGalleryThemeLabel(gallery.themePack).toUpperCase()}
            </div>

            {guestMode ? (
              <div className="rounded-full bg-black/20 px-3 py-1 text-[10px] tracking-[0.14em] ring-1 ring-white/10">
                GUEST VIEW
              </div>
            ) : null}
          </div>

          <h1 className={["mt-4 text-4xl font-semibold sm:text-5xl", theme.accentClass].join(" ")}>
            {gallery.title}
          </h1>

          {gallery.description?.trim() ? (
            <div className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
              {gallery.description}
            </div>
          ) : (
            <div className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)] sm:text-lg">
              Curated collection presentation.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
