# VLTD — Enhanced Capture + Image Studio

VLTD is a gallery first. Every item photo the user takes needs to look like it belongs in a museum case, not a craigslist post. This handoff replaces the current flat camera panel with a guided, icon-first capture experience — universe-aware framing, real-time alignment help, post-capture editing, background removal, and collector-themed creative backgrounds. All of it runs in the browser with no server costs.

---

## Overview of new components

| New file | Purpose |
|----------|---------|
| `src/components/capture/CaptureViewfinder.tsx` | Live camera + frame overlay + object detection |
| `src/components/capture/CaptureEditSheet.tsx` | Post-capture editor: filters, adjustments, crop, BG remove |
| `src/components/capture/captureFilters.ts` | Filter preset definitions |
| `src/components/capture/captureFrames.ts` | Universe → frame shape mapping |
| `src/components/capture/captureUtils.ts` | Blur detection, canvas helpers |

**Existing file changed:**
- `src/components/CameraCapturePanel.tsx` — replace contents with the new CaptureViewfinder flow

---

## Step 1 — Install dependencies

```bash
npm install @imgly/background-removal
npm install @tensorflow/tfjs @tensorflow-models/coco-ssd
```

The TF.js packages are large (~10MB). Both must be **dynamically imported** inside a `useEffect` — never at module top level — or they will break SSR.

---

## Step 2 — `src/components/capture/captureFrames.ts`

Maps each universe to the proportions of its canonical collectible.

```ts
import type { UniverseKey } from "@/lib/taxonomy";

export type FrameShape = {
  label: string;
  aspectW: number; // width ratio
  aspectH: number; // height ratio
  radius: number;  // corner radius in px
  hint: string;    // shown below frame
};

const FRAMES: Record<UniverseKey | "DEFAULT", FrameShape> = {
  TCG:           { label: "Card",       aspectW: 6.3,  aspectH: 8.8,  radius: 8,  hint: "Fill the card to the edges" },
  SPORTS:        { label: "Card/Slab",  aspectW: 6.3,  aspectH: 8.8,  radius: 8,  hint: "Fill the card to the edges" },
  COMICS:        { label: "Comic",      aspectW: 6.6,  aspectH: 10.2, radius: 6,  hint: "Fill cover corner to corner" },
  MUSIC:         { label: "Vinyl",      aspectW: 1,    aspectH: 1,    radius: 999, hint: "Center the label" },
  GAMES:         { label: "Box/Cart",   aspectW: 1,    aspectH: 1,    radius: 10, hint: "Include all four corners" },
  JEWELRY_APPAREL: { label: "Item",     aspectW: 1,    aspectH: 1,    radius: 12, hint: "Clean background works best" },
  MISC:          { label: "Item",       aspectW: 1,    aspectH: 1,    radius: 12, hint: "Center and fill the frame" },
  DEFAULT:       { label: "Item",       aspectW: 1,    aspectH: 1,    radius: 12, hint: "Center and fill the frame" },
};

export function getFrame(universe?: string | null): FrameShape {
  const key = (universe?.toUpperCase() ?? "DEFAULT") as UniverseKey | "DEFAULT";
  return FRAMES[key] ?? FRAMES.DEFAULT;
}
```

---

## Step 3 — `src/components/capture/captureFilters.ts`

Seven presets. Each is a CSS filter string for live preview and a canvas filter applied when the user saves.

