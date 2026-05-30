"use client";

import Link from "next/link";
import { useState } from "react";
import type { DragEvent, ReactNode } from "react";

import FavoriteButton from "@/components/FavoriteButton";
import GalleryShelfScene from "@/components/gallery/GalleryShelfScene";
import { PillButton } from "@/components/ui/PillButton";
import { getGallerySections, getGalleryThemeLabel } from "@/lib/galleryModel";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import type { GuestGalleryViewModel } from "@/lib/guestGalleryViewModel";

const GALLERY_STAGE_WIDTH_CLASS = "max-w-[1120px]";

// Type alias so `<HTMLElement>` generic doesn't confuse the TSX parser inside JSX expressions
type CardDragHandler = (e: DragEvent<HTMLElement>) => void;

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
      return "bg-vault-card text-cyan-100 ring-cyan-300/22";
    case "cold-blue":
      return "bg-vault-card text-stone-100 ring-white/12";
    case "marble":
      return "bg-[rgba(255,255,255,0.82)] text-slate-900 ring-slate-300/55";
    default:
      return "bg-[rgba(30,24,18,0.78)] text-amber-100 ring-amber-100/14";
  }
}

function ViewerItemCard({
  item,
  label,
  compact = false,
  onRemove,
  isDragOver,
  isDraggable,
}: {
  item: VaultItem;
  label: string;
  compact?: boolean;
  onRemove?: () => void;
  isDragOver?: boolean;
  isDraggable?: boolean;
}) {
  const imageUrl = getPrimaryImageUrl(item);
  const subtitle = itemSubtitle(item);

  if (compact) {
    return (
      <article
        data-item-id={item.id}
        className={[
          "relative overflow-hidden rounded-[14px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_6px_16px_rgba(0,0,0,0.22)] transition-transform duration-100",
          isDragOver
            ? "scale-[1.03] border-[#F5B548]/60 shadow-[0_0_0_2px_rgba(245,181,72,0.35),0_6px_16px_rgba(0,0,0,0.22)]"
            : "border-white/10",
          isDraggable ? "cursor-grab active:cursor-grabbing" : "",
        ].join(" ")}
        draggable={isDraggable || undefined}
      >
        {/* Remove button */}
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="pointer-events-auto absolute right-1 top-1 z-20 grid h-[18px] w-[18px] place-items-center rounded-full border border-red-400/70 bg-black/75"
            style={{ boxShadow: "0 0 8px rgba(248,113,113,0.75), 0 0 18px rgba(248,113,113,0.35)" }}
            aria-label={`Remove ${item.title}`}
          >
            <span
              className="h-[2px] w-[8px] rounded-full bg-red-400"
              style={{ boxShadow: "0 0 4px rgba(248,113,113,0.9)" }}
              aria-hidden="true"
            />
          </button>
        ) : null}

        <div className="relative aspect-[2/3] overflow-hidden bg-black/20">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--muted)]">—</div>
          )}

          {/* Ghost title / subtitle overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1.5 pt-5">
            <div className="line-clamp-2 text-[8px] font-semibold leading-tight text-white/90">{item.title}</div>
            {subtitle ? (
              <div className="mt-0.5 line-clamp-1 text-[7px] leading-tight text-white/55">{subtitle}</div>
            ) : null}
          </div>

          {/* Drag dots */}
          {isDraggable ? (
            <div
              className="pointer-events-none absolute right-1 bottom-[22px] grid grid-cols-2 gap-[2px] opacity-40"
              aria-hidden="true"
            >
              {Array.from({ length: 6 }).map((_, k) => (
                <span key={k} className="h-[3px] w-[3px] rounded-full bg-white" />
              ))}
            </div>
          ) : null}
        </div>

      </article>
    );
  }

  return (
    <article className="relative rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="mb-2 text-[10px] tracking-[0.16em] text-[color:var(--muted2)]">{label}</div>

      <div className="absolute right-3 top-3 z-10">
        <FavoriteButton
          contentType="item"
          contentId={String(item.id)}
          metadata={{ title: item.title, subtitle: item.subtitle, image: imageUrl || "" }}
          compact
          showMessage={false}
        />
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
        EMV {formatMoney(item.currentValue)}
      </div>
    </article>
  );
}

