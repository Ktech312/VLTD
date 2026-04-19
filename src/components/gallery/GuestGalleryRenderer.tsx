"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import GalleryShelfScene from "@/components/gallery/GalleryShelfScene";
import { PillButton } from "@/components/ui/PillButton";
import { getGalleryThemeLabel } from "@/lib/galleryModel";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import type { GuestGalleryViewModel } from "@/lib/guestGalleryViewModel";

const GALLERY_STAGE_WIDTH_CLASS = "max-w-[1120px]";

function itemSubtitle(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
}

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function DetailPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "rounded-full px-3 py-1.5 text-[11px] tracking-[0.08em] ring-1",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function getThemeChipClass(themePack: string) {
  switch (themePack) {
    case "walnut":
      return "bg-[rgba(64,38,23,0.78)] text-[#f1dcc3] ring-[#c4966d]/35";
    case "midnight":
      return "bg-[rgba(9,19,33,0.80)] text-cyan-100 ring-cyan-300/22";
    case "cold-blue":
      return "bg-[rgba(22,22,28,0.82)] text-stone-100 ring-white/12";
    case "marble":
      return "bg-[rgba(255,255,255,0.82)] text-slate-900 ring-slate-300/55";
    default:
      return "bg-[rgba(30,24,18,0.78)] text-amber-100 ring-amber-100/14";
  }
}

function ViewerItemCard({
  item,
  label,
}: {
  item: VaultItem;
  label: string;
}) {
  const imageUrl = getPrimaryImageUrl(item);

  return (
    <article className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="mb-2 text-[10px] tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>

      <div className="mb-3 aspect-[4/5] overflow-hidden rounded-[14px] bg-black/20 p-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
            No image
          </div>
        )}
      </div>

      <div className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</div>
      <div className="mt-1 line-clamp-1 text-[11px] text-[color:var(--muted)]">
        {itemSubtitle(item) || "—"}
      </div>
      <div className="mt-3 rounded-full bg-black/10 px-3 py-1 text-[11px] text-[color:var(--muted)] ring-1 ring-black/10">
        Estimated market value {formatMoney(item.currentValue)}
      </div>
    </article>
  );
}

export default function GuestGalleryRenderer({
  model,
  embedded = false,
}: {
  model: GuestGalleryViewModel;
  embedded?: boolean;
}) {
  const chipClass = getThemeChipClass(model.themePack);
  const backgroundImageUrl = model.background.url;

  return (
    <main
      className={[
        "relative bg-[radial-gradient(circle_at_top,rgba(30,36,46,0.96),rgba(8,10,14,1)_62%)] text-[color:var(--fg)]",
        embedded ? "" : "min-h-screen",
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,24,30,0.88),rgba(10,12,16,0.32)_24%,rgba(10,12,16,0.32)_76%,rgba(20,24,30,0.88))]" />
      <div className="relative">
        <div className={["mx-auto max-w-7xl px-4 sm:px-6", embedded ? "py-4" : "py-6 sm:py-10"].join(" ")}>
          {model.navigation.show ? (
            <div className={["mb-6 mx-auto flex flex-wrap items-center gap-3", GALLERY_STAGE_WIDTH_CLASS].join(" ")}>
              <PillButton variant="active" className="text-sm font-semibold">
                {model.navigation.primaryLabel || model.access.modeLabel}
              </PillButton>

              {model.navigation.backHref ? (
                <Link
                  href={model.navigation.backHref}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                >
                  Back to Gallery
                </Link>
              ) : null}

              {model.navigation.homeHref ? (
                <Link
                  href={model.navigation.homeHref}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                >
                  Museum Home
                </Link>
              ) : null}
            </div>
          ) : null}

          <section
            className={[
              "relative mx-auto overflow-hidden rounded-[30px] border border-white/12 bg-black/40 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.30)] backdrop-blur-sm sm:p-6",
              GALLERY_STAGE_WIDTH_CLASS,
            ].join(" ")}
          >
            <div className="relative">
              <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
                {model.access.modeLabel.toUpperCase()}
              </div>

              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
                    {model.galleryTitle}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                    {model.galleryDescription}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <DetailPill className={chipClass}>{model.galleryItems.length} items</DetailPill>
                    <DetailPill className={chipClass}>
                      {model.displayMode === "grid"
                        ? "Grid view"
                        : getGalleryThemeLabel(model.themePack)}
                    </DetailPill>
                    <DetailPill className={chipClass}>{model.layoutType} layout</DetailPill>
                    <DetailPill className={chipClass}>{model.displayMode} mode</DetailPill>
                    <DetailPill className={chipClass}>Background {model.background.type}</DetailPill>
                  </div>
                </div>

                <div className="rounded-full bg-black/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/10">
                  Estimated market value {formatMoney(model.totalValue)}
                </div>
              </div>
            </div>
          </section>

          {model.displayMode === "shelf" ? (
            <div className="mt-3">
              <GalleryShelfScene
                items={model.galleryItems}
                themePack={model.themePack}
                backgroundImageUrl={backgroundImageUrl}
                shelvesEnabled={model.shelvesEnabled}
                shelfOverlayStyle={model.shelfOverlayStyle}
              />
            </div>
          ) : (
            <section
              className={[
                "mt-3 mx-auto rounded-[30px] border border-white/12 bg-black/18 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm",
                GALLERY_STAGE_WIDTH_CLASS,
              ].join(" ")}
            >
              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,30,0.96),rgba(10,12,16,0.94))] p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {model.galleryItems.map((item, index) => (
                    <ViewerItemCard
                      key={item.id}
                      item={item}
                      label={`GRID ITEM #${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {model.galleryItems.length === 0 ? (
            <section className={["mt-6 mx-auto", GALLERY_STAGE_WIDTH_CLASS].join(" ")}>
              <div className="rounded-[28px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)]">
                <div className="text-sm text-[color:var(--muted)]">
                  This gallery does not currently contain any visible items.
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