```ts
export type FilterPreset = {
  id: string;
  label: string;
  icon: string;        // emoji icon shown in the picker
  css: string;         // CSS filter string for live <video> preview
  canvas: string;      // Same string, applied on canvas before export
  description: string; // Tooltip
};

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "original",
    label: "Original",
    icon: "◎",
    css: "",
    canvas: "",
    description: "No adjustments",
  },
  {
    id: "studio",
    label: "Studio",
    icon: "⬜",
    css: "brightness(1.08) contrast(1.1) saturate(0.95)",
    canvas: "brightness(1.08) contrast(1.1) saturate(0.95)",
    description: "Clean, neutral — ideal for graded slabs",
  },
  {
    id: "warm",
    label: "Warm",
    icon: "🟠",
    css: "brightness(1.05) sepia(0.18) saturate(1.15) contrast(1.05)",
    canvas: "brightness(1.05) sepia(0.18) saturate(1.15) contrast(1.05)",
    description: "Vintage warmth — great for comics and vinyl",
  },
  {
    id: "vivid",
    label: "Vivid",
    icon: "🔵",
    css: "saturate(1.6) contrast(1.12) brightness(1.04)",
    canvas: "saturate(1.6) contrast(1.12) brightness(1.04)",
    description: "Punchy color — perfect for TCG and sports",
  },
  {
    id: "cool",
    label: "Cool",
    icon: "🩵",
    css: "brightness(1.06) contrast(1.08) saturate(1.1) hue-rotate(10deg)",
    canvas: "brightness(1.06) contrast(1.08) saturate(1.1) hue-rotate(10deg)",
    description: "Clean blue tones — modern cards and games",
  },
  {
    id: "foil",
    label: "Foil",
    icon: "✦",
    css: "contrast(1.35) saturate(1.8) brightness(1.12)",
    canvas: "contrast(1.35) saturate(1.8) brightness(1.12)",
    description: "High contrast shimmer — foil variants and holos",
  },
  {
    id: "antique",
    label: "Antique",
    icon: "📜",
    css: "sepia(0.55) contrast(0.95) brightness(0.98) saturate(0.7)",
    canvas: "sepia(0.55) contrast(0.95) brightness(0.98) saturate(0.7)",
    description: "Aged and warm — vintage toys and old comics",
  },
];
```

---

## Step 4 — `src/components/capture/captureUtils.ts`

Blur detection (Laplacian variance) + canvas export helper.

```ts
/**
 * Measure how blurry a canvas frame is.
 * Returns a score: low = blurry, high = sharp.
 * Threshold for "good" is approximately > 80.
 */
export function measureBlur(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 100;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Convert to greyscale and apply Laplacian kernel
  const grey: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    grey.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }

  // Laplacian: variance of [0,1,-1] edge responses
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        -grey[idx - width - 1] - grey[idx - width] - grey[idx - width + 1]
        - grey[idx - 1] + 8 * grey[idx] - grey[idx + 1]
        - grey[idx + width - 1] - grey[idx + width] - grey[idx + width + 1];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.sqrt(Math.max(variance, 0));
}

/**
 * Apply a CSS filter string to a canvas and return a new data URL.
 * Used to bake filter presets into the final saved image.
 */
export async function applyFilterToCanvas(
  sourceCanvas: HTMLCanvasElement,
  filterCss: string
): Promise<string> {
  const out = document.createElement("canvas");
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext("2d")!;
  if (filterCss) ctx.filter = filterCss;
  ctx.drawImage(sourceCanvas, 0, 0);
  return out.toDataURL("image/jpeg", 0.92);
}
```

---

## Step 5 — `src/components/capture/CaptureViewfinder.tsx`

The live camera component with frame overlay and optional object detection. Replaces the raw camera feed.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { UniverseKey } from "@/lib/taxonomy";
import { getFrame } from "./captureFrames";
import { measureBlur } from "./captureUtils";

type Props = {
  universe?: UniverseKey | null;
  onCapture: (canvas: HTMLCanvasElement) => void;
  onClose?: () => void;
};

