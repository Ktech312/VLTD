"use client";

import { useEffect, useRef, useState } from "react";

import { UNIVERSE_LABEL } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

type AspectMode = "fill" | "9x16" | "16x9";

function effectiveValue(item: VaultItem) {
  return item.valueMedian ?? item.currentValue ?? item.estimatedValue ?? 0;
}

function formatMoney(value: number) {
  if (!value) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function universeLabel(item: VaultItem) {
  const key = item.universe?.toUpperCase();
  if (!key) return item.categoryLabel ?? "";
  return (UNIVERSE_LABEL as Record<string, string>)[key] ?? key;
}

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
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageUrl = item.imageFrontUrl ?? item.imageBackUrl;
  const formattedValue = formatMoney(effectiveValue(item));

  function resetControlsTimer() {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }

  useEffect(() => {
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []);

  const aspectStyle: React.CSSProperties =
    aspectMode === "9x16"
      ? { width: "min(100vw, calc(100vh * 9 / 16))", height: "100vh", margin: "0 auto" }
      : aspectMode === "16x9"
        ? { width: "100vw", height: "min(100vh, calc(100vw * 9 / 16))", margin: "auto 0" }
        : { width: "100vw", height: "100vh" };

  const metaLine = [
    universeLabel(item),
    item.categoryLabel,
    item.number ? `#${item.number}` : null,
    item.grade,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div
      className="fixed inset-0 z-[100] flex select-none items-center justify-center overflow-hidden"
      style={{ background: "#000" }}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      onClick={() => {
        if (!revealed) setRevealed(true);
      }}
    >
      <div className="relative flex flex-col overflow-hidden" style={aspectStyle}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: "blur(40px) brightness(0.3) saturate(1.4)",
              transform: "scale(1.1)",
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)" }}
          />
        )}

        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
          {imageUrl ? (
            <div
              className="flex max-h-[55%] flex-shrink-0 items-center"
              style={{
                opacity: revealed ? 1 : 0.62,
                transform: revealed ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
                transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s",
                filter: revealed
                  ? "drop-shadow(0 20px 60px rgba(0,0,0,0.8))"
                  : "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={item.title}
                className="max-h-full max-w-[min(340px,80vw)] rounded-xl object-contain"
              />
            </div>
          ) : (
            <div className="grid h-[280px] w-[200px] place-items-center rounded-2xl border border-white/10 bg-white/5">
              <span className="text-5xl text-white/20">VLTD</span>
            </div>
          )}

          <div
            className="space-y-2 text-center"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.5s, transform 0.5s",
            }}
          >
            <div
              className="font-black leading-tight text-white"
              style={{
                fontSize: "clamp(20px, 4vw, 32px)",
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {item.title}
            </div>
            {item.subtitle ? (
              <div style={{ fontSize: "clamp(14px, 2.5vw, 18px)", color: "rgba(255,255,255,0.65)" }}>
                {item.subtitle}
              </div>
            ) : null}
            {metaLine ? (
              <div style={{ fontSize: "clamp(11px, 1.8vw, 14px)", color: "rgba(255,255,255,0.45)" }}>
                {metaLine}
              </div>
            ) : null}
            {formattedValue ? (
              <div
                className="font-black"
                style={{
                  color: "#F5B548",
                  fontSize: "clamp(28px, 6vw, 52px)",
                  opacity: revealed ? 1 : 0,
                  textShadow: "0 0 40px rgba(245,181,72,0.5)",
                  transform: revealed ? "scale(1)" : "scale(0.7)",
                  transition: "transform 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s, opacity 0.5s 0.2s",
                }}
              >
                {formattedValue}
              </div>
            ) : null}
          </div>

          {!revealed ? (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 text-sm uppercase tracking-[0.15em] text-white/40"
              style={{ animation: "stream-pulse 2s ease-in-out infinite" }}
            >
              Tap to reveal
            </div>
          ) : null}

          <div className="absolute bottom-5 right-5 text-[11px] uppercase tracking-[0.2em] text-white/20">
            VLTD
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 z-10"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "auto" : "none",
          transition: "opacity 0.4s",
        }}
      >
        <div
          className="absolute left-0 right-0 top-0 flex items-center justify-between px-5 py-4"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}
        >
          <div className="flex gap-2">
            {(["fill", "9x16", "16x9"] as AspectMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAspectMode(mode);
                  resetControlsTimer();
                }}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  background: aspectMode === mode ? "rgba(245,181,72,0.9)" : "rgba(255,255,255,0.15)",
                  color: aspectMode === mode ? "#000" : "#fff",
                }}
              >
                {mode === "fill" ? "Full" : mode}
              </button>
            ))}
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl text-white"
            >
              x
            </button>
          ) : null}
        </div>

        {revealed ? (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setRevealed(false);
                resetControlsTimer();
              }}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold tracking-[0.05em] text-white/70"
            >
              Reset Reveal
            </button>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes stream-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
