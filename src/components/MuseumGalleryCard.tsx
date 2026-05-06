"use client";

import Link from "next/link";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import type { Gallery } from "@/lib/galleryModel";

type GalleryScoreBand = "Basic" | "Curated" | "Exhibition Grade";

type MuseumGalleryCardProps = {
  gallery: Gallery;
  score: {
    score: number;
    band: GalleryScoreBand;
    signals: {
      sections: number;
      featuredWorks: number;
    };
  };
  totalValue: number;
  views: number;
};

function visibilityLabel(v: Gallery["visibility"]) {
  if (v === "LOCKED") return "Locked";
  if (v === "INVITE") return "Invite Only";
  return "Public";
}

function stateLabel(v: Gallery["state"]) {
  return v === "STORAGE" ? "Storage" : "Active";
}

function scoreBandTone(band: GalleryScoreBand) {
  if (band === "Exhibition Grade") return "Exhibition Grade";
  if (band === "Curated") return "Curated";
  return "Basic";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MuseumGalleryCard({
  gallery,
  score,
  totalValue,
  views,
}: MuseumGalleryCardProps) {
  return (
    <Link
      href={`/museum/${gallery.id}`}
      className="group relative flex h-[430px] w-full max-w-[360px] flex-col overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,0.28)]"
    >
      <div className="mb-4 h-[178px] overflow-hidden rounded-[18px] bg-black/20 ring-1 ring-white/8">
        {gallery.coverImage ? (
          <ProgressiveImage
            src={gallery.coverImage}
            alt={`${gallery.title} cover`}
            className="h-full w-full"
            imageClassName="object-cover transition duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">
            No cover
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
            CURATED GALLERY
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
              {visibilityLabel(gallery.visibility)}
            </span>

            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
              {stateLabel(gallery.state)}
            </span>
          </div>
        </div>

        <h2 className="mt-3 line-clamp-2 text-xl font-semibold leading-tight">
          {gallery.title}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-5 text-[color:var(--muted)]">
          {gallery.description?.trim()
            ? gallery.description
            : "A museum-style presentation built from selected collection pieces."}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
            Score {score.score}/100
          </span>
          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
            {scoreBandTone(score.band)}
          </span>
          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
            {views} views
          </span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3 rounded-[18px] bg-black/20 px-3 py-2.5 ring-1 ring-white/8">
          <div>
            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
              ITEMS
            </div>
            <div className="mt-1 text-xl font-semibold">{gallery.itemIds.length}</div>
          </div>

          <div>
            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
              VALUE
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatMoney(totalValue)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--muted)]">
          <div>
            {score.signals.sections} sections • {score.signals.featuredWorks} featured
          </div>
          <div className="transition group-hover:translate-x-0.5">Open →</div>
        </div>
      </div>
    </Link>
  );
}
