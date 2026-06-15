"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
import GenerateCopyPanel from "@/components/GenerateCopyPanel";

// ─── Tab types ─────────────────────────────────────────────────────────────────
type Tab = "image" | "then-vs-now" | "video" | "carousel";

// ─── Aspect / BG options ──────────────────────────────────────────────────────
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

// ─── Hashtag generation ───────────────────────────────────────────────────────
const UNIVERSE_TAGS: Record<string, string[]> = {
  POP_CULTURE:      ["collectibles", "popcollector", "comicbooks", "toycollector", "hobbylife"],
  SPORTS:           ["sportscards", "cardcollector", "hobbylife", "waxlife", "sportscard"],
  TCG:              ["tradingcards", "tcg", "cardcollector", "hobbylife", "pokemoncards"],
  MUSIC:            ["vinyl", "recordcollector", "vinylcollection", "audiophile", "musiccollector"],
  JEWELRY_APPAREL:  ["luxury", "watches", "streetwear", "luxurycollector", "fashioncollector"],
  GAMES:            ["gamecollector", "retrogaming", "videogames", "gamer", "sealedgames"],
  MISC:             ["collector", "rare", "vintage", "unique", "finds"],
};

const CATEGORY_TAGS: Record<string, string[]> = {
  "Comics":         ["comics", "comicbooks", "graphicnovel", "marvel", "dc"],
  "Toys":           ["toys", "actionfigures", "vintagetoys", "toycollector"],
  "Art Cards":      ["artcards", "sketchcard", "originalart"],
  "Sports Cards":   ["sportscards", "baseballcards", "basketballcards", "footballcards"],
  "Memorabilia":    ["memorabilia", "autograph", "signed", "gameworn"],
  "Pokemon":        ["pokemon", "pokemoncards", "pikachu", "pokemontcg"],
  "MTG":            ["mtg", "magicthegathering", "magic"],
  "Bo Jackson Arena": ["bojacksonarena", "bja", "tcg"],
  "Vinyl Records":  ["vinyl", "records", "lp", "vinylcollector"],
  "CDs":            ["cds", "albumcollector", "music"],
  "Instruments":    ["guitar", "instruments", "musician"],
  "Video Games":    ["videogames", "retrogames", "gamer", "sealedgames"],
  "Consoles":       ["gamecollector", "retroconsole", "Nintendo", "PlayStation"],
  "Watches":        ["watches", "watchcollector", "horology", "luxury"],
  "Bags":           ["luxurybags", "handbags", "fashioncollector"],
  "Apparel":        ["streetwear", "sneakers", "limitededition"],
  "Funko Pops":     ["funko", "funkopop", "funkoverse", "popcollector"],
};

const TITLE_KEYWORD_TAGS: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /spider.?man|spiderman/i,   tags: ["spiderman", "marvel", "marvelcomics"] },
  { pattern: /batman|bruce wayne/i,       tags: ["batman", "dc", "dccomics"] },
  { pattern: /superman/i,                 tags: ["superman", "dc", "dccomics"] },
  { pattern: /pokemon|pikachu|charizard/i,tags: ["pokemon", "pokemoncards"] },
  { pattern: /star.?wars/i,              tags: ["starwars", "maytheforcebewithyou"] },
  { pattern: /marvel/i,                  tags: ["marvel", "marvelcomics"] },
  { pattern: /michael jordan|mj\b/i,     tags: ["michaeljordan", "nba", "basketballcards"] },
  { pattern: /lebron/i,                  tags: ["lebron", "nba", "basketballcards"] },
  { pattern: /brady|tom brady/i,         tags: ["tombrady", "nfl", "footballcards"] },
  { pattern: /graded|psa|bgs|cgc/i,      tags: ["graded", "gradedcards", "slabs"] },
  { pattern: /rookie/i,                  tags: ["rookiecard", "rookie", "rc"] },
  { pattern: /1st edition|first edition/i,tags: ["firstedition", "1stedition", "vintage"] },
  { pattern: /gold|foil/i,               tags: ["gold", "foil", "premium"] },
  { pattern: /signed|autograph/i,        tags: ["autograph", "signed", "authenticated"] },
  { pattern: /sealed|unopened/i,         tags: ["sealed", "unopened", "waxlife"] },
  { pattern: /nintendo|mario|zelda/i,    tags: ["nintendo", "mario", "retrogaming"] },
  { pattern: /funko/i,                   tags: ["funko", "funkopop", "popcollector"] },
  { pattern: /vinyl|record|lp/i,         tags: ["vinyl", "recordcollector", "vinyljunkie"] },
];

const ALWAYS_TAGS = ["VLTD", "collector", "vault"];

