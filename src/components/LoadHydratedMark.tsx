"use client";

import { useEffect } from "react";
import { markLoadStage } from "@/lib/loadDiagnostics";

declare global {
  interface Window {
    __vltdStarted?: boolean;
  }
}

/** Tells the load watchdog (src/components/LoadWatchdog.tsx) that the app's code started, and records it in the per-tab load record. */
export default function LoadHydratedMark() {
  useEffect(() => {
    window.__vltdStarted = true;
    document.documentElement.removeAttribute("data-load-stalled");
    markLoadStage("hydration", true, "app started");
    // Real-device responsiveness, recorded by the person's own browser: how many tasks blocked the page for over 50 ms in the first 15 seconds and
    // how long the worst was. Numbers only. (Not available in every browser; then nothing is recorded.)
    let count = 0;
    let longest = 0;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          count += 1;
          if (entry.duration > longest) longest = entry.duration;
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer = null;
    }
    const timer = window.setTimeout(() => {
      if (!observer) return;
      observer.disconnect();
      markLoadStage("perf:long-tasks", longest < 1000, count === 0 ? "none over 50 ms in the first 15 s" : `${count} over 50 ms, longest ${Math.round(longest)} ms, in the first 15 s`);
    }, 15000);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);
  return null;
}