function reorderByDrag(ids: string[], fromId: string, toId: string): string[] {
  if (!fromId || !toId || fromId === toId) return ids;
  const next = [...ids];
  const fromIdx = next.indexOf(fromId);
  const toIdx = next.indexOf(toId);
  if (fromIdx < 0 || toIdx < 0) return ids;
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

function getShelfSlotLayout(model: GuestGalleryViewModel) {
  const visibleIds = new Set(model.galleryItems.map((item) => item.id));
  const sections = getGallerySections(model.gallery);

  return sections.find((section) =>
    Array.isArray(section.slotLayout) &&
    section.slotLayout.some((itemId) => typeof itemId === "string" && visibleIds.has(itemId))
  )?.slotLayout;
}

export default function GuestGalleryRenderer({
  model,
  embedded = false,
  onRemoveItem,
  onReorder,
}: {
  model: GuestGalleryViewModel;
  embedded?: boolean;
  onRemoveItem?: (itemId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Drag delegation handlers (defined here, outside JSX, to avoid TSX parser ambiguity) ──
  const gridDragStart: CardDragHandler | null = onReorder
    ? (e) => {
        const id = (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id");
        if (!id) return;
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        setDragId(id);
      }
    : null;

  const gridDragOver: CardDragHandler | null = onReorder
    ? (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const id = (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id");
        if (id && id !== dragId) setDragOverId(id);
      }
    : null;

  const gridDragEnd: (() => void) | null = onReorder
    ? () => { setDragId(null); setDragOverId(null); }
    : null;

  function makeGridDrop(ids: string[]): CardDragHandler | null {
    if (!onReorder) return null;
    return (e) => {
      e.preventDefault();
      const toId = (e.target as HTMLElement).closest("[data-item-id]")?.getAttribute("data-item-id");
      const fromId = dragId || e.dataTransfer.getData("text/plain");
      if (fromId && toId && fromId !== toId) {
        onReorder(reorderByDrag(ids, fromId, toId));
      }
      setDragId(null);
      setDragOverId(null);
    };
  }

  const chipClass = getThemeChipClass(model.themePack);

  // Precompute drop handlers to keep arrow functions out of JSX attribute expressions
  const gridDropMain = makeGridDrop(model.galleryItems.map((gi) => gi.id)) ?? undefined;
  const backgroundImageUrl = model.background.url;
  const coverImageUrl = typeof model.gallery?.coverImage === "string" ? model.gallery.coverImage.trim() : "";
  const shelfSlotLayout = getShelfSlotLayout(model);
  const sectionViews = getGallerySections(model.gallery)
    .map((section) => ({
      section,
      items: section.itemIds
        .map((itemId) => model.galleryItems.find((item) => item.id === itemId))
        .filter(Boolean) as VaultItem[],
    }))
    .filter((entry) => entry.items.length > 0);

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
                  Back to Exhibit
                </Link>
              ) : null}

              {model.navigation.homeHref ? (
                <Link
                  href={model.navigation.homeHref}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                >
                  Exhibitions
                </Link>
              ) : null}
            </div>
          ) : null}

          {!embedded ? <section
            className={[
              "relative mx-auto overflow-hidden rounded-[30px] border border-white/12 bg-black/40 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.30)] backdrop-blur-sm sm:p-6",
              GALLERY_STAGE_WIDTH_CLASS,
            ].join(" ")}
          >
            {coverImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt={model.galleryTitle}
                  className="absolute inset-0 h-full w-full object-contain p-5 opacity-28 sm:p-8"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/35" />
              </>
            ) : null}

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
                    {sectionViews.length ? (
                      <DetailPill className={chipClass}>{sectionViews.length} sections</DetailPill>
                    ) : null}
                    <DetailPill className={chipClass}>Background {model.background.type}</DetailPill>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <FavoriteButton
                    contentType="gallery"
                    contentId={String(model.gallery?.id || model.galleryTitle)}
                    metadata={{ title: model.galleryTitle, itemCount: model.galleryItems.length }}
                    label="Favorite exhibit"
                    showMessage={false}
                  />
                  <div className="rounded-full bg-black/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/10">
                    EMV {formatMoney(model.totalValue)}
                  </div>
                </div>
              </div>
            </div>
          </section> : null}

          {model.displayMode === "shelf" ? (
            <div className={embedded ? "" : "mt-3"}>
              <GalleryShelfScene
                items={model.galleryItems}
                themePack={model.themePack}
                backgroundImageUrl={backgroundImageUrl}
                shelvesEnabled={model.shelvesEnabled}
                shelfOverlayStyle={model.shelfOverlayStyle}
                slotLayout={shelfSlotLayout}
                embeddedPreview={embedded}
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
                {embedded ? (
                  /* Compact 4-col grid in preview — event delegation for drag */
                  <div
                    className="grid grid-cols-4 gap-2"
                    onDragStart={gridDragStart ?? undefined}
                    onDragOver={gridDragOver ?? undefined}
                    onDrop={gridDropMain}
                    onDragEnd={gridDragEnd ?? undefined}
                  >
                    {model.galleryItems.map((item) => (
                      <ViewerItemCard
                        key={item.id}
                        item={item}
                        label=""
                        compact
                        onRemove={onRemoveItem ? () => onRemoveItem(item.id) : undefined}
                        isDragOver={embedded && dragOverId === item.id && dragId !== item.id}
                        isDraggable={!!onReorder}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {model.galleryItems.map((item, index) => (
                      <ViewerItemCard
                        key={item.id}
                        item={item}
                        label={`GRID ITEM #${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {!embedded && sectionViews.length ? (
            <section className={["mt-3 mx-auto rounded-[30px] border border-white/12 bg-black/18 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm", GALLERY_STAGE_WIDTH_CLASS].join(" ")}>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                CURATED SECTIONS
              </div>
              <div className="mt-4 grid gap-4">
                {sectionViews.map(({ section, items: sectionItems }, sectionIndex) => {
                  const sectionDrop = embedded
                    ? makeGridDrop(sectionItems.map((si) => si.id)) ?? undefined
                    : undefined;
                  return (
                    <div
                      key={section.id}
                      className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,24,30,0.78),rgba(10,12,16,0.64))] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
                            SECTION #{sectionIndex + 1}
                          </div>
                          <h2 className="mt-1 text-xl font-semibold">{section.title}</h2>
                          {section.description ? (
                            <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">
                              {section.description}
                            </p>
                          ) : null}
                        </div>
                        <DetailPill className={chipClass}>{sectionItems.length} items</DetailPill>
                      </div>

                      <div
                        className={embedded ? "mt-4 grid grid-cols-4 gap-2" : "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}
                        onDragStart={embedded ? (gridDragStart ?? undefined) : undefined}
                        onDragOver={embedded ? (gridDragOver ?? undefined) : undefined}
                        onDrop={sectionDrop}
                        onDragEnd={embedded ? (gridDragEnd ?? undefined) : undefined}
                      >
                        {sectionItems.map((item, itemIndex) => (
                          <ViewerItemCard
                            key={`${section.id}_${item.id}`}
                            item={item}
                            label={section.featuredItemId === item.id ? "FEATURED" : `SECTION ITEM #${itemIndex + 1}`}
                            compact={embedded}
                            onRemove={embedded && onRemoveItem ? () => onRemoveItem(item.id) : undefined}
                            isDragOver={embedded && dragOverId === item.id && dragId !== item.id}
                            isDraggable={embedded && !!onReorder}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {model.galleryItems.length === 0 ? (
            <section className={["mt-6 mx-auto", GALLERY_STAGE_WIDTH_CLASS].join(" ")}>
              <div className="rounded-[28px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)]">
                <div className="text-sm text-[color:var(--muted)]">
                  This exhibit does not currently contain any visible items.
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
