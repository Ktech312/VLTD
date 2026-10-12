"use client";

import { useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
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

  const iconSize = 16;

  const icon = (
    <span style={{ position: "relative", width: iconSize, height: iconSize, display: "inline-flex" }}>
      <AppIcon name="vibe" size={iconSize} strokeWidth={2.6} filled={vibed} />
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
        role="img"
        aria-label={`${count} ${count === 1 ? "vibe" : "vibes"}`}
        className={[
          "inline-flex items-center gap-1.5 rounded-[8px] bg-[color:var(--pill)] px-3 font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--border)]",
          size === "compact" ? "h-7 px-2.5 text-xs" : "h-9 text-[13px]",
        ].join(" ")}
      >
        {icon}
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
      </div>
    );
  }

  return (
    <PillButton
      size={size}
      variant={vibed ? "active" : "default"}
      pressed={vibed}
      onClick={toggle}
      disabled={!canInteract}
      ariaLabel={vibed ? "Remove Vibe" : "Vibe this item"}
      className="relative"
    >
      {icon}
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </PillButton>
  );
}
