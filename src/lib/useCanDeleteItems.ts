"use client";

import { useEffect, useState } from "react";

import { canDeleteItemsIn, getStoredActiveProfileId, listMyProfiles, resolveActiveProfile } from "@/lib/auth";

/**
 * Whether the person may delete items in the profile that is active now. True for an owner and for an admin; false only for a team member (role "member"),
 * for whom the database refuses deletes. True while still unknown (the database decides, and a refusal is explained on screen).
 */
export function useCanDeleteItems(): boolean {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await listMyProfiles();
        if (!alive) return;
        const active = resolveActiveProfile((data ?? []) as never[], getStoredActiveProfileId());
        setAllowed(canDeleteItemsIn(active as { member_role?: string | null } | null));
      } catch { /* unknown: leave it to the database */ }
    }
    void load();
    window.addEventListener("vltd:active-profile", load);
    return () => { alive = false; window.removeEventListener("vltd:active-profile", load); };
  }, []);
  return allowed;
}
