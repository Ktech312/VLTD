"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { emitVaultUpdate } from "@/lib/vaultEvents";
import { saveItem, type VaultItem } from "@/lib/vaultModel";
import { hasSupabaseEnv, upsertVaultItemToSupabase } from "@/lib/vaultCloud";

type ItemVisibilityToggleProps = {
  item: VaultItem;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
  onChange?: (item: VaultItem) => void;
};

export default function ItemVisibilityToggle({
  item,
  size = "sm",
  showLabel = false,
  className = "",
  onChange,
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
  const Icon = isPublic ? Eye : EyeOff;

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
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full ring-1 backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-60",
          size === "md" ? "h-9 px-3 text-xs font-semibold" : "h-7 min-w-7 px-2 text-[10px] font-semibold",
          isPublic
            ? "bg-[color:var(--theme-gold,#F5B548)] text-[#0A0800] ring-[color:var(--theme-gold,#F5B548)] shadow-[0_0_14px_rgba(245,181,72,0.28)]"
            : "bg-black/70 text-white/78 ring-white/15 hover:text-white",
        ].join(" ")}
      >
        <Icon size={size === "md" ? 15 : 13} strokeWidth={2.2} aria-hidden="true" />
        {showLabel ? <span>{label}</span> : null}
      </button>
      {message ? <div className="max-w-[220px] text-right text-[10px] text-rose-200">{message}</div> : null}
    </div>
  );
}
