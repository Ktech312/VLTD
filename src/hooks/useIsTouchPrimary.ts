"use client";

import { useEffect, useState } from "react";

/** True when the primary input is touch/coarse (phones, tablets) rather
 *  than a mouse. Used to decide whether a manual-override control -- like
 *  the Camera picker, now that zoom auto-switches lenses on many phones
 *  (cameraLenses.ts) -- should collapse to a compact icon (mobile, where
 *  it's now a fallback/override) or stay fully visible (desktop, where
 *  it's still the primary way to pick between multiple attached webcams,
 *  something lens auto-switching has nothing to do with). */
function readIsTouchPrimary(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useIsTouchPrimary(): boolean {
  const [isTouch, setIsTouch] = useState(readIsTouchPrimary);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isTouch;
}
