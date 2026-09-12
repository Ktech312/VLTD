"use client";

// Shared Museum Room Editor pass (2026-09-12): the item picker for the new
// in-3D room editor's numbered "+" control. Single-select (one item per
// placement slot) rather than ItemPickerSheet.tsx's own multi-select
// exhibit-builder flow, but deliberately sources from the SAME real vault
// item lookup that component and the personal Gallery's own Organize
// overlay already use — loadItems() from vaultModel.ts — per the work
// order's "do not build a second, parallel item source."
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { loadItems, getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

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

export default function MuseumRoomItemPicker({
  title,
  onPick,
  onClose,
}: {
  /** e.g. "Position 3 — SPORTS south wall" — shown in the header so the
   * admin knows exactly which slot they're filling. */
  title: string;
  onPick: (item: { title: string; image_url: string }) => void;
  onClose: () => void;
}) {
  const [allItems, setAllItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeUniverses, setActiveUniverses] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAllItems(loadItems());
  }, []);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const uSet = new Set(activeUniverses);
    return allItems.filter((item) => {
      if (!getPrimaryImageUrl(item)) return false;
      if (uSet.size > 0 && !uSet.has(String(item.universe ?? "").toUpperCase())) return false;
      if (q && !searchText(item).includes(q)) return false;
      return true;
    });
  }, [allItems, query, activeUniverses]);

  function toggleUniverse(u: string) {
    setActiveUniverses((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  }

  const stageStyle: React.CSSProperties = { marginLeft: "auto", marginRight: "auto", width: "100%", maxWidth: 640 };

  const overlay = (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9200,
        background: "#080C14", display: "flex", flexDirection: "column", overflowY: "hidden",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div style={{ ...stageStyle, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(env(safe-area-inset-top, 0px), 12px) 14px 10px" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close item picker"
          className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition"
          style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 15, height: 15 }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>Place item</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        </div>
      </div>

      <div style={{ ...stageStyle, flexShrink: 0, padding: "0 14px 10px" }}>
        <div style={{ position: "relative" }}>
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
      </div>

      <div style={{ ...stageStyle, flexShrink: 0, display: "flex", gap: 6, padding: "0 14px 8px", overflowX: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {UNIVERSE_KEYS.map((u) => {
          const active = activeUniverses.includes(u);
          return (
            <button
              key={u}
              type="button"
              onClick={() => toggleUniverse(u)}
              aria-pressed={active}
              className={["vltd-selectable transition", active ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]" : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"].join(" ")}
              style={{ flexShrink: 0, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              {chipLabel(u)}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "scroll", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div style={stageStyle}>
          {allItems.length === 0 ? (
            <div style={{ display: "flex", height: 160, alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--muted)", textAlign: "center", padding: "0 24px" }}>
              No vault items with a photo yet — add one to your vault first.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: "flex", height: 160, alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--muted)" }}>
              No items matched.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, padding: 6 }}>
              {filtered.map((item) => {
                const img = getPrimaryImageUrl(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => img && onPick({ title: item.title, image_url: img })}
                    aria-label={`Place ${item.title}`}
                    className="vltd-selectable transition ring-1 ring-[color:var(--border)]"
                    style={{ position: "relative", overflow: "hidden", aspectRatio: "3 / 4", borderRadius: 10, border: "none", cursor: "pointer", padding: 0, background: "var(--pill)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} draggable={false} />
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 5px 4px", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.82) 70%)", pointerEvents: "none" }}>
                      <div style={{ fontSize: 10, lineHeight: 1.2, fontWeight: 600, color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "left" }}>
                        {item.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
