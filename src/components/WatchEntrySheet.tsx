"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { parseMoneyInput } from "@/lib/moneyInput";
import { addWishlistItem, type WishlistItem } from "@/lib/wishlistModel";

// The Watchlist's own "Add Watch": a title, an optional target price and optional notes. It writes an entry to the same list the page already shows
// (the wishlist model: saved on this device and in the account, with its target price and notes editable afterwards). It is not Add Item (nothing is
// added to the Vault) and it looks nothing up: the target price is what the person types.
export default function WatchEntrySheet({ onClose, onAdded }: { onClose: () => void; onAdded: (item: WishlistItem) => void }) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const canSave = title.trim() !== "";

  function save() {
    if (!canSave) return;
    const price = parseMoneyInput(target, { label: "Target price" });
    if (!price.ok) {
      // The form stays exactly as typed.
      setError(price.message);
      return;
    }
    const item = addWishlistItem({
      title: title.trim(),
      targetPrice: price.blank ? undefined : price.value,
      notes: notes.trim() || undefined,
      priority: "medium",
    } as Parameters<typeof addWishlistItem>[0]);
    onAdded(item);
    onClose();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add Watch"
        className="fixed bottom-0 left-0 right-0 z-[10001] mx-auto max-w-xl rounded-t-[24px] px-5 pb-10 pt-6"
        style={{ background: "var(--surface)", boxShadow: "0 -4px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>Add Watch</h2>
          <PillButton onClick={onClose} ariaLabel="Close" title="Close" className="px-0! w-11 md:w-9">
            <AppIcon name="close" size={16} />
          </PillButton>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>What are you watching? *</span>
            <input
              type="text"
              value={title}
              onChange={(event) => { setTitle(event.target.value); setError(""); }}
              placeholder="Amazing Spider-Man #300 CGC 9.8"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Target price (optional)</span>
            <input
              type="text"
              inputMode="decimal"
              value={target}
              onChange={(event) => { setTarget(event.target.value); setError(""); }}
              placeholder="150"
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>The price at which you would buy. Leave it blank if you have not decided.</p>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20 w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>
        </div>
        {error ? <p role="alert" data-testid="watch-entry-error" className="mt-4 text-[13px] font-semibold text-red-400">{error}</p> : null}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="mt-6 w-full rounded-full py-3.5 text-[14px] font-bold transition"
          style={{ background: canSave ? "var(--theme-gold)" : "var(--pill)", color: canSave ? "var(--ink, #0A0800)" : "var(--muted2)" }}
        >
          Add to Watchlist
        </button>
      </div>
    </>,
    document.body
  );
}
