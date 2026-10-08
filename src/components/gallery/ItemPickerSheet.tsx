"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { SelectCircle } from "@/components/ui/SelectCircle";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { isSupplyItem } from "@/lib/vaultStats";
import { chipKey, chipOptions } from "@/components/VaultCategoryChips";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export const MAX_EXHIBIT_ITEMS = 18;

// Shortened labels so chips fit on one line. Anything not listed here falls back
// to the canonical UNIVERSE_LABEL from taxonomy.ts, so a newly added universe
// never shows up as a raw enum key (e.g. "BUILT_BOTANY").
const CHIP_LABEL_OVERRIDE: Partial<Record<UniverseKey, string>> = {
  JEWELRY_APPAREL: "Jewelry",
};

function chipLabel(u: UniverseKey) {
  return CHIP_LABEL_OVERRIDE[u] ?? UNIVERSE_LABEL[u] ?? u;
}

function categoryOf(i: VaultItem) {
  return String(i.categoryLabel || i.customCategoryLabel || i.category || "").trim();
}

function subcategoryOf(i: VaultItem) {
  return String(i.subcategoryLabel || "").trim();
}

function searchText(i: VaultItem) {
  return [i.title, i.subtitle, i.number, i.grade, i.notes, i.category, i.categoryLabel, i.subcategoryLabel, i.universe]
    .filter(Boolean).join(" ").toLowerCase();
}

function itemImage(i: VaultItem) {
  return getPrimaryImageUrl(i) || i.imageFrontUrl || i.imageBackUrl || "";
}

type PickerPageState = { id: string; title: string; picked: string[]; hidden: string[] };

