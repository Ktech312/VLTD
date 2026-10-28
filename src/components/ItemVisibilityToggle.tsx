"use client";

import { pillClassName, type PillVariant } from "@/components/ui/PillButton";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { applyVisibilityToExhibits, exhibitNamesForItem, isHiddenInExhibits, makeBlurThumb } from "@/lib/hiddenItems";

import { emitVaultUpdate } from "@/lib/vaultEvents";
import type { VaultItem } from "@/lib/vaultModel";
import { setItemPublic } from "@/lib/itemVisibility";

// Compact shared pill: 32px (28px on desktop) with a 44px touch target on phones.
const cp = (variant: PillVariant = "default", extra = "") => pillClassName(variant, false, extra, "compact");

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
  const [confirmNames, setConfirmNames] = useState<string[] | null>(null);
  // An item that sits in an exhibit is shown there by default. The eye then controls that
  // exhibit's viewers only (green = shown in it, red = "Hidden Item"); it never makes the
  // item public to the whole world. Items in no exhibit keep the plain public/private eye.
  const [exhibitNames, setExhibitNames] = useState<string[]>([]);
  const [exhibitHidden, setExhibitHidden] = useState(false);

  useEffect(() => {
    setIsPublic(Boolean(item.isPublic));
  }, [item.id, item.isPublic]);

  useEffect(() => {
    setExhibitNames(exhibitNamesForItem(item.id));
    setExhibitHidden(isHiddenInExhibits(item.id));
  }, [item.id]);

  const inExhibit = exhibitNames.length > 0;
  const showing = inExhibit ? !exhibitHidden : isPublic;

  async function handleToggle(confirmed = false) {
    if (loading) return;

    if (inExhibit) {
      const hiding = !exhibitHidden;
      if (hiding && !confirmed) {
        setConfirmNames(exhibitNames);
        return;
      }
      setLoading(true);
      setMessage("");
      try {
        const thumb = hiding ? await makeBlurThumb(item) : undefined;
        await applyVisibilityToExhibits(item, thumb, hiding ? "hide" : "show");
        setExhibitHidden(hiding);
        emitVaultUpdate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not update the exhibit.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setMessage("");

    // The same routine the Share panel uses when it asks "Turn on public sharing?" (see lib/itemVisibility.ts).
    const result = await setItemPublic({ ...item, isPublic }, !isPublic, {
      onLocal: (local) => {
        setIsPublic(local.isPublic ?? false);
        onChange?.(local);
      },
    });
    if (!result.ok) setMessage(result.error ?? "Visibility could not be updated.");
    setLoading(false);
  }

  const label = inExhibit ? (showing ? "Shown in exhibit" : "Hidden in exhibit") : isPublic ? "Public" : "Private";
  const buttonLabel = inExhibit
    ? showing
      ? "Hide this item in your exhibits"
      : "Show this item in your exhibits again"
    : isPublic
      ? "Make item private"
      : "Make item public";
  const iconName = showing ? "eye" : "eyeOff";

  return (
    <div className={["pointer-events-auto inline-flex flex-col items-end gap-1", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void handleToggle(false);
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
        aria-pressed={showing}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={[
          "relative inline-flex shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 vltd-keep-color hover:opacity-70 max-md:after:absolute max-md:after:-inset-2.5 max-md:after:content-['']",
          align === "corner" ? "items-end justify-start p-1" : "items-center justify-center gap-1.5",
          size === "md" ? "h-9 px-3 text-xs font-semibold" : align === "corner" ? "h-6 min-w-6 text-[10px] font-semibold" : "h-7 min-w-7 px-2 text-[10px] font-semibold",
        ].join(" ")}
        style={{ "--vltd-keep-color": showing ? NEON_GREEN : NEON_RED } as React.CSSProperties}
      >
        <AppIcon
          name={iconName}
          size={size === "md" ? 15 : 13}
          strokeWidth={2.2}
          className="vltd-keep-color"
          style={{ filter: `drop-shadow(0 0 3px ${showing ? NEON_GREEN : NEON_RED}) drop-shadow(0 1px 2px rgba(0,0,0,0.6))` }}
        />
        {showLabel ? <span>{label}</span> : null}
      </button>
      {message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
      {confirmNames && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/60 p-4"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmNames(null);
              }}
            >
              <div
                role="dialog"
                aria-label="Hide item"
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-[340px] rounded-[14px] bg-[color:var(--surface-strong)] p-4 text-sm ring-1 ring-[color:var(--border)]"
              >
                <div className="text-[color:var(--fg)]">
                  This item is in {confirmNames.length === 1 ? "Exhibit" : "Exhibits"}{" "}
                  {confirmNames.map((name) => `"${name}"`).join(", ")}, this will hide it from your viewers.
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmNames(null)}
                    className={pillClassName("default")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmNames(null);
                      void handleToggle(true);
                    }}
                    className={pillClassName("active")}
                  >
                    Hide item
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
