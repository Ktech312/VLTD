"use client";

import { getGalleryThemeLabel, type Gallery } from "@/lib/galleryModel";
import { resolveGalleryVisualTheme } from "@/components/gallery/galleryThemes";

export default function GalleryHero({
  gallery,
  guestMode = false,
  isOwner = false,
  galleryMode = "grid",
  onSwipe,
  onGridView,
  onAdd,
  onDelete,
  onReport,
}: {
  gallery: Gallery;
  guestMode?: boolean;
  isOwner?: boolean;
  galleryMode?: "grid" | "swipe";
  onSwipe?: () => void;
  onGridView?: () => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const resolved = resolveGalleryVisualTheme({ themePack: gallery.themePack });
  const theme = resolved.galleryTheme;

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
      {/* Background room */}
      <div className={["absolute inset-0", theme.roomClass].join(" ")} />

      {/* Cover image */}
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

      {/* Top gradient overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{ background: theme.heroOverlay }}
      />

      {/* ── Top-right: Report (viewer) or Delete (owner) ── */}
      <div className="absolute right-3 top-3 z-10">
        {isOwner ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition hover:bg-red-500/20 hover:text-red-400"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#E05252",
            }}
          >
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={onReport}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition hover:bg-white/10"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            Report
          </button>
        )}
      </div>

      {/* ── Hero text content ── */}
      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-14 sm:px-8 sm:pt-18">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] tracking-[0.26em] text-[color:var(--muted2)]">
              EXHIBIT
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

      {/* ── Bottom row: Swipe + Gallery View on left, + on right ── */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
        {/* Left: mode pills */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSwipe}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold backdrop-blur-sm transition"
            style={
              galleryMode === "swipe"
                ? {
                    background: "var(--theme-gold-subtle, rgba(245,181,72,0.20))",
                    border: "1px solid rgba(245,181,72,0.5)",
                    color: "#F5B548",
                  }
                : {
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.80)",
                  }
            }
          >
            Swipe
          </button>
          <button
            type="button"
            onClick={onGridView}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold backdrop-blur-sm transition"
            style={
              galleryMode === "grid"
                ? {
                    background: "var(--theme-gold-subtle, rgba(245,181,72,0.20))",
                    border: "1px solid rgba(245,181,72,0.5)",
                    color: "#F5B548",
                  }
                : {
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.80)",
                  }
            }
          >
            Gallery View
          </button>
        </div>

        {/* Right: Add item */}
        {isOwner && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition hover:scale-105 active:scale-95"
            style={{
              background: "var(--theme-gold-subtle, rgba(245,181,72,0.18))",
              border: "1px solid rgba(245,181,72,0.45)",
              color: "#F5B548",
              fontSize: "20px",
              fontWeight: 300,
            }}
            aria-label="Add item to exhibit"
          >
            +
          </button>
        )}
      </div>
    </section>
  );
}
