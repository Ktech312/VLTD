"use client";

import { useEffect, useMemo, useState } from "react";

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
  type PriceConfidence,
  type PricingMvpFields,
} from "@/lib/pricingMvp";

function inputClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function textareaClass() {
  return "min-h-[84px] rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function selectClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function ActionButton({
  children,
  primary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-sm font-medium ring-1 transition disabled:opacity-40",
        primary
          ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
          : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)]",
        props.className || "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function compDraftFromComparables(comparables: PricingMvpFields["comparables"]) {
  return normalizeComparables(comparables) ?? [];
}

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
  const [isEditing, setIsEditing] = useState(false);

  const [estimatedValueInput, setEstimatedValueInput] = useState(
    value.estimatedValue !== undefined ? String(value.estimatedValue) : ""
  );
  const [lastCompValueInput, setLastCompValueInput] = useState(
    value.lastCompValue !== undefined ? String(value.lastCompValue) : ""
  );
  const [valueLowInput, setValueLowInput] = useState(
    value.valueLow !== undefined ? String(value.valueLow) : ""
  );
  const [valueMedianInput, setValueMedianInput] = useState(
    value.valueMedian !== undefined ? String(value.valueMedian) : ""
  );
  const [valueHighInput, setValueHighInput] = useState(
    value.valueHigh !== undefined ? String(value.valueHigh) : ""
  );
  const [priceSourceInput, setPriceSourceInput] = useState(value.priceSource ?? "");
  const [priceConfidenceInput, setPriceConfidenceInput] = useState<PriceConfidence | "">(
    value.priceConfidence ?? ""
  );
  const [priceNotesInput, setPriceNotesInput] = useState(value.priceNotes ?? "");
  const [comparableDraft, setComparableDraft] = useState<PriceComparable[]>(() =>
    compDraftFromComparables(value.comparables)
  );
  const [isSaving, setIsSaving] = useState(false);

  const primaryValue = useMemo(() => displayPrimaryValue(value), [value]);
  const range = useMemo(() => effectiveValueRange(value), [value]);
  const suggestions = useMemo(
    () => getPricingSuggestions(universe ?? "", categoryLabel ?? "", grade, itemTitle),
    [universe, categoryLabel, grade, itemTitle]
  );
  const comparables = useMemo(() => normalizeComparables(value.comparables) ?? [], [value.comparables]);

  useEffect(() => {
    if (isEditing) return;
    setEstimatedValueInput(value.estimatedValue !== undefined ? String(value.estimatedValue) : "");
    setLastCompValueInput(value.lastCompValue !== undefined ? String(value.lastCompValue) : "");
    setValueLowInput(value.valueLow !== undefined ? String(value.valueLow) : "");
    setValueMedianInput(value.valueMedian !== undefined ? String(value.valueMedian) : "");
    setValueHighInput(value.valueHigh !== undefined ? String(value.valueHigh) : "");
    setPriceSourceInput(value.priceSource ?? "");
    setPriceConfidenceInput(value.priceConfidence ?? "");
    setPriceNotesInput(value.priceNotes ?? "");
    setComparableDraft(compDraftFromComparables(value.comparables));
  }, [
    isEditing,
    value.estimatedValue,
    value.lastCompValue,
    value.valueLow,
    value.valueMedian,
    value.valueHigh,
    value.priceSource,
    value.priceConfidence,
    value.priceNotes,
    value.comparables,
  ]);

  function resetDraft() {
    setEstimatedValueInput(value.estimatedValue !== undefined ? String(value.estimatedValue) : "");
    setLastCompValueInput(value.lastCompValue !== undefined ? String(value.lastCompValue) : "");
    setValueLowInput(value.valueLow !== undefined ? String(value.valueLow) : "");
    setValueMedianInput(value.valueMedian !== undefined ? String(value.valueMedian) : "");
    setValueHighInput(value.valueHigh !== undefined ? String(value.valueHigh) : "");
    setPriceSourceInput(value.priceSource ?? "");
    setPriceConfidenceInput(value.priceConfidence ?? "");
    setPriceNotesInput(value.priceNotes ?? "");
    setComparableDraft(compDraftFromComparables(value.comparables));
  }

  function updateComp(index: number, key: keyof PriceComparable, nextValue: unknown) {
    setComparableDraft((prev) =>
      prev.map((comp, i) => (i === index ? { ...comp, [key]: nextValue } : comp))
    );
  }

  function removeComp(index: number) {
    setComparableDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function normalizedComparableDraft() {
    return comparableDraft
      .map((comp) => ({
        ...comp,
        source: String(comp.source ?? "").trim(),
        salePrice: Number(comp.salePrice),
        saleDate: String(comp.saleDate ?? "").trim() || undefined,
        condition: String(comp.condition ?? "").trim() || undefined,
        url: String(comp.url ?? "").trim() || undefined,
        thumbnailUrl: String(comp.thumbnailUrl ?? "").trim() || undefined,
        notes: String(comp.notes ?? "").trim() || undefined,
      }))
      .filter((comp) => comp.source && Number.isFinite(comp.salePrice) && comp.salePrice > 0);
  }

  function applyCompAsValue(comp: PriceComparable) {
    const salePrice = Number(comp.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) return;

    setValueMedianInput(String(salePrice));
    setLastCompValueInput(String(salePrice));
    setPriceSourceInput(comp.source);
    setPriceConfidenceInput((current) => current || "medium");
    setPriceNotesInput((current) => {
      const line = [
        `Value set from ${comp.source} comparable`,
        comp.saleDate ? `sold ${comp.saleDate}` : "",
        comp.condition ? `condition ${comp.condition}` : "",
        comp.url ? comp.url : "",
      ].filter(Boolean).join(" - ");
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n${line}` : line;
    });
  }

  async function handleSave() {
    if (!onSave) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        buildPricingPatch({
          estimatedValue: parsePriceInput(estimatedValueInput),
          lastCompValue: parsePriceInput(lastCompValueInput),
          valueLow: parsePriceInput(valueLowInput),
          valueMedian: parsePriceInput(valueMedianInput),
          valueHigh: parsePriceInput(valueHighInput),
          priceSource: priceSourceInput,
          priceConfidence: normalizePriceConfidence(priceConfidenceInput),
          priceNotes: priceNotesInput,
          comparables: normalizedComparableDraft(),
        })
      );
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    resetDraft();
    setIsEditing(false);
  }

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
          {!compact ? (
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Multi-source pricing with defensible comparable sales.
            </div>
          ) : null}
        </div>

        {!isEditing ? (
          <ActionButton onClick={() => setIsEditing(true)}>Edit</ActionButton>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-3 grid gap-4">
          {suggestions.length > 0 ? (
            <div>
              <div className="mb-2 text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                WHERE TO LOOK
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <a
                    key={suggestion.platform}
                    href={suggestion.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--pill)] px-3 py-2.5 ring-1 ring-[color:var(--border)] transition hover:brightness-110"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-[color:var(--fg)]">
                        {suggestion.platform}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                        {suggestion.note}
                      </div>
                    </div>
                    <div className="max-w-[42%] shrink-0 pt-0.5 text-right text-[11px] text-[color:var(--muted)]">
                      {suggestion.searchHint}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LOW</span>
              <input className={inputClass()} value={valueLowInput} onChange={(e) => setValueLowInput(e.target.value)} placeholder="80" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">MEDIAN</span>
              <input className={inputClass()} value={valueMedianInput} onChange={(e) => setValueMedianInput(e.target.value)} placeholder="110" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">HIGH</span>
              <input className={inputClass()} value={valueHighInput} onChange={(e) => setValueHighInput(e.target.value)} placeholder="150" />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LEGACY ESTIMATE</span>
              <input className={inputClass()} value={estimatedValueInput} onChange={(e) => setEstimatedValueInput(e.target.value)} placeholder="125" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LAST COMP</span>
              <input className={inputClass()} value={lastCompValueInput} onChange={(e) => setLastCompValueInput(e.target.value)} placeholder="110" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">PRICE SOURCE</span>
              <input className={inputClass()} value={priceSourceInput} onChange={(e) => setPriceSourceInput(e.target.value)} placeholder="eBay sold / Discogs / PWCC" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CONFIDENCE</span>
              <select
                className={selectClass()}
                value={priceConfidenceInput}
                onChange={(e) => setPriceConfidenceInput((e.target.value || "") as PriceConfidence | "")}
              >
                <option value="">Select confidence</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">PRICE NOTES</span>
            <textarea
              className={textareaClass()}
              value={priceNotesInput}
              onChange={(e) => setPriceNotesInput(e.target.value)}
              placeholder="Why this estimate makes sense, what comps you used, grade caveats, etc."
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">COMPARABLE SALES</span>
              <button
                type="button"
                onClick={() => setComparableDraft((prev) => [...prev, { source: "", salePrice: 0 }])}
                className="text-[11px] font-semibold text-[color:var(--theme-gold)]"
              >
                + Add Comp
              </button>
            </div>
            <div className="space-y-3">
              {comparableDraft.map((comp, index) => (
                <div key={index} className="rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px_120px_32px]">
                    <input
                      className={inputClass()}
                      placeholder="Source"
                      value={comp.source}
                      onChange={(e) => updateComp(index, "source", e.target.value)}
                    />
                    <input
                      className={inputClass()}
                      placeholder="Price"
                      type="number"
                      value={comp.salePrice || ""}
                      onChange={(e) => updateComp(index, "salePrice", Number(e.target.value))}
                    />
                    <input
                      className={inputClass()}
                      placeholder="Sale date"
                      value={comp.saleDate ?? ""}
                      onChange={(e) => updateComp(index, "saleDate", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeComp(index)}
                      className="h-10 rounded-xl text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
                      title="Remove comparable"
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      className={inputClass()}
                      placeholder="Thumbnail URL"
                      value={comp.thumbnailUrl ?? ""}
                      onChange={(e) => updateComp(index, "thumbnailUrl", e.target.value)}
                    />
                    <input
                      className={inputClass()}
                      placeholder="Listing / sold URL"
                      value={comp.url ?? ""}
                      onChange={(e) => updateComp(index, "url", e.target.value)}
                    />
                    <input
                      className={inputClass()}
                      placeholder="Condition / grade"
                      value={comp.condition ?? ""}
                      onChange={(e) => updateComp(index, "condition", e.target.value)}
                    />
                    <input
                      className={inputClass()}
                      placeholder="Notes"
                      value={comp.notes ?? ""}
                      onChange={(e) => updateComp(index, "notes", e.target.value)}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => applyCompAsValue(comp)}
                      className="rounded-[7px] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)]"
                    >
                      Use as current value
                    </button>
                  </div>
                </div>
              ))}
              {comparableDraft.length === 0 ? (
                <div className="rounded-xl bg-[color:var(--pill)] px-3 py-2 text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  Add recent sales to make insurance values easier to defend.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton primary onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Pricing"}
            </ActionButton>
            <ActionButton onClick={handleCancel} disabled={isSaving}>
              Cancel
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">VALUE RANGE</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                {range.low ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.low)}</span> : null}
                <span className="text-lg font-semibold">{formatPrice(primaryValue)}</span>
                {range.high ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.high)}</span> : null}
              </div>
            </div>

            <div className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">LAST COMP</div>
              <div className="mt-1 text-lg font-semibold">{formatPrice(value.lastCompValue)}</div>
            </div>

            <div className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">CONFIDENCE</div>
              <div className="mt-2">
                <span className={["rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", confidenceTone(value.priceConfidence)].join(" ")}>
                  {confidenceLabel(value.priceConfidence)}
                </span>
              </div>
            </div>

            <div className="rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">UPDATED</div>
              <div className="mt-1 text-lg font-semibold">{formatPriceUpdatedAt(value.priceUpdatedAt)}</div>
            </div>
          </div>

          {comparables.length > 0 ? (
            <div>
              <div className="mb-2 text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">COMPARABLE SALES</div>
              <div className="space-y-1.5">
                {comparables.map((comp, index) => {
                  const body = (
                    <>
                      {comp.thumbnailUrl ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={comp.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div>
                          <span className="text-[13px] font-semibold text-[color:var(--fg)]">{formatPrice(comp.salePrice)}</span>
                          {comp.condition ? <span className="ml-2 text-[11px] text-[color:var(--muted)]">{comp.condition}</span> : null}
                        </div>
                        {comp.notes ? <div className="mt-1 truncate text-[11px] text-[color:var(--muted)]">{comp.notes}</div> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[12px] font-semibold text-[color:var(--muted)]">{comp.source}</div>
                        {comp.saleDate ? <div className="text-[11px] text-[color:var(--muted2)]">{comp.saleDate}</div> : null}
                      </div>
                    </>
                  );

                  const className = "flex items-center justify-between gap-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]";
                  return comp.url ? (
                    <a
                      key={`${comp.source}-${index}`}
                      href={comp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${className} transition hover:brightness-110`}
                    >
                      {body}
                    </a>
                  ) : (
                    <div
                    key={`${comp.source}-${index}`}
                      className={className}
                  >
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-[color:var(--muted)]">Price source</div>
              <div className="text-right text-sm text-[color:var(--fg)]">{value.priceSource?.trim() || "—"}</div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-[color:var(--muted)]">Notes</div>
              <div className="max-w-[70%] whitespace-pre-wrap text-right text-sm text-[color:var(--fg)]">
                {value.priceNotes?.trim() || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
