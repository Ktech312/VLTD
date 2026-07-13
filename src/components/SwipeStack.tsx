"use client";

// SwipeStack.tsx
// Tinder-style swipeable card stack for VLTD.
//
// Two modes:
//   "gallery" — public visitor browses a collector's items
//               swipe right = Want (adds to wishlist), swipe left = skip, tap = open detail
//   "vault"   — owner flips through their own items
//               swipe left/right = prev/next, tap = open/edit
//
// Gesture engine: pointer events (works on touch AND mouse, no library needed).
// Rendering: CSS transform + transition. Top card is draggable, cards below are
// scaled/offset to give a stacked-depth effect.

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Eye, RotateCw } from "lucide-react";
import type { VaultItem as ModelItem } from "@/lib/vaultModel";
import { itemCurrentValue } from "@/lib/portfolioMetrics";
import { isNotable } from "@/lib/itemIntelligence";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwipeMode = "gallery" | "vault";

export type SwipeAction = "want" | "skip" | "open" | "prev" | "next";

export interface SwipeStackProps {
  items: ModelItem[];
  mode: SwipeMode;
  /** Called when user swipes right in gallery mode (item = the swiped item) */
  onWant?: (item: ModelItem) => void;
  /** Called when user swipes left in gallery mode */
  onSkip?: (item: ModelItem) => void;
  /** Called when user taps the card (both modes) */
  onOpen?: (item: ModelItem) => void;
  /** Called when navigation exhausts the stack */
  onEnd?: () => void;
  /** Starting index — for vault mode to start mid-collection */
  startIndex?: number;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 90;       // px to trigger swipe action
const ROTATION_MAX = 18;          // degrees at full drag
const STACK_DEPTH = 3;            // how many cards to render behind the top
const STACK_OFFSET_Y = 10;        // px per depth level
const STACK_SCALE_STEP = 0.05;    // scale reduction per depth level
const TAP_MOVE_THRESHOLD = 8;     // px — below this, treat as tap not drag
const SNAP_DURATION = "320ms";
const FLY_DURATION = "380ms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function imgSrc(item: ModelItem): string {
  const legacy = item as { imageUrl?: unknown };
  return item.imageFrontUrl || (typeof legacy.imageUrl === "string" ? legacy.imageUrl : "");
}

function backImgSrc(item: ModelItem): string {
  return item.imageBackUrl || "";
}

