"use client";

import { useEffect, useRef, useState } from "react";

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
  const [current, setCurrent] = useState(index || 0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const draggingRef = useRef(false);
  const lastPointRef = useRef<Point>({ x: 0, y: 0 });
  const pinchStartRef = useRef<number | null>(null);
  const pinchScaleStartRef = useRef(1);

  const currentImage = images[current] ?? "";

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
    setScale((prevScale) => clamp(prevScale + delta, 1, 5));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && images.length > 1) next();
      if (event.key === "ArrowLeft" && images.length > 1) prev();
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [images.length, onClose]);

  const canPan = scale > 1;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/94 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute right-3 top-3 z-[110] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-2xl leading-none text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/18 sm:right-4 sm:top-4"
      >
        ×
      </button>

      <div className="absolute left-4 top-4 z-[100] flex flex-wrap gap-2">
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
            className="absolute left-3 top-1/2 z-[100] -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl leading-none text-white ring-1 ring-white/15 backdrop-blur"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 z-[100] -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-3xl leading-none text-white ring-1 ring-white/15 backdrop-blur"
          >
            ›
          </button>
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-4 z-[100] flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => zoomBy(-0.25)}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur"
        >
          −
        </button>
        <div className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur">
          {Math.round(scale * 100)}%
        </div>
        <button
          type="button"
          onClick={() => zoomBy(0.25)}
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 backdrop-blur"
        >
          +
        </button>
      </div>

      <div
        className="absolute inset-0 overflow-hidden px-8 pt-16 pb-24 sm:px-12 sm:pt-20 sm:pb-24"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onWheel={(e) => {
          e.preventDefault();
          zoomBy(e.deltaY < 0 ? 0.2 : -0.2);
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current || !canPan) return;
          const dx = e.clientX - lastPointRef.current.x;
          const dy = e.clientY - lastPointRef.current.y;
          lastPointRef.current = { x: e.clientX, y: e.clientY };
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
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            pinchStartRef.current = distance(e.touches[0], e.touches[1]);
            pinchScaleStartRef.current = scale;
            return;
          }

          if (e.touches.length === 1 && canPan) {
            draggingRef.current = true;
            lastPointRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchStartRef.current) {
            const currentDistance = distance(e.touches[0], e.touches[1]);
            const nextScale = clamp(
              pinchScaleStartRef.current * (currentDistance / pinchStartRef.current),
              1,
              5
            );
            setScale(nextScale);
            return;
          }

          if (e.touches.length === 1 && draggingRef.current && canPan) {
            const dx = e.touches[0].clientX - lastPointRef.current.x;
            const dy = e.touches[0].clientY - lastPointRef.current.y;
            lastPointRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
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
        <div className="flex h-full items-center justify-center">
          {currentImage ? (
            <img
              src={currentImage}
              alt=""
              draggable={false}
              onDoubleClick={() => {
                if (scale > 1) {
                  resetTransform();
                } else {
                  setScale(2);
                }
              }}
              onMouseDown={(e) => {
                if (!canPan) return;
                draggingRef.current = true;
                lastPointRef.current = { x: e.clientX, y: e.clientY };
              }}
              className="select-none object-contain"
              style={{
                maxWidth: "92vw",
                maxHeight: "calc(100dvh - 8rem)",
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "top center",
                transition: "transform 140ms ease-out",
                cursor: canPan ? "grab" : "zoom-in",
                touchAction: "none",
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
