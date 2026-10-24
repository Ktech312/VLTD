"use client";

import { useEffect, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { checklistText, formatMoney, isOpen, plannedTotals, releaseLabel, remainingOf } from "@/lib/wantsCore";
import { loadWishlist, syncWishlistFromSupabase, type WishlistItem } from "@/lib/wishlistModel";

// The printable checklist. Marked as a print document, so the site's bars do not print and the text prints black on white.
// Prices, notes and shops print only when the person switched them on in the sheet that opened this page.
export default function ChecklistPage() {
  const [items, setItems] = useState<WishlistItem[]>(() => loadWishlist());
  const [opts, setOpts] = useState({ d: true, p: false, n: false, s: false });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setOpts({ d: q.get("d") === "1", p: q.get("p") === "1", n: q.get("n") === "1", s: q.get("s") === "1" });
    void syncWishlistFromSupabase().then(setItems);
  }, []);
  const open = items.filter(isOpen).sort((a, b) => a.title.localeCompare(b.title));
  const totals = plannedTotals(items);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <main className="vltd-print-document mx-auto max-w-3xl px-6 py-8" style={{ color: "var(--fg)" }}>
      <div className="vltd-no-print mb-4 flex flex-wrap gap-2">
        <PillButton href="/watchlist">Back to Watchlist</PillButton>
        <PillButton variant="primary" onClick={() => window.print()}>Print</PillButton>
        <PillButton onClick={() => void navigator.clipboard?.writeText(checklistText(items, { includeDates: opts.d, includePrices: opts.p, includeNotes: opts.n, includeShops: opts.s }))}>Copy as text</PillButton>
      </div>
      <h1 className="text-2xl font-bold">Checklist</h1>
      <p className="vltd-print-muted text-sm" style={{ color: "var(--muted)" }}>{today} · {open.length} {open.length === 1 ? "item" : "items"}</p>
      {open.length === 0 ? <p className="mt-4 text-sm">Nothing on the list right now.</p> : null}
      <ul className="mt-4 flex flex-col">
        {open.map((w) => (
          <li key={w.id} className="flex gap-3 border-b border-[rgba(128,128,128,0.35)] py-2 text-[14px]">
            <span aria-hidden className="mt-1 inline-block h-4 w-4 shrink-0 rounded-[3px] border border-current" />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{w.title}</span>
              <span className="vltd-print-muted" style={{ color: "var(--muted)" }}>{[w.edition, `x${remainingOf(w)}`, opts.d ? releaseLabel(w) : null, opts.s ? w.shop : null, opts.p && typeof w.price === "number" ? formatMoney(w.price) : null].filter(Boolean).map((t) => ` · ${t}`).join("")}</span>
              {opts.n && w.notes ? <span className="vltd-print-muted block text-[12px]" style={{ color: "var(--muted)" }}>{w.notes}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {opts.p ? <p className="mt-4 text-sm font-semibold">Planned total {formatMoney(totals.total)} from {totals.priced} priced{totals.unpriced ? `; ${totals.unpriced} without a price not counted` : ""}</p> : null}
    </main>
  );
}
