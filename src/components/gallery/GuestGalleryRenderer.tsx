"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DragEvent } from "react";

import FavoriteButton from "@/components/FavoriteButton";
import GalleryShelfScene from "@/components/gallery/GalleryShelfScene";
import { PillButton } from "@/components/ui/PillButton";
import { getGallerySections } from "@/lib/galleryModel";
import { fetchPublicProfile } from "@/lib/publicProfile";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import type { GuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import CollectorBioModal from "@/components/gallery/CollectorBioModal";
import ExhibitionInfoModal from "@/components/gallery/ExhibitionInfoModal";
import { VibeButton } from "@/components/social/VibeButton";
import { getAppreciationCounts, getAppreciatedSet } from "@/lib/appreciations";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

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


function ViewerItemCard({
  item,
  label,
  compact = false,
  onRemove,
  isDragOver,
  isDraggable,
  ownerProfileId,
  viewerProfileId,
  vibeCount = 0,
  viewerVibed = false,
}: {
  item: VaultItem;
  label: string;
  compact?: boolean;
  onRemove?: () => void;
  isDragOver?: boolean;
  isDraggable?: boolean;
  ownerProfileId?: string;
  viewerProfileId?: string;
  vibeCount?: number;
  viewerVibed?: boolean;
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
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="rounded-full bg-black/10 px-3 py-1 text-[11px] text-[color:var(--muted)] ring-1 ring-black/10">
          EMV {formatMoney(item.currentValue)}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <VibeButton
            itemId={String(item.id)}
            profileId={viewerProfileId ?? ""}
            isOwner={Boolean(viewerProfileId) && ownerProfileId === viewerProfileId}
            initialCount={vibeCount}
            initialVibed={viewerVibed}
            size="compact"
          />
        </div>
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

function GuestItemModal({
  item,
  onClose,
  ownerProfileId,
  viewerProfileId,
  vibeCount = 0,
  viewerVibed = false,
}: {
  item: VaultItem;
  onClose: () => void;
  ownerProfileId?: string;
  viewerProfileId?: string;
  vibeCount?: number;
  viewerVibed?: boolean;
}) {
  const imageUrl = getPrimaryImageUrl(item);
  const subtitle = itemSubtitle(item);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-[28px] sm:rounded-[28px] border border-white/10"
        style={{ background: "linear-gradient(180deg,rgba(20,24,30,0.98),rgba(10,12,16,0.99))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={item.title} className="h-full w-full object-contain" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/40">No image</div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white/80 ring-1 ring-white/15 hover:bg-black/80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="text-lg font-semibold leading-snug text-white">{item.title}</div>
          {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {item.categoryLabel || item.category ? (
              <div className="rounded-[10px] bg-white/5 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Category</div>
                <div className="mt-0.5 font-medium text-white/80">{item.categoryLabel || item.category}</div>
              </div>
            ) : null}
            {item.universe ? (
              <div className="rounded-[10px] bg-white/5 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Universe</div>
                <div className="mt-0.5 font-medium text-white/80">{item.universe}</div>
              </div>
            ) : null}
            {item.grade ? (
              <div className="rounded-[10px] bg-white/5 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Grade</div>
                <div className="mt-0.5 font-medium text-white/80">{item.grade}</div>
              </div>
            ) : null}
            {item.certNumber ? (
              <div className="rounded-[10px] bg-white/5 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Cert #</div>
                <div className="mt-0.5 font-medium text-white/80">{item.certNumber}</div>
              </div>
            ) : null}
          </div>

          {item.notes ? (
            <div className="mt-3 rounded-[12px] bg-white/4 px-3 py-2.5 text-[12px] leading-relaxed text-white/60 ring-1 ring-white/8">
              {item.notes}
            </div>
          ) : null}

          <div className="mt-4 flex justify-center">
            <VibeButton
              itemId={String(item.id)}
              profileId={viewerProfileId ?? ""}
              isOwner={Boolean(viewerProfileId) && ownerProfileId === viewerProfileId}
              initialCount={vibeCount}
              initialVibed={viewerVibed}
            />
          </div>

          <div className="mt-4 text-center text-[10px] uppercase tracking-[0.14em] text-white/25">
            GUEST VIEW · Financial details not shown
          </div>
        </div>
      </div>
    </div>
  );
}

function getShelfSlotLayout(model: GuestGalleryViewModel) {
  const visibleIds = new Set(model.galleryItems.map((item) => item.id));
  const sections = getGallerySections(model.gallery);

  return sections.find((section) =>
    Array.isArray(section.slotLayout) &&
    section.slotLayout.some((itemId) => typeof itemId === "string" && visibleIds.has(itemId))
  )?.slotLayout;
}

type OwnerProfile = { displayName: string; profileId: string; avatar: string; avatarUrl?: string };

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
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [bioOpen, setBioOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewerProfileId, setViewerProfileId] = useState("");
  const [vibeCounts, setVibeCounts] = useState<Map<string, number>>(new Map());
  const [vibedSet, setVibedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setViewerProfileId(getActiveProfileId());
  }, []);

  useEffect(() => {
    const itemIds = model.galleryItems.map((item) => String(item.id));
    if (itemIds.length === 0) return;
    void getAppreciationCounts(itemIds).then(setVibeCounts);
    if (viewerProfileId) {
      void getAppreciatedSet(itemIds, viewerProfileId).then(setVibedSet);
    }
  }, [model.galleryItems, viewerProfileId]);

  useEffect(() => {
    const profileId = model.gallery?.profile_id;
    if (!profileId || embedded) return;
    void fetchPublicProfile(profileId).then((profile) => {
      if (profile) {
        setOwner({
          displayName: profile.displayName,
          profileId: profile.profileId,
          avatarUrl: profile.avatarUrl,
          avatar: profile.avatarEmoji,
        });
      } else {
        // No public_profiles row yet — fall back to profiles table via seed avatar
        setOwner({
          displayName: "Collector",
          profileId,
          avatarUrl: undefined,
          avatar: "🗝️",
        });
      }
    });
  }, [model.gallery?.profile_id, embedded]);

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

  // Precompute drop handlers to keep arrow functions out of JSX attribute expressions
  const gridDropMain = makeGridDrop(model.galleryItems.map((gi) => gi.id)) ?? undefined;

  const sectionViews = getGallerySections(model.gallery)
    .map((section) => ({
      section,
      items: section.itemIds
        .map((itemId) => model.galleryItems.find((item) => item.id === itemId))
        .filter(Boolean) as VaultItem[],
    }))
    .filter((entry) => entry.items.length > 0);

  // Section-filtered items for non-embedded public view
  const displayItems: VaultItem[] = !embedded && sectionViews.length > 0
    ? (sectionViews[Math.min(selectedSectionIdx, sectionViews.length - 1)]?.items ?? model.galleryItems)
    : model.galleryItems;
  const backgroundImageUrl = model.background.url;
  const coverImageUrl = typeof model.gallery?.coverImage === "string" ? model.gallery.coverImage.trim() : "";
  const shelfSlotLayout = getShelfSlotLayout(model);

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
                  {model.navigation.backLabel ?? "Back"}
                </Link>
              ) : null}

              {model.navigation.homeHref ? (
                <Link
                  href={model.navigation.homeHref}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                >
                  {model.navigation.homeLabel ?? "Galleries"}
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

                  {/* Owner byline + stats */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {owner ? (
                      <>
                        {owner.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={owner.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15" />
                        ) : (
                          <span className="text-lg leading-none">{owner.avatar}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setBioOpen(true)}
                          className="text-sm font-semibold transition-opacity hover:opacity-80"
                          style={{ color: "var(--gold, #F5B548)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          {owner.displayName}
                        </button>
                        {model.gallery ? (
                          <button
                            type="button"
                            onClick={() => setInfoOpen(true)}
                            className="vltd-pill-micro transition"
                            style={{ borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}
                          >
                            Info
                          </button>
                        ) : null}
                        <span className="text-[color:var(--muted2)]" aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <span className="text-sm font-medium" style={{ color: "var(--gold, #F5B548)" }}>
                      {model.galleryItems.length} {model.galleryItems.length === 1 ? "item" : "items"}
                    </span>
                    {sectionViews.length > 0 ? (
                      <>
                        <span className="text-[color:var(--muted2)]" aria-hidden="true">·</span>
                        <span className="text-sm font-medium" style={{ color: "var(--gold, #F5B548)" }}>
                          {sectionViews.length} {sectionViews.length === 1 ? "exhibit" : "exhibits"}
                        </span>
                      </>
                    ) : null}
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

          {/* Section navigation tabs — public view only */}
          {!embedded && sectionViews.length > 1 && (
            <div className={["mx-auto flex gap-2 overflow-x-auto pb-1 pt-3", GALLERY_STAGE_WIDTH_CLASS].join(" ")}>
              {sectionViews.map((sv, idx) => (
                <button
                  key={sv.section.id}
                  type="button"
                  onClick={() => setSelectedSectionIdx(idx)}
                  className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: idx === selectedSectionIdx ? "rgba(245,181,72,0.18)" : "rgba(255,255,255,0.06)",
                    color: idx === selectedSectionIdx ? "#F5B548" : "rgba(255,255,255,0.55)",
                    border: `1px solid ${idx === selectedSectionIdx ? "rgba(245,181,72,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {sv.section.title && sv.section.title !== "Untitled Section" ? sv.section.title : `Exhibit ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {model.displayMode === "shelf" ? (
            <div className={embedded ? "" : "mt-3"}>
              <GalleryShelfScene
                items={displayItems}
                themePack={model.themePack}
                backgroundImageUrl={backgroundImageUrl}
                shelvesEnabled={model.shelvesEnabled}
                shelfOverlayStyle={model.shelfOverlayStyle}
                slotLayout={shelfSlotLayout}
                embeddedPreview={embedded}
                onItemClick={embedded ? undefined : (item) => setSelectedItem(item)}
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
                  /* Compact 3-col grid in preview — event delegation for drag */
                  <div
                    className="grid grid-cols-3 gap-2"
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
                    {displayItems.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full text-left"
                        onClick={() => setSelectedItem(item)}
                      >
                        <ViewerItemCard
                          item={item}
                          label={`GRID ITEM #${index + 1}`}
                          ownerProfileId={model.gallery?.profile_id}
                          viewerProfileId={viewerProfileId}
                          vibeCount={vibeCounts.get(String(item.id)) ?? 0}
                          viewerVibed={vibedSet.has(String(item.id))}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}


          {displayItems.length === 0 ? (
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

      {selectedItem && !embedded ? (
        <GuestItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          ownerProfileId={model.gallery?.profile_id}
          viewerProfileId={viewerProfileId}
          vibeCount={vibeCounts.get(String(selectedItem.id)) ?? 0}
          viewerVibed={vibedSet.has(String(selectedItem.id))}
        />
      ) : null}

      {bioOpen && owner ? (
        <CollectorBioModal profileId={owner.profileId} onClose={() => setBioOpen(false)} />
      ) : null}

      {infoOpen && model.gallery ? (
        <ExhibitionInfoModal gallery={model.gallery} items={model.galleryItems} onClose={() => setInfoOpen(false)} />
      ) : null}
    </main>
  );
}