function generateHashtags(item: VaultItem): string[] {
  const tags = new Set<string>(ALWAYS_TAGS);
  const univKey = (item.universe ?? "").toUpperCase();
  (UNIVERSE_TAGS[univKey] ?? []).forEach(t => tags.add(t));
  const cat = item.category ?? item.categoryLabel ?? "";
  (CATEGORY_TAGS[cat] ?? []).forEach(t => tags.add(t));
  const titleStr = `${item.title} ${item.subtitle ?? ""}`;
  for (const { pattern, tags: kTags } of TITLE_KEYWORD_TAGS) {
    if (pattern.test(titleStr)) kTags.forEach(t => tags.add(t));
  }
  if (item.grade) tags.add("graded");
  return Array.from(tags).slice(0, 15);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Image card canvas ────────────────────────────────────────────────────────
async function exportToCanvas(opts: {
  item: VaultItem;
  ratio: AspectRatio;
  bg: string;
  showValue: boolean;
  watermark: boolean;
  hashtags: string[];
  showHashtags: boolean;
}): Promise<string> {
  const { item, ratio, bg, showValue, watermark, hashtags, showHashtags } = opts;
  const spec = ASPECT_OPTIONS.find((o) => o.ratio === ratio) ?? ASPECT_OPTIONS[0];
  const { w, h } = spec;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.9);
  grad.addColorStop(0, "rgba(245,181,72,0.07)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const hashtagReserve = showHashtags && hashtags.length > 0 ? Math.round(h * 0.08) : 0;
  const contentH = h - hashtagReserve;

  const imageUrl = getPrimaryImageUrl(item);
  if (imageUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const padding = Math.round(w * 0.08);
        const imgArea = { x: padding, y: Math.round(contentH * 0.10), w: w - padding * 2, h: Math.round(contentH * 0.58) };
        const scale = Math.min(imgArea.w / img.width, imgArea.h / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const sx = imgArea.x + (imgArea.w - sw) / 2;
        const sy = imgArea.y + (imgArea.h - sh) / 2;
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = Math.round(w * 0.04);
        ctx.shadowOffsetY = Math.round(h * 0.01);
        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imageUrl;
    });
  }

  const lineY = Math.round(contentH * 0.76);
  const lineGrad = ctx.createLinearGradient(Math.round(w * 0.08), 0, Math.round(w * 0.92), 0);
  lineGrad.addColorStop(0, "rgba(245,181,72,0)");
  lineGrad.addColorStop(0.2, "#F5B548");
  lineGrad.addColorStop(0.8, "#F5B548");
  lineGrad.addColorStop(1, "rgba(245,181,72,0)");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = Math.round(w * 0.0025);
  ctx.beginPath();
  ctx.moveTo(Math.round(w * 0.08), lineY);
  ctx.lineTo(Math.round(w * 0.92), lineY);
  ctx.stroke();

  const titleY = lineY + Math.round(contentH * 0.035);
  const titleSize = Math.round(w * 0.048);
  const textColor = bg === "#F5F0E8" ? "#1A1A1A" : "#FFFFFF";
  ctx.fillStyle = textColor;
  ctx.font = `700 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxWidth = w * 0.84;
  const words = item.title.split(" ");
  let line = "";
  let currentY = titleY;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, w / 2, currentY);
      line = word;
      currentY += titleSize * 1.25;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, w / 2, currentY);

  const metaY = currentY + titleSize * 1.3;
  const metaParts = [item.subtitle, item.grade ? `Grade ${item.grade}` : null].filter(Boolean).join(" • ");
  if (metaParts) {
    ctx.font = `400 ${Math.round(w * 0.028)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#F5B548";
    ctx.fillText(metaParts, w / 2, metaY);
  }

  const value = item.currentValue ?? item.estimatedValue ?? item.askingPrice;
  if (value && value > 0) {
    const valueY = metaParts ? metaY + Math.round(contentH * 0.045) : metaY;
    if (showValue) {
      ctx.font = `800 ${Math.round(w * 0.058)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#F5B548";
      ctx.fillText(fmt(value), w / 2, valueY);
    } else {
      ctx.fillStyle = "rgba(245,181,72,0.28)";
      const bw = Math.round(w * 0.28);
      const bh = Math.round(contentH * 0.045);
      const bx = (w - bw) / 2;
      ctx.beginPath();
      ctx.roundRect(bx, valueY, bw, bh, 8);
      ctx.fill();
    }
  }

  if (watermark) {
    ctx.font = `700 ${Math.round(w * 0.022)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(245,181,72,0.55)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("VLTD", w - Math.round(w * 0.04), contentH - Math.round(contentH * 0.022));
  }

  if (showHashtags && hashtags.length > 0) {
    const hashText = hashtags.map(t => `#${t}`).join("  ");
    const hashSize = Math.round(w * 0.022);
    ctx.font = `500 ${hashSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = bg === "#F5F0E8" ? "rgba(100,80,20,0.7)" : "rgba(245,181,72,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let displayText = hashText;
    while (ctx.measureText(displayText).width > w * 0.9 && displayText.includes("  ")) {
      const parts = displayText.split("  ");
      parts.pop();
      displayText = parts.join("  ");
    }
    ctx.fillText(displayText, w / 2, h - Math.round(hashtagReserve / 2));
  }

  return canvas.toDataURL("image/png");
}

// ─── Then vs Now canvas ───────────────────────────────────────────────────────
async function exportThenVsNow(opts: {
  item: VaultItem;
  bg: string;
  showValues: boolean;
}): Promise<string> {
  const { item, bg, showValues } = opts;
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const isLight = bg === "#F5F0E8" || bg === "#F5B548";
  const textColor = isLight ? "#1A1A1A" : "#FFFFFF";
  const mutedColor = isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)";
  const GOLD = "#F5B548";

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Subtle vignette
  const vg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, S, S);

  const paid = item.purchasePrice ?? 0;
  const now = item.currentValue ?? item.estimatedValue ?? 0;
  const gain = now - paid;
  const gainPct = paid > 0 ? (gain / paid) * 100 : 0;
  const isGain = gain >= 0;

  // Header labels row
  const headerY = 72;
  const halfW = S / 2;

  // THEN column (left)
  ctx.textAlign = "center";
  ctx.font = `700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = mutedColor;
  ctx.textBaseline = "top";
  ctx.fillText("THEN", halfW / 2, headerY);

  // NOW column (right)
  ctx.fillStyle = GOLD;
  ctx.fillText("NOW", halfW + halfW / 2, headerY);

  // Vertical divider
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(halfW, 56);
  ctx.lineTo(halfW, 440);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Price numbers
  const priceY = 120;
  const priceSize = 80;
  ctx.textBaseline = "top";

  // THEN price
  ctx.font = `800 ${priceSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  if (showValues && paid > 0) {
    ctx.fillStyle = mutedColor;
    ctx.fillText(fmt(paid), halfW / 2, priceY);
  } else if (!showValues) {
    ctx.fillStyle = isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(halfW / 2 - 80, priceY + 10, 160, 52, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = mutedColor;
    ctx.fillText("—", halfW / 2, priceY);
  }

  // NOW price
  if (showValues && now > 0) {
    ctx.fillStyle = GOLD;
    ctx.fillText(fmt(now), halfW + halfW / 2, priceY);
  } else if (!showValues) {
    ctx.fillStyle = "rgba(245,181,72,0.25)";
    ctx.beginPath();
    ctx.roundRect(halfW + halfW / 2 - 80, priceY + 10, 160, 52, 8);
    ctx.fill();
  } else {
    ctx.fillStyle = GOLD;
    ctx.fillText("—", halfW + halfW / 2, priceY);
  }

  // Sub-labels
  const subLabelY = priceY + priceSize + 8;
  ctx.font = `500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = mutedColor;
  ctx.fillText("Purchase Price", halfW / 2, subLabelY);
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  ctx.fillText("Est. Value", halfW + halfW / 2, subLabelY);

  // Horizontal divider
  const hdY = 290;
  const hdGrad = ctx.createLinearGradient(80, 0, S - 80, 0);
  hdGrad.addColorStop(0, "rgba(245,181,72,0)");
  hdGrad.addColorStop(0.2, GOLD);
  hdGrad.addColorStop(0.8, GOLD);
  hdGrad.addColorStop(1, "rgba(245,181,72,0)");
  ctx.strokeStyle = hdGrad;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(80, hdY);
  ctx.lineTo(S - 80, hdY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Item image
  const imageUrl = getPrimaryImageUrl(item);
  if (imageUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const imgY = 308;
        const imgH = 360;
        const imgW = S - 160;
        const scale = Math.min(imgW / img.width, imgH / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const sx = (S - sw) / 2;
        const sy = imgY + (imgH - sh) / 2;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imageUrl;
    });
  }

  // Title
  const titleY = 698;
  ctx.font = `700 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Wrap title to 2 lines max
  const words = item.title.split(" ");
  let titleLine = "";
  let titleCurrentY = titleY;
  for (const word of words) {
    const test = titleLine ? `${titleLine} ${word}` : word;
    if (ctx.measureText(test).width > S * 0.84 && titleLine) {
      ctx.fillText(titleLine, S / 2, titleCurrentY);
      titleLine = word;
      titleCurrentY += 48;
    } else {
      titleLine = test;
    }
  }
  if (titleLine) ctx.fillText(titleLine, S / 2, titleCurrentY);

  // Grade / subtitle
  if (item.grade || item.subtitle) {
    const gradeText = [item.grade ? `Grade ${item.grade}` : null, item.subtitle].filter(Boolean).join(" • ");
    ctx.font = `500 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = GOLD;
    ctx.fillText(gradeText, S / 2, titleCurrentY + 56);
  }

  // Gain/loss pill
  if (paid > 0 && now > 0) {
    const gainY = 870;
    const gainText = showValues
      ? `${isGain ? "+" : ""}${fmt(gain)}  ${isGain ? "+" : ""}${gainPct.toFixed(0)}% ${isGain ? "↑" : "↓"}`
      : `${isGain ? "↑" : "↓"} ${Math.abs(gainPct).toFixed(0)}% ${isGain ? "gain" : "loss"}`;
    const gainColor = isGain ? "#4CAF82" : "#E05B5B";
    const gainBg = isGain ? "rgba(76,175,130,0.15)" : "rgba(224,91,91,0.15)";

    ctx.font = `700 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const gainW = ctx.measureText(gainText).width + 48;
    const gainH = 56;
    const gainX = (S - gainW) / 2;

    ctx.fillStyle = gainBg;
    ctx.beginPath();
    ctx.roundRect(gainX, gainY, gainW, gainH, 28);
    ctx.fill();
    ctx.fillStyle = gainColor;
    ctx.textBaseline = "middle";
    ctx.fillText(gainText, S / 2, gainY + gainH / 2);
  }

  // Watermark
  ctx.font = `700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(245,181,72,0.50)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("VLTD", S - 40, S - 32);

  return canvas.toDataURL("image/png");
}

// ─── Single item square card (for carousel) ───────────────────────────────────
async function exportSquareCard(item: VaultItem, bg: string): Promise<string> {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  const grad = ctx.createRadialGradient(S / 2, 0, 0, S / 2, 0, S * 0.9);
  grad.addColorStop(0, "rgba(245,181,72,0.07)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  const imageUrl = getPrimaryImageUrl(item);
  if (imageUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const pad = 80;
        const imgH = Math.round(S * 0.60);
        const scale = Math.min((S - pad * 2) / img.width, imgH / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const sx = (S - sw) / 2;
        const sy = pad + (imgH - sh) / 2;
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 36;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imageUrl;
    });
  }

  // Gold line
  const lineY = Math.round(S * 0.74);
  const lg = ctx.createLinearGradient(80, 0, S - 80, 0);
  lg.addColorStop(0, "rgba(245,181,72,0)");
  lg.addColorStop(0.2, "#F5B548");
  lg.addColorStop(0.8, "#F5B548");
  lg.addColorStop(1, "rgba(245,181,72,0)");
  ctx.strokeStyle = lg;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, lineY);
  ctx.lineTo(S - 80, lineY);
  ctx.stroke();

  const isLight = bg === "#F5F0E8" || bg === "#F5B548";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = isLight ? "#1A1A1A" : "#FFFFFF";
  const words = item.title.split(" ");
  let tline = "";
  let ty = lineY + 28;
  for (const word of words) {
    const test = tline ? `${tline} ${word}` : word;
    if (ctx.measureText(test).width > S * 0.80 && tline) {
      ctx.fillText(tline, S / 2, ty);
      tline = word;
      ty += 54;
    } else {
      tline = test;
    }
  }
  if (tline) ctx.fillText(tline, S / 2, ty);

  if (item.grade) {
    ctx.font = `500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#F5B548";
    ctx.fillText(`Grade ${item.grade}`, S / 2, ty + 60);
  }

  ctx.font = `700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(245,181,72,0.50)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("VLTD", S - 36, S - 28);

  return canvas.toDataURL("image/png");
}

// ─── Animated video export ────────────────────────────────────────────────────
async function exportAnimatedVideo(item: VaultItem, bg: string): Promise<Blob> {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const GOLD = "#F5B548";
  const isLight = bg === "#F5F0E8" || bg === "#F5B548";
  const textColor = isLight ? "#1A1A1A" : "#FFFFFF";

  // Pre-load image
  let itemImg: HTMLImageElement | null = null;
  const imageUrl = getPrimaryImageUrl(item);
  if (imageUrl) {
    itemImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }

  const value = item.currentValue ?? item.estimatedValue;

  // Attempt MediaRecorder capture
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.start(100); // timeslice=100ms ensures periodic data chunks

  const DURATION = 2400; // ms

  function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // rAF-based loop — timestamp-driven so Chrome can't throttle it
  await new Promise<void>((resolve) => {
    const startTime = performance.now();
    function frame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);
    ctx.clearRect(0, 0, S, S);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // Radial overlay
    const bg2 = ctx.createRadialGradient(S / 2, 0, 0, S / 2, 0, S * 0.9);
    bg2.addColorStop(0, "rgba(245,181,72,0.07)");
    bg2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg2;
    ctx.fillRect(0, 0, S, S);

    // Phase 0-0.35: image slides in from bottom + fades
    if (t > 0.05 && itemImg) {
      const imgAlpha = Math.min(1, easeOut(Math.max(0, (t - 0.05) / 0.30)));
      const slideT = easeOut(Math.min(1, Math.max(0, (t - 0.05) / 0.35)));
      const pad = 80;
      const imgH = Math.round(S * 0.60);
      const scale = Math.min((S - pad * 2) / itemImg.width, imgH / itemImg.height);
      const sw = itemImg.width * scale;
      const sh = itemImg.height * scale;
      const sx = (S - sw) / 2;
      const baseY = pad + (imgH - sh) / 2;
      const sy = baseY + (1 - slideT) * 60;

      ctx.save();
      ctx.globalAlpha = imgAlpha;
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(itemImg, sx, sy, sw, sh);
      ctx.restore();
    }

    // Phase 0.35-0.55: gold line sweeps in
    if (t > 0.35) {
      const lineT = easeOut(Math.min(1, (t - 0.35) / 0.20));
      const lineY = Math.round(S * 0.74);
      const lineStart = 80;
      const lineEnd = 80 + (S - 160) * lineT;
      const lg = ctx.createLinearGradient(lineStart, 0, S - 80, 0);
      lg.addColorStop(0, "rgba(245,181,72,0)");
      lg.addColorStop(0.1, GOLD);
      lg.addColorStop(0.9, GOLD);
      lg.addColorStop(1, "rgba(245,181,72,0)");
      ctx.save();
      ctx.globalAlpha = lineT;
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lineStart, lineY);
      ctx.lineTo(lineEnd, lineY);
      ctx.stroke();
      ctx.restore();
    }

    // Phase 0.50-0.75: title fades up
    if (t > 0.50) {
      const textT = easeOut(Math.min(1, (t - 0.50) / 0.25));
      const lineY = Math.round(S * 0.74);
      ctx.save();
      ctx.globalAlpha = textT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = textColor;
      ctx.font = `700 46px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const words = item.title.split(" ");
      let tl = "";
      let ty = lineY + 28 - (1 - textT) * 20;
      for (const w of words) {
        const test = tl ? `${tl} ${w}` : w;
        if (ctx.measureText(test).width > S * 0.80 && tl) {
          ctx.fillText(tl, S / 2, ty);
          tl = w;
          ty += 58;
        } else {
          tl = test;
        }
      }
      if (tl) ctx.fillText(tl, S / 2, ty);

      if (item.grade) {
        ctx.font = `500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = GOLD;
        ctx.fillText(`Grade ${item.grade}`, S / 2, ty + 62);
      }
      ctx.restore();
    }

    // Phase 0.70-0.90: value fades in with scale
    if (t > 0.70 && value && value > 0) {
      const valT = easeInOut(Math.min(1, (t - 0.70) / 0.20));
      const lineY = Math.round(S * 0.74);
      ctx.save();
      ctx.globalAlpha = valT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = `800 62px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = GOLD;
      ctx.fillText(fmt(value), S / 2, lineY - 16);
      ctx.restore();
    }

    // Phase 0.85+: watermark
    if (t > 0.85) {
      const wmT = Math.min(1, (t - 0.85) / 0.15);
      ctx.save();
      ctx.globalAlpha = wmT * 0.55;
      ctx.font = `700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = GOLD;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("VLTD", S - 36, S - 28);
      ctx.restore();
    }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  // Stop recording with hard timeout fallback
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    recorder.onstop = () => { clearTimeout(timeout); resolve(); };
    recorder.stop();
  });

  return new Blob(chunks, { type: mimeType });
}

