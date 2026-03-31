// Path: src/app/user/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";

import { DEMO_ITEMS } from "@/lib/demoVault";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { loadItemsOrSeed, saveItems, type VaultItem as ModelItem } from "@/lib/vaultModel";
import {
  MUSEUM_BG_EVENT,
  clearMuseumBackground,
  getMuseumBackground,
  saveMuseumBackgroundImage,
  saveMuseumBackgroundMode,
  type MuseumBackgroundMode,
} from "@/lib/museumBackground";

type ThemeMode = "system" | "dark" | "light";
type Palette = "mirror" | "purple";
type RankMode = "gain" | "value";
type Tier = "FREE" | "MID" | "FULL";

const LS_THEME_MODE = "vltd_theme_mode";
const LS_PALETTE = "vltd_palette";
const LS_RANK_MODE = "vltd_rank_mode";
const LS_TIER = "vltd_tier";

// Custom events
const THEME_EVENT = "vltd:theme";
const PALETTE_EVENT = "vltd:palette";
const TIER_EVENT = "vltd:tier";

function applyThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldBeDark = mode === "dark" ? true : mode === "light" ? false : prefersDark;

  root.classList.toggle("dark", shouldBeDark);
}

function applyPalette(palette: Palette) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  root.classList.remove("theme-mirror");
  root.classList.remove("theme-purple");
  root.classList.add(palette === "purple" ? "theme-purple" : "theme-mirror");
}

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function gain(i: ModelItem) {
  return clamp(Number(i.currentValue ?? 0)) - clamp(Number(i.purchasePrice ?? 0));
}

function csvEscape(value: any) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function getCreatedAtMs(i: any): number {
  const v = i?.createdAt;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof i?.id === "string") {
    const n = Number(i.id);
    if (Number.isFinite(n) && n > 1_000_000_000) return n;
  }
  return Date.now();
}

function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "2-digit" });
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
  })) as ModelItem[];
}

function buildInsuranceCsv(items: ModelItem[]) {
  const header = [
    "Item ID",
    "Title",
    "Subtitle",
    "Number",
    "Grade",
    "Universe",
    "Category",
    "Subcategory",
    "Purchase Price",
    "Current Value",
    "Gain",
    "Date Added",
    "Notes",
    "Front Image",
    "Back Image",
  ];

  const rows = items.map((i) => {
    const u = (i.universe ?? "MISC") as UniverseKey;
    const created = fmtMonthDay(getCreatedAtMs(i as any));

    return [
      i.id,
      i.title ?? "",
      i.subtitle ?? "",
      i.number ?? "",
      i.grade ?? "",
      UNIVERSE_LABEL[u] ?? String(u),
      (i as any).categoryLabel ??
        (i.category === "CUSTOM" ? i.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice"),
      (i as any).subcategoryLabel ?? "",
      clamp(Number(i.purchasePrice ?? 0)),
      clamp(Number(i.currentValue ?? 0)),
      gain(i),
      created,
      i.notes ?? "",
      i.imageFrontUrl ?? "",
      i.imageBackUrl ?? "",
    ].map(csvEscape);
  });

  return [header.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

async function optimizeMuseumBackground(file: File): Promise<string> {
  const original = await fileToDataUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 2200;
      const maxH = 2200;
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
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        resolve(original);
      }
    };

    img.onerror = () => resolve(original);
    img.src = original;
  });
}

