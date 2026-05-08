"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DragEvent } from "react";

import { type VaultItem } from "@/lib/vaultModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  type Gallery,
  type GalleryShelfOverlayStyle,
  type GalleryThemePack,
  getGalleryLayoutType,
  getGallerySections,
  getGalleryThemePack,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryShelfOverlayStyle,
  getGalleryShelfBackground,
  getGalleryThemeLabel,
} from "@/lib/galleryModel";
import BuilderPreviewBridge from "@/components/gallery/BuilderPreviewBridge";
import { PillSelect, type PillSelectOption } from "@/components/ui/PillSelect";
import { getUniverses, isUniverseKey, UNIVERSE_LABEL } from "@/lib/taxonomy";

type Props = {
  gallery: Gallery;
  items: VaultItem[];
  onChange: (ids: string[]) => void;
  onGalleryChange: (updater: (current: Gallery) => Gallery) => void;
  onQuickSave?: () => void;
};

const GALLERY_BACKGROUND_BUCKET = "gallery-backgrounds";

type GalleryViewOption = GalleryThemePack | "grid";
type ShelfOverlayOption = GalleryShelfOverlayStyle;

const GALLERY_VIEW_OPTIONS: PillSelectOption<GalleryViewOption>[] = [
  {
    value: "classic",
    label: "Classic",
    subtitle: "Shelf room with the classic collector look.",
  },
  {
    value: "walnut",
    label: "Walnut",
    subtitle: "Warm wood-toned shelf presentation.",
  },
  {
    value: "cold-blue",
    label: "Midnight",
    subtitle: "Dark charcoal gallery room.",
  },
  {
    value: "marble",
    label: "Marble",
    subtitle: "Bright luxury marble gallery room.",
  },
  {
    value: "midnight",
    label: "Cold Blue",
    subtitle: "Cool blue modern shelf room.",
  },
  {
    value: "grid",
    label: "Grid View",
    subtitle: "Flat gallery grid without shelves.",
  },
] as const;

const SHELF_OVERLAY_OPTIONS: PillSelectOption<ShelfOverlayOption>[] = [
  {
    value: "none",
    label: "None",
  },
  {
    value: "glass",
    label: "Glass",
  },
  {
    value: "metal",
    label: "Metal",
  },
] as const;

function searchText(i: VaultItem) {
  return [
    i.title,
    i.subtitle,
    i.number,
    i.grade,
    i.notes,
    i.category,
    i.categoryLabel,
    i.subcategoryLabel,
    i.universe,
    i.storageLocation,
    i.certNumber,
    i.serialNumber,
    i.purchaseSource,
    i.purchaseLocation,
    i.orderNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function itemMeta(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" - ");
}

function itemUniverseLabel(i: VaultItem) {
  const key = String(i.universe ?? "").toUpperCase();
  if (isUniverseKey(key)) return UNIVERSE_LABEL[key];
  return String(i.universe || "Misc");
}

function DragHandle() {
  return (
    <span
      aria-hidden="true"
      className="grid grid-cols-2 gap-[3px] text-[color:var(--muted2)]"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="h-1 w-1 rounded-full bg-current/80" />
      ))}
    </span>
  );
}

function itemImage(i: VaultItem) {
  return i.imageFrontUrl || i.imageBackUrl || "";
}

function sortSelectedFirst(items: VaultItem[], selectedIds: string[]) {
  const selected = new Set(selectedIds);

  return [...items].sort((a, b) => {
    const aSelected = selected.has(a.id);
    const bSelected = selected.has(b.id);

    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    return a.title.localeCompare(b.title);
  });
}

function reorderIds(ids: string[], sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) return ids;

  const next = [...ids];
  const fromIndex = next.indexOf(sourceId);
  const toIndex = next.indexOf(targetId);

  if (fromIndex < 0 || toIndex < 0) return ids;

  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next;
}

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function totalCost(item: VaultItem) {
  const value =
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0);

  return Number.isFinite(value) ? value : 0;
}

