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
  onConfirm,
  onClose,
}: {
  allItems: VaultItem[];
  confirmedIds: string[];
  sectionTitle?: string;
  onConfirm: (ids: string[], title: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeUniverses, setActiveUniverses] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set(confirmedIds));
  const [sectionName, setSectionName] = useState(initialTitle || "Exhibit 1");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const pickedCount = picked.size;
  const slotsLeft = MAX_EXHIBIT_ITEMS - pickedCount;

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
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_EXHIBIT_ITEMS) return prev;
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
    ? "Exhibit is full (16 items max)"
    : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining");

  const isAtMax = pickedCount >= MAX_EXHIBIT_ITEMS;

  // Single max-width column so this reads as a contained sheet, not a full-bleed
  // takeover on wide screens — same content-width convention used elsewhere in
  // the gallery builder (GALLERY_STAGE_WIDTH_CLASS).
  const STAGE_WIDTH_CLASS = "mx-auto w-full max-w-[640px]";

  const overlay = (
    <div className="fixed inset-0 z-[9000] flex flex-col bg-[#080C14]">
      {/* ── Row 1: Close + Search + Counter ── */}
      <div
        className={[STAGE_WIDTH_CLASS, "flex shrink-0 items-center gap-2 px-3.5 pb-2.5"].join(" ")}
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close picker"
          className="vltd-selectable flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-[15px] w-[15px]">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--muted)]">
            <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            className="w-full rounded-full bg-[color:var(--pill)] py-[7px] pl-8 pr-3.5 text-[13px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] outline-none transition focus:ring-[color:var(--pill-active-ring)] placeholder:text-[color:var(--muted)]"
          />
        </div>

        <div
          className={[
            "shrink-0 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11px] font-bold tabular-nums ring-1",
            isAtMax
              ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)]"
              : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]",
          ].join(" ")}
        >
          {pickedCount}/{MAX_EXHIBIT_ITEMS}
        </div>
      </div>

      {/* ── Row 2: Exhibit name ── */}
      <div
        className={[STAGE_WIDTH_CLASS, "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-3.5 pb-2.5"].join(" ")}
      >
        <div className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          EXHIBIT
        </div>
        <input
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="Exhibit 1"
          maxLength={40}
          className="flex-1 border-b border-[color:var(--border)] bg-transparent px-0.5 py-[3px] text-[13px] font-semibold text-[color:var(--fg)] outline-none transition focus:border-[color:var(--pill-active-ring)]"
        />
      </div>

      {/* ── Row 3: Universe filter chips — same shared toggle-pill system, same glow ── */}
      <div
        className={[STAGE_WIDTH_CLASS, "flex shrink-0 gap-1.5 overflow-x-auto border-b border-[color:var(--divider)] px-3.5 py-2"].join(" ")}
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
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
                "vltd-selectable shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-bold tracking-[0.02em] ring-1 transition",
                active
                  ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                  : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
              ].join(" ")}
            >
              {chipLabel(u)}
            </button>
          );
        })}
      </div>

      {/* ── Photo grid ── */}
      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div className={STAGE_WIDTH_CLASS}>
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-[13px] text-[color:var(--muted)]">
              No items matched.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 p-1.5">
              {filtered.map((item) => {
                const isSelected = picked.has(item.id);
                const canPick = isSelected || pickedCount < MAX_EXHIBIT_ITEMS;
                const img = itemImage(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => canPick && toggleItem(item.id)}
                    aria-pressed={isSelected}
                    aria-label={item.title}
                    className={[
                      "vltd-selectable relative aspect-[3/4] overflow-hidden rounded-[10px] bg-[color:var(--pill)] p-0 ring-1 transition",
                      !canPick ? "opacity-35" : "",
                      isSelected
                        ? "vltd-selected ring-[color:var(--pill-active-ring)]"
                        : "ring-[color:var(--border)]",
                    ].join(" ")}
                    style={{ cursor: canPick ? "pointer" : "default" }}
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
                      <div className="flex h-full w-full items-center justify-center bg-[color:var(--surface)] text-[10px] text-[color:var(--muted)]">
                        {"—"}
                      </div>
                    )}

                    {/* Selection circle */}
                    <div
                      className={[
                        "absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-2",
                        isSelected
                          ? "bg-[color:var(--pill-active-bg)] ring-[color:var(--pill-active-ring)]"
                          : "bg-black/50 ring-white/55",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 20 20" fill="none" className="h-[13px] w-[13px] text-[color:var(--fg)]">
                          <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 pt-2.5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 14px)" }}
      >
        <div className={STAGE_WIDTH_CLASS}>
          {slotsLeft < MAX_EXHIBIT_ITEMS && (
            <div
              className={[
                "mb-2 text-center text-[11px]",
                slotsLeft === 0 ? "text-[color:var(--fg)]" : "text-[color:var(--muted)]",
              ].join(" ")}
            >
              {slotLabel}
            </div>
          )}
          <button
            type="button"
            onClick={() => onConfirm(Array.from(picked), sectionName)}
            disabled={pickedCount === 0}
            className={[
              "vltd-pill-main-glow w-full rounded-full py-3.5 text-[14px] font-extrabold tracking-[0.05em] transition disabled:opacity-35",
              pickedCount > 0
                ? "bg-[color:var(--pill-active-bg)]"
                : "bg-[color:var(--pill)]",
            ].join(" ")}
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
