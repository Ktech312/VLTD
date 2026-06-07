"use client";

import { useEffect, useRef, useState } from "react";

import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";
import { UNIVERSE_LABEL } from "@/lib/taxonomy";
import { type VaultItem } from "@/lib/vaultModel";

// ─── Types ────────────────────────────────────────────────────────────────────
type AspectMode = "fill" | "9x16" | "16x9";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function effectiveValue(item: VaultItem) {
  return item.valueMedian ?? item.currentValue ?? item.estimatedValue ?? 0;
}

function formatMoney(value: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function universeLabel(item: VaultItem) {
  const key = item.universe?.toUpperCase();
  if (!key) return item.categoryLabel ?? "";
  return (UNIVERSE_LABEL as Record<string, string>)[key] ?? key;
}

function getSecondaryImageUrl(item: VaultItem): string {
  // Second image from the images array (often the card back)
  const images = item.images ?? [];
  const second = images[1];
  if (second?.url) return second.url;
  // Fallback: explicit back URL
  if (item.imageBackUrl && item.imageBackUrl !== item.imageFrontUrl) return item.imageBackUrl;
  return "";
}

function buildMetaChips(item: VaultItem): string[] {
  const chips: string[] = [];
  if (item.universe) chips.push(universeLabel(item));
  if (item.categoryLabel && item.categoryLabel !== item.universe) chips.push(item.categoryLabel);
  if (item.number) chips.push(`#${item.number}`);
  if (item.edition) chips.push(item.edition);
  if (item.grade) chips.push(`Grade ${item.grade}`);
  return chips;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StreamDisplay({
  item,
  onClose,
}: {
  item: VaultItem;
  onClose?: () => void;
}) {
  const [aspectMode, setAspectMode] = useState<AspectMode>("fill");
  const [revealed, setRevealed] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve front image (handles IndexedDB fallback for local items)
  const frontImageUrl = useResolvedVaultImage(item);
  const backImageUrl = getSecondaryImageUrl(item);
  const hasBack = Boolean(backImageUrl);
  const displayImageUrl = showBack ? backImageUrl : (frontImageUrl || "");

  const formattedValue = formatMoney(effectiveValue(item));
  const metaChips = buildMetaChips(item);

  // ── Controls auto-hide ──
  function resetControlsTimer() {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  useEffect(() => {
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        else setRevealed(false);
        resetControlsTimer();
      }
      if ((e.key === "f" || e.key === "F") && hasBack) {
        handleFlip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, hasBack, onClose]);

  function handleFlip() {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setShowBack((v) => !v);
      setIsFlipping(false);
    }, 200);
  }

  function handleReveal() {
    if (!revealed) setRevealed(true);
    resetControlsTimer();
  }

  // ── Aspect style ──
  const aspectStyle: React.CSSProperties =
    aspectMode === "9x16"
      ? { width: "min(100vw, calc(100vh * 9 / 16))", height: "100vh", margin: "0 auto" }
      : aspectMode === "16x9"
        ? { width: "100vw", height: "min(100vh, calc(100vw * 9 / 16))", margin: "auto 0" }
        : { width: "100vw", height: "100vh" };

  return (
    <div
      className="fixed inset-0 z-[100] flex select-none items-center justify-center overflow-hidden bg-black"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      onClick={handleReveal}
    >
      <div className="relative flex flex-col overflow-hidden" style={aspectStyle}>

        {/* ── Blurred background ── */}
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "blur(40px) brightness(0.25) saturate(1.4)", transform: "scale(1.12)" }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)" }} />
        )}

        {/* ── Main content ── */}
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-5 px-8 py-16">

          {/* Card image with flip animation */}
          {displayImageUrl ? (
            <div
              className="flex max-h-[55%] flex-shrink-0 items-center"
              style={{
                opacity: isFlipping ? 0 : (revealed ? 1 : 0.62),
                transform: isFlipping
                  ? "rotateY(90deg) scale(0.9)"
                  : revealed
                    ? "rotateY(0deg) scale(1) translateY(0)"
                    : "rotateY(0deg) scale(0.88) translateY(24px)",
                transition: isFlipping
                  ? "transform 0.2s ease-in, opacity 0.2s ease-in"
                  : "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s",
                filter: revealed
                  ? "drop-shadow(0 24px 64px rgba(0,0,0,0.85))"
                  : "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
                perspective: "800px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayImageUrl}
                alt={item.title ?? ""}
                className="max-h-full max-w-[min(340px,80vw)] rounded-xl object-contain"
              />
              {/* Side badge when showing back */}
              {hasBack && (
                <div
                  className="absolute -top-2 -right-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em]"
                  style={{
                    background: showBack ? "rgba(245,181,72,0.9)" : "rgba(255,255,255,0.15)",
                    color: showBack ? "#000" : "#fff",
                    opacity: revealed ? 1 : 0,
                    transition: "opacity 0.3s",
                  }}
                >
                  {showBack ? "Back" : "Front"}
                </div>
              )}
            </div>
          ) : (
            <div className="grid h-[280px] w-[200px] place-items-center rounded-2xl border border-white/10 bg-white/5">
              <span className="text-4xl font-black tracking-[0.2em] text-white/20">VLTD</span>
            </div>
          )}

          {/* Meta + value — revealed after tap */}
          <div
            className="space-y-3 text-center"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.5s, transform 0.5s",
            }}
          >
            <div
              className="font-black leading-tight text-white"
              style={{ fontSize: "clamp(20px, 4vw, 32px)", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
            >
              {item.title}
            </div>
            {item.subtitle && (
              <div style={{ fontSize: "clamp(14px, 2.5vw, 18px)", color: "rgba(255,255,255,0.65)" }}>
                {item.subtitle}
              </div>
            )}
            {/* Meta chips */}
            {metaChips.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {metaChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
            {/* Value */}
            {formattedValue && (
              <div
                className="font-black"
                style={{
                  color: "#F5B548",
                  fontSize: "clamp(28px, 6vw, 52px)",
                  textShadow: "0 0 40px rgba(245,181,72,0.5)",
                  transform: revealed ? "scale(1)" : "scale(0.7)",
                  transition: "transform 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s",
                }}
              >
                {formattedValue}
              </div>
            )}
          </div>

          {/* Tap to reveal hint */}
          {!revealed && (
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 text-sm uppercase tracking-[0.18em] text-white/40"
              style={{ animation: "stream-pulse 2s ease-in-out infinite" }}
            >
              Tap to reveal
            </div>
          )}

          {/* VLTD badge */}
          <div className="absolute bottom-5 right-5 text-[11px] font-bold uppercase tracking-[0.25em] text-white/20">
            VLTD
          </div>
        </div>
      </div>

      {/* ── Overlay controls (fade in/out) ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ opacity: showControls ? 1 : 0, transition: "opacity 0.4s" }}
      >
        <div className="pointer-events-auto absolute inset-0" style={{ pointerEvents: showControls ? "auto" : "none" }}>

          {/* Top bar */}
          <div
            className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-4"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
          >
            {/* Aspect + flip controls */}
            <div className="flex gap-2">
              {(["fill", "9x16", "16x9"] as AspectMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAspectMode(mode); resetControlsTimer(); }}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold"
                  style={{
                    background: aspectMode === mode ? "rgba(245,181,72,0.9)" : "rgba(255,255,255,0.15)",
                    color: aspectMode === mode ? "#000" : "#fff",
                  }}
                >
                  {mode === "fill" ? "Full" : mode}
                </button>
              ))}
              {hasBack && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleFlip(); resetControlsTimer(); }}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold"
                  style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
                  title="Flip card (F)"
                >
                  ↕ Flip
                </button>
              )}
            </div>

            {/* Close */}
            {onClose && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="grid h-9 w-9 place-items-center rounded-full text-lg text-white"
                style={{ background: "rgba(255,255,255,0.15)" }}
                title="Close (Esc)"
              >
                ×
              </button>
            )}
          </div>

          {/* Bottom controls when revealed */}
          {revealed && (
            <div
              className="absolute bottom-0 left-0 right-0 flex justify-center gap-3 pb-8"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRevealed(false); resetControlsTimer(); }}
                className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold tracking-[0.05em] text-white/70"
              >
                Reset
              </button>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="absolute bottom-4 left-4 text-[10px] text-white/20 hidden sm:block">
            Space: reveal · Esc: close{hasBack ? " · F: flip" : ""}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes stream-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
