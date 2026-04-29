"use client";

import { useEffect, useState } from "react";

import {
  getFavoriteStatus,
  toggleFavorite,
  type FavoriteContentType,
} from "@/lib/favorites";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="relative z-[1] h-[18px] w-[18px]"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.6l2.57 5.21 5.75.84-4.16 4.06.98 5.73L12 16.74 6.86 19.44l.98-5.73-4.16-4.06 5.75-.84L12 3.6z" />
    </svg>
  );
}

export default function FavoriteButton({
  contentType,
  contentId,
  metadata,
  label = "Favorite gallery",
  compact = false,
}: {
  contentType: FavoriteContentType;
  contentId: string;
  metadata?: Record<string, unknown>;
  label?: string;
  compact?: boolean;
}) {
  const [favorited, setFavorited] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const status = await getFavoriteStatus(contentType, contentId);
      if (!active) return;
      setFavorited(status.favorited);
      setCount(status.count);
    }

    void load();

    return () => {
      active = false;
    };
  }, [contentType, contentId]);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      const status = await toggleFavorite({
        contentType,
        contentId,
        current: favorited,
        metadata,
      });
      setFavorited(status.favorited);
      setCount(status.count);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Favorite could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  const buttonLabel = favorited ? `Remove ${label}` : label;

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "inline-flex flex-col gap-1"}>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleToggle();
          }}
          disabled={loading || !contentId}
          aria-pressed={favorited}
          aria-label={buttonLabel}
          title={buttonLabel}
          className={[
            "group relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] ring-1 transition disabled:cursor-not-allowed disabled:opacity-60",
            compact ? "h-10 w-10" : "h-11 w-11",
            favorited
              ? "bg-[linear-gradient(145deg,rgba(72,203,255,0.32),rgba(104,80,255,0.34))] text-white ring-cyan-300/30 shadow-[0_10px_30px_rgba(67,190,255,0.22)]"
              : "bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] text-white/78 ring-white/12 hover:bg-[linear-gradient(145deg,rgba(72,203,255,0.18),rgba(104,80,255,0.18))] hover:text-white",
          ].join(" ")}
        >
          <span
            aria-hidden="true"
            className={[
              "pointer-events-none absolute inset-[1px] rounded-[15px]",
              favorited
                ? "bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.32),rgba(255,255,255,0)_52%),linear-gradient(180deg,rgba(13,22,40,0.18),rgba(13,22,40,0.42))]"
                : "bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),rgba(255,255,255,0)_48%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.12))]",
            ].join(" ")}
          />
          <StarIcon filled={favorited} />
        </button>

        <span className="min-w-[28px] rounded-full bg-black/18 px-2 py-1 text-center text-[11px] font-semibold leading-none text-white/86 ring-1 ring-white/10">
          {count}
        </span>
      </div>

      {message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
    </div>
  );
}
