"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { fetchActiveThemes, type SeasonalTheme } from "@/lib/seasonalTheme";

const ROTATE_MS = 35_000;
const THEME_PREF_KEY = "vltd_theme_overrides";

// Color map for collector events by slug
const EVENT_COLOR_MAP: Record<string, { accent: string; secondary: string }> = {
  "sd-card-show-june-2026":                    { accent: "#52c27a", secondary: "#0a1f12" },
  "national-sports-collectors-convention-2026": { accent: "#F5A623", secondary: "#1c1000" },
  "san-diego-comic-con-2026":                  { accent: "#c084fc", secondary: "#160d26" },
  "namm-show-2026":                            { accent: "#2DD4BF", secondary: "#061a19" },
};
const DEFAULT_EVENT_COLORS = { accent: "#F5B548", secondary: "#1a1200" };

type CollectorEvent = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
};

type Slide =
  | { type: "theme"; theme: SeasonalTheme }
  | { type: "event"; event: CollectorEvent };

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

function getEventCountdown(event: CollectorEvent): string {
  const now = new Date();
  const starts = new Date(event.starts_at);
  const ends = new Date(event.ends_at);

  if (now >= starts && now <= ends) return "Happening now!";

  const diffMs = starts.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const locationSuffix = event.location ? ` — ${event.location}` : "";

  if (diffDays <= 2) return `This weekend!${locationSuffix}`;
  return `Starts in ${diffDays} day${diffDays !== 1 ? "s" : ""}${locationSuffix}`;
}

export default function SeasonalBanner() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [themePrefs, setThemePrefs] = useState<Record<string, "accepted" | "dismissed">>({});

  useEffect(() => {
    async function loadSlides() {
      // Load seasonal themes
      const allThemes = await fetchActiveThemes();
      const bannerThemes = allThemes.filter((t) => t.banner_enabled);

      // Apply accepted theme vars
      const prefs = getThemePrefs();
      setThemePrefs(prefs);
      bannerThemes.forEach((t) => {
        if (prefs[t.slug] === "accepted") applyThemeVars(t);
      });

      // Load upcoming collector events
      const supabase = getSupabaseBrowserClient();
      let events: CollectorEvent[] = [];
      if (supabase) {
        const now = new Date().toISOString();
        const { data } = await supabase
          .from("collector_events")
          .select("id, slug, name, emoji, starts_at, ends_at, location")
          .gte("ends_at", now)
          .order("starts_at", { ascending: true })
          .limit(10);
        events = (data ?? []) as CollectorEvent[];
      }

      // Merge: seasonal themes first, then events
      const combined: Slide[] = [
        ...bannerThemes.map((t): Slide => ({ type: "theme", theme: t })),
        ...events.map((e): Slide => ({ type: "event", event: e })),
      ];
      setSlides(combined);
    }
    void loadSlides();
  }, []);

  // Rotate every 35s with fade
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % slides.length);
        setVisible(true);
      }, 400);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[idx];
  if (!slide) return null;

  // Get colors for current slide
  let accent: string;
  let secondary: string;
  if (slide.type === "theme") {
    accent = slide.theme.accent_color ?? "#E8B84B";
    secondary = slide.theme.accent_secondary ?? "#1a1a2e";
  } else {
    const colors = EVENT_COLOR_MAP[slide.event.slug] ?? DEFAULT_EVENT_COLORS;
    accent = colors.accent;
    secondary = colors.secondary;
  }

  // Theme-specific handlers
  let showThemePrompt = false;
  let handleAcceptTheme = () => {};
  let handleDismissTheme = () => {};

  if (slide.type === "theme") {
    const theme = slide.theme;
    const pref = themePrefs[theme.slug];
    showThemePrompt = !!(theme.accent_color && !pref);
    handleAcceptTheme = () => {
      applyThemeVars(theme);
      setThemePref(theme.slug, "accepted");
      setThemePrefs((p) => ({ ...p, [theme.slug]: "accepted" }));
    };
    handleDismissTheme = () => {
      setThemePref(theme.slug, "dismissed");
      setThemePrefs((p) => ({ ...p, [theme.slug]: "dismissed" }));
    };
  }

  function jumpTo(i: number) {
    setVisible(false);
    setTimeout(() => { setIdx(i); setVisible(true); }, 300);
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background: `linear-gradient(135deg, ${secondary}cc, ${accent}33)`,
        border: `1px solid ${accent}44`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Accent decorations for seasonal themes */}
      {slide.type === "theme" && (
        <SeasonalAccents style={slide.theme.accent_style} color={accent} />
      )}

      {/* Dot indicators — bottom-right, only if multiple slides */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-3 flex gap-1 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
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
        {slide.type === "theme" ? (
          // Seasonal theme slide
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {slide.theme.banner_emoji && (
                  <span className="text-3xl flex-shrink-0">{slide.theme.banner_emoji}</span>
                )}
                <div className="min-w-0">
                  {slide.theme.banner_heading && (
                    <p className="font-bold text-white text-sm leading-tight truncate">
                      {slide.theme.banner_heading}
                    </p>
                  )}
                  {slide.theme.banner_subtext && (
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: `${accent}cc` }}>
                      {slide.theme.banner_subtext}
                    </p>
                  )}
                </div>
              </div>
              {slide.theme.banner_cta_label && slide.theme.banner_cta_href && (
                <Link
                  href={slide.theme.banner_cta_href}
                  className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90"
                  style={{ background: accent, color: "#000" }}
                >
                  {slide.theme.banner_cta_label}
                </Link>
              )}
            </div>
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
          </>
        ) : (
          // Collector event slide
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {slide.event.emoji && (
                <span className="text-3xl flex-shrink-0">{slide.event.emoji}</span>
              )}
              <div className="min-w-0">
                <p className="font-bold text-white text-sm leading-tight truncate">
                  {slide.event.name}
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: `${accent}cc` }}>
                  {getEventCountdown(slide.event)}
                </p>
              </div>
            </div>
            <Link
              href="/events"
              className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90"
              style={{ background: accent, color: "#000" }}
            >
              Learn More →
            </Link>
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
