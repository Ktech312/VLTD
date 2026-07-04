"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getStoredActiveProfileId } from "@/lib/auth";
import { fetchFollowingFeed, timeAgo, type FeedNotification } from "@/lib/notificationFeed";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app";

function notifIcon(type: FeedNotification["type"]) {
  return type === "announced" ? "📢" : "🏛️";
}

function notifLabel(type: FeedNotification["type"]) {
  return type === "announced" ? "Updated exhibition" : "New exhibition";
}

export default function NotificationsPage() {
  const [feed, setFeed] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) { setError("Sign in to see notifications."); setLoading(false); return; }
        const profileId = getStoredActiveProfileId() ?? user.id;
        const items = await fetchFollowingFeed(profileId);
        setFeed(items);
      } catch {
        setError("Could not load notifications.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-2xl px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            New exhibitions from collectors you follow
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-[color:var(--muted)]">
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[color:var(--border)] p-6 text-center text-sm text-[color:var(--muted)]">
            {error}
          </div>
        )}

        {!loading && !error && feed.length === 0 && (
          <div className="rounded-xl border border-[color:var(--border)] p-10 text-center">
            <div className="text-3xl mb-3">🔔</div>
            <p className="text-sm font-medium text-[color:var(--fg)]">No activity yet</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Follow collectors to see when they publish exhibitions.
            </p>
            <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-[color:var(--gold,#F5B548)] underline-offset-2 hover:underline">
              Browse Discover
            </Link>
          </div>
        )}

        {!loading && feed.length > 0 && (
          <div className="flex flex-col gap-3">
            {feed.map((n) => {
              const href = n.publicToken
                ? `/museum/share/${n.publicToken}`
                : `${BASE}/museum/${n.galleryId}/guest`;

              return (
                <Link
                  key={n.id}
                  href={href}
                  className="group flex items-start gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:border-[color:var(--gold,#F5B548)]/40 hover:-translate-y-0.5"
                >
                  {/* Icon */}
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold,#F5B548)]/10 text-lg">
                    {notifIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold,#F5B548)]/70">
                        {notifLabel(n.type)}
                      </span>
                      {n.itemCount !== undefined && (
                        <span className="text-[11px] text-[color:var(--muted)]">
                          · {n.itemCount} item{n.itemCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-semibold text-[color:var(--fg)]">{n.galleryTitle}</p>
                    {n.collectorName && (
                      <p className="mt-0.5 text-sm text-[color:var(--muted)]">by {n.collectorName}</p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-xs text-[color:var(--muted)]">{timeAgo(n.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && feed.length > 0 && (
          <p className="mt-6 text-center text-xs text-[color:var(--muted)]">
            Showing the last {feed.length} update{feed.length !== 1 ? "s" : ""} from collectors you follow
          </p>
        )}
      </div>
    </div>
  );
}
