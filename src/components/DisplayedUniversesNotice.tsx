"use client";

import Link from "next/link";
import { useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { showToast } from "@/lib/toast";

// Says, wherever the owner's collection is filtered by "Universes displayed", that it is filtered, how much is held back, and offers Show all.
// Nothing is deleted: the held-back items are in the account, in exports and in insurance documents.
export default function DisplayedUniversesNotice({
  hiddenCount,
  hiddenUniverses,
  onShowAll,
  className = "",
}: {
  hiddenCount: number;
  hiddenUniverses: number;
  onShowAll: () => Promise<boolean>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (hiddenCount <= 0) return null;
  return (
    <div
      role="status"
      data-testid="displayed-universes-notice"
      className={`flex flex-wrap items-center gap-3 rounded-[8px] px-4 py-2.5 text-sm ring-1 ring-[color:var(--border)] ${className}`}
      style={{ background: "var(--surface)", color: "var(--muted)" }}
    >
      <span>
        Your Universes displayed setting is hiding {hiddenCount.toLocaleString("en-US")} {hiddenCount === 1 ? "item" : "items"} from {hiddenUniverses === 1 ? "1 universe" : `${hiddenUniverses} universes`}. Nothing was deleted.
      </span>
      <PillButton
        size="compact"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onShowAll();
          setBusy(false);
          if (!ok) showToast("Could not change the setting. Try again.");
        }}
      >
        Show all
      </PillButton>
      <Link href="/account?section=preferences" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>Change setting</Link>
    </div>
  );
}
