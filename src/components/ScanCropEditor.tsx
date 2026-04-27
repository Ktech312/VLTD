"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

const MIN_CROP_SIZE = 0.08;
const ZOOM_STEP = 0.08;

type DragMode =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

type DragSession = {
  mode: DragMode;
  startX: number;
  startY: number;
  startCrop: ScanCropRect;
  imageRect: DOMRect;
};

type TouchPoint = { clientX: number; clientY: number };

type TouchSnapshot = {
  distance: number;
  crop: ScanCropRect;
};

function buttonClass() {
  return "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

function iconButtonClass() {
  return "inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-[color:var(--pill)] px-3 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:opacity-40";
}

function primaryButtonClass() {
  return "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(crop: ScanCropRect): ScanCropRect {
  const left = clamp(Number(crop.left ?? 0), 0, 1 - MIN_CROP_SIZE);
  const top = clamp(Number(crop.top ?? 0), 0, 1 - MIN_CROP_SIZE);
  const right = clamp(Number(crop.right ?? 0), 0, 1 - left - MIN_CROP_SIZE);
  const bottom = clamp(Number(crop.bottom ?? 0), 0, 1 - top - MIN_CROP_SIZE);
  return { left, top, right, bottom };
}

function cropsEqual(a: ScanCropRect, b: ScanCropRect) {
  return (
    Math.abs(a.left - b.left) < 0.001 &&
    Math.abs(a.top - b.top) < 0.001 &&
    Math.abs(a.right - b.right) < 0.001 &&
    Math.abs(a.bottom - b.bottom) < 0.001
  );
}

function cropWidth(crop: ScanCropRect) {
  return 1 - crop.left - crop.right;
}

function cropHeight(crop: ScanCropRect) {
  return 1 - crop.top - crop.bottom;
}

function moveCrop(crop: ScanCropRect, dx: number, dy: number): ScanCropRect {
  const width = cropWidth(crop);
  const height = cropHeight(crop);
  const left = clamp(crop.left + dx, 0, 1 - width);
  const top = clamp(crop.top + dy, 0, 1 - height);
  return {
    left,
    top,
    right: 1 - left - width,
    bottom: 1 - top - height,
  };
}

function resizeCrop(crop: ScanCropRect, mode: DragMode, dx: number, dy: number): ScanCropRect {
  const next = { ...crop };

  if (mode.includes("w")) {
    next.left = clamp(crop.left + dx, 0, 1 - crop.right - MIN_CROP_SIZE);
  }
  if (mode.includes("e")) {
    next.right = clamp(crop.right - dx, 0, 1 - next.left - MIN_CROP_SIZE);
  }
  if (mode.includes("n")) {
    next.top = clamp(crop.top + dy, 0, 1 - crop.bottom - MIN_CROP_SIZE);
  }
  if (mode.includes("s")) {
    next.bottom = clamp(crop.bottom - dy, 0, 1 - next.top - MIN_CROP_SIZE);
  }

  return normalizeCrop(next);
}

function zoomCrop(crop: ScanCropRect, delta: number): ScanCropRect {
  return normalizeCrop({
    left: crop.left + delta,
    right: crop.right + delta,
    top: crop.top + delta,
    bottom: crop.bottom + delta,
  });
}

function distance(a: TouchPoint, b: TouchPoint) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
  description = "Drag any side or corner to crop. Drag inside the box to reposition.",
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
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pinchRef = useRef<TouchSnapshot | null>(null);
  const initialCropRef = useRef<ScanCropRect>(normalizeCrop(selectedCrop));
  const [localCrop, setLocalCrop] = useState<ScanCropRect>(() => normalizeCrop(selectedCrop));
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  useEffect(() => {
    setLocalCrop(normalizeCrop(selectedCrop));
  }, [selectedCrop]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const session = dragSessionRef.current;
      if (!session) return;

      event.preventDefault();
      const dx = (event.clientX - session.startX) / Math.max(1, session.imageRect.width);
      const dy = (event.clientY - session.startY) / Math.max(1, session.imageRect.height);
      const next = session.mode === "move"
        ? moveCrop(session.startCrop, dx, dy)
        : resizeCrop(session.startCrop, session.mode, dx, dy);

      setLocalCrop(next);
      onChange(next);
    }

    function handlePointerUp() {
      dragSessionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [onChange]);

  function requestCancel() {
    const hasCropChanges = !cropsEqual(localCrop, initialCropRef.current);
    if (hasCropChanges && typeof window !== "undefined") {
      const ok = window.confirm("Discard unsaved photo crop changes?");
      if (!ok) return;
    }
    onCancel();
  }

  function handleReset() {
    const fullCrop = { left: 0, top: 0, right: 0, bottom: 0 };
    setLocalCrop(fullCrop);
    onChange(fullCrop);
    onReset();
  }

  function startDrag(mode: DragMode, event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const imageRect = imageFrameRef.current?.getBoundingClientRect();
    if (!imageRect) return;

    dragSessionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: localCrop,
      imageRect,
    };

    const cursor = mode === "move"
      ? "move"
      : mode === "n" || mode === "s"
        ? "ns-resize"
        : mode === "e" || mode === "w"
          ? "ew-resize"
          : mode === "ne" || mode === "sw"
            ? "nesw-resize"
            : "nwse-resize";

    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function zoomBy(delta: number) {
    const next = zoomCrop(localCrop, delta);
    setLocalCrop(next);
    onChange(next);
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) return;
    pinchRef.current = {
      distance: distance(event.touches[0], event.touches[1]),
      crop: localCrop,
    };
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const snapshot = pinchRef.current;
    if (!snapshot || event.touches.length !== 2) return;
    event.preventDefault();
    const currentDistance = distance(event.touches[0], event.touches[1]);
    const zoomAmount = clamp((currentDistance - snapshot.distance) / 1400, -0.18, 0.18);
    const next = zoomCrop(snapshot.crop, zoomAmount);
    setLocalCrop(next);
    onChange(next);
  }

  function handleTouchEnd() {
    pinchRef.current = null;
  }

  const left = localCrop.left * 100;
  const top = localCrop.top * 100;
  const width = cropWidth(localCrop) * 100;
  const height = cropHeight(localCrop) * 100;
  const zoomLabel = Math.round((1 / Math.max(cropWidth(localCrop), cropHeight(localCrop))) * 100);
  const cornerHandleClass = "absolute z-30 h-8 w-8 rounded-full border border-white/80 bg-white shadow-[0_0_18px_rgba(0,0,0,0.55)] touch-none pointer-events-auto";
  const edgeHandleClass = "absolute z-30 rounded-full bg-white/95 shadow-[0_0_14px_rgba(0,0,0,0.5)] touch-none pointer-events-auto";

  return (
    <section className={compact ? "relative w-full max-h-[calc(100dvh-24px)] overflow-hidden rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]" : "relative w-full max-h-[calc(100dvh-24px)] overflow-hidden rounded-[20px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-4"}>
      <button
        type="button"
        onClick={requestCancel}
        aria-label="Close crop editor"
        className="absolute right-2 top-2 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-2xl leading-none text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/80"
      >
        ×
      </button>

      {!compact ? (
        <div className="flex flex-wrap items-start justify-between gap-3 pr-12">
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

      <div className={compact ? "mt-2 overflow-hidden rounded-[16px] bg-black/30 p-1.5 ring-1 ring-[color:var(--border)]" : "mt-3 overflow-hidden rounded-[16px] bg-black/30 p-2 ring-1 ring-[color:var(--border)]"}>
        <div
          className={compact ? "relative flex h-[min(58dvh,520px)] min-h-[260px] items-center justify-center overflow-hidden rounded-[12px] bg-black/60 touch-none" : "relative flex h-[min(62dvh,600px)] min-h-[300px] items-center justify-center overflow-hidden rounded-[12px] bg-black/60 touch-none"}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div ref={imageFrameRef} className="relative max-h-full max-w-full">
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="block max-h-[min(58dvh,520px)] max-w-full select-none object-contain"
              style={{ transform: `rotate(${normalizedRotation}deg)`, touchAction: "none" }}
            />

            <div className="pointer-events-none absolute inset-0 bg-black/45" />

            <div
              className="absolute z-20 border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)] touch-none"
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
              onPointerDown={(event) => startDrag("move", event)}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="border border-white/22" />
                ))}
              </div>

              <button type="button" aria-label="Crop top left" onPointerDown={(event) => startDrag("nw", event)} className={`${cornerHandleClass} left-1 top-1 cursor-nwse-resize`} />
              <button type="button" aria-label="Crop top right" onPointerDown={(event) => startDrag("ne", event)} className={`${cornerHandleClass} right-1 top-1 cursor-nesw-resize`} />
              <button type="button" aria-label="Crop bottom left" onPointerDown={(event) => startDrag("sw", event)} className={`${cornerHandleClass} bottom-1 left-1 cursor-nesw-resize`} />
              <button type="button" aria-label="Crop bottom right" onPointerDown={(event) => startDrag("se", event)} className={`${cornerHandleClass} bottom-1 right-1 cursor-nwse-resize`} />
              <button type="button" aria-label="Crop top edge" onPointerDown={(event) => startDrag("n", event)} className={`${edgeHandleClass} left-1/2 top-1 h-7 w-24 -translate-x-1/2 cursor-ns-resize`} />
              <button type="button" aria-label="Crop bottom edge" onPointerDown={(event) => startDrag("s", event)} className={`${edgeHandleClass} bottom-1 left-1/2 h-7 w-24 -translate-x-1/2 cursor-ns-resize`} />
              <button type="button" aria-label="Crop left edge" onPointerDown={(event) => startDrag("w", event)} className={`${edgeHandleClass} left-1 top-1/2 h-24 w-7 -translate-y-1/2 cursor-ew-resize`} />
              <button type="button" aria-label="Crop right edge" onPointerDown={(event) => startDrag("e", event)} className={`${edgeHandleClass} right-1 top-1/2 h-24 w-7 -translate-y-1/2 cursor-ew-resize`} />
            </div>
          </div>
        </div>
      </div>

      <div className={compact ? "mt-2 flex flex-wrap items-center justify-between gap-2 px-1" : "mt-3 flex flex-wrap items-center justify-between gap-2"}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={left <= 0.001 && top <= 0.001 && localCrop.right <= 0.001 && localCrop.bottom <= 0.001} className={iconButtonClass()} aria-label="Zoom out">
            −
          </button>
          <div className="min-w-[72px] text-center text-xs font-semibold text-[color:var(--muted)]">{zoomLabel}%</div>
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={cropWidth(localCrop) <= MIN_CROP_SIZE + 0.01 || cropHeight(localCrop) <= MIN_CROP_SIZE + 0.01} className={iconButtonClass()} aria-label="Zoom in">
            +
          </button>
        </div>

        <div className="text-right text-[11px] leading-4 text-[color:var(--muted)]">
          Pull one side, drag a corner, or drag inside the crop box.
        </div>
      </div>

      <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-4 grid gap-2 sm:flex sm:flex-wrap"}>
        <button type="button" onClick={onApply} disabled={isApplying} className={primaryButtonClass()}>
          {isApplying ? "Saving..." : applyLabel}
        </button>
        <button type="button" onClick={handleReset} className={buttonClass()}>
          Full Photo
        </button>
        <button type="button" onClick={requestCancel} className={buttonClass()}>
          Back
        </button>
      </div>
    </section>
  );
}
