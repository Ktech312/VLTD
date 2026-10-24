"use client";

import { useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { Field, Sheet, inputClass } from "@/components/wants/Sheet";
import { describeNextDate, loadPullRules, newRuleId, saveRule, searchComicSeries, type SeriesCandidate } from "@/lib/pullRules";
import { clampQuantity, type PullRule, type PullRuleKind } from "@/lib/wantsCore";

const KINDS: { key: PullRuleKind; label: string }[] = [
  { key: "comic_series", label: "Comic series" },
  { key: "card_product", label: "Card product or set" },
  { key: "toy_line", label: "Toy or product line" },
];

/**
 * Follow something. A comic series is matched to one exact series in the comic catalog and its releases are added for you (standard covers; variants are offered,
 * never added on their own). Card products and toy lines have no release feed in VLTD: the rule is a manual one and you add each release yourself.
 */
export default function FollowSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (rule: PullRule) => void }) {
  const [kind, setKind] = useState<PullRuleKind>("comic_series");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [found, setFound] = useState<SeriesCandidate[] | null>(null);
  const [picked, setPicked] = useState<SeriesCandidate | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFailed(false); setPicked(null);
    const res = await searchComicSeries(q);
    setBusy(false);
    setFailed(res.failed);
    setFound(res.failed ? null : res.candidates);
  }

  function create() {
    setError("");
    const base = { id: newRuleId(), quantity: clampQuantity(quantity), variantPolicy: "standard" as const, formatNote: note.trim() || undefined, state: "following" as const, createdAt: Date.now() };
    let rule: PullRule;
    if (kind === "comic_series") {
      if (!picked) return setError("Search for the series and pick the one you mean.");
      const already = loadPullRules().find((r) => r.sourceKey === picked.key);
      if (already) return setError(already.state === "stopped" ? "You stopped following this series. Show stopped rules and press Follow again." : "You already follow this series.");
      rule = { ...base, kind, name: picked.name, publisher: picked.publisher, yearBegan: picked.yearBegan, source: "metron", sourceKey: picked.key };
    } else {
      if (!name.trim()) return setError("Give it a name.");
      rule = { ...base, kind, name: name.trim(), source: "manual" };
    }
    saveRule(rule);
    onCreated(rule);
    onClose();
  }

  return (
    <Sheet title="Follow" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="What to follow">
        {KINDS.map((k) => <PillButton key={k.key} variant={kind === k.key ? "active" : "default"} pressed={kind === k.key} onClick={() => { setKind(k.key); setError(""); }}>{k.label}</PillButton>)}
      </div>
      {kind === "comic_series" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>Pick one exact series from the comic catalog. New standard-cover issues are added to your list as they are announced. Variant covers are shown to you and added only when you choose.</p>
          <form onSubmit={search} className="flex gap-2">
            <Field label="Series name" className="flex-1"><input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="e.g. a comic series name" autoFocus /></Field>
            <div className="flex items-end"><PillButton type="submit" variant="primary" disabled={busy || q.trim().length < 2}>{busy ? "Searching…" : "Search"}</PillButton></div>
          </form>
          {failed ? <p role="alert" className="text-sm text-red-400">The catalog could not be reached. Try again in a moment.</p> : null}
          {found && found.length === 0 ? <p className="text-sm" style={{ color: "var(--muted)" }}>No series by that name has releases in the next 180 days. A series is only listed once the catalog has announced an issue.</p> : null}
          <ul className="flex flex-col gap-2">
            {(found ?? []).map((c) => (
              <li key={c.key}>
                <button type="button" onClick={() => setPicked(c)} aria-pressed={picked?.key === c.key} className="flex w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left" style={{ borderColor: picked?.key === c.key ? "rgba(82,214,244,0.7)" : "rgba(203,208,213,0.18)" }}>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{c.name}{c.yearBegan ? ` (${c.yearBegan})` : ""}</span><span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>{[c.publisher, `${c.upcoming} upcoming`, describeNextDate(c)].filter(Boolean).join(" · ")}</span></span>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--theme-gold)" }}>{picked?.key === c.key ? "Picked" : "Pick"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--muted)" }}>VLTD has no release feed for card products or toy lines yet, so this is a manual rule: it keeps your preferences together and you add each release yourself. It will never claim to check for new ones.</p>
          <Field label={kind === "card_product" ? "Product or set" : "Toy or product line"}><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Name" autoFocus /></Field>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Copies of each release"><input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="Format preference (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. Cover A only" /></Field>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-400">{error}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <PillButton onClick={onClose}>Cancel</PillButton>
        <PillButton variant="primary" onClick={create}>Start following</PillButton>
      </div>
    </Sheet>
  );
}
