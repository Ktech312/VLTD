"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type VaultItem, loadItems } from "@/lib/vaultModel";
import {
  type Gallery,
  addGallerySection,
  moveItemBetweenSections,
  removeGallerySection,
  setExhibitionLayoutType,
  setSectionFeaturedItem,
  updateGallerySection,
  setGalleryThemePack,
  setGalleryDisplayMode,
  setGalleryGuestViewMode,
  setGalleryShelfBackground,
  getGalleryShareUrl,
  createGalleryInviteToken,
  getGalleryInviteUrl,
  getGalleryLayoutType,
  getGallerySections,
  getGalleryThemePack,
  getGalleryDisplayMode,
  getGalleryGuestViewMode,
  getGalleryShelfBackground,
} from "@/lib/galleryModel";

type Props = {
  gallery: Gallery;
  onChange: (ids: string[]) => void;
};

type ThemePackOption = {
  value: "classic" | "walnut" | "midnight" | "marble";
  label: string;
  description: string;
};

const THEME_PACKS: ThemePackOption[] = [
  {
    value: "classic",
    label: "Classic",
    description: "Balanced collector presentation with the default museum look.",
  },
  {
    value: "walnut",
    label: "Walnut",
    description: "Warm wood-toned presentation with a heritage feel.",
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Dark exhibition mood with deeper contrast.",
  },
  {
    value: "marble",
    label: "Marble",
    description: "Brighter premium gallery styling with a modern finish.",
  },
];

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
    (i as any).serialNumber,
    (i as any).purchaseSource,
    (i as any).purchaseLocation,
    (i as any).orderNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function itemMeta(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
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
    Number((item as any).purchaseTax ?? 0) +
    Number((item as any).purchaseShipping ?? 0) +
    Number((item as any).purchaseFees ?? 0);

  return Number.isFinite(value) ? value : 0;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export default function GalleryBuilder({ gallery, onChange }: Props) {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [guestCopied, setGuestCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  useEffect(() => {
    if (!guestCopied) return;
    const timer = window.setTimeout(() => setGuestCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [guestCopied]);

  useEffect(() => {
    if (!inviteCopied) return;
    const timer = window.setTimeout(() => setInviteCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [inviteCopied]);

  const selectedSet = useMemo(() => new Set(gallery.itemIds), [gallery.itemIds]);

  const selectedItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.id, item]));
    return gallery.itemIds.map((id) => map.get(id)).filter(Boolean) as VaultItem[];
  }, [items, gallery.itemIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = !q ? items : items.filter((item) => searchText(item).includes(q));
    return sortSelectedFirst(pool, gallery.itemIds);
  }, [items, query, gallery.itemIds]);

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
  const shelfBackground = getGalleryShelfBackground(gallery);
  const publicShareUrl = getGalleryShareUrl(gallery);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(gallery.itemIds.filter((itemId) => itemId !== id));
      return;
    }

    onChange([...gallery.itemIds, id]);
  }

  function moveItem(id: string, direction: -1 | 1) {
    const index = gallery.itemIds.indexOf(id);
    if (index < 0) return;

    const target = index + direction;
    if (target < 0 || target >= gallery.itemIds.length) return;

    const next = [...gallery.itemIds];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;

    onChange(next);
  }

  function removeItem(id: string) {
    onChange(gallery.itemIds.filter((itemId) => itemId !== id));
  }

  function onDragStart(id: string) {
    setDraggingId(id);
    setDropTargetId(id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function onDropOn(targetId: string) {
    if (!draggingId || !targetId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    const next = reorderIds(gallery.itemIds, draggingId, targetId);
    onChange(next);
    setDraggingId(null);
    setDropTargetId(null);
  }

  function getItemSectionId(itemId: string) {
    return sections.find((section) => section.itemIds.includes(itemId))?.id ?? "";
  }

  async function handleShelfBackgroundUpload(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setGalleryShelfBackground(gallery.id, dataUrl);
  }

  async function handleCopyGuestLink() {
    if (!publicShareUrl) return;

    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setGuestCopied(true);
    } catch {
      // ignore
    }
  }

  function handleOpenGuestView() {
    if (!publicShareUrl) return;
    window.open(publicShareUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCreateQuickInvite() {
    const token = createGalleryInviteToken(gallery.id, "Guest Preview");
    const url = getGalleryInviteUrl(gallery, token);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
    } catch {
      // ignore
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
                  onClick={() => setExhibitionLayoutType(gallery.id, type)}
                  className={[
                    "rounded-full px-4 py-2 text-xs font-semibold ring-1 transition",
                    active
                      ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                      : "bg-[color:var(--surface)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                  ].join(" ")}
                >
                  {type}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                addGallerySection(gallery.id, `Section ${((sections.length ?? 0) + 1).toString()}`)
              }
              className="rounded-full bg-[color:var(--surface)] px-4 py-2 text-xs font-semibold ring-1 ring-[color:var(--border)]"
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">THEME PACK</div>
            <div className="mt-3 grid gap-2">
              {THEME_PACKS.map((option) => {
                const active = themePack === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGalleryThemePack(gallery.id, option.value)}
                    className={[
                      "rounded-2xl px-4 py-3 text-left ring-1 transition",
                      active
                        ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                        : "bg-[color:var(--input)] text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--surface-strong)]",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="mt-1 text-xs opacity-80">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
              DISPLAY + GUEST MODE
            </div>

            <div className="mt-3 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Display Mode</label>
                <div className="flex flex-wrap gap-2">
                  {(["grid", "shelf"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGalleryDisplayMode(gallery.id, mode)}
                      className={[
                        "rounded-full px-4 py-2 text-xs font-semibold ring-1 transition",
                        displayMode === mode
                          ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                          : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                      ].join(" ")}
                    >
                      {mode === "grid" ? "Grid Mode" : "Shelf Mode"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Guest View Mode</label>
                <div className="flex flex-wrap gap-2">
                  {(["public", "guest"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGalleryGuestViewMode(gallery.id, mode)}
                      className={[
                        "rounded-full px-4 py-2 text-xs font-semibold ring-1 transition",
                        guestViewMode === mode
                          ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                          : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                      ].join(" ")}
                    >
                      {mode === "public" ? "Public Default" : "Guest Default"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-[color:var(--fg)]">
                  Shelf background image
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) void handleShelfBackgroundUpload(file);
                      e.currentTarget.value = "";
                    }}
                    className="block w-full text-sm"
                  />
                  {shelfBackground ? (
                    <button
                      type="button"
                      onClick={() => setGalleryShelfBackground(gallery.id, "")}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                    >
                      Remove Background
                    </button>
                  ) : null}
                </div>

                {shelfBackground ? (
                  <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-[color:var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shelfBackground}
                      alt="Shelf background preview"
                      className="h-28 w-full object-cover"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                    No shelf background uploaded yet.
                  </div>
                )}
              </div>

              <div className="rounded-[18px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-sm font-semibold">Guest View Tools</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Open the gallery as a visitor or copy a public / invite link for testing.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenGuestView}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 text-xs font-semibold text-[color:var(--fg)]"
                  >
                    Open Guest View
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyGuestLink}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                  >
                    {guestCopied ? "Copied Public Link" : "Copy Public Link"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateQuickInvite}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                  >
                    {inviteCopied ? "Copied Invite Link" : "Create + Copy Invite"}
                  </button>
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

              return (
                <div
                  key={section.id}
                  className="rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                        SECTION #{sectionIndex + 1}
                      </div>

                      <input
                        value={section.title}
                        onChange={(e) =>
                          updateGallerySection(gallery.id, section.id, { title: e.target.value })
                        }
                        className="mt-2 min-h-[42px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)] focus:outline-none"
                      />

                      <textarea
                        value={section.description ?? ""}
                        onChange={(e) =>
                          updateGallerySection(gallery.id, section.id, {
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Section curatorial description..."
                        className="mt-3 w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => removeGallerySection(gallery.id, section.id)}
                        className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                      >
                        Remove Section
                      </button>
                    </div>
                  </div>

                  {sectionItems.length === 0 ? (
                    <div className="mt-4 rounded-[18px] bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      No items assigned to this section yet.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {sectionItems.map((item, index) => {
                        const featured = section.featuredItemId === item.id;
                        const valueLabel = formatMoney(item.currentValue);

                        return (
                          <div
                            key={`${section.id}_${item.id}`}
                            className="rounded-[18px] bg-[color:var(--input)] p-3 ring-1 ring-[color:var(--border)]"
                          >
                            <div className="flex gap-3">
                              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                                {itemImage(item) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={itemImage(item)}
                                    alt={item.title}
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[10px] text-white/55">
                                    No image
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-sm font-semibold">{item.title}</div>
                                <div className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">
                                  {itemMeta(item) || "—"}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {valueLabel ? (
                                    <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                                      {valueLabel}
                                    </span>
                                  ) : null}

                                  <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                                    #{index + 1}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSectionFeaturedItem(gallery.id, section.id, item.id)}
                                    className={[
                                      "rounded-full px-3 py-1 text-[11px] font-semibold ring-1",
                                      featured
                                        ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                                        : "bg-[color:var(--surface)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                                    ].join(" ")}
                                  >
                                    {featured ? "Featured" : "Set Featured"}
                                  </button>

                                  {sections.length > 1 ? (
                                    <select
                                      value={section.id}
                                      onChange={(e) =>
                                        moveItemBetweenSections(
                                          gallery.id,
                                          item.id,
                                          section.id,
                                          e.target.value
                                        )
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
                                </div>

                                <div className="mt-3">
                                  <Link
                                    href={`/vault/item/${item.id}`}
                                    className="inline-flex min-h-[30px] items-center justify-center rounded-full bg-[color:var(--pill)] px-3 py-1 text-[11px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                                  >
                                    Open Item
                                  </Link>
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

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[24px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Selected Items</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Drag exhibits to reorder the main gallery flow, or use move controls for precise adjustments.
                </div>
              </div>

              <div className="text-sm text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--fg)]">{selectedItems.length}</span>{" "}
                selected
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">EXHIBITS</div>
                <div className="mt-2 text-xl font-semibold">{selectedCount}</div>
              </div>

              <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CURATED VALUE</div>
                <div className="mt-2 text-xl font-semibold">{formatMoney(selectedValue) ?? "—"}</div>
              </div>

              <div className="rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CURATED COST</div>
                <div className="mt-2 text-xl font-semibold">{formatMoney(selectedCost) ?? "—"}</div>
              </div>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div className="mt-4 rounded-[18px] bg-[color:var(--surface)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No items selected yet. Add pieces from the Vault search panel.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {selectedItems.map((item, index) => {
                const isDragging = draggingId === item.id;
                const isDropTarget = dropTargetId === item.id && draggingId !== item.id;
                const sectionId = getItemSectionId(item.id);
                const assignedSection = sections.find((section) => section.id === sectionId) ?? null;

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => onDragStart(item.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dropTargetId !== item.id) setDropTargetId(item.id);
                    }}
                    onDrop={() => onDropOn(item.id)}
                    className={[
                      "rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 transition",
                      isDragging
                        ? "scale-[0.99] opacity-60 ring-[color:var(--border)]"
                        : isDropTarget
                          ? "ring-[color:var(--fg)] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
                          : "ring-[color:var(--border)]",
                    ].join(" ")}
                  >
                    <div className="flex gap-4">
                      <div className="flex w-4 shrink-0 cursor-grab items-center justify-center text-[color:var(--muted2)] active:cursor-grabbing">
                        ⋮⋮
                      </div>

                      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                        {itemImage(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(item)}
                            alt={item.title}
                            className="h-full w-full object-cover"
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
                          <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                            EXHIBIT #{index + 1}
                          </div>

                          {assignedSection ? (
                            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] ring-1 ring-black/10">
                              {assignedSection.title}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 line-clamp-2 text-base font-semibold">{item.title}</div>

                        <div className="mt-1 line-clamp-1 text-sm text-[color:var(--muted)]">
                          {itemMeta(item) || "—"}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {typeof item.currentValue === "number" ? (
                            <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                              Value {formatMoney(item.currentValue)}
                            </span>
                          ) : null}

                          <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                            Cost {formatMoney(totalCost(item))}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveItem(item.id, -1)}
                            disabled={index === 0}
                            className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Move Up
                          </button>

                          <button
                            type="button"
                            onClick={() => moveItem(item.id, 1)}
                            disabled={index === selectedItems.length - 1}
                            className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Move Down
                          </button>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
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
        </section>

        <section>
          <div className="rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
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

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vault items..."
              className="mt-4 min-h-[46px] w-full rounded-2xl bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="mt-5 rounded-[20px] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No Vault items matched that search.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((item) => {
                const active = selectedSet.has(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={[
                      "group overflow-hidden rounded-[22px] border text-left transition duration-300",
                      active
                        ? "border-transparent bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] shadow-[0_16px_42px_rgba(0,0,0,0.2)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.12)]",
                    ].join(" ")}
                  >
                    <div className="relative">
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[linear-gradient(180deg,#11161f_0%,#0a0d12_100%)]">
                        {itemImage(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={itemImage(item)}
                            alt={item.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            draggable={false}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <div className="text-center">
                              <div className="text-sm font-medium opacity-90">{item.title}</div>
                              <div className="mt-1 text-xs opacity-60">No image available</div>
                            </div>
                          </div>
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.04)_22%,rgba(255,255,255,0)_52%)] mix-blend-screen" />
                        <div className="pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] ring-1 backdrop-blur-sm">
                          {active ? "SELECTED" : "ADD"}
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="line-clamp-2 text-lg font-semibold leading-tight">{item.title}</div>
                      <div className="mt-2 line-clamp-1 text-sm opacity-75">{itemMeta(item) || "—"}</div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {typeof item.currentValue === "number" ? (
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            Value {formatMoney(item.currentValue)}
                          </span>
                        ) : null}

                        <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                          Cost {formatMoney(totalCost(item))}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}