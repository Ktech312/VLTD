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
  getGalleryThemeBackground,
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

function getThemeTone(themePack: string) {
  const normalized = (themePack || "classic").toLowerCase();

  switch (normalized) {
    case "walnut":
      return {
        heroShell:
          "border-[#9d744f]/45 bg-[linear-gradient(135deg,rgba(44,26,16,0.56),rgba(20,12,8,0.44))] text-stone-100 shadow-[0_34px_110px_rgba(0,0,0,0.50)]",
        chip: "bg-[rgba(64,38,23,0.78)] text-[#f1dcc3] ring-[#c4966d]/35",
        sectionPanelClass:
          "border border-[#8d6544]/35 bg-[linear-gradient(180deg,rgba(30,18,11,0.54),rgba(18,11,7,0.38))] text-stone-100 shadow-[0_24px_72px_rgba(0,0,0,0.34)] backdrop-blur-[1px]",
        cardClass:
          "border border-[#b98b62]/20 bg-[linear-gradient(180deg,rgba(44,28,18,0.76),rgba(24,15,10,0.82))] text-stone-100 shadow-[0_20px_48px_rgba(0,0,0,0.32)]",
        accentClass: "text-[#f1dcc3]",
      };
    case "midnight":
      return {
        heroShell:
          "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,15,26,0.54),rgba(4,8,15,0.40))] text-slate-100 shadow-[0_34px_110px_rgba(0,0,0,0.58)]",
        chip: "bg-[rgba(9,19,33,0.80)] text-cyan-100 ring-cyan-300/22",
        sectionPanelClass:
          "border border-cyan-200/14 bg-[linear-gradient(180deg,rgba(8,13,22,0.56),rgba(4,8,15,0.40))] text-slate-100 shadow-[0_24px_72px_rgba(0,0,0,0.38)] backdrop-blur-[1px]",
        cardClass:
          "border border-cyan-200/12 bg-[linear-gradient(180deg,rgba(10,16,28,0.80),rgba(5,9,17,0.84))] text-slate-100 shadow-[0_22px_52px_rgba(0,0,0,0.38)]",
        accentClass: "text-cyan-100",
      };
    case "marble":
      return {
        heroShell:
          "border-white/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(225,230,238,0.22))] text-slate-950 shadow-[0_28px_72px_rgba(35,41,52,0.18)]",
        chip: "bg-[rgba(255,255,255,0.76)] text-slate-900 ring-slate-300/55",
        sectionPanelClass:
          "border border-slate-300/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(232,236,242,0.26))] text-slate-900 shadow-[0_22px_52px_rgba(57,67,84,0.14)] backdrop-blur-[1px]",
        cardClass:
          "border border-slate-300/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(236,240,245,0.70))] text-slate-900 shadow-[0_20px_44px_rgba(57,67,84,0.16)]",
        accentClass: "text-slate-950",
      };
    case "classic":
    default:
      return {
        heroShell:
          "border-amber-100/12 bg-[linear-gradient(135deg,rgba(22,18,14,0.50),rgba(13,11,8,0.36))] text-stone-100 shadow-[0_30px_84px_rgba(0,0,0,0.46)]",
        chip: "bg-[rgba(30,24,18,0.78)] text-amber-100 ring-amber-100/14",
        sectionPanelClass:
          "border border-amber-100/12 bg-[linear-gradient(180deg,rgba(20,17,13,0.54),rgba(13,11,8,0.38))] text-stone-100 shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-[1px]",
        cardClass:
          "border border-white/10 bg-[linear-gradient(180deg,rgba(28,21,15,0.78),rgba(16,12,9,0.82))] text-stone-100 shadow-[0_20px_48px_rgba(0,0,0,0.32)]",
        accentClass: "text-amber-100",
      };
  }
}

function shelfSurface(gallery: Gallery | null) {
  const custom = gallery?.shelfBackground?.trim();
  if (custom) return `url(${custom})`;
  return getGalleryThemePresentation(getGalleryThemePack(gallery)).shelfRail;
}

