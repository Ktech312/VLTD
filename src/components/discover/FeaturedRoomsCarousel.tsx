"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Glyph } from "@/components/ui/Glyph";

export type FeaturedRoomSlide = {
  id: string;
  title: string;
  collectorName: string;
  itemCount: number;
  universeLabel: string;
  /** The exhibition's own configured room background (uploaded image, else its theme). Never the cover thumbnail. */
  backgroundUrl: string | null;
  /** The cover thumbnail, shown only as the slide's picture. */
  coverUrl: string | null;
  href: string;
  /** A few of the room's own public items, shown as small previews on the slide. */
  previews?: { src: string; title: string }[];
};

const SWIPE_PX = 48;

/**
 * Featured rooms, one per slide. Each slide is ONE object: its background, picture, title and destination all come from the same
 * room, so they cannot drift apart. Slides change by arrows, dots, keyboard, mouse drag and finger swipe (pointer events cover both).
 */
export default function FeaturedRoomsCarousel({ slides }: { slides: FeaturedRoomSlide[] }) {
  const [index, setIndex] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const drag = useRef<{ id: number; startX: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const count = slides.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  if (count === 0) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag.current = { id: event.pointerId, startX: event.clientX, moved: false };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) {
      d.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (d.moved) setDragPx(dx);
  }
  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    const dx = event.clientX - d.startX;
    setDragPx(0);
    if (d.moved) {
      suppressClick.current = true;
      // The click that follows a drag must not open the room.
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (event.type === "pointerup") {
        if (dx <= -SWIPE_PX) go(current + 1);
        else if (dx >= SWIPE_PX) go(current - 1);
      }
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") { event.preventDefault(); go(current - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); go(current + 1); }
  }

  return (
    <div
      className="vltd-dark-surface relative overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.22)]"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured rooms"
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="featured-carousel"
      data-index={current}
    >
      <div
        className="flex select-none"
        style={{
          transform: `translateX(calc(${-current * 100}% + ${dragPx}px))`,
          transition: dragPx === 0 ? "transform 320ms ease" : "none",
          touchAction: "pan-y",
          cursor: count > 1 ? "grab" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className="relative min-h-[240px] w-full shrink-0"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.title}`}
            aria-hidden={i === current ? undefined : true}
            data-slide-id={slide.id}
            data-slide-bg={slide.backgroundUrl ?? ""}
            style={{ background: slide.backgroundUrl ? `#0B0D10 url(${slide.backgroundUrl}) center/cover no-repeat` : "linear-gradient(135deg,#15181c,#0B0D10)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#040909] via-[#040909]/70 to-transparent" />
            <div className="relative flex min-h-[240px] items-center gap-5 px-12 py-6 sm:px-14">
              <div className="min-w-0 max-w-[420px] flex-1">
                <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "#C8CDD2" }}>
                  {slide.universeLabel} · {i + 1} of {count}
                </div>
                <h3 className="mt-2 truncate font-serif text-[28px] font-black leading-tight" style={{ color: "#ECEDEF" }} title={slide.title}>{slide.title}</h3>
                <p className="mt-1 text-sm" style={{ color: "#ECEDEF" }}>
                  by {slide.collectorName} · {slide.itemCount} {slide.itemCount === 1 ? "item" : "items"}
                </p>
                <Link
                  href={slide.href}
                  draggable={false}
                  tabIndex={i === current ? 0 : -1}
                  className="mt-4 inline-flex h-11 md:h-9 items-center rounded-full px-4 text-sm font-black"
                  style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}
                >
                  <span className="max-w-[190px] truncate sm:max-w-[260px]">View {slide.title}</span>&nbsp;&rarr;
                </Link>
                {slide.previews && slide.previews.length > 0 ? (
                  <div className="mt-3 flex gap-1.5" data-testid="slide-previews">
                    {slide.previews.slice(0, 4).map((p, k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={k} src={p.src} alt={p.title} draggable={false} className="h-12 w-12 rounded-[5px] border border-[rgba(203,208,213,0.35)] object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
              {slide.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.coverUrl}
                  alt=""
                  draggable={false}
                  className="hidden h-[150px] w-[150px] shrink-0 rounded-[7px] border border-[rgba(203,208,213,0.35)] object-cover shadow-lg sm:block"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous featured room"
            onClick={() => go(current - 1)}
            className="vltd-tap absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[rgba(203,208,213,0.35)] bg-black/55 text-[#ECEDEF]"
          >
            <Glyph name="next" size={16} style={{ transform: "scaleX(-1)" }} />
          </button>
          <button
            type="button"
            aria-label="Next featured room"
            onClick={() => go(current + 1)}
            className="vltd-tap absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[rgba(203,208,213,0.35)] bg-black/55 text-[#ECEDEF]"
          >
            <Glyph name="next" size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1" role="group" aria-label="Choose a featured room">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show ${slide.title}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => go(i)}
                className="grid h-6 w-6 place-items-center max-md:h-11 max-md:w-11"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: i === current ? "var(--theme-gold,#C8CDD2)" : "rgba(240,234,214,0.35)" }} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
