"use client";

import { useEffect, useState } from "react";

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

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "grid gap-1"}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleToggle();
        }}
        disabled={loading || !contentId}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-60",
          compact ? "min-h-[30px] px-2.5 text-[11px]" : "min-h-[38px] px-4 text-sm",
          favorited
            ? "bg-rose-500/18 text-rose-100 ring-rose-300/30"
            : "bg-white/8 text-white/86 ring-white/12 hover:bg-white/12",
        ].join(" ")}
        aria-pressed={favorited}
      >
        <span aria-hidden="true">{favorited ? "♥" : "♡"}</span>
        <span>{compact ? count : `${favorited ? "Favorited" : label} · ${count}`}</span>
      </button>
      {message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
    </div>
  );
}
