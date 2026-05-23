"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type VaultItem } from "@/lib/vaultModel";

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
  const [picked, setPicked] = useState<Set<string>>(new Set(confirmedIds));

  const pickedCount = picked.size;
  const slotsLeft = MAX_EXHIBIT_ITEMS - pickedCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => searchText(item).includes(q));
  }, [allItems, query]);

  // Scroll lock: overflow:hidden avoids the iOS position:fixed jump + broken inner scroll
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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

  if (typeof document === "undefined") return null;

  const addLabel = pickedCount > 0 ? ("Add to Exhibition  (" + pickedCount + ")") : "Select items to add";
  const slotLabel = slotsLeft === 0 ? "Exhibition is full (16 items max)" : (slotsLeft + " slot" + (slotsLeft === 1 ? "" : "s") + " remaining");

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: "#080C14", height: "100dvh" }}
    >

      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-4 pb-3"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:opacity-70"
          style={{ background: "rgba(255,255,255,0.07)" }}
          aria-label="Close picker"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-[color:var(--muted)]">
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }}>
            <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault..."
            className="w-full rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "var(--fg)",
            }}
          />
        </div>

        <div
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums"
          style={{
            background: pickedCount >= MAX_EXHIBIT_ITEMS ? "rgba(245,181,72,0.15)" : "rgba(255,255,255,0.07)",
            color: pickedCount >= MAX_EXHIBIT_ITEMS ? "#F5B548" : "var(--muted)",
            border: "1px solid " + (pickedCount >= MAX_EXHIBIT_ITEMS ? "rgba(245,181,72,0.3)" : "rgba(255,255,255,0.09)"),
          }}
        >
          {pickedCount}/{MAX_EXHIBIT_ITEMS}
        </div>
      </div>

      {/* Photo grid — min-h-0 forces flex child to honour overflow-y-auto on mobile */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
            No items matched your search.
          </div>
        ) : (
          <div className="grid gap-[2px] p-[2px]" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {filtered.map((item) => {
              const isSelected = picked.has(item.id);
              const canPick = isSelected || pickedCount < MAX_EXHIBIT_ITEMS;
              const img = itemImage(item);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => canPick && toggleItem(item.id)}
                  className="relative overflow-hidden transition active:opacity-75"
                  style={{ aspectRatio: "3/4", opacity: !canPick ? 0.35 : 1 }}
                  aria-pressed={isSelected}
                  aria-label={item.title}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={item.title} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-[10px]"
                      style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}
                    >
                      {"—"}
                    </div>
                  )}

                  {isSelected && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ boxShadow: "inset 0 0 0 3px #F5B548, inset 0 0 18px rgba(245,181,72,0.22)" }}
                    />
                  )}

                  <div
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition"
                    style={{
                      background: isSelected ? "#F5B548" : "rgba(0,0,0,0.50)",
                      boxShadow: isSelected
                        ? "0 0 0 2px rgba(255,255,255,0.85), 0 0 10px rgba(245,181,72,0.7)"
                        : "0 0 0 1.5px rgba(255,255,255,0.55)",
                    }}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
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

      {/* Footer */}
      <div
        className="shrink-0 px-4 pt-3"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(8,12,20,0.97)",
        }}
      >
        {slotsLeft < MAX_EXHIBIT_ITEMS && (
          <div className="mb-2 text-center text-xs" style={{ color: slotsLeft === 0 ? "#F5B548" : "var(--muted)" }}>
            {slotLabel}
          </div>
        )}
        <button
          type="button"
          onClick={() => onConfirm(Array.from(picked))}
          disabled={pickedCount === 0}
          className="w-full rounded-full py-[15px] text-[15px] font-black tracking-wide transition disabled:opacity-35"
          style={{
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
    </div>,
    document.body
  );
}
