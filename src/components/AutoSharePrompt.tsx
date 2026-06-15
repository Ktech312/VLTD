"use client";

import { useEffect, useState } from "react";
import type { ShareTrigger } from "@/hooks/useAutoShareTrigger";
import { getAutoShareEnabled, setAutoShareEnabled } from "@/hooks/useAutoShareTrigger";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

type Props = {
  trigger: ShareTrigger;
  onShare: () => void;
  onDismiss: () => void;
};

export default function AutoSharePrompt({ trigger, onShare, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [autoOn, setAutoOn] = useState(getAutoShareEnabled());

  // Slide in with a small delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  function handleToggleAuto() {
    const next = !autoOn;
    setAutoOn(next);
    setAutoShareEnabled(next);
  }

  function handleShare() {
    onShare();
    onDismiss();
  }

  const isSold = trigger.kind === "sold";
  const emoji = isSold ? "🎉" : "🏅";
  const headline = isSold
    ? `Just Sold${trigger.salePrice ? ` for ${fmt(trigger.salePrice)}` : ""}!`
    : `Just Graded${trigger.grade ? ` — ${trigger.grade}` : ""}!`;
  const sub = isSold
    ? "Share the sale before it slips away."
    : "Your grade is in — share it with the hobby.";

  return (
    <div
      className="fixed bottom-24 left-1/2 z-[95] -translate-x-1/2 transition-all duration-300"
      style={{ transform: `translateX(-50%) translateY(${visible ? "0px" : "80px"})`, opacity: visible ? 1 : 0 }}
    >
      <div
        className="w-[calc(100vw-32px)] max-w-sm rounded-3xl p-4 shadow-2xl ring-1"
        style={{ background: "var(--surface, #12121A)", borderColor: "rgba(245,181,72,0.28)" }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-3xl leading-none">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-black leading-tight" style={{ color: "var(--fg)" }}>{headline}</div>
            <div className="mt-0.5 truncate text-sm" style={{ color: "var(--muted)" }}>
              {trigger.item.title}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{sub}</div>
          </div>
          <button type="button" onClick={onDismiss}
            className="flex-shrink-0 rounded-full p-1.5 text-xs leading-none"
            style={{ background: "var(--pill)", color: "var(--muted)" }}
            aria-label="Dismiss">
            ✕
          </button>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={handleShare}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold"
            style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}>
            Share Now
          </button>
          <button type="button" onClick={onDismiss}
            className="rounded-2xl px-4 py-2.5 text-sm font-semibold ring-1"
            style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}>
            Skip
          </button>
        </div>

        {/* Auto-trigger toggle */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>
            Auto-prompt on sell / grade
          </span>
          <button type="button" onClick={handleToggleAuto}
            className="relative h-5 w-9 rounded-full transition-colors flex-shrink-0"
            style={{ background: autoOn ? "var(--theme-gold, #F5B548)" : "var(--pill)" }}>
            <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
              style={{ transform: autoOn ? "translateX(16px)" : "translateX(0)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
