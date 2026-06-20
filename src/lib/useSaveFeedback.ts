"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared "Saved" success-state for Save buttons across the app.
 *
 * Call `flashSaved()` right after a save action resolves successfully.
 * `justSaved` flips to true and auto-reverts after `durationMs`, giving
 * the button a brief green "Saved" state so users get confirmation
 * directly on the control they pressed (instead of a separate toast
 * they might miss).
 */
export function useSaveFeedback(durationMs = 1800) {
  const [justSaved, setJustSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setJustSaved(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustSaved(false), durationMs);
  }, [durationMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { justSaved, flashSaved };
}

/** Shared classNames for the "just saved" green state — keep every Save button visually consistent. */
export const SAVE_FEEDBACK_CLASSNAMES = {
  idle: "",
  saved: "bg-emerald-500/90 text-white ring-emerald-400/60",
} as const;

/**
 * Inline-style variant for buttons that use `style={{ background, color, borderColor }}`
 * instead of Tailwind bg classes. The boxShadow mirrors the same multi-layer glow used by
 * the `.vltd-pill-main-glow` CSS lock (gold), just in green — so a pill that glows gold while
 * idle keeps glowing (in green) for its "Saved" flash instead of going flat.
 *
 * IMPORTANT: `.vltd-pill-main-glow` sets color/border-color/box-shadow with `!important`, which
 * would clobber this inline style. When applying SAVE_FEEDBACK_STYLE, drop the
 * `vltd-pill-main-glow` class from that button's className for the duration of the flash.
 */
export const SAVE_FEEDBACK_STYLE = {
  background: "rgba(16,185,129,0.92)",
  color: "#ffffff",
  borderColor: "rgba(52,211,153,0.65)",
  boxShadow: [
    "0 0 0 1px rgba(52,211,153,0.65)",
    "0 0 0 3px rgba(16,185,129,0.28)",
    "0 0 18px rgba(16,185,129,0.40)",
    "0 0 36px rgba(16,185,129,0.28)",
  ].join(", "),
} as const;