async function uploadGalleryBackgroundToStorage(
  galleryId: string,
  file: File
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase browser client is not available.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${galleryId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(GALLERY_BACKGROUND_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(GALLERY_BACKGROUND_BUCKET).getPublicUrl(path);
  const publicUrl = typeof data?.publicUrl === "string" ? data.publicUrl.trim() : "";

  if (!publicUrl) {
    throw new Error("Failed to resolve public URL for uploaded background.");
  }

  return publicUrl;
}

function makeLocalSectionId() {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLayoutTypeLocal(value: unknown) {
  if (
    value === "CURATED" ||
    value === "TIMELINE" ||
    value === "MASTERPIECE" ||
    value === "ARTIST_STUDY" ||
    value === "TOP_10" ||
    value === "INVESTMENT"
  ) {
    return value;
  }

  return "GRID";
}

function toPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function syncSectionsAndLayout(
  current: Gallery,
  sections: NonNullable<Gallery["sections"]>,
  layoutType?: unknown
): Gallery {
  const currentLayout = toPlainObject(current.layout);
  const currentExhibitionLayout = toPlainObject(current.exhibitionLayout);

  const nextType = normalizeLayoutTypeLocal(
    layoutType ?? getGalleryLayoutType(current) ?? "GRID"
  );

  return {
    ...current,
    sections,
    layout: {
      ...currentLayout,
      type: nextType,
    } as unknown as Gallery["layout"],
    exhibitionLayout: {
      ...currentExhibitionLayout,
      ...currentLayout,
      type: nextType,
      sections,
    } as NonNullable<Gallery["exhibitionLayout"]>,
  };
}

export default function GalleryBuilder({
  gallery,
  items,
  onChange,
  onGalleryChange,
  onQuickSave,
}: Props) {
  const previewScale = 0.36;
  const previewWidthPercent = 100 / previewScale;
  const [query, setQuery] = useState("");
  const [visibleUniverses, setVisibleUniverses] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [shelfFileName, setShelfFileName] = useState("");
  const [backgroundUploadError, setBackgroundUploadError] = useState("");
  const [previewNaturalHeight, setPreviewNaturalHeight] = useState(1120);

  const selectedSet = useMemo(() => new Set(gallery.itemIds), [gallery.itemIds]);

  const selectedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.id, item]));
    return gallery.itemIds.map((id) => map.get(id)).filter(Boolean) as VaultItem[];
  }, [items, gallery.itemIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedUniverses = new Set(visibleUniverses);
    const availableItems = items.filter((item) => !selectedSet.has(item.id));
    const universeFiltered =
      selectedUniverses.size === 0
        ? availableItems
        : availableItems.filter((item) => selectedUniverses.has(String(item.universe ?? "").toUpperCase()));
    const pool = !q ? universeFiltered : universeFiltered.filter((item) => searchText(item).includes(q));
    return sortSelectedFirst(pool, []);
  }, [items, query, selectedSet, visibleUniverses]);

  const selectedCount = gallery.itemIds.length;

  const layoutType = getGalleryLayoutType(gallery);
  const sections = getGallerySections(gallery);

  const selectedValue = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  }, [selectedItems]);

  const selectedCost = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + totalCost(item), 0);
  }, [selectedItems]);

  const universeFilters = useMemo(() => getUniverses(), []);

  const themePack = getGalleryThemePack(gallery);
  const displayMode = getGalleryDisplayMode(gallery);
  const guestViewMode = getGalleryGuestViewMode(gallery);
  const shelfOverlayStyle = getGalleryShelfOverlayStyle(gallery);
  const shelfBackground = getGalleryShelfBackground(gallery);
  const selectedGalleryView = displayMode === "grid" ? "grid" : themePack;

  const previewPanelClass = useMemo(() => {
    if (themePack === "walnut") return "bg-[linear-gradient(180deg,rgba(62,34,22,0.92),rgba(26,13,9,0.96))] ring-amber-200/10";
    if (themePack === "midnight") return "bg-[linear-gradient(180deg,rgba(14,24,40,0.94),rgba(5,9,18,0.98))] ring-cyan-200/10";
    if (themePack === "cold-blue") return "bg-[linear-gradient(180deg,rgba(26,26,30,0.94),rgba(10,10,12,0.98))] ring-white/10";
    if (themePack === "marble") return "bg-[linear-gradient(180deg,rgba(245,240,230,0.95),rgba(221,212,195,0.96))] ring-black/10 text-stone-900";
    return "bg-[linear-gradient(180deg,rgba(17,22,29,0.95),rgba(8,11,15,0.98))] ring-white/10";
  }, [themePack]);

  const previewViewportHeight = useMemo(() => {
    const scaledHeight = Math.ceil(previewNaturalHeight * previewScale);
    return Math.max(320, Math.min(520, scaledHeight));
  }, [previewNaturalHeight, previewScale]);

  function setGalleryView(nextView: GalleryViewOption) {
    onGalleryChange((current) => {
      if (nextView === "grid") {
        return {
          ...current,
          displayMode: "grid",
        };
      }

      return {
        ...current,
        themePack: nextView,
        displayMode: "shelf",
      };
    });
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(gallery.itemIds.filter((itemId) => itemId !== id));
      return;
    }

    onChange([...gallery.itemIds, id]);
  }

  function toggleUniverseFilter(universe: string) {
    setVisibleUniverses((current) =>
      current.includes(universe)
        ? current.filter((value) => value !== universe)
        : [...current, universe]
    );
  }

  function removeItem(id: string) {
    onChange(gallery.itemIds.filter((itemId) => itemId !== id));
  }

  function onDragStart(id: string, event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = selectedSet.has(id) ? "move" : "copy";
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setData("application/x-vltd-item-id", id);
    setDraggingId(id);
    setDropTargetId(id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function getDroppedItemId(event: DragEvent<HTMLElement>) {
    return (
      draggingId ||
      event.dataTransfer.getData("application/x-vltd-item-id") ||
      event.dataTransfer.getData("text/plain")
    );
  }

  function onDropOn(targetId: string, event: DragEvent<HTMLElement>) {
    const droppedId = getDroppedItemId(event);
    if (!droppedId || !targetId || droppedId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    if (selectedSet.has(droppedId)) {
      onChange(reorderIds(gallery.itemIds, droppedId, targetId));
    } else {
      const targetIndex = gallery.itemIds.indexOf(targetId);
      const next = [...gallery.itemIds];
      if (!next.includes(droppedId)) {
        next.splice(Math.max(0, targetIndex), 0, droppedId);
      }
      onChange(next);
    }

    setDraggingId(null);
    setDropTargetId(null);
  }

  function onDropIntoSelectedList(event: DragEvent<HTMLElement>) {
    const droppedId = getDroppedItemId(event);
    if (droppedId && !selectedSet.has(droppedId)) {
      onChange([...gallery.itemIds, droppedId]);
    }

    setDraggingId(null);
    setDropTargetId(null);
  }

  function onDropIntoVaultSearch(event: DragEvent<HTMLElement>) {
    const droppedId = getDroppedItemId(event);
    if (droppedId && selectedSet.has(droppedId)) {
      removeItem(droppedId);
    }

    setDraggingId(null);
    setDropTargetId(null);
  }

  function getItemSectionId(itemId: string) {
    return sections.find((section) => section.itemIds.includes(itemId))?.id ?? "";
  }

  function assignItemToSection(sectionId: string, itemId: string) {
    if (!itemId) return;

    onGalleryChange((current) => {
      const nextSections = getGallerySections(current).map((entry) => {
        const withoutItem = entry.itemIds.filter((id) => id !== itemId);

        if (entry.id !== sectionId) {
          return {
            ...entry,
            itemIds: withoutItem,
            featuredItemId: withoutItem.includes(entry.featuredItemId ?? "")
              ? entry.featuredItemId
              : withoutItem[0],
          };
        }

        const nextItemIds = withoutItem.includes(itemId) ? withoutItem : [...withoutItem, itemId];
        return {
          ...entry,
          itemIds: nextItemIds,
          featuredItemId: entry.featuredItemId || nextItemIds[0],
        };
      });

      return syncSectionsAndLayout(current, nextSections);
    });
  }

  function removeItemFromSection(sectionId: string, itemId: string) {
    onGalleryChange((current) => {
      const nextSections = getGallerySections(current).map((entry) => {
        if (entry.id !== sectionId) return entry;
        const nextItemIds = entry.itemIds.filter((id) => id !== itemId);
        return {
          ...entry,
          itemIds: nextItemIds,
          featuredItemId: nextItemIds.includes(entry.featuredItemId ?? "")
            ? entry.featuredItemId
            : nextItemIds[0],
        };
      });

      return syncSectionsAndLayout(current, nextSections);
    });
  }

  async function handleShelfBackgroundUpload(file: File) {
    try {
      setBackgroundUploadError("");
      const publicUrl = await uploadGalleryBackgroundToStorage(gallery.id, file);
      setShelfFileName(file.name);
      onGalleryChange((current) => ({
        ...current,
        shelfBackground: publicUrl,
      }));
    } catch (error) {
      console.error("Failed uploading gallery background:", error);
      setBackgroundUploadError(
        error instanceof Error ? error.message : "Failed to upload background."
      );
    }
  }

  return (
    <div className="mt-6 grid gap-5">
      <section className="rounded-[24px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-sm font-semibold">Exhibition Layout</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Turn this gallery into a structured exhibition with sections, featured works,
              shelf styling, guest preview, and curatorial flow.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["GRID", "CURATED", "TIMELINE"] as const).map((type) => {
              const active = layoutType === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onGalleryChange((current) => syncSectionsAndLayout(current, getGallerySections(current), type))}
                  className={[
                    "vltd-selectable rounded-full px-4 py-2 text-xs font-semibold ring-1 transition",
                    active
                      ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                      : "bg-[color:var(--surface)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {type}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                onGalleryChange((current) => {
                  const nextSections = [
                    ...getGallerySections(current),
                    {
                      id: makeLocalSectionId(),
                      title: `Section ${((sections.length ?? 0) + 1).toString()}`,
                      description: "",
                      itemIds: [],
                      featuredItemId: undefined,
                    },
                  ];
                  return syncSectionsAndLayout(current, nextSections);
                })
              }
              className="vltd-selectable rounded-full bg-[color:var(--surface)] px-4 py-2 text-xs font-semibold ring-1 ring-[color:var(--border)]"
            >
              Add Section
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LAYOUT</div>
            <div className="mt-2 text-xl font-semibold">{layoutType}</div>
          </div>

          <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">SECTIONS</div>
            <div className="mt-2 text-xl font-semibold">{sections.length}</div>
          </div>

          <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">EXHIBITS</div>
            <div className="mt-2 text-xl font-semibold">{selectedCount}</div>
          </div>

          <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
              FEATURED WORKS
            </div>
            <div className="mt-2 text-xl font-semibold">
              {sections.filter((section) => !!section.featuredItemId).length}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="grid gap-4">
              <div className="rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">GALLERY VIEW</div>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="min-w-0 flex-1">
                    <PillSelect<GalleryViewOption>
                      value={selectedGalleryView}
                      onChange={setGalleryView}
                      options={GALLERY_VIEW_OPTIONS}
                      ariaLabel="Gallery view"
                      align="left"
                      minWidthPx={280}
                      extraWidthPx={10}
                      showSelectedSubtitle
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">SHELF</div>
                    <PillSelect<ShelfOverlayOption>
                      value={shelfOverlayStyle}
                      onChange={(nextStyle) =>
                        onGalleryChange((current) => ({
                          ...current,
                          shelfOverlayStyle: nextStyle,
                          glassShelfOverlay: nextStyle !== "none",
                        }))
                      }
                      options={SHELF_OVERLAY_OPTIONS}
                      ariaLabel="Shelf style"
                      align="left"
                      minWidthPx={124}
                      extraWidthPx={6}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`shelf-upload-${gallery.id}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file) void handleShelfBackgroundUpload(file);
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor={`shelf-upload-${gallery.id}`}
                      className="vltd-selectable inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                    >
                      Upload Background
                    </label>
                    {shelfBackground ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShelfFileName("");
                          setBackgroundUploadError("");
                          onGalleryChange((current) => ({ ...current, shelfBackground: "" }));
                        }}
                        className="vltd-selectable inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                      >
                        Remove Background
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onQuickSave?.()}
                      className="vltd-selectable inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                    >
                      Save
                    </button>
                  </div>

                  <div className="text-xs text-[color:var(--muted)]">
                    {shelfFileName ? `Selected file: ${shelfFileName}` : shelfBackground ? "Background applied" : "No background selected"}
                  </div>

                  {backgroundUploadError ? (
                    <div className="text-xs text-red-300">
                      {backgroundUploadError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LIVE PREVIEW PANEL</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Theme, view mode, background, and guest feel in one place.
                </div>
              </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10">
                    Theme: {displayMode === "grid" ? "Grid View" : getGalleryThemeLabel(themePack)}
                  </span>
                  <span className="rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10">Display: {displayMode}</span>
                  <span className="rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10">Guest: {guestViewMode}</span>
                  <span className="rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10">Layout: {layoutType}</span>
                </div>
              </div>
              <div
                className={[
                  "mt-4 overflow-hidden rounded-[24px] ring-1 relative",
                  previewPanelClass,
                ].join(" ")}
                >
                    <div
                      className="overflow-y-auto overflow-x-hidden overscroll-contain"
                      style={{ height: `${previewViewportHeight}px` }}
                    >
                      <div
                        className="origin-top-left pointer-events-none"
                        style={{
                          transform: `scale(${previewScale})`,
                          transformOrigin: "top left",
                          width: `${previewWidthPercent}%`,
                          height: `${previewNaturalHeight}px`,
                        }}
                      >
                        <BuilderPreviewBridge
                          gallery={gallery}
                          items={selectedItems}
                          onHeightChange={setPreviewNaturalHeight}
                        />
                      </div>
                    </div>
                  </div>
            </div>
          </div>

        {sections.length ? (
          <div className="mt-5 grid gap-4">
            {sections.map((section, sectionIndex) => {
              const sectionItems = section.itemIds
                .map((id) => items.find((item) => item.id === id))
                .filter(Boolean) as VaultItem[];
              const unassignedSelectedItems = selectedItems.filter(
                (item) => !getItemSectionId(item.id)
              );

              return (
                <div
                  key={section.id}
                  className="rounded-[18px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                        SECTION #{sectionIndex + 1}
                      </div>

                      <input
                        value={section.title}
                        onChange={(e) =>
                          onGalleryChange((current) => {
                            const nextSections = getGallerySections(current).map((entry) =>
                              entry.id === section.id
                                ? { ...entry, title: e.target.value.trim() || "Untitled Section" }
                                : entry
                            );
                            return syncSectionsAndLayout(current, nextSections);
                          })
                        }
                        className="mt-2 min-h-[38px] w-full rounded-xl bg-[color:var(--input)] px-3 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] focus:outline-none"
                      />

                      <textarea
                        value={section.description ?? ""}
                        onChange={(e) =>
                          onGalleryChange((current) => {
                            const nextSections = getGallerySections(current).map((entry) =>
                              entry.id === section.id ? { ...entry, description: e.target.value } : entry
                            );
                            return syncSectionsAndLayout(current, nextSections);
                          })
                        }
                        rows={2}
                        placeholder="Section curatorial description..."
                        className="mt-2 w-full rounded-xl bg-[color:var(--input)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:min-w-[220px]">
                      <select
                        value=""
                        onChange={(event) => {
                          assignItemToSection(section.id, event.target.value);
                          event.currentTarget.value = "";
                        }}
                        className="min-h-[36px] rounded-full bg-[color:var(--input)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      >
                        <option value="">+ Assign selected item</option>
                        {selectedItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {getItemSectionId(item.id) ? "Move" : "Add"} - {item.title}
                          </option>
                        ))}
                      </select>
                      {unassignedSelectedItems.length ? (
                        <div className="text-[10px] text-[color:var(--muted2)]">
                          {unassignedSelectedItems.length} selected item
                          {unassignedSelectedItems.length === 1 ? "" : "s"} not in a section.
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onGalleryChange((current) => syncSectionsAndLayout(current, getGallerySections(current).filter((entry) => entry.id !== section.id)))}
                        className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                      >
                        Remove Section
                      </button>
                    </div>
                  </div>

                  {sectionItems.length === 0 ? (
                    <div className="mt-3 rounded-[14px] bg-[color:var(--input)] p-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      No items assigned yet. Use “Assign selected item” above.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {sectionItems.map((item, index) => {
                        const featured = section.featuredItemId === item.id;
                        const valueLabel = formatMoney(item.currentValue);

                        return (
                          <div
                            key={`${section.id}_${item.id}`}
                            className="rounded-[14px] bg-[color:var(--input)] p-2.5 ring-1 ring-[color:var(--border)]"
                          >
                            <div className="flex gap-2.5">
                              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.24))] p-1 ring-1 ring-white/10">
                                {itemImage(item) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={itemImage(item)}
                                    alt={item.title}
                                    className="h-full w-full object-contain"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[10px] text-white/55">
                                    No image
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-1 text-sm font-semibold">{item.title}</div>
                                <div className="mt-0.5 line-clamp-1 text-xs text-[color:var(--muted)]">
                                  {itemMeta(item) || "-"}
                                </div>

                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {valueLabel ? (
                                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                                      {valueLabel}
                                    </span>
                                  ) : null}

                                  <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                                    #{index + 1}
                                  </span>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                    onGalleryChange((current) => {
                                      const nextSections = getGallerySections(current).map((entry) =>
                                        entry.id === section.id ? { ...entry, featuredItemId: item.id } : entry
                                      );
                                      return syncSectionsAndLayout(current, nextSections);
                                    })
                                  }
                                    className={[
                                      "vltd-selectable rounded-full px-3 py-1 text-[11px] font-semibold ring-1",
                                      featured
                                        ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                                        : "bg-[color:var(--surface)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                                    ].join(" ")}
                                    aria-pressed={featured}
                                  >
                                    {featured ? "Featured" : "Set Featured"}
                                  </button>

                                  {sections.length > 1 ? (
                                    <select
                                      value={section.id}
                                      onChange={(e) =>
                                        onGalleryChange((current) => {
                                          const targetSectionId = e.target.value;
                                          const nextSections = getGallerySections(current).map((entry) => {
                                            if (entry.id === section.id) {
                                              const nextItemIds = entry.itemIds.filter((id) => id !== item.id);
                                              return {
                                                ...entry,
                                                itemIds: nextItemIds,
                                                featuredItemId: nextItemIds.includes(entry.featuredItemId ?? "")
                                                  ? entry.featuredItemId
                                                  : nextItemIds[0],
                                              };
                                            }

                                            if (entry.id === targetSectionId) {
                                              const nextItemIds = entry.itemIds.includes(item.id)
                                                ? entry.itemIds
                                                : [...entry.itemIds, item.id];
                                              return {
                                                ...entry,
                                                itemIds: nextItemIds,
                                                featuredItemId: entry.featuredItemId || nextItemIds[0],
                                              };
                                            }

                                            return entry;
                                          });

                                          return syncSectionsAndLayout(current, nextSections);
                                        })
                                      }
                                      className="rounded-full bg-[color:var(--surface)] px-3 py-1 text-[11px] ring-1 ring-[color:var(--border)]"
                                    >
                                      {sections.map((target) => (
                                        <option key={target.id} value={target.id}>
                                          {target.title}
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => removeItemFromSection(section.id, item.id)}
                                    className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-100 ring-1 ring-red-400/20"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[20px] bg-[color:var(--surface)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            No sections yet. Add a section to start building a curated exhibition structure.
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[520px_minmax(0,1fr)]">
        <section className="rounded-[24px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Selected Items</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Tap + to add, or drag cards here. Drag selected items to reorder.
                </div>
              </div>

              <div className="text-sm text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--fg)]">{selectedItems.length}</span>{" "}
                selected
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">EXHIBITS</div>
                <div className="mt-2 text-xl font-semibold">{selectedCount}</div>
              </div>

              <div className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CURATED VALUE</div>
                <div className="mt-2 text-xl font-semibold">{formatMoney(selectedValue) ?? "-"}</div>
              </div>

              <div className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CURATED COST</div>
                <div className="mt-2 text-xl font-semibold">{formatMoney(selectedCost) ?? "-"}</div>
              </div>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div
              className={[
                "mt-4 rounded-[18px] bg-[color:var(--surface)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition",
                draggingId && !selectedSet.has(draggingId) ? "bg-cyan-400/6 ring-cyan-300/30" : "",
              ].join(" ")}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDropIntoSelectedList(event);
              }}
            >
              No items selected yet. Tap + or drag pieces from the Vault search panel.
            </div>
          ) : (
            <div
              className={[
                "mt-4 grid gap-2 rounded-[18px] transition",
                draggingId && !selectedSet.has(draggingId) ? "bg-cyan-400/6 p-2 ring-1 ring-cyan-300/25" : "",
              ].join(" ")}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = selectedSet.has(draggingId ?? "") ? "move" : "copy";
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDropIntoSelectedList(event);
              }}
            >
              {selectedItems.map((item, index) => {
                const isDragging = draggingId === item.id;
                const isDropTarget = dropTargetId === item.id && draggingId !== item.id;
                const sectionId = getItemSectionId(item.id);
                const assignedSection = sections.find((section) => section.id === sectionId) ?? null;

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(event) => onDragStart(item.id, event)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dropTargetId !== item.id) setDropTargetId(item.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDropOn(item.id, event);
                    }}
                    className={[
                      "relative rounded-[14px] bg-[color:var(--surface)] p-2 pr-9 ring-1 transition",
                      isDragging
                        ? "scale-[0.99] opacity-60 ring-[color:var(--border)]"
                        : isDropTarget
                          ? "ring-[color:var(--fg)] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                          : "ring-[color:var(--border)]",
                    ].join(" ")}
                  >
                    <div className="flex gap-2">
                      <div className="flex w-4 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing">
                        <DragHandle />
                      </div>

                      <div className="h-10 w-9 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.24))] p-1 ring-1 ring-white/10">
                        {itemImage(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(item)}
                            alt={item.title}
                            className="h-full w-full object-contain"
                            draggable={false}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[10px] text-white/55">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[9px] tracking-[0.15em] text-[color:var(--muted2)]">
                            EXHIBIT #{index + 1}
                          </div>

                          {assignedSection ? (
                            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[9px] ring-1 ring-black/10">
                              {assignedSection.title}
                            </span>
                          ) : null}
                        </div>

                        <div className="line-clamp-1 text-[13px] font-semibold leading-tight">{item.title}</div>

                        <div className="line-clamp-1 text-[11px] leading-tight text-[color:var(--muted)]">
                          {itemUniverseLabel(item)}
                        </div>

                        <div className="mt-0.5 flex flex-wrap gap-3 text-[10px] leading-tight text-[color:var(--muted)]">
                          {typeof item.currentValue === "number" ? (
                            <span>
                              Value {formatMoney(item.currentValue)}
                            </span>
                          ) : null}

                          <span>
                            Cost {formatMoney(totalCost(item))}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-red-500/16 text-[0px] font-bold text-transparent shadow-[0_0_14px_rgba(248,113,113,0.36)] ring-1 ring-red-400/35 transition after:text-base after:leading-none after:text-red-100 after:content-['-'] hover:bg-red-500/26"
                      aria-label={`Remove ${item.title} from selected items`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div
            className={[
              "rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] transition",
              draggingId && selectedSet.has(draggingId) ? "bg-red-400/5 ring-red-300/25" : "",
            ].join(" ")}
            onDragOver={(event) => {
              if (!selectedSet.has(draggingId ?? "")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              if (!selectedSet.has(draggingId ?? "")) return;
              event.preventDefault();
              onDropIntoVaultSearch(event);
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-sm font-semibold">Search the Vault</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Find items by title, subtitle, notes, number, grade, category, cert number, storage location, or purchase details.
                </div>
              </div>

              <div className="text-sm text-[color:var(--muted)]">
                Selected: <span className="font-semibold text-[color:var(--fg)]">{selectedCount}</span>
              </div>
            </div>

            <div className="mt-4 flex h-[42px] items-center rounded-full bg-[color:var(--input)] px-3 ring-1 ring-[color:var(--border)]">
              <span className="shrink-0 text-[color:var(--muted)]" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path
                    d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vault..."
                className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
                Only show selected
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {universeFilters.map((universe) => {
                  const checked = visibleUniverses.includes(universe);

                  return (
                    <label
                      key={universe}
                      className={[
                        "inline-flex min-h-[30px] cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 transition",
                        checked
                          ? "bg-cyan-400/14 text-cyan-100 ring-cyan-300/30"
                          : "bg-black/12 text-[color:var(--muted)] ring-white/10 hover:text-[color:var(--fg)]",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUniverseFilter(universe)}
                        className="h-3.5 w-3.5 accent-cyan-300"
                      />
                      {UNIVERSE_LABEL[universe]}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-5 rounded-[20px] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No Vault items matched that search.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((item) => {
                const active = selectedSet.has(item.id);
                const toggleLabel = active ? `Remove ${item.title} from gallery` : `Add ${item.title} to gallery`;

                return (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={(event) => onDragStart(item.id, event)}
                    onDragEnd={onDragEnd}
                    className={[
                      "vltd-selectable group cursor-grab overflow-hidden rounded-[22px] border text-left transition duration-300 active:cursor-grabbing",
                      active
                        ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] shadow-[0_16px_42px_rgba(0,0,0,0.2)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.12)]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-label={toggleLabel}
                      aria-pressed={active}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.12),rgba(82,214,244,0.06)_34%,rgba(0,0,0,0.22)_100%)] p-3">
                        {itemImage(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(item)}
                            alt={item.title}
                            className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.025]"
                            draggable={false}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <div className="text-xs opacity-60">No image</div>
                          </div>
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_22%,rgba(255,255,255,0)_52%)] mix-blend-screen" />
                        {active ? (
                          <>
                            <div className="pointer-events-none absolute inset-0 grid place-items-center">
                              <span className="relative inline-flex h-14 w-28 items-center justify-center rounded-[14px] border-2 border-[#ff8a1f] bg-[rgba(255,88,0,0.08)] shadow-[0_0_16px_rgba(255,120,0,0.72),inset_0_0_18px_rgba(255,136,31,0.22)]">
                                <span className="h-[4px] w-14 rounded-full bg-[#ffd0a2] shadow-[0_0_10px_rgba(255,222,173,0.85)]" />
                              </span>
                            </div>
                            <div className="pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] ring-1 backdrop-blur-sm">
                              SELECTED
                            </div>
                          </>
                        ) : (
                          <div className="pointer-events-none absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-emerald-200/40 bg-emerald-400/12 text-3xl font-light leading-none text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.42)] ring-1 ring-emerald-300/25 backdrop-blur-sm">
                            +
                          </div>
                        )}
                      </div>
                    </button>

                    <Link
                      href={`/vault/item/${item.id}`}
                      className="block border-t border-white/8 p-4 transition hover:bg-black/10"
                    >
                      <div className="line-clamp-2 text-lg font-semibold leading-tight">{item.title}</div>
                      <div className="mt-2 line-clamp-1 text-sm opacity-75">{itemMeta(item) || "-"}</div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {typeof item.currentValue === "number" ? (
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            Value {formatMoney(item.currentValue)}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

