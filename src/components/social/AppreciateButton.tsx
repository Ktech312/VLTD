"use client";

import { useState } from "react";
import { appreciateItem, unappreciateItem } from "@/lib/appreciations";

/**
 * "Vibe" reaction button - lightweight social appreciation on a public
 * item. Built on the existing vltd-selectable/vltd-selected pill-glow
 * system: idle and active states never differ by color, only by the
 * shared gold glow (see globals.css PILL LOCKS) plus an icon fill swap.
 * The spark-burst click animation is pure CSS, no animation library.
 */
export function AppreciateButton({
  itemId,
  profileId,
  initialCount = 0,
  initialAppreciated = false,
  size = "default",
}: {
  itemId: string;
  profileId: string;
  initialCount?: number;
  initialAppreciated?: boolean;
  size?: "default" | "compact";
}) {
  const [appreciated, setAppreciated] = useState(initialAppreciated);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const canInteract = Boolean(profileId) && !busy;

  async function toggle() {
    if (!canInteract) return;
    const next = !appreciated;
    setAppreciated(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) setBurstKey((k) => k + 1);
    setBusy(true);
    try {
      const ok = next
        ? await appreciateItem(itemId, profileId)
        : await unappreciateItem(itemId, profileId);
      if (!ok) {
        // Roll back optimistic update on failure.
        setAppreciated(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } finally {
      setBusy(false);
    }
  }

  const padding = size === "compact" ? "6px 10px" : "7px 14px";
  const fontSize = size === "compact" ? 11 : 12;
  const iconSize = size === "compact" ? 14 : 16;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canInteract}
      aria-pressed={appreciated}
      className={[
        "vltd-selectable transition relative",
        appreciated
          ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
          : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)]",
      ].join(" ")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding,
        fontSize,
        fontWeight: 700,
        border: "none",
        cursor: canInteract ? "pointer" : "default",
        minHeight: 44,
        opacity: profileId ? 1 : 0.5,
      }}
    >
      <span style={{ position: "relative", width: iconSize, height: iconSize, display: "inline-flex" }}>
        <svg
          viewBox="0 0 24 24"
          width={iconSize}
          height={iconSize}
          fill={appreciated ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        {burstKey > 0 && (
          <span key={burstKey} className="vltd-spark-burst" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="vltd-spark-dot" style={{ "--vltd-spark-angle": `${i * 60}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}
