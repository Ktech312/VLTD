"use client";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

function sliderClass() {
  return "h-2 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]";
}

export default function ScanCropEditor({
  imageUrl,
  crop,
  onChange,
  onApply,
  onReset,
  onCancel,
  isApplying = false,
}: {
  imageUrl: string;
  crop: ScanCropRect;
  onChange: (next: ScanCropRect) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
  isApplying?: boolean;
}) {
  const insetStyle = {
    left: `${crop.left * 100}%`,
    top: `${crop.top * 100}%`,
    right: `${crop.right * 100}%`,
    bottom: `${crop.bottom * 100}%`,
  };

  function update(key: keyof ScanCropRect, value: number) {
    onChange({
      ...crop,
      [key]: value,
    });
  }

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            CROP BEFORE IDENTIFY
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Tighten the scan area, then apply the crop and the app will re-identify the image.
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-[14px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]">
        <div className="relative overflow-hidden rounded-[10px] bg-black/20">
          <img src={imageUrl} alt="Scan crop preview" className="h-auto w-full object-contain" />

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-black/45" />
            <div
              className="absolute rounded-[14px] border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
              style={insetStyle}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs text-[color:var(--muted)]">
          Trim Left
          <input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            value={crop.left}
            onChange={(e) => update("left", Number(e.target.value))}
            className={sliderClass()}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-[color:var(--muted)]">
          Trim Right
          <input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            value={crop.right}
            onChange={(e) => update("right", Number(e.target.value))}
            className={sliderClass()}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-[color:var(--muted)]">
          Trim Top
          <input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            value={crop.top}
            onChange={(e) => update("top", Number(e.target.value))}
            className={sliderClass()}
          />
        </label>
        <label className="grid gap-1.5 text-xs text-[color:var(--muted)]">
          Trim Bottom
          <input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            value={crop.bottom}
            onChange={(e) => update("bottom", Number(e.target.value))}
            className={sliderClass()}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
        >
          {isApplying ? "Applying..." : "Apply Crop"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)]"
        >
          Close
        </button>
      </div>
    </section>
  );
}
