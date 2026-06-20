"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_KEYS } from "@/lib/taxonomy";

export const MAX_EXHIBIT_ITEMS = 16;

// Shortened labels so all 7 chips fit on one line
const CHIP_LABEL: Record<string, string> = {
  POP_CULTURE: "Pop Culture",
  SPORTS: "Sports",
  TCG: "TCG",
  MUSIC: "Music",
  JEWELRY_APPAREL: "Jewelry",
  GAMES: "Games",
  MISC: "Misc",
};

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
  const [sectionName, setSectionName] = useState(initialTitle || "Section 1");
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
    ? ("Add to Gallery (" + pickedCount + ")")
    : "Select items to add";

  const slotLabel = slotsLeft === 0
    ? "Gallery is full (16 items max)"
    : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining");

  const isAtMax = pickedCount >= MAX_EXHIBIT_ITEMS;

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
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "max(env(safe-area-inset-top, 0px), 12px) 14px 10px",
          borderBottom: "none",
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Close picker"
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 15, height: 15, color: "var(--muted)" }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* Search */}
        <div style={{ position: "relative", flex: 1 }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          >
            <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            style={{
              width: "100%",
              borderRadius: 999,
              padding: "7px 14px 7px 32px",
              fontSize: 13,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "var(--fg)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Counter badge */}
        <div
          style={{
            flexShrink: 0,
            borderRadius: 999,
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            background: isAtMax ? "rgba(245,181,72,0.15)" : "rgba(255,255,255,0.07)",
            color: isAtMax ? "#F5B548" : "var(--muted)",
            border: "1px solid " + (isAtMax ? "rgba(245,181,72,0.3)" : "rgba(255,255,255,0.09)"),
            whiteSpace: "nowrap",
          }}
        >
          {pickedCount}/{MAX_EXHIBIT_ITEMS}
        </div>
      </div>

      {/* ── Row 2: Section Name + Save ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "var(--muted)",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          SECTION
        </div>

        {/* Section name input */}
        <input
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="Section 1"
          maxLength={40}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 0,
            padding: "3px 2px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg)",
            outline: "none",
          }}
        />

        {/* Small Save button */}
        <button
          type="button"
          onClick={() => pickedCount > 0 && onConfirm(Array.from(picked), sectionName)}
          disabled={pickedCount === 0}
          style={{
            flexShrink: 0,
            borderRadius: 999,
            padding: "5px 14px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            border: "1px solid " + (pickedCount > 0 ? "rgba(245,181,72,0.5)" : "rgba(255,255,255,0.09)"),
            cursor: pickedCount > 0 ? "pointer" : "default",
            opacity: pickedCount === 0 ? 0.4 : 1,
            background: pickedCount > 0 ? "rgba(245,181,72,0.12)" : "transparent",
            color: pickedCount > 0 ? "#F5B548" : "var(--muted)",
          }}
        >
          Save
        </button>
      </div>

      {/* ── Row 3: Universe filter chips — compact, single line ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 6,
          padding: "8px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {UNIVERSE_KEYS.map((u) => {
          const active = activeUniverses.includes(u);
          const label = CHIP_LABEL[u] || u;
          return (
            <button
              key={u}
              type="button"
              onClick={() => toggleUniverse(u)}
              style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: active ? "rgba(245,181,72,0.18)" : "rgba(255,255,255,0.07)",
                color: active ? "#F5B548" : "var(--muted)",
                outline: active ? "1px solid rgba(245,181,72,0.4)" : "1px solid rgba(255,255,255,0.09)",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Photo grid ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "scroll",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              height: 160,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            No items matched.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 2,
              padding: 2,
            }}
          >
            {filtered.map((item) => {
              const isSelected = picked.has(item.id);
              const canPick = isSelected || pickedCount < MAX_EXHIBIT_ITEMS;
              const img = itemImage(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => canPick && toggleItem(item.id)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    aspectRatio: "3 / 4",
                    opacity: !canPick ? 0.35 : 1,
                    border: "none",
                    cursor: canPick ? "pointer" : "default",
                    padding: 0,
                    background: "rgba(255,255,255,0.04)",
                  }}
                  aria-pressed={isSelected}
                  aria-label={item.title}
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
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      {"—"}
                    </div>
                  )}

                  {/* Gold selection glow */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        boxShadow: "inset 0 0 0 3px #F5B548, inset 0 0 18px rgba(245,181,72,0.22)",
                      }}
                    />
                  )}

                  {/* Selection circle */}
                  <div
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
                      background: isSelected ? "#F5B548" : "rgba(0,0,0,0.50)",
                      boxShadow: isSelected
                        ? "0 0 0 2px rgba(255,255,255,0.85), 0 0 10px rgba(245,181,72,0.7)"
                        : "0 0 0 1.5px rgba(255,255,255,0.55)",
                    }}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 20 20" fill="none" style={{ width: 13, height: 13 }}>
                        <path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="#1A0F00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 14px max(env(safe-area-inset-bottom, 0px), 14px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,12,20,0.97)",
        }}
      >
        {slotsLeft < MAX_EXHIBIT_ITEMS && (
          <div
            style={{
              marginBottom: 8,
              textAlign: "center",
              fontSize: 11,
              color: slotsLeft === 0 ? "#F5B548" : "var(--muted)",
            }}
          >
            {slotLabel}
          </div>
        )}
        <button
          type="button"
          onClick={() => onConfirm(Array.from(picked), sectionName)}
          disabled={pickedCount === 0}
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
            background: pickedCount > 0
              ? "linear-gradient(135deg, #FFE08A 0%, #F5B548 40%, #C8941F 100%)"
              : "rgba(255,255,255,0.07)",
            color: pickedCount > 0 ? "#1A0F00" : "var(--muted)",
            boxShadow: pickedCount > 0
              ? "0 0 0 1px rgba(245,181,72,0.35), 0 8px 28px rgba(245,181,72,0.3)"
              : "none",
          }}
        >
          {addLabel}
        </button>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
