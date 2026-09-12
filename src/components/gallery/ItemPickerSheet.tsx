"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export const MAX_EXHIBIT_ITEMS = 16;

// Shortened labels so chips fit on one line. Anything not listed here falls back
// to the canonical UNIVERSE_LABEL from taxonomy.ts, so a newly added universe
// never shows up as a raw enum key (e.g. "BUILT_BOTANY").
const CHIP_LABEL_OVERRIDE: Partial<Record<UniverseKey, string>> = {
  JEWELRY_APPAREL: "Jewelry",
};

function chipLabel(u: UniverseKey) {
  return CHIP_LABEL_OVERRIDE[u] ?? UNIVERSE_LABEL[u] ?? u;
}

function searchText(i: VaultItem) {
  return [i.title, i.subtitle, i.number, i.grade, i.notes, i.category, i.universe]
    .filter(Boolean).join(" ").toLowerCase();
}

function itemImage(i: VaultItem) {
  return i.imageFrontUrl || i.imageBackUrl || "";
}

export function ItemPickerSheet({
  allItems,
  confirmedIds,
  sectionTitle: initialTitle,
  mode = "multi",
  maxItems = MAX_EXHIBIT_ITEMS,
  pickerTitle,
  onConfirm,
  onClose,
}: {
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
  const [query, setQuery] = useState("");
  const [activeUniverses, setActiveUniverses] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set(confirmedIds));
  const [sectionName, setSectionName] = useState(initialTitle || "Exhibit 1");
  const [mounted, setMounted] = useState(false);
  const isSingle = mode === "single";

  useEffect(() => { setMounted(true); }, []);

  const pickedCount = picked.size;
  const slotsLeft = maxItems - pickedCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const uSet = new Set(activeUniverses);
    return allItems.filter((item) => {
      if (uSet.size > 0 && !uSet.has(String(item.universe ?? "").toUpperCase())) return false;
      if (q && !searchText(item).includes(q)) return false;
      return true;
    });
  }, [allItems, query, activeUniverses]);

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
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxItems) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function toggleUniverse(u: string) {
    setActiveUniverses((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  }

  const addLabel = pickedCount > 0
    ? ("Add to Exhibit (" + pickedCount + ")")
    : "Select items to add";

  const slotLabel = slotsLeft === 0
    ? `Exhibit is full (${maxItems} items max)`
    : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining");

  const isAtMax = pickedCount >= maxItems;

  // Single max-width column so this reads as a contained sheet, not a full-bleed
  // takeover on wide screens — same content-width convention used in the builder.
  const stageStyle: React.CSSProperties = { marginLeft: "auto", marginRight: "auto", width: "100%", maxWidth: 640 };

  const overlay = (
    <div
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
          className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition"
          style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 15, height: 15 }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div style={{ position: "relative", flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, pointerEvents: "none", color: "var(--muted)" }}>
            <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
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
          <input
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="Exhibit 1"
            maxLength={40}
            className="text-[color:var(--fg)] transition"
            style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid var(--border)", borderRadius: 0, padding: "3px 2px", fontSize: 13, fontWeight: 600, outline: "none" }}
          />
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

      {/* ── Photo grid ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div style={stageStyle}>
          {filtered.length === 0 ? (
            <div style={{ display: "flex", height: 160, alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--muted)" }}>
              No items matched.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 6 }}>
              {filtered.map((item) => {
                const isSelected = !isSingle && picked.has(item.id);
                const canPick = isSingle || isSelected || pickedCount < maxItems;
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
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        draggable={false}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--muted)", background: "var(--surface)" }}>
                        {"—"}
                      </div>
                    )}

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

                    {/* Selection circle — multi-select only. Single-select
                        (museum placement) confirms on tap, so there's no
                        pending-selection state to show. */}
                    {isSingle ? null : (
                      <div
                        className={isSelected ? "bg-[color:var(--pill-active-bg)]" : ""}
                        style={{
                          position: "absolute",
                          right: 5,
                          top: 5,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isSelected ? undefined : "rgba(0,0,0,0.50)",
                          boxShadow: isSelected
                            ? "0 0 0 2px var(--pill-active-ring)"
                            : "0 0 0 1.5px rgba(255,255,255,0.55)",
                        }}
                      >
                        {isSelected && (
                          <svg viewBox="0 0 20 20" fill="none" style={{ width: 13, height: 13, color: "var(--fg)" }}>
                            <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer — multi-select only. Single-select confirms on tap
          (see toggleItem above), so there's nothing to add or confirm. */}
      {isSingle ? null : (
        <div
          style={{
            flexShrink: 0,
            padding: "10px 14px max(env(safe-area-inset-bottom, 0px), 14px)",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={stageStyle}>
            {slotsLeft < maxItems && (
              <div style={{ marginBottom: 8, textAlign: "center", fontSize: 11, color: slotsLeft === 0 ? "var(--fg)" : "var(--muted)" }}>
                {slotLabel}
              </div>
            )}
            <button
              type="button"
              onClick={() => onConfirm(Array.from(picked), sectionName)}
              disabled={pickedCount === 0}
              className={["vltd-pill-main-glow transition", pickedCount > 0 ? "bg-[color:var(--pill-active-bg)]" : "bg-[color:var(--pill)]"].join(" ")}
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "14px 0",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: "0.05em",
                border: "none",
                cursor: pickedCount > 0 ? "pointer" : "default",
                opacity: pickedCount === 0 ? 0.35 : 1,
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