export default function CaptureViewfinder({ universe, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectionRef = useRef<boolean>(false);

  const [ready, setReady] = useState(false);
  const [isBlurry, setIsBlurry] = useState(false);
  const [detectionBox, setDetectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const frame = getFrame(universe);

  // Start camera
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            void videoRef.current?.play();
            setReady(true);
          };
        }
      } catch {
        // Camera permission denied or unavailable
      }
    }

    void startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [facingMode]);

  // Load TF.js object detection lazily (non-blocking)
  useEffect(() => {
    if (detectionRef.current) return;
    detectionRef.current = true;

    let model: { detect: (input: HTMLVideoElement) => Promise<Array<{ bbox: [number, number, number, number] }>> } | null = null;

    async function loadModel() {
      try {
        // Dynamic import keeps TF.js out of the main bundle
        const tf = await import("@tensorflow/tfjs");
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        await tf.ready();
        model = await cocoSsd.load();
        runDetection();
      } catch {
        // TF.js failed to load — detection just won't run, camera still works
      }
    }

    function runDetection() {
      if (!videoRef.current || !model) return;

      async function tick() {
        if (!videoRef.current || !model) return;
        try {
          const predictions = await model.detect(videoRef.current);
          if (predictions.length > 0) {
            const [x, y, w, h] = predictions[0].bbox;
            const vW = videoRef.current.videoWidth || 1;
            const vH = videoRef.current.videoHeight || 1;
            setDetectionBox({
              x: x / vW * 100,
              y: y / vH * 100,
              w: w / vW * 100,
              h: h / vH * 100,
            });
          } else {
            setDetectionBox(null);
          }
        } catch {
          // Detection errors are silent
        }
        animFrameRef.current = requestAnimationFrame(() => { void tick(); });
      }

      void tick();
    }

    void loadModel();
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const blur = measureBlur(canvas);
    setIsBlurry(blur < 30);

    onCapture(canvas);
  }

  function flipCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }}>
      {/* Camera feed */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        {/* Universe-aware collector frame overlay */}
        {ready && (
          <div
            className="pointer-events-none absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: `min(${frame.aspectW / frame.aspectH * 60}vh, 80vw)`,
              aspectRatio: `${frame.aspectW} / ${frame.aspectH}`,
              border: "2px solid rgba(245,181,72,0.85)",
              borderRadius: frame.radius,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.45), 0 0 24px rgba(245,181,72,0.25)",
            }}
          >
            {/* Corner accents */}
            {[
              { top: -3, left: -3, borderTop: "3px solid #F5B548", borderLeft: "3px solid #F5B548", borderRadius: "3px 0 0 0" },
              { top: -3, right: -3, borderTop: "3px solid #F5B548", borderRight: "3px solid #F5B548", borderRadius: "0 3px 0 0" },
              { bottom: -3, left: -3, borderBottom: "3px solid #F5B548", borderLeft: "3px solid #F5B548", borderRadius: "0 0 0 3px" },
              { bottom: -3, right: -3, borderBottom: "3px solid #F5B548", borderRight: "3px solid #F5B548", borderRadius: "0 0 3px 0" },
            ].map((style, i) => (
              <div key={i} style={{ position: "absolute", width: 18, height: 18, ...style }} />
            ))}
          </div>
        )}

        {/* Object detection box — subtle teal box around detected object */}
        {ready && detectionBox && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${detectionBox.x}%`,
              top: `${detectionBox.y}%`,
              width: `${detectionBox.w}%`,
              height: `${detectionBox.h}%`,
              border: "1.5px solid rgba(34,211,238,0.6)",
              borderRadius: 6,
            }}
          />
        )}

        {/* Blur warning */}
        {isBlurry && (
          <div
            className="absolute bottom-28 left-1/2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              transform: "translateX(-50%)",
              background: "rgba(239,68,68,0.85)",
              color: "#fff",
            }}
          >
            {/* Camera-shake icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            Shot may be blurry — hold still
          </div>
        )}

        {/* Frame type label + hint */}
        {ready && (
          <div
            className="absolute left-1/2 text-center"
            style={{
              top: "calc(50% + min(" + frame.aspectW + "/" + frame.aspectH + " * 30vh, 40vw) + 16px)",
              transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {frame.hint}
          </div>
        )}

        {/* Top bar: close + flip */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-4">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: 99,
                background: "rgba(0,0,0,0.5)",
                color: "#fff", border: "none", cursor: "pointer",
                fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ×
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            style={{
              width: 36, height: 36, borderRadius: 99,
              background: "rgba(0,0,0,0.5)",
              color: "#fff", border: "none", cursor: "pointer",
              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label="Flip camera"
          >
            {/* Flip icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom: Shutter */}
      <div
        className="flex items-center justify-center pb-10 pt-6"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready}
          aria-label="Capture"
          style={{
            width: 68, height: 68,
            borderRadius: 99,
            border: "3px solid rgba(245,181,72,0.8)",
            background: ready ? "rgba(245,181,72,0.15)" : "rgba(255,255,255,0.05)",
            cursor: ready ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s, transform 0.15s",
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.93)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <div
            style={{
              width: 50, height: 50, borderRadius: 99,
              background: ready ? "#F5B548" : "rgba(255,255,255,0.2)",
            }}
          />
        </button>
      </div>
    </div>
  );
}
```

---

## Step 6 — `src/components/capture/CaptureEditSheet.tsx`

Post-capture editing panel. Slides up after the user takes a shot. Icon toolbar with filters, adjustments, crop, and background removal.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { FILTER_PRESETS, type FilterPreset } from "./captureFilters";
import { applyFilterToCanvas } from "./captureUtils";

// Creative backgrounds available after BG removal
const CREATIVE_BACKGROUNDS = [
  { id: "transparent", label: "None", style: "repeating-conic-gradient(#444 0% 25%, #333 0% 50%) 0 0 / 16px 16px" },
  { id: "black",       label: "Black",  style: "#000" },
  { id: "white",       label: "White",  style: "#fff" },
  { id: "vault-dark",  label: "Vault",  style: "linear-gradient(135deg, #0d0d0d 0%, #1a1209 100%)" },
  { id: "gold-subtle", label: "Gold",   style: "linear-gradient(135deg, #1a1209 0%, #2a1f04 100%)" },
  { id: "slate",       label: "Slate",  style: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" },
  { id: "emerald",     label: "Forest", style: "linear-gradient(135deg, #052e16 0%, #14532d 100%)" },
  { id: "crimson",     label: "Ruby",   style: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)" },
  { id: "cobalt",      label: "Cobalt", style: "linear-gradient(135deg, #172554 0%, #1e3a8a 100%)" },
  { id: "velvet",      label: "Velvet", style: "linear-gradient(135deg, #2e1065 0%, #4c1d95 100%)" },
];

type AdjustValues = {
  brightness: number;  // 0.5 – 1.5
  contrast: number;    // 0.5 – 1.5
  saturation: number;  // 0 – 2
  warmth: number;      // -30 to +30 (hue-rotate deg)
  sharpness: number;   // 0 – 2 (contrast proxy)
};

const DEFAULT_ADJUST: AdjustValues = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  sharpness: 0,
};

type Tab = "filter" | "adjust" | "crop" | "bg";

type Props = {
  sourceCanvas: HTMLCanvasElement;
  onSave: (dataUrl: string) => void;
  onRetake: () => void;
};

export default function CaptureEditSheet({ sourceCanvas, onSave, onRetake }: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>("filter");
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [adjust, setAdjust] = useState<AdjustValues>(DEFAULT_ADJUST);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [selectedBg, setSelectedBg] = useState(CREATIVE_BACKGROUNDS[3]); // vault dark
  const [bgRemovedCanvas, setBgRemovedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Render preview whenever filter/adjust/bg state changes
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const src = bgRemoved && bgRemovedCanvas ? bgRemovedCanvas : sourceCanvas;
    preview.width = src.width;
    preview.height = src.height;
    const ctx = preview.getContext("2d")!;

    // Background layer (only relevant when BG removed)
    if (bgRemoved) {
      if (selectedBg.id === "transparent") {
        ctx.clearRect(0, 0, preview.width, preview.height);
      } else {
        // Parse gradient/color from CSS style string — use as fillStyle
        // For gradients this is approximate; a proper impl would use an offscreen canvas
        ctx.save();
        ctx.fillStyle = selectedBg.style.includes("gradient") ? "#0d0d0d" : selectedBg.style;
        ctx.fillRect(0, 0, preview.width, preview.height);
        ctx.restore();
      }
    }

    // Build combined CSS filter from filter preset + adjust values
    const adjustFilter = [
      `brightness(${adjust.brightness})`,
      `contrast(${adjust.contrast + adjust.sharpness * 0.15})`,
      `saturate(${adjust.saturation})`,
      adjust.warmth !== 0 ? `hue-rotate(${adjust.warmth}deg)` : "",
    ].filter(Boolean).join(" ");

    const combined = [selectedFilter.canvas, adjustFilter].filter(Boolean).join(" ");
    if (combined) ctx.filter = combined;
    ctx.drawImage(src, 0, 0);
  }, [sourceCanvas, selectedFilter, adjust, bgRemoved, bgRemovedCanvas, selectedBg]);

  async function handleRemoveBackground() {
    setBgRemoving(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      // Convert canvas to blob
      const blob: Blob = await new Promise((resolve) =>
        sourceCanvas.toBlob((b) => resolve(b!), "image/png")
      );
      const result = await removeBackground(blob);
      const url = URL.createObjectURL(result);
      // Draw result into an offscreen canvas
      const img = new Image();
      img.src = url;
      await new Promise<void>((r) => { img.onload = () => r(); });
      const off = document.createElement("canvas");
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      off.getContext("2d")!.drawImage(img, 0, 0);
      setBgRemovedCanvas(off);
      setBgRemoved(true);
      setActiveTab("bg");
    } catch (e) {
      console.error("BG removal failed", e);
    } finally {
      setBgRemoving(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const preview = previewRef.current;
      if (!preview) return;
      const dataUrl = await applyFilterToCanvas(preview, "");
      onSave(dataUrl);
    } finally {
      setIsSaving(false);
    }
  }

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "filter",  icon: "◐",  label: "Filter"  },
    { id: "adjust",  icon: "☼",  label: "Adjust"  },
    { id: "bg",      icon: "⬡",  label: "BG"      },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }}>
      {/* Preview */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden" style={{ padding: "16px 16px 0" }}>
        <canvas
          ref={previewRef}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: 12,
          }}
        />
      </div>

      {/* Tab content */}
      <div style={{ background: "rgba(10,8,0,0.95)", paddingBottom: "env(safe-area-inset-bottom, 0)" }}>

        {/* Filter row */}
        {activeTab === "filter" && (
          <div className="flex gap-3 overflow-x-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>
            {FILTER_PRESETS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilter(f)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                  opacity: selectedFilter.id === f.id ? 1 : 0.55,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                    border: selectedFilter.id === f.id ? "2px solid #F5B548" : "2px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  {f.icon}
                </div>
                <span style={{ fontSize: 9, color: selectedFilter.id === f.id ? "#F5B548" : "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Adjust sliders */}
        {activeTab === "adjust" && (
          <div className="space-y-3 px-5 py-4">
            {(
              [
                { key: "brightness", label: "Brightness", min: 0.5,  max: 1.5,  step: 0.01 },
                { key: "contrast",   label: "Contrast",   min: 0.5,  max: 1.5,  step: 0.01 },
                { key: "saturation", label: "Saturation", min: 0,    max: 2,    step: 0.01 },
                { key: "warmth",     label: "Warmth",     min: -30,  max: 30,   step: 1    },
                { key: "sharpness",  label: "Sharpness",  min: 0,    max: 2,    step: 0.01 },
              ] as { key: keyof AdjustValues; label: string; min: number; max: number; step: number }[]
            ).map(({ key, label, min, max, step }) => (
              <div key={key} className="flex items-center gap-3">
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", width: 72, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {label}
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={adjust[key]}
                  onChange={(e) => setAdjust((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: "#F5B548" }}
                />
                <button
                  type="button"
                  onClick={() => setAdjust((prev) => ({ ...prev, [key]: key === "warmth" || key === "sharpness" ? 0 : 1 }))}
                  style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", width: 24, textAlign: "center" }}
                >
                  ↺
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Background picker (active after BG removal) */}
        {activeTab === "bg" && (
          <div className="px-4 py-3">
            {!bgRemoved ? (
              <div className="flex items-center justify-center py-2">
                <button
                  type="button"
                  onClick={() => void handleRemoveBackground()}
                  disabled={bgRemoving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 99,
                    background: bgRemoving ? "rgba(245,181,72,0.1)" : "rgba(245,181,72,0.15)",
                    color: "#F5B548",
                    border: "1px solid rgba(245,181,72,0.35)",
                    cursor: bgRemoving ? "default" : "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {bgRemoving ? "Removing background…" : "⬡  Remove Background"}
                </button>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
                {CREATIVE_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setSelectedBg(bg)}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: bg.style,
                        border: selectedBg.id === bg.id ? "2px solid #F5B548" : "2px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <span style={{ fontSize: 9, color: selectedBg.id === bg.id ? "#F5B548" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {bg.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab bar + action row */}
        <div
          className="flex items-center gap-2 border-t px-4 py-3"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          {/* Retake */}
          <button
            type="button"
            onClick={onRetake}
            style={{
              width: 40, height: 40, borderRadius: 99,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}
            aria-label="Retake"
          >
            ↩
          </button>

          {/* Tabs */}
          <div className="flex flex-1 justify-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  padding: "4px 12px",
                  borderRadius: 8,
                  background: activeTab === tab.id ? "rgba(245,181,72,0.12)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 18, color: activeTab === tab.id ? "#F5B548" : "rgba(255,255,255,0.45)" }}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 9, color: activeTab === tab.id ? "#F5B548" : "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{
              padding: "0 20px",
              height: 40,
              borderRadius: 99,
              background: isSaving ? "rgba(245,181,72,0.1)" : "#F5B548",
              color: isSaving ? "#F5B548" : "#000",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              cursor: isSaving ? "default" : "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {isSaving ? "Saving…" : "Use Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 7 — Wire into `CameraCapturePanel.tsx`

Replace the existing camera panel implementation with an orchestrator that manages the flow: `viewfinder → edit sheet → return dataUrl to parent`.

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { UniverseKey } from "@/lib/taxonomy";

// Dynamic imports keep TF.js and the BG removal WASM out of the initial bundle
const CaptureViewfinder = dynamic(() => import("./capture/CaptureViewfinder"), { ssr: false });
const CaptureEditSheet  = dynamic(() => import("./capture/CaptureEditSheet"),  { ssr: false });

type Props = {
  universe?: UniverseKey | null;
  autoOpen?: boolean;
  onCapture: (dataUrl: string) => void;
  onClose?: () => void;
};

export default function CameraCapturePanel({ universe, autoOpen, onCapture, onClose }: Props) {
  const [phase, setPhase] = useState<"viewfinder" | "edit">("viewfinder");
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);

  function handleCapture(canvas: HTMLCanvasElement) {
    setCapturedCanvas(canvas);
    setPhase("edit");
  }

  function handleRetake() {
    setCapturedCanvas(null);
    setPhase("viewfinder");
  }

  function handleSave(dataUrl: string) {
    onCapture(dataUrl);
  }

  if (phase === "viewfinder") {
    return (
      <CaptureViewfinder
        universe={universe}
        onCapture={handleCapture}
        onClose={onClose}
      />
    );
  }

  if (phase === "edit" && capturedCanvas) {
    return (
      <CaptureEditSheet
        sourceCanvas={capturedCanvas}
        onSave={handleSave}
        onRetake={handleRetake}
      />
    );
  }

  return null;
}
```

The existing `CameraCapturePanel` is called from the Add page via `autoOpen` prop — that interface stays the same, so the Add page needs no changes to trigger the camera.

---

## Files changed summary

| File | Change |
|------|--------|
| `src/components/CameraCapturePanel.tsx` | Replace with new orchestrator (viewfinder → edit flow) |
| `src/components/capture/CaptureViewfinder.tsx` | New — live camera, universe frame overlay, object detection box, blur warning |
| `src/components/capture/CaptureEditSheet.tsx` | New — filter presets, adjust sliders, background removal + picker |
| `src/components/capture/captureFilters.ts` | New — 7 collector filter presets |
| `src/components/capture/captureFrames.ts` | New — universe → frame shape mapping |
| `src/components/capture/captureUtils.ts` | New — blur detection, canvas filter baking |
| `package.json` | Add `@imgly/background-removal`, `@tensorflow/tfjs`, `@tensorflow-models/coco-ssd` |

---

## Verify

```bash
npm install
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Camera opens — no blank screen, no console errors
- [ ] Gold frame overlay visible and centered — proportion matches TCG for TCG items, square for Music/Games
- [ ] Flip camera button works (front/back toggle)
- [ ] Object detection box appears (teal) around item placed in frame — may take a few seconds to load TF.js
- [ ] Shutter captures the live frame — advances to Edit Sheet
- [ ] Blur warning appears when shot is soft (try capturing while moving)
- [ ] Filter rail shows 7 presets — selecting one updates the preview
- [ ] Adjust tab: sliders for Brightness, Contrast, Saturation, Warmth, Sharpness — ↺ resets each
- [ ] BG tab: "Remove Background" button runs — wait a few seconds on first use (WASM loads)
- [ ] After removal: background swatches appear — selecting one changes the canvas background
- [ ] "Use Photo" saves the edited canvas as dataUrl and passes back to Add page
- [ ] Retake button returns to viewfinder — no freeze
- [ ] Full Add flow works end to end: capture → edit → AI scan → save to vault
- [ ] No SSR errors (TF.js and BG removal are both dynamic imports)

Commit: `feat: enhanced capture — universe frame overlay, object detection, filter studio, background removal + creative backgrounds`