// ─── Download helper ──────────────────────────────────────────────────────────
function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 500);
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ on, onToggle, label, sub }: { on: boolean; onToggle: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{label}</div>
        {sub && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="relative h-6 w-11 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? "var(--theme-gold)" : "var(--pill)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ─── BG picker ────────────────────────────────────────────────────────────────
function BgPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BG_OPTIONS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.value)}
          className={`h-8 w-8 rounded-full transition ${value === b.value ? "ring-2 ring-[color:var(--theme-gold)] ring-offset-2 scale-110" : "ring-1 ring-[color:var(--border)] opacity-70 hover:opacity-100"}`}
          style={{ background: b.value, "--tw-ring-offset-color": "var(--surface)" } as React.CSSProperties}
          title={b.label}
        />
      ))}
    </div>
  );
}

// ─── Image Card Tab ───────────────────────────────────────────────────────────
function ImageCardTab({ item }: { item: VaultItem }) {
  const [ratio, setRatio] = useState<AspectRatio>("1:1");
  const [bg, setBg] = useState(BG_OPTIONS[0].value);
  const [showValue, setShowValue] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [showHashtags, setShowHashtags] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hashtagsCopied, setHashtagsCopied] = useState(false);
  const [customTag, setCustomTag] = useState("");

  const autoTags = useMemo(() => generateHashtags(item), [item]);
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set(autoTags.slice(0, 8)));
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const allTags = useMemo(() => [...autoTags, ...extraTags], [autoTags, extraTags]);
  const selectedTags = useMemo(() => allTags.filter(t => activeTags.has(t)), [allTags, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags(prev => { const n = new Set(prev); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });
    setPreview(null);
  }

  function addCustomTag() {
    const tag = customTag.replace(/^#/, "").trim().replace(/\s+/g, "");
    if (!tag || allTags.includes(tag)) { setCustomTag(""); return; }
    setExtraTags(prev => [...prev, tag]);
    setActiveTags(prev => new Set([...prev, tag]));
    setCustomTag("");
    setPreview(null);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const dataUrl = await exportToCanvas({ item, ratio, bg, showValue, watermark, hashtags: selectedTags, showHashtags });
      setPreview(dataUrl);
    } catch (e) { console.error("Export failed", e); }
    finally { setExporting(false); }
  }

  function handleDownload() {
    if (!preview) return;
    const slug = item.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
    triggerDownload(preview, `vltd-${slug}-${ratio.replace(":", "x")}.png`);
  }

  async function handleShare() {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const slug = item.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
      const file = new File([blob], `vltd-${slug}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: item.title, text: selectedTags.map(t => `#${t}`).join(" ") });
    } catch { /* cancelled */ }
  }

  async function copyHashtags() {
    try { await navigator.clipboard.writeText(selectedTags.map(t => `#${t}`).join(" ")); } catch { /* */ }
    setHashtagsCopied(true);
    setTimeout(() => setHashtagsCopied(false), 1800);
  }

  const specLabel = ASPECT_OPTIONS.find((o) => o.ratio === ratio);

  return (
    <div className="flex flex-col gap-5">
      {/* Format */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Format</div>
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_OPTIONS.map((o) => (
            <button key={o.ratio} type="button" onClick={() => { setRatio(o.ratio); setPreview(null); }}
              className="flex flex-col items-center gap-1 rounded-xl py-2 text-center ring-1 transition"
              style={{ background: ratio === o.ratio ? "var(--theme-gold)" : "var(--pill)", color: ratio === o.ratio ? "#0B0B0B" : "var(--fg)" }}>
              <span className="text-sm font-bold">{o.label}</span>
              <span className="text-[9px] opacity-70">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Background</div>
        <BgPicker value={bg} onChange={(v) => { setBg(v); setPreview(null); }} />
      </div>

      {/* Hashtags */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Hashtags</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void copyHashtags()}
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition"
              style={{ background: "var(--pill)", color: hashtagsCopied ? "#52C27A" : "var(--muted)", borderColor: hashtagsCopied ? "#52C27A" : "var(--border)" }}>
              {hashtagsCopied ? "✓ Copied" : "Copy all"}
            </button>
            <button type="button" onClick={() => { setShowHashtags(!showHashtags); setPreview(null); }}
              className="relative h-5 w-9 rounded-full transition-colors flex-shrink-0"
              style={{ background: showHashtags ? "var(--theme-gold)" : "var(--pill)" }}>
              <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: showHashtags ? "translateX(16px)" : "translateX(0)" }} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
              style={{ background: activeTags.has(tag) ? "rgba(245,181,72,0.18)" : "var(--pill)", color: activeTags.has(tag) ? "#F5B548" : "var(--muted)", border: activeTags.has(tag) ? "1px solid rgba(245,181,72,0.40)" : "1px solid var(--border)" }}>
              #{tag}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input type="text" value={customTag} onChange={e => setCustomTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
            placeholder="Add hashtag…"
            className="flex-1 rounded-xl px-3 py-1.5 text-sm outline-none ring-1 transition focus:ring-[color:var(--theme-gold)]"
            style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }} />
          <button type="button" onClick={addCustomTag}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 transition"
            style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}>
            +
          </button>
        </div>
        <div className="mt-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
          {activeTags.size} selected · {showHashtags ? "will appear on image" : "copy to use in caption"}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-3">
        <Toggle on={showValue} onToggle={() => { setShowValue(!showValue); setPreview(null); }}
          label="Show value" sub={showValue ? "Value visible in export" : "Value blurred for privacy"} />
        <Toggle on={watermark} onToggle={() => { setWatermark(!watermark); setPreview(null); }}
          label="VLTD watermark" sub="Small branding in corner" />
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]"
          style={{ aspectRatio: ratio.replace(":", "/") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Export preview" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!preview ? (
          <button type="button" onClick={() => void handleExport()} disabled={exporting}
            className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
            style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Generating…" : `Preview ${specLabel?.desc ?? ratio}`}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setPreview(null)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}>
              Edit
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
              Download PNG
            </button>
          </>
        )}
      </div>

      {/* Caption generator */}
      <div className="mt-2">
        <GenerateCopyPanel item={item} mode="social"
          onAccept={(text) => void navigator.clipboard?.writeText(text)}
          triggerLabel="✦ Generate caption" />
      </div>

      {/* Frame Studio link */}
      <Link href={`/vault/frames?id=${item.id}`}
        className="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold ring-1 transition hover:ring-[color:var(--theme-gold)] hover:text-[color:var(--theme-gold)]"
        style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}>
        <span>🖼</span>
        <span>Open in Frame Studio</span>
        <span style={{ opacity: 0.4 }}>→</span>
      </Link>
    </div>
  );
}

