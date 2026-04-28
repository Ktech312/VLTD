"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Point = { x: number; y: number };
type TouchPoint = { clientX: number; clientY: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: TouchPoint, b: TouchPoint) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export default function ImageViewer({
  images,
  index,
  onClose,
  onEdit,
  onDelete,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState(index || 0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const draggingRef = useRef(false);
  const lastPointRef = useRef<Point>({ x: 0, y: 0 });
  const pinchStartRef = useRef<number | null>(null);
  const pinchScaleStartRef = useRef(1);

  const currentImage = images[current] ?? "";
  const canPan = scale > 1.01;

  useEffect(() => {
    setMounted(true);
  }, []);

  function resetTransform() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function next() {
    setCurrent((c) => (c + 1) % images.length);
    resetTransform();
  }

  function prev() {
    setCurrent((c) => (c - 1 + images.length) % images.length);
    resetTransform();
  }

  function zoomBy(delta: number) {
    setScale((prevScale) => {
      const nextScale = clamp(Number((prevScale + delta).toFixed(2)), 1, 5);
      if (nextScale <= 1.01) setOffset({ x: 0, y: 0 });
      return nextScale;
    });
  }

  useEffect(() => {
    resetTransform();
  }, [currentImage]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && images.length > 1) next();
      if (event.key === "ArrowLeft" && images.length > 1) prev();
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [images.length, onClose]);

  const viewerMarkup = (
    <div
      className="fixed inset-0 z-[90] flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black/94 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchEnd={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="fixed right-3 top-3 z-[110] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/14 text-2xl leading-none text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20 sm:right-4 sm:top-4"
      >
        ×
      </button>

      <div className="fixed left-3 top-3 z-[100] flex max-w-[calc(100dvw-72px)] flex-wrap gap-2 sm:left-4 sm:top-4">
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(current)}
            className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur"
          >
            Edit Photo
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(current)}
            className="rounded-full bg-red-600/75 px-3 py-2 text-sm text-white ring-1 ring-red-400/35 backdrop-blur"
          >
            Delete
          </button>
        ) : null}
      </div>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            className="fixed left-3 top-1/2 z-[100] -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl leading-none text-white ring-1 ring-white/15 backdrop-blur"
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="fixed right-3 top-1/2 z-[100] -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl leading-none text-white ring-1 ring-white/15 backdrop-blur"
            aria-label="Next image"
          >
            ›
          </button>
        </>
      ) : null}

      <div className="fixed inset-x-0 bottom-4 z-[100] flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => zoomBy(-0.25)}
          disabled={scale <= 1}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetTransform}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur"
        >
          Fit {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.25)}
          disabled={scale >= 5}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div
        className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden px-3 pb-20 pt-16 sm:px-12 sm:pb-20 sm:pt-20"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 0.2 : -0.2);
        }}
        onMouseMove={(event) => {
          if (!draggingRef.current || !canPan) return;
          const dx = event.clientX - lastPointRef.current.x;
          const dy = event.clientY - lastPointRef.current.y;
          lastPointRef.current = { x: event.clientX, y: event.clientY };
          setOffset((prevOffset) => ({
            x: prevOffset.x + dx,
            y: prevOffset.y + dy,
          }));
        }}
        onMouseUp={() => {
          draggingRef.current = false;
        }}
        onMouseLeave={() => {
          draggingRef.current = false;
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            pinchStartRef.current = distance(event.touches[0], event.touches[1]);
            pinchScaleStartRef.current = scale;
            return;
          }

          if (event.touches.length === 1 && canPan) {
            draggingRef.current = true;
            lastPointRef.current = {
              x: event.touches[0].clientX,
              y: event.touches[0].clientY,
            };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && pinchStartRef.current) {
            event.preventDefault();
            const currentDistance = distance(event.touches[0], event.touches[1]);
            const nextScale = clamp(
              pinchScaleStartRef.current * (currentDistance / pinchStartRef.current),
              1,
              5
            );
            if (nextScale <= 1.01) setOffset({ x: 0, y: 0 });
            setScale(nextScale);
            return;
          }

          if (event.touches.length === 1 && draggingRef.current && canPan) {
            event.preventDefault();
            const dx = event.touches[0].clientX - lastPointRef.current.x;
            const dy = event.touches[0].clientY - lastPointRef.current.y;
            lastPointRef.current = {
              x: event.touches[0].clientX,
              y: event.touches[0].clientY,
            };
            setOffset((prevOffset) => ({
              x: prevOffset.x + dx,
              y: prevOffset.y + dy,
            }));
          }
        }}
        onTouchEnd={() => {
          draggingRef.current = false;
          pinchStartRef.current = null;
        }}
      >
        {currentImage ? (
          <img
            src={currentImage}
            alt=""
            draggable={false}
            onDoubleClick={() => {
              if (scale > 1) resetTransform();
              else setScale(2);
            }}
            onMouseDown={(event) => {
              if (!canPan) return;
              draggingRef.current = true;
              lastPointRef.current = { x: event.clientX, y: event.clientY };
            }}
            className="block max-h-[calc(100dvh-9rem)] max-w-[calc(100dvw-1.5rem)] select-none object-contain sm:max-h-[calc(100dvh-10rem)] sm:max-w-[calc(100dvw-6rem)]"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: draggingRef.current ? "none" : "transform 120ms ease-out",
              cursor: canPan ? "grab" : "zoom-in",
              touchAction: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(viewerMarkup, document.body);
}
