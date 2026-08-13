"use client";

import { useState } from "react";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";

// Extracted verbatim from ScanCapturePanel.tsx (Quick Add's camera header)
// so any other camera screen can use the literal same-looking dropdown,
// instead of a hand-approximated look-alike. Title stays constant; the
// current pick is highlighted in the menu.
export function DropdownPill({
  title,
  value,
  options,
  onSelect,
  compactIcon,
}: {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  /** Renders as a small square icon button instead of a labeled "Title ▾"
   *  pill -- same menu, same behavior, just less visually noisy for a
   *  control that's usually a fallback/override rather than the primary
   *  action (e.g. the Camera picker once zoom auto-switches lenses). */
  compactIcon?: GlyphName;
}) {
  const [open, setOpen] = useState(false);

  if (compactIcon) {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={title}
          aria-label={title}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] ring-1 transition"
          style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.85)" }}
        >
          <Glyph name={compactIcon} size={15} strokeWidth={1.8} />
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
            <div
              className="absolute right-0 top-full z-[2] mt-1 max-h-[52vh] w-[190px] overflow-y-auto rounded-[10px] p-1 ring-1"
              style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-white/40">None available</div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onSelect(opt.value); setOpen(false); }}
                    className="block w-full truncate rounded-[7px] px-3 py-1.5 text-left text-xs font-semibold transition"
                    style={value === opt.value
                      ? { background: "rgba(96,165,250,0.18)", color: "#93c5fd" }
                      : { color: "rgba(255,255,255,0.72)" }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold ring-1 transition"
        style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.85)" }}
      >
        {title}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-[2] mt-1 max-h-[52vh] w-[190px] overflow-y-auto rounded-[10px] p-1 ring-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-white/40">None available</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onSelect(opt.value); setOpen(false); }}
                  className="block w-full truncate rounded-[7px] px-3 py-1.5 text-left text-xs font-semibold transition"
                  style={value === opt.value
                    ? { background: "rgba(96,165,250,0.18)", color: "#93c5fd" }
                    : { color: "rgba(255,255,255,0.72)" }}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
