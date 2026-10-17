"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Glyph } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import type { Gallery } from "@/lib/galleryModel";

// Home's flip-through of every exhibition for the active profile. This is the earlier coverflow (index-driven, so it wraps around with
// no cloned cards and works the same for mouse, touch and pen), brought back and widened to use the room the Home card has:
// the card size and spacing follow the width of the card, and the neighbours on both sides stay in view.
//
// - `activeIndex` is the committed card; `dragDelta` is a continuous offset that exists only while a pointer drags. Cards render at
//   their wrapped distance from (activeIndex + dragDelta), so they follow the pointer 1:1 and ease into place on release.
// - Keyboard: Left/Right (and Home/End) on the carousel; the arrows are real buttons; the active card and its title are links.
// - Zero exhibitions: a one-line empty state. One: just the card, no arrows.

const CLICK_THRESHOLD_PX = 6;

function wrapIndex(i: number, n: number) {
  if (n === 0) return 0;
  return ((Math.round(i) % n) + n) % n;
}

function wrappedDelta(i: number, position: number, n: number) {
  if (n === 0) return 0;
  let d = i - position;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

export default function ExhibitionCarousel({ galleries }: { galleries: Gallery[] }) {
  const n = galleries.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(900);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const dragMoved = useRef(false);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [n]);

  // The list loads in after the page does and can change: never point past the end.
  useEffect(() => {
    if (activeIndex > n - 1) setActiveIndex(Math.max(0, n - 1));
  }, [n, activeIndex]);

  const reducedMotion = useMemo(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  if (n === 0) return null;

  // Geometry follows the card's width: wide cards on a desktop, three neighbours each side; two on a tablet, one on a phone.
  const cardW = Math.round(Math.min(184, Math.max(104, width * 0.18)));
  const cardH = Math.round(cardW * 1.28);
  const windowDepth = width >= 820 ? 3 : width >= 520 ? 2 : 1;
  const spacing = Math.max(48, Math.min(cardW * 0.8, (width / 2 - cardW / 2 - 8) / windowDepth));
  const trackH = cardH + 18;

  const current = galleries[Math.min(activeIndex, n - 1)];
  const pieces = current.itemIds?.length ?? 0;
  const position = activeIndex + dragDelta;

  function goTo(target: number) {
    setDragDelta(0);
    setActiveIndex(wrapIndex(target, n));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (n < 2) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(activeIndex + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(activeIndex - 1); }
    else if (e.key === "Home") { e.preventDefault(); goTo(0); }
    else if (e.key === "End") { e.preventDefault(); goTo(n - 1); }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (n < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointerId.current = e.pointerId;
    dragStartX.current = e.clientX;
    dragStartIndex.current = activeIndex;
    dragMoved.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== e.pointerId) return;
    const deltaPx = e.clientX - dragStartX.current;
    if (!dragMoved.current && Math.abs(deltaPx) > CLICK_THRESHOLD_PX) {
      dragMoved.current = true;
      setDragging(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    }
    if (dragMoved.current) setDragDelta(-deltaPx / spacing);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setDragging(false);
    if (dragMoved.current) {
      goTo(dragStartIndex.current + dragDelta);
      // The click that follows this pointer-up must not also open a card.
      window.setTimeout(() => { dragMoved.current = false; }, 0);
    } else {
      setDragDelta(0);
    }
  }

  const cards = galleries
    .map((gallery, i) => ({ gallery, i, delta: wrappedDelta(i, position, n) }))
    .filter((c) => Math.abs(c.delta) <= windowDepth + 0.6);

  return (
    <div ref={rootRef} role="region" aria-roledescription="carousel" aria-label="Your exhibitions" style={{ padding: "12px 12px 10px" }}>
      <div className="relative">
        <div
          role="group"
          aria-label={n > 1 ? `Exhibition ${activeIndex + 1} of ${n}. Use the left and right arrow keys to flip through.` : "Your exhibition"}
          tabIndex={n > 1 ? 0 : -1}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pill-active-ring)]"
          style={{ height: trackH, perspective: "800px", touchAction: n > 1 ? "pan-y" : "auto", cursor: n > 1 ? (dragging ? "grabbing" : "grab") : "default", userSelect: "none" }}
        >
          {cards.map(({ gallery, i, delta }) => {
            const absDist = Math.abs(delta);
            const isActive = absDist < 0.5;
            const scale = Math.max(0.6, 1 - absDist * 0.16);
            const tilt = Math.max(-36, Math.min(36, -delta * 24));
            const depth = Math.min(absDist, windowDepth) * 40;
            const opacity = Math.max(0, 1 - absDist * 0.32);
            const common: React.CSSProperties = {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: cardW,
              height: cardH,
              marginLeft: -cardW / 2,
              marginTop: -cardH / 2,
              borderRadius: 10,
              overflow: "hidden",
              transform: `translateX(${delta * spacing}px) translateZ(${-depth}px) rotateY(${tilt}deg) scale(${scale})`,
              opacity,
              zIndex: Math.round(100 - absDist * 10),
              transition: reducedMotion || dragging ? "none" : "transform 0.32s cubic-bezier(0.22,0.61,0.36,1), opacity 0.32s ease",
              border: isActive ? "2px solid rgba(203,208,213,0.55)" : "1px solid rgba(203,208,213,0.16)",
              background: "var(--theme-card, rgba(10,18,35,0.9))",
              boxShadow: isActive ? "0 8px 28px rgba(0,0,0,0.5)" : "none",
              display: "block",
              padding: 0,
            };
            const face = gallery.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gallery.coverImage} alt="" loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 8, textAlign: "center", color: "var(--theme-text-secondary, #9BA0A6)" }}>
                <Glyph name="exhibition" size={24} />
                <span style={{ fontSize: 11, lineHeight: 1.2 }}>{gallery.title || "Untitled"}</span>
              </span>
            );
            const label = `${gallery.title || "Untitled"}, exhibition ${i + 1} of ${n}`;
            return isActive ? (
              <Link
                key={gallery.id}
                href={"/gallery/" + gallery.id}
                aria-label={`Open ${label}`}
                aria-current="true"
                draggable={false}
                onClickCapture={(e) => { if (dragMoved.current) { e.preventDefault(); e.stopPropagation(); } }}
                style={common}
              >
                {face}
              </Link>
            ) : (
              <button
                key={gallery.id}
                type="button"
                aria-label={`Show ${label}`}
                tabIndex={-1}
                onClick={() => { if (dragMoved.current) return; goTo(position + delta); }}
                style={common}
              >
                {face}
              </button>
            );
          })}
        </div>

        {n > 1 ? (
          <>
            <PillButton onClick={() => goTo(activeIndex - 1)} ariaLabel="Previous exhibition" title="Previous exhibition" className="absolute left-0 top-1/2 z-[200] w-11 -translate-y-1/2 px-0! md:w-9">
              <AppIcon name="back" size={18} />
            </PillButton>
            <PillButton onClick={() => goTo(activeIndex + 1)} ariaLabel="Next exhibition" title="Next exhibition" className="absolute right-0 top-1/2 z-[200] w-11 -translate-y-1/2 px-0! md:w-9">
              <AppIcon name="next" size={18} />
            </PillButton>
          </>
        ) : null}
      </div>

      <div style={{ marginTop: 8, textAlign: "center", minWidth: 0 }} aria-live="polite">
        <Link href={"/gallery/" + current.id} style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)", fontSize: 18, fontWeight: 700, color: "var(--theme-text-primary, #ECEDEF)", textDecoration: "none", display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current.title || "Untitled"}
        </Link>
        <div style={{ fontSize: 12, color: "var(--theme-text-secondary, #9BA0A6)", marginTop: 2 }}>
          {pieces} piece{pieces === 1 ? "" : "s"}{n > 1 ? ` · ${activeIndex + 1} of ${n}` : ""}
        </div>
      </div>
    </div>
  );
}