function shelfEdgeSurface(gallery: Gallery | null) {
  return getGalleryThemePresentation(getGalleryThemePack(gallery)).shelfEdge;
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

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-sm text-[color:var(--muted)]">{hint}</div> : null}
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

function GuestShelfGalleryStrip({
  items,
  gallery,
}: {
  items: VaultItem[];
  gallery: Gallery | null;
}) {
  if (items.length === 0) return null;

  const themePack = getGalleryThemePack(gallery);
  const backgroundImageUrl = gallery?.shelfBackground?.trim() || getGalleryThemeBackground(themePack);

  return (
    <section className="mt-10">
      <SectionHeader
        eyebrow="SHELF VIEW"
        title="Guest Preview Shelf"
        subtitle="A staged exhibition scene for guests exploring the collection."
      />

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

function ViewerItemCard({
  item,
  label,
  note,
  cardClass,
  mutedClass = "text-white/70",
}: {
  item: VaultItem;
  label: string;
  note?: string;
  cardClass: string;
  mutedClass?: string;
}) {
  return (
    <article className={["rounded-[26px] p-5", cardClass].join(" ")}>
      <div className="mb-2 text-xs tracking-[0.16em] text-white/55">
        {label}
      </div>

      <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
        {itemImage(item) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={itemImage(item)}
            alt={item.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className={["flex h-full items-center justify-center text-sm", mutedClass].join(" ")}>
            No image
          </div>
        )}
      </div>

      <div className="text-lg font-semibold">{item.title}</div>

      <div className={["mt-1 text-sm", mutedClass].join(" ")}>
        {itemSubtitle(item) || "—"}
      </div>


      {note?.trim() ? (
        <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
          <div className="text-[11px] tracking-[0.14em] text-white/55">
            CURATOR NOTE
          </div>
          <div className={["mt-2 text-sm leading-6", mutedClass].join(" ")}>
            {note}
          </div>
        </div>
      ) : null}
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

  const themePack = getGalleryThemePack(gallery);
  const themeTone = getThemeTone(themePack);
  const themePresentation = getGalleryThemePresentation(themePack);
  const themeBackground = getGalleryThemeBackground(themePack);
  const displayMode = getGalleryDisplayMode(gallery);
  const guestViewMode = getGalleryGuestViewMode(gallery);
  const layoutType = getGalleryLayoutType(gallery);

  if (isResolved && !gallery) {
    return (
      <main
        className="relative min-h-screen text-white"
        style={{
          backgroundImage: `url(${themeBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,18,0.18),rgba(7,10,18,0.46))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_50%_14%,rgba(255,225,170,0.12),transparent_24%)]" />
        <div className="fixed right-4 top-4 z-50 rounded bg-black/70 px-3 py-1 text-xs text-white">
          THEME: {themePack}
        </div>
        <div className="relative">
          <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
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
        </div>
      </main>
    );
  }

  if (!gallery) {
    return null;
  }

  return (
    <main
      className="relative min-h-screen text-[color:var(--fg)]"
      style={{
        backgroundImage: `url(${themeBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,18,0.14),rgba(7,10,18,0.40))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_50%_14%,rgba(255,225,170,0.12),transparent_24%)]" />
      <div className="fixed right-4 top-4 z-50 rounded bg-black/70 px-3 py-1 text-xs text-white">
        THEME: {themePack} • MODE: {displayMode}
      </div>
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
            <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
              GUEST PREVIEW
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
              <DetailPill className={themeTone.chip}>
                {displayMode} mode
              </DetailPill>
              <DetailPill className={themeTone.chip}>
                Guest {guestViewMode}
              </DetailPill>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className={["rounded-2xl p-4", themeTone.sectionPanelClass].join(" ")}>
                <div className="text-[11px] tracking-[0.14em] text-white/55">EXHIBITS</div>
                <div className="mt-2 text-xl font-semibold">{galleryItems.length}</div>
                <div className="mt-1 text-sm text-white/70">Visible pieces in this guest view</div>
              </div>
              <div className={["rounded-2xl p-4", themeTone.sectionPanelClass].join(" ")}>
                <div className="text-[11px] tracking-[0.14em] text-white/55">SECTIONS</div>
                <div className="mt-2 text-xl font-semibold">{sections.length}</div>
                <div className="mt-1 text-sm text-white/70">Structured curatorial groupings</div>
              </div>
              <div className={["rounded-2xl p-4", themeTone.sectionPanelClass].join(" ")}>
                <div className="text-[11px] tracking-[0.14em] text-white/55">DISPLAY MODE</div>
                <div className="mt-2 text-xl font-semibold">{displayMode}</div>
                <div className="mt-1 text-sm text-white/70">How the gallery is presented to guests</div>
              </div>
            </div>
          </div>
        </section>

        {displayMode === "shelf" ? (
          <GuestShelfGalleryStrip items={galleryItems} gallery={gallery} />
        ) : null}

        {exhibitionSections.length > 0 ? (
          <section className="mt-10">
            <SectionHeader
              eyebrow="EXHIBITION STRUCTURE"
              title="Curated Sections"
              subtitle="The gallery is organized into themed sections to guide the viewing experience."
            />

            <div className="grid gap-6">
              {exhibitionSections.map((section, sectionIndex) => (
                <section
                  key={section.id}
                  className={["rounded-[30px] p-6 shadow-[var(--shadow-soft)]", themeTone.sectionPanelClass].join(" ")}
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
                      <InfoCard label="ITEMS" value={section.items.length} />
                      <InfoCard label="FEATURED" value={section.featuredItem ? "Yes" : "No"} />
                    </div>
                  </div>

                  {section.featuredItem ? (
                    <div className={["mt-6 rounded-[26px] p-5", themeTone.cardClass].join(" ")}>
                      <div className="mb-3 text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        FEATURED WORK
                      </div>

                      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-black/20">
                          {itemImage(section.featuredItem) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage(section.featuredItem)}
                              alt={section.featuredItem.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className={["flex h-full items-center justify-center text-sm", mutedClass].join(" ")}>
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
                          </div>

                          {gallery.itemNotes?.find((n) => n.itemId === section.featuredItem?.id)
                            ?.note ? (
                            <div className="mt-5 rounded-2xl bg-black/10 p-4 ring-1 ring-black/10">
                              <div className="text-[11px] tracking-[0.14em] text-white/55">
                                CURATOR NOTE
                              </div>
                              <div className={["mt-2 text-sm leading-6", mutedClass].join(" ")}>
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
                          <ViewerItemCard
                            key={`${section.id}_${item.id}`}
                            item={item}
                            label={`SECTION EXHIBIT #${index + 1}`}
                            note={note}
                            cardClass={themeTone.cardClass}
                            mutedClass={themePack === "marble" ? "text-slate-700" : "text-white/70"}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className={["mt-6 rounded-[24px] p-5 text-sm", themeTone.cardClass].join(" ")}>
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
            <SectionHeader
              eyebrow="MAIN GALLERY FLOW"
              title="Unsectioned Exhibits"
              subtitle="These works are visible in the gallery but are not part of a named section."
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                    mutedClass={themePack === "marble" ? "text-slate-700" : "text-white/70"}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {galleryItems.length === 0 ? (
          <section className="mt-10">
            <div className={["rounded-[28px] p-8", themeTone.sectionPanelClass].join(" ")}>
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