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
  }, []);
  return null;
}
