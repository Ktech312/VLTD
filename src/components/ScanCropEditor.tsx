"use client";

import { useMemo, useState } from "react";

import Cropper, { type Area, type Point } from "react-easy-crop";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

function buttonClass() {
  return "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

function primaryButtonClass() {
  return "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40";
}

function isDefaultCrop(crop: ScanCropRect) {
  return crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0;
}

function toPercentArea(crop: ScanCropRect): Area {
  const width = Math.max(1, (1 - crop.left - crop.right) * 100);
  const height = Math.max(1, (1 - crop.top - crop.bottom) * 100);

  return {
    x: crop.left * 100,
    y: crop.top * 100,
    width,
    height,
  };
}

function fromPercentArea(area: Area): ScanCropRect {
  const left = Math.max(0, Math.min(0.9, area.x / 100));
  const top = Math.max(0, Math.min(0.9, area.y / 100));
  const right = Math.max(0, Math.min(0.9, 1 - (area.x + area.width) / 100));
  const bottom = Math.max(0, Math.min(0.9, 1 - (area.y + area.height) / 100));

  return {
    left,
    top,
    right,
    bottom,
  };
}

export default function ScanCropEditor({
  imageUrl,
  crop,
  onChange,
  onApply,
  onReset,
  onCancel,
  onRotate,
  rotation = 0,
  isApplying = false,
  title = "CROP BEFORE CONTINUING",
  description = "Drag and pinch to frame the item, then save it.",
  applyLabel = "Save Crop",
}: {
  imageUrl: string;
  crop: ScanCropRect;
  onChange: (next: ScanCropRect) => void;
  onApply: () => void;
  onReset: () => void;
  onCancel: () => void;
  onRotate?: () => void;
  rotation?: number;
  isApplying?: boolean;
  title?: string;
  description?: string;
  applyLabel?: string;
}) {
  const initialArea = useMemo(
    () => (isDefaultCrop(crop) ? undefined : toPercentArea(crop)),
    [crop]
  );

  const defaultPosition = useMemo<Point>(() => ({ x: 0, y: 0 }), []);
  const [cropPosition, setCropPosition] = useState<Point>(defaultPosition);
  const [zoom, setZoom] = useState(1);

  function handleCropComplete(area: Area) {
    onChange(fromPercentArea(area));
  }

  function handleReset() {
    setCropPosition(defaultPosition);
    setZoom(1);
    onReset();
  }

  return (
    <section className="rounded-[20px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{description}</div>
        </div>

        {onRotate ? (
          <button type="button" onClick={onRotate} className={buttonClass()}>
            Rotate 90
          </button>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-[16px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]">
        <div className="relative h-[52svh] min-h-[320px] max-h-[520px] overflow-hidden rounded-[12px] bg-black/40 [touch-action:none] sm:h-[440px]">
          <Cropper
            key={imageUrl}
            image={imageUrl}
            crop={cropPosition}
            zoom={zoom}
            rotation={rotation}
            aspect={4 / 3}
            objectFit="contain"
            minZoom={1}
            maxZoom={3}
            zoomSpeed={0.05}
            showGrid
            onCropChange={setCropPosition}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            initialCroppedAreaPercentages={initialArea}
          />
        </div>
      </div>

      <div className="mt-3 rounded-[16px] bg-black/10 p-3 ring-1 ring-white/8">
        <div className="flex items-center justify-between gap-3 text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
          <span>ZOOM</span>
          <span>{zoom.toFixed(2)}x</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(1, Number((current - 0.2).toFixed(2))))}
            className={buttonClass()}
            aria-label="Zoom out"
          >
            -
          </button>

          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-10 w-full accent-[color:var(--pill-active-bg)]"
            aria-label="Zoom"
          />

          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(3, Number((current + 0.2).toFixed(2))))}
            className={buttonClass()}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <div className="mt-3 text-xs text-[color:var(--muted)]">
          Drag to move the photo. Pinch on phone or use the slider for finer control.
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={onApply} disabled={isApplying} className={primaryButtonClass()}>
          {isApplying ? "Saving..." : applyLabel}
        </button>
        <button type="button" onClick={handleReset} className={buttonClass()}>
          Reset
        </button>
        <button type="button" onClick={onCancel} className={buttonClass()}>
          Back
        </button>
      </div>
    </section>
  );
}
