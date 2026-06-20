"use client";

import { useMemo, useState } from "react";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

// ─── Stats calculation ────────────────────────────────────────────────────────

type WrappedStats = {
  itemCount: number;
  totalValue: number;
  totalCost: number;
  totalGain: number;
  gainPct: number;
  topUniverse: string;
  biggestGainer: VaultItem | null;
  biggestGainerGain: number;
  gradedCount: number;
  topCategory: string;
  year: number;
};

const UNIVERSE_LABELS: Record<string, string> = {
  SPORTS: "Sports Cards",
  TCG: "Trading Cards",
  POP_CULTURE: "Pop Culture",
  MUSIC: "Music",
  JEWELRY_APPAREL: "Jewelry & Apparel",
  GAMES: "Games",
  MISC: "Collectibles",
};

function calcStats(items: VaultItem[]): WrappedStats {
  const totalValue = items.reduce((s, i) => s + Number(i.currentValue ?? i.estimatedValue ?? 0), 0);
  const totalCost = items.reduce((s, i) => s + Number(i.purchasePrice ?? 0), 0);
  const totalGain = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Top universe by item count
  const universeCounts: Record<string, number> = {};
  for (const item of items) {
    const u = (item.universe ?? "MISC").toUpperCase();
    universeCounts[u] = (universeCounts[u] ?? 0) + 1;
  }
  const topUniverseKey = Object.entries(universeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "MISC";
  const topUniverse = UNIVERSE_LABELS[topUniverseKey] ?? topUniverseKey;

  // Top category
  const catCounts: Record<string, number> = {};
  for (const item of items) {
    const c = item.categoryLabel ?? item.category ?? "Other";
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Collectibles";

  // Biggest gainer
  let biggestGainer: VaultItem | null = null;
  let biggestGainerGain = 0;
  for (const item of items) {
    const paid = Number(item.purchasePrice ?? 0);
    const now = Number(item.currentValue ?? item.estimatedValue ?? 0);
    if (paid > 0 && now > paid) {
      const gain = now - paid;
      if (gain > biggestGainerGain) {
        biggestGainerGain = gain;
        biggestGainer = item;
      }
    }
  }

  const gradedCount = items.filter(i => Boolean(i.grade)).length;

  return {
    itemCount: items.length,
    totalValue,
    totalCost,
    totalGain,
    gainPct,
    topUniverse,
    biggestGainer,
    biggestGainerGain,
    gradedCount,
    topCategory,
    year: new Date().getFullYear(),
  };
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function renderWrappedCanvas(stats: WrappedStats): Promise<string> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // === Background gradient (dark gold to deep navy) ===
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0D0D14");
  bg.addColorStop(0.4, "#12101A");
  bg.addColorStop(1, "#0B0B0B");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Noise overlay for texture
  const GOLD = "#F5B548";
  const GOLD2 = "rgba(245,181,72,0.65)";
  const WHITE = "#FFFFFF";
  const MUTED = "rgba(255,255,255,0.45)";

  // Large background circle accent (top-left)
  ctx.save();
  ctx.beginPath();
  ctx.arc(-80, -80, 480, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(245,181,72,0.05)";
  ctx.fill();
  ctx.restore();

  // Bottom right circle accent
  ctx.save();
  ctx.beginPath();
  ctx.arc(W + 60, H - 60, 420, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(245,181,72,0.04)";
  ctx.fill();
  ctx.restore();

  // === VLTD header ===
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = GOLD;
  ctx.font = `900 52px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText("VLTD", 80, 100);

  ctx.font = `400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`${stats.year} Vault Wrapped`, 80, 170);

  // Gold line
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(80, 212);
  ctx.lineTo(W - 80, 212);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // === Total value (hero number) ===
  ctx.textAlign = "center";
  const heroY = 280;
  ctx.font = `400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = MUTED;
  ctx.fillText("TOTAL VAULT VALUE", W / 2, heroY);

  ctx.font = `900 120px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = GOLD;
  ctx.fillText(fmt(stats.totalValue), W / 2, heroY + 44);

  // Gain/loss
  const isGain = stats.totalGain >= 0;
  const gainColor = isGain ? "#4CAF82" : "#E05B5B";
  ctx.font = `700 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = gainColor;
  ctx.fillText(
    `${isGain ? "+" : ""}${fmt(stats.totalGain)} · ${isGain ? "+" : ""}${stats.gainPct.toFixed(1)}% overall`,
    W / 2,
    heroY + 180
  );

  // === Stats grid (2x2) ===
  const gridY = heroY + 248;
  const gridW = (W - 200) / 2;
  const gridH = 200;
  const GAP = 24;

  const gridItems = [
    { label: "Items in Vault",  value: String(stats.itemCount), sub: "total collected" },
    { label: "Graded Slabs",    value: String(stats.gradedCount), sub: "professionally graded" },
    { label: "Top Universe",    value: stats.topUniverse, sub: "most collected", small: true },
    { label: "Top Category",    value: stats.topCategory, sub: "most items", small: true },
  ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = 80 + col * (gridW + GAP);
    const gy = gridY + row * (gridH + GAP);
    const gdata = gridItems[i];

    // Card bg
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gridW, gridH, 24);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(245,181,72,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gridW, gridH, 24);
    ctx.stroke();

    // Label
    ctx.textAlign = "left";
    ctx.font = `500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = MUTED;
    ctx.fillText(gdata.label.toUpperCase(), gx + 28, gy + 28);

    // Value
    ctx.font = gdata.small
      ? `700 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      : `800 64px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    ctx.fillText(gdata.value, gx + 28, gy + gridH / 2 + 10);
    ctx.textBaseline = "top";

    // Sub
    ctx.font = `400 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = GOLD2;
    ctx.fillText(gdata.sub, gx + 28, gy + gridH - 36);
  }

  // === Biggest Gainer section ===
  const bgY = gridY + 2 * (gridH + GAP) + 40;

  if (stats.biggestGainer) {
    const bg2 = stats.biggestGainer;

    // Section header
    ctx.textAlign = "left";
    ctx.font = `700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = MUTED;
    ctx.fillText("BIGGEST GAINER", 80, bgY);

    // Card
    ctx.fillStyle = "rgba(76,175,130,0.08)";
    ctx.strokeStyle = "rgba(76,175,130,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(80, bgY + 40, W - 160, 180, 24);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = `700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = WHITE;
    // Truncate title
    let title = bg2.title;
    while (ctx.measureText(title).width > W - 360 && title.length > 4) {
      title = title.slice(0, -1);
    }
    if (title !== bg2.title) title = title.trim() + "…";
    ctx.fillText(title, 120, bgY + 80);

    if (bg2.subtitle) {
      ctx.font = `400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = MUTED;
      ctx.fillText(bg2.subtitle, 120, bgY + 130);
    }

    ctx.textAlign = "right";
    ctx.font = `800 48px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#4CAF82";
    ctx.fillText(`+${fmt(stats.biggestGainerGain)}`, W - 120, bgY + 76);

    const paid = Number(bg2.purchasePrice ?? 0);
    const now = Number(bg2.currentValue ?? bg2.estimatedValue ?? 0);
    if (paid > 0 && now > 0) {
      const pct = ((now - paid) / paid) * 100;
      ctx.font = `500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(76,175,130,0.75)";
      ctx.fillText(`+${pct.toFixed(0)}%`, W - 120, bgY + 136);
    }
  }

  // === Motivational footer ===
  const footerY = bgY + 260;

  // Gold horizontal rule
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(80, footerY);
  ctx.lineTo(W - 80, footerY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const phrases = [
    "Another year of collecting. Another year of building.",
    "The vault grows. The story continues.",
    "Every item tells a story. This is yours.",
    "Curated with purpose. Valued with precision.",
  ];
  const phrase = phrases[stats.itemCount % phrases.length];

  ctx.textAlign = "center";
  ctx.font = `400 italic 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`"${phrase}"`, W / 2, footerY + 48);

  // VLTD footer branding
  ctx.font = `700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(245,181,72,0.45)";
  ctx.fillText("vltd.app", W / 2, H - 72);

  return canvas.toDataURL("image/png");
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
};

export default function VaultWrappedSheet({ onClose }: Props) {
  const items = useMemo(() => {
    try { return loadItems(); } catch { return []; }
  }, []);

  const stats = useMemo(() => calcStats(items), [items]);

  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleGenerate() {
    setExporting(true);
    try {
      const url = await renderWrappedCanvas(stats);
      setPreview(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  function handleDownload() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = `vltd-wrapped-${stats.year}.png`;
    a.click();
  }

  async function handleShare() {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], `vltd-wrapped-${stats.year}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: `My ${stats.year} Vault Wrapped`, text: `${stats.itemCount} items. ${fmt(stats.totalValue)} vault. #VLTD #collector` });
    } catch { /* */ }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden ring-1 ring-[color:var(--border)] shadow-2xl max-h-[92dvh] overflow-y-auto"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-[color:var(--border)]" />
        </div>

        <div className="px-5 pb-8 pt-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                Vault Wrapped · {stats.year}
              </div>
              <div className="mt-0.5 text-base font-bold" style={{ color: "var(--fg)" }}>
                Your year in collecting
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full p-2 text-lg leading-none"
              style={{ background: "var(--pill)", color: "var(--muted)" }}>
              ✕
            </button>
          </div>

          {/* Live stats summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Items", value: String(stats.itemCount) },
              { label: "Value", value: fmt(stats.totalValue) },
              { label: "ROI", value: `${stats.gainPct >= 0 ? "+" : ""}${stats.gainPct.toFixed(0)}%` },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center ring-1 ring-[color:var(--border)]"
                style={{ background: "var(--pill)" }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>{s.label}</div>
                <div className="mt-1 text-xl font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {stats.biggestGainer && (
            <div className="rounded-2xl p-3 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Biggest Gainer</div>
              <div className="text-sm font-bold line-clamp-1" style={{ color: "var(--fg)" }}>{stats.biggestGainer.title}</div>
              <div className="text-sm font-bold" style={{ color: "#4CAF82" }}>+{fmt(stats.biggestGainerGain)}</div>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]" style={{ aspectRatio: "9/16" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Vault Wrapped" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!preview ? (
              <button type="button" onClick={() => void handleGenerate()} disabled={exporting || items.length === 0}
                className="flex-1 rounded-2xl py-3 text-sm font-bold"
                style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: (exporting || items.length === 0) ? 0.5 : 1 }}>
                {exporting ? "Generating…" : items.length === 0 ? "No items in vault" : "Generate Wrapped Card"}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setPreview(null)}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                  style={{ background: "var(--pill)", color: "var(--fg)" }}>
                  Regenerate
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button type="button" onClick={() => void handleShare()}
                    className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
                    style={{ background: "var(--pill)", color: "var(--fg)" }}>
                    Share
                  </button>
                )}
                <button type="button" onClick={handleDownload}
                  className="flex-1 rounded-2xl py-3 text-sm font-bold"
                  style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}>
                  Download
                </button>
              </>
            )}
          </div>

          <div className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
            9:16 portrait card · perfect for Stories, Reels, TikTok
          </div>
        </div>
      </div>
    </div>
  );
}
