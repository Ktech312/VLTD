"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

const MAX_ZOOM = 8;
const DEFAULT_CROP_POINT: Point = { x: 0, y: 0 };

function buttonClass() {
  return "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

function primaryButtonClass() {
  return "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropRectToPercentages(crop: ScanCropRect) {
  const left = clamp(crop.left, 0, 0.9);
  const top = clamp(crop.top, 0, 0.9);
  const width = clamp(1 - crop.left - crop.right, 0.1, 1);
  const height = clamp(1 - crop.top - crop.bottom, 0.1, 1);

  return {
    x: left * 100,
    y: top * 100,
    width: width * 100,
    height: height * 100,
  };
}

function areaToCropRect(area: Area): ScanCropRect {
  return {
    left: clamp(area.x / 100, 0, 0.9),
    top: clamp(area.y / 100, 0, 0.9),
    right: clamp((100 - area.x - area.width) / 100, 0, 0.9),
    bottom: clamp((100 - area.y - area.height) / 100, 0, 0.9),
  };
}

export default function ScanCropEditor({
  imageUrl,
  crop: selectedCrop,
  onChange,
  onApply,
  onReset,
  onCancel,
  onRotate,
  rotation = 0,
  isApplying = false,
  title = "CROP BEFORE CONTINUING",
  description = "Drag the photo to frame it. Pinch or use Zoom to move closer.",
  applyLabel = "Save Crop",
  compact = false,
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
  compact?: boolean;
}) {
  const [cropPoint, setCropPoint] = useState<Point>(DEFAULT_CROP_POINT);
  const [zoom, setZoom] = useState(1);
  const initialCroppedAreaPercentages = cropRectToPercentages(selectedCrop);
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  function handleReset() {
    setCropPoint(DEFAULT_CROP_POINT);
    setZoom(1);
    onReset();
  }

  return (
    <section className={compact ? "rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]" : "rounded-[20px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-4"}>
      {!compact ? (
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
      ) : null}

      <div className={compact ? "mt-2 overflow-hidden rounded-[16px] bg-black/20 p-1.5 ring-1 ring-[color:var(--border)]" : "mt-3 overflow-hidden rounded-[16px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]"}>
        <div className={compact ? "relative h-[52dvh] min-h-[250px] overflow-hidden rounded-[12px] bg-black/50" : "relative h-[54dvh] min-h-[320px] max-h-[560px] overflow-hidden rounded-[12px] bg-black/50"}>
          <Cropper
            image={imageUrl}
            crop={cropPoint}
            zoom={zoom}
            rotation={normalizedRotation}
            aspect={4 / 3}
            minZoom={1}
            maxZoom={MAX_ZOOM}
            objectFit="contain"
            showGrid
            restrictPosition
            initialCroppedAreaPercentages={initialCroppedAreaPercentages}
            onCropChange={setCropPoint}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPercentages) => {
              onChange(areaToCropRect(croppedAreaPercentages));
            }}
          />
        </div>
      </div>

      <div className={compact ? "mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1 text-[11px] text-[color:var(--muted)]" : "mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs text-[color:var(--muted)]"}>
        <span>Zoom</span>
        <input
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.05"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="h-2 w-full accent-[color:var(--pill-active-bg)]"
          aria-label="Image zoom"
        />
        <span>{zoom.toFixed(1)}x</span>
      </div>

      {!compact ? (
        <div className="mt-3 rounded-[16px] bg-black/10 p-3 text-xs leading-5 text-[color:var(--muted)] ring-1 ring-white/8">
          Drag the photo inside the crop frame. Pinch on phone/tablet or use Zoom to move closer.
        </div>
      ) : null}

      <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-4 grid gap-2 sm:flex sm:flex-wrap"}>
        <button type="button" onClick={onApply} disabled={isApplying} className={primaryButtonClass()}>
          {isApplying ? "Saving..." : applyLabel}
        </button>
        <button type="button" onClick={handleReset} className={buttonClass()}>
          Full Photo
        </button>
        <button type="button" onClick={onCancel} className={buttonClass()}>
          Back
        </button>
      </div>
    </section>
  );
}
