"use client";

import { useEffect } from "react";

/**
 * Links such as /portfolio#movers should land on that part of the page, not the top. The target is often drawn late (after the
 * account loads), so the page says when it is `ready`; then the target is scrolled to, given keyboard focus and briefly outlined.
 */
export function useHashTarget(ready: boolean) {
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    } catch {
      return;
    }
    if (!id) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.scrollMarginTop = "96px";
      el.scrollIntoView({ block: "start" });
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      el.classList.add("vltd-hash-target");
      window.setTimeout(() => el.classList.remove("vltd-hash-target"), 2600);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [ready]);
}
