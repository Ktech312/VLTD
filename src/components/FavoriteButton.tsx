"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";

import {
  getFavoriteStatus,
  toggleFavorite,
  type FavoriteContentType,
} from "@/lib/favorites";

/**
 * "Save" for an item or an exhibition: bookmarks it in the viewer's Favorites. It never copies anyone's item into the viewer's Vault.
 * Works for signed-out visitors too (they are remembered on this device), exactly as Favorites always have.
 */
export default function FavoriteButton({
  contentType,
  contentId,
  metadata,
  label = "Save",
  showMessage = true,
  className = "",
  compact = false,
}: {
  contentType: FavoriteContentType;
  contentId: string;
  metadata?: Record<string, unknown>;
  label?: string;
  showMessage?: boolean;
  className?: string;
  /** The small pill (32px visual, 44px touch area) with 6px corners, for dense headers. */
  compact?: boolean;
}) {
  const [favorited, setFavorited] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const status = await getFavoriteStatus(contentType, contentId);
      if (!active) return;
      setFavorited(status.favorited);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your saved list.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={["inline-flex flex-col items-end gap-1", className].filter(Boolean).join(" ")}>
      <PillButton
        onClick={() => void handleToggle()}
        disabled={loading || !contentId}
        variant={favorited ? "active" : "default"}
        pressed={favorited}
        size={compact ? "compact" : "default"}
        className={compact ? "rounded-[6px]!" : undefined}
        ariaLabel={favorited ? `Saved. Remove from your saved list` : `${label} to your saved list`}
        title={favorited ? "Saved — click to remove" : "Save to your Favorites"}
      >
        <AppIcon name="bookmark" size={16} strokeWidth={1.9} filled={favorited} />
        {favorited ? "Saved" : label}
      </PillButton>
      {showMessage && message ? (
        <div role="alert" className="max-w-[220px] text-right text-[11px] text-rose-200">
          {message}
        </div>
      ) : null}
    </div>
  );
}
