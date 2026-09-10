"use client";

import { CAPTURE_BACKGROUNDS } from "@/components/capture/captureUtils";

// Shared by the camera capture flow (CameraCapturePanel) and the saved-item
// Remove BG flow (ItemMedia) so the two stay in lockstep — one picker, one
// set of background options, used everywhere background removal happens.
export default function BackgroundSwatchPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 self-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
        Backdrop
      </span>
      {CAPTURE_BACKGROUNDS.map((background) => (
        <button
          key={background.id}
          type="button"
          onClick={() => onSelect(background.id)}
          className="shrink-0 rounded-xl px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1"
          style={{
            background:
              selectedId === background.id
                ? "var(--theme-gold-subtle, rgba(203,208,213,0.12))"
                : "var(--surface)",
            borderColor:
              selectedId === background.id
                ? "var(--theme-gold-border, rgba(203,208,213,0.38))"
                : "var(--border)",
            color:
              selectedId === background.id
                ? "var(--theme-gold, #C8CDD2)"
                : "var(--muted)",
          }}
        >
          <span
            className="mb-1 block h-8 w-12 rounded-lg ring-1 ring-white/10"
            style={{ background: background.swatch }}
          />
          {background.label}
        </button>
      ))}
    </div>
  );
}
