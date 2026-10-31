"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { fetchActiveThemes, type SeasonalTheme } from "@/lib/seasonalTheme";
import { Glyph } from "@/components/ui/Glyph";
import { acceptTheme, applyAcceptedTheme, declineTheme, getThemePrefs, type ThemeChoice } from "@/lib/seasonalConsent";
import { earliestStoredEnd, eventCountdown } from "@/lib/eventDates";
import { BANNER_FETCH_FEATURED, BANNER_FETCH_NEAREST, FEATURED_HORIZON_DAYS, pickBannerEvents } from "@/lib/bannerEvents";

const ROTATE_MS = 15_000;
const FADE_MS = 300;
const DRAG_START_PX = 8; // movement before a press counts as a drag (and stops it counting as a tap)
const SWIPE_PX = 40; // a drag at least this long, left or right, moves to the next or previous slide

// One size for every slide and every theme state: the card has a fixed height (the artwork, or the fallback, fills it), and the Seasonal theme switch
// below it sits in a row of fixed height, so changing the switch or the slide never changes the size of anything or moves what is below.
const CARD_PX = 72;

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
  country?: string | null;
  image_url?: string | null;
  is_featured?: boolean | null;
};

type Slide =
  | { type: "theme"; theme: SeasonalTheme }
  | { type: "event"; event: CollectorEvent };

const EVENT_COLUMNS = "id, slug, name, emoji, starts_at, ends_at, city, state_region, country, image_url, is_featured";

async function loadBannerEvents(): Promise<CollectorEvent[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const now = new Date();
  // Ask for anything not yet over in every time zone; pickBannerEvents then drops the ones that are over in their own zone.
  const fromIso = earliestStoredEnd(now);
  const horizonIso = new Date(now.getTime() + FEATURED_HORIZON_DAYS * 86_400_000).toISOString();
  const [featured, nearest] = await Promise.all([
    supabase
      .from("collector_events")
      .select(EVENT_COLUMNS)
      .eq("is_featured", true)
      .gte("ends_at", fromIso)
      .lte("starts_at", horizonIso)
      .order("starts_at", { ascending: true })
      .limit(BANNER_FETCH_FEATURED),
    supabase
      .from("collector_events")
      .select(EVENT_COLUMNS)
      .gte("ends_at", fromIso)
      .order("starts_at", { ascending: true })
      .limit(BANNER_FETCH_NEAREST),
  ]);
  return pickBannerEvents((featured.data ?? []) as CollectorEvent[], (nearest.data ?? []) as CollectorEvent[], now);
}

// The switch's row (one slim line), and the same row kept as an empty spacer while loading
const SWITCH_ROW = "mt-1.5 flex h-6 items-center justify-end";

