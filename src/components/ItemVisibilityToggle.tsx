"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";

import { emitVaultUpdate } from "@/lib/vaultEvents";
import { saveItem, type VaultItem } from "@/lib/vaultModel";
import { hasSupabaseEnv, upsertVaultItemToSupabase } from "@/lib/vaultCloud";

type ItemVisibilityToggleProps = {
  item: VaultItem;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
  onChange?: (item: VaultItem) => void;
  /** "corner": tight padding, icon pushed to the bottom-left of its own
   * pill instead of centered - used where the toggle sits over a photo
   * corner (the vault card) and needs to hug that corner as closely as
   * possible without spilling outside the pill. */
  align?: "center" | "corner";
};

// Fixed, theme-independent neon colors: red while hidden, green while
// shared. EK asked for this exact pairing in both Dark and Light mode,
// so these are plain hex values, not theme tokens.
const NEON_RED = "#FF1744";
const NEON_GREEN = "#39FF14";

export default function ItemVisibilityToggle({
  item,
  size = "sm",
  showLabel = false,
  className = "",
  onChange,
  align = "center",
}: ItemVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(Boolean(item.isPublic));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsPublic(Boolean(item.isPublic));
  }, [item.id, item.isPublic]);

  async function handleToggle() {
    if (loading) return;

    const previousPublic = isPublic;
    const nextItem = { ...item, isPublic: !previousPublic };

    setLoading(true);
    setMessage("");
    setIsPublic(nextItem.isPublic ?? false);
    saveItem(nextItem);
    onChange?.(nextItem);
    emitVaultUpdate();

    try {
      if (hasSupabaseEnv()) {
        await upsertVaultItemToSupabase(nextItem);
      }
    } catch (error) {
      const reverted = { ...item, isPublic: previousPublic };
      setIsPublic(previousPublic);
      saveItem(reverted);
      onChange?.(reverted);
      emitVaultUpdate();
      setMessage(error instanceof Error ? error.message : "Visibility could not be updated.");
    } finally {
      setLoading(false);
    }
  }

  const label = isPublic ? "Public" : "Private";
  const buttonLabel = isPublic ? "Make item private" : "Make item public";
  const iconName = isPublic ? "eye" : "eyeOff";

  return (
    <div className={["pointer-events-auto inline-flex flex-col items-end gap-1", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleToggle();
        }}
        disabled={loading || !item.id}
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
        aria-pressed={isPublic}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={[
          "inline-flex shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 vltd-keep-color hover:opacity-70",
          align === "corner" ? "items-end justify-start p-1" : "items-center justify-center gap-1.5",
          size === "md" ? "h-9 px-3 text-xs font-semibold" : align === "corner" ? "h-6 min-w-6 text-[10px] font-semibold" : "h-7 min-w-7 px-2 text-[10px] font-semibold",
        ].join(" ")}
        style={{ "--vltd-keep-color": isPublic ? NEON_GREEN : NEON_RED } as React.CSSProperties}
      >
        <AppIcon
          name={iconName}
          size={size === "md" ? 15 : 13}
          strokeWidth={2.2}
          className="vltd-keep-color"
          style={{ filter: `drop-shadow(0 0 3px ${isPublic ? NEON_GREEN : NEON_RED})` }}
        />
        {showLabel ? <span>{label}</span> : null}
      </button>
      {message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
    </div>
  );
}
