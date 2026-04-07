"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  getGalleryByPublicToken,
  recordGalleryView,
  type Gallery,
  getGallerySections,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryThemePack,
  getGalleryLayoutType,
} from "@/lib/galleryModel";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

function itemSubtitle(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
}

function itemImage(i: VaultItem) {
  const directUrl = i.imageFrontUrl || i.imageBackUrl || "";
  if (directUrl) return directUrl;

  const firstImage = Array.isArray(i.images) ? i.images.find((image) => image?.url || image?.storageKey) : null;
  const storagePath =
    i.imageFrontStoragePath ||
    i.primaryImageKey ||
    firstImage?.storageKey ||
    "";

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

function fullItemCost(item: VaultItem) {
  const total =
    Number(item.purchasePrice ?? 0) +
    Number((item as any).purchaseTax ?? 0) +
    Number((item as any).purchaseShipping ?? 0) +
    Number((item as any).purchaseFees ?? 0);

  return Number.isFinite(total) ? total : 0;
}

function getThemeTone(themePack: string) {
  switch (themePack) {
    case "walnut":
      return {
        heroShell:
          "bg-[linear-gradient(135deg,rgba(86,58,34,0.40),rgba(34,22,13,0.28))] border-[#7b5a3f]/40",
        chip:
          "bg-[rgba(58,36,22,0.45)] text-[color:var(--muted2)] ring-white/10",
        shelf:
          "linear-gradient(180deg, rgba(108,74,47,0.92), rgba(70,44,24,0.96))",
        shelfEdge:
          "linear-gradient(180deg, rgba(173,130,88,0.55), rgba(70,44,24,0))",
      };
    case "midnight":
      return {
        heroShell:
          "bg-[linear-gradient(135deg,rgba(20,26,38,0.55),rgba(7,10,18,0.42))] border-cyan-300/10",
        chip:
          "bg-[rgba(18,24,36,0.65)] text-[color:var(--muted2)] ring-cyan-300/10",
        shelf:
          "linear-gradient(180deg, rgba(35,44,62,0.95), rgba(16,22,34,0.98))",
        shelfEdge:
          "linear-gradient(180deg, rgba(116,146,202,0.35), rgba(16,22,34,0))",
      };
    case "marble":
      return {
        heroShell:
          "bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(210,214,223,0.07))] border-white/15",
        chip:
          "bg-[rgba(255,255,255,0.10)] text-[color:var(--muted2)] ring-white/10",
        shelf:
          "linear-gradient(180deg, rgba(205,210,219,0.90), rgba(157,164,178,0.96))",
        shelfEdge:
          "linear-gradient(180deg, rgba(255,255,255,0.50), rgba(157,164,178,0))",
      };
    default:
      return {
        heroShell:
          "bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] border-white/8",
        chip:
          "bg-black/20 text-[color:var(--muted2)] ring-white/10",
        shelf:
          "linear-gradient(180deg, rgba(80,60,44,0.96), rgba(56,39,28,0.98))",
        shelfEdge:
          "linear-gradient(180deg, rgba(184,146,102,0.35), rgba(56,39,28,0))",
      };
  }
}

function shelfSurface(gallery: Gallery | null) {
  const custom = gallery?.shelfBackground?.trim();
  if (custom) return custom;
  return getThemeTone(getGalleryThemePack(gallery)).shelf;
}

function shelfEdgeSurface(gallery: Gallery | null) {
  return getThemeTone(getGalleryThemePack(gallery)).shelfEdge;
}

function OverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-[20px] bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-[color:var(--muted)]">{hint}</div>
    </div>
  );
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

