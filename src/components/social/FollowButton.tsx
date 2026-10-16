"use client";

import { useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { followProfile, unfollowProfile } from "@/lib/follows";

/**
 * Follow/unfollow toggle for a collector's profile. Same pill rules as the rest of the controls: "Following" gets the shared
 * selected look (gold glow + check), never a different text color. Renders nothing when viewing your own profile.
 *
 * Signed out: pass `signInHref` and the button sends the person to sign in, then back to this page (the existing sign-in page's
 * `next` link), instead of sitting there disabled.
 */
export function FollowButton({
  viewerProfileId,
  targetProfileId,
  initialFollowing = false,
  signInHref,
}: {
  viewerProfileId: string;
  targetProfileId: string;
  initialFollowing?: boolean;
  signInHref?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!targetProfileId || viewerProfileId === targetProfileId) return null;

  const signedOut = !viewerProfileId;
  const canInteract = !busy && (!signedOut || Boolean(signInHref));

  async function toggle() {
    if (signedOut) {
      if (signInHref) window.location.assign(signInHref);
      return;
    }
    if (busy) return;
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
    <PillButton
      onClick={() => void toggle()}
      disabled={!canInteract}
      variant={following ? "active" : "default"}
      pressed={following}
      ariaLabel={following ? "Following. Unfollow this collector" : signedOut ? "Sign in to follow this collector" : "Follow this collector"}
      title={signedOut ? "Sign in to follow" : following ? "Following — click to unfollow" : "Follow this collector"}
      className="font-semibold"
    >
      {following ? <AppIcon name="checkmark" size={14} strokeWidth={2.4} /> : null}
      {following ? "Following" : "Follow"}
    </PillButton>
  );
}
