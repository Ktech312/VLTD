"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { fetchActiveThemes, type SeasonalTheme } from "@/lib/seasonalTheme";

const ROTATE_MS = 35_000; // rotate every 35 seconds
const THEME_PREF_KEY = "vltd_theme_overrides"; // map of slug → accepted/dismissed

function getThemePrefs(): Record<string, "accepted" | "dismissed"> {
  try { return JSON.parse(localStorage.getItem(THEME_PREF_KEY) ?? "{}"); } catch { return {}; }
}
function setThemePref(slug: string, val: "accepted" | "dismissed") {
  try {
    const prefs = getThemePrefs();
    localStorage.setItem(THEME_PREF_KEY, JSON.stringify({ ...prefs, [slug]: val }));
  } catch {}
}
function applyThemeVars(theme: SeasonalTheme) {
  const root = document.documentElement;
  if (theme.accent_color)     root.style.setProperty("--seasonal-accent", theme.accent_color);
  if (theme.accent_secondary) root.style.setProperty("--seasonal-accent-secondary", theme.accent_secondary);
  if (theme.bg_tint)          root.style.setProperty("--seasonal-bg-tint", theme.bg_tint);
  root.setAttribute("data-seasonal", theme.slug);
}
function clearThemeVars() {
  const root = document.documentElement;
  root.style.removeProperty("--seasonal-accent");
  root.style.removeProperty("--seasonal-accent-secondary");
  root.style.removeProperty("--seasonal-bg-tint");
  root.removeAttribute("data-seasonal");
}

export default function SeasonalBanner() {
  const [themes, setThemes] = useState<SeasonalTheme[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true); // for crossfade
  const [themePrefs, setThemePrefs] = useState<Record<string, "accepted" | "dismissed">>({});

  useEffect(() => {
    fetchActiveThemes().then((all) => {
      const bannerThemes = all.filter((t) => t.banner_enabled);
      setThemes(bannerThemes);
      setThemePrefs(getThemePrefs());
      // Apply theme for slug if user already accepted it
      const prefs = getThemePrefs();
      bannerThemes.forEach((t) => {
        if (prefs[t.slug] === "accepted") applyThemeVars(t);
      });
    });
  }, []);

  // Rotate every 35s with a brief fade
  useEffect(() => {
    if (themes.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % themes.length);
        setVisible(true);
      }, 400);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [themes.length]);

  const theme = themes[idx];
  if (!theme) return null;

  const accent = theme.accent_color ?? "#E8B84B";
  const secondary = theme.accent_secondary ?? "#1a1a2e";
  const pref = themePrefs[theme.slug];
  const showThemePrompt = theme.accent_color && !pref;

  function handleAcceptTheme() {
    applyThemeVars(theme);
    setThemePref(theme.slug, "accepted");
    setThemePrefs((p) => ({ ...p, [theme.slug]: "accepted" }));
  }
  function handleDismissTheme() {
    setThemePref(theme.slug, "dismissed");
    setThemePrefs((p) => ({ ...p, [theme.slug]: "dismissed" }));
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-4 transition-opacity duration-400"
      style={{
        background: `linear-gradient(135deg, ${secondary}cc, ${accent}33)`,
        border: `1px solid ${accent}44`,
        opacity: visible ? 1 : 0,
      }}
    >
      <SeasonalAccents style={theme.accent_style} color={accent} />

      {/* Dot indicators if multiple banners */}
      {themes.length > 1 && (
        <div className="absolute top-2 right-3 flex gap-1 z-20">
          {themes.map((_, i) => (
            <button
              key={i}
              onClick={() => { setVisible(false); setTimeout(() => { setIdx(i); setVisible(true); }, 300); }}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                background: i === idx ? accent : `${accent}55`,
              }}
              aria-label={`Show banner ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Main banner content */}
      <div className="relative z-10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {theme.banner_emoji && (
              <span className="text-3xl flex-shrink-0">{theme.banner_emoji}</span>
            )}
            <div className="min-w-0">
              {theme.banner_heading && (
                <p className="font-bold text-white text-sm leading-tight truncate">
                  {theme.banner_heading}
                </p>
              )}
              {theme.banner_subtext && (
                <p className="text-xs mt-0.5 leading-snug" style={{ color: `${accent}cc` }}>
                  {theme.banner_subtext}
                </p>
              )}
            </div>
          </div>

          {theme.banner_cta_label && theme.banner_cta_href && (
            <Link
              href={theme.banner_cta_href}
              className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90"
              style={{ background: accent, color: "#000" }}
            >
              {theme.banner_cta_label}
            </Link>
          )}
        </div>

        {/* Optional theme prompt — not forced */}
        {showThemePrompt && (
          <div
            className="mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{ background: `${secondary}88`, border: `1px solid ${accent}33` }}
          >
            <p className="text-xs" style={{ color: `${accent}cc` }}>
              🎨 Change your app theme for this event?
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleAcceptTheme}
                className="rounded-full px-3 py-1 text-[11px] font-bold transition hover:opacity-90"
                style={{ background: accent, color: "#000" }}
              >
                Yes, switch
              </button>
              <button
                onClick={handleDismissTheme}
                className="rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: `${accent}22`, color: `${accent}cc` }}
              >
                No thanks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonalAccents({ style, color }: { style: string; color: string }) {
  if (style === "snowflakes") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        {["10%","25%","45%","65%","80%","92%"].map((left, i) => (
          <span key={i} className="absolute text-lg animate-bounce"
            style={{ left, top: `${(i*17)%70}%`, animationDelay: `${i*0.3}s` }}>❄️</span>
        ))}
      </div>
    );
  }
  if (style === "confetti") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {["8%","20%","35%","55%","70%","85%"].map((left, i) => (
          <span key={i} className="absolute text-sm animate-pulse"
            style={{ left, top: `${(i*20)%80}%`, animationDelay: `${i*0.2}s` }}>
            {["🟩","🟦","🟨","⚽","🏆","⚽"][i]}
          </span>
        ))}
      </div>
    );
  }
  if (style === "leaves") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
        {["5%","22%","40%","60%","78%","90%"].map((left, i) => (
          <span key={i} className="absolute animate-pulse"
            style={{ left, top: `${(i*15)%75}%`, animationDelay: `${i*0.4}s` }}>
            {["🍂","🍁","🎃","🍂","🍁","🎃"][i]}
          </span>
        ))}
      </div>
    );
  }
  if (style === "stars") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        {["12%","30%","50%","68%","84%"].map((left, i) => (
          <span key={i} className="absolute animate-ping"
            style={{ left, top: `${(i*20)%70}%`, animationDelay: `${i*0.5}s`, color }}>✦</span>
        ))}
      </div>
    );
  }
  return null;
}