function SharedShelfGalleryStrip({
  items,
  gallery,
}: {
  items: VaultItem[];
  gallery: Gallery | null;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4">
        <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
          SHELF VIEW
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Public Gallery Shelf</h2>
      </div>

      <div className="relative overflow-hidden rounded-[28px] ring-1 ring-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.30)]">
        <div className="absolute inset-0 opacity-35">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: gallery?.shelfBackground
                ? `url(${gallery.shelfBackground})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,220,150,0.10),rgba(255,220,150,0)_26%)]" />

        <div className="relative p-5 sm:p-6">
          <div className="flex gap-5 overflow-x-auto pb-4">
            {items.map((item) => {
              const image = itemImage(item);

              return (
                <div
                  key={item.id}
                  className="group relative block min-w-[190px] max-w-[190px] shrink-0"
                >
                  <div className="relative mx-auto h-[240px] w-full">
                    <div className="absolute inset-x-[12%] bottom-[18px] h-[18px] rounded-full bg-black/40 blur-xl" />

                    <div className="relative flex h-full items-end justify-center">
                      <div className="relative rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_20px_44px_rgba(0,0,0,0.38)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_28px_56px_rgba(0,0,0,0.42)]">
                        <div className="absolute inset-0 rounded-[20px] bg-[linear-gradient(135deg,rgba(255,255,255,0.14),transparent_42%)] opacity-70" />
                        <div className="relative overflow-hidden rounded-[14px] bg-black/25">
                          {image ? (
                            <img
                              src={image}
                              alt={item.title}
                              className="h-[180px] w-[140px] object-cover transition duration-300 group-hover:scale-[1.03]"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-[180px] w-[140px] items-center justify-center text-sm text-[color:var(--muted)]">
                              No image
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <div className="line-clamp-2 text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {itemSubtitle(item) || "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-black/15 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                        {formatMoney(Number(item.currentValue ?? 0))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none mt-1">
            <div
              className="relative h-[20px] rounded-[16px]"
              style={{ background: shelfSurface(gallery) }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[8px] rounded-t-[16px]"
                style={{ background: shelfEdgeSurface(gallery) }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SharedGalleryPage() {
  const params = useParams();
  const token = params?.token as string | undefined;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);
  const [showGuestContent, setShowGuestContent] = useState(false);

  useEffect(() => {
    if (!token) return;

    let isCancelled = false;

    async function resolvePublicGallery() {
      const found = await getGalleryByPublicToken(token);

      if (isCancelled) return;

      setGallery(found);
      setItems(loadItems());
      setIsResolved(true);

      if (found) {
        recordGalleryView(found.id);
        setShowGuestContent(getGalleryGuestViewMode(found) === "public");
      }
    }

    void resolvePublicGallery();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const galleryItems = useMemo(() => {
    if (!gallery) return [];
    return gallery.itemIds
      .map((itemId) => itemMap.get(itemId))
      .filter(Boolean) as VaultItem[];
  }, [gallery, itemMap]);

  const sections = useMemo(() => getGallerySections(gallery), [gallery]);

  const exhibitionSections = useMemo(() => {
    if (!gallery) return [];

    return sections.map((section) => {
      const sectionItems = section.itemIds
        .map((itemId) => itemMap.get(itemId))
        .filter(Boolean) as VaultItem[];

      const featuredItem =
        section.featuredItemId && itemMap.has(section.featuredItemId)
          ? (itemMap.get(section.featuredItemId) as VaultItem)
          : null;

      return {
        ...section,
        items: sectionItems,
        featuredItem,
      };
    });
  }, [gallery, itemMap, sections]);

  const unsectionedItems = useMemo(() => {
    if (!gallery) return [];

    const assigned = new Set<string>();
    for (const section of sections) {
      for (const itemId of section.itemIds) {
        assigned.add(itemId);
      }
    }

    return galleryItems.filter((item) => !assigned.has(item.id));
  }, [gallery, galleryItems, sections]);

  const totalValue = useMemo(() => {
    return galleryItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  }, [galleryItems]);

  const totalCost = useMemo(() => {
    return galleryItems.reduce((sum, item) => sum + fullItemCost(item), 0);
  }, [galleryItems]);

  const totalGain = useMemo(() => totalValue - totalCost, [totalValue, totalCost]);

  const roi = useMemo(() => {
    return totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  }, [totalCost, totalGain]);

  const themePack = getGalleryThemePack(gallery);
  const themeTone = getThemeTone(themePack);
  const displayMode = getGalleryDisplayMode(gallery);
  const guestViewMode = getGalleryGuestViewMode(gallery);
  const layoutType = getGalleryLayoutType(gallery);

  if (isResolved && !gallery) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              SHARED GALLERY
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Link not available</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This shared gallery link is invalid or no longer available.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
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

  if (!showGuestContent) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              PUBLIC GALLERY
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{gallery.title}</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This gallery is public, but the owner prefers registered viewers by default.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-6 py-3 text-base font-semibold text-[color:var(--fg)]"
              >
                Create Free Account
              </Link>

              <button
                type="button"
                onClick={() => setShowGuestContent(true)}
                className="text-sm text-[color:var(--muted)] underline underline-offset-4"
              >
                View As Guest
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)]">
            Public Gallery View
          </span>

          <Link
            href="/museum"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
          >
            Museum Home
          </Link>
        </div>

        <section
          className={[
            "relative overflow-hidden rounded-[34px] border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-8 lg:p-10",
            themeTone.heroShell,
          ].join(" ")}
        >
          {gallery.coverImage ? (
            <>
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage: `url(${gallery.coverImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-black/55" />
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,225,170,0.10),rgba(255,225,170,0)_24%)]" />

          <div className="relative">
            <div className="max-w-4xl">
              <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
                SHARED GALLERY
              </div>

              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
                {gallery.title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                {gallery.description?.trim()
                  ? gallery.description
                  : "Curated collection presentation"}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <DetailPill className={themeTone.chip}>
                  {galleryItems.length} items
                </DetailPill>
                <DetailPill className={themeTone.chip}>
                  {gallery.analytics?.views ?? 0} views
                </DetailPill>
                <DetailPill className={themeTone.chip}>
                  {layoutType} layout
                </DetailPill>
                <DetailPill className={themeTone.chip}>
                  Theme {themePack}
                </DetailPill>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DetailPill className={themeTone.chip}>
                  {displayMode} mode
                </DetailPill>
                <DetailPill className={themeTone.chip}>
                  Guest {guestViewMode}
                </DetailPill>
                <DetailPill className={themeTone.chip}>
                  {sections.length} sections
                </DetailPill>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewStat
                label="GALLERY VALUE"
                value={formatMoney(totalValue)}
                hint="Current exhibit value"
              />
              <OverviewStat
                label="TOTAL COST"
                value={formatMoney(totalCost)}
                hint="Full acquisition basis"
              />
              <OverviewStat
                label="NET GAIN"
                value={
                  <>
                    {totalGain >= 0 ? "+" : ""}
                    {formatMoney(totalGain)}
                  </>
                }
                hint="Value minus cost"
              />
              <OverviewStat
                label="ROI"
                value={
                  <>
                    {roi >= 0 ? "+" : ""}
                    {roi.toFixed(1)}%
                  </>
                }
                hint="Based on purchase totals"
              />
            </div>
          </div>
        </section>

        {displayMode === "shelf" ? (
          <SharedShelfGalleryStrip items={galleryItems} gallery={gallery} />
        ) : null}

        {exhibitionSections.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                CURATION
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Curated Sections</h2>
            </div>

            <div className="grid gap-6">
              {exhibitionSections.map((section, sectionIndex) => (
                <section
                  key={section.id}
                  className="rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        SECTION #{sectionIndex + 1}
                      </div>
                      <h3 className="mt-2 text-2xl font-semibold">{section.title}</h3>
                      {section.description?.trim() ? (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                          {section.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                      <div className="rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                        <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                          ITEMS
                        </div>
                        <div className="mt-2 text-xl font-semibold">{section.items.length}</div>
                      </div>

                      <div className="rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                        <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                          FEATURED
                        </div>
                        <div className="mt-2 text-xl font-semibold">
                          {section.featuredItem ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {section.featuredItem ? (
                    <div className="mt-6 rounded-[26px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
                      <div className="mb-3 text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        FEATURED WORK
                      </div>

                      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-black/20">
                          {itemImage(section.featuredItem) ? (
                            <img
                              src={itemImage(section.featuredItem)}
                              alt={section.featuredItem.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-2xl font-semibold">{section.featuredItem.title}</div>
                          <div className="mt-2 text-sm text-[color:var(--muted)]">
                            {itemSubtitle(section.featuredItem) || "—"}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                              Value {formatMoney(Number(section.featuredItem.currentValue ?? 0))}
                            </span>
                            <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                              Cost {formatMoney(fullItemCost(section.featuredItem))}
                            </span>
                          </div>

                          {gallery.itemNotes?.find((n) => n.itemId === section.featuredItem?.id)
                            ?.note ? (
                            <div className="mt-5 rounded-2xl bg-black/10 p-4 ring-1 ring-black/10">
                              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                                CURATOR NOTE
                              </div>
                              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                                {
                                  gallery.itemNotes?.find(
                                    (n) => n.itemId === section.featuredItem?.id
                                  )?.note
                                }
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {section.items.length > 0 ? (
                    <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {section.items.map((item, index) => {
                        const note =
                          gallery.itemNotes?.find((entry) => entry.itemId === item.id)?.note ?? "";

                        return (
                          <article
                            key={`${section.id}_${item.id}`}
                            className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                          >
                            <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
                              SECTION EXHIBIT #{index + 1}
                            </div>

                            <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                              {itemImage(item) ? (
                                <img
                                  src={itemImage(item)}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                                  No image
                                </div>
                              )}
                            </div>

                            <div className="text-lg font-semibold">{item.title}</div>

                            <div className="mt-1 text-sm text-[color:var(--muted)]">
                              {itemSubtitle(item) || "—"}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                                Value {formatMoney(item.currentValue)}
                              </span>
                              <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                                Cost {formatMoney(fullItemCost(item))}
                              </span>
                            </div>

                            {note.trim() ? (
                              <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                                  CURATOR NOTE
                                </div>
                                <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                                  {note}
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[24px] bg-[color:var(--input)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      This section does not currently contain any visible items.
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {unsectionedItems.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                MAIN GALLERY FLOW
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Unsectioned Exhibits</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {unsectionedItems.map((item, index) => {
                const note =
                  gallery.itemNotes?.find((entry) => entry.itemId === item.id)?.note ?? "";

                return (
                  <article
                    key={item.id}
                    className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                  >
                    <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
                      EXHIBIT #{index + 1}
                    </div>

                    <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                      {itemImage(item) ? (
                        <img
                          src={itemImage(item)}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="text-lg font-semibold">{item.title}</div>

                    <div className="mt-1 text-sm text-[color:var(--muted)]">
                      {itemSubtitle(item) || "—"}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                        Value {formatMoney(item.currentValue)}
                      </span>
                      <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                        Cost {formatMoney(fullItemCost(item))}
                      </span>
                    </div>

                    {note.trim() ? (
                      <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                        <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                          CURATOR NOTE
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {note}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {galleryItems.length === 0 ? (
          <section className="mt-10">
            <div className="rounded-[28px] bg-[color:var(--surface)] p-8 ring-1 ring-[color:var(--border)]">
              <div className="text-sm text-[color:var(--muted)]">
                This gallery does not currently contain any visible items.
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
