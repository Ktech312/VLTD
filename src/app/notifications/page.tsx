"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getStoredActiveProfileId } from "@/lib/auth";
import { fetchAlerts, timeAgo, type AlertItem } from "@/lib/notificationFeed";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";

const LAST_SEEN_KEY = "vltd_alerts_last_seen";

function kindGlyph(kind: AlertItem["kind"]): GlyphName {
  return kind === "bug" ? "bug" : kind === "message" ? "message" : "exhibition";
}

function kindLabel(kind: AlertItem["kind"]) {
  return kind === "bug" ? "Bug" : kind === "message" ? "Message" : "Follow";
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await getCurrentUser();
        if (!user) { setError("Sign in to see your alerts."); setLoading(false); return; }
        const profileId = getStoredActiveProfileId() ?? user.id;
        const alerts = await fetchAlerts(profileId);
        setItems(alerts);
        // Opening the page clears the bell's green glow.
        try { window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
      } catch {
        setError("Could not load your alerts.");
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
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Follows, messages on your exhibitions, and bug reports
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

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-[color:var(--border)] p-10 text-center">
            <div className="mb-3 flex justify-center" style={{ color: "var(--gold, #F5B548)" }}>
              <Glyph name="bell" size={30} />
            </div>
            <p className="text-sm font-medium text-[color:var(--fg)]">No activity yet</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Follows, comments on your exhibitions, and bug reports will show up here.
            </p>
            <Link href="/discover" className="mt-4 inline-block text-sm font-semibold text-[color:var(--gold,#F5B548)] underline-offset-2 hover:underline">
              Browse Discover
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((n) => {
              const inner = (
                <>
                  {/* Icon */}
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold,#F5B548)]/10" style={{ color: "var(--gold, #F5B548)" }}>
                    <Glyph name={kindGlyph(n.kind)} size={18} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold,#F5B548)]/70">
                        {kindLabel(n.kind)}
                      </span>
                      <span className="text-[11px] text-[color:var(--muted)]">· {n.title}</span>
                    </div>
                    {n.subtitle && (
                      <p className="mt-1 truncate text-sm text-[color:var(--fg)]">{n.subtitle}</p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-xs text-[color:var(--muted)]">{timeAgo(n.createdAt)}</span>
                </>
              );

              const cls =
                "group flex items-start gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:border-[color:var(--gold,#F5B548)]/40";

              return n.href ? (
                <Link key={n.id} href={n.href} className={`${cls} hover:-translate-y-0.5`}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