export function ItemPickerSheet({
  allItems: everyItem,
  confirmedIds,
  sectionTitle: initialTitle,
  mode = "multi",
  maxItems = MAX_EXHIBIT_ITEMS,
  pickerTitle,
  pages,
  activePageIdx,
  onConfirmPages,
  onConfirm,
  onClose,
}: {
  /** Exhibit builder: every exhibit page of this exhibition, so items can be added to any of them
   * (or to a new one) without closing the picker. An item can only be on one page. */
  pages?: { id: string; title: string; itemIds: string[] }[];
  activePageIdx?: number;
  onConfirmPages?: (pages: { id: string; title: string; itemIds: string[] }[]) => void;
  allItems: VaultItem[];
  confirmedIds: string[];
  sectionTitle?: string;
  /** Shared Museum Room Editor consolidation pass (2026-09-12): "single"
   * replaces MuseumRoomItemPicker.tsx's own near-duplicate single-select UI
   * — tapping a tile picks it immediately (no Add button, no exhibit-name
   * row), same as that component's own tap-to-place UX. Defaults to
   * "multi" so every existing exhibit-builder call site is unaffected. */
  mode?: "multi" | "single";
  /** Selection cap — MAX_EXHIBIT_ITEMS for the default multi-select
   * exhibit builder; 1 for a single museum placement slot. */
  maxItems?: number;
  /** Header label for single mode (e.g. "SPORTS — position 3") — ignored
   * in multi mode, which keeps its own editable exhibit-name row instead. */
  pickerTitle?: string;
  onConfirm: (ids: string[], title: string) => void;
  onClose: () => void;
}) {
  // Supplies (boxes, cases) are never shown publicly, so they cannot be picked. One already in an
  // exhibit is dropped when you confirm.
  const allItems = useMemo(() => everyItem.filter((item) => !isSupplyItem(item)), [everyItem]);
  const supplyIds = useMemo(
    () => new Set(everyItem.filter((item) => isSupplyItem(item)).map((item) => String(item.id))),
    [everyItem]
  );
  const [query, setQuery] = useState("");
  const [activeUniverses, setActiveUniverses] = useState<string[]>([]);
  const PAGE_SIZE = 120;
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  // Pick as many categories as you like; with none picked, everything shows.
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeSubs, setActiveSubs] = useState<string[]>([]);
  const pagesMode = mode !== "single" && !!(pages && pages.length > 0 && onConfirmPages);
  // One entry per exhibit page. Saved ids this device cannot show right now (not loaded here yet, or
  // deleted) sit in "hidden": they do not use up a slot and are kept when you confirm, never dropped.
  const [pageStates, setPageStates] = useState<PickerPageState[]>(() => {
    const known = new Set(allItems.map((item) => String(item.id)));
    const split = (ids: string[]) => ({
      picked: ids.filter((id) => known.has(String(id))),
      hidden: ids.filter((id) => !known.has(String(id)) && !supplyIds.has(String(id))),
    });
    if (pages && pages.length > 0 && onConfirmPages && mode !== "single") {
      return pages.map((page) => ({ id: page.id, title: page.title, ...split(page.itemIds) }));
    }
    return [{ id: "single", title: initialTitle || "Exhibit 1", ...split(confirmedIds) }];
  });
  const [activeIdx, setActiveIdx] = useState(() =>
    Math.min(Math.max(activePageIdx ?? 0, 0), Math.max(0, (pages?.length ?? 1) - 1))
  );
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [confirmNewPageFor, setConfirmNewPageFor] = useState<string | null>(null);
  const [moveNote, setMoveNote] = useState("");
  const [deletePageConfirm, setDeletePageConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!moveNote) return;
    const timer = window.setTimeout(() => setMoveNote(""), 3500);
    return () => window.clearTimeout(timer);
  }, [moveNote]);
  function deletePage(pageId: string) {
    const index = pageStates.findIndex((page) => page.id === pageId);
    if (index < 0 || pageStates.length <= 1) return;
    // Pages named "Exhibit 3" and so on keep counting in order; pages you named yourself keep their name.
    setPageStates((prev) =>
      prev
        .filter((page) => page.id !== pageId)
        .map((page, i) => (/^Exhibit\s+\d+$/i.test(page.title.trim()) ? { ...page, title: `Exhibit ${i + 1}` } : page))
    );
    setActiveIdx((current) => {
      if (index < current) return current - 1;
      if (index === current) return Math.max(0, Math.min(current, pageStates.length - 2));
      return current;
    });
    setDeletePageConfirm(null);
  }
  const activePage = pageStates[activeIdx] ?? pageStates[0];
  const picked = useMemo(() => new Set(activePage.picked), [activePage]);
  const hiddenIds = activePage.hidden;
  const hiddenCount = hiddenIds.length;
  // Items already on another page of this exhibition: one item, one page.
  const otherPageOf = useMemo(() => {
    const map = new Map<string, number>();
    pageStates.forEach((page, index) => {
      if (index === activeIdx) return;
      page.picked.forEach((id) => {
        if (!map.has(id)) map.set(id, index);
      });
    });
    return map;
  }, [pageStates, activeIdx]);
  function addPage(firstId?: string) {
    const newIndex = pageStates.length;
    setPageStates((prev) => [
      ...prev,
      { id: `new_${prev.length + 1}_${Date.now().toString(36)}`, title: `Exhibit ${prev.length + 1}`, picked: firstId ? [firstId] : [], hidden: [] },
    ]);
    setActiveIdx(newIndex);
    setPageMenuOpen(false);
    setConfirmNewPageFor(null);
  }
  const [sectionName, setSectionName] = useState(initialTitle || "Exhibit 1");
  const [mounted, setMounted] = useState(false);
  const isSingle = mode === "single";

  useEffect(() => { setMounted(true); }, []);

  const pickedCount = picked.size;
  const slotsLeft = maxItems - pickedCount;

  // Items inside the chosen universe(s): the category and subcategory rows are built from
  // what is really in the vault, so imported labels show up too.
  const inUniverse = useMemo(() => {
    const uSet = new Set(activeUniverses);
    return allItems.filter((item) => uSet.size === 0 || uSet.has(String(item.universe ?? "").toUpperCase()));
  }, [allItems, activeUniverses]);

  const categoryOptions = useMemo(() => {
    if (activeUniverses.length === 0) return [];
    return chipOptions(inUniverse.map(categoryOf));
  }, [inUniverse, activeUniverses]);

  const subOptions = useMemo(() => {
    if (activeCategories.length === 0) return [];
    return chipOptions(
      inUniverse.filter((i) => activeCategories.includes(chipKey(categoryOf(i)))).map(subcategoryOf)
    );
  }, [inUniverse, activeCategories]);

  useEffect(() => {
    setShownCount(PAGE_SIZE);
  }, [query, activeUniverses, activeCategories, activeSubs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inUniverse.filter((item) => {
      if (activeCategories.length > 0 && !activeCategories.includes(chipKey(categoryOf(item)))) return false;
      if (activeSubs.length > 0 && !activeSubs.includes(chipKey(subcategoryOf(item)))) return false;
      if (q && !searchText(item).includes(q)) return false;
      return true;
    });
  }, [inUniverse, query, activeCategories, activeSubs]);

  // Scroll lock on both html and body — prevents iOS bounce breaking inner scroll
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  function toggleItem(id: string) {
    if (isSingle) {
      // Single-select places immediately on tap — no pending selection, no
      // separate "Add" step, matching MuseumRoomItemPicker.tsx's own
      // tap-to-place UX exactly.
      onConfirm([id], sectionName);
      return;
    }
    if (activePage.picked.includes(id)) {
      setPageStates((prev) => prev.map((page, i) => (i === activeIdx ? { ...page, picked: page.picked.filter((x) => x !== id) } : page)));
      return;
    }
    if (otherPageOf.has(id)) return;
    if (activePage.picked.length >= maxItems) {
      if (pagesMode) {
        // This page holds 18: the item goes to the next page with room (later pages first, then earlier ones).
        const order = [
          ...pageStates.map((_, i) => i).filter((i) => i > activeIdx),
          ...pageStates.map((_, i) => i).filter((i) => i < activeIdx),
        ];
        const target = order.find((i) => pageStates[i].picked.length < maxItems);
        if (target !== undefined) {
          setPageStates((prev) => prev.map((page, i) => (i === target ? { ...page, picked: [...page.picked, id] } : page)));
          setMoveNote(`Page is full: added to #${target + 1} ${pageStates[target].title}`);
          return;
        }
        // Every page is full: ask before starting another page.
        setConfirmNewPageFor(id);
      }
      return;
    }
    setPageStates((prev) => prev.map((page, i) => (i === activeIdx ? { ...page, picked: [...page.picked, id] } : page)));
  }

  function toggleUniverse(u: string) {
    setActiveUniverses((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
    setActiveCategories([]);
    setActiveSubs([]);
  }

  function toggleCategory(key: string) {
    setActiveCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setActiveSubs([]);
  }

  const canClear = confirmedIds.length > 0;
  const totalPicked = pageStates.reduce((sum, page) => sum + page.picked.length, 0);
  const addLabel = pagesMode
    ? totalPicked > 0
      ? `Save (${totalPicked} item${totalPicked === 1 ? "" : "s"})`
      : canClear
        ? "Empty the exhibits"
        : "Select items to add"
    : pickedCount > 0
      ? ("Add to Exhibit (" + pickedCount + ")")
      : canClear
        ? "Empty this exhibit"
        : "Select items to add";

  const slotLabel = slotsLeft === 0
    ? `Exhibit is full (${maxItems} items max). Tap a picked item to remove it and make room.`
    : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining") +
      (hiddenCount > 0 ? ` (${hiddenCount} saved item${hiddenCount === 1 ? "" : "s"} not shown on this device are kept and not counted)` : "");

  const isAtMax = pickedCount >= maxItems;

  // Single max-width column so this reads as a contained sheet, not a full-bleed
  // takeover on wide screens — same content-width convention used in the builder.
  const stageStyle: React.CSSProperties = { marginLeft: "auto", marginRight: "auto", width: "100%", maxWidth: 640 };

  const overlay = (
    <div
      className="vltd-dark-surface"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9000,
        background: "#080C14",
        display: "flex",
        flexDirection: "column",
        overflowY: "hidden",
      }}
    >
      {/* ── Row 1: Close + Search + Counter ── */}
      <div
        style={{
          ...stageStyle,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "max(env(safe-area-inset-top, 0px), 12px) 14px 10px",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close picker"
          title="Close without changing anything"
          className="!rounded-full transition hover:opacity-80"
          style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.08)", boxShadow: "none", color: "#fff", cursor: "pointer" }}
        >
          <AppIcon name="close" strokeWidth={1.8} size={15} />
        </button>

        <div style={{ position: "relative", flex: 1 }}>
          <AppIcon name="search" strokeWidth={1.8} size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            className="bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition focus:ring-[color:var(--pill-active-ring)] placeholder:text-[color:var(--muted)]"
            style={{ width: "100%", borderRadius: 999, padding: "7px 14px 7px 32px", fontSize: 13, outline: "none", boxSizing: "border-box", border: "none" }}
          />
        </div>

        {isSingle ? (
          pickerTitle ? (
            <div style={{ minWidth: 0, maxWidth: 160, flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>Place item</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pickerTitle}</div>
            </div>
          ) : null
        ) : (
          <div
            className={isAtMax ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-ring)]" : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"}
            style={{ flexShrink: 0, borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
          >
            {pickedCount}/{maxItems}
          </div>
        )}
      </div>

      {/* ── Row 2: Exhibit name — multi-select (exhibit builder) only. Single
          mode has no exhibit to name; it's placing one item into one slot. */}
      {isSingle ? null : (
        <div
          style={{
            ...stageStyle,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px 10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase", flexShrink: 0 }}>
            EXHIBIT
          </div>
          {pagesMode ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setPageMenuOpen((open) => !open)}
                aria-expanded={pageMenuOpen}
                aria-label="Choose which exhibit page to add items to"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 230, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.08)", color: "#fff", cursor: "pointer" }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`#${activeIdx + 1} ${activePage.title}`}</span>
                <AppIcon name="chevronDown" size={12} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              </button>
              {pageMenuOpen ? (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, minWidth: 210, borderRadius: 12, background: "#111827", border: "1px solid rgba(255,255,255,0.18)", padding: 4, boxShadow: "0 18px 40px rgba(0,0,0,0.55)" }}>
                  {pageStates.map((page, index) => (
                    <div key={page.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveIdx(index);
                          setPageMenuOpen(false);
                        }}
                        style={{ display: "flex", flex: 1, minWidth: 0, justifyContent: "space-between", gap: 14, textAlign: "left", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", border: "none", cursor: "pointer", background: index === activeIdx ? "rgba(79,211,238,0.22)" : "transparent" }}
                      >
                        <span>{`#${index + 1} ${page.title}`}</span>
                        <span style={{ opacity: 0.6 }}>{page.picked.length}</span>
                      </button>
                      {pageStates.length > 1 ? (
                        deletePageConfirm === page.id ? (
                          <button
                            type="button"
                            onClick={() => deletePage(page.id)}
                            style={{ flexShrink: 0, borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff", background: "#dc2626", border: "none", cursor: "pointer" }}
                          >
                            Delete?
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Delete exhibit page ${index + 1}`}
                            title="Delete this exhibit page"
                            onClick={() => (page.picked.length > 0 ? setDeletePageConfirm(page.id) : deletePage(page.id))}
                            style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, fontSize: 15, lineHeight: "18px", fontWeight: 900, color: "#f87171", background: "rgba(248,113,113,0.12)", border: "none", cursor: "pointer" }}
                          >
                            −
                          </button>
                        )
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPage()}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#67E8F9", border: "none", cursor: "pointer", background: "transparent" }}
                  >
                    + New exhibit page
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="Exhibit 1"
              maxLength={40}
              className="text-[color:var(--fg)] transition"
              style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid var(--border)", borderRadius: 0, padding: "3px 2px", fontSize: 13, fontWeight: 600, outline: "none" }}
            />
          )}
        </div>
      )}

      {/* ── Row 3: Universe filter chips — same shared toggle-pill system, same glow ── */}
      <div
        style={{
          ...stageStyle,
          flexShrink: 0,
          display: "flex",
          gap: 6,
          padding: "8px 14px",
          borderBottom: "1px solid var(--divider)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {UNIVERSE_KEYS.map((u) => {
          const active = activeUniverses.includes(u);
          return (
            <button
              key={u}
              type="button"
              onClick={() => toggleUniverse(u)}
              aria-pressed={active}
              className={[
                "vltd-selectable transition",
                active
                  ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                  : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]",
              ].join(" ")}
              style={{ flexShrink: 0, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", border: "none", cursor: "pointer" }}
            >
              {chipLabel(u)}
            </button>
          );
        })}
      </div>

      {categoryOptions.length > 0 && (
        <div
          style={{
            ...stageStyle,
            flexShrink: 0,
            display: "flex",
            gap: 6,
            padding: "6px 14px",
            borderBottom: "1px solid var(--divider)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties}
        >
          {categoryOptions.map((option) => {
            const active = activeCategories.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleCategory(option.key)}
                aria-pressed={active}
                className={[
                  "vltd-selectable transition",
                  active
                    ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]",
                ].join(" ")}
                style={{ flexShrink: 0, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {subOptions.length > 0 && (
        <div
          style={{
            ...stageStyle,
            flexShrink: 0,
            display: "flex",
            gap: 6,
            padding: "6px 14px",
            borderBottom: "1px solid var(--divider)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties}
        >
          {subOptions.map((option) => {
            const active = activeSubs.includes(option.key);
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveSubs((prev) => (prev.includes(option.key) ? prev.filter((k) => k !== option.key) : [...prev, option.key]))}
                aria-pressed={active}
                className={[
                  "vltd-selectable transition",
                  active
                    ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]",
                ].join(" ")}
                style={{ flexShrink: 0, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "0.02em", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Photo grid ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div style={stageStyle}>
          {filtered.length === 0 ? (
            <div style={{ display: "flex", height: 160, alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--muted)" }}>
              No items matched.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 6 }}>
              {filtered.slice(0, shownCount).map((item) => {
                const isSelected = !isSingle && picked.has(item.id);
                const elsewhere = otherPageOf.get(item.id);
                const canPick = isSingle || isSelected || (elsewhere === undefined && (pickedCount < maxItems || pagesMode));
                const img = itemImage(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => canPick && toggleItem(item.id)}
                    aria-pressed={isSelected}
                    aria-label={item.title}
                    className={["vltd-selectable transition", isSelected ? "vltd-selected ring-[color:var(--pill-active-ring)]" : "ring-1 ring-[color:var(--border)]"].join(" ")}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      aspectRatio: "3 / 4",
                      borderRadius: 10,
                      opacity: !canPick ? 0.35 : 1,
                      border: "none",
                      cursor: canPick ? "pointer" : "default",
                      padding: 0,
                      background: "var(--pill)",
                    }}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={item.title}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        draggable={false}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--muted)", background: "var(--surface)" }}>
                        {"—"}
                      </div>
                    )}

                    {elsewhere !== undefined ? (
                      <div
                        style={{ position: "absolute", top: 6, left: 6, right: 6, zIndex: 2, borderRadius: 999, background: "rgba(0,0,0,0.72)", padding: "2px 7px", fontSize: 9, fontWeight: 700, color: "#fff", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pointerEvents: "none" }}
                      >
                        {`On #${elsewhere + 1} ${pageStates[elsewhere]?.title ?? ""}`}
                      </div>
                    ) : null}

                    {/* Item name */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: "10px 5px 4px",
                        background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 70%)",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          lineHeight: 1.2,
                          fontWeight: 600,
                          color: "#fff",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          textAlign: "left",
                        }}
                      >
                        {item.title}
                      </div>
                    </div>

                    {/* Selection circle: centred on the photo, same as the Vault page. Single-select
                        (museum placement) confirms on tap, so no pending state to show. */}
                    {isSingle ? null : (
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isSelected ? "rgba(203,208,213,0.18)" : "rgba(0,0,0,0.04)",
                          pointerEvents: "none",
                        }}
                      >
                        <SelectCircle selected={isSelected} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {filtered.length > shownCount ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 6px 14px" }}>
              <button
                type="button"
                onClick={() => setShownCount((count) => count + PAGE_SIZE)}
                className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                style={{ borderRadius: 999, padding: "8px 18px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}
              >
                Show {Math.min(PAGE_SIZE, filtered.length - shownCount)} more ({shownCount} of {filtered.length})
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {confirmNewPageFor ? (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.6)" }}
          onClick={() => setConfirmNewPageFor(null)}
        >
          <div
            role="dialog"
            aria-label="Start a new exhibit page"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, borderRadius: 16, background: "#111827", border: "1px solid rgba(255,255,255,0.18)", padding: 16, color: "#fff" }}
          >
            <div style={{ fontSize: 14, fontWeight: 700 }}>This page is full ({maxItems} items)</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.75)" }}>
              If you add more, it will start a new Exhibit page. Continue?
            </div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmNewPageFor(null)}
                style={{ borderRadius: 999, padding: "7px 16px", fontSize: 12, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => addPage(confirmNewPageFor)}
                style={{ borderRadius: 999, padding: "7px 16px", fontSize: 12, fontWeight: 700, color: "#fff", background: "rgba(79,211,238,0.3)", border: "1px solid rgba(79,211,238,0.6)", cursor: "pointer" }}
              >
                Yes, start a new page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Footer — multi-select only. Single-select confirms on tap
          (see toggleItem above), so there's nothing to add or confirm. */}
      {isSingle ? null : (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 14px max(env(safe-area-inset-bottom, 0px), 14px)",
            borderTop: "1px solid rgba(255,255,255,0.14)",
            background: "#0B111C",
          }}
        >
          <div style={stageStyle}>
            {slotsLeft < maxItems && !pagesMode && (
              <div style={{ marginBottom: 8, textAlign: "center", fontSize: 11, color: slotsLeft === 0 ? "var(--fg)" : "var(--muted)" }}>
                {moveNote || slotLabel}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (pagesMode && onConfirmPages) {
                  onConfirmPages(pageStates.map((page) => ({ id: page.id, title: page.title, itemIds: [...page.picked, ...page.hidden] })));
                } else {
                  onConfirm([...Array.from(picked), ...hiddenIds], sectionName);
                }
              }}
              disabled={pagesMode ? totalPicked === 0 && !canClear : pickedCount === 0 && !canClear}
              className={["vltd-pill-main-glow transition", (pagesMode ? totalPicked > 0 : pickedCount > 0) || canClear ? "bg-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)]"].join(" ")}
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "14px 0",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.05em",
                border: "none",
                color: "#fff",
                cursor: (pagesMode ? totalPicked > 0 : pickedCount > 0) || canClear ? "pointer" : "default",
                opacity: (pagesMode ? totalPicked === 0 : pickedCount === 0) && !canClear ? 0.45 : 1,
              }}
            >
              {addLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
