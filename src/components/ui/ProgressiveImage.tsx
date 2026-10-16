"use client";

/* eslint-disable @next/next/no-img-element -- This is the app-owned progressive image primitive. */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// A page of cards used to start every photo at once. On a slow link they then all shared the bandwidth and all finished late,
// together, so nothing appeared for a long time. Photos that opt in (deferOffscreen) are asked for a few at a time, in page order,
// so the first row is there while the rest are still on their way.
const MAX_CONCURRENT_PHOTOS = 6;
const PHOTO_SLOT_TIMEOUT_MS = 20_000;
let activePhotoLoads = 0;
const waitingForSlot: Array<() => void> = [];

function takePhotoSlot(start: () => void): () => void {
  let released = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    activePhotoLoads += 1;
    timer = setTimeout(release, PHOTO_SLOT_TIMEOUT_MS); // a photo that never answers must not hold up the others
    start();
  };
  function release() {
    if (released) return;
    released = true;
    if (timer) clearTimeout(timer);
    if (waitingForSlot.includes(run)) {
      waitingForSlot.splice(waitingForSlot.indexOf(run), 1); // it never started
      return;
    }
    activePhotoLoads = Math.max(0, activePhotoLoads - 1);
    const next = waitingForSlot.shift();
    if (next) next();
  }
  if (activePhotoLoads < MAX_CONCURRENT_PHOTOS) run();
  else waitingForSlot.push(run);
  return release;
}

type ProgressiveImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  placeholderClassName?: string;
  loading?: "eager" | "lazy";
  /**
   * Ask for the photo only once it is near the screen. The browser's own lazy loading looks further ahead on slow connections
   * (up to about 2,500 px), which is exactly when bandwidth is scarce: a page of 60 cards then started ~100 photo requests that
   * all shared the same slow link, so the ones on screen arrived last.
   */
  deferOffscreen?: boolean;
  draggable?: boolean;
  style?: CSSProperties;
};

export default function ProgressiveImage({
  src,
  alt,
  className = "",
  imageClassName = "object-cover",
  placeholderClassName = "",
  loading = "lazy",
  deferOffscreen = false,
  draggable = false,
  style,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(!deferOffscreen);
  const boxRef = useRef<HTMLDivElement>(null);
  const releaseSlotRef = useRef<(() => void) | null>(null);
  const fullSrc = typeof src === "string" ? src.trim() : "";
  const imageSrc = allowed ? fullSrc : "";

  const startedRef = useRef(false);
  useEffect(() => {
    return () => {
      releaseSlotRef.current?.();
      releaseSlotRef.current = null;
    };
  }, []);
  function photoDone() {
    releaseSlotRef.current?.();
    releaseSlotRef.current = null;
  }

  // Near the screen: wait for a free download slot, then start; the slot is given back when the photo finishes (or fails).
  // A card scrolled past while it was still waiting gives its place back, so a fast scroll does not leave the photos on screen
  // queued behind ones nobody can see any more.
  useEffect(() => {
    if (!deferOffscreen || !fullSrc) return;
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setAllowed(true));
      return;
    }
    let waiting = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (!latest || startedRef.current) return;
        if (latest.isIntersecting) {
          if (waiting) return;
          waiting = true;
          releaseSlotRef.current = takePhotoSlot(() => {
            startedRef.current = true;
            setAllowed(true);
          });
        } else if (waiting) {
          waiting = false;
          releaseSlotRef.current?.();
          releaseSlotRef.current = null;
        }
      },
      { rootMargin: "500px 0px" }
    );
    observer.observe(box);
    return () => {
      observer.disconnect();
      if (!startedRef.current) {
        releaseSlotRef.current?.();
        releaseSlotRef.current = null;
      }
    };
  }, [deferOffscreen, fullSrc]);

  return (
    <div
      ref={boxRef}
      className={[
        "relative isolate overflow-hidden bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.14),rgba(104,220,255,0.06)_35%,rgba(255,255,255,0.025)_62%,rgba(0,0,0,0.18)_100%)]",
        className,
      ].join(" ")}
      style={style}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(104,220,255,0.04)_42%,rgba(0,0,0,0.16))]",
          placeholderClassName,
        ].join(" ")}
      />

      {imageSrc ? (
        <>
          {/* The blurred stand-in only exists while the photo loads; keeping a hidden blurred copy on every card made scrolling choppy. */}
          {loaded ? null : (
            <img
              src={imageSrc}
              alt=""
              aria-hidden="true"
              className={["absolute inset-0 h-full w-full scale-105 blur-xl transition-opacity duration-300", imageClassName, "opacity-70"].join(" ")}
              loading={deferOffscreen ? "eager" : loading}
              decoding="async"
              draggable={false}
            />
          )}
          <img
            src={imageSrc}
            alt={alt}
            className={["relative z-10 h-full w-full transition-opacity duration-300", imageClassName, loaded ? "opacity-100" : "opacity-0"].join(" ")}
            onLoad={() => {
              setLoaded(true);
              photoDone();
            }}
            onError={photoDone}
            loading={deferOffscreen ? "eager" : loading}
            decoding="async"
            draggable={draggable}
          />
        </>
      ) : (
        <div className="relative z-10 h-full w-full" role="img" aria-label={alt} />
      )}
    </div>
  );
}
