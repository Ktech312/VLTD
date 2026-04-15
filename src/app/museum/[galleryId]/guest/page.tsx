"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  getGalleryById,
  recordGalleryView,
  type Gallery,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryThemePack,
  getGalleryLayoutType,
  getGalleryResolvedThemeBackground,
} from "@/lib/galleryModel";
import { PillButton } from "@/components/ui/PillButton";
import GalleryShelfScene from "@/components/gallery/GalleryShelfScene";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

function itemSubtitle(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
}

function itemImage(i: VaultItem) {
  const directUrl = i.imageFrontUrl || i.imageBackUrl || "";
  if (directUrl) return directUrl;

  const firstImage = Array.isArray(i.images)
    ? i.images.find((image) => image?.url || image?.storageKey)
    : null;
  const storagePath =
    i.imageFrontStoragePath || i.primaryImageKey || firstImage?.storageKey || "";

  return storagePath ? getVaultImagePublicUrl(storagePath) : "";
}

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getThemeChipClass(themePack: string) {
  switch (themePack) {
    case "walnut":
      return "bg-[rgba(64,38,23,0.78)] text-[#f1dcc3] ring-[#c4966d]/35";
    case "midnight":
      return "bg-[rgba(9,19,33,0.80)] text-cyan-100 ring-cyan-300/22";
    case "marble":
      return "bg-[rgba(255,255,255,0.82)] text-slate-900 ring-slate-300/55";
    default:
      return "bg-[rgba(30,24,18,0.78)] text-amber-100 ring-amber-100/14";
  }
}

function getStageOverlayClass(themePack: string) {
  switch (themePack) {
    case "walnut":
      return "bg-[linear-gradient(180deg,rgba(20,12,8,0.18),rgba(20,12,8,0.36))]";
    case "midnight":
      return "bg-[linear-gradient(180deg,rgba(6,12,20,0.24),rgba(6,12,20,0.46))]";
    case "marble":
      return "bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(40,42,46,0.16))]";
    default:
      return "bg-[linear-gradient(180deg,rgba(14,11,8,0.18),rgba(14,11,8,0.34))]";
  }
}

function getCardClass(themePack: string) {
  switch (themePack) {
    case "walnut":
      return "border-[#b98b62]/22 bg-[linear-gradient(180deg,rgba(47,28,18,0.62),rgba(28,17,11,0.74))] text-stone-100";
    case "midnight":
      return "border-cyan-200/12 bg-[linear-gradient(180deg,rgba(10,16,28,0.68),rgba(5,9,17,0.80))] text-slate-100";
    case "marble":
      return "border-slate-300/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(236,240,245,0.76))] text-slate-900";
    default:
      return "border-white/10 bg-[linear-gradient(180deg,rgba(28,21,15,0.66),rgba(16,12,9,0.78))] text-stone-100";
  }
}

