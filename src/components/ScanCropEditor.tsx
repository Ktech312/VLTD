"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

const MIN_CROP_SIZE_PX = 36;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_SPEED = 0.0018;
const BUTTON_ZOOM_STEP = 0.18;

const FULL_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

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

type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DragSession = {
  mode: DragMode;
  startX: number;
  startY: number;
  startBox: CropBox;
};

type TouchPoint = { clientX: number; clientY: number };

type PinchSession = {
  distance: number;
  zoom: number;
  pan: { x: number; y: number };
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
  const left = clamp(Number(crop.left ?? 0), 0, 0.98);
  const top = clamp(Number(crop.top ?? 0), 0, 0.98);
  const right = clamp(Number(crop.right ?? 0), 0, 1 - left - 0.02);
  const bottom = clamp(Number(crop.bottom ?? 0), 0, 1 - top - 0.02);
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

function distance(a: TouchPoint, b: TouchPoint) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midpoint(a: TouchPoint, b: TouchPoint) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}

function scaleBox(box: CropBox, crop: ScanCropRect): CropBox {
  return {
    left: box.left + box.width * crop.left,
    top: box.top + box.height * crop.top,
    width: box.width * (1 - crop.left - crop.right),
    height: box.height * (1 - crop.top - crop.bottom),
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageBaseRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pinchRef = useRef<PinchSession | null>(null);
  const initialCropRef = useRef<ScanCropRect>(normalizeCrop(selectedCrop));
  const lastSelectedCropRef = useRef<ScanCropRect>(normalizeCrop(selectedCrop));

  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [currentCrop, setCurrentCrop] = useState<ScanCropRect>(() => normalizeCrop(selectedCrop));
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  const getBaseBox = useCallback((): CropBox | null => {
    const viewport = viewportRef.current;
    const imageBase = imageBaseRef.current;
    if (!viewport || !imageBase) return null;
    return {
      left: imageBase.offsetLeft,
      top: imageBase.offsetTop,
      width: imageBase.offsetWidth,
      height: imageBase.offsetHeight,
    };
  }, []);

  const getRenderedImageBox = useCallback((nextZoom = zoom, nextPan = pan): CropBox | null => {
    const base = getBaseBox();
    if (!base) return null;
    return {
      left: base.left + nextPan.x - ((nextZoom - 1) * base.width) / 2,
      top: base.top + nextPan.y - ((nextZoom - 1) * base.height) / 2,
      width: base.width * nextZoom,
      height: base.height * nextZoom,
    };
  }, [getBaseBox, pan, zoom]);

  const cropFromBox = useCallback((box: CropBox, nextZoom = zoom, nextPan = pan): ScanCropRect => {
    const rendered = getRenderedImageBox(nextZoom, nextPan);
    if (!rendered || rendered.width <= 0 || rendered.height <= 0) return currentCrop;

    const left = clamp((box.left - rendered.left) / rendered.width, 0, 0.98);
    const top = clamp((box.top - rendered.top) / rendered.height, 0, 0.98);
    const right = clamp((rendered.left + rendered.width - (box.left + box.width)) / rendered.width, 0, 1 - left - 0.02);
    const bottom = clamp((rendered.top + rendered.height - (box.top + box.height)) / rendered.height, 0, 1 - top - 0.02);

    return normalizeCrop({ left, top, right, bottom });
  }, [currentCrop, getRenderedImageBox, pan, zoom]);

  const commitBox = useCallback((box: CropBox, nextZoom = zoom, nextPan = pan) => {
    const nextCrop = cropFromBox(box, nextZoom, nextPan);
    setCropBox(box);
    setCurrentCrop(nextCrop);
    lastSelectedCropRef.current = nextCrop;
    onChange(nextCrop);
  }, [cropFromBox, onChange, pan, zoom]);

  const resetVisualFromCrop = useCallback((nextCrop: ScanCropRect) => {
    const base = getBaseBox();
    if (!base) return;
    const normalized = normalizeCrop(nextCrop);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const nextBox = scaleBox(base, normalized);
    setCropBox(nextBox);
    setCurrentCrop(normalized);
  }, [getBaseBox]);

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
    const nextCrop = normalizeCrop(selectedCrop);
    if (cropsEqual(nextCrop, lastSelectedCropRef.current)) return;
    lastSelectedCropRef.current = nextCrop;
    resetVisualFromCrop(nextCrop);
  }, [resetVisualFromCrop, selectedCrop]);

  useEffect(() => {
    function onResize() {
      resetVisualFromCrop(currentCrop);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [currentCrop, resetVisualFromCrop]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const session = dragSessionRef.current;
      if (!session) return;
      const base = getBaseBox();
      if (!base) return;

      event.preventDefault();
      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      let next = { ...session.startBox };

      if (session.mode === "move") {
        next.left += dx;
        next.top += dy;
      } else {
        if (session.mode.includes("w")) {
          next.left = session.startBox.left + dx;
          next.width = session.startBox.width - dx;
        }
        if (session.mode.includes("e")) {
          next.width = session.startBox.width + dx;
        }
        if (session.mode.includes("n")) {
          next.top = session.startBox.top + dy;
          next.height = session.startBox.height - dy;
        }
        if (session.mode.includes("s")) {
          next.height = session.startBox.height + dy;
        }
      }

      const imageBounds = getRenderedImageBox();
      const bounds = imageBounds ?? base;
      next.width = Math.max(MIN_CROP_SIZE_PX, next.width);
      next.height = Math.max(MIN_CROP_SIZE_PX, next.height);
      next.left = clamp(next.left, bounds.left, bounds.left + bounds.width - next.width);
      next.top = clamp(next.top, bounds.top, bounds.top + bounds.height - next.height);
      next.width = clamp(next.width, MIN_CROP_SIZE_PX, bounds.left + bounds.width - next.left);
      next.height = clamp(next.height, MIN_CROP_SIZE_PX, bounds.top + bounds.height - next.top);

      commitBox(next);
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
  }, [commitBox, getBaseBox, getRenderedImageBox]);

  function requestCancel() {
    const hasCropChanges = !cropsEqual(currentCrop, initialCropRef.current);
    if (hasCropChanges && typeof window !== "undefined") {
      const ok = window.confirm("Discard unsaved photo crop changes?");
      if (!ok) return;
    }
    onCancel();
  }

  function handleReset() {
    lastSelectedCropRef.current = FULL_CROP;
    resetVisualFromCrop(FULL_CROP);
    onChange(FULL_CROP);
    onReset();
  }

  function startDrag(mode: DragMode, event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!cropBox) return;

    dragSessionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBox: cropBox,
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

  function zoomAround(
    screenX: number,
    screenY: number,
    nextZoom: number,
    originZoom = zoom,
    originPan = pan
  ) {
    const base = getBaseBox();
    const viewport = viewportRef.current;
    if (!base || !cropBox || !viewport) return;

    const viewportRect = viewport.getBoundingClientRect();
    const pointX = screenX - viewportRect.left;
    const pointY = screenY - viewportRect.top;
    const safeZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const baseCenterX = base.left + base.width / 2;
    const baseCenterY = base.top + base.height / 2;
    const localX = baseCenterX + (pointX - baseCenterX - originPan.x) / originZoom;
    const localY = baseCenterY + (pointY - baseCenterY - originPan.y) / originZoom;
    const nextPan = {
      x: pointX - baseCenterX - safeZoom * (localX - baseCenterX),
      y: pointY - baseCenterY - safeZoom * (localY - baseCenterY),
    };

    setZoom(safeZoom);
    setPan(nextPan);
    const nextCrop = cropFromBox(cropBox, safeZoom, nextPan);
    setCurrentCrop(nextCrop);
    lastSelectedCropRef.current = nextCrop;
    onChange(nextCrop);
  }

  function zoomBy(delta: number) {
    const box = cropBox;
    const viewport = viewportRef.current;
    if (!box || !viewport) return;
    const viewportRect = viewport.getBoundingClientRect();
    zoomAround(
      viewportRect.left + box.left + box.width / 2,
      viewportRect.top + box.top + box.height / 2,
      zoom + delta
    );
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const zoomDelta = -event.deltaY * WHEEL_ZOOM_SPEED;
    zoomAround(event.clientX, event.clientY, zoom + zoomDelta);
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) return;
    pinchRef.current = {
      distance: distance(event.touches[0], event.touches[1]),
      zoom,
      pan,
    };
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const snapshot = pinchRef.current;
    if (!snapshot || event.touches.length !== 2) return;
    event.preventDefault();
    const currentDistance = distance(event.touches[0], event.touches[1]);
    const scale = currentDistance / Math.max(1, snapshot.distance);
    const currentCenter = midpoint(event.touches[0], event.touches[1]);
    const nextZoom = clamp(snapshot.zoom * scale, MIN_ZOOM, MAX_ZOOM);

    zoomAround(currentCenter.x, currentCenter.y, nextZoom, snapshot.zoom, snapshot.pan);
  }

  function handleTouchEnd() {
    pinchRef.current = null;
  }

  const zoomLabel = Math.round(zoom * 100);
  const cornerHandleClass = "absolute z-30 h-1.5 w-1.5 rounded-full border border-white/90 bg-white/95 shadow-[0_0_5px_rgba(0,0,0,0.55)] touch-none pointer-events-auto";
  const edgeHandleClass = "absolute z-30 rounded-full bg-white/95 shadow-[0_0_5px_rgba(0,0,0,0.5)] touch-none pointer-events-auto";
  const cropStyle = cropBox
    ? { left: cropBox.left, top: cropBox.top, width: cropBox.width, height: cropBox.height }
    : { left: 0, top: 0, width: 0, height: 0 };

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
          ref={viewportRef}
          className={compact ? "relative flex h-[min(58dvh,520px)] min-h-[260px] items-center justify-center overflow-hidden rounded-[12px] bg-black/60 touch-none" : "relative flex h-[min(62dvh,600px)] min-h-[300px] items-center justify-center overflow-hidden rounded-[12px] bg-black/60 touch-none"}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={imageBaseRef}
            className="relative max-h-full max-w-full will-change-transform"
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`, transformOrigin: "center center", touchAction: "none" }}
          >
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              onLoad={() => resetVisualFromCrop(currentCrop)}
              className="block max-h-[min(58dvh,520px)] max-w-full select-none object-contain"
              style={{ transform: `rotate(${normalizedRotation}deg)`, touchAction: "none" }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-black/35" />

          {cropBox ? (
            <div
              className="absolute z-20 border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)] touch-none"
              style={cropStyle}
              onPointerDown={(event) => startDrag("move", event)}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="border border-white/22" />
                ))}
              </div>

              <button type="button" aria-label="Crop top left" onPointerDown={(event) => startDrag("nw", event)} className={`${cornerHandleClass} -left-0.5 -top-0.5 cursor-nwse-resize`} />
              <button type="button" aria-label="Crop top right" onPointerDown={(event) => startDrag("ne", event)} className={`${cornerHandleClass} -right-0.5 -top-0.5 cursor-nesw-resize`} />
              <button type="button" aria-label="Crop bottom left" onPointerDown={(event) => startDrag("sw", event)} className={`${cornerHandleClass} -bottom-0.5 -left-0.5 cursor-nesw-resize`} />
              <button type="button" aria-label="Crop bottom right" onPointerDown={(event) => startDrag("se", event)} className={`${cornerHandleClass} -bottom-0.5 -right-0.5 cursor-nwse-resize`} />
              <button type="button" aria-label="Crop top edge" onPointerDown={(event) => startDrag("n", event)} className={`${edgeHandleClass} -top-0.5 left-1/2 h-1.5 w-5 -translate-x-1/2 cursor-ns-resize`} />
              <button type="button" aria-label="Crop bottom edge" onPointerDown={(event) => startDrag("s", event)} className={`${edgeHandleClass} -bottom-0.5 left-1/2 h-1.5 w-5 -translate-x-1/2 cursor-ns-resize`} />
              <button type="button" aria-label="Crop left edge" onPointerDown={(event) => startDrag("w", event)} className={`${edgeHandleClass} -left-0.5 top-1/2 h-5 w-1.5 -translate-y-1/2 cursor-ew-resize`} />
              <button type="button" aria-label="Crop right edge" onPointerDown={(event) => startDrag("e", event)} className={`${edgeHandleClass} -right-0.5 top-1/2 h-5 w-1.5 -translate-y-1/2 cursor-ew-resize`} />
            </div>
          ) : null}
        </div>
      </div>

      <div className={compact ? "mt-2 flex flex-wrap items-center justify-between gap-2 px-1" : "mt-3 flex flex-wrap items-center justify-between gap-2"}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => zoomBy(-BUTTON_ZOOM_STEP)} disabled={zoom <= MIN_ZOOM + 0.01} className={iconButtonClass()} aria-label="Zoom out">
            −
          </button>
          <div className="min-w-[72px] text-center text-xs font-semibold text-[color:var(--muted)]">{zoomLabel}%</div>
          <button type="button" onClick={() => zoomBy(BUTTON_ZOOM_STEP)} disabled={zoom >= MAX_ZOOM - 0.01} className={iconButtonClass()} aria-label="Zoom in">
            +
          </button>
        </div>

        <div className="text-right text-[11px] leading-4 text-[color:var(--muted)]">
          Pinch or scroll to zoom. Pull one side, drag a corner, or drag inside the crop box.
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
