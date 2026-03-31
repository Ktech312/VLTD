// Path: src/components/ApplyStyleGallery.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type ThemeMode = "system" | "dark" | "light";
type Palette = "mirror" | "purple";

const LS_THEME_MODE = "vltd_theme_mode";
const LS_PALETTE = "vltd_palette";

const THEME_EVENT = "vltd:theme";
const PALETTE_EVENT = "vltd:palette";

function getSystemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = getSystemPrefersDark();
  const shouldBeDark = mode === "dark" ? true : mode === "light" ? false : prefersDark;
  root.classList.toggle("dark", !!shouldBeDark);
}

function applyPalette(palette: Palette) {
  const root = document.documentElement;
  root.classList.remove("theme-mirror", "theme-purple");
  root.classList.add(palette === "purple" ? "theme-purple" : "theme-mirror");
}

function readThemeMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(LS_THEME_MODE) as ThemeMode | null;
    return v === "system" || v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

function readPalette(): Palette {
  try {
    const v = window.localStorage.getItem(LS_PALETTE) as Palette | null;
    return v === "purple" || v === "mirror" ? v : "mirror";
  } catch {
    return "mirror";
  }
}

function setAndApply(themeMode: ThemeMode, palette: Palette) {
  window.localStorage.setItem(LS_THEME_MODE, themeMode);
  window.localStorage.setItem(LS_PALETTE, palette);

  applyThemeMode(themeMode);
  applyPalette(palette);

  window.dispatchEvent(new Event(THEME_EVENT));
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

function sampleMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full px-3 py-1 text-xs text-[color:var(--fg)] ring-1 ring-[color:var(--border)] bg-[color:var(--pill)]">
      {children}
    </div>
  );
}

function PreviewCard({
  active,
  title,
  subtitle,
  onApply,
  children,
}: {
  active?: boolean;
  title: string;
  subtitle: string;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onApply}
      className={[
        "group w-full text-left rounded-3xl p-3.5 sm:p-4 transition",
        "ring-1 shadow-[var(--shadow-soft)]",
        active
          ? "vltd-panel-main bg-[color:var(--surface)] ring-[color:var(--pill-active-ring)]"
          : "vltd-panel-soft bg-[color:var(--surface)] ring-[color:var(--border)] hover:ring-[color:var(--border-strong)]",
        "active:scale-[0.995]",
      ].join(" ")}
      aria-pressed={!!active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</div>
        </div>

        <div
          className={[
            "shrink-0 rounded-full px-3 py-1 text-xs ring-1 transition",
            active
              ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow"
              : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)] group-hover:bg-[color:var(--pill-hover)]",
          ].join(" ")}
        >
          Apply
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </button>
  );
}

function MiniShell() {
  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[color:var(--surface)]/90 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-[color:var(--pill)] ring-1 ring-[color:var(--border)] overflow-hidden grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/vltd-logo.png" alt="VLTD" className="h-8 w-8 object-contain p-1" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">VLTD</div>
            <div className="text-[10px] text-[color:var(--muted2)] truncate">Digital Vault</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="h-8 w-8 rounded-full bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]" />
          <div className="h-8 w-8 rounded-full bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]" />
        </div>
      </div>

      <div className="p-3 bg-[color:var(--bg)]">
        <div className="rounded-2xl p-3 bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-widest text-[color:var(--muted2)]">PORTFOLIO</div>
              <div className="mt-1 text-sm font-semibold">Today</div>
            </div>
            <div className="rounded-full px-3 py-1 text-xs bg-[color:var(--accent)] text-white">
              {sampleMoney(12850)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip>Comics</Chip>
            <Chip>TCG</Chip>
            <Chip>Graded</Chip>
            <Chip>High ROI</Chip>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-black/10 dark:bg-white/10 h-10 ring-1 ring-[color:var(--border)]" />
            <div className="rounded-xl bg-black/10 dark:bg-white/10 h-10 ring-1 ring-[color:var(--border)]" />
            <div className="rounded-xl bg-black/10 dark:bg-white/10 h-10 ring-1 ring-[color:var(--border)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ApplyStyleGallery() {
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [palette, setPalette] = useState<Palette>("mirror");

  useEffect(() => {
    setMounted(true);
    setThemeMode(readThemeMode());
    setPalette(readPalette());
  }, []);

  const combos = useMemo(
    () =>
      [
        { themeMode: "system" as const, palette: "mirror" as const, title: "System + Mirror", subtitle: "Cyan-forward, reacts to device theme." },
        { themeMode: "system" as const, palette: "purple" as const, title: "System + Purple Rain", subtitle: "Violet-forward, reacts to device theme." },
        { themeMode: "dark" as const, palette: "mirror" as const, title: "Dark + Mirror", subtitle: "Always dark, cyan primary." },
        { themeMode: "dark" as const, palette: "purple" as const, title: "Dark + Purple Rain", subtitle: "Always dark, violet primary." },
        { themeMode: "light" as const, palette: "mirror" as const, title: "Light + Mirror", subtitle: "Always light, cyan primary." },
        { themeMode: "light" as const, palette: "purple" as const, title: "Light + Purple Rain", subtitle: "Always light, violet primary." },
      ] as const,
    []
  );

  function isActive(t: ThemeMode, p: Palette) {
    return themeMode === t && palette === p;
  }

  if (!mounted) return null;

  return (
    <div className="grid gap-3">
      <div className="vltd-panel-main rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
        <div className="text-xs tracking-widest text-[color:var(--muted2)]">APPLY STYLE</div>
        <div className="mt-2 text-2xl sm:text-3xl font-semibold">Style Gallery</div>
        <div className="mt-2 text-sm text-[color:var(--muted)]">
          Tap a preset to apply instantly. This is how we iterate fast without refactoring UI every time.
        </div>


      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {combos.map((c) => (
          <PreviewCard
            key={`${c.themeMode}-${c.palette}`}
            active={isActive(c.themeMode, c.palette)}
            title={c.title}
            subtitle={c.subtitle}
            onApply={() => {
              setThemeMode(c.themeMode);
              setPalette(c.palette);
              setAndApply(c.themeMode, c.palette);
            }}
          >
            <MiniShell />
          </PreviewCard>
        ))}
      </div>

      <div className="vltd-panel-soft rounded-3xl bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
        <div className="text-sm font-semibold">Premium polish checklist (what we’ll do next)</div>
        <ul className="mt-2 text-sm text-[color:var(--muted)] list-disc pl-5 space-y-1">
          <li>Subtle motion everywhere: hover/press/focus transitions, skeleton loaders, route transitions tuned.</li>
          <li>Consistent spacing scale: 8px grid, fewer “random” paddings, tighter dense views.</li>
          <li>Premium surfaces: fewer heavy outlines, more depth with soft shadows + glass topnav.</li>
          <li>Icon system: minimalist gold set for UI + engraved for brand/hero/print.</li>
        </ul>
      </div>
    </div>
  );
}