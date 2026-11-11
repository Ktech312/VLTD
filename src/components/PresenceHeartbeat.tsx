"use client";

import { useEffect } from "react";

import { getCurrentUser, getStoredActiveProfileId, initAuthListener } from "@/lib/auth";
import { touchPresence } from "@/lib/presence";
import { sweepTimedOutUploads } from "@/lib/vaultOrphanSweep";

const HEARTBEAT_MS = 60 * 1000;

// Invisible: pings presence for the active profile while the app is open and
// the tab is visible. Best-effort; never renders anything.
export default function PresenceHeartbeat() {
  useEffect(() => {
    initAuthListener();
    let signedIn = false;
    let cancelled = false; // this effect was cleaned up before the sign-in answer arrived: start no timer
    let timer: ReturnType<typeof setInterval> | null = null;

    async function beat() {
      if (!signedIn || document.visibilityState !== "visible") return;
      const profileId = getStoredActiveProfileId();
      if (profileId) await touchPresence(profileId);
    }

    void getCurrentUser().then(({ data }) => {
      if (cancelled) return;
      signedIn = Boolean(data.user);
      if (!signedIn) return;
      void beat();
      // Once per visit: remove files left by uploads that were given up on (does nothing, and asks for nothing, when none are written down).
      window.setTimeout(() => { if (!cancelled) void sweepTimedOutUploads().catch(() => undefined); }, 20 * 1000);
      timer = setInterval(() => void beat(), HEARTBEAT_MS);
    });

    function onVisible() {
      if (document.visibilityState === "visible") void beat();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
