// Path: src/components/ui/TiltCard.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;

  /** Max degrees of tilt */
  maxTiltDeg?: number;

  /** Hover scale multiplier */
  scale?: number;

  /** Adds a subtle moving highlight */
  glare?: boolean;

  /** Disable tilt entirely (optional override) */
  disabled?: boolean;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (navigator as any)?.maxTouchPoints > 0 ||
    window.matchMedia?.("(pointer: coarse)")?.matches
  );
}

/**
 * TiltCard
 * - Desktop hover 3D tilt (premium feel)
 * - Auto-disables on touch devices + reduced motion
 * - Safe + lightweight (requestAnimationFrame)
 */
export function TiltCard({
  children,
  className = "",
  maxTiltDeg = 10,
  scale = 1.02,
  glare = true,
  disabled,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [active, setActive] = useState(false);
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(0);
  const [gx, setGx] = useState(50);
  const [gy, setGy] = useState(50);

  const shouldDisable = useMemo(() => {
    if (disabled) return true;
    if (prefersReducedMotion()) return true;
    if (isTouchDevice()) return true;
    return false;
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function schedule(fn: () => void) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(fn);
  }

  function onMove(e: React.PointerEvent) {
    if (shouldDisable) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1

    // Map to degrees
    const nextRy = (px - 0.5) * (maxTiltDeg * 2); // left/right
    const nextRx = (0.5 - py) * (maxTiltDeg * 2); // up/down (invert)

    schedule(() => {
      setActive(true);
      setRx(nextRx);
      setRy(nextRy);
      setGx(Math.round(px * 100));
      setGy(Math.round(py * 100));
    });
  }

  function reset() {
    if (shouldDisable) return;
    schedule(() => {
      setActive(false);
      setRx(0);
      setRy(0);
      setGx(50);
      setGy(50);
    });
  }

  return (
    <div
      ref={ref}
      onPointerEnter={() => {
        if (shouldDisable) return;
        setActive(true);
      }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={["relative", className].filter(Boolean).join(" ")}
      style={{
        transformStyle: "preserve-3d",
        willChange: shouldDisable ? undefined : "transform",
        transform: shouldDisable
          ? undefined
          : `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${active ? scale : 1})`,
        transition: shouldDisable ? undefined : active ? "transform 80ms ease-out" : "transform 220ms ease-out",
      }}
    >
      {/* Subtle edge lift */}
      {!shouldDisable && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow: active ? "0 18px 44px rgba(0,0,0,0.18)" : "0 1px 0 rgba(0,0,0,0.04)",
            transition: "box-shadow 220ms ease",
          }}
        />
      )}

      {/* Premium glare sweep */}
      {glare && !shouldDisable && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0"
          style={{
            opacity: active ? 1 : 0,
            transition: "opacity 200ms ease",
            background: `radial-gradient(600px 260px at ${gx}% ${gy}%, rgba(255,255,255,0.16), rgba(255,255,255,0.0) 60%)`,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Content */}
      <div style={{ transform: shouldDisable ? undefined : "translateZ(0px)" }}>{children}</div>
    </div>
  );
}