"use client";

import { useState } from "react";
import { followProfile, unfollowProfile } from "@/lib/follows";

/**
 * Follow/unfollow toggle for a collector's profile. Same pill-glow rules as
 * VibeButton - "Following" never gets a different text color, only the
 * shared gold glow. Renders nothing at all when viewing your own profile
 * (no read-only count here - follower totals belong on the profile's own
 * stats display, not duplicated onto this button).
 */
export function FollowButton({
  viewerProfileId,
  targetProfileId,
  initialFollowing = false,
}: {
  viewerProfileId: string;
  targetProfileId: string;
  initialFollowing?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!targetProfileId || viewerProfileId === targetProfileId) return null;

  const canInteract = Boolean(viewerProfileId) && !busy;

  async function toggle() {
    if (!canInteract) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const ok = next
        ? await followProfile(viewerProfileId, targetProfileId)
        : await unfollowProfile(viewerProfileId, targetProfileId);
      if (!ok) setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!canInteract}
      aria-pressed={following}
      className={[
        "vltd-selectable transition",
        following
          ? "vltd-selected bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
          : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)]",
      ].join(" ")}
      style={{
        borderRadius: 999,
        padding: "7px 16px",
        fontSize: 12,
        fontWeight: 700,
        border: "none",
        cursor: canInteract ? "pointer" : "default",
        minHeight: 44,
        opacity: viewerProfileId ? 1 : 0.5,
      }}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
