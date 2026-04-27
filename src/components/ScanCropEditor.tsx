"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area, type Point, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

const MAX_ZOOM = 8;
const MIN_CROP_WIDTH = 72;
const MIN_CROP_HEIGHT = 72;
const DEFAULT_CROP_POINT: Point = { x: 0, y: 0 };

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeSession = {
  handle: ResizeHandle;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
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

function cropsEqual(a: ScanCropRect, b: ScanCropRect) {
  return (
    Math.abs(a.left - b.left) < 0.001 &&
    Math.abs(a.top - b.top) < 0.001 &&
    Math.abs(a.right - b.right) < 0.001 &&
    Math.abs(a.bottom - b.bottom) < 0.001
  );
}

function cropRectToPercentages(crop: ScanCropRect) {
  const left = clamp(crop.left, 0, 0.98);
  const top = clamp(crop.top, 0, 0.98);
  const width = clamp(1 - crop.left - crop.right, 0.02, 1);
  const height = clamp(1 - crop.top - crop.bottom, 0.02, 1);

  return {
    x: left * 100,
    y: top * 100,
    width: width * 100,
    height: height * 100,
  };
}

function areaToCropRect(area: Area): ScanCropRect {
  return {
    left: clamp(area.x / 100, 0, 0.98),
    top: clamp(area.y / 100, 0, 0.98),
    right: clamp((100 - area.x - area.width) / 100, 0, 0.98),
    bottom: clamp((100 - area.y - area.height) / 100, 0, 0.98),
  };
}

function maxCropFrameForViewport(viewport: Size): Size {
  return {
    width: Math.max(MIN_CROP_WIDTH, viewport.width * 0.92),
    height: Math.max(MIN_CROP_HEIGHT, viewport.height * 0.88),
  };
}

function initialCropFrameSize(viewport: Size, crop: ScanCropRect): Size {
  const maxFrame = maxCropFrameForViewport(viewport);
  const widthRatio = clamp(1 - crop.left - crop.right, 0.18, 1);
  const heightRatio = clamp(1 - crop.top - crop.bottom, 0.18, 1);

  return {
    width: clamp(maxFrame.width * widthRatio, MIN_CROP_WIDTH, maxFrame.width),
    height: clamp(maxFrame.height * heightRatio, MIN_CROP_HEIGHT, maxFrame.height),
  };
}

function resizeCropFrame(
  start: Size,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  maxFrame: Size
): Size {
  const affectsWest = handle.includes("w");
  const affectsEast = handle.includes("e");
  const affectsNorth = handle.includes("n");
  const affectsSouth = handle.includes("s");

  const widthDelta = (affectsEast ? deltaX : 0) + (affectsWest ? -deltaX : 0);
  const heightDelta = (affectsSouth ? deltaY : 0) + (affectsNorth ? -deltaY : 0);

  return {
    width: clamp(start.width + widthDelta, MIN_CROP_WIDTH, maxFrame.width),
    height: clamp(start.height + heightDelta, MIN_CROP_HEIGHT, maxFrame.height),
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
  description = "Pinch to zoom, drag the photo, or pull the crop handles from any side.",
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const initialCropRef = useRef<ScanCropRect>(selectedCrop);
  const [cropPoint, setCropPoint] = useState<Point>(DEFAULT_CROP_POINT);
  const [zoom, setZoom] = useState(1);
  const [cropperSize, setCropperSize] = useState<Size | null>(null);
  const [cropFrameSize, setCropFrameSize] = useState<Size | null>(null);
  const initialCroppedAreaPercentages = useMemo(
    () => cropRectToPercentages(selectedCrop),
    [selectedCrop]
  );
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const cropAspect = cropFrameSize ? cropFrameSize.width / cropFrameSize.height : 1;

  const setCropperElement = useCallback((node: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    if (!node) return;

    const updateSize = () => {
      setCropperSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    if (!cropperSize) return;
    setCropFrameSize((current) => current ?? initialCropFrameSize(cropperSize, selectedCrop));
  }, [cropperSize, selectedCrop]);

  useEffect(() => {
    return () => resizeObserverRef.current?.disconnect();
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const session = resizeSessionRef.current;
      if (!session || !cropperSize) return;

      const next = resizeCropFrame(
        { width: session.startWidth, height: session.startHeight },
        session.handle,
        event.clientX - session.startX,
        event.clientY - session.startY,
        maxCropFrameForViewport(cropperSize)
      );

      setCropFrameSize(next);
    }

    function handlePointerUp() {
      resizeSessionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [cropperSize]);

  function requestCancel() {
    const hasCropChanges = !cropsEqual(selectedCrop, initialCropRef.current);
    const hasViewChanges = Math.abs(zoom - 1) > 0.01;
    if ((hasCropChanges || hasViewChanges) && typeof window !== "undefined") {
      const ok = window.confirm("Discard unsaved photo crop changes?");
      if (!ok) return;
    }
    onCancel();
  }

  function handleReset() {
    setCropPoint(DEFAULT_CROP_POINT);
    setZoom(1);
    if (cropperSize) setCropFrameSize(maxCropFrameForViewport(cropperSize));
    onReset();
  }

  function startResize(handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!cropFrameSize) return;

    resizeSessionRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: cropFrameSize.width,
      startHeight: cropFrameSize.height,
    };
    document.body.style.cursor = handle.includes("n") || handle.includes("s") ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function zoomBy(delta: number) {
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), 1, MAX_ZOOM));
  }

  const handleBaseClass = "absolute z-20 rounded-full border border-white/70 bg-white/90 shadow-[0_0_18px_rgba(0,0,0,0.45)] touch-none";
  const edgeBaseClass = "absolute z-20 rounded-full bg-white/90 shadow-[0_0_14px_rgba(0,0,0,0.4)] touch-none";

  return (
    <section className={compact ? "relative rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]" : "relative rounded-[20px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-4"}>
      <button
        type="button"
        onClick={requestCancel}
        aria-label="Close crop editor"
        className="absolute right-2 top-2 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-2xl leading-none text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70"
      >
        ×
      </button>

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
        <div ref={setCropperElement} className={compact ? "relative h-[68dvh] min-h-[320px] overflow-hidden rounded-[12px] bg-black/50 touch-none" : "relative h-[68dvh] min-h-[360px] max-h-[680px] overflow-hidden rounded-[12px] bg-black/50 touch-none"}>
          <Cropper
            image={imageUrl}
            crop={cropPoint}
            zoom={zoom}
            rotation={normalizedRotation}
            aspect={cropAspect}
            minZoom={1}
            maxZoom={MAX_ZOOM}
            objectFit="contain"
            showGrid
            restrictPosition
            cropSize={cropFrameSize ?? undefined}
            initialCroppedAreaPercentages={initialCroppedAreaPercentages}
            onCropChange={setCropPoint}
            onZoomChange={setZoom}
            onCropComplete={(croppedAreaPercentages) => {
              onChange(areaToCropRect(croppedAreaPercentages));
            }}
          />

          {cropFrameSize ? (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ width: cropFrameSize.width, height: cropFrameSize.height }}
              aria-hidden="true"
            >
              <button type="button" aria-label="Resize crop from top left" onPointerDown={(event) => startResize("nw", event)} className={`${handleBaseClass} -left-3 -top-3 h-7 w-7 cursor-nwse-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from top right" onPointerDown={(event) => startResize("ne", event)} className={`${handleBaseClass} -right-3 -top-3 h-7 w-7 cursor-nesw-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from bottom left" onPointerDown={(event) => startResize("sw", event)} className={`${handleBaseClass} -bottom-3 -left-3 h-7 w-7 cursor-nesw-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from bottom right" onPointerDown={(event) => startResize("se", event)} className={`${handleBaseClass} -bottom-3 -right-3 h-7 w-7 cursor-nwse-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from top" onPointerDown={(event) => startResize("n", event)} className={`${edgeBaseClass} -top-3 left-1/2 h-6 w-20 -translate-x-1/2 cursor-ns-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from bottom" onPointerDown={(event) => startResize("s", event)} className={`${edgeBaseClass} -bottom-3 left-1/2 h-6 w-20 -translate-x-1/2 cursor-ns-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from left" onPointerDown={(event) => startResize("w", event)} className={`${edgeBaseClass} -left-3 top-1/2 h-20 w-6 -translate-y-1/2 cursor-ew-resize pointer-events-auto`} />
              <button type="button" aria-label="Resize crop from right" onPointerDown={(event) => startResize("e", event)} className={`${edgeBaseClass} -right-3 top-1/2 h-20 w-6 -translate-y-1/2 cursor-ew-resize pointer-events-auto`} />
            </div>
          ) : null}
        </div>
      </div>

      <div className={compact ? "mt-2 flex flex-wrap items-center justify-between gap-2 px-1" : "mt-3 flex flex-wrap items-center justify-between gap-2"}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => zoomBy(-0.25)} disabled={zoom <= 1} className={iconButtonClass()} aria-label="Zoom out">
            −
          </button>
          <div className="min-w-[64px] text-center text-xs font-semibold text-[color:var(--muted)]">{zoom.toFixed(1)}x</div>
          <button type="button" onClick={() => zoomBy(0.25)} disabled={zoom >= MAX_ZOOM} className={iconButtonClass()} aria-label="Zoom in">
            +
          </button>
        </div>

        <div className="text-right text-[11px] leading-4 text-[color:var(--muted)]">
          Pinch or tap + / − to zoom. Drag the photo. Pull any white handle to crop.
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
