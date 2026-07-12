"use client";

import { isOnline, timeAgo } from "@/lib/presence";

// Small presence indicator. `label` adds "Online" / "Active 3m ago" text next
// to the dot; otherwise it's just the dot (for avatar corners).
export default function OnlineDot({
  lastSeenAt,
  label = false,
  size = 10,
  className = "",
}: {
  lastSeenAt?: string | null;
  label?: boolean;
  size?: number;
  className?: string;
}) {
  const online = isOnline(lastSeenAt);

  if (!label) {
    return (
      <span
        aria-label={online ? "Online" : "Offline"}
        title={online ? "Online" : lastSeenAt ? `Active ${timeAgo(lastSeenAt)}` : "Offline"}
        className={`inline-block rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          background: online ? "#4ade80" : "rgba(255,255,255,0.28)",
          boxShadow: online ? "0 0 8px rgba(74,222,128,0.7)" : "none",
        }}
      />
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      <span
        className="inline-block rounded-full"
        style={{
          width: size,
          height: size,
          background: online ? "#4ade80" : "rgba(255,255,255,0.28)",
          boxShadow: online ? "0 0 8px rgba(74,222,128,0.7)" : "none",
        }}
      />
      <span style={{ color: online ? "#4ade80" : "var(--muted2, #7D7054)" }}>
        {online ? "Online" : lastSeenAt ? `Active ${timeAgo(lastSeenAt)}` : "Offline"}
      </span>
    </span>
  );
}
