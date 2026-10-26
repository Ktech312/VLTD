"use client";

import { useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { Field, Sheet, inputClass } from "@/components/wants/Sheet";
import WantForm from "@/components/wants/WantForm";
import { fetchUpcomingComicsChecked, formatStoreDate, type UpcomingIssue } from "@/lib/comicUpcoming";
import { issueToRelease } from "@/lib/pullRules";
import { findWantForIdentity, isRemoved, restoredFromRemoved, ruleIdentityOfItem, wantFromRelease, wantFromWatching } from "@/lib/wantsCore";
import type { WatchlistItem } from "@/lib/watchlistModel";
import { loadWishlist, saveWishlistItem, wantIdNamespace, type WishlistItem } from "@/lib/wishlistModel";

export type AddMode = "catalog" | "watched" | "link" | "manual";

const MODES: { key: AddMode; label: string }[] = [
  { key: "catalog", label: "From a catalog" },
  { key: "watched", label: "A watched item" },
  { key: "link", label: "A product link" },
  { key: "manual", label: "Type it in" },
];

/**
 * Add a want four ways: from the comic catalog, from something being watched (someone else's public item), from a product link, or typed in (any category).
 * The catalog covers comics only; there is no release feed for card products or toys, so those are typed in.
 */
export default function AddWantSheet({
  onClose,
  onAdded,
  watching,
  initialMode = "manual",
  ruleId,
  presetSeries,
}: {
  onClose: () => void;
  onAdded: (item: WishlistItem) => void;
  watching: WatchlistItem[];
  initialMode?: AddMode;
  ruleId?: string;
  presetSeries?: string;
}) {
  const [mode, setMode] = useState<AddMode>(initialMode);
  return (
    <Sheet title={ruleId ? `Add a release: ${presetSeries ?? ""}` : "Add a want"} onClose={onClose} wide>
      {!ruleId ? (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="How to add">
          {MODES.map((m) => (
            <PillButton key={m.key} variant={mode === m.key ? "active" : "default"} pressed={mode === m.key} onClick={() => setMode(m.key)}>{m.label}</PillButton>
          ))}
        </div>
      ) : null}
      {mode === "catalog" ? <CatalogPicker onAdded={(w) => { onAdded(w); onClose(); }} /> : null}
      {mode === "watched" ? <WatchedPicker watching={watching} onAdded={(w) => { onAdded(w); onClose(); }} /> : null}
      {mode === "link" || mode === "manual" ? (
        <WantForm
          key={mode}
          submitLabel="Add to wishlist"
          ruleId={ruleId}
          presetSeries={presetSeries}
          onCancel={onClose}
          onSubmit={(item) => { saveWishlistItem(item); onAdded(item); onClose(); }}
        />
      ) : null}
    </Sheet>
  );
}

function CatalogPicker({ onAdded }: { onAdded: (w: WishlistItem) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<UpcomingIssue[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true); setNote(""); setFailed(false);
    const { data, failed: didFail } = await fetchUpcomingComicsChecked({ series: q.trim(), days: 180, pageSize: 30 });
    setBusy(false);
    if (didFail || !data) { setFailed(true); setIssues(null); return; }
    setIssues(data.results);
  }
  function add(issue: UpcomingIssue) {
    const release = issueToRelease(issue);
    const have = findWantForIdentity(loadWishlist(), release.identity);
    // A release the person removed earlier is brought back by adding it by hand (that is a clear decision), exactly as it was.
    if (have && isRemoved(have)) { const back = restoredFromRemoved(have); saveWishlistItem(back); onAdded(back); return; }
    if (have) return setNote(`${release.title} is already on your list.`);
    const want = wantFromRelease(release, { quantity: 1, seriesName: issue.series, idNamespace: wantIdNamespace() });
    saveWishlistItem(want);
    onAdded(want);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--muted)" }}>The comic catalog lists upcoming issues by series. There is no release catalog for card products or toys, so add those with “Type it in”.</p>
      <form onSubmit={search} className="flex gap-2">
        <Field label="Series or title" className="flex-1"><input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="e.g. a comic series name" autoFocus /></Field>
        <div className="flex items-end"><PillButton type="submit" variant="primary" disabled={busy || q.trim().length < 2}>{busy ? "Searching…" : "Search"}</PillButton></div>
      </form>
      {failed ? <p role="alert" className="text-sm text-red-400">The catalog could not be reached. Try again, or type the comic in.</p> : null}
      {note ? <p role="status" className="text-sm" style={{ color: "var(--theme-gold)" }}>{note}</p> : null}
      {issues && issues.length === 0 ? <p className="text-sm" style={{ color: "var(--muted)" }}>Nothing is listed for that in the next 180 days. Type it in instead.</p> : null}
      <ul className="flex flex-col gap-2">
        {(issues ?? []).slice(0, 20).map((issue) => (
          <li key={issue.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[rgba(203,208,213,0.18)] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{issue.series} #{issue.number}</div>
              <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>{[issue.publisher, formatStoreDate(issue.storeDate), issue.isVariant ? "variant cover" : ""].filter(Boolean).join(" · ")}</div>
            </div>
            <PillButton size="compact" onClick={() => add(issue)}>Add</PillButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WatchedPicker({ watching, onAdded }: { watching: WatchlistItem[]; onAdded: (w: WishlistItem) => void }) {
  const [note, setNote] = useState("");
  if (watching.length === 0) return <p className="text-sm" style={{ color: "var(--muted)" }}>You are not watching any public items yet. Save one from Discover and it will appear here.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--muted)" }}>Watching is not owning. Adding one here makes a want of your own; the watched item stays as it is.</p>
      {note ? <p role="status" className="text-sm" style={{ color: "var(--theme-gold)" }}>{note}</p> : null}
      <ul className="flex flex-col gap-2">
        {watching.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[rgba(203,208,213,0.18)] px-3 py-2">
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{w.title}</div><div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>{w.collectorName ?? "Public exhibition"}</div></div>
            <PillButton size="compact" onClick={() => {
              const want = wantFromWatching(w, Date.now(), wantIdNamespace());
              if (loadWishlist().some((x) => ruleIdentityOfItem(x) === want.sourceIdentity)) return setNote(`${w.title} is already one of your wants.`);
              saveWishlistItem(want); onAdded(want);
            }}>Add to my wants</PillButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
