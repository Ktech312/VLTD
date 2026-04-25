"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import type { ScanCropRect } from "@/lib/scanners/cropImageFile";

type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_CROP_SIZE = 0.12;
const FULL_CROP: CropBox = { x: 0, y: 0, width: 1, height: 1 };

function buttonClass() {
  return "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

function primaryButtonClass() {
  return "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropToBox(crop: ScanCropRect): CropBox {
  const x = clamp(crop.left, 0, 0.9);
  const y = clamp(crop.top, 0, 0.9);
  const width = clamp(1 - crop.left - crop.right, MIN_CROP_SIZE, 1);
  const height = clamp(1 - crop.top - crop.bottom, MIN_CROP_SIZE, 1);

  return {
    x: clamp(x, 0, 1 - width),
    y: clamp(y, 0, 1 - height),
    width,
    height,
  };
}

function boxToCrop(box: CropBox): ScanCropRect {
  return {
    left: clamp(box.x, 0, 0.9),
    top: clamp(box.y, 0, 0.9),
    right: clamp(1 - box.x - box.width, 0, 0.9),
    bottom: clamp(1 - box.y - box.height, 0, 0.9),
  };
}

function normalizeBox(box: CropBox): CropBox {
  const width = clamp(box.width, MIN_CROP_SIZE, 1);
  const height = clamp(box.height, MIN_CROP_SIZE, 1);

  return {
    x: clamp(box.x, 0, 1 - width),
    y: clamp(box.y, 0, 1 - height),
    width,
    height,
  };
}

function resizeBox(start: CropBox, mode: DragMode, dx: number, dy: number): CropBox {
  const next = { ...start };

  if (mode.includes("w")) {
    const right = start.x + start.width;
    next.x = clamp(start.x + dx, 0, right - MIN_CROP_SIZE);
    next.width = right - next.x;
  }

  if (mode.includes("e")) {
    next.width = clamp(start.width + dx, MIN_CROP_SIZE, 1 - start.x);
  }

  if (mode.includes("n")) {
    const bottom = start.y + start.height;
    next.y = clamp(start.y + dy, 0, bottom - MIN_CROP_SIZE);
    next.height = bottom - next.y;
  }

  if (mode.includes("s")) {
    next.height = clamp(start.height + dy, MIN_CROP_SIZE, 1 - start.y);
  }

  return normalizeBox(next);
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  description = "Drag the crop box or pull its corners. Pinch the crop box on phone/tablet to resize it.",
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    startBox: CropBox;
  } | null>(null);

  const [box, setBox] = useState<CropBox>(() => cropToBox(crop));
  const [imageBox, setImageBox] = useState<ImageBox>({ x: 0, y: 0, width: 1, height: 1 });
  const [imageLoadTick, setImageLoadTick] = useState(0);

  const normalizedRotation = useMemo(() => ((rotation % 360) + 360) % 360, [rotation]);

  useEffect(() => {
    setBox(cropToBox(crop));
  }, [crop]);

  useEffect(() => {
    function updateImageBox() {
      const container = containerRef.current;
      const image = imageRef.current;
      if (!container || !image) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const naturalWidth = image.naturalWidth || 1;
      const naturalHeight = image.naturalHeight || 1;
      const rotated = normalizedRotation === 90 || normalizedRotation === 270;
      const sourceWidth = rotated ? naturalHeight : naturalWidth;
      const sourceHeight = rotated ? naturalWidth : naturalHeight;
      const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;

      setImageBox({
        x: (containerWidth - width) / 2,
        y: (containerHeight - height) / 2,
        width,
        height,
      });
    }

    updateImageBox();
    const observer = new ResizeObserver(updateImageBox);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [imageLoadTick, imageUrl, normalizedRotation]);

  function commitBox(next: CropBox) {
    const normalized = normalizeBox(next);
    setBox(normalized);
    onChange(boxToCrop(normalized));
  }

  function handleReset() {
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
    setBox(FULL_CROP);
    onReset();
  }

  function startDrag(event: PointerEvent<HTMLElement>, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: pointerDistance(first, second),
        startBox: box,
      };
      dragRef.current = null;
      return;
    }

    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startBox: box,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: pointerDistance(first, second),
        startBox: box,
      };
      dragRef.current = null;
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const nextDistance = pointerDistance(first, second);
      const scale = nextDistance / Math.max(1, pinchRef.current.distance);
      const start = pinchRef.current.startBox;
      const nextWidth = clamp(start.width / scale, MIN_CROP_SIZE, 1);
      const nextHeight = clamp(start.height / scale, MIN_CROP_SIZE, 1);
      const centerX = start.x + start.width / 2;
      const centerY = start.y + start.height / 2;

      commitBox({
        x: centerX - nextWidth / 2,
        y: centerY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = (event.clientX - drag.startX) / Math.max(1, imageBox.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, imageBox.height);

    if (drag.mode === "move") {
      commitBox({
        ...drag.startBox,
        x: drag.startBox.x + dx,
        y: drag.startBox.y + dy,
      });
      return;
    }

    commitBox(resizeBox(drag.startBox, drag.mode, dx, dy));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  const cropStyle = {
    left: imageBox.x + box.x * imageBox.width,
    top: imageBox.y + box.y * imageBox.height,
    width: box.width * imageBox.width,
    height: box.height * imageBox.height,
  };

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

      <div className={compact ? "overflow-hidden rounded-[16px] bg-black/20 p-1.5 ring-1 ring-[color:var(--border)]" : "mt-3 overflow-hidden rounded-[16px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]"}>
        <div
          ref={containerRef}
          className={compact ? "relative h-[50dvh] min-h-[250px] max-h-[390px] overflow-hidden rounded-[12px] bg-black/40 [touch-action:none]" : "relative h-[52svh] min-h-[320px] max-h-[520px] overflow-hidden rounded-[12px] bg-black/40 [touch-action:none] sm:h-[440px]"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Photo being cropped"
            onLoad={() => setImageLoadTick((tick) => tick + 1)}
            className="absolute object-contain select-none"
            style={{
              left: imageBox.x,
              top: imageBox.y,
              width: imageBox.width,
              height: imageBox.height,
              transform: `rotate(${normalizedRotation}deg)`,
            }}
            draggable={false}
          />

          <div
            className="absolute bg-black/45"
            style={{ left: imageBox.x, top: imageBox.y, width: imageBox.width, height: box.y * imageBox.height }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: imageBox.x,
              top: imageBox.y + (box.y + box.height) * imageBox.height,
              width: imageBox.width,
              height: (1 - box.y - box.height) * imageBox.height,
            }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: imageBox.x,
              top: imageBox.y + box.y * imageBox.height,
              width: box.x * imageBox.width,
              height: box.height * imageBox.height,
            }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: imageBox.x + (box.x + box.width) * imageBox.width,
              top: imageBox.y + box.y * imageBox.height,
              width: (1 - box.x - box.width) * imageBox.width,
              height: box.height * imageBox.height,
            }}
          />

          <div
            className="absolute cursor-move border-2 border-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_0_24px_rgba(34,211,238,0.35)]"
            style={cropStyle}
            onPointerDown={(event) => startDrag(event, "move")}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/35" />
            <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/35" />
            <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/35" />
            <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/35" />

            {(["nw", "ne", "sw", "se"] as DragMode[]).map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize crop ${handle}`}
                onPointerDown={(event) => startDrag(event, handle)}
                className={[
                  "absolute h-7 w-7 rounded-full border-2 border-white bg-[color:var(--pill-active-bg)] shadow-lg",
                  handle.includes("n") ? "-top-3.5" : "-bottom-3.5",
                  handle.includes("w") ? "-left-3.5" : "-right-3.5",
                ].join(" ")}
              />
            ))}

            {(["n", "e", "s", "w"] as DragMode[]).map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label={`Resize crop ${handle}`}
                onPointerDown={(event) => startDrag(event, handle)}
                className={[
                  "absolute rounded-full border border-white/80 bg-white/70",
                  handle === "n" || handle === "s" ? "left-1/2 h-3 w-10 -translate-x-1/2" : "top-1/2 h-10 w-3 -translate-y-1/2",
                  handle === "n" ? "-top-1.5" : "",
                  handle === "s" ? "-bottom-1.5" : "",
                  handle === "e" ? "-right-1.5" : "",
                  handle === "w" ? "-left-1.5" : "",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 rounded-[16px] bg-black/10 p-3 text-xs leading-5 text-[color:var(--muted)] ring-1 ring-white/8">
        Move the crop box, drag any edge or corner to resize it, or pinch the crop box on a phone/tablet.
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