function money(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function universeLabel(item: ModelItem): string {
  return UNIVERSE_LABEL[(item.universe ?? "MISC") as UniverseKey] ?? "Collection";
}

function itemDescriptor(item: ModelItem): string {
  return [item.subtitle, item.number, item.grade || item.condition].filter(Boolean).join(" · ");
}

function flipProfile(item: ModelItem): { aspectRatio: string; width: string; frame: "flat" | "box" | "instrument" | "square" } {
  const text = `${item.universe ?? ""} ${item.category ?? ""} ${item.categoryLabel ?? ""} ${item.subcategoryLabel ?? ""} ${item.title ?? ""}`.toLowerCase();

  if (/(guitar|instrument|bass|violin|sax|trumpet|keyboard)/.test(text)) {
    return { aspectRatio: "1 / 1.65", width: "min(76vw, 380px)", frame: "instrument" };
  }
  if (/(vinyl|record|lp|album)/.test(text)) {
    return { aspectRatio: "1 / 1.12", width: "min(78vw, 430px)", frame: "square" };
  }
  if (/(game|video game|cd|dvd|blu-ray|bluray|case|box)/.test(text)) {
    return { aspectRatio: "2.7 / 3.7", width: "min(78vw, 410px)", frame: "box" };
  }

  return { aspectRatio: "2 / 3", width: "min(78vw, 410px)", frame: "flat" };
}

// ─── Card face ────────────────────────────────────────────────────────────────

function CardFace({ item, isTop }: { item: ModelItem; isTop: boolean }) {
  const src = imgSrc(item);
  const value = itemCurrentValue(item);
  const notable = isNotable(item);
  const label = universeLabel(item);
  const subtitle = [item.subtitle, item.number, item.grade].filter(Boolean).join(" · ");

  return (
    <div
      className="relative w-full h-full rounded-[22px] overflow-hidden select-none"
      style={{ background: "var(--surface)" }}
    >
      {/* Image */}
      <div className="absolute inset-0">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.title}
            className="w-full h-full object-cover"
            loading={isTop ? "eager" : "lazy"}
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: "var(--pill)" }}
          >
            <span
              className="text-[13px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--muted2)" }}
            >
              {label}
            </span>
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* Top badges */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
        {notable && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1"
            style={{
              background: "rgba(245,181,72,0.18)",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "rgba(245,181,72,0.45)",
            }}
          >
            ★ Key Item
          </span>
        )}
        {item.grade && (
          <span
            className="ml-auto rounded-xl px-2.5 py-1 text-[11px] font-bold ring-1"
            style={{
              background: "rgba(10,8,0,0.82)",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "rgba(245,181,72,0.45)",
            }}
          >
            {item.grade.length > 12 ? item.grade.slice(0, 12) : item.grade}
          </span>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-10">
        <div
          className="text-[11px] uppercase tracking-[0.18em] mb-1"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {label}
        </div>
        <div
          className="text-[22px] font-bold leading-tight"
          style={{ color: "#F0EAD6" }}
        >
          {item.title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            {subtitle}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Value
            </div>
            <div
              className="text-[20px] font-bold"
              style={{ color: "var(--theme-gold, #F5B548)" }}
            >
              {money(value)}
            </div>
          </div>
          {item.purchasePrice != null && item.purchasePrice > 0 && (
            <div className="text-right">
              <div
                className="text-[10px] uppercase tracking-[0.16em]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Paid
              </div>
              <div
                className="text-[16px] font-semibold"
                style={{ color: "rgba(240,234,214,0.7)" }}
              >
                {money(item.purchasePrice)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewFace({ item }: { item: ModelItem }) {
  const src = imgSrc(item);
  const label = universeLabel(item);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[18px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.title}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center px-3 text-center"
          style={{ background: "var(--pill)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--muted2)" }}
          >
            {label}
          </span>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 0 1px rgba(245,181,72,0.16)",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.42))",
        }}
      />
    </div>
  );
}

function VaultFlipFront({ item }: { item: ModelItem }) {
  const src = imgSrc(item);
  const value = itemCurrentValue(item);
  const notable = isNotable(item);
  const label = universeLabel(item);
  const descriptor = itemDescriptor(item);
  const profile = flipProfile(item);
  const objectRadius = profile.frame === "square" ? 18 : profile.frame === "box" ? 14 : 12;

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden rounded-[26px]"
      style={{
        background: "linear-gradient(145deg, rgba(19,27,35,0.98), rgba(4,8,10,0.98))",
        border: "1px solid rgba(218,171,74,0.32)",
        boxShadow: "0 26px 70px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 12%, rgba(245,181,72,0.18), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.06), transparent 18%, rgba(0,0,0,0.34))",
        }}
      />

      <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-2">
        {notable ? (
          <span
            className="rounded-[10px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1"
            style={{
              background: "rgba(245,181,72,0.17)",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "rgba(245,181,72,0.45)",
            }}
          >
            Key Item
          </span>
        ) : (
          <span />
        )}
        {item.grade ? (
          <span
            className="rounded-[10px] px-2.5 py-1 text-[11px] font-bold ring-1"
            style={{
              background: "rgba(6,8,9,0.78)",
              color: "var(--theme-gold, #F5B548)",
              borderColor: "rgba(245,181,72,0.45)",
            }}
          >
            {item.grade.length > 12 ? item.grade.slice(0, 12) : item.grade}
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-5 top-12 bottom-[120px] flex items-center justify-center">
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden"
          style={{
            borderRadius: objectRadius,
            background:
              profile.frame === "box"
                ? "linear-gradient(90deg, rgba(245,181,72,0.12), rgba(255,255,255,0.06) 12%, rgba(0,0,0,0.24) 18%, rgba(255,255,255,0.04))"
                : "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(0,0,0,0.18))",
            border: "1px solid rgba(245,181,72,0.24)",
            boxShadow:
              "0 18px 34px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -32px 42px rgba(0,0,0,0.2)",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.title}
              className="h-full w-full object-contain p-1.5"
              loading="eager"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black/28 px-6 text-center">
              <span
                className="text-[12px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "rgba(240,234,214,0.34)" }}
              >
                Add front photo
              </span>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.11) 38%, transparent 48%), radial-gradient(circle at 18% 0%, rgba(255,255,255,0.12), transparent 24%)",
            }}
          />
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5 pt-8"
        style={{ background: "linear-gradient(to top, rgba(2,5,6,0.96), rgba(2,5,6,0.78), transparent)" }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(218,171,74,0.68)" }}>
          {label}
        </div>
        <div className="mt-1 text-[24px] font-black leading-[1.05]" style={{ color: "#F0EAD6" }}>
          {item.title}
        </div>
        {descriptor ? (
          <div className="mt-1 text-[13px]" style={{ color: "rgba(240,234,214,0.62)" }}>
            {descriptor}
          </div>
        ) : null}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(240,234,214,0.42)" }}>
              Value
            </div>
            <div className="text-[22px] font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>
              {money(value)}
            </div>
          </div>
          {item.purchasePrice != null && item.purchasePrice > 0 ? (
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(240,234,214,0.42)" }}>
                Paid
              </div>
              <div className="text-[16px] font-bold" style={{ color: "rgba(240,234,214,0.72)" }}>
                {money(item.purchasePrice)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VaultFlipBack({ item }: { item: ModelItem }) {
  const backSrc = backImgSrc(item);
  const label = universeLabel(item);
  const fields = [
    ["Serial", item.serialNumber || item.sportsSerialNumber || item.certNumber],
    ["Barcode", item.orderNumber || item.tcgSetCode || item.vinylMatrix],
    ["Condition", item.conditionReason || item.condition],
    ["Source", item.purchaseSource || item.valueSource || item.priceSource],
    ["Location", item.storageLocation || item.purchaseLocation],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden rounded-[26px] px-6 pb-6 pt-16"
      style={{
        background: "linear-gradient(145deg, rgba(9,17,21,0.98), rgba(2,5,6,0.99))",
        border: "1px solid rgba(218,171,74,0.32)",
        boxShadow: "0 26px 70px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 8%, rgba(245,181,72,0.16), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.05), transparent 22%, rgba(0,0,0,0.35))",
        }}
      />

      <div className="relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.26em]" style={{ color: "rgba(218,171,74,0.62)" }}>
          Back metadata
        </div>
        <div className="mt-1 text-[22px] font-black leading-tight" style={{ color: "#F0EAD6" }}>
          {item.title}
        </div>
        <div className="mt-1 text-[12px]" style={{ color: "rgba(240,234,214,0.58)" }}>
          {label}
        </div>
      </div>

      <div className="relative z-10 mt-5 overflow-hidden rounded-[18px]" style={{ border: "1px solid rgba(245,181,72,0.25)" }}>
        {backSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backSrc} alt={`${item.title} back`} className="h-36 w-full object-contain bg-black/35 p-2" draggable={false} />
        ) : (
          <div className="flex h-36 items-center justify-center bg-black/28 px-6 text-center">
            <span className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(240,234,214,0.34)" }}>
              Add reverse photo
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-5 grid gap-2">
        {(fields.length ? fields : [["Needs Review", "Add serial, barcode, back image, or notes"]]).map(([name, value]) => (
          <div
            key={name}
            className="flex items-start justify-between gap-4 rounded-[12px] px-3 py-2"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(218,171,74,0.58)" }}>
              {name}
            </span>
            <span className="max-w-[62%] text-right text-[12px] font-semibold leading-snug" style={{ color: "rgba(240,234,214,0.82)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {item.notes ? (
        <div className="relative z-10 mt-4 rounded-[12px] px-3 py-2 text-[12px] leading-snug" style={{ color: "rgba(240,234,214,0.68)", background: "rgba(0,0,0,0.22)" }}>
          {item.notes.length > 120 ? `${item.notes.slice(0, 120)}...` : item.notes}
        </div>
      ) : null}
    </div>
  );
}

// ─── Swipe hint overlay ───────────────────────────────────────────────────────

function SwipeHint({
  dx,
  mode,
}: {
  dx: number;
  mode: SwipeMode;
}) {
  const abs = Math.abs(dx);
  const opacity = Math.min(1, (abs - 20) / (SWIPE_THRESHOLD * 0.6));
  if (abs < 20) return null;

  const isRight = dx > 0;

  let label: string;
  let color: string;

  if (mode === "gallery") {
    label = isRight ? "WANT" : "SKIP";
    color = isRight ? "#4ade80" : "#f87171";
  } else {
    label = isRight ? "NEXT →" : "← PREV";
    color = "var(--theme-gold, #F5B548)";
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[22px] flex items-center justify-center"
      style={{
        background: isRight
          ? `rgba(74,222,128,${opacity * 0.12})`
          : `rgba(248,113,113,${opacity * 0.12})`,
        opacity,
        zIndex: 20,
      }}
    >
      <div
        className="text-[28px] font-black uppercase tracking-[0.15em] px-6 py-3 rounded-2xl ring-2"
        style={{
          color,
          borderColor: color,
          background: "rgba(0,0,0,0.35)",
          transform: `rotate(${isRight ? -8 : 8}deg)`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Action button bar ────────────────────────────────────────────────────────

function ActionBar({
  mode,
  onAction,
  canPrev,
  canNext,
}: {
  mode: SwipeMode;
  onAction: (a: SwipeAction) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const btnBase =
    "flex items-center justify-center rounded-full transition-all active:scale-90 select-none touch-manipulation";

  if (mode === "gallery") {
    return (
      <div className="flex items-center justify-center gap-5 pt-4">
        {/* Skip */}
        <button
          type="button"
          className={`${btnBase} w-14 h-14 ring-2`}
          style={{
            background: "var(--surface)",
            borderColor: "#f87171",
            color: "#f87171",
            fontSize: 22,
          }}
          onClick={() => onAction("skip")}
          aria-label="Skip"
        >
          ✕
        </button>

        {/* Open detail */}
        <button
          type="button"
          className={`${btnBase} w-12 h-12 ring-1`}
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--muted)",
            fontSize: 16,
          }}
          onClick={() => onAction("open")}
          aria-label="Open detail"
        >
          ↗
        </button>

        {/* Want */}
        <button
          type="button"
          className={`${btnBase} w-14 h-14 ring-2`}
          style={{
            background: "var(--surface)",
            borderColor: "#4ade80",
            color: "#4ade80",
            fontSize: 22,
          }}
          onClick={() => onAction("want")}
          aria-label="Want this item"
        >
          ♥
        </button>
      </div>
    );
  }

  // Vault mode
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      {/* Prev */}
      <button
        type="button"
        className={`${btnBase} h-11 w-11 ring-1`}
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: canPrev ? "var(--fg)" : "var(--muted2)",
          fontSize: 20,
          opacity: canPrev ? 1 : 0.35,
        }}
        onClick={() => onAction("prev")}
        disabled={!canPrev}
        aria-label="Previous"
      >
        ←
      </button>

      {/* Open / edit */}
      <button
        type="button"
        className={`${btnBase} h-11 min-w-14 px-3 ring-2`}
        style={{
          background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
          borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))",
          color: "var(--theme-gold, #F5B548)",
          fontSize: 15,
          fontWeight: 700,
        }}
        onClick={() => onAction("open")}
        aria-label="Open item"
      >
        VIEW
      </button>

      {/* Next */}
      <button
        type="button"
        className={`${btnBase} h-11 w-11 ring-1`}
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: canNext ? "var(--fg)" : "var(--muted2)",
          fontSize: 20,
          opacity: canNext ? 1 : 0.35,
        }}
        onClick={() => onAction("next")}
        disabled={!canNext}
        aria-label="Next"
      >
        →
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ mode }: { mode: SwipeMode }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[22px] h-full gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-[36px] font-black"
        style={{ color: "var(--theme-gold, #F5B548)", opacity: 0.4 }}
      >
        {mode === "gallery" ? "✦" : "∅"}
      </div>
      <div className="text-center px-8">
        <div className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
          {mode === "gallery" ? "You've seen everything" : "No items"}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          {mode === "gallery"
            ? "Come back to see new additions"
            : "Add items to your vault to start browsing"}
        </div>
      </div>
    </div>
  );
}

// ─── Counter pill ─────────────────────────────────────────────────────────────

function CounterPill({
  current,
  total,
  onJump,
}: {
  current: number;
  total: number;
  onJump?: (next: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(current));

  function commitJump() {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(total, Math.max(1, parsed));
      onJump?.(clamped);
      setDraft(String(clamped));
    } else {
      setDraft(String(current));
    }
    setIsEditing(false);
  }

  if (isEditing && onJump) {
    return (
      <input
        className="absolute top-4 left-1/2 z-30 w-16 -translate-x-1/2 rounded-full px-2 py-1 text-center text-[11px] font-semibold outline-none ring-1"
        style={{
          background: "rgba(0,0,0,0.68)",
          color: "rgba(255,255,255,0.88)",
          borderColor: "rgba(255,255,255,0.22)",
          backdropFilter: "blur(6px)",
        }}
        value={draft}
        inputMode="numeric"
        autoFocus
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={commitJump}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitJump();
          if (event.key === "Escape") {
            setDraft(String(current));
            setIsEditing(false);
          }
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <button
      type="button"
      className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 z-30"
      style={{
        background: "rgba(0,0,0,0.55)",
        color: "rgba(255,255,255,0.75)",
        borderColor: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(6px)",
      }}
      onClick={() => {
        if (!onJump) return;
        setDraft(String(current));
        setIsEditing(true);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={onJump ? "Jump to item number" : undefined}
    >
      {current} / {total}
    </button>
  );
}

// ─── Main SwipeStack ──────────────────────────────────────────────────────────

export default function SwipeStack({
  items,
  mode,
  onWant,
  onSkip,
  onOpen,
  onEnd,
  startIndex = 0,
  className = "",
}: SwipeStackProps) {
  // In gallery mode: index is the NEXT card to show (top of remaining stack)
  // In vault mode: index is current card being viewed
  const [index, setIndex] = useState(
    mode === "gallery" ? 0 : Math.min(startIndex, Math.max(0, items.length - 1))
  );

  // Drag state
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  // Flying state: which direction card is flying off + animating
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  // Undo stack for gallery mode
  const [history, setHistory] = useState<Array<{ item: ModelItem; action: "want" | "skip" }>>([]);
  const [isFlipped, setIsFlipped] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const didMove = useRef(false);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (flying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    didMove.current = false;
    setDrag({ x: 0, y: 0 });
  }, [flying]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) {
      didMove.current = true;
    }
    setDrag({ x: dx, y: dy });
  }, []);

  const triggerAction = useCallback(
    (direction: "left" | "right") => {
      const currentItem =
        mode === "gallery" ? items[index] : items[index];
      if (!currentItem) return;

      if (mode === "vault") {
        const nextIndex =
          direction === "right"
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
        setDrag(null);
        setFlying(null);
        setIsFlipped(false);
        setIndex(nextIndex);
        return;
      }

      setFlying(direction);

      setTimeout(() => {
        setFlying(null);
        setDrag(null);

        if (mode === "gallery") {
          const action = direction === "right" ? "want" : "skip";
          setHistory((h) => [...h, { item: currentItem, action }]);
          if (direction === "right") onWant?.(currentItem);
          else onSkip?.(currentItem);

          const nextIndex = index + 1;
          if (nextIndex >= items.length) {
            onEnd?.();
          } else {
            setIndex(nextIndex);
          }
        }
      }, parseInt(FLY_DURATION));
    },
    [index, items, mode, onWant, onSkip, onEnd]
  );

  useEffect(() => {
    if (mode !== "vault") return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        triggerAction("right");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        triggerAction("left");
      } else if (event.key === " " || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        setIsFlipped((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, triggerAction]);

  const onPointerUp = useCallback(
    () => {
      if (!pointerStart.current) return;
      pointerStart.current = null;

      if (!didMove.current) {
        // It's a tap
        const currentItem = items[index];
        if (currentItem) onOpen?.(currentItem);
        setDrag(null);
        return;
      }

      const dx = drag?.x ?? 0;
      if (Math.abs(dx) >= SWIPE_THRESHOLD) {
        triggerAction(dx > 0 ? "right" : "left");
      } else {
        if (mode === "vault") {
          setDrag(null);
          return;
        }
        // Snap back
        setDrag({ x: 0, y: 0 });
        setTimeout(() => setDrag(null), parseInt(SNAP_DURATION));
      }
    },
    [drag, index, items, mode, onOpen, triggerAction]
  );

  const onPointerCancel = useCallback(() => {
    pointerStart.current = null;
    if (mode === "vault") {
      setDrag(null);
      return;
    }
    setDrag({ x: 0, y: 0 });
    setTimeout(() => setDrag(null), parseInt(SNAP_DURATION));
  }, [mode]);

  // ── Button actions ────────────────────────────────────────────────────────

  const handleAction = useCallback(
    (action: SwipeAction) => {
      switch (action) {
        case "want":
          triggerAction("right");
          break;
        case "skip":
          triggerAction("left");
          break;
        case "next":
          if (mode === "vault" && items.length > 1) triggerAction("right");
          break;
        case "prev":
          if (mode === "vault" && items.length > 1) triggerAction("left");
          break;
        case "open": {
          const currentItem = items[index];
          if (currentItem) onOpen?.(currentItem);
          break;
        }
      }
    },
    [triggerAction, index, items, mode, onOpen]
  );

  // ── Undo (gallery only) ───────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (history.length === 0 || index === 0) return;
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    // Note: we can't un-add from wishlist here; caller should handle that
  }, [history, index]);

  // ── Compute card transforms ───────────────────────────────────────────────

  const isDragging = drag !== null && !flying;
  const flyDistance = typeof window === "undefined" ? 1200 : window.innerWidth + 200;
  const dx = flying === "right" ? flyDistance : flying === "left" ? -flyDistance : (drag?.x ?? 0);
  const dy = drag?.y ?? 0;
  const rotation = (dx / 360) * ROTATION_MAX;

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = items.length === 0;
  const isExhausted = mode === "gallery" && index >= items.length;

  // Which items to render (top + STACK_DEPTH behind)
  const visibleItems =
    mode === "gallery"
      ? items.slice(index, index + STACK_DEPTH + 1)
      : (() => {
          // Vault: show current ± 1 on each side for depth illusion
          const out: ModelItem[] = [];
          for (let d = STACK_DEPTH; d >= 0; d--) {
            const i = index + d;
            if (i < items.length) out.unshift(items[i]);
          }
          return out;
        })();

  const totalCount = items.length;
  const currentNumber =
    mode === "gallery" ? index + 1 : index + 1;

  const transition =
    flying
      ? `transform ${FLY_DURATION} cubic-bezier(0.4, 0, 0.2, 1)`
      : isDragging
      ? "none"
      : `transform ${SNAP_DURATION} cubic-bezier(0.34, 1.56, 0.64, 1)`;

  if (mode === "vault") {
    const currentItem = items[index];
    const canCycle = items.length > 1;
    const prevItem = canCycle ? items[(index - 1 + items.length) % items.length] : null;
    const nextItem = canCycle ? items[(index + 1) % items.length] : null;
    const dragX = drag?.x ?? 0;
    const cardShift = Math.max(-18, Math.min(18, dragX * 0.12));
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="w-full max-w-5xl px-4" style={{ touchAction: "pan-y" }}>
          {isEmpty ? (
            <div className="mx-auto aspect-[5/7] w-full max-w-[420px]">
              <div className="h-full w-full">
                <EmptyState mode={mode} />
              </div>
            </div>
          ) : (
            <div
              className="relative mx-auto flex w-full items-start justify-center overflow-hidden"
              style={{ height: "520px", perspective: "1200px" }}
            >
              {prevItem ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[340px] rounded-[22px] transition-all duration-500 ease-out"
                  style={{
                    transform: "translate3d(-135%, 0, -200px) rotateY(32deg)",
                    transformStyle: "preserve-3d",
                    zIndex: 10,
                    opacity: 0.35,
                  }}
                  aria-hidden="true"
                >
                  <PreviewFace item={prevItem} />
                </div>
              ) : null}

              {nextItem ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[340px] rounded-[22px] transition-all duration-500 ease-out"
                  style={{
                    transform: "translate3d(35%, 0, -200px) rotateY(-32deg)",
                    transformStyle: "preserve-3d",
                    zIndex: 10,
                    opacity: 0.35,
                  }}
                  aria-hidden="true"
                >
                  <PreviewFace item={nextItem} />
                </div>
              ) : null}

              <div
                className="absolute left-1/2 top-0 h-[460px] w-[340px] max-w-[78vw] transition-all duration-500 ease-out"
                style={{
                  transform: `translate3d(calc(-50% + ${cardShift}px), 0, 0) scale(1)`,
                  transformStyle: "preserve-3d",
                  zIndex: 30,
                }}
              >
                {currentItem ? (
                  <>
                    {[3, 2, 1].map((depth) => (
                      <div
                        key={depth}
                        className="pointer-events-none absolute inset-0 rounded-[24px]"
                        style={{
                          transform: `translateY(${depth * 11}px) scale(${1 - depth * 0.038}) rotate(${depth % 2 === 0 ? "4deg" : "-4deg"})`,
                          transformOrigin: "center bottom",
                          background: "linear-gradient(145deg, rgba(210,218,222,0.34), rgba(58,67,76,0.34))",
                          border: "1px solid rgba(255,255,255,0.12)",
                          boxShadow: "0 18px 45px rgba(0,0,0,0.42)",
                          opacity: 0.62 - depth * 0.12,
                        }}
                      />
                    ))}

                    <div
                      ref={cardRef}
                      className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                      style={{
                        transform: `translateX(${cardShift}px)`,
                        transition: drag ? "none" : "transform 160ms ease-out",
                        touchAction: "none",
                      }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                    >
                      <div
                        className="relative h-full w-full"
                        style={{
                          transformStyle: "preserve-3d",
                          transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1)",
                          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                        }}
                      >
                        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                          <VaultFlipFront item={currentItem} />
                        </div>
                        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                          <VaultFlipBack item={currentItem} />
                        </div>
                      </div>
                    </div>

                    <CounterPill
                      current={currentNumber}
                      total={totalCount}
                      onJump={(next) => {
                        setIsFlipped(false);
                        setDrag(null);
                        setFlying(null);
                        setIndex(next - 1);
                      }}
                    />
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsFlipped((value) => !value);
                      }}
                      className="absolute right-9 top-[70px] z-40 flex h-8 w-8 items-center justify-center text-[16px] font-black transition hover:scale-110"
                      style={{
                        color: "var(--theme-gold, #F5B548)",
                      }}
                      aria-label={isFlipped ? "Show front" : "Show back"}
                    >
                      <RotateCw size={16} strokeWidth={2.4} />
                    </button>
                  </>
                ) : null}
              </div>

            </div>
          )}
        </div>

        {!isEmpty && (
          <div className="relative z-40 -mt-4 flex flex-col items-center gap-3">
            <div
              className="flex items-center gap-3 rounded-full p-2.5 shadow-2xl"
              style={{
                background: "rgba(12,16,20,0.82)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
              }}
            >
            <button
              type="button"
              onClick={() => triggerAction("left")}
              disabled={!canCycle}
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 transition active:scale-95 disabled:opacity-35"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: canCycle ? "var(--fg)" : "var(--muted2)" }}
              aria-label="Previous"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => currentItem && onOpen?.(currentItem)}
              className="flex h-11 min-w-24 items-center justify-center gap-2 rounded-full px-4 text-[12px] font-bold uppercase tracking-[0.12em] ring-1 transition active:scale-95"
              style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#F0EAD6" }}
            >
              <Eye size={14} strokeWidth={2.5} />
              View
            </button>
            <button
              type="button"
              onClick={() => triggerAction("right")}
              disabled={!canCycle}
              className="flex h-11 w-11 items-center justify-center rounded-full ring-1 transition active:scale-95 disabled:opacity-35"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: canCycle ? "var(--fg)" : "var(--muted2)" }}
              aria-label="Next"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
            </div>
          </div>
        )}

        {!isEmpty && (
          <div className="pt-1 text-center">
            <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
              Left/right browse - Space, Up, or Down flips - View opens item
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Card stack area */}
      <div className="relative" style={{ paddingBottom: "140%", touchAction: "none" }}>
        {isEmpty || isExhausted ? (
          <div className="absolute inset-0">
            <EmptyState mode={mode} />
          </div>
        ) : (
          <>
            {/* Background depth cards (rendered back-to-front) */}
            {visibleItems
              .slice(0, -1) // all except top
              .reverse()
              .map((item, depthReversed) => {
                const depth = visibleItems.length - 1 - depthReversed; // 1 = immediately behind top
                const scale = 1 - depth * STACK_SCALE_STEP;
                const translateY = depth * STACK_OFFSET_Y;
                return (
                  <div
                    key={`${item.id}-depth-${depth}`}
                    className="absolute inset-0 rounded-[22px] overflow-hidden"
                    style={{
                      transform: `scale(${scale}) translateY(${translateY}px)`,
                      transformOrigin: "bottom center",
                      transition: `transform ${SNAP_DURATION} ease`,
                      zIndex: STACK_DEPTH - depth,
                      pointerEvents: "none",
                    }}
                  >
                    <CardFace item={item} isTop={false} />
                  </div>
                );
              })}

            {/* Top draggable card */}
            {visibleItems.length > 0 && (
              <div
                ref={cardRef}
                className="absolute inset-0 rounded-[22px] overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                  transform: `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`,
                  transition,
                  zIndex: STACK_DEPTH + 1,
                  willChange: "transform",
                  touchAction: "none",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
              >
                <CardFace item={visibleItems[visibleItems.length - 1]} isTop={true} />
                <SwipeHint dx={dx} mode={mode} />
              </div>
            )}

            {/* Counter */}
            {totalCount > 1 && (
              <CounterPill current={currentNumber} total={totalCount} />
            )}
          </>
        )}
      </div>

      {/* Action bar */}
      {!isEmpty && !isExhausted && (
        <ActionBar
          mode={mode}
          onAction={handleAction}
          canPrev={false}
          canNext={false}
        />
      )}

      {/* Undo row — gallery only */}
      {mode === "gallery" && history.length > 0 && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={handleUndo}
            className="text-[12px] transition-opacity hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            ↩ Undo last swipe
          </button>
        </div>
      )}

      {/* Swipe hint text — shown when stack is fresh */}
      {!isEmpty && !isExhausted && !drag && !flying && (
        <div className="text-center pt-2">
          <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
            {mode === "gallery"
              ? "Swipe right to want · left to skip · tap for details"
              : "Swipe or use buttons to browse · tap to view"}
          </span>
        </div>
      )}
    </div>
  );
}
