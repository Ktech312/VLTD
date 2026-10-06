"use client";

import { useMemo, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { INLINE_EDIT_LINE } from "@/lib/inlineEdit";
import {
  buildPricingPatch,
  confidenceLabel,
  confidenceTone,
  displayPrimaryValue,
  effectiveValueRange,
  formatPrice,
  formatPriceUpdatedAt,
  getPricingSuggestions,
  normalizeComparables,
  normalizePriceConfidence,
  parsePriceInput,
  type PriceComparable,
  type PricingMvpFields,
} from "@/lib/pricingMvp";

type FieldKey = "range" | "lastComp" | "estimate" | "source" | "notes";

function numText(n?: number) {
  return n !== undefined && n !== null && Number.isFinite(n) ? String(n) : "";
}

/**
 * Pricing, edited where you read it. Click a value (or the pencil for all of
 * them) and the text turns into a line you can type on; the card never changes
 * size. Enter saves, Esc cancels, the check saves everything.
 */
export default function PricingMvpCard({
  value,
  compact = false,
  title = "PRICING",
  universe,
  categoryLabel,
  grade,
  itemTitle,
  onSave,
}: {
  value: PricingMvpFields;
  compact?: boolean;
  title?: string;
  universe?: string;
  categoryLabel?: string;
  grade?: string;
  itemTitle?: string;
  onSave?: (patch: PricingMvpFields) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [all, setAll] = useState(false);
  const [draft, setDraft] = useState({ low: "", median: "", high: "", last: "", estimate: "", source: "", notes: "" });
  const [addingComp, setAddingComp] = useState(false);
  const [compDraft, setCompDraft] = useState({ source: "", price: "", date: "", url: "" });
  const skipCommit = useRef(false);

  const primaryValue = useMemo(() => displayPrimaryValue(value), [value]);
  const range = useMemo(() => effectiveValueRange(value), [value]);
  const suggestions = useMemo(
    () => getPricingSuggestions(universe ?? "", categoryLabel ?? "", grade, itemTitle),
    [universe, categoryLabel, grade, itemTitle]
  );
  const comparables = useMemo(() => normalizeComparables(value.comparables) ?? [], [value.comparables]);

  async function commit(overrides: Parameters<typeof buildPricingPatch>[0]) {
    if (!onSave) return;
    await onSave(
      buildPricingPatch({
        estimatedValue: value.estimatedValue,
        lastCompValue: value.lastCompValue,
        valueLow: value.valueLow,
        valueMedian: value.valueMedian,
        valueHigh: value.valueHigh,
        priceSource: value.priceSource,
        priceConfidence: value.priceConfidence,
        priceNotes: value.priceNotes,
        priceSources: value.priceSources,
        comparables,
        ...overrides,
      })
    );
  }

  function fillDraft() {
    setDraft({
      low: numText(value.valueLow),
      median: numText(value.valueMedian),
      high: numText(value.valueHigh),
      last: numText(value.lastCompValue),
      estimate: numText(value.estimatedValue),
      source: value.priceSource ?? "",
      notes: value.priceNotes ?? "",
    });
  }

  function open(field: FieldKey) {
    skipCommit.current = false;
    fillDraft();
    setEditing(field);
  }

  function startAll() {
    skipCommit.current = false;
    fillDraft();
    setEditing(null);
    setAll(true);
  }

  async function saveAll() {
    setAll(false);
    await commit({
      valueLow: parsePriceInput(draft.low),
      valueMedian: parsePriceInput(draft.median),
      valueHigh: parsePriceInput(draft.high),
      lastCompValue: parsePriceInput(draft.last),
      estimatedValue: parsePriceInput(draft.estimate),
      priceSource: draft.source.trim(),
      priceNotes: draft.notes.trim(),
    });
  }

  async function finishOne() {
    if (skipCommit.current || !editing) return;
    const field = editing;
    // Enter and blur can both fire for one edit; only save once.
    skipCommit.current = true;
    setEditing(null);
    if (field === "range") {
      const next = {
        valueLow: parsePriceInput(draft.low),
        valueMedian: parsePriceInput(draft.median),
        valueHigh: parsePriceInput(draft.high),
      };
      if (next.valueLow !== value.valueLow || next.valueMedian !== value.valueMedian || next.valueHigh !== value.valueHigh) await commit(next);
    } else if (field === "lastComp") {
      const next = parsePriceInput(draft.last);
      if (next !== value.lastCompValue) await commit({ lastCompValue: next });
    } else if (field === "estimate") {
      const next = parsePriceInput(draft.estimate);
      if (next !== value.estimatedValue) await commit({ estimatedValue: next });
    } else if (field === "source") {
      if (draft.source.trim() !== (value.priceSource ?? "").trim()) await commit({ priceSource: draft.source.trim() });
    } else if (field === "notes") {
      if (draft.notes.trim() !== (value.priceNotes ?? "").trim()) await commit({ priceNotes: draft.notes.trim() });
    }
  }

  function cancel() {
    skipCommit.current = true;
    setEditing(null);
    setAll(false);
  }

  function keys(e: React.KeyboardEvent, multiline = false) {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && !(multiline && e.shiftKey)) {
      e.preventDefault();
      if (all) void saveAll();
      else void finishOne();
    }
  }

  const isOpen = (field: FieldKey) => all || editing === field;
  const blurSave = () => {
    if (!all) void finishOne();
  };

  async function addComp() {
    const salePrice = parsePriceInput(compDraft.price);
    const source = compDraft.source.trim();
    if (!source || !salePrice || salePrice <= 0) return;
    const comp: PriceComparable = {
      source,
      salePrice,
      saleDate: compDraft.date.trim() || undefined,
      url: compDraft.url.trim() || undefined,
    };
    setAddingComp(false);
    setCompDraft({ source: "", price: "", date: "", url: "" });
    await commit({ comparables: [...comparables, comp] });
  }

  async function removeComp(index: number) {
    await commit({ comparables: comparables.filter((_, i) => i !== index) });
  }

  async function applyCompAsValue(comp: PriceComparable) {
    const salePrice = Number(comp.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) return;
    await commit({
      valueMedian: salePrice,
      lastCompValue: salePrice,
      priceSource: comp.source,
      priceConfidence: value.priceConfidence ?? "medium",
    });
  }

  const tile = "w-full rounded-[14px] bg-[color:var(--surface)] p-3 text-left ring-1 ring-[color:var(--border)]";
  const tileLabel = "text-[11px] tracking-[0.14em] text-[color:var(--muted2)]";
  const hover = "transition hover:ring-[color:var(--theme-gold,#C8CDD2)]";
  const smallInput = "rounded-lg bg-[color:var(--pill)] px-2.5 py-1 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
          {!compact ? (
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Click any value to edit it.
              {suggestions.length > 0 ? (
                <>
                  {" "}Look up sold prices:{" "}
                  {suggestions.map((s, i) => (
                    <span key={s.platform}>
                      {i > 0 ? " · " : ""}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.note} className="text-[color:var(--theme-gold)] underline-offset-2 hover:underline">
                        {s.platform}
                      </a>
                    </span>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => (all ? void saveAll() : startAll())}
          aria-label={all ? "Save pricing" : "Edit pricing"}
          title={all ? "Save (Esc to cancel)" : "Edit pricing"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          style={{ color: all ? "var(--theme-gold)" : "var(--muted)" }}
        >
          <AppIcon name={all ? "checkmark" : "edit"} size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* VALUE RANGE */}
          <div
            className={`${tile} ${isOpen("range") ? "" : "cursor-pointer " + hover}`}
            onClick={() => { if (!isOpen("range")) open("range"); }}
            onBlur={(e) => {
              if (!all && editing === "range" && !e.currentTarget.contains(e.relatedTarget as Node | null)) void finishOne();
            }}
            title={isOpen("range") ? undefined : "Click to edit value range"}
          >
            <div className={tileLabel}>VALUE RANGE</div>
            {isOpen("range") ? (
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                <input aria-label="Low" placeholder="low" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-4 w-14 text-xs text-[color:var(--muted)]`} value={draft.low} onChange={(e) => setDraft((d) => ({ ...d, low: e.target.value }))} onKeyDown={keys} />
                <input aria-label="Value" autoFocus={!all} placeholder="value" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-7 w-20 text-lg font-semibold`} value={draft.median} onChange={(e) => setDraft((d) => ({ ...d, median: e.target.value }))} onKeyDown={keys} />
                <input aria-label="High" placeholder="high" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-4 w-14 text-xs text-[color:var(--muted)]`} value={draft.high} onChange={(e) => setDraft((d) => ({ ...d, high: e.target.value }))} onKeyDown={keys} />
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                {range.low ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.low)}</span> : null}
                <span className="text-lg font-semibold">{formatPrice(primaryValue)}</span>
                {range.high ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.high)}</span> : null}
              </div>
            )}
          </div>

          {/* LAST COMP */}
          <div className={`${tile} ${isOpen("lastComp") ? "" : "cursor-pointer " + hover}`} onClick={() => { if (!isOpen("lastComp")) open("lastComp"); }} title={isOpen("lastComp") ? undefined : "Click to edit last comp"}>
            <div className={tileLabel}>LAST COMP</div>
            {isOpen("lastComp") ? (
              <input aria-label="Last comp" autoFocus={!all} inputMode="decimal" className={`${INLINE_EDIT_LINE} mt-1 h-7 w-full text-lg font-semibold`} value={draft.last} onChange={(e) => setDraft((d) => ({ ...d, last: e.target.value }))} onBlur={blurSave} onKeyDown={keys} />
            ) : (
              <div className="mt-1 text-lg font-semibold">{formatPrice(value.lastCompValue)}</div>
            )}
          </div>

          {/* CONFIDENCE: pick and it saves */}
          <div className={tile}>
            <div className={tileLabel}>CONFIDENCE</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={["rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", confidenceTone(value.priceConfidence)].join(" ")}>
                {confidenceLabel(value.priceConfidence)}
              </span>
              <select
                aria-label="Confidence"
                className="h-7 rounded-lg bg-[color:var(--pill)] px-1.5 text-[11px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] focus:outline-none"
                value={value.priceConfidence ?? ""}
                onChange={(e) => void commit({ priceConfidence: normalizePriceConfidence(e.target.value) })}
              >
                <option value="">Change…</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* UPDATED: automatic */}
          <div className={tile}>
            <div className={tileLabel}>UPDATED</div>
            <div className="mt-1 text-lg font-semibold">{formatPriceUpdatedAt(value.priceUpdatedAt)}</div>
          </div>
        </div>

        {/* Comparable sales */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={tileLabel}>
              COMPARABLE SALES
              {comparables.length === 0 && !addingComp ? <span className="ml-2 normal-case tracking-normal text-[color:var(--muted2)]">none yet</span> : null}
            </span>
            {!addingComp ? (
              <button type="button" onClick={() => setAddingComp(true)} className="text-[11px] font-semibold text-[color:var(--theme-gold)]">
                + Add comp
              </button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            {comparables.map((comp, index) => (
              <div key={`${comp.source}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-[color:var(--fg)]">{formatPrice(comp.salePrice)}</span>
                  {comp.condition ? <span className="ml-2 text-[11px] text-[color:var(--muted)]">{comp.condition}</span> : null}
                  {comp.notes ? <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">{comp.notes}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  {comp.url ? (
                    <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[color:var(--muted)] hover:underline">{comp.source}</a>
                  ) : (
                    <div className="text-[12px] font-semibold text-[color:var(--muted)]">{comp.source}</div>
                  )}
                  {comp.saleDate ? <div className="text-[11px] text-[color:var(--muted2)]">{comp.saleDate}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => void applyCompAsValue(comp)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]" title="Use this sale as the current value">
                    Use as value
                  </button>
                  <button type="button" onClick={() => void removeComp(index)} className="rounded-md px-2 py-1 text-[11px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]" title="Remove this comparable" aria-label="Remove this comparable">
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {addingComp ? (
              <div className="rounded-xl bg-[color:var(--pill)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input autoFocus className={smallInput} placeholder="Source (eBay…)" value={compDraft.source} onChange={(e) => setCompDraft((d) => ({ ...d, source: e.target.value }))} />
                  <input className={smallInput} placeholder="Sold price" inputMode="decimal" value={compDraft.price} onChange={(e) => setCompDraft((d) => ({ ...d, price: e.target.value }))} />
                  <input className={smallInput} placeholder="Sale date" value={compDraft.date} onChange={(e) => setCompDraft((d) => ({ ...d, date: e.target.value }))} />
                  <input className={smallInput} placeholder="Link (optional)" value={compDraft.url} onChange={(e) => setCompDraft((d) => ({ ...d, url: e.target.value }))} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => void addComp()} className="rounded-[8px] px-3 py-1 text-xs font-bold" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>Add</button>
                  <button type="button" onClick={() => setAddingComp(false)} className="rounded-[8px] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Rows */}
        <div className="grid gap-2 text-sm leading-5">
          {(
            [
              ["estimate", "Estimate", formatPrice(value.estimatedValue)],
              ["source", "Price source", value.priceSource?.trim() || "—"],
              ["notes", "Notes", value.priceNotes?.trim() || "—"],
            ] as const
          ).map(([field, label, shown]) => (
            <div key={field} className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-[color:var(--muted)]">{label}</div>
              {isOpen(field) ? (
                field === "notes" ? (
                  <textarea
                    autoFocus={!all}
                    rows={1}
                    aria-label={label}
                    className={`${INLINE_EDIT_LINE} min-h-5 flex-1 resize-none text-right leading-5`}
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    onBlur={blurSave}
                    onKeyDown={(e) => keys(e, true)}
                  />
                ) : (
                  <input
                    autoFocus={!all}
                    aria-label={label}
                    inputMode={field === "estimate" ? "decimal" : undefined}
                    className={`${INLINE_EDIT_LINE} h-5 flex-1 text-right`}
                    value={field === "estimate" ? draft.estimate : draft.source}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                    onBlur={blurSave}
                    onKeyDown={keys}
                  />
                )
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => open(field)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(field); } }}
                  title={`Click to edit ${label.toLowerCase()}`}
                  className="max-w-[70%] cursor-pointer whitespace-pre-wrap text-right text-[color:var(--fg)] hover:underline hover:decoration-[color:var(--border)] hover:underline-offset-4"
                >
                  {shown}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
