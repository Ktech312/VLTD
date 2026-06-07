"use client";

import { useRef, useState } from "react";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

// ─── Types ────────────────────────────────────────────────────────────────────

type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

const ASPECT_OPTIONS: { ratio: AspectRatio; label: string; w: number; h: number; desc: string }[] = [
  { ratio: "1:1",  label: "1:1",  w: 1080, h: 1080, desc: "Instagram Feed" },
  { ratio: "4:5",  label: "4:5",  w: 1080, h: 1350, desc: "Portrait Feed" },
  { ratio: "9:16", label: "9:16", w: 1080, h: 1920, desc: "Stories / Reels" },
  { ratio: "16:9", label: "16:9", w: 1920, h: 1080, desc: "YouTube Thumb" },
];

const BG_OPTIONS: { id: string; label: string; value: string }[] = [
  { id: "dark",    label: "Dark",    value: "#0B0B0B" },
  { id: "gold",    label: "Gold",    value: "#F5B548" },
  { id: "slate",   label: "Slate",   value: "#1A1F2E" },
  { id: "cream",   label: "Cream",   value: "#F5F0E8" },
  { id: "forest",  label: "Forest",  value: "#1A2E1A" },
  { id: "crimson", label: "Crimson", value: "#2E0B0B" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Canvas export ────────────────────────────────────────────────────────────

async function exportToCanvas(opts: {
  item: VaultItem;
  ratio: AspectRatio;
  bg: string;
  showValue: boolean;
  watermark: boolean;
}): Promise<string> {
  const { item, ratio, bg, showValue, watermark } = opts;
  const spec = ASPECT_OPTIONS.find((o) => o.ratio === ratio) ?? ASPECT_OPTIONS[0];
  const { w, h } = spec;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Load + draw item image
  const imageUrl = getPrimaryImageUrl(item);
  if (imageUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Fit image centered with padding
        const padding = Math.round(w * 0.08);
        const imgArea = { x: padding, y: Math.round(h * 0.12), w: w - padding * 2, h: Math.round(h * 0.62) };
        const scale = Math.min(imgArea.w / img.width, imgArea.h / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const sx = imgArea.x + (imgArea.w - sw) / 2;
        const sy = imgArea.y + (imgArea.h - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imageUrl;
    });
  }

  // Gold accent line
  const lineY = Math.round(h * 0.78);
  ctx.strokeStyle = "#F5B548";
  ctx.lineWidth = Math.round(w * 0.003);
  ctx.beginPath();
  ctx.moveTo(Math.round(w * 0.08), lineY);
  ctx.lineTo(Math.round(w * 0.92), lineY);
  ctx.stroke();

  // Title
  const titleY = lineY + Math.round(h * 0.04);
  const titleSize = Math.round(w * 0.05);
  ctx.fillStyle = bg === "#F5F0E8" ? "#1A1A1A" : "#FFFFFF";
  ctx.font = `700 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Wrap title
  const maxWidth = w * 0.84;
  const words = item.title.split(" ");
  let line = "";
  let currentY = titleY;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, w / 2, currentY);
      line = word;
      currentY += titleSize * 1.3;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, w / 2, currentY);

  // Subtitle / grade chips
  const metaY = currentY + titleSize * 1.5;
  const metaParts = [item.subtitle, item.grade ? `Grade ${item.grade}` : null].filter(Boolean).join(" • ");
  if (metaParts) {
    ctx.font = `400 ${Math.round(w * 0.03)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#F5B548";
    ctx.fillText(metaParts, w / 2, metaY);
  }

  // Value
  const value = item.currentValue ?? item.estimatedValue ?? item.askingPrice;
  if (value && value > 0) {
    const valueY = metaParts ? metaY + Math.round(h * 0.05) : metaY;
    if (showValue) {
      ctx.font = `800 ${Math.round(w * 0.06)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#F5B548";
      ctx.fillText(fmt(value), w / 2, valueY);
    } else {
      // Blurred placeholder blocks
      ctx.fillStyle = "rgba(245,181,72,0.3)";
      const bw = Math.round(w * 0.3);
      const bh = Math.round(h * 0.05);
      ctx.beginPath();
      const bx = (w - bw) / 2;
      ctx.roundRect(bx, valueY, bw, bh, 8);
      ctx.fill();
    }
  }

  // Watermark
  if (watermark) {
    ctx.font = `600 ${Math.round(w * 0.025)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(245,181,72,0.5)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("VLTD", w - Math.round(w * 0.04), h - Math.round(h * 0.025));
  }

  return canvas.toDataURL("image/png");
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  item: VaultItem;
  onClose: () => void;
};

export default function SocialExportSheet({ item, onClose }: Props) {
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [bg, setBg] = useState(BG_OPTIONS[0].value);
  const [showValue, setShowValue] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const dataUrl = await exportToCanvas({ item, ratio, bg, showValue, watermark });
      setPreview(dataUrl);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(false);
    }
  }

  function handleDownload() {
    if (!preview || !linkRef.current) return;
    const slug = item.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
    linkRef.current.href = preview;
    linkRef.current.download = `vltd-${slug}-${ratio.replace(":", "x")}.png`;
    linkRef.current.click();
  }

  const specLabel = ASPECT_OPTIONS.find((o) => o.ratio === ratio);

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden ring-1 ring-[color:var(--border)] shadow-2xl"
        style={{ background: "var(--surface)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
        </div>

        <div className="px-5 pb-8 pt-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Export for Social
              </div>
              <div className="mt-0.5 text-base font-bold line-clamp-1" style={{ color: "var(--fg)" }}>
                {item.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-lg leading-none"
              style={{ background: "var(--pill)", color: "var(--muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Format picker */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Format
            </div>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_OPTIONS.map((o) => (
                <button
                  key={o.ratio}
                  type="button"
                  onClick={() => { setRatio(o.ratio); setPreview(null); }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2 text-center ring-1 transition"
                  style={{
                    background: ratio === o.ratio ? "var(--theme-gold)" : "var(--pill)",
                    color: ratio === o.ratio ? "#0B0B0B" : "var(--fg)",
                  }}
                >
                  <span className="text-sm font-bold">{o.label}</span>
                  <span className="text-[9px] opacity-70">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Background
            </div>
            <div className="flex flex-wrap gap-2">
              {BG_OPTIONS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setBg(b.value); setPreview(null); }}
                  className="h-8 w-8 rounded-full ring-2 ring-offset-2 transition"
                  style={{ background: b.value }}
                  title={b.label}
                />
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            {/* Show value */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>Show value</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {showValue ? "Value visible in export" : "Value blurred for privacy"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowValue(!showValue); setPreview(null); }}
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ background: showValue ? "var(--theme-gold)" : "var(--pill)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: showValue ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Watermark */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>VLTD watermark</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>Small branding in corner</div>
              </div>
              <button
                type="button"
                onClick={() => { setWatermark(!watermark); setPreview(null); }}
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ background: watermark ? "var(--theme-gold)" : "var(--pill)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: watermark ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Export preview" className="w-full" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!preview ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
                style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: exporting ? 0.6 : 1 }}
              >
                {exporting ? "Generating…" : `Preview ${specLabel?.desc ?? ratio}`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                  style={{ background: "var(--pill)", color: "var(--fg)" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold"
                  style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
                >
                  Download PNG
                </button>
              </>
            )}
          </div>

          {/* Hidden download link */}
          {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
          <a ref={linkRef} className="hidden" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
