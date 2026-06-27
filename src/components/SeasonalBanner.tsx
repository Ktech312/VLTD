"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  city: string | null;
  state_region: string | null;
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

  const loc = [event.city, event.state_region].filter(Boolean).join(", ");
  const locationSuffix = loc ? ` — ${loc}` : "";

  if (diffDays <= 2) return `This weekend!${locationSuffix}`;
  return `Starts in ${diffDays} day${diffDays !== 1 ? "s" : ""}${locationSuffix}`;
}

export default function SeasonalBanner() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [themePrefs, setThemePrefs] = useState<Record<string, "accepted" | "dismissed">>({});
  const touchStartX = useRef<number | null>(null); // must be before any early return

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
          .select("id, slug, name, emoji, starts_at, ends_at, city, state_region")
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

  // Touch swipe support
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || slides.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return; // ignore tiny moves
    if (dx < 0) jumpTo((idx + 1) % slides.length);       // swipe left → next
    else jumpTo((idx - 1 + slides.length) % slides.length); // swipe right → prev
    touchStartX.current = null;
  }

  const label = slide.type === "theme"
    ? slide.theme.banner_heading ?? ""
    : slide.event.name;
  const sublabel = slide.type === "theme"
    ? slide.theme.banner_subtext ?? ""
    : getEventCountdown(slide.event);
  const emoji = slide.type === "theme" ? slide.theme.banner_emoji : slide.event.emoji;
  const ctaLabel = slide.type === "theme" ? slide.theme.banner_cta_label : "Learn More";
  const ctaHref  = slide.type === "theme" ? (slide.theme.banner_cta_href ?? "#") : "/events";

  return (
    <div
      className="relative overflow-hidden rounded-xl mb-3 select-none"
      style={{
        background: `linear-gradient(135deg, ${secondary}dd, ${accent}22)`,
        border: `1px solid ${accent}33`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
        minHeight: 44,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Single slim row */}
      <div className="flex items-center gap-2 px-3 py-2">

        {/* Prev arrow */}
        {slides.length > 1 && (
          <button
            onClick={() => jumpTo((idx - 1 + slides.length) % slides.length)}
            aria-label="Previous"
            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full"
            style={{ background: `${accent}22` }}
          >
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L4 6l3.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Emoji */}
        {emoji && <span className="text-base flex-shrink-0">{emoji}</span>}

        {/* Text — one line title + faint sublabel */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight truncate">{label}</p>
          {sublabel && (
            <p className="text-[10px] leading-tight truncate" style={{ color: `${accent}bb` }}>{sublabel}</p>
          )}
        </div>

        {/* CTA */}
        {ctaLabel && (
          <Link
            href={ctaHref ?? "#"}
            className="flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition hover:opacity-90"
            style={{ background: accent, color: "#000" }}
          >
            {ctaLabel}
          </Link>
        )}

        {/* Next arrow */}
        {slides.length > 1 && (
          <button
            onClick={() => jumpTo((idx + 1) % slides.length)}
            aria-label="Next"
            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full"
            style={{ background: `${accent}22` }}
          >
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L8 6l-3.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dot indicators — single pixel row at bottom */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1 pb-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 12 : 4,
                height: 3,
                background: i === idx ? accent : `${accent}44`,
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Theme prompt — only shown if user hasn't decided yet */}
      {slide.type === "theme" && showThemePrompt && (
        <div
          className="flex items-center justify-between gap-2 px-3 pb-2"
        >
          <p className="text-[10px]" style={{ color: `${accent}bb` }}>🎨 Switch app theme?</p>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={handleAcceptTheme}
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: accent, color: "#000" }}
            >Yes</button>
            <button
              onClick={handleDismissTheme}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `${accent}22`, color: `${accent}cc` }}
            >No</button>
          </div>
        </div>
      )}
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
