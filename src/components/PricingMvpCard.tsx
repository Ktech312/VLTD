"use client";

import { useMemo, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";

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

const inputClass =
  "h-8 min-w-0 rounded-lg bg-[color:var(--pill)] px-2.5 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--theme-gold,#C8CDD2)] focus:outline-none";

const editableClass =
  "rounded-lg transition hover:bg-[color:var(--pill)] hover:ring-1 hover:ring-[color:var(--border)]";

function numText(n?: number) {
  return n !== undefined && n !== null && Number.isFinite(n) ? String(n) : "";
}

/**
 * Pricing, edited where you read it: click any value to change it, press Enter
 * (or click away) to save, Esc to cancel. No separate edit mode or form.
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
  const [draft, setDraft] = useState({ low: "", median: "", high: "", text: "", last: "", estimate: "", source: "", notes: "" });
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

  function open(field: FieldKey) {
    skipCommit.current = false;
    setDraft({
      low: numText(value.valueLow),
      median: numText(value.valueMedian),
      high: numText(value.valueHigh),
      last: numText(value.lastCompValue),
      estimate: numText(value.estimatedValue),
      source: value.priceSource ?? "",
      notes: value.priceNotes ?? "",
      text:
        field === "lastComp"
          ? numText(value.lastCompValue)
          : field === "estimate"
            ? numText(value.estimatedValue)
            : field === "source"
              ? value.priceSource ?? ""
              : field === "notes"
                ? value.priceNotes ?? ""
                : "",
    });
    setEditing(field);
  }

  async function finish() {
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
      if (next.valueLow === value.valueLow && next.valueMedian === value.valueMedian && next.valueHigh === value.valueHigh) return;
      await commit(next);
    } else if (field === "lastComp") {
      const next = parsePriceInput(draft.text);
      if (next !== value.lastCompValue) await commit({ lastCompValue: next });
    } else if (field === "estimate") {
      const next = parsePriceInput(draft.text);
      if (next !== value.estimatedValue) await commit({ estimatedValue: next });
    } else if (field === "source") {
      const next = draft.text.trim();
      if (next !== (value.priceSource ?? "").trim()) await commit({ priceSource: next });
    } else if (field === "notes") {
      const next = draft.text.trim();
      if (next !== (value.priceNotes ?? "").trim()) await commit({ priceNotes: next });
    }
  }

  function cancel() {
    skipCommit.current = true;
    setEditing(null);
  }

  function onKeys(e: React.KeyboardEvent, allowEnter = true) {
    if (e.key === "Enter" && allowEnter) {
      e.preventDefault();
      void finish();
    }
    if (e.key === "Escape") cancel();
  }

  function startAll() {
    open("range"); // fills every draft field
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

  function onAllKeys(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveAll();
    }
    if (e.key === "Escape") setAll(false);
  }

  // In "edit everything" mode each field has its own draft; in click-to-edit
  // mode the one open field uses draft.text.
  const slot = (field: "last" | "estimate" | "source" | "notes") => (all ? field : "text");

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
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.note}
                      className="text-[color:var(--theme-gold)] underline-offset-2 hover:underline"
                    >
                      {s.platform}
                    </a>
                  </span>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
       </div>
       {!all ? (
         <button
           type="button"
           onClick={startAll}
           aria-label="Edit pricing"
           title="Edit pricing"
           className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
           style={{ color: "var(--muted)" }}
         >
           <AppIcon name="edit" size={14} strokeWidth={1.8} />
         </button>
       ) : null}
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* VALUE RANGE: low / median (the headline number) / high */}
          {editing === "range" || all ? (
            <div
              className={tile}
              onBlur={(e) => {
                if (!all && !e.currentTarget.contains(e.relatedTarget as Node | null)) void finish();
              }}
            >
              <div className={tileLabel}>VALUE RANGE</div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["low", "Low"],
                    ["median", "Value"],
                    ["high", "High"],
                  ] as const
                ).map(([k, label], i) => (
                  <label key={k} className="grid gap-0.5">
                    <span className="text-[10px] text-[color:var(--muted2)]">{label}</span>
                    <input
                      autoFocus={i === 1 && !all}
                      className={inputClass}
                      inputMode="decimal"
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                      onKeyDown={(e) => (all ? onAllKeys(e) : onKeys(e))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => open("range")} className={`${tile} ${editableClass}`} title="Click to edit value range">
              <div className={tileLabel}>VALUE RANGE</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                {range.low ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.low)}</span> : null}
                <span className="text-lg font-semibold">{formatPrice(primaryValue)}</span>
                {range.high ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.high)}</span> : null}
              </div>
            </button>
          )}

          {/* LAST COMP */}
          {editing === "lastComp" || all ? (
            <div className={tile}>
              <div className={tileLabel}>LAST COMP</div>
              <input
                autoFocus={!all}
                className={`${inputClass} mt-1.5 w-full`}
                inputMode="decimal"
                value={draft[slot("last")]}
                onChange={(e) => setDraft((d) => ({ ...d, [slot("last")]: e.target.value }))}
                onBlur={() => { if (!all) void finish(); }}
                onKeyDown={(e) => (all ? onAllKeys(e) : onKeys(e))}
              />
            </div>
          ) : (
            <button type="button" onClick={() => open("lastComp")} className={`${tile} ${editableClass}`} title="Click to edit last comp">
              <div className={tileLabel}>LAST COMP</div>
              <div className="mt-1 text-lg font-semibold">{formatPrice(value.lastCompValue)}</div>
            </button>
          )}

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
              <div
                key={`${comp.source}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-[color:var(--fg)]">{formatPrice(comp.salePrice)}</span>
                  {comp.condition ? <span className="ml-2 text-[11px] text-[color:var(--muted)]">{comp.condition}</span> : null}
                  {comp.notes ? <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">{comp.notes}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  {comp.url ? (
                    <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[color:var(--muted)] hover:underline">
                      {comp.source}
                    </a>
                  ) : (
                    <div className="text-[12px] font-semibold text-[color:var(--muted)]">{comp.source}</div>
                  )}
                  {comp.saleDate ? <div className="text-[11px] text-[color:var(--muted2)]">{comp.saleDate}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void applyCompAsValue(comp)}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]"
                    title="Use this sale as the current value"
                  >
                    Use as value
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeComp(index)}
                    className="rounded-md px-2 py-1 text-[11px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]"
                    title="Remove this comparable"
                    aria-label="Remove this comparable"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {addingComp ? (
              <div className="rounded-xl bg-[color:var(--pill)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input autoFocus className={inputClass} placeholder="Source (eBay…)" value={compDraft.source} onChange={(e) => setCompDraft((d) => ({ ...d, source: e.target.value }))} />
                  <input className={inputClass} placeholder="Sold price" inputMode="decimal" value={compDraft.price} onChange={(e) => setCompDraft((d) => ({ ...d, price: e.target.value }))} />
                  <input className={inputClass} placeholder="Sale date" value={compDraft.date} onChange={(e) => setCompDraft((d) => ({ ...d, date: e.target.value }))} />
                  <input className={inputClass} placeholder="Link (optional)" value={compDraft.url} onChange={(e) => setCompDraft((d) => ({ ...d, url: e.target.value }))} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => void addComp()} className="rounded-[8px] px-3 py-1 text-xs font-bold" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>
                    Add
                  </button>
                  <button type="button" onClick={() => setAddingComp(false)} className="rounded-[8px] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Rows */}
        <div className="grid gap-2 text-sm">
          {(
            [
              ["estimate", "Estimate", formatPrice(value.estimatedValue), "input"],
              ["source", "Price source", value.priceSource?.trim() || "—", "input"],
              ["notes", "Notes", value.priceNotes?.trim() || "—", "textarea"],
            ] as const
          ).map(([field, label, shown, kind]) => (
            <div key={field} className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-[color:var(--muted)]">{label}</div>
              {editing === field || all ? (
                kind === "textarea" ? (
                  <textarea
                    autoFocus={!all}
                    rows={2}
                    className="-my-1 min-w-0 flex-1 resize-none rounded-lg bg-[color:var(--pill)] px-2 py-1 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--theme-gold,#C8CDD2)] focus:outline-none"
                    value={draft[slot(field)]}
                    onChange={(e) => setDraft((d) => ({ ...d, [slot(field)]: e.target.value }))}
                    onBlur={() => { if (!all) void finish(); }}
                    onKeyDown={(e) => { if (e.key === "Escape") { if (all) setAll(false); else cancel(); } }}
                  />
                ) : (
                  <input
                    autoFocus={!all}
                    className={`${inputClass} -my-1 flex-1 text-right`}
                    inputMode={field === "estimate" ? "decimal" : undefined}
                    value={draft[slot(field)]}
                    onChange={(e) => setDraft((d) => ({ ...d, [slot(field)]: e.target.value }))}
                    onBlur={() => { if (!all) void finish(); }}
                    onKeyDown={(e) => (all ? onAllKeys(e) : onKeys(e))}
                  />
                )
              ) : (
                <button
                  type="button"
                  onClick={() => open(field)}
                  title={`Click to edit ${label.toLowerCase()}`}
                  className="-my-0.5 -mr-1.5 max-w-[70%] whitespace-pre-wrap rounded-md px-1.5 py-0.5 text-right text-[color:var(--fg)] transition hover:bg-[color:var(--pill)]"
                >
                  {shown}
                </button>
              )}
            </div>
          ))}
        </div>

        {all ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void saveAll()} className="rounded-[8px] px-3 py-1 text-xs font-bold" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>
              Save
            </button>
            <button type="button" onClick={() => setAll(false)} className="rounded-[8px] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
