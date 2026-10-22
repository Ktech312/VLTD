"use client";

import { PillButton } from "@/components/ui/PillButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { fetchActiveThemes, type SeasonalTheme } from "@/lib/seasonalTheme";
import { Glyph } from "@/components/ui/Glyph";
import { acceptTheme, applyAcceptedTheme, declineTheme, getThemePrefs, type ThemeChoice } from "@/lib/seasonalConsent";
import { eventCountdown } from "@/lib/eventDates";
import { BANNER_FETCH_FEATURED, BANNER_FETCH_NEAREST, FEATURED_HORIZON_DAYS, pickBannerEvents } from "@/lib/bannerEvents";

const ROTATE_MS = 35_000;
const FADE_MS = 300;

// One size for every slide. The card is a main row plus a band underneath; the band always exists (it carries the dots, and on a theme slide the
// theme question), so choosing Yes or No, or moving between a theme slide and an event slide, never changes the card's height and nothing below moves.
const MAIN_ROW_PX = 46;
const BAND_PX = 32;
const CARD_PX = MAIN_ROW_PX + BAND_PX + 2; // + the 1px border top and bottom

// Color map for collector events by slug
const EVENT_COLOR_MAP: Record<string, { accent: string; secondary: string }> = {
  "sd-card-show-june-2026":                    { accent: "#52c27a", secondary: "#0a1f12" },
  "national-sports-collectors-convention-2026": { accent: "#F5A623", secondary: "#1c1000" },
  "san-diego-comic-con-2026":                  { accent: "#c084fc", secondary: "#160d26" },
  "namm-show-2026":                            { accent: "#2DD4BF", secondary: "#061a19" },
};
const DEFAULT_EVENT_COLORS = { accent: "#C8CDD2", secondary: "#1a1200" };

type CollectorEvent = {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  starts_at: string;
  ends_at: string;
  city: string | null;
  state_region: string | null;
  is_featured?: boolean | null;
};

type Slide =
  | { type: "theme"; theme: SeasonalTheme }
  | { type: "event"; event: CollectorEvent };

const EVENT_COLUMNS = "id, slug, name, emoji, starts_at, ends_at, city, state_region, is_featured";

async function loadBannerEvents(): Promise<CollectorEvent[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const now = new Date();
  const nowIso = now.toISOString();
  const horizonIso = new Date(now.getTime() + FEATURED_HORIZON_DAYS * 86_400_000).toISOString();
  const [featured, nearest] = await Promise.all([
    supabase
      .from("collector_events")
      .select(EVENT_COLUMNS)
      .eq("is_featured", true)
      .gte("ends_at", nowIso)
      .lte("starts_at", horizonIso)
      .order("starts_at", { ascending: true })
      .limit(BANNER_FETCH_FEATURED),
    supabase
      .from("collector_events")
      .select(EVENT_COLUMNS)
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(BANNER_FETCH_NEAREST),
  ]);
  return pickBannerEvents((featured.data ?? []) as CollectorEvent[], (nearest.data ?? []) as CollectorEvent[], now);
}

