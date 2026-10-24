"use client";

import { useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { Field, Sheet, inputClass } from "@/components/wants/Sheet";
import { getStoredActiveProfileId } from "@/lib/auth";
import { parseMoneyInput } from "@/lib/moneyInput";
import { acquireCopies } from "@/lib/wantAcquire";
import { acquiredOf, quantityOf } from "@/lib/wantsCore";
import type { WishlistItem } from "@/lib/wishlistModel";

/**
 * Acquired: the details VLTD already knows are filled in and shown; the person says how many copies arrived and what they actually paid (or leaves the cost
 * unknown). The want changes only after the Vault records are saved: if the save fails, nothing is marked.
 */
export default function AcquireSheet({ want, onClose, onSaved }: { want: WishlistItem; onClose: () => void; onSaved: (updated: WishlistItem) => void }) {
  const total = quantityOf(want);
  const left = total - acquiredOf(want);
  const [count, setCount] = useState(String(left));
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ ids: string[]; pending: boolean; complete: boolean } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const money = parseMoneyInput(paid, { label: "What you paid" });
    if (!money.ok) return setError(money.message);
    setBusy(true);
    const result = await acquireCopies(want, { count: Number(count), paidEach: money.blank ? undefined : money.value, profileId: getStoredActiveProfileId() || undefined });
    setBusy(false);
    if (!result.ok) return setError(result.reason);
    onSaved(result.want);
    setDone({ ids: result.itemIds, pending: result.pending, complete: result.want.status === "acquired" });
  }

  const known = [want.series, want.edition, want.category].filter(Boolean).join(" · ");
  return (
    <Sheet title={`Acquired: ${want.title}`} onClose={onClose}>
      {done ? (
        <div className="flex flex-col gap-3" role="status">
          <p className="text-sm">{done.complete ? "All copies are in your Vault." : `${acquiredOf({ ...want, quantityAcquired: (want.quantityAcquired ?? 0) + done.ids.length })} of ${total} received. The rest stay on your list.`}</p>
          {done.pending ? <p className="text-sm" style={{ color: "var(--muted)" }}>Saved on this device; it will upload to your account when you are online.</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <PillButton href={`/vault/item/${encodeURIComponent(done.ids[done.ids.length - 1])}`}>Add photos and details</PillButton>
            <PillButton variant="primary" onClick={onClose}>Done</PillButton>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3" noValidate>
          <p className="text-sm" style={{ color: "var(--muted)" }}>This adds the copies you received to your Vault with these details filled in{known ? `: ${known}` : ""}. Nothing is bought or ordered by VLTD.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Received now (of ${left} still to get)`}><input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" className={inputClass} aria-label="Copies received now" /></Field>
            <Field label="What I paid (each)" hint="Leave empty if you do not know. It is not filled in from the expected or target price.">
              <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={inputClass} placeholder="Unknown" aria-label="What I paid for each copy" />
            </Field>
          </div>
          {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <PillButton onClick={onClose}>Cancel</PillButton>
            <PillButton type="submit" variant="primary" disabled={busy}>{busy ? "Saving to your Vault…" : "Save to my Vault"}</PillButton>
          </div>
        </form>
      )}
    </Sheet>
  );
}
