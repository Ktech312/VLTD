"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { fetchFollowingFeed } from "@/lib/notificationFeed";

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

      // 1. Following feed (per-user, reliable).
      try {
        const feed = await fetchFollowingFeed(profileId, 20);
        for (const f of feed) newest = Math.max(newest, f.createdAt);
      } catch {
        /* ignore */
      }

      // 2. Your own bug reports (updates/new). Scoped to this profile so it can't
      //    glow for unrelated activity. Guarded — if the column/table differs it
      //    simply contributes nothing.
      try {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data } = await supabase
            .from("bug_reports")
            .select("created_at")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(1);
          const ts = data?.[0]?.created_at;
          if (ts) newest = Math.max(newest, new Date(ts).getTime());
        }
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
        background: active ? "rgba(245,181,72,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${
          hasUnread
            ? "rgba(82,194,122,0.65)"
            : active
              ? "rgba(245,181,72,0.35)"
              : "rgba(255,255,255,0.08)"
        }`,
        boxShadow: hasUnread ? "0 0 0 1px rgba(82,194,122,0.35), 0 0 12px rgba(82,194,122,0.55)" : "none",
        color: "var(--theme-text-primary, #F0EAD6)",
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
