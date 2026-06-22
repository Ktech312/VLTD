"use client";

import { useState } from "react";
import { appreciateItem, unappreciateItem } from "@/lib/appreciations";

/**
 * "Vibe" reaction - lightweight social appreciation on a public item.
 * Built on the existing vltd-selectable/vltd-selected pill-glow system:
 * idle and active states never differ by color, only by the shared gold
 * glow (see globals.css PILL LOCKS) plus an icon fill swap. The spark-burst
 * click animation is pure CSS, no animation library.
 *
 * Owners can't Vibe their own item - pass isOwner to render a plain,
 * non-interactive count instead of a clickable button.
 */
export function VibeButton({
  itemId,
  profileId,
  isOwner = false,
  initialCount = 0,
  initialVibed = false,
  size = "default",
}: {
  itemId: string;
  profileId: string;
  isOwner?: boolean;
  initialCount?: number;
  initialVibed?: boolean;
  size?: "default" | "compact";
}) {
  const [vibed, setVibed] = useState(initialVibed);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const canInteract = !isOwner && Boolean(profileId) && !busy;

  async function toggle() {
    if (!canInteract) return;
    const next = !vibed;
    setVibed(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) setBurstKey((k) => k + 1);
    setBusy(true);
    try {
      const ok = next
        ? await appreciateItem(itemId, profileId)
        : await unappreciateItem(itemId, profileId);
      if (!ok) {
        // Roll back optimistic update on failure.
        setVibed(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    } finally {
      setBusy(false);
    }
  }

  const padding = size === "compact" ? "6px 10px" : "7px 14px";
  const fontSize = size === "compact" ? 11 : 12;
  const iconSize = size === "compact" ? 14 : 16;

  const icon = (
    <span style={{ position: "relative", width: iconSize, height: iconSize, display: "inline-flex" }}>
      <svg
        viewBox="0 0 24 24"
        width={iconSize}
        height={iconSize}
        fill={vibed ? "currentColor" : "none"}
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
  );

  if (isOwner) {
    // Read-only: shows how many other collectors have vibed this item.
    // Never a button - no click affordance at all on your own item.
    return (
      <div
        aria-label={`${count} ${count === 1 ? "vibe" : "vibes"}`}
        className="vltd-pill-neutral"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          padding,
          fontSize,
          fontWeight: 700,
          background: "var(--pill)",
        }}
      >
        {icon}
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canInteract}
      aria-pressed={vibed}
      aria-label={vibed ? "Remove Vibe" : "Vibe this item"}
      className={[
        "vltd-selectable transition relative",
        vibed
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
      {icon}
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}