export default function SeasonalBanner() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [themes, setThemes] = useState<SeasonalTheme[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [themePrefs, setThemePrefs] = useState<Record<string, ThemeChoice>>({});
  const [moves, setMoves] = useState(0); // counts manual moves so the 35 s countdown starts over after each one
  const touchStartX = useRef<number | null>(null); // must be before any early return
  const shownRef = useRef(0); // the slide being shown, or about to be: rapid taps add up instead of all starting from the same slide
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = slides.length;

  useEffect(() => {
    let cancelled = false;
    async function loadSlides() {
      // Seasonal themes (the one the person said Yes to is switched on; with none accepted the normal theme stays)
      const allThemes = await fetchActiveThemes();
      applyAcceptedTheme(allThemes);
      const bannerThemes = allThemes.filter((t) => t.banner_enabled);
      const events = await loadBannerEvents();
      if (cancelled) return;
      setThemes(allThemes);
      setThemePrefs(getThemePrefs());
      // Merge: seasonal themes first, then events
      setSlides([
        ...bannerThemes.map((t): Slide => ({ type: "theme", theme: t })),
        ...events.map((e): Slide => ({ type: "event", event: e })),
      ]);
      setLoaded(true);
    }
    void loadSlides();
    return () => {
      cancelled = true;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  const goTo = useCallback(
    (next: number, manual: boolean) => {
      if (count < 2) return;
      const target = ((next % count) + count) % count;
      shownRef.current = target;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setVisible(false);
      fadeTimer.current = setTimeout(() => {
        fadeTimer.current = null;
        setIdx(target);
        setVisible(true);
      }, FADE_MS);
      if (manual) setMoves((m) => m + 1);
    },
    [count],
  );

  // Rotate every 35 s with a fade; any manual move starts the countdown over
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => goTo(shownRef.current + 1, false), ROTATE_MS);
    return () => clearInterval(id);
  }, [count, moves, goTo]);

  const slide = slides[idx];
  if (!loaded) {
    // Same box as the finished banner, so the page does not jump when the slides arrive.
    return <div aria-hidden className="mb-4" style={{ height: CARD_PX, borderRadius: 10 }} />;
  }
  if (!slide) return null;

  // Get colors for current slide
  let accent: string;
  if (slide.type === "theme") {
    accent = slide.theme.accent_color ?? "#E8B84B";
  } else {
    accent = (EVENT_COLOR_MAP[slide.event.slug] ?? DEFAULT_EVENT_COLORS).accent;
  }

  // Theme question / state: shown in the band on a theme slide that can recolor the app
  const themeSlide = slide.type === "theme" && slide.theme.accent_color ? slide.theme : null;
  const choice = themeSlide ? themePrefs[themeSlide.slug] : undefined;
  function chooseYes() {
    if (!themeSlide) return;
    acceptTheme(themeSlide, themes);
    setThemePrefs(getThemePrefs());
  }
  function chooseNo() {
    if (!themeSlide) return;
    declineTheme(themeSlide, themes);
    setThemePrefs(getThemePrefs());
  }

  // Touch swipe support
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || count <= 1) return;
    const dx = e.changedTouches[0].clientX - start;
    if (Math.abs(dx) < 40) return; // ignore tiny moves
    goTo(shownRef.current + (dx < 0 ? 1 : -1), true); // swipe left → next, swipe right → previous
  }

  const label = slide.type === "theme"
    ? slide.theme.banner_heading ?? ""
    : slide.event.name;
  const sublabel = slide.type === "theme"
    ? slide.theme.banner_subtext ?? ""
    : eventCountdown(slide.event);
  const emoji = slide.type === "theme" ? slide.theme.banner_emoji : slide.event.emoji;
  const ctaLabel = slide.type === "theme" ? slide.theme.banner_cta_label : "Learn More";
  const ctaHref  = slide.type === "theme" ? (slide.theme.banner_cta_href ?? "#") : "/events";
  const eventHref = slide.type === "event" ? "/events" : null;

  return (
    <div
      data-seasonal-banner
      className="vltd-dark-surface relative mb-4 select-none overflow-hidden"
      style={{
        background: "linear-gradient(90deg, rgba(4,10,16,0.98), rgba(7,18,26,0.96) 48%, rgba(3,8,14,0.98))",
        border: "1px solid rgba(203,208,213,0.42)",
        borderRadius: 10,
        boxShadow: "0 18px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(237,239,241,0.08)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        height: CARD_PX,
        boxSizing: "border-box",
        cursor: eventHref ? "pointer" : "default",
      }}
      role={eventHref ? "link" : undefined}
      tabIndex={eventHref ? 0 : undefined}
      onClick={() => {
        if (eventHref) router.push(eventHref);
      }}
      onKeyDown={(e) => {
        if (!eventHref) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(eventHref);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}12 52%, transparent 78%)`,
          opacity: 0.42,
        }}
      />
      {/* Main row */}
      <div className="relative flex items-center gap-2 px-3" style={{ height: MAIN_ROW_PX }}>

        {/* Prev arrow */}
        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(shownRef.current - 1, true);
            }}
            aria-label="Previous"
            className="vltd-tap-y flex h-6 w-6 flex-shrink-0 items-center justify-center transition hover:brightness-125"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(203,208,213,0.30)",
              borderRadius: 7,
            }}
          >
            <Glyph name="back" size={12} strokeWidth={2} style={{ color: "#E6C46A" }} />
          </button>
        )}

        {/* Emoji */}
        {emoji && <span className="text-base flex-shrink-0">{emoji}</span>}

        {/* Text — one line title + faint sublabel. The outer card carries
            .vltd-dark-surface (theme-override.css) so every descendant here
            inherits light text automatically -- no per-element class
            needed, and the sublabel's own accent color below just wins
            normally since nothing is forcing it anymore. */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight truncate">{label}</p>
          {sublabel && (
            <p className="text-[10px] leading-tight truncate" style={{ color: `${accent}bb` }}>{sublabel}</p>
          )}
        </div>

        {/* CTA */}
        {ctaLabel && (
          <Link
            href={ctaHref ?? "#"}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 px-3 py-1.5 text-[11px] font-black transition hover:brightness-110"
            style={{
              background: "linear-gradient(135deg,#8C9298,#C8CDD2)",
              border: "1px solid rgba(255,225,128,0.40)",
              borderRadius: 7,
              color: "#080808",
              boxShadow: "0 10px 24px rgba(203,208,213,0.18)",
            }}
          >
            {ctaLabel}
          </Link>
        )}

        {/* Next arrow */}
        {count > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goTo(shownRef.current + 1, true);
            }}
            aria-label="Next"
            className="vltd-tap-y flex h-6 w-6 flex-shrink-0 items-center justify-center transition hover:brightness-125"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(203,208,213,0.30)",
              borderRadius: 7,
            }}
          >
            <Glyph name="next" size={12} strokeWidth={2} style={{ color: "#E6C46A" }} />
          </button>
        )}
      </div>

      {/* Band: the theme question on the left (theme slides only), the dots in the middle, the answer buttons on the right. Always the same height. */}
      <div
        className="relative grid items-center gap-2 px-3"
        style={{ height: BAND_PX, gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)" }}
      >
        <p className="flex min-w-0 items-center gap-1 text-[10px]" style={{ color: `${accent}bb` }}>
          {themeSlide && (
            <>
              <Glyph name="palette" size={11} />
              <span className="truncate">
                {choice === "accepted" ? "Seasonal theme on" : choice === "dismissed" ? "Normal theme" : "Switch app theme?"}
              </span>
            </>
          )}
        </p>

        <div className="flex items-center justify-center gap-1">
          {count > 1 &&
            slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i, true);
                }}
                className="vltd-tap-y flex-shrink-0 transition-all duration-300"
                style={{
                  ["--tap-h" as string]: "28px",
                  width: i === idx ? 14 : 5,
                  height: 3,
                  background: i === idx ? "#E6C46A" : "rgba(203,208,213,0.24)",
                  borderRadius: 2,
                }}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === idx ? "true" : undefined}
              />
            ))}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {themeSlide && !choice && (
            <>
              <PillButton size="compact" onClick={(e) => { e.stopPropagation(); chooseYes(); }} style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#000" }}>Yes</PillButton>
              <PillButton size="compact" onClick={(e) => { e.stopPropagation(); chooseNo(); }}>No</PillButton>
            </>
          )}
          {themeSlide && choice === "accepted" && (
            <PillButton size="compact" onClick={(e) => { e.stopPropagation(); chooseNo(); }}>Back to normal</PillButton>
          )}
          {themeSlide && choice === "dismissed" && (
            <PillButton size="compact" onClick={(e) => { e.stopPropagation(); chooseYes(); }}>Use seasonal</PillButton>
          )}
        </div>
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
