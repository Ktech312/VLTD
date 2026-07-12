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

import { useState, useRef, useCallback } from "react";
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
}: {
  current: number;
  total: number;
}) {
  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 z-30"
      style={{
        background: "rgba(0,0,0,0.55)",
        color: "rgba(255,255,255,0.75)",
        borderColor: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(6px)",
      }}
    >
      {current} / {total}
    </div>
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
            ? Math.min(index + 1, items.length - 1)
            : Math.max(index - 1, 0);
        setDrag(null);
        setFlying(null);
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
          if (mode === "vault" && index < items.length - 1) triggerAction("right");
          break;
        case "prev":
          if (mode === "vault" && index > 0) triggerAction("left");
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
    const prevItem = index > 0 ? items[index - 1] : null;
    const nextItem = index < items.length - 1 ? items[index + 1] : null;
    const dragX = drag?.x ?? 0;
    const previewShift = Math.max(-22, Math.min(22, dragX * 0.16));

    return (
      <div className={`flex flex-col ${className}`}>
        <div className="relative mx-auto w-full max-w-[620px] px-12 sm:px-20" style={{ touchAction: "pan-y" }}>
          <div className="relative aspect-[5/7]">
            {isEmpty ? (
              <div className="absolute inset-0">
                <EmptyState mode={mode} />
              </div>
            ) : (
              <>
                {prevItem ? (
                  <button
                    type="button"
                    onClick={() => triggerAction("left")}
                    className="absolute left-0 top-1/2 z-10 h-[70%] w-[34%] -translate-x-[58%] -translate-y-1/2 overflow-hidden rounded-[18px] opacity-55 ring-1 ring-[color:var(--border)] transition hover:opacity-80"
                    style={{ transform: `translate(calc(-58% + ${previewShift}px), -50%) scale(0.88)`, background: "var(--surface)" }}
                    aria-label="Previous item"
                  >
                    <CardFace item={prevItem} isTop={false} />
                  </button>
                ) : null}

                {nextItem ? (
                  <button
                    type="button"
                    onClick={() => triggerAction("right")}
                    className="absolute right-0 top-1/2 z-10 h-[70%] w-[34%] translate-x-[58%] -translate-y-1/2 overflow-hidden rounded-[18px] opacity-55 ring-1 ring-[color:var(--border)] transition hover:opacity-80"
                    style={{ transform: `translate(calc(58% + ${previewShift}px), -50%) scale(0.88)`, background: "var(--surface)" }}
                    aria-label="Next item"
                  >
                    <CardFace item={nextItem} isTop={false} />
                  </button>
                ) : null}

                {currentItem ? (
                  <div
                    ref={cardRef}
                    className="absolute inset-0 z-20 overflow-hidden rounded-[22px] cursor-grab active:cursor-grabbing"
                    style={{
                      transform: `translateX(${previewShift}px)`,
                      transition: drag ? "none" : "transform 160ms ease-out",
                      touchAction: "none",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                  >
                    <CardFace item={currentItem} isTop={true} />
                    <CounterPill current={currentNumber} total={totalCount} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {!isEmpty && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => triggerAction("left")}
              disabled={!prevItem}
              className="flex h-10 w-10 items-center justify-center rounded-full ring-1 transition disabled:opacity-35"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: prevItem ? "var(--fg)" : "var(--muted2)" }}
              aria-label="Previous"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => currentItem && onOpen?.(currentItem)}
              className="flex h-10 min-w-14 items-center justify-center rounded-full px-3 text-[13px] font-bold ring-2"
              style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.4))", color: "var(--theme-gold, #F5B548)" }}
            >
              VIEW
            </button>
            <button
              type="button"
              onClick={() => triggerAction("right")}
              disabled={!nextItem}
              className="flex h-10 w-10 items-center justify-center rounded-full ring-1 transition disabled:opacity-35"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: nextItem ? "var(--fg)" : "var(--muted2)" }}
              aria-label="Next"
            >
              →
            </button>
          </div>
        )}

        {!isEmpty && (
          <div className="pt-1 text-center">
            <span className="text-[11px]" style={{ color: "var(--muted2)" }}>
              Drag or use arrows to browse · tap View to open
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