// ─── Then vs Now Tab ──────────────────────────────────────────────────────────
function ThenVsNowTab({ item }: { item: VaultItem }) {
  const [bg, setBg] = useState(BG_OPTIONS[0].value);
  const [showValues, setShowValues] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const paid = item.purchasePrice ?? 0;
  const now = item.currentValue ?? item.estimatedValue ?? 0;
  const hasBoth = paid > 0 && now > 0;
  const gain = now - paid;
  const gainPct = paid > 0 ? (gain / paid) * 100 : 0;

  async function handleGenerate() {
    setExporting(true);
    try {
      const url = await exportThenVsNow({ item, bg, showValues });
      setPreview(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  function handleDownload() {
    if (!preview) return;
    const slug = item.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 36);
    triggerDownload(preview, `vltd-then-vs-now-${slug}.png`);
  }

  async function handleShare() {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      const file = new File([blob], "vltd-then-vs-now.png", { type: "image/png" });
      await navigator.share({ files: [file], title: `${item.title} · Then vs Now`, text: "#VLTD #collector #vault" });
    } catch { /* */ }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Info */}
      {hasBoth ? (
        <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Paid</div>
              <div className="mt-1 text-lg font-bold" style={{ color: "var(--fg)" }}>{fmt(paid)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>Now</div>
              <div className="mt-1 text-lg font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>{fmt(now)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>ROI</div>
              <div className="mt-1 text-lg font-bold" style={{ color: gain >= 0 ? "#4CAF82" : "#E05B5B" }}>
                {gain >= 0 ? "+" : ""}{gainPct.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 text-center text-sm ring-1 ring-[color:var(--border)]"
          style={{ background: "var(--pill)", color: "var(--muted)" }}>
          {!paid && !now
            ? "Add a purchase price and current value to generate this card."
            : !paid
            ? "Add a purchase price to show what you paid."
            : "Add a current value to show your gain."}
        </div>
      )}

      {/* Background */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Background</div>
        <BgPicker value={bg} onChange={(v) => { setBg(v); setPreview(null); }} />
      </div>

      {/* Toggle value visibility */}
      <Toggle on={showValues} onToggle={() => { setShowValues(!showValues); setPreview(null); }}
        label="Show dollar amounts" sub={showValues ? "Prices visible in export" : "Show % change only"} />

      {/* Preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]" style={{ aspectRatio: "1" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Then vs Now preview" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!preview ? (
          <button type="button" onClick={() => void handleGenerate()} disabled={exporting || !hasBoth}
            className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
            style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: (exporting || !hasBoth) ? 0.5 : 1 }}>
            {exporting ? "Generating…" : "Preview Card"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setPreview(null)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}>
              Edit
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
              Download PNG
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Animated Video Tab ───────────────────────────────────────────────────────
function VideoTab({ item }: { item: VaultItem }) {
  const [bg, setBg] = useState(BG_OPTIONS[0].value);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const supported = typeof MediaRecorder !== "undefined";

  async function handleRecord() {
    setRecording(true);
    setVideoUrl(null);
    setVideoBlob(null);
    try {
      const blob = await exportAnimatedVideo(item, bg);
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(url);
    } catch (e) { console.error("Video export failed", e); }
    finally { setRecording(false); }
  }

  function handleDownload() {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    const slug = item.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 36);
    triggerDownload(url, `vltd-${slug}.webm`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  if (!supported) {
    return (
      <div className="rounded-2xl p-5 text-center text-sm ring-1 ring-[color:var(--border)]"
        style={{ background: "var(--pill)", color: "var(--muted)" }}>
        Video recording isn't supported in this browser. Try Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
        <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Creates a 2.4 second animated reveal — image fades in, gold line sweeps, title and value appear. Downloads as .webm.
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Background</div>
        <BgPicker value={bg} onChange={(v) => { setBg(v); setVideoUrl(null); }} />
      </div>

      {/* Video preview */}
      {videoUrl && (
        <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]" style={{ aspectRatio: "1" }}>
          <video ref={videoRef} src={videoUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex gap-2">
        {!videoUrl ? (
          <button type="button" onClick={() => void handleRecord()} disabled={recording}
            className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
            style={{ background: "var(--theme-gold)", color: "#0B0B0B", opacity: recording ? 0.6 : 1 }}>
            {recording ? "Recording… (~3 sec)" : "Generate Video"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { setVideoUrl(null); setVideoBlob(null); }}
              className="rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}>
              Regenerate
            </button>
            <button type="button" onClick={handleDownload}
              className="flex-1 rounded-2xl py-3 text-sm font-bold"
              style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}>
              Download .webm
            </button>
          </>
        )}
      </div>

      <div className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
        .webm works on Instagram, TikTok, X, and most social platforms. Convert to .mp4 with any free tool if needed.
      </div>
    </div>
  );
}

// ─── Carousel Tab ─────────────────────────────────────────────────────────────
function CarouselTab({ currentItem }: { currentItem: VaultItem }) {
  const [bg, setBg] = useState(BG_OPTIONS[0].value);
  const [selected, setSelected] = useState<Set<string>>(() => new Set([currentItem.id]));
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const allItems = useMemo(() => {
    try { return loadItems().slice(0, 40); } catch { return [currentItem]; }
  }, [currentItem]);

  function toggleItem(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else if (n.size < 10) { n.add(id); }
      return n;
    });
    setExported(false);
  }

  async function handleExportAll() {
    setExporting(true);
    setExported(false);
    const items = allItems.filter(i => selected.has(i.id));
    for (let idx = 0; idx < items.length; idx++) {
      const dataUrl = await exportSquareCard(items[idx], bg);
      const slug = items[idx].title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 32);
      triggerDownload(dataUrl, `vltd-carousel-${idx + 1}-${slug}.png`);
      await new Promise(r => setTimeout(r, 350)); // stagger downloads
    }
    setExporting(false);
    setExported(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
        <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Select up to 10 items. Each gets a 1:1 square card downloaded as individual PNGs — perfect for Instagram carousel posts.
        </div>
      </div>

      {/* Background */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Card Style</div>
        <BgPicker value={bg} onChange={setBg} />
      </div>

      {/* Item grid */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Select Items
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{selected.size} / 10 selected</div>
        </div>
        <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
          {allItems.map(i => {
            const imgUrl = getPrimaryImageUrl(i);
            const isSel = selected.has(i.id);
            return (
              <button key={i.id} type="button" onClick={() => toggleItem(i.id)}
                className="relative rounded-xl overflow-hidden ring-2 transition aspect-square"
                style={{ border: isSel ? "2px solid #F5B548" : "2px solid transparent" }}>
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl} alt={i.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[9px] text-center p-1"
                    style={{ background: "var(--pill)", color: "var(--muted)" }}>
                    {i.title.slice(0, 12)}
                  </div>
                )}
                {isSel && (
                  <div className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "#F5B548", color: "#0B0B0B" }}>
                    {Array.from(selected).indexOf(i.id) + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <button type="button" onClick={() => void handleExportAll()}
          disabled={exporting || selected.size === 0}
          className="flex-1 rounded-2xl py-3 text-sm font-bold transition"
          style={{ background: exported ? "#4CAF82" : "var(--theme-gold)", color: "#0B0B0B", opacity: (exporting || selected.size === 0) ? 0.5 : 1 }}>
          {exporting ? `Exporting ${selected.size} cards…` : exported ? "✓ Downloaded!" : `Download ${selected.size} Card${selected.size !== 1 ? "s" : ""}`}
        </button>
      </div>

      <div className="text-[10px] text-center" style={{ color: "var(--muted)" }}>
        Files download one by one with a short delay. Check your Downloads folder.
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type Props = {
  item: VaultItem;
  onClose: () => void;
  initialTab?: Tab;
};

const TAB_CONFIG: { id: Tab; label: string; emoji: string }[] = [
  { id: "image",       label: "Image",     emoji: "📷" },
  { id: "then-vs-now", label: "Then vs Now", emoji: "↗️" },
  { id: "video",       label: "Video",     emoji: "🎬" },
  { id: "carousel",    label: "Carousel",  emoji: "🗂️" },
];

export default function SocialExportSheet({ item, onClose, initialTab = "image" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden ring-1 ring-[color:var(--border)] shadow-2xl max-h-[92dvh] overflow-y-auto"
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
                Share · Export
              </div>
              <div className="mt-0.5 text-base font-bold line-clamp-1" style={{ color: "var(--fg)" }}>
                {item.title}
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="rounded-full p-2 text-lg leading-none"
              style={{ background: "var(--pill)", color: "var(--muted)" }}>
              ✕
            </button>
          </div>

          {/* Tab nav */}
          <div className="flex gap-1 rounded-2xl p-1 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
            {TAB_CONFIG.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className="flex-1 rounded-xl py-2 text-center text-[11px] font-bold transition"
                style={{
                  background: tab === t.id ? "var(--theme-gold)" : "transparent",
                  color: tab === t.id ? "#0B0B0B" : "var(--muted)",
                }}>
                <span className="block sm:hidden">{t.emoji}</span>
                <span className="hidden sm:block">{t.label}</span>
                <span className="sm:hidden text-[9px] block leading-tight mt-0.5">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "image" && <ImageCardTab item={item} />}
          {tab === "then-vs-now" && <ThenVsNowTab item={item} />}
          {tab === "video" && <VideoTab item={item} />}
          {tab === "carousel" && <CarouselTab currentItem={item} />}
        </div>
      </div>
    </div>
  );
}