export default function UserSettingsPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [palette, setPalette] = useState<Palette>("mirror");
  const [rankMode, setRankMode] = useState<RankMode>("gain");
  const [tier, setTier] = useState<Tier>("FREE");

  const [items, setItems] = useState<ModelItem[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const museumBgRef = useRef<HTMLInputElement | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [generatedAtLabel, setGeneratedAtLabel] = useState<string>("");

  const [museumBackgroundImage, setMuseumBackgroundImage] = useState<string | undefined>(undefined);
  const [museumBackgroundMode, setMuseumBackgroundMode] = useState<MuseumBackgroundMode>("cover");
  const [draftMuseumBackgroundMode, setDraftMuseumBackgroundMode] = useState<MuseumBackgroundMode>("cover");
  const [museumModeDirty, setMuseumModeDirty] = useState(false);

  useEffect(() => {
    const d = new Date();
    setGeneratedAtLabel(d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const t = window.localStorage.getItem(LS_THEME_MODE) as ThemeMode | null;
    const p = window.localStorage.getItem(LS_PALETTE) as Palette | null;
    const r = window.localStorage.getItem(LS_RANK_MODE) as RankMode | null;
    const v = window.localStorage.getItem(LS_TIER) as Tier | null;

    if (t === "system" || t === "dark" || t === "light") setThemeMode(t);
    if (p === "mirror" || p === "purple") setPalette(p);
    if (r === "gain" || r === "value") setRankMode(r);
    if (v === "FREE" || v === "MID" || v === "FULL") setTier(v);
    else if (v === "PREMIUM") setTier("FULL");

    const bg = getMuseumBackground();
    setMuseumBackgroundImage(bg.image);
    setMuseumBackgroundMode(bg.mode);
    setDraftMuseumBackgroundMode(bg.mode);

    const seed = toSeedItemsFromDemo();
    const loaded = loadItemsOrSeed(seed);
    setItems(loaded);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;

    window.localStorage.setItem(LS_THEME_MODE, themeMode);
    applyThemeMode(themeMode);
    window.dispatchEvent(new Event(THEME_EVENT));

    if (themeMode !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [themeMode, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;

    window.localStorage.setItem(LS_PALETTE, palette);
    applyPalette(palette);
    window.dispatchEvent(new Event(PALETTE_EVENT));
  }, [palette, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    window.localStorage.setItem(LS_RANK_MODE, rankMode);
  }, [rankMode, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    window.localStorage.setItem(LS_TIER, tier);
    window.dispatchEvent(new Event(TIER_EVENT));
  }, [tier, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncBackground = () => {
      const next = getMuseumBackground();
      setMuseumBackgroundImage(next.image);
      setMuseumBackgroundMode(next.mode);
      setDraftMuseumBackgroundMode(next.mode);
      setMuseumModeDirty(false);
    };

    window.addEventListener(MUSEUM_BG_EVENT, syncBackground);
    return () => window.removeEventListener(MUSEUM_BG_EVENT, syncBackground);
  }, []);

  const totals = useMemo(() => {
    const cost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
    const value = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);
    const g = value - cost;
    const roi = cost > 0 ? (g / cost) * 100 : 0;
    return { cost, value, gain: g, roi };
  }, [items]);

  function exportInsuranceCsv() {
    const csv = buildInsuranceCsv(items);
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(`VLTD_Insurance_Inventory_${today}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportJsonBackup() {
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(`VLTD_Backup_${today}.json`, JSON.stringify({ items }, null, 2), "application/json;charset=utf-8");
  }

  async function onImportBackup(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const nextItems = Array.isArray(parsed?.items) ? (parsed.items as ModelItem[]) : null;
      if (!nextItems) {
        alert("That file doesn’t look like a VLTD backup.");
        return;
      }

      saveItems(nextItems);
      setItems(nextItems);
      alert("Backup restored.");
    } catch {
      alert("Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onImportMuseumBackground(file: File | null) {
    if (!file) return;

    try {
      const url = await optimizeMuseumBackground(file);
      saveMuseumBackgroundImage(url);
      saveMuseumBackgroundMode(draftMuseumBackgroundMode);
      setMuseumBackgroundImage(url);
      setMuseumBackgroundMode(draftMuseumBackgroundMode);
      setMuseumModeDirty(false);
    } catch {
      alert("Could not read that image.");
    } finally {
      if (museumBgRef.current) museumBgRef.current.value = "";
    }
  }

  function onSelectMuseumMode(mode: MuseumBackgroundMode) {
    setDraftMuseumBackgroundMode(mode);
    setMuseumModeDirty(mode !== museumBackgroundMode);
  }

  function onSaveMuseumMode() {
    saveMuseumBackgroundMode(draftMuseumBackgroundMode);
    setMuseumBackgroundMode(draftMuseumBackgroundMode);
    setMuseumModeDirty(false);
  }

  function onRemoveMuseumBackground() {
    clearMuseumBackground();
    setMuseumBackgroundImage(undefined);
    setMuseumBackgroundMode("cover");
    setDraftMuseumBackgroundMode("cover");
    setMuseumModeDirty(false);
  }

  const previewMode = draftMuseumBackgroundMode;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">USER</div>
            <h1 className="mt-2 text-4xl font-semibold">Settings</h1>
            <div className="mt-2 text-sm text-[color:var(--muted)]">Theme, tier, ranking, exports, and museum background.</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/vault"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
            >
              Back to Museum
            </Link>

            <Link
              href="/portfolio"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
            >
              Portfolio
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Theme</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">Local theme preference.</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton variant={themeMode === "system" ? "active" : "default"} onClick={() => setThemeMode("system")}>
                System
              </PillButton>
              <PillButton variant={themeMode === "dark" ? "active" : "default"} onClick={() => setThemeMode("dark")}>
                Dark
              </PillButton>
              <PillButton variant={themeMode === "light" ? "active" : "default"} onClick={() => setThemeMode("light")}>
                Light
              </PillButton>
            </div>
          </section>

          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Color Palette</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">Neon Mirror vs Neon Purple Rain.</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton variant={palette === "mirror" ? "active" : "default"} onClick={() => setPalette("mirror")}>
                Mirror
              </PillButton>
              <PillButton variant={palette === "purple" ? "active" : "default"} onClick={() => setPalette("purple")}>
                Purple Rain
              </PillButton>

              <Link
                href="/user/style"
                className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 transition select-none bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)] active:scale-[0.98] sm:h-10"
              >
                Style Gallery →
              </Link>
            </div>
          </section>

          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Museum Background</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Upload your own gallery wall image for the Museum page. PNG, JPG, and WEBP work well.
            </div>

            <div className="mt-2 text-xs text-[color:var(--muted2)]">
              Recommended size: <span className="font-semibold text-[color:var(--fg)]">1920×1080 (best)</span> • minimum
              <span className="font-semibold text-[color:var(--fg)]"> 1600×900</span>. Dark wide images work best.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton variant="active" onClick={() => museumBgRef.current?.click()}>
                Upload Image
              </PillButton>

              {museumBackgroundImage ? (
                <PillButton onClick={onRemoveMuseumBackground}>Remove Background</PillButton>
              ) : null}

              <input
                ref={museumBgRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onImportMuseumBackground(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-3xl bg-[color:var(--input)] ring-1 ring-[color:var(--border)]">
                <div className="border-b border-[color:var(--border)] px-4 py-3 text-xs tracking-widest text-[color:var(--muted2)]">
                  PREVIEW
                </div>

                <div className="p-4">
                  <div
                    className="relative overflow-hidden rounded-[24px] bg-black"
                    style={{
                      aspectRatio: "16 / 10",
                      backgroundColor: "#05070b",
                      backgroundImage: museumBackgroundImage ? `url(${museumBackgroundImage})` : undefined,
                      backgroundPosition: "center center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: previewMode === "contain" ? "contain" : "cover",
                    }}
                  >
                    {!museumBackgroundImage ? (
                      <div className="grid h-full w-full place-items-center">
                        <div className="text-center">
                          <div className="text-sm font-medium text-white/90">No museum background uploaded</div>
                          <div className="mt-1 text-xs text-white/55">Upload a wall image to preview it here</div>
                        </div>
                      </div>
                    ) : null}

                    <div className="pointer-events-none absolute inset-x-[8%] bottom-[12%] h-[1px] rounded-full bg-white/35" />
                    <div className="pointer-events-none absolute inset-x-[7%] bottom-[9.5%] h-[12px] rounded-full bg-[linear-gradient(180deg,rgba(204,212,224,0.92)_0%,rgba(102,111,123,0.92)_45%,rgba(29,33,39,0.98)_100%)] shadow-[0_10px_16px_rgba(0,0,0,0.45)]" />
                    <div className="pointer-events-none absolute inset-x-[10%] bottom-[5%] h-[10px] rounded-full bg-white/8 blur-xl" />

                    <div className="pointer-events-none absolute left-[16%] bottom-[13%] h-[34%] w-[18%] rounded-[18px] border border-white/10 bg-black/20 shadow-[0_18px_28px_rgba(0,0,0,0.50)] backdrop-blur-[1px]" />
                    <div className="pointer-events-none absolute left-[41%] bottom-[13%] h-[36%] w-[18%] rounded-[18px] border border-white/10 bg-black/20 shadow-[0_18px_28px_rgba(0,0,0,0.50)] backdrop-blur-[1px]" />
                    <div className="pointer-events-none absolute left-[66%] bottom-[13%] h-[33%] w-[18%] rounded-[18px] border border-white/10 bg-black/20 shadow-[0_18px_28px_rgba(0,0,0,0.50)] backdrop-blur-[1px]" />
                  </div>
                </div>
              </div>

              <div className="vltd-panel-soft rounded-3xl bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
                <div className="text-sm font-semibold">Display Mode</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Fill Wall crops to fit edge-to-edge. Show Full Image keeps the whole image visible.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <PillButton
                    variant={draftMuseumBackgroundMode === "cover" ? "active" : "default"}
                    onClick={() => onSelectMuseumMode("cover")}
                  >
                    Fill Wall
                  </PillButton>

                  <PillButton
                    variant={draftMuseumBackgroundMode === "contain" ? "active" : "default"}
                    onClick={() => onSelectMuseumMode("contain")}
                  >
                    Show Full Image
                  </PillButton>

                  <PillButton
                    variant={museumModeDirty ? "active" : "default"}
                    disabled={!museumModeDirty}
                    onClick={onSaveMuseumMode}
                  >
                    Save
                  </PillButton>
                </div>

                <div className="mt-4 text-xs text-[color:var(--muted2)]">
                  Saved mode:{" "}
                  <span className="font-semibold text-[color:var(--fg)]">
                    {museumBackgroundMode === "contain" ? "Show Full Image" : "Fill Wall"}
                  </span>
                  {museumModeDirty ? (
                    <span className="ml-2 text-amber-300">• unsaved changes</span>
                  ) : (
                    <span className="ml-2 text-emerald-300">• saved</span>
                  )}
                </div>

                <div className="mt-5 text-xs text-[color:var(--muted2)]">
                  Best results: use a wide, dark gallery wall image with shelves or lighting already baked in.
                </div>
              </div>
            </div>
          </section>

          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Subscription Tier</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Free supports core collecting. Mid unlocks more galleries and storage controls. Full removes limits.
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <div className="text-sm">
                Current tier:{" "}
                <span className="font-semibold">
                  {tier === "FULL" ? "Full" : tier === "MID" ? "Mid" : "Free"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <PillButton variant={tier === "FREE" ? "active" : "default"} onClick={() => setTier("FREE")}>
                  Free
                </PillButton>

                <PillButton variant={tier === "MID" ? "active" : "default"} onClick={() => setTier("MID")}>
                  Mid
                </PillButton>

                <PillButton variant={tier === "FULL" ? "active" : "default"} onClick={() => setTier("FULL")}>
                  Full
                </PillButton>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-xs tracking-[0.18em] text-[color:var(--muted2)]">FREE</div>
                  <div className="mt-2 text-sm font-semibold">Core collecting</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    Up to 5 galleries. One gallery may be placed in storage for the first 90 days.
                  </div>
                </div>

                <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-xs tracking-[0.18em] text-[color:var(--muted2)]">MID</div>
                  <div className="mt-2 text-sm font-semibold">Expanded showcasing</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    Up to 25 galleries. Galleries can be paused into storage and reactivated later.
                  </div>
                </div>

                <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-xs tracking-[0.18em] text-[color:var(--muted2)]">FULL</div>
                  <div className="mt-2 text-sm font-semibold">Unlimited presentation</div>
                  <div className="mt-2 text-xs text-[color:var(--muted)]">
                    Unlimited galleries, unlimited storage, and full public/private sharing flexibility.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Ranking</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">Controls ranking on Home + Portfolio.</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton variant={rankMode === "gain" ? "active" : "default"} onClick={() => setRankMode("gain")}>
                Gain ($)
              </PillButton>
              <PillButton variant={rankMode === "value" ? "active" : "default"} onClick={() => setRankMode("value")}>
                Value ($)
              </PillButton>
            </div>
          </section>

          <section className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-sm font-semibold">Export + Backup</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Insurance inventory + backups. {generatedAtLabel ? `Generated ${generatedAtLabel} • ` : ""}
              {items.length} items • ROI {totals.cost > 0 ? `${((totals.gain / totals.cost) * 100).toFixed(1)}%` : "0.0%"}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton variant="active" onClick={exportInsuranceCsv}>
                Download Insurance CSV
              </PillButton>

              <PillButton onClick={exportJsonBackup}>Download Backup (JSON)</PillButton>

              <PillButton onClick={() => fileRef.current?.click()}>Restore Backup (JSON)</PillButton>

              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => onImportBackup(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="mt-3 text-xs text-[color:var(--muted2)]">
              Tip: Download a backup before big changes. Insurance CSV is spreadsheet-friendly.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}