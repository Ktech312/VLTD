"use client";

import { useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { Field, inputClass } from "@/components/wants/Sheet";
import { setRuleState, updateRule } from "@/lib/pullRules";
import { clampQuantity, isOpen, releaseLabel, type CatalogRelease, type PullRule } from "@/lib/wantsCore";
import type { WishlistItem } from "@/lib/wishlistModel";

const line = "rgba(203,208,213,0.18)";
const KIND_LABEL = { comic_series: "Comic series", card_product: "Card product or set", toy_line: "Toy or product line" } as const;

function Source({ rule }: { rule: PullRule }) {
  if (rule.source === "metron") return <span className="text-emerald-400">Comic catalog, matched to one series</span>;
  return <span style={{ color: "#e0a64c" }}>Manual only: no release feed for this yet</span>;
}

export default function FollowTab({
  rules,
  wants,
  suggestions,
  inAccount,
  checking,
  onChanged,
  onCheck,
  onAddRelease,
  onAddSuggestion,
  onFollow,
}: {
  rules: PullRule[];
  wants: WishlistItem[];
  suggestions: CatalogRelease[];
  inAccount: boolean;
  checking: boolean;
  onChanged: (rules: PullRule[]) => void;
  onCheck: (rule: PullRule) => void;
  onAddRelease: (rule: PullRule) => void;
  onAddSuggestion: (release: CatalogRelease, rule: PullRule) => void;
  onFollow: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [showStopped, setShowStopped] = useState(false);
  const active = rules.filter((r) => r.state !== "stopped");
  const stopped = rules.filter((r) => r.state === "stopped");

  function card(rule: PullRule) {
    const mine = wants.filter((w) => w.ruleId === rule.id && isOpen(w) && w.releaseDate).sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));
    const today = new Date().toISOString().slice(0, 10);
    const next = mine.find((w) => (w.releaseDate ?? "") >= today) ?? mine[0];
    const ruleSuggestions = suggestions.filter((s) => s.seriesKey === rule.sourceKey && !wants.some((w) => w.sourceIdentity === s.identity));
    const paused = rule.state === "paused";
    return (
      <div key={rule.id} className="flex flex-col gap-2 rounded-[8px] border px-3 py-3" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: line, opacity: paused || rule.state === "stopped" ? 0.8 : 1 }} data-testid="rule-card" data-state={rule.state}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold">{rule.name}{rule.yearBegan ? ` (${rule.yearBegan})` : ""}</div>
            <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>{KIND_LABEL[rule.kind]} · {rule.quantity} {rule.quantity === 1 ? "copy" : "copies"} of each{rule.formatNote ? ` · ${rule.formatNote}` : ""}{rule.publisher ? ` · ${rule.publisher}` : ""}</div>
          </div>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ borderColor: paused ? "rgba(224,166,76,0.5)" : rule.state === "stopped" ? line : "rgba(84,201,138,0.5)", color: paused ? "#e0a64c" : rule.state === "stopped" ? "var(--muted)" : "#54c98a" }}>
            {rule.state === "following" ? "Following" : rule.state === "paused" ? "Paused" : "Stopped"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
          <span>Source: <Source rule={rule} /></span>
          {next ? <span>Next: <b className="font-medium" style={{ color: "var(--fg)" }}>{next.title}, {releaseLabel(next)}</b></span> : rule.source === "metron" ? <span>No upcoming release listed</span> : null}
          {rule.lastResult ? <span>Last check: {rule.lastResult}</span> : null}
        </div>
        {ruleSuggestions.length > 0 && rule.state === "following" ? (
          <div className="rounded-[7px] border border-dashed px-2.5 py-2 text-[12px]" style={{ borderColor: line }}>
            <div className="mb-1 font-semibold" style={{ color: "var(--fg)" }}>Variants out for this series (not added automatically)</div>
            <ul className="flex flex-col gap-1">
              {ruleSuggestions.slice(0, 6).map((s) => (
                <li key={s.identity} className="flex items-center justify-between gap-2"><span className="truncate">{s.title} · {s.edition}{s.date ? "" : " · date unknown"}</span><PillButton size="compact" onClick={() => onAddSuggestion(s, rule)}>Add</PillButton></li>
              ))}
            </ul>
          </div>
        ) : null}
        {editing === rule.id ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Copies of each release"><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={inputClass} /></Field>
            <Field label="Format preference"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Optional" /></Field>
            <div className="flex gap-2 sm:col-span-2"><PillButton variant="primary" size="compact" onClick={() => { onChanged(updateRule(rule.id, { quantity: clampQuantity(qty), formatNote: note.trim() || undefined })); setEditing(null); }}>Save rule</PillButton><PillButton size="compact" onClick={() => setEditing(null)}>Cancel</PillButton></div>
            <p className="text-[11px] sm:col-span-2" style={{ color: "var(--muted)" }}>Changes apply to releases added from now on. Selections already on your list keep what they have.</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {rule.state === "following" ? <PillButton size="compact" onClick={() => onChanged(setRuleState(rule.id, "paused"))}><AppIcon name="more" size={13} />Pause</PillButton> : null}
          {rule.state !== "following" ? <PillButton size="compact" onClick={() => onChanged(setRuleState(rule.id, "following"))}>{rule.state === "paused" ? "Resume" : "Follow again"}</PillButton> : null}
          {rule.state !== "stopped" ? <PillButton size="compact" onClick={() => onChanged(setRuleState(rule.id, "stopped"))}>Stop</PillButton> : null}
          {rule.source === "metron" && rule.state === "following" ? <PillButton size="compact" disabled={checking} onClick={() => onCheck(rule)}>{checking ? "Checking…" : "Check now"}</PillButton> : null}
          {rule.source === "manual" && rule.state !== "stopped" ? <PillButton size="compact" onClick={() => onAddRelease(rule)}>Add a release</PillButton> : null}
          {rule.state !== "stopped" ? <PillButton size="compact" onClick={() => { setEditing(rule.id); setQty(String(rule.quantity)); setNote(rule.formatNote ?? ""); }}>Edit rule</PillButton> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="follow-tab">
      {!inAccount ? <p className="rounded-[7px] border px-3 py-2 text-[12px]" style={{ borderColor: "rgba(224,166,76,0.4)", color: "var(--muted)" }} role="status">Your rules are saved on this device for now. They will follow your account once the Following update is applied.</p> : null}
      <p className="px-0.5 text-[12px]" style={{ color: "var(--muted)" }}>Pause keeps a rule and adds nothing. Stop keeps what it already added. A release you skipped never comes back, and a release whose date changes keeps your choices.</p>
      {active.length === 0 ? (
        <div className="rounded-[8px] border px-4 py-8 text-center" style={{ borderColor: line }}>
          <p className="text-sm font-semibold">You are not following anything yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--muted)" }}>Follow a comic series and its new issues are added to your Pull List as they are announced. Card products and toy lines can be followed as manual rules.</p>
          <PillButton className="mt-3" variant="primary" onClick={onFollow}>Follow something</PillButton>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">{active.map(card)}</div>
      )}
      {stopped.length > 0 ? (
        <div className="mt-1">
          <PillButton size="compact" onClick={() => setShowStopped((v) => !v)} pressed={showStopped}>{showStopped ? "Hide" : "Show"} stopped rules ({stopped.length})</PillButton>
          {showStopped ? <div className="mt-2 grid gap-2 lg:grid-cols-2">{stopped.map(card)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
