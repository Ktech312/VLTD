// Path: src/app/vault/VaultInner.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DEMO_ITEMS } from "@/lib/demoVault";
import UniverseRail from "@/components/UniverseRail";
import { TAXONOMY, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import { type Tier, getTierSafe, onTierChange } from "@/lib/subscription";
import { createClientVaultId } from "@/lib/clientVaultId";
import {
  MUSEUM_BG_EVENT,
  getMuseumBackground,
  type MuseumBackgroundMode,
} from "@/lib/museumBackground";

import { PillButton } from "@/components/ui/PillButton";
import { EmptyState } from "@/components/ui/EmptyState";

type FrameStyle = "gallery" | "shadowbox" | "slab" | "minimal" | "vault";

const FRAME_OPTIONS: { value: FrameStyle; label: string }[] = [
  { value: "gallery", label: "Gallery Frame" },
  { value: "shadowbox", label: "Shadowbox" },
  { value: "slab", label: "Slab (graded)" },
  { value: "minimal", label: "Minimal" },
  { value: "vault", label: "Vault Steel" },
];

const LS_FRAME_KEY = "vltd_frame_style";

function normalizeGrade(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

function escapeXml(str: string) {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function placeholderDataUri(title: string, category: string) {
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const cat = category.toUpperCase();

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#171717"/>
        <stop offset="0.5" stop-color="#0f172a"/>
        <stop offset="1" stop-color="#0b1220"/>
      </linearGradient>
      <radialGradient id="r" cx="35%" cy="18%" r="80%">
        <stop offset="0" stop-color="rgba(255,255,255,0.14)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#r)"/>
    <rect x="80" y="95" width="740" height="1010" rx="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.09)"/>
    <text x="120" y="200" font-family="Arial" font-size="26" fill="rgba(255,255,255,0.56)" letter-spacing="3">${escapeXml(
      cat
    )}</text>
    <text x="120" y="430" font-family="Arial" font-size="108" fill="rgba(255,255,255,0.94)" font-weight="700">${escapeXml(
      initials || "VL"
    )}</text>
    <text x="120" y="520" font-family="Arial" font-size="30" fill="rgba(255,255,255,0.60)">${escapeXml(
      title.slice(0, 28)
    )}</text>
    <text x="120" y="615" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.42)">Add photo for best display</text>
  </svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function genericCoverDataUri(label: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0b1220"/>
        <stop offset="0.55" stop-color="#111827"/>
        <stop offset="1" stop-color="#05070c"/>
      </linearGradient>
      <radialGradient id="r" cx="25%" cy="18%" r="85%">
        <stop offset="0" stop-color="rgba(255,255,255,0.10)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#r)"/>
    <rect x="80" y="95" width="740" height="1010" rx="42" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)"/>
    <text x="120" y="230" font-family="Arial" font-size="26" fill="rgba(255,255,255,0.55)" letter-spacing="3">${escapeXml(
      label.toUpperCase()
    )}</text>
    <text x="120" y="520" font-family="Arial" font-size="92" fill="rgba(255,255,255,0.92)" font-weight="700">VLTD</text>
    <text x="120" y="598" font-family="Arial" font-size="25" fill="rgba(255,255,255,0.55)">Generic display image</text>
  </svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function clampNumber(n: number, fallback = 0) {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function normalizeImageForTier(file: File, tier: Tier): Promise<string> {
  const original = await fileToDataUrl(file);
  if (tier === "PREMIUM") return original;

  const maxW = 1200;
  const maxH = 1200;
  const jpegQuality = 0.72;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(original);

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      try {
        resolve(canvas.toDataURL("image/jpeg", jpegQuality));
      } catch {
        resolve(original);
      }
    };
    img.onerror = () => resolve(original);
    img.src = original;
  });
}

function toSeedItemsFromDemo(): ModelItem[] {
  return (DEMO_ITEMS as any[]).map((d) => ({
    id: String(d.id),
    category: d.category,
    customCategoryLabel: d.customCategoryLabel,
    title: d.title,
    subtitle: d.subtitle,
    number: d.number,
    grade: d.grade,
    purchasePrice: Number(d.purchasePrice ?? 0),
    currentValue: Number(d.currentValue ?? 0),
    imageFrontUrl: d.imageFrontUrl ?? d.imageUrl,
    imageBackUrl: d.imageBackUrl,
    notes: d.notes ?? "",
    universe: d.universe,
    categoryLabel: d.categoryLabel,
    subcategoryLabel: d.subcategoryLabel,
  }));
}

function itemUniverse(i: ModelItem): UniverseKey {
  return (i.universe ?? "MISC") as UniverseKey;
}

function itemCategory(i: ModelItem): string {
  return i.categoryLabel ?? (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");
}

function itemSubcategory(i: ModelItem): string | undefined {
  return i.subcategoryLabel;
}

function itemLabel(i: ModelItem) {
  const u = UNIVERSE_LABEL[itemUniverse(i)];
  const c = itemCategory(i);
  const s = itemSubcategory(i);
  return s ? `${u} • ${c} • ${s}` : `${u} • ${c}`;
}

function legacyCatToTaxonomy(cat: string | null): { u?: UniverseKey; c?: string } | null {
  if (!cat) return null;
  const v = String(cat).toUpperCase();
  if (v === "COMICS") return { u: "POP_CULTURE", c: "Comics" };
  if (v === "SPORTS") return { u: "SPORTS", c: "Sports Cards" };
  if (v === "POKEMON") return { u: "TCG", c: "Pokémon" };
  if (v === "MTG") return { u: "TCG", c: "MTG" };
  if (v === "CUSTOM") return { u: "MISC", c: "Collector’s Choice" };
  return null;
}

function museumImgSrc(i: ModelItem) {
  const label = itemLabel(i);
  return i.imageFrontUrl || placeholderDataUri(i.title, label);
}

function IconCamera({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 5l1.2-1.6c.2-.3.6-.4.9-.4h1.8c.3 0 .7.1.9.4L15 5h3a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconPlus({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function getFrameClasses(style: FrameStyle) {
  switch (style) {
    case "gallery":
      return {
        card: "bg-transparent",
        outer: "rounded-[18px] border border-[#7f633f] bg-[#d9b277] p-[10px] shadow-[0_14px_30px_rgba(63,35,10,0.48)]",
        middle: "rounded-[12px] border border-[#9f7742] bg-[linear-gradient(180deg,#e8c892_0%,#b97837_100%)] p-[10px]",
        inner: "rounded-[10px] border border-[#f0dfbf] bg-[#f4ead8] p-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
        media: "rounded-[6px] overflow-hidden bg-[#fefcf8] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]",
        glass: true,
        labelBar: false,
        rivets: false,
      };
    case "shadowbox":
      return {
        card: "bg-transparent",
        outer: "rounded-[18px] bg-[linear-gradient(180deg,#37241a_0%,#1f130d_100%)] p-[14px] shadow-[0_18px_32px_rgba(0,0,0,0.52)]",
        middle: "rounded-[12px] bg-[linear-gradient(180deg,#17100c_0%,#0e0907_100%)] p-[14px] shadow-[inset_0_0_26px_rgba(0,0,0,0.55)]",
        inner: "rounded-[10px] bg-[#120d0a] p-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]",
        media: "rounded-[6px] overflow-hidden bg-black/50 shadow-[0_10px_22px_rgba(0,0,0,0.5)]",
        glass: true,
        labelBar: false,
        rivets: false,
      };
    case "slab":
      return {
        card: "bg-transparent",
        outer:
          "rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(219,229,241,0.92))] p-[8px] ring-1 ring-white/80 shadow-[0_18px_28px_rgba(132,149,180,0.28)] backdrop-blur",
        middle: "rounded-[13px] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(225,233,245,0.4))] p-[8px] ring-1 ring-[#cad5e5]",
        inner: "rounded-[10px] bg-white/95 p-[8px] ring-1 ring-[#d6deea]",
        media: "rounded-[6px] overflow-hidden bg-[#f7fafc]",
        glass: true,
        labelBar: true,
        rivets: false,
      };
    case "minimal":
      return {
        card: "bg-transparent",
        outer: "rounded-[16px] bg-[#f8f4ee] p-[6px] shadow-[0_12px_24px_rgba(0,0,0,0.16)] ring-1 ring-black/8",
        middle: "rounded-[12px] bg-[#fdfbf8] p-[6px]",
        inner: "rounded-[10px] bg-white p-[4px]",
        media: "rounded-[8px] overflow-hidden bg-[#f6f0e5]",
        glass: false,
        labelBar: false,
        rivets: false,
      };
    case "vault":
      return {
        card: "bg-transparent",
        outer: "relative rounded-[16px] bg-[linear-gradient(180deg,#454c56_0%,#252a32_100%)] p-[10px] shadow-[0_18px_34px_rgba(0,0,0,0.60)] ring-1 ring-white/10",
        middle: "rounded-[11px] bg-[linear-gradient(180deg,#1d2128_0%,#10141a_100%)] p-[8px] ring-1 ring-white/8",
        inner: "rounded-[8px] bg-black/80 p-[6px] ring-1 ring-white/6",
        media: "rounded-[5px] overflow-hidden bg-black",
        glass: true,
        labelBar: false,
        rivets: true,
      };
    default:
      return {
        card: "bg-transparent",
        outer: "rounded-[18px] border border-[#7f633f] bg-[#d9b277] p-[10px] shadow-[0_14px_30px_rgba(63,35,10,0.48)]",
        middle: "rounded-[12px] border border-[#9f7742] bg-[linear-gradient(180deg,#e8c892_0%,#b97837_100%)] p-[10px]",
        inner: "rounded-[10px] border border-[#f0dfbf] bg-[#f4ead8] p-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
        media: "rounded-[6px] overflow-hidden bg-[#fefcf8] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]",
        glass: true,
        labelBar: false,
        rivets: false,
      };
  }
}

function chunkItems<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function GalleryWall({
  children,
  backgroundImage,
  backgroundMode,
}: {
  children: React.ReactNode;
  backgroundImage?: string;
  backgroundMode: MuseumBackgroundMode;
}) {
  const resolvedImage = backgroundImage || "/backgrounds/museum-wall-dark.webp";

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/8 shadow-[0_40px_110px_rgba(0,0,0,0.78)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('${resolvedImage}')`,
          backgroundSize: backgroundMode === "contain" ? "contain" : "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#05070b",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.60)_0%,rgba(0,0,0,0)_18%,rgba(0,0,0,0)_82%,rgba(0,0,0,0.60)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[20%] bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.65)_100%)]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.48)]" />

      <div className="relative px-3 py-5 sm:px-5 sm:py-7 lg:px-6">{children}</div>
    </div>
  );
}

function ShelfRow({
  children,
  shelfIndex,
}: {
  children: React.ReactNode;
  shelfIndex: number;
}) {
  return (
    <div className={shelfIndex === 0 ? "relative" : "relative mt-10 sm:mt-12 lg:mt-16"}>
      <div className="relative px-1 sm:px-2">
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-x-4">
          {children}
        </div>
      </div>

      <div className="pointer-events-none relative mt-1.5 sm:mt-2">
        <div className="mx-auto h-[1px] w-[95%] rounded-full bg-white/40" />
        <div className="mx-auto mt-[1px] h-[3px] w-[96%] rounded-t-[999px] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(168,176,186,0.85)_65%,rgba(76,84,93,0.92)_100%)]" />
        <div className="mx-auto h-[11px] w-[97%] rounded-[999px] border border-white/10 bg-[linear-gradient(180deg,rgba(186,194,204,0.92)_0%,rgba(95,103,114,0.95)_42%,rgba(28,32,38,0.98)_100%)] shadow-[0_16px_26px_rgba(0,0,0,0.60),inset_0_1px_0_rgba(255,255,255,0.26)]" />
        <div className="mx-auto mt-[2px] h-[8px] w-[88%] rounded-full bg-white/6 blur-lg" />
        <div className="mx-auto mt-[-2px] h-[14px] w-[90%] rounded-full bg-black/32 blur-xl" />
      </div>
    </div>
  );
}

function VaultCard({
  href,
  frameStyle,
  imgSrc,
  title,
  metaLabel,
  subtitleLine,
  valueLine,
}: {
  href: string;
  frameStyle: FrameStyle;
  imgSrc: string;
  title: string;
  metaLabel: string;
  subtitleLine: string;
  valueLine: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const raf = useRef<number | null>(null);
  const frame = getFrameClasses(frameStyle);

  const setVars = (rx: number, ry: number, active: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    el.style.setProperty("--a", active ? "1" : "0");
  };

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);

    const max = frameStyle === "slab" ? 4 : 6;
    const ry = (px - 0.5) * (max * 2);
    const rx = -(py - 0.5) * (max * 2);

    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setVars(rx, ry, true));
  }

  function onLeave() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setVars(0, 0, false));
  }

  useEffect(() => {
    setVars(0, 0, false);
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      className={[
        "group relative block min-w-0 rounded-[18px] p-0.5 transition-[transform,filter] duration-300 ease-out",
        frame.card,
        "[transform-style:preserve-3d] [perspective:900px]",
        "hover:z-[2]",
        "[transform:translateY(0)_translateZ(0)_rotateX(var(--rx))_rotateY(var(--ry))]",
        "hover:-translate-y-1.5 sm:hover:-translate-y-2",
      ].join(" ")}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
      onPointerDown={() => setVars(0, 0, true)}
      draggable={false}
    >
      <div className="pb-1.5 text-center">
        <div className="line-clamp-1 text-[10px] tracking-[0.16em] text-[color:var(--muted2)]">{metaLabel}</div>
        <div className="mt-1 line-clamp-1 text-[12px] font-semibold text-[color:var(--fg)] sm:text-[14px]">{title}</div>
        <div className="line-clamp-1 text-[10px] text-[color:var(--muted)] sm:text-[11px]">{subtitleLine || "—"}</div>
        <div className="mt-1 text-[10px] text-[color:var(--fg)] sm:text-[11px]">{valueLine}</div>
      </div>

      <div
        className="pointer-events-none absolute left-1/2 top-[14px] h-[72px] w-[68%] -translate-x-1/2 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          opacity: "var(--a)" as any,
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.20), rgba(255,255,255,0) 70%)",
          filter: "blur(14px)",
        }}
      />

      <div className={frame.outer}>
        {frame.rivets ? (
          <>
            <div className="pointer-events-none absolute left-[10px] top-[10px] h-2.5 w-2.5 rounded-full bg-white/18 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <div className="pointer-events-none absolute right-[10px] top-[10px] h-2.5 w-2.5 rounded-full bg-white/18 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <div className="pointer-events-none absolute left-[10px] bottom-[10px] h-2.5 w-2.5 rounded-full bg-white/18 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <div className="pointer-events-none absolute right-[10px] bottom-[10px] h-2.5 w-2.5 rounded-full bg-white/18 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
          </>
        ) : null}

        <div className={frame.middle}>
          {frame.labelBar ? (
            <div className="mb-2 rounded-[8px] border border-[#cfd8e7] bg-white/95 px-2 py-1 text-[8px] font-semibold tracking-[0.18em] text-[#6d7b93]">
              GRADED DISPLAY
            </div>
          ) : null}

          <div className={frame.inner}>
            <div className={frame.media}>
              <div className="relative aspect-[3/4] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                  loading="lazy"
                  draggable={false}
                />

                {frame.glass ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.07)_22%,rgba(255,255,255,0)_54%)] mix-blend-screen transition-transform duration-300 group-hover:translate-x-[2%]" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_120px_at_50%_0%,rgba(255,255,255,0.14),rgba(255,255,255,0)_70%)] opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[18%] bottom-[-2px] h-4 rounded-full bg-black/38 opacity-55 blur-lg transition-all duration-300 group-hover:opacity-70 group-hover:blur-xl" />
    </a>
  );
}

function PhotoTile({
  label,
  value,
  onPick,
  onClear,
  tier,
}: {
  label: string;
  value?: string;
  onPick: (file: File | null) => void;
  onClear: () => void;
  tier: Tier;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const hint = tier === "FREE" ? "Free: saved as optimized JPEG" : "Paid: saved full quality";

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    await onPick(f);
  }

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[color:var(--muted2)] hover:text-[color:var(--fg)]"
            title="Remove photo"
          >
            Remove
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={openPicker}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const f = e.dataTransfer?.files?.[0] ?? null;
          void handleFile(f);
        }}
        className={[
          "group relative w-full overflow-hidden rounded-3xl vltd-panel-soft ring-1 ring-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] transition",
          dragOver ? "scale-[0.995] ring-[color:var(--border-strong)]" : "hover:scale-[0.998]",
        ].join(" ")}
        style={{ aspectRatio: "4 / 3" }}
        title="Click or drop an image"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[color:var(--input)]">
            <div className="flex flex-col items-center gap-2">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]">
                <IconCamera />
              </div>
              <div className="text-sm font-medium">Add photo</div>
              <div className="text-xs text-[color:var(--muted2)]">Click or drag &amp; drop</div>
            </div>
          </div>
        )}

        <div
          className={[
            "pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300",
            value ? "group-hover:opacity-90" : "opacity-60",
          ].join(" ")}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.00) 52%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(600px 260px at 30% 10%, rgba(255,255,255,0.10), rgba(255,255,255,0) 55%)",
          }}
        />

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/35 px-3 py-2 text-left text-xs text-white/80">
          {dragOver ? "Drop to add" : hint}
        </div>

        {!value ? (
          <div className="pointer-events-none absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <IconPlus className="h-5 w-5 text-white/90" />
          </div>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void handleFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}

export default function VaultInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<ModelItem[]>([]);
  const [tier, setTier] = useState<Tier>("FREE");
  const bulkAllowed = tier === "PREMIUM";

  const [q, setQ] = useState("");
  const [graded, setGraded] = useState("");
  const [grade, setGrade] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const [uFilter, setUFilter] = useState<UniverseKey | "ALL">("ALL");
  const [cFilter, setCFilter] = useState<string>("ALL");
  const [sFilter, setSFilter] = useState<string>("ALL");

  const [frameStyle, setFrameStyle] = useState<FrameStyle>("gallery");
  const [open, setOpen] = useState(false);
  const [bulkEnabled, setBulkEnabled] = useState(false);

  const [museumBackgroundImage, setMuseumBackgroundImage] = useState<string | undefined>(undefined);
  const [museumBackgroundMode, setMuseumBackgroundMode] = useState<MuseumBackgroundMode>("cover");

  const [lockPhotos] = useState(false);
  const [lockTaxonomy] = useState(true);
  const [lockGrade] = useState(false);
  const [lockNumber] = useState(false);
  const [lockSubtitle] = useState(false);
  const [lockPricing] = useState(false);
  const [lockNotes] = useState(false);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const [newUniverse, setNewUniverse] = useState<UniverseKey>("POP_CULTURE");
  const [newCategoryLabel, setNewCategoryLabel] = useState<string>("Comics");
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState<string>("ALL");

  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newPurchase, setNewPurchase] = useState("0");
  const [newValue, setNewValue] = useState("0");

  const [frontUrl, setFrontUrl] = useState<string | undefined>(undefined);
  const [backUrl, setBackUrl] = useState<string | undefined>(undefined);

  const [useGenericFront, setUseGenericFront] = useState(false);
  const [useGenericBack, setUseGenericBack] = useState(false);

  const [newNotes, setNewNotes] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    setItems(loaded);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(LS_FRAME_KEY) as FrameStyle | null;
    if (saved && FRAME_OPTIONS.some((o) => o.value === saved)) setFrameStyle(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LS_FRAME_KEY, frameStyle);
  }, [frameStyle]);

  useEffect(() => {
    setTier(getTierSafe());
    const unsub = onTierChange((t) => setTier(t));
    return unsub;
  }, []);

  useEffect(() => {
    setBulkEnabled(tier === "PREMIUM");
  }, [tier]);

  useEffect(() => {
    const bg = getMuseumBackground();
    setMuseumBackgroundImage(bg.image);
    setMuseumBackgroundMode(bg.mode);
  }, []);

  useEffect(() => {
    const syncBackground = () => {
      const bg = getMuseumBackground();
      setMuseumBackgroundImage(bg.image);
      setMuseumBackgroundMode(bg.mode);
    };

    window.addEventListener(MUSEUM_BG_EVENT, syncBackground);
    return () => window.removeEventListener(MUSEUM_BG_EVENT, syncBackground);
  }, []);

  useEffect(() => {
    setQ(sp.get("q") ?? "");
    setGraded(sp.get("graded") ?? "");
    setGrade(sp.get("grade") ?? "");
    setMin(sp.get("min") ?? "");
    setMax(sp.get("max") ?? "");

    const u = sp.get("u") as UniverseKey | null;
    const c = sp.get("c");
    const s = sp.get("s");
    const legacy = legacyCatToTaxonomy(sp.get("cat"));

    if (
      u &&
      (u === "POP_CULTURE" ||
        u === "SPORTS" ||
        u === "TCG" ||
        u === "MUSIC" ||
        u === "JEWELRY_APPAREL" ||
        u === "GAMES" ||
        u === "MISC")
    ) {
      setUFilter(u);
    } else if (legacy?.u) {
      setUFilter(legacy.u);
    } else {
      setUFilter("ALL");
    }

    if (c) setCFilter(c);
    else if (legacy?.c) setCFilter(legacy.c);
    else setCFilter("ALL");

    if (s) setSFilter(s);
    else setSFilter("ALL");
  }, [sp]);

  const wantsAdd = sp.get("add") === "1" || sp.get("new") === "1";

  useEffect(() => {
    if (!wantsAdd) return;
    resetModal(true);
    setOpen(true);
  }, [wantsAdd]);

  function closeAddAndCleanUrl() {
    const params = new URLSearchParams(sp.toString());
    params.delete("add");
    params.delete("new");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function goQuickAdd() {
    router.push("/vault/quick");
  }

  const universeCounts = useMemo(() => {
    const counts: Partial<Record<UniverseKey, number>> = {};
    items.forEach((i) => {
      const u = itemUniverse(i);
      counts[u] = (counts[u] ?? 0) + 1;
    });
    return counts;
  }, [items]);

  const availableCategories = useMemo(() => {
    if (uFilter === "ALL") return [];
    return Object.keys(TAXONOMY[uFilter] ?? {});
  }, [uFilter]);

  const availableSubcategories = useMemo(() => {
    if (uFilter === "ALL") return [];
    if (cFilter === "ALL") return [];
    return TAXONOMY[uFilter]?.[cFilter] ?? [];
  }, [uFilter, cFilter]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const gradedQ = graded.trim().toLowerCase();
    const gradeQ = grade.trim().toLowerCase();
    const minN = min.trim() ? Number(min) : null;
    const maxN = max.trim() ? Number(max) : null;

    return items.filter((i) => {
      const matchesU = uFilter === "ALL" ? true : itemUniverse(i) === uFilter;
      const matchesC = cFilter === "ALL" ? true : itemCategory(i) === cFilter;
      const matchesS = sFilter === "ALL" ? true : (itemSubcategory(i) ?? "").toLowerCase() === sFilter.toLowerCase();

      const hay = `${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ?? ""} ${i.notes ?? ""} ${itemLabel(i)}`.toLowerCase();
      const matchesQuery = query.length === 0 ? true : hay.includes(query);

      const gradeText = (i.grade ?? "").toLowerCase();
      const matchesGrader = gradedQ.length === 0 ? true : gradeText.includes(gradedQ);
      const matchesGradeExact = gradeQ.length === 0 ? true : normalizeGrade(i.grade ?? "").includes(normalizeGrade(gradeQ));

      const val = Number(i.currentValue ?? 0);
      const cost = Number(i.purchasePrice ?? 0);

      const withinMin = minN === null ? true : val >= minN || cost >= minN;
      const withinMax = maxN === null ? true : val <= maxN || cost <= maxN;

      return matchesU && matchesC && matchesS && matchesQuery && matchesGrader && matchesGradeExact && withinMin && withinMax;
    });
  }, [items, q, graded, grade, min, max, uFilter, cFilter, sFilter]);

  const emptyTaxonomySliceCount = useMemo(() => {
    return items.filter((i) => {
      const matchesU = uFilter === "ALL" ? true : itemUniverse(i) === uFilter;
      const matchesC = cFilter === "ALL" ? true : itemCategory(i) === cFilter;
      const matchesS = sFilter === "ALL" ? true : (itemSubcategory(i) ?? "").toLowerCase() === sFilter.toLowerCase();
      return matchesU && matchesC && matchesS;
    }).length;
  }, [items, uFilter, cFilter, sFilter]);

  const hasApplied =
    q.trim() ||
    graded.trim() ||
    grade.trim() ||
    min.trim() ||
    max.trim() ||
    uFilter !== "ALL" ||
    cFilter !== "ALL" ||
    sFilter !== "ALL";

  const sliceLabel =
    uFilter === "ALL"
      ? "All"
      : sFilter !== "ALL"
        ? `${UNIVERSE_LABEL[uFilter]} • ${cFilter} • ${sFilter}`
        : cFilter !== "ALL"
          ? `${UNIVERSE_LABEL[uFilter]} • ${cFilter}`
          : `${UNIVERSE_LABEL[uFilter]}`;

  const showEmptySliceMessage =
    filtered.length === 0 &&
    hasApplied &&
    (uFilter !== "ALL" || cFilter !== "ALL" || sFilter !== "ALL") &&
    emptyTaxonomySliceCount === 0;

  const closestMatches = useMemo(() => {
    if (filtered.length > 0) return [];

    if ((uFilter !== "ALL" || cFilter !== "ALL" || sFilter !== "ALL") && emptyTaxonomySliceCount === 0) {
      return [];
    }

    const query = q.trim().toLowerCase();
    const pool =
      uFilter === "ALL" && cFilter === "ALL" && sFilter === "ALL"
        ? items
        : items.filter((i) => {
            const matchesU = uFilter === "ALL" ? true : itemUniverse(i) === uFilter;
            const matchesC = cFilter === "ALL" ? true : itemCategory(i) === cFilter;
            const matchesS = sFilter === "ALL" ? true : (itemSubcategory(i) ?? "").toLowerCase() === sFilter.toLowerCase();
            return matchesU && matchesC && matchesS;
          });

    if (!query) return pool.slice(0, 6);

    const first = query.split(/\s+/)[0] ?? query;
    return pool
      .filter((i) => (`${i.title} ${i.subtitle ?? ""} ${i.number ?? ""} ${i.notes ?? ""}`.toLowerCase()).includes(first))
      .slice(0, 6);
  }, [filtered, q, items, uFilter, cFilter, sFilter, emptyTaxonomySliceCount]);

  function pushFilters(next: Partial<{ u: UniverseKey | "ALL"; c: string; s: string }>) {
    const u = next.u ?? uFilter;
    const c = next.c ?? cFilter;
    const s = next.s ?? sFilter;

    const params = new URLSearchParams(sp.toString());
    params.delete("cat");

    if (u === "ALL") params.delete("u");
    else params.set("u", u);

    if (c === "ALL") params.delete("c");
    else params.set("c", c);

    if (s === "ALL") params.delete("s");
    else params.set("s", s);

    router.push(`/vault${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function clearApplied() {
    router.push("/vault");
  }

  async function onPickFront(file: File | null) {
    if (!file) return;
    setUseGenericFront(false);
    setFrontUrl(await normalizeImageForTier(file, tier));
  }

  async function onPickBack(file: File | null) {
    if (!file) return;
    setUseGenericBack(false);
    setBackUrl(await normalizeImageForTier(file, tier));
  }

  function resetModal(fromOpen = false) {
    const keepBulk = bulkAllowed && bulkEnabled;

    const keepPhotos = keepBulk && lockPhotos;
    const keepTax = keepBulk && lockTaxonomy;
    const keepG = keepBulk && lockGrade;
    const keepNum = keepBulk && lockNumber;
    const keepSub = keepBulk && lockSubtitle;
    const keepP = keepBulk && lockPricing;
    const keepNotesKeep = keepBulk && lockNotes;

    if (!keepTax) {
      setNewUniverse("POP_CULTURE");
      setNewCategoryLabel("Comics");
      setNewSubcategoryLabel("ALL");
    }

    if (!keepSub) setNewSubtitle("");
    if (!keepNum) setNewNumber("");
    if (!keepG) setNewGrade("");
    if (!keepP) {
      setNewPurchase("0");
      setNewValue("0");
    }
    if (!keepNotesKeep) setNewNotes("");

    setNewTitle("");

    if (!keepPhotos) {
      setFrontUrl(undefined);
      setBackUrl(undefined);
      setUseGenericFront(false);
      setUseGenericBack(false);
    }

    setDragY(0);
    setDragging(false);
    touchStartY.current = null;

    if (fromOpen) return;
  }

  function saveNewItem() {
    const title = newTitle.trim();
    if (!title) return;

    const purchasePrice = clampNumber(Number(newPurchase), 0);
    const currentValue = clampNumber(Number(newValue), purchasePrice);

    const genericFront = useGenericFront ? genericCoverDataUri("Front") : undefined;
    const genericBack = useGenericBack ? genericCoverDataUri("Back") : undefined;

    const item: ModelItem = {
      id: createClientVaultId("v"),
      title,
      subtitle: newSubtitle.trim() || undefined,
      number: newNumber.trim() || undefined,
      grade: newGrade.trim() || undefined,
      purchasePrice,
      currentValue,
      imageFrontUrl: frontUrl ?? genericFront,
      imageBackUrl: backUrl ?? genericBack,
      universe: newUniverse,
      categoryLabel: newCategoryLabel,
      subcategoryLabel: newSubcategoryLabel === "ALL" ? undefined : newSubcategoryLabel,
      notes: newNotes ?? "",
    };

    const next = [item, ...items];
    setItems(next);
    saveItems(next);

    if (bulkAllowed && bulkEnabled) {
      resetModal();
      setTimeout(() => titleInputRef.current?.focus(), 0);
      return;
    }

    closeModal();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeModal() {
    setOpen(false);
    resetModal();
    closeAddAndCleanUrl();
  }

  useEffect(() => {
    if (!open) return;
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;

    const scrollBarW = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollBarW > 0) body.style.paddingRight = `${scrollBarW}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartY.current = e.touches[0].clientY;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    if (touchStartY.current == null) return;
    const y = e.touches[0].clientY;
    const delta = Math.max(0, y - touchStartY.current);
    setDragY(delta);
  }

  function onTouchEnd() {
    if (!dragging) return;
    const threshold = 120;
    if (dragY > threshold) {
      closeModal();
      return;
    }
    setDragY(0);
    setDragging(false);
    touchStartY.current = null;
  }

  function onScan() {
    alert("Scan is coming next: camera → detect barcode vs cover → auto-fill.");
  }

  const isTrulyEmpty = items.length === 0;
  const displayItems = filtered.length > 0 ? filtered : [];

  const shelfRows = useMemo(() => chunkItems(displayItems, 4), [displayItems]);
  const closestRows = useMemo(() => chunkItems(closestMatches, 4), [closestMatches]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">Museum</div>
            <h1 className="mt-2 text-3xl font-semibold">Your Collection</h1>
            <p className="mt-1 text-[color:var(--muted)]">Floating shelf presentation. Collector-first. More museum, less grid.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">FRAME</div>
              <select
                value={frameStyle}
                onChange={(e) => setFrameStyle(e.target.value as FrameStyle)}
                className="min-h-[44px] bg-transparent text-[16px] text-[color:var(--pill-fg)] focus:outline-none sm:text-sm"
              >
                {FRAME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[color:var(--surface-strong)]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {hasApplied ? <PillButton onClick={clearApplied}>Clear</PillButton> : null}

            <PillButton variant="primary" onClick={goQuickAdd}>
              + Quick Add
            </PillButton>
          </div>
        </div>

        <UniverseRail
          value={uFilter}
          counts={universeCounts}
          onChange={(v) => {
            setUFilter(v);
            if (v === "ALL") {
              pushFilters({ u: "ALL", c: "ALL", s: "ALL" });
            } else {
              const firstCat = Object.keys(TAXONOMY[v] ?? {})[0] ?? "ALL";
              pushFilters({ u: v, c: firstCat === "ALL" ? "ALL" : firstCat, s: "ALL" });
            }
          }}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <PillButton
            variant={cFilter === "ALL" ? "primary" : "default"}
            onClick={() => {
              setCFilter("ALL");
              setSFilter("ALL");
              pushFilters({ c: "ALL", s: "ALL" });
            }}
          >
            All Categories
          </PillButton>

          {uFilter !== "ALL" &&
            availableCategories.map((c) => {
              const active = cFilter === c;
              return (
                <PillButton
                  key={c}
                  variant={active ? "primary" : "default"}
                  onClick={() => {
                    setCFilter(c);
                    setSFilter("ALL");
                    pushFilters({ c, s: "ALL" });
                  }}
                >
                  {c}
                </PillButton>
              );
            })}
        </div>

        {uFilter !== "ALL" && cFilter !== "ALL" && availableSubcategories.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">SUBCATEGORY</div>
            <select
              value={sFilter}
              onChange={(e) => {
                setSFilter(e.target.value);
                pushFilters({ s: e.target.value });
              }}
              className="min-h-[44px] rounded-xl bg-[color:var(--pill)] px-3 py-2 text-[16px] ring-1 ring-[color:var(--border)] focus:outline-none sm:text-sm"
            >
              <option className="bg-[color:var(--surface-strong)]" value="ALL">
                All
              </option>
              {availableSubcategories.map((s) => (
                <option key={s} value={s} className="bg-[color:var(--surface-strong)]">
                  {s}
                </option>
              ))}
            </select>
            <div className="text-xs text-[color:var(--muted2)]">{sliceLabel}</div>
          </div>
        )}

        <div className="mt-6 text-sm text-[color:var(--muted)]">
          Showing <span className="font-medium text-[color:var(--fg)]">{filtered.length}</span> items
        </div>

        {isTrulyEmpty && !hasApplied && (
          <div className="mt-6">
            <EmptyState
              title="Your vault is empty"
              description="Open Quick Add to capture items fast, then refine the details later."
              action={
                <div className="flex flex-wrap gap-2">
                  <PillButton variant="primary" onClick={goQuickAdd}>
                    + Quick Add
                  </PillButton>
                  <PillButton
                    onClick={() => {
                      const seed = toSeedItemsFromDemo();
                      const loaded = loadItemsOrSeed(seed);
                      setItems(loaded);
                      saveItems(loaded);
                    }}
                  >
                    Seed demo items
                  </PillButton>
                </div>
              }
            />
          </div>
        )}

        {showEmptySliceMessage && (
          <div className="mt-6 rounded-3xl vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold">No items in this subcategory yet</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              You’re viewing <span className="text-[color:var(--fg)]">{sliceLabel}</span>. Add an item here, or change the subcategory
              filter.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <PillButton
                variant="primary"
                onClick={() => {
                  setSFilter("ALL");
                  pushFilters({ s: "ALL" });
                }}
              >
                Clear subcategory
              </PillButton>

              <PillButton onClick={goQuickAdd}>+ Quick Add</PillButton>
            </div>

            <div className="mt-4 text-xs text-[color:var(--muted2)]">Tip: Existing demo items may not have subcategories yet.</div>
          </div>
        )}

        {filtered.length === 0 && hasApplied && !showEmptySliceMessage && (
          <div className="mt-6 rounded-3xl vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">No exact match</h2>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Here are the closest matches{sliceLabel !== "All" ? ` inside ${sliceLabel}` : ""}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PillButton variant="primary" onClick={clearApplied}>
                  Clear filters
                </PillButton>
                <PillButton onClick={goQuickAdd}>+ Quick Add</PillButton>
              </div>
            </div>

            <div className="mt-5">
              <GalleryWall backgroundImage={museumBackgroundImage} backgroundMode={museumBackgroundMode}>
                {closestRows.map((row, rowIndex) => (
                  <ShelfRow key={`closest-row-${rowIndex}`} shelfIndex={rowIndex}>
                    {row.map((i) => (
                      <VaultCard
                        key={i.id}
                        href={`/vault/item/${i.id}`}
                        frameStyle={frameStyle}
                        imgSrc={museumImgSrc(i)}
                        title={i.title}
                        metaLabel={itemLabel(i)}
                        subtitleLine={`${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ? `• ${i.grade}` : ""}`.trim()}
                        valueLine={
                          <>
                            Value: <span className="font-medium">${i.currentValue ?? 0}</span>
                          </>
                        }
                      />
                    ))}
                  </ShelfRow>
                ))}
              </GalleryWall>
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <section className="mt-6">
            <GalleryWall backgroundImage={museumBackgroundImage} backgroundMode={museumBackgroundMode}>
              {shelfRows.map((row, rowIndex) => (
                <ShelfRow key={`row-${rowIndex}`} shelfIndex={rowIndex}>
                  {row.map((i) => (
                    <VaultCard
                      key={i.id}
                      href={`/vault/item/${i.id}`}
                      frameStyle={frameStyle}
                      imgSrc={museumImgSrc(i)}
                      title={i.title}
                      metaLabel={itemLabel(i)}
                      subtitleLine={`${i.subtitle ?? ""} ${i.number ?? ""} ${i.grade ? `• ${i.grade}` : ""}`.trim()}
                      valueLine={
                        <>
                          Value: <span className="font-medium">${i.currentValue ?? 0}</span> • Cost: ${i.purchasePrice ?? 0}
                        </>
                      }
                    />
                  ))}
                </ShelfRow>
              ))}
            </GalleryWall>
          </section>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-[color:var(--surface-strong)] ring-1 ring-[color:var(--border)]"
            style={{
              transform: `translateY(${dragY}px)`,
              transition: dragging ? "none" : "transform 180ms ease",
            }}
          >
            <div
              className="border-b border-[color:var(--border)] px-5 py-4 sm:px-6"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/15" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs tracking-widest text-[color:var(--muted2)]">NEW ITEM</div>
                  <div className="mt-1 text-lg font-semibold">Add to Museum</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {tier === "FREE" ? "Free tier uploads save optimized images." : "Paid tier saves full-quality images."}{" "}
                    <span className="text-[color:var(--muted2)]">ESC closes • Drag down to dismiss</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div title="Scan (coming soon)">
                    <PillButton onClick={onScan}>Scan</PillButton>
                  </div>
                  <div title="Close">
                    <PillButton onClick={closeModal}>✕</PillButton>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    Bulk Add
                    {!bulkAllowed && (
                      <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] tracking-widest text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                        PAID
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {bulkAllowed
                      ? "When enabled, Save keeps the modal open. Locks will keep fields for the next item."
                      : "Paid feature. Switch to Paid on /user to enable bulk entry and locks."}
                  </div>
                </div>

                <div title={bulkAllowed ? "Toggle Bulk Add" : "Paid feature"}>
                  <PillButton
                    variant={bulkAllowed && bulkEnabled ? "primary" : "default"}
                    disabled={!bulkAllowed}
                    onClick={() => {
                      if (!bulkAllowed) return;
                      setBulkEnabled((v) => !v);
                    }}
                  >
                    {bulkAllowed ? (bulkEnabled ? "Bulk: On" : "Bulk: Off") : "Bulk: Locked"}
                  </PillButton>
                </div>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-5">
                <div className="rounded-3xl vltd-panel-soft bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs tracking-widest text-[color:var(--muted2)]">PHOTOS</div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">Click or drag images into the tiles.</div>
                    </div>
                    <div className="text-xs text-[color:var(--muted2)]">{bulkAllowed && bulkEnabled ? "Bulk mode" : ""}</div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <PhotoTile
                      label="Front"
                      value={frontUrl ?? (useGenericFront ? genericCoverDataUri("Front") : undefined)}
                      tier={tier}
                      onPick={async (f) => {
                        await onPickFront(f);
                      }}
                      onClear={() => {
                        setFrontUrl(undefined);
                        setUseGenericFront(false);
                      }}
                    />

                    <PhotoTile
                      label="Back"
                      value={backUrl ?? (useGenericBack ? genericCoverDataUri("Back") : undefined)}
                      tier={tier}
                      onPick={async (f) => {
                        await onPickBack(f);
                      }}
                      onClear={() => {
                        setBackUrl(undefined);
                        setUseGenericBack(false);
                      }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton
                      onClick={() => {
                        setUseGenericFront(true);
                        setFrontUrl(undefined);
                      }}
                    >
                      Use generic front
                    </PillButton>
                    <PillButton
                      onClick={() => {
                        setUseGenericBack(true);
                        setBackUrl(undefined);
                      }}
                    >
                      Use generic back
                    </PillButton>
                  </div>
                </div>

                <div className="rounded-3xl vltd-panel-soft bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                  <div className="text-sm font-semibold">Title</div>
                  <input
                    ref={titleInputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Amazing Spider-Man #300"
                    className="mt-3 min-h-[44px] w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] focus:outline-none"
                  />
                  <div className="mt-2 text-xs text-[color:var(--muted2)]">
                    Tip: For the premium capture flow, use <span className="font-semibold">Quick Add</span>.
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <PillButton onClick={closeModal}>Cancel</PillButton>

                <div className="flex items-center gap-2">
                  {bulkAllowed && bulkEnabled && (
                    <div className="hidden text-xs text-[color:var(--muted2)] sm:block">Bulk mode: stays open after save</div>
                  )}

                  <button
                    onClick={saveNewItem}
                    disabled={!newTitle.trim()}
                    className={[
                      "min-h-[44px] rounded-xl px-4 py-2 text-[16px] font-semibold sm:text-sm",
                      newTitle.trim()
                        ? "bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)] hover:opacity-95"
                        : "cursor-not-allowed bg-[color:var(--pill)] text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]",
                    ].join(" ")}
                    type="button"
                  >
                    {bulkAllowed && bulkEnabled ? "Save + Next" : "Save Item"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}