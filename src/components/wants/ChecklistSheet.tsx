"use client";

import { useEffect, useMemo, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { Toggle } from "@/components/ui/Toggle";
import { Sheet } from "@/components/wants/Sheet";
import { downloadCsv } from "@/lib/exportCsv";
import { showToast } from "@/lib/toast";
import { DEFAULT_SHARE_FIELDS, checklistText, isOpen, plannedTotals, releaseLabel, remainingOf, formatMoney, type ChecklistOptions, type ShareFields } from "@/lib/wantsCore";
import { disableWishlistShare, enableWishlistShare, loadWishlistShareFields, loadWishlistShareToken, saveWishlistShareFields, wishlistShareUrl } from "@/lib/wishlistShare";
import type { WishlistItem } from "@/lib/wishlistModel";

/** The checklist to take to a show or a shop (print, copy, download) and the opt-in public link. Private notes and budgets stay private unless switched on. */
export default function ChecklistSheet({ items, onClose }: { items: WishlistItem[]; onClose: () => void }) {
  const [opts, setOpts] = useState<Required<ChecklistOptions>>({ includeDates: true, includePrices: false, includeNotes: false, includeShops: false });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<ShareFields>(DEFAULT_SHARE_FIELDS);
  const [fieldsSupported, setFieldsSupported] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadWishlistShareToken().then((r) => { if (active) setToken(r.token); });
    void loadWishlistShareFields().then((r) => { if (active) { setFields(r.fields); setFieldsSupported(r.supported); } });
    return () => { active = false; };
  }, []);

  const open = useMemo(() => items.filter(isOpen), [items]);
  const text = useMemo(() => checklistText(items, opts), [items, opts]);
  const totals = plannedTotals(items);

  async function toggleShare() {
    setBusy(true); setError("");
    if (token) {
      const r = await disableWishlistShare();
      if (r.ok) setToken(null); else setError(r.error ?? "Could not turn sharing off.");
    } else {
      const r = await enableWishlistShare();
      if (r.token) setToken(r.token); else setError(r.error ?? "Could not turn sharing on.");
    }
    setBusy(false);
  }
  async function setField(key: keyof ShareFields) {
    if (key === "titles") return;
    const next = { ...fields, [key]: !fields[key] } as ShareFields;
    setFields(next);
    const r = await saveWishlistShareFields(next);
    if (!r.ok) { setFields(fields); setError("Could not change what is shared. Nothing changed."); }
  }

  function printUrl() {
    const q = new URLSearchParams();
    if (opts.includeDates) q.set("d", "1");
    if (opts.includePrices) q.set("p", "1");
    if (opts.includeNotes) q.set("n", "1");
    if (opts.includeShops) q.set("s", "1");
    return `/watchlist/checklist?${q.toString()}`;
  }

  async function copyText() {
    try { await navigator.clipboard.writeText(text); showToast("Checklist copied"); } catch { showToast("Could not copy. Select the text and copy it."); }
  }
  function download() {
    const cols = ["Item", "Edition", "Quantity to get", "Release", ...(opts.includeShops ? ["Shop"] : []), ...(opts.includePrices ? ["Expected price each"] : []), ...(opts.includeNotes ? ["Notes"] : [])];
    const rows = open.map((w) => ({
      Item: w.title, Edition: w.edition ?? "", "Quantity to get": String(remainingOf(w)), Release: releaseLabel(w),
      Shop: w.shop ?? "", "Expected price each": typeof w.price === "number" ? String(w.price) : "", Notes: w.notes ?? "",
    }));
    downloadCsv("vltd-checklist.csv", rows, cols);
  }

  const shareRows: [keyof ShareFields, string][] = [["quantities", "Quantities"], ["dates", "Release dates"], ["prices", "Expected prices"], ["shops", "Shops"], ["notes", "My notes"]];
  const checklistRows: [keyof Required<ChecklistOptions>, string][] = [["includeDates", "Release dates"], ["includePrices", "Expected prices"], ["includeShops", "Shops"], ["includeNotes", "My notes"]];
  return (
    <Sheet title="Checklist and sharing" onClose={onClose} wide>
      <section aria-label="Checklist" className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {checklistRows.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 text-sm"><Toggle on={opts[key]} onChange={() => setOpts((o) => ({ ...o, [key]: !o[key] }))} ariaLabel={`Include ${label}`} /><span>{label}</span></div>
          ))}
        </div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-[8px] border border-[rgba(203,208,213,0.18)] p-3 text-[12px]" style={{ fontFamily: "ui-monospace, Menlo, monospace" }} aria-label="Checklist preview">{text}</pre>
        <div className="flex flex-wrap gap-2">
          <PillButton href={printUrl()}>Print checklist</PillButton>
          <PillButton onClick={() => void copyText()}>Copy as text</PillButton>
          <PillButton onClick={download}>Download as a file</PillButton>
        </div>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          {open.length} open {open.length === 1 ? "want" : "wants"}. Planned total {formatMoney(totals.total)} from {totals.priced} priced{totals.unpriced ? `; ${totals.unpriced} without a price are not counted` : ""}. No checkout, payments or messages to shops: this is a list to take with you.
        </p>
      </section>
      <section aria-label="Sharing" className="mt-5 flex flex-col gap-3 border-t border-[rgba(203,208,213,0.18)] pt-4">
        <div className="flex items-center gap-3 text-sm"><Toggle on={Boolean(token)} onChange={() => !busy && void toggleShare()} ariaLabel="Share a read-only link" /><span>Share a read-only link (you can turn it off at any time)</span></div>
        {token ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <code className="min-w-0 max-w-full truncate rounded border border-[rgba(203,208,213,0.18)] px-2 py-1 text-[12px]">{wishlistShareUrl(token)}</code>
              <PillButton size="compact" onClick={async () => { try { await navigator.clipboard.writeText(wishlistShareUrl(token)); showToast("Link copied"); } catch { showToast("Could not copy the link."); } }}>Copy link</PillButton>
            </div>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>Titles, pictures, categories and editions are shared. Everything below is private until you switch it on.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {shareRows.map(([key, label]) => (
                <div key={key} className="flex items-center gap-3 text-sm"><Toggle on={Boolean(fields[key])} onChange={() => void setField(key)} ariaLabel={`Share ${label}`} /><span>{label}</span></div>
              ))}
            </div>
            {!fieldsSupported ? <p className="text-[12px]" style={{ color: "var(--theme-gold)" }}>Choosing what is shared is not available yet on your account. Until it is, the link shows titles, pictures, categories and release dates only: never notes, prices or target prices.</p> : null}
          </>
        ) : null}
        {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      </section>
    </Sheet>
  );
}
