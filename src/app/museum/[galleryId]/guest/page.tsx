"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  getGalleryById,
  recordGalleryView,
  type Gallery,
  getGallerySections,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryThemePack,
  getGalleryLayoutType,
  getGalleryResolvedThemeBackground,
  getGalleryThemePresentation,
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

function getThemeTone(themePack: string) {
  const presentation = getGalleryThemePresentation(themePack);

  return {
    heroShell: presentation.heroPanelClass,
    chip: presentation.chipClass,
    sectionPanelClass: presentation.sectionPanelClass,
    cardClass: presentation.cardClass,
  };
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
          {subtitle}
        </p>
      ) : null}
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

function ViewerItemCard({
  item,
  label,
  note,
  cardClass,
}: {
  item: VaultItem;
  label: string;
  note?: string;
  cardClass: string;
}) {
  return (
    <article className={["rounded-[22px] p-4", cardClass].join(" ")}>
      <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>

      <div className="mb-3 aspect-[4/5] overflow-hidden rounded-xl bg-black/20">
        {itemImage(item) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={itemImage(item)}
            alt={item.title}
            className="h-full w-full object-contain bg-black/10"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
            No image
          </div>
        )}
      </div>

      <div className="text-base font-semibold">{item.title}</div>

      <div className="mt-1 text-sm text-[color:var(--muted)]">
        {itemSubtitle(item) || "—"}
      </div>

      <div className="mt-3 rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
        Estimated market value {formatMoney(item.currentValue)}
      </div>

      {note?.trim() ? (
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
}

function GuestShelfGalleryStrip({
  items,
  gallery,
}: {
  items: VaultItem[];
  gallery: Gallery | null;
}) {
  if (items.length === 0) return null;

  const themePack = getGalleryThemePack(gallery);
  const backgroundImageUrl = getGalleryResolvedThemeBackground(gallery, {
    preferCustomShelfBackground: true,
  });

  return (
    <section className="mt-8">
      <GalleryShelfScene
        items={items}
        themePack={themePack}
        backgroundImageUrl={backgroundImageUrl}
        title={gallery?.title || "Collector Shelf"}
        subtitle={gallery?.description || "Curated shelf presentation"}
        guestMode
      />
    </section>
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

  const sections = useMemo(() => getGallerySections(gallery), [gallery]);

  const exhibitionSections = useMemo(() => {
    if (!gallery) return [];

    return sections.map((section) => {
      const sectionItems = section.itemIds
        .map((itemId) => itemMap.get(itemId))
        .filter(Boolean) as VaultItem[];

      return {
        ...section,
        items: sectionItems,
      };
    });
  }, [gallery, itemMap, sections]);

  const unsectionedItems = useMemo(() => {
    if (!gallery) return [];

    const assigned = new Set<string>();
    for (const section of sections) {
      for (const itemId of section.itemIds) assigned.add(itemId);
    }

    return galleryItems.filter((item) => !assigned.has(item.id));
  }, [gallery, galleryItems, sections]);

  const estimatedValue = useMemo(() => {
    return galleryItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  }, [galleryItems]);

  const themePack = getGalleryThemePack(gallery);
  const themeTone = getThemeTone(themePack);
  const themePresentation = getGalleryThemePresentation(themePack);
  const resolvedThemeBackground = getGalleryResolvedThemeBackground(gallery);
  const displayMode = getGalleryDisplayMode(gallery);
  const guestViewMode = getGalleryGuestViewMode(gallery);
  const layoutType = getGalleryLayoutType(gallery);

  if (isResolved && !gallery) {
    return (
      <main
        className="relative min-h-screen text-white"
        style={{
          backgroundImage: `url(${resolvedThemeBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,18,0.22),rgba(7,10,18,0.52))]" />
        <div className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              GUEST PREVIEW
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Gallery not available</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
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

  if (!gallery) return null;

  return (
    <main
      className="relative min-h-screen text-[color:var(--fg)]"
      style={{
        backgroundImage: `url(${resolvedThemeBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,18,0.14),rgba(7,10,18,0.40))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_24%),radial-gradient(circle_at_50%_18%,rgba(255,233,196,0.10),transparent_26%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
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

        <section
          className={[
            "relative overflow-hidden rounded-[28px] border p-5 shadow-[0_24px_60px_rgba(0,0,0,0.30)] sm:p-6",
            themeTone.heroShell,
          ].join(" ")}
        >
          <div className="relative">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              GUEST PREVIEW
            </div>

            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold sm:text-4xl">{gallery.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                  {gallery.description?.trim()
                    ? gallery.description
                    : "Curated collection presentation"}
                </p>
              </div>

              <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm ring-1 ring-white/10">
                Estimated market value {formatMoney(estimatedValue)}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <DetailPill className={themeTone.chip}>{galleryItems.length} items</DetailPill>
              <DetailPill className={themeTone.chip}>{layoutType} layout</DetailPill>
              <DetailPill className={themeTone.chip}>{displayMode} mode</DetailPill>
              <DetailPill className={themeTone.chip}>Guest {guestViewMode}</DetailPill>
            </div>
          </div>
        </section>

        {displayMode === "shelf" ? (
          <GuestShelfGalleryStrip items={galleryItems} gallery={gallery} />
        ) : null}

        {displayMode === "grid" ? (
          <section className="mt-8">
            <SectionHeader
              eyebrow="GRID VIEW"
              title="Gallery Grid"
              subtitle="Standard guest browsing layout with smaller cards and full-image fit."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {galleryItems.map((item, index) => {
                const note =
                  gallery.itemNotes?.find((entry) => entry.itemId === item.id)?.note ?? "";

                return (
                  <ViewerItemCard
                    key={item.id}
                    item={item}
                    label={`GRID ITEM #${index + 1}`}
                    note={note}
                    cardClass={themeTone.cardClass}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {displayMode === "grid" && exhibitionSections.length > 0 ? (
          <section className="mt-10">
            <SectionHeader
              eyebrow="CURATED SECTIONS"
              title="Section Notes"
              subtitle="Supplemental curatorial structure for grid view."
            />

            <div className="grid gap-5">
              {exhibitionSections.map((section, sectionIndex) => (
                <section
                  key={section.id}
                  className={["rounded-[26px] p-5 shadow-[var(--shadow-soft)]", themeTone.sectionPanelClass].join(" ")}
                >
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    SECTION #{sectionIndex + 1}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold">{section.title}</h3>
                  {section.description?.trim() ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                      {section.description}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {displayMode === "grid" && unsectionedItems.length > 0 ? (
          <section className="mt-10">
            <SectionHeader
              eyebrow="MAIN GALLERY FLOW"
              title="Additional Works"
              subtitle="Visible works not assigned to a named section."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {unsectionedItems.map((item, index) => {
                const note =
                  gallery.itemNotes?.find((entry) => entry.itemId === item.id)?.note ?? "";

                return (
                  <ViewerItemCard
                    key={item.id}
                    item={item}
                    label={`EXHIBIT #${index + 1}`}
                    note={note}
                    cardClass={themeTone.cardClass}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {galleryItems.length === 0 ? (
          <section className="mt-8">
            <div className="rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
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
