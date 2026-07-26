"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAlerts } from "@/lib/notificationFeed";

const LAST_SEEN_KEY = "vltd_alerts_last_seen";
const GREEN = "#52C27A";

function IconBell({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * Alerts bell — lives top-right next to the user menu, on mobile + desktop.
 * Glows green when there's new activity the user hasn't seen (compared against a
 * local "last seen" stamp that clears when they open /notifications).
 *
 * Sources today: the following feed (exhibitions from people you follow) + your
 * own bug reports. Comments/messages on your exhibitions can be folded in next.
 */
export default function AlertsBell({ profileId, active }: { profileId?: string; active?: boolean }) {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!profileId) return;

      let lastSeen = 0;
      try {
        lastSeen = Number(window.localStorage.getItem(LAST_SEEN_KEY) ?? 0);
      } catch {
        /* ignore */
      }

      let newest = 0;
      try {
        // Combined feed: follows + comments on your exhibitions + bug reports.
        const alerts = await fetchAlerts(profileId);
        for (const a of alerts) newest = Math.max(newest, a.createdAt);
      } catch {
        /* ignore */
      }

      if (!cancelled) setHasUnread(newest > 0 && newest > lastSeen);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  function markSeen() {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHasUnread(false);
  }

  return (
    <Link
      href="/notifications"
      onClick={markSeen}
      aria-label={hasUnread ? "Alerts — you have new activity" : "Alerts"}
      className="relative flex h-[36px] w-[36px] items-center justify-center rounded-full transition"
      style={{
        background: active ? "rgba(203,208,213,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${
          hasUnread
            ? "rgba(82,194,122,0.65)"
            : active
              ? "rgba(203,208,213,0.35)"
              : "rgba(255,255,255,0.08)"
        }`,
        boxShadow: hasUnread ? "0 0 0 1px rgba(82,194,122,0.35), 0 0 12px rgba(82,194,122,0.55)" : "none",
        color: "var(--theme-text-primary, #ECEDEF)",
      }}
    >
      <IconBell color={hasUnread ? GREEN : "currentColor"} />
      {hasUnread && (
        <span
          className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full"
          style={{ background: GREEN, boxShadow: "0 0 6px rgba(82,194,122,0.9)", border: "1.5px solid #0B0B0B" }}
        />
      )}
    </Link>
  );
}