export default function SeasonalBanner() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [themes, setThemes] = useState<SeasonalTheme[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [themePrefs, setThemePrefs] = useState<Record<string, ThemeChoice>>({});
  const [moves, setMoves] = useState(0); // counts manual moves so the 15 s countdown starts over after each one
  const [brokenArt, setBrokenArt] = useState<Record<string, true>>({});
  const shownRef = useRef(0); // the slide being shown, or about to be: rapid taps add up instead of all starting from the same slide
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const swallowClick = useRef(false);
  const count = slides.length;

  useEffect(() => {
    let cancelled = false;
    async function loadSlides() {
      // Seasonal themes (the one the person turned on is applied; with it off the normal theme stays)
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

  // Rotate every 15 s with a fade; any manual move (arrow, dot, swipe, drag, key) starts the countdown over, so it never jumps again right after
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => goTo(shownRef.current + 1, false), ROTATE_MS);
    return () => clearInterval(id);
  }, [count, moves, goTo]);

  // Have the next slide's picture ready before it is shown
  useEffect(() => {
    if (count < 2) return;
    const next = slides[(idx + 1) % count];
    const url = next?.type === "event" ? next.event.image_url : null;
    if (url) {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = url;
    }
  }, [idx, count, slides]);

  const slide = slides[idx];
  if (!loaded) {
    // The same boxes as the finished banner, so the page does not jump when the slides arrive.
    return (
      <div aria-hidden>
        <div style={{ height: CARD_PX, borderRadius: 10 }} />
        <div className={SWITCH_ROW} />
      </div>
    );
  }

  // The seasonal theme the switch controls: the latest-starting active one that can recolor the app
  const seasonal = [...themes].reverse().find((t) => t.accent_color) ?? null;
  const seasonalOn = seasonal ? themePrefs[seasonal.slug] === "accepted" : false;
  function toggleSeasonal() {
    if (!seasonal) return;
    if (seasonalOn) declineTheme(seasonal, themes);
    else acceptTheme(seasonal, themes);
    setThemePrefs(getThemePrefs());
  }

  if (!slide && !seasonal) return null;

  // The small palette line that used to sit inside the card, moved here and made clickable: one press turns the seasonal theme on or off.
  const switchRow = seasonal ? (
    <div className={SWITCH_ROW}>
      <button
        type="button"
        role="switch"
        aria-checked={seasonalOn}
        aria-label="Seasonal theme"
        onClick={toggleSeasonal}
        className="vltd-tap-y flex items-center gap-1 text-[10px] transition hover:brightness-125"
        style={{ color: `${seasonal.accent_color}bb`, ["--tap-h" as string]: "32px" }}
      >
        <Glyph name="palette" size={11} />
        Seasonal theme {seasonalOn ? "on" : "off"}
      </button>
    </div>
  ) : (
    <div className={SWITCH_ROW} />
  );
  if (!slide) return <div>{switchRow}</div>;

  // Get colors for current slide
  let accent: string;
  if (slide.type === "theme") {
    accent = slide.theme.accent_color ?? "#E8B84B";
  } else {
    accent = (EVENT_COLOR_MAP[slide.event.slug] ?? DEFAULT_EVENT_COLORS).accent;
  }

  const art = slide.type === "event" && slide.event.image_url && !brokenArt[slide.event.image_url] ? slide.event.image_url : null;
  // A "photo" fills the card behind a dark scrim. A "graphic" (a logo or title lettering with a transparent background, usually dark) would vanish on the
  // dark card, so it is shown on a light card instead, with dark words; the card keeps exactly the same size and layout.
  const graphic = !!art && /#graphic$/.test(art);
  const photo = !!art && !graphic;
  const ink = graphic ? "#10161B" : undefined;
  const inkSoft = graphic ? "#46505A" : undefined;
  const glyph = graphic ? "#2A3138" : "#E6C46A";
  const arrowStyle = graphic
    ? { background: "rgba(255,255,255,0.75)", border: "1px solid rgba(60,70,80,0.30)", borderRadius: 7 }
    : { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(203,208,213,0.30)", borderRadius: 7 };

  // Pointer handling: a horizontal drag (finger on a phone, mouse on a computer) moves to the next or previous slide. Vertical movement is never
  // taken (touch-action: pan-y leaves page scrolling to the browser), and a press that turned into a drag never counts as a tap on the event or a button.
  function onPointerDown(e: React.PointerEvent) {
    if (count < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = press.current;
    if (!p || p.id !== e.pointerId || p.dragging) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > DRAG_START_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      p.dragging = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId); // keeps a mouse drag going outside the banner
      } catch {
        /* the pointer is already gone */
      }
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.dragging) return;
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 60);
    const dx = e.clientX - p.x;
    if (Math.abs(dx) >= SWIPE_PX) goTo(shownRef.current + (dx < 0 ? 1 : -1), true); // left = next, right = previous
  }
  function onPointerCancel() {
    press.current = null; // the browser took the gesture (a vertical scroll): nothing to do
  }

  const label = slide.type === "theme"
    ? slide.theme.banner_heading ?? ""
    : slide.event.name;
  const sublabel = slide.type === "theme"
    ? slide.theme.banner_subtext ?? ""
    : eventCountdown(slide.event);
  const emoji = slide.type === "theme" ? slide.theme.banner_emoji : slide.event.emoji;
  const ctaLabel = slide.type === "theme" ? slide.theme.banner_cta_label : "Learn More";
  // An event slide opens that event on the Events page (the page selects the event named in ?highlight=)
  const eventHref = slide.type === "event" ? `/events?highlight=${encodeURIComponent(slide.event.slug)}` : null;
  const ctaHref = slide.type === "theme" ? (slide.theme.banner_cta_href ?? "#") : (eventHref ?? "/events");

  return (
    <div>
      <div
        data-seasonal-banner
        data-slide={slide.type === "event" ? slide.event.slug : slide.theme.slug}
        data-art={art ? (graphic ? "graphic" : "photo") : "no"}
        className={`${graphic ? "" : "vltd-dark-surface "}relative select-none overflow-hidden`}
        style={{
          background: graphic
            ? "linear-gradient(90deg, #E2E5E8, #F2F4F6 55%, #E2E5E8)"
            : "linear-gradient(90deg, rgba(4,10,16,0.98), rgba(7,18,26,0.96) 48%, rgba(3,8,14,0.98))",
          border: graphic ? "1px solid rgba(60,70,80,0.35)" : "1px solid rgba(203,208,213,0.42)",
          borderRadius: 10,
          boxShadow: "0 18px 46px rgba(0,0,0,0.36), inset 0 1px 0 rgba(237,239,241,0.08)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
          height: CARD_PX,
          boxSizing: "border-box",
          cursor: eventHref ? "pointer" : "default",
          touchAction: "pan-y",
        }}
        role={eventHref ? "link" : undefined}
        tabIndex={0}
        aria-roledescription="carousel"
        onClickCapture={(e) => {
          if (swallowClick.current) {
            swallowClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onClick={() => {
          if (eventHref) router.push(eventHref);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight") goTo(shownRef.current + 1, true);
          else if (e.key === "ArrowLeft") goTo(shownRef.current - 1, true);
          else if (eventHref && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            router.push(eventHref);
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Artwork (the event's own picture) with a scrim so the words stay readable; without artwork, the same card with a soft accent glow */}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setBrokenArt((b) => ({ ...b, [art]: true }))}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center 30%" }}
          />
        ) : graphic ? null : (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}12 52%, transparent 78%)`, opacity: 0.42 }}
          />
        )}
        {photo && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(4,10,16,0.94) 0%, rgba(4,10,16,0.84) 42%, rgba(4,10,16,0.5) 100%)" }}
          />
        )}

        <div className="relative flex h-full items-center gap-2 px-3" style={{ paddingBottom: 8 }}>
          {/* Prev arrow */}
          {count > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(shownRef.current - 1, true);
              }}
              aria-label="Previous"
              className="vltd-tap flex h-6 w-6 flex-shrink-0 items-center justify-center transition hover:brightness-125"
              style={arrowStyle}
            >
              <Glyph name="back" size={12} strokeWidth={2} style={{ color: glyph }} />
            </button>
          )}

          {/* Emoji (only on slides without artwork) */}
          {emoji && !art && <span className="text-base flex-shrink-0">{emoji}</span>}

          {/* The logo / title lettering, on the light card */}
          {graphic && art && (
            <span className="flex h-11 w-[72px] flex-shrink-0 items-center justify-center sm:w-[132px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={art}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
                onError={() => setBrokenArt((b) => ({ ...b, [art]: true }))}
                className="pointer-events-none h-full w-full object-contain"
              />
            </span>
          )}

          {/* Text: one line title + faint sublabel. The card carries .vltd-dark-surface (theme-override.css) so every descendant inherits light text. */}
          <div className="flex-1 min-w-0" style={{ textShadow: photo ? "0 1px 3px rgba(0,0,0,0.9)" : undefined }}>
            <p className="line-clamp-2 text-xs font-bold leading-tight sm:line-clamp-1" style={{ color: ink }}>{label}</p>
            {sublabel && (
              <p className="text-[10px] leading-tight truncate" style={{ color: graphic ? inkSoft : photo ? "#E6EAEE" : `${accent}bb` }}>{sublabel}</p>
            )}
          </div>

          {/* CTA */}
          {ctaLabel && (
            <Link
              href={ctaHref ?? "#"}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              className="vltd-tap-y [--tap-h:40px] max-w-[84px] flex-shrink-0 whitespace-normal px-2 py-1 text-center text-[10px] font-black leading-tight transition hover:brightness-110 sm:max-w-none sm:whitespace-nowrap sm:px-3 sm:py-1.5 sm:text-[11px] sm:leading-normal"
              style={
                graphic
                  ? { background: "#141A1F", border: "1px solid rgba(0,0,0,0.5)", borderRadius: 7, color: "#F1F3F5", boxShadow: "0 6px 16px rgba(0,0,0,0.18)" }
                  : {
                      background: "linear-gradient(135deg,#8C9298,#C8CDD2)",
                      border: "1px solid rgba(255,225,128,0.40)",
                      borderRadius: 7,
                      color: "#080808",
                      boxShadow: "0 10px 24px rgba(203,208,213,0.18)",
                    }
              }
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
              className="vltd-tap flex h-6 w-6 flex-shrink-0 items-center justify-center transition hover:brightness-125 [--tap-w:40px]"
              style={arrowStyle}
            >
              <Glyph name="next" size={12} strokeWidth={2} style={{ color: glyph }} />
            </button>
          )}
        </div>

        {/* Dots, along the bottom edge */}
        {count > 1 && (
          <div className="pointer-events-none absolute bottom-1 left-0 right-0 flex items-center justify-center gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i, true);
                }}
                className="vltd-tap-y pointer-events-auto flex-shrink-0 transition-all duration-300"
                style={{
                  ["--tap-h" as string]: "28px",
                  width: i === idx ? 14 : 5,
                  height: 3,
                  background: graphic ? (i === idx ? "#2A3138" : "rgba(60,70,80,0.30)") : i === idx ? "#E6C46A" : "rgba(203,208,213,0.34)",
                  borderRadius: 2,
                }}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === idx ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {switchRow}
    </div>
  );
}
