"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";

export const MAX_EXHIBIT_ITEMS = 16;

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
  onConfirm,
  onClose,
}: {
  allItems: VaultItem[];
  confirmedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeUniverses, setActiveUniverses] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set(confirmedIds));
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

  // Scroll lock — overflow:hidden on both html and body avoids iOS bounce + broken inner scroll
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
    ? ("Add to Exhibition  (" + pickedCount + ")")
    : "Select items to add";
  const slotLabel = slotsLeft === 0
    ? "Exhibition is full (16 items max)"
    : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining");

  // Overlay uses explicit inline styles — avoids any Tailwind class resolution issues
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
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "max(env(safe-area-inset-top, 0px), 14px) 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
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
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 16, height: 16, color: "var(--muted)" }}>
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
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
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
              padding: "8px 16px 8px 38px",
              fontSize: 14,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "var(--fg)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Counter */}
        <div
          style={{
            flexShrink: 0,
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            background: pickedCount >= MAX_EXHIBIT_ITEMS ? "rgba(245,181,72,0.15)" : "rgba(255,255,255,0.07)",
            color: pickedCount >= MAX_EXHIBIT_ITEMS ? "#F5B548" : "var(--muted)",
            border: "1px solid " + (pickedCount >= MAX_EXHIBIT_ITEMS ? "rgba(245,181,72,0.3)" : "rgba(255,255,255,0.09)"),
          }}
        >
          {pickedCount}/{MAX_EXHIBIT_ITEMS}
        </div>
      </div>

      {/* ── Category filter chips ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 8,
          overflowX: "auto",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
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
              style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: active ? "rgba(245,181,72,0.18)" : "rgba(255,255,255,0.07)",
                color: active ? "#F5B548" : "var(--muted)",
                outline: active ? "1px solid rgba(245,181,72,0.4)" : "1px solid rgba(255,255,255,0.09)",
              }}
            >
              {UNIVERSE_LABEL[u]}
            </button>
          );
        })}
      </div>

      {/* ── Photo grid — flex-1 + explicit min-height so overflow-y actually scrolls ── */}
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
              height: 192,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
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
                      right: 6,
                      top: 6,
                      width: 24,
                      height: 24,
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
                      <svg viewBox="0 0 20 20" fill="none" style={{ width: 14, height: 14 }}>
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
          padding: "12px 16px max(env(safe-area-inset-bottom, 0px), 16px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,12,20,0.97)",
        }}
      >
        {slotsLeft < MAX_EXHIBIT_ITEMS && (
          <div
            style={{
              marginBottom: 8,
              textAlign: "center",
              fontSize: 12,
              color: slotsLeft === 0 ? "#F5B548" : "var(--muted)",
            }}
          >
            {slotLabel}
          </div>
        )}
        <button
          type="button"
          onClick={() => onConfirm(Array.from(picked))}
          disabled={pickedCount === 0}
          style={{
            width: "100%",
            borderRadius: 999,
            padding: "15px 0",
            fontSize: 15,
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
