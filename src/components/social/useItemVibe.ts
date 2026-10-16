"use client";

import { useEffect, useState } from "react";
import { getAppreciationCount, hasAppreciated } from "@/lib/appreciations";

/** Looks up an item's Vibe count and whether the viewer has vibed it (the existing appreciations data). */
export function useItemVibe(itemId: string, viewerProfileId: string, skip = false) {
  const [state, setState] = useState<{ count: number; vibed: boolean } | null>(null);
  useEffect(() => {
    if (skip || !itemId) return;
    let active = true;
    void (async () => {
      const count = await getAppreciationCount(itemId);
      const vibed = viewerProfileId ? await hasAppreciated(itemId, viewerProfileId) : false;
      if (active) setState({ count, vibed });
    })();
    return () => {
      active = false;
    };
  }, [itemId, viewerProfileId, skip]);
  return state;
}
