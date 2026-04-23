"use client";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

const EDGE_MIN = 0;
const EDGE_MAX = 0.45;
const COMBINED_MAX = 0.9;
const TRIM_STEP = 0.04;

function clamp(value: number) {
  return Math.min(EDGE_MAX, Math.max(EDGE_MIN, value));
}

function normalizeCrop(next: ScanCropRect): ScanCropRect {
  let left = clamp(next.left);
  let right = clamp(next.right);
  let top = clamp(next.top);
  let bottom = clamp(next.bottom);

  if (left + right > COMBINED_MAX) {
    const overflow = left + right - COMBINED_MAX;
    if (left >= right) left = clamp(left - overflow);
    else right = clamp(right - overflow);
  }

  if (top + bottom > COMBINED_MAX) {
    const overflow = top + bottom - COMBINED_MAX;
    if (top >= bottom) top = clamp(top - overflow);
    else bottom = clamp(bottom - overflow);
  }

  return { left, right, top, bottom };
}

function buttonClass() {
  return "rounded-xl bg-[color:var(--pill)] px-2.5 py-2 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

function primaryButtonClass() {
  return "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40";
}

function ControlRow({
  label,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="grid gap-2 rounded-xl bg-black/10 p-3 ring-1 ring-white/8">
      <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDecrease} className={buttonClass()}>
          {decreaseLabel}
        </button>
        <button type="button" onClick={onIncrease} className={buttonClass()}>
          {increaseLabel}
        </button>
      </div>
    </div>
  );
}

export default function ScanCropEditor({
  imageUrl,
  crop,
  onChange,
  onApply,
  onReset,
  onCancel,
  onRotate,
  isApplying = false,
  title = "CROP BEFORE CONTINUING",
  description = "Tighten the photo around the item, then save it.",
  applyLabel = "Save Crop",
}: {
  imageUrl: string;
  crop: ScanCropRect;
  onChange: (next: ScanCropRect) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
  onRotate?: () => void;
  isApplying?: boolean;
  title?: string;
  description?: string;
  applyLabel?: string;
}) {
  const insetStyle = {
    left: `${crop.left * 100}%`,
    top: `${crop.top * 100}%`,
    right: `${crop.right * 100}%`,
    bottom: `${crop.bottom * 100}%`,
  };

  function update(next: Partial<ScanCropRect>) {
    onChange(
      normalizeCrop({
        ...crop,
        ...next,
      })
    );
  }

  function adjustSides(direction: "wider" | "tighter") {
    const delta = direction === "tighter" ? TRIM_STEP : -TRIM_STEP;
    update({
      left: crop.left + delta,
      right: crop.right + delta,
    });
  }

  function adjustTop(direction: "less" | "more") {
    const delta = direction === "more" ? TRIM_STEP : -TRIM_STEP;
    update({ top: crop.top + delta });
  }

  function adjustBottom(direction: "less" | "more") {
    const delta = direction === "more" ? TRIM_STEP : -TRIM_STEP;
    update({ bottom: crop.bottom + delta });
  }

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{description}</div>
        </div>

        {onRotate ? (
          <button type="button" onClick={onRotate} className={buttonClass()}>
            ↻
          </button>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-[14px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]">
        <div className="relative overflow-hidden rounded-[10px] bg-black/20">
          <img src={imageUrl} alt="Scan crop preview" className="h-auto w-full object-contain" />

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-black/45" />
            <div
              className="absolute rounded-[18px] border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
              style={insetStyle}
            />
          </div>
        </div>
      </div>

      <div className="mb-2 mt-4 text-[11px] text-[color:var(--muted2)]">
        Use <strong>-</strong> for less trim and <strong>+</strong> for more trim.
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <ControlRow
          label="SIDES"
          onDecrease={() => adjustSides("wider")}
          onIncrease={() => adjustSides("tighter")}
          decreaseLabel="-"
          increaseLabel="+"
        />
        <ControlRow
          label="TOP"
          onDecrease={() => adjustTop("less")}
          onIncrease={() => adjustTop("more")}
          decreaseLabel="-"
          increaseLabel="+"
        />
        <ControlRow
          label="BOTTOM"
          onDecrease={() => adjustBottom("less")}
          onIncrease={() => adjustBottom("more")}
          decreaseLabel="-"
          increaseLabel="+"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} disabled={isApplying} className={primaryButtonClass()}>
          {isApplying ? "Saving..." : applyLabel}
        </button>
        <button type="button" onClick={onReset} className={buttonClass()}>
          Reset
        </button>
        <button type="button" onClick={onCancel} className={buttonClass()}>
          Back
        </button>
      </div>
    </section>
  );
}
