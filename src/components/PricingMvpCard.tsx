"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildPricingPatch,
  confidenceLabel,
  confidenceTone,
  formatPrice,
  formatPriceUpdatedAt,
  normalizePriceConfidence,
  parsePriceInput,
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
        "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 transition disabled:opacity-40",
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

export default function PricingMvpCard({
  value,
  compact = false,
  title = "PRICING",
  onSave,
}: {
  value: PricingMvpFields;
  compact?: boolean;
  title?: string;
  onSave?: (patch: PricingMvpFields) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const [estimatedValueInput, setEstimatedValueInput] = useState(
    value.estimatedValue !== undefined ? String(value.estimatedValue) : ""
  );
  const [lastCompValueInput, setLastCompValueInput] = useState(
    value.lastCompValue !== undefined ? String(value.lastCompValue) : ""
  );
  const [priceSourceInput, setPriceSourceInput] = useState(value.priceSource ?? "");
  const [priceConfidenceInput, setPriceConfidenceInput] = useState<PriceConfidence | "">(
    value.priceConfidence ?? ""
  );
  const [priceNotesInput, setPriceNotesInput] = useState(value.priceNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const summaryValue = useMemo(() => {
    if (value.estimatedValue !== undefined) return formatPrice(value.estimatedValue);
    if (value.lastCompValue !== undefined) return formatPrice(value.lastCompValue);
    return "—";
  }, [value.estimatedValue, value.lastCompValue]);

  useEffect(() => {
    if (isEditing) return;
    setEstimatedValueInput(value.estimatedValue !== undefined ? String(value.estimatedValue) : "");
    setLastCompValueInput(value.lastCompValue !== undefined ? String(value.lastCompValue) : "");
    setPriceSourceInput(value.priceSource ?? "");
    setPriceConfidenceInput(value.priceConfidence ?? "");
    setPriceNotesInput(value.priceNotes ?? "");
  }, [
    isEditing,
    value.estimatedValue,
    value.lastCompValue,
    value.priceSource,
    value.priceConfidence,
    value.priceNotes,
  ]);

  function resetDraft() {
    setEstimatedValueInput(value.estimatedValue !== undefined ? String(value.estimatedValue) : "");
    setLastCompValueInput(value.lastCompValue !== undefined ? String(value.lastCompValue) : "");
    setPriceSourceInput(value.priceSource ?? "");
    setPriceConfidenceInput(value.priceConfidence ?? "");
    setPriceNotesInput(value.priceNotes ?? "");
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
          priceSource: priceSourceInput,
          priceConfidence: normalizePriceConfidence(priceConfidenceInput),
          priceNotes: priceNotesInput,
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
              Lightweight pricing layer. Good enough now, smarter later.
            </div>
          ) : null}
        </div>

        {!isEditing ? (
          <ActionButton onClick={() => setIsEditing(true)}>Edit</ActionButton>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                ESTIMATED VALUE
              </label>
              <input
                className={inputClass()}
                value={estimatedValueInput}
                onChange={(e) => setEstimatedValueInput(e.target.value)}
                placeholder="125"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                LAST COMP
              </label>
              <input
                className={inputClass()}
                value={lastCompValueInput}
                onChange={(e) => setLastCompValueInput(e.target.value)}
                placeholder="110"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                PRICE SOURCE
              </label>
              <input
                className={inputClass()}
                value={priceSourceInput}
                onChange={(e) => setPriceSourceInput(e.target.value)}
                placeholder="eBay sold / dealer ask / show comp"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                CONFIDENCE
              </label>
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
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
              PRICE NOTES
            </label>
            <textarea
              className={textareaClass()}
              value={priceNotesInput}
              onChange={(e) => setPriceNotesInput(e.target.value)}
              placeholder="Why this estimate makes sense, what comp you used, grade caveats, etc."
            />
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
            <div className="rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                ESTIMATE
              </div>
              <div className="mt-1 text-lg font-semibold">{summaryValue}</div>
            </div>

            <div className="rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                LAST COMP
              </div>
              <div className="mt-1 text-lg font-semibold">{formatPrice(value.lastCompValue)}</div>
            </div>

            <div className="rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                CONFIDENCE
              </div>
              <div className="mt-2">
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                    confidenceTone(value.priceConfidence),
                  ].join(" ")}
                >
                  {confidenceLabel(value.priceConfidence)}
                </span>
              </div>
            </div>

            <div className="rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                UPDATED
              </div>
              <div className="mt-1 text-lg font-semibold">{formatPriceUpdatedAt(value.priceUpdatedAt)}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-[color:var(--muted)]">Price source</div>
              <div className="text-right text-sm text-[color:var(--fg)]">
                {value.priceSource?.trim() || "—"}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="text-sm text-[color:var(--muted)]">Notes</div>
              <div className="max-w-[70%] text-right text-sm text-[color:var(--fg)] whitespace-pre-wrap">
                {value.priceNotes?.trim() || "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
