"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";

import { type VaultItem, getPrimaryImageUrl } from "@/lib/vaultModel";
import GalleryShelfScene from "@/components/gallery/GalleryShelfScene";
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
import { MAX_EXHIBIT_ITEMS } from "@/components/gallery/ItemPickerSheet";
import { PillSelect, type PillSelectOption } from "@/components/ui/PillSelect";
import { isUniverseKey, UNIVERSE_LABEL } from "@/lib/taxonomy";

type Props = {
  gallery: Gallery;
  items: VaultItem[];
  onChange: (ids: string[]) => void;
  onGalleryChange: (updater: (current: Gallery) => Gallery) => void;
  onQuickSave?: () => void;
  onOpenPicker?: () => void;
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
  onOpenPicker,
}: Props) {
  const previewScale = 0.36;
  const previewWidthPercent = 100 / previewScale;
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [shelfFileName, setShelfFileName] = useState("");
  const [backgroundUploadError, setBackgroundUploadError] = useState("");
  const [previewNaturalHeight, setPreviewNaturalHeight] = useState(1120);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [sectionBtnRect, setSectionBtnRect] = useState<DOMRect | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const sectionBtnRef = useRef<HTMLButtonElement | null>(null);

  const selectedSet = useMemo(() => new Set(gallery.itemIds), [gallery.itemIds]);

  const selectedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.id, item]));
    return gallery.itemIds.map((id) => map.get(id)).filter(Boolean) as VaultItem[];
  }, [items, gallery.itemIds]);

  const selectedCount = gallery.itemIds.length;

  const layoutType = getGalleryLayoutType(gallery);
  const sections = getGallerySections(gallery);

  const selectedValue = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  }, [selectedItems]);

  const selectedCost = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + totalCost(item), 0);
  }, [selectedItems]);

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

        {/* ── LIVE PREVIEW PANEL (merged with Exhibit View controls) ── */}
        <div className="mt-5 rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">

          {/* Header row: label left, Expand right */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LIVE PREVIEW PANEL</div>
              <div className="mt-0.5 text-sm text-[color:var(--muted)]">
                Theme, view mode, background, and guest feel in one place.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewExpanded(true)}
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-90"
              style={{
                background: "rgba(245,181,72,0.12)",
                color: "#F5B548",
                border: "1px solid rgba(245,181,72,0.3)",
              }}
            >
              Expand ↗
            </button>
          </div>

          {/* ── Row 1: Theme | Shelf | Upload Background ── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Theme dropdown — shows "Theme: X" label */}
            <div className="relative">
              <PillSelect<GalleryViewOption>
                value={selectedGalleryView}
                onChange={setGalleryView}
                options={GALLERY_VIEW_OPTIONS}
                ariaLabel="Exhibit view"
                align="left"
                minWidthPx={140}
                extraWidthPx={6}
                labelPrefix="Theme: "
                compact
              />
            </div>
            {/* Shelf dropdown — shows "Shelf: X" label */}
            <div className="relative">
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
                minWidthPx={100}
                extraWidthPx={6}
                labelPrefix="Shelf: "
                compact
              />
            </div>
            {/* Upload Background */}
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
            {/* Upload Background — uniform pill */}
            <label
              htmlFor={`shelf-upload-${gallery.id}`}
              className="vltd-selectable inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-full bg-[color:var(--pill)] px-3 text-xs font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm hover:bg-[color:var(--pill-hover)] transition-all select-none"
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
                className="vltd-selectable inline-flex min-h-[34px] items-center justify-center rounded-full bg-[color:var(--pill)] px-3 text-xs font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm hover:bg-[color:var(--pill-hover)] transition-all"
              >
                Remove BG
              </button>
            ) : null}
          </div>

          {/* ── Row 2: Section dropdown | Name input | Edit | Save ── */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Section selector — dropdown pill */}
            <div className="relative">
              <button
                ref={sectionBtnRef}
                type="button"
                onClick={() => {
                  if (!sectionDropdownOpen) {
                    setSectionBtnRect(sectionBtnRef.current?.getBoundingClientRect() ?? null);
                  }
                  setSectionDropdownOpen((v) => !v);
                }}
                className="inline-flex min-h-[34px] items-center justify-between gap-1.5 rounded-full bg-[color:var(--pill)] px-3 text-xs font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm hover:bg-[color:var(--pill-hover)] transition-all select-none"
              >
                <span>
                  {"Section #" + (activeSectionIdx + 1)}
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 opacity-60 shrink-0">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                </svg>
              </button>
              {sectionDropdownOpen && typeof document !== "undefined" && createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[50]"
                    onClick={() => setSectionDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="overflow-hidden rounded-2xl bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-pill)] p-1"
                    style={{
                      position: "fixed",
                      top: (sectionBtnRect?.bottom ?? 0) + 8,
                      left: sectionBtnRect?.left ?? 0,
                      minWidth: 180,
                      zIndex: 61,
                    }}
                  >
                    {sections.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-[color:var(--muted)]">No sections yet</div>
                    ) : (
                      sections.map((s, i) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveSectionIdx(i);
                            setSectionDropdownOpen(false);
                          }}
                          className={[
                            "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                            i === activeSectionIdx
                              ? "bg-[color:var(--pill)] font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)]"
                              : "text-[color:var(--fg)] hover:bg-[color:var(--pill)]",
                          ].join(" ")}
                        >
                          {"Section #" + (i + 1)}{s.title ? (" — " + s.title) : ""}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onGalleryChange((current) => {
                          const nextSections = [
                            ...getGallerySections(current),
                            {
                              id: makeLocalSectionId(),
                              title: "Section " + ((sections.length + 1).toString()),
                              description: "",
                              itemIds: [],
                              featuredItemId: undefined,
                            },
                          ];
                          return syncSectionsAndLayout(current, nextSections);
                        });
                        setActiveSectionIdx(sections.length);
                        setSectionDropdownOpen(false);
                      }}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-[color:var(--muted)] hover:bg-[color:var(--pill)] transition"
                    >
                      + Add Section
                    </button>
                  </div>
                </>,
                document.body
              )}
            </div>

            {/* Section name input — uniform pill style */}
            <input
              type="text"
              value={sections[activeSectionIdx]?.title ?? ""}
              onChange={(e) => {
                const updated = sections.map((s, i) =>
                  i === activeSectionIdx ? { ...s, title: e.target.value } : s
                );
                onGalleryChange((current) => syncSectionsAndLayout(current, updated));
              }}
              placeholder="Name of Section goes here"
              className="inline-flex min-h-[34px] flex-1 min-w-[120px] items-center rounded-full bg-[color:var(--pill)] px-3 text-xs font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--fg)]/20 transition-all placeholder:text-[color:var(--muted)]"
            />

            {/* Edit — gold pill, uniform height */}
            <button
              type="button"
              onClick={() => onOpenPicker?.()}
              className="inline-flex min-h-[34px] items-center justify-center rounded-full px-3 text-xs font-semibold ring-1 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "rgba(245,181,72,0.12)", color: "#F5B548", borderColor: "rgba(245,181,72,0.45)" }}
            >
              Edit
            </button>

            {/* Save — gold pill, uniform height */}
            <button
              type="button"
              onClick={() => onQuickSave?.()}
              className="inline-flex min-h-[34px] items-center justify-center rounded-full px-3 text-xs font-semibold ring-1 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "rgba(245,181,72,0.22)", color: "#F5B548", borderColor: "rgba(245,181,72,0.55)" }}
            >
              Save
            </button>
          </div>

          {/* Background / error status */}
          {(shelfFileName || shelfBackground || backgroundUploadError) ? (
            <div className="mt-1 text-xs" style={{ color: backgroundUploadError ? "rgb(252,165,165)" : "var(--muted)" }}>
              {backgroundUploadError
                ? backgroundUploadError
                : shelfFileName
                  ? ("Selected: " + shelfFileName)
                  : "Background applied"}
            </div>
          ) : null}

          {/* Mini grid preview */}
          <div
            className={[
              "mt-3 overflow-hidden rounded-[24px] ring-1 relative",
              previewPanelClass,
            ].join(" ")}
          >
            {selectedItems.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
                No items selected yet
              </div>
            ) : (
              <div className="p-3">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                  }}
                >
                  {selectedItems.map((item) => {
                    const img = itemImage(item);
                    return (
                      <div
                        key={item.id}
                        style={{
                          aspectRatio: "3 / 4",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.06)",
                        }}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={item.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            draggable={false}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              color: "var(--muted)",
                            }}
                          >
                            {"--"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    color: "rgba(255,255,255,0.28)",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedItems.length + " items"}{" · "}{displayMode === "grid" ? "Grid View" : getGalleryThemeLabel(themePack)}
                </div>
              </div>
            )}
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
                draggingId && !selectedSet.has(draggingId) ? "bg-gold/6 ring-cyan-300/30" : "",
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
                draggingId && !selectedSet.has(draggingId) ? "bg-gold/6 p-2 ring-1 ring-cyan-300/25" : "",
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
                      className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center overflow-visible rounded-full border-[3px] border-red-500 bg-transparent text-[0px] text-transparent ring-1 ring-red-100/70 transition hover:scale-105"
                      style={{
                        boxShadow:
                          "0 0 14px rgba(248,113,113,0.92), 0 0 30px rgba(248,113,113,0.48), inset 0 0 8px rgba(248,113,113,0.24)",
                      }}
                      aria-label={`Remove ${item.title} from selected items`}
                    >
                      <span className="pointer-events-none absolute -inset-2 rounded-full bg-red-500/30 blur-md" aria-hidden="true" />
                      <span
                        className="absolute left-1/2 top-1/2 z-10 h-[5px] w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
                        style={{
                          boxShadow:
                            "0 0 7px rgba(255,255,255,0.95), 0 0 12px rgba(248,113,113,0.95), 0 0 20px rgba(248,113,113,0.78)",
                        }}
                        aria-hidden="true"
                      />
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          {/* ── Compact Vault Picker Pill ── */}
          <div
            className="rounded-[20px] p-4 ring-1"
            style={{
              background: "rgba(8,12,20,0.85)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Vault Pieces</div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  Pick up to {MAX_EXHIBIT_ITEMS} pieces for this exhibit.
                </div>
              </div>
              <div
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums"
                style={{
                  background:
                    selectedCount >= MAX_EXHIBIT_ITEMS
                      ? "rgba(245,181,72,0.15)"
                      : "rgba(255,255,255,0.07)",
                  color:
                    selectedCount >= MAX_EXHIBIT_ITEMS ? "#F5B548" : "var(--muted)",
                  border: `1px solid ${
                    selectedCount >= MAX_EXHIBIT_ITEMS
                      ? "rgba(245,181,72,0.3)"
                      : "rgba(255,255,255,0.09)"
                  }`,
                }}
              >
                {selectedCount}/{MAX_EXHIBIT_ITEMS}
              </div>
            </div>

            {/* Selected thumbnail strip */}
            {selectedItems.length > 0 && (
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {selectedItems.map((item) => {
                  const img = itemImage(item);
                  return (
                    <div
                      key={item.id}
                      className="relative shrink-0 overflow-hidden rounded-lg"
                      style={{
                        width: 44,
                        aspectRatio: "3/4",
                        boxShadow: "0 0 0 1.5px rgba(245,181,72,0.55), 0 0 8px rgba(245,181,72,0.25)",
                      }}
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="h-full w-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Open picker button */}
            <button
              type="button"
              onClick={() => onOpenPicker?.()}
              className="mt-4 w-full rounded-full py-[15px] text-[15px] font-black tracking-wide transition active:opacity-80"
              style={{
                background:
                  selectedCount > 0
                    ? "linear-gradient(135deg, #FFE08A 0%, #F5B548 40%, #C8941F 100%)"
                    : "rgba(255,255,255,0.07)",
                color: selectedCount > 0 ? "#1A0F00" : "var(--muted)",
                boxShadow:
                  selectedCount > 0
                    ? "0 0 0 1px rgba(245,181,72,0.35), 0 8px 28px rgba(245,181,72,0.3)"
                    : "none",
                border: selectedCount === 0 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              {selectedCount === 0
                ? "Open Vault Picker"
                : `Edit Selection  (${selectedCount})`}
            </button>
          </div>
        </section>
      </div>

      {/* ── Expanded Live Preview Overlay ── */}
      {previewExpanded && (
        <div
          className="fixed inset-0 z-[75] flex flex-col"
          style={{ background: "#080C14" }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 items-center justify-between px-4 pb-3"
            style={{
              paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div>
              <div className="text-[11px] tracking-[0.2em]" style={{ color: "var(--muted2)" }}>
                LIVE PREVIEW
              </div>
              <div className="mt-0.5 text-sm font-semibold">
                {gallery.title || "Exhibition"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewExpanded(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition active:opacity-70"
              style={{ background: "rgba(255,255,255,0.07)" }}
              aria-label="Close preview"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" style={{ color: "var(--muted)" }}>
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Real shelf/theme scene — exactly what guests see */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <GalleryShelfScene
              items={selectedItems}
              themePack={gallery.themePack}
              backgroundImageUrl={gallery.shelfBackground}
              shelvesEnabled={true}
              shelfOverlayStyle={gallery.shelfOverlayStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