function stageStyle(backgroundUrl?: string): React.CSSProperties | undefined {
  if (!backgroundUrl) return undefined;

  return {
    backgroundImage: `url(${backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center top",
    backgroundRepeat: "no-repeat",
  };
}

function DetailPill({
  children,
  className = "",
}: {
  children: React.ReactNode;
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

function GuestGridCard({
  item,
  index,
  themePack,
}: {
  item: VaultItem;
  index: number;
  themePack: string;
}) {
  const imageUrl = itemImage(item);
  const cardClass = getCardClass(themePack);
  const mutedClass = themePack === "marble" ? "text-slate-700" : "text-white/68";

  return (
    <article
      className={[
        "rounded-[18px] border p-3 shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm",
        cardClass,
      ].join(" ")}
    >
      <div className="mb-2 text-[10px] tracking-[0.16em] text-white/50">
        GRID ITEM #{index + 1}
      </div>

      <div className="mb-3 aspect-[4/5] overflow-hidden rounded-[12px] bg-black/12">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-contain bg-black/8 p-2"
            draggable={false}
          />
        ) : (
          <div className={["flex h-full items-center justify-center text-sm", mutedClass].join(" ")}>
            No image
          </div>
        )}
      </div>

      <div className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</div>
      <div className={["mt-1 line-clamp-1 text-[11px]", mutedClass].join(" ")}>
        {itemSubtitle(item) || "—"}
      </div>
      <div className={["mt-3 rounded-full px-3 py-1 text-[11px] ring-1", themePack === "marble" ? "bg-black/5 ring-black/8 text-slate-700" : "bg-black/10 ring-black/10 text-white/72"].join(" ")}>
        Estimated market value {formatMoney(item.currentValue)}
      </div>
    </article>
  );
}

export default function GuestGalleryPage() {
  const params = useParams();
  const galleryId = String(params?.galleryId ?? "");

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    if (!galleryId) return;

    const found = getGalleryById(galleryId);
    setGallery(found);
    setItems(loadItems());
    setIsResolved(true);

    if (found) {
      recordGalleryView(found.id);
    }
  }, [galleryId]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const galleryItems = useMemo(() => {
    if (!gallery) return [];
    return gallery.itemIds
      .map((itemId) => itemMap.get(itemId))
      .filter(Boolean) as VaultItem[];
  }, [gallery, itemMap]);

  const themePack = getGalleryThemePack(gallery);
  const displayMode = getGalleryDisplayMode(gallery);
  const guestViewMode = getGalleryGuestViewMode(gallery);
  const layoutType = getGalleryLayoutType(gallery);
  const resolvedThemeBackground = getGalleryResolvedThemeBackground(gallery);
  const chipClass = getThemeChipClass(themePack);
  const stageOverlayClass = getStageOverlayClass(themePack);

  const totalValue = useMemo(() => {
    return galleryItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  }, [galleryItems]);

  if (isResolved && !gallery) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(30,36,46,0.96),rgba(8,10,14,1)_62%)] text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] border border-white/10 bg-black/25 p-8 text-center ring-1 ring-white/10 backdrop-blur-sm">
            <div className="text-[11px] tracking-[0.22em] text-white/55">GUEST PREVIEW</div>
            <h1 className="mt-3 text-2xl font-semibold">Gallery not available</h1>
            <p className="mt-3 text-sm text-white/70">
              This gallery could not be loaded for guest preview.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                Open Museum
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!gallery) {
    return null;
  }

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_top,rgba(30,36,46,0.96),rgba(8,10,14,1)_62%)] text-[color:var(--fg)]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,24,30,0.88),rgba(10,12,16,0.26)_24%,rgba(10,12,16,0.26)_76%,rgba(20,24,30,0.88))]" />
      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <PillButton variant="active" className="text-sm font-semibold">
              Gallery as Guest
            </PillButton>

            <Link
              href={`/museum/${gallery.id}`}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
            >
              Back to Gallery
            </Link>

            <Link
              href="/museum"
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
            >
              Museum Home
            </Link>
          </div>

          <section className="relative overflow-hidden rounded-[30px] border border-white/12 bg-black/22 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.30)] backdrop-blur-sm sm:p-6">
            <div className="absolute inset-0" style={stageStyle(resolvedThemeBackground)} />
            <div className={["absolute inset-0", stageOverlayClass].join(" ")} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,225,170,0.10),rgba(255,225,170,0)_24%)]" />

            <div className="relative">
              <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
                GUEST PREVIEW
              </div>

              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
                    {gallery.title}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                    {gallery.description?.trim()
                      ? gallery.description
                      : "Curated collection presentation"}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <DetailPill className={chipClass}>{galleryItems.length} items</DetailPill>
                    <DetailPill className={chipClass}>{layoutType} layout</DetailPill>
                    <DetailPill className={chipClass}>{displayMode} mode</DetailPill>
                    <DetailPill className={chipClass}>Guest {guestViewMode}</DetailPill>
                  </div>
                </div>

                <div className="rounded-full bg-black/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/10">
                  Estimated market value {formatMoney(totalValue)}
                </div>
              </div>
            </div>
          </section>

          {displayMode === "shelf" ? (
            <section className="mt-8 rounded-[30px] border border-white/12 bg-black/18 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <div className="mb-4">
                <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                  SHELF VIEW
                </div>
                <h2 className="mt-2 text-2xl font-semibold">Guest Preview Shelf</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                  Museum-style shelf presentation with smaller works and simple plaques.
                </p>
              </div>

              <GalleryShelfScene
                items={galleryItems}
                themePack={themePack}
                backgroundImageUrl={resolvedThemeBackground}
                title={gallery.title}
                subtitle={gallery.description || "Curated shelf presentation"}
                guestMode
              />
            </section>
          ) : null}

          {displayMode === "grid" ? (
            <section className="mt-8 rounded-[30px] border border-white/12 bg-black/18 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <div className="mb-4">
                <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                  GRID VIEW
                </div>
                <h2 className="mt-2 text-2xl font-semibold">Gallery Grid</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                  Standard guest browsing layout with smaller museum cards and full-image fit.
                </p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10" style={stageStyle(resolvedThemeBackground)}>
                <div className={["p-4 sm:p-5", stageOverlayClass].join(" ")}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {galleryItems.map((item, index) => (
                      <GuestGridCard
                        key={item.id}
                        item={item}
                        index={index}
                        themePack={themePack}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {galleryItems.length === 0 ? (
            <section className="mt-10">
              <div className="rounded-[28px] border border-white/12 bg-black/18 p-8 ring-1 ring-white/10 backdrop-blur-sm">
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
