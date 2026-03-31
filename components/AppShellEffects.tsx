// Path: src/components/AppShellEffects.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * AppShellEffects
 * - Mobile swipe-back gesture (edge swipe)
 * - Mobile top-nav collapse via CSS var: --topnav-shift ("0%" | "-110%")
 *
 * TopNav reads --topnav-shift to translate itself.
 */
export default function AppShellEffects() {
  const router = useRouter();
  const pathname = usePathname();

  // ----------------------------
  // 1) Swipe-to-go-back (mobile)
  // ----------------------------
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;

      // Start tracking only if gesture begins near left edge (iOS-like)
      tracking.current = t.clientX <= 18;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking.current) return;
      if (startX.current == null || startY.current == null) return;
      if (e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      // Mostly horizontal + swiping right enough => go back
      if (dx > 90 && Math.abs(dy) < 60) {
        tracking.current = false;

        // Don't swipe-back on home page
        if (pathname === "/") return;

        router.back();
      }

      // If vertical scroll dominates, cancel
      if (Math.abs(dy) > 80) tracking.current = false;
    }

    function onTouchEnd() {
      tracking.current = false;
      startX.current = null;
      startY.current = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [router, pathname]);

  // ------------------------------------
  // 2) Collapse TopNav on scroll (mobile)
  // ------------------------------------
  const lastY = useRef(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0;
      const delta = y - lastY.current;
      lastY.current = y;

      // Don’t hide near the top
      if (y < 12) {
        setHidden(false);
        return;
      }

      // Only apply on small screens
      if (window.innerWidth >= 768) {
        setHidden(false);
        return;
      }

      // Scroll down => hide; scroll up => show
      if (delta > 8) setHidden(true);
      if (delta < -10) setHidden(false);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Use percent shift so TopNav can animate with a single CSS var.
    document.documentElement.style.setProperty("--topnav-shift", hidden ? "-110%" : "0%");
  }, [hidden]);

  return null;
}