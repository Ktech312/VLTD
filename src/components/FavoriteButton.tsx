"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";

import {
  getFavoriteStatus,
  toggleFavorite,
  type FavoriteContentType,
} from "@/lib/favorites";

export default function FavoriteButton({
  contentType,
  contentId,
  metadata,
  label = "Favorite",
  compact = false,
  showMessage = true,
  className = "",
}: {
  contentType: FavoriteContentType;
  contentId: string;
  metadata?: Record<string, unknown>;
  label?: string;
  compact?: boolean;
  showMessage?: boolean;
  className?: string;
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
    <div className={[compact ? "inline-flex flex-col items-end gap-1" : "inline-flex flex-col gap-1", className].filter(Boolean).join(" ")}>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleToggle();
          }}
          disabled={loading || !contentId}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
          }}
          aria-pressed={favorited}
          aria-label={buttonLabel}
          title={buttonLabel}
          className={[
            "pointer-events-auto inline-flex items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
            compact ? "h-7 w-7" : "h-9 w-9",
            favorited
              ? "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]"
              : "text-white/72 hover:text-cyan-200",
          ].join(" ")}
        >
          <AppIcon name="star" strokeWidth={1.9} filled={favorited} size={compact ? 16 : 20} />
        </button>

        <span className={["font-semibold leading-none text-white/82", compact ? "text-[10px]" : "text-xs"].join(" ")}>{count}</span>
      </div>

      {showMessage && message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
    </div>
  );
}
