"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadWatchlist,
  removeFromWatchlist,
  clearWatchlist,
  syncWatchlistFromSupabase,
  type WatchlistItem,
} from "@/lib/watchlistModel";
import { Glyph } from "@/components/ui/Glyph";

export default function SavedPage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWatchlist(loadWatchlist());
    setLoaded(true);

    let active = true;
    void syncWatchlistFromSupabase().then(() => {
      if (active) setWatchlist(loadWatchlist());
    });

    function onUpdate() { setWatchlist(loadWatchlist()); }
    window.addEventListener("vltd:watchlist-updated", onUpdate);
    return () => {
      active = false;
      window.removeEventListener("vltd:watchlist-updated", onUpdate);
    };
  }, []);

  function handleRemove(id: string) {
    removeFromWatchlist(id);
  }

  function handleClearAll() {
    if (confirm("Clear all saved items?")) clearWatchlist();
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] transition hover:text-[color:var(--fg)]"
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)] uppercase">Saved</div>
            <h1 className="text-2xl font-black tracking-[-0.04em] leading-tight text-text-primary">
              Your Saves
            </h1>
          </div>
          {watchlist.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-[color:var(--muted)] hover:text-red-400 transition"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Empty state */}
        {loaded && watchlist.length === 0 && (
          <div
            className="flex flex-col items-center gap-4 rounded-[24px] px-6 py-14 text-center"
            style={{
              background: "var(--theme-elevated, rgba(20,32,55,0.9))",
              border: "1px solid var(--theme-border, rgba(203,208,213,0.12))",
            }}
          >
            <div className="flex justify-center" style={{ color: "var(--theme-gold)" }}><Glyph name="cards" size={46} /></div>
            <div>
              <h2 className="text-lg font-black text-text-primary">Nothing saved yet</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Use The Flip in Discover to swipe through public items.<br />
                Swipe right to save them here.
              </p>
            </div>
            <Link
              href="/discover"
              className="mt-2 inline-flex h-11 items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:brightness-105"
              style={{ background: "linear-gradient(135deg, #8C9298 0%, #A8AEB4 30%, #C8CDD2 60%, #A8AEB4 100%)" }}
            >
              <Glyph name="cards" size={16} /><span className="ml-2">Open The Flip</span>
            </Link>
          </div>
        )}

        {/* Saved items */}
        {watchlist.length > 0 && (
          <div className="space-y-3">
            {/* Count */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)] uppercase">
                {watchlist.length} saved {watchlist.length === 1 ? "item" : "items"}
              </span>
              <Link
                href="/discover"
                className="text-xs font-semibold transition hover:underline"
                style={{ color: "var(--theme-gold, #C8CDD2)" }}
              >
                <Glyph name="cards" size={14} className="mr-1 inline align-[-2px]" />The Flip →
              </Link>
            </div>

            {/* Cards */}
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] p-4 transition"
                style={{ background: "var(--surface)" }}
              >
                {/* Thumbnail */}
                {item.imageFrontUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageFrontUrl}
                    alt={item.title}
                    className="h-16 w-16 shrink-0 rounded-[12px] object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div
                    className="h-16 w-16 shrink-0 rounded-[12px] flex items-center justify-center text-2xl"
                    style={{ background: "rgba(203,208,213,0.08)", border: "1px solid rgba(203,208,213,0.12)" }}
                  >
                    <Glyph name="cards" size={24} />
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-text-primary">{item.title}</div>
                  {item.subtitle && (
                    <div className="truncate text-xs text-[color:var(--muted)] mt-0.5">{item.subtitle}</div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {item.grade && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em]"
                        style={{ background: "rgba(203,208,213,0.18)", color: "var(--theme-gold, #C8CDD2)" }}
                      >
                        {item.grade}
                      </span>
                    )}
                    {item.currentValue != null && item.currentValue > 0 && (
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        ${item.currentValue.toLocaleString()}
                      </span>
                    )}
                    {item.collectorName && (
                      <span className="text-[11px] text-[color:var(--muted2)]">by {item.collectorName}</span>
                    )}
                  </div>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-red-500/12 hover:text-red-400"
                  aria-label="Remove"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Discover CTA at bottom */}
            <div className="pt-4 flex justify-center">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
                style={{
                  borderColor: "rgba(203,208,213,0.28)",
                  color: "var(--theme-gold, #C8CDD2)",
                  background: "rgba(203,208,213,0.06)",
                }}
              >
                🃏 Find more in The Flip
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
