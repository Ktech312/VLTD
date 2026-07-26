"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Loader2,
  MapPin,
  PlusCircle,
  Search,
  Ticket,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type EventType = "local" | "national" | "international";

type CollectorEvent = {
  id: string;
  slug: string;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  state_region: string | null;
  country: string;
  website_url: string | null;
  ticket_url: string | null;
  admission: string | null;
  emoji: string | null;
  relevant_universes: string[] | null;
  is_featured: boolean;
};

type EventCategory = "convention" | "card_show" | "auction" | "drop" | "gallery" | "music";
type EventFilter = "all" | EventCategory;

const SAVED_EVENTS_KEY = "vltd_saved_event_ids_v1";
const EVENT_SEARCH_SAVED_KEY = "vltd_event_search_saved_v1";

type EventSuggestion = {
  id: string;
  title: string;
  when: string;
  startDate: string | null;
  venue: string | null;
  location: string | null;
  description: string | null;
  link: string | null;
  mapLink: string | null;
  ticketLink: string | null;
  thumbnail: string | null;
  source: string;
};


function safeDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateRange(starts: string, ends: string): string {
  const start = safeDate(starts);
  const end = safeDate(ends);
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const year = start.getUTCFullYear();

  if (startText === endText) return `${startText}, ${year}`;
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${startText}-${end.getUTCDate()}, ${year}`;
  }
  return `${startText} - ${endText}, ${year}`;
}

function formatLongDate(starts: string, ends: string): string {
  return formatDateRange(starts, ends).toUpperCase();
}

function locationLabel(event: CollectorEvent): string {
  return [event.city, event.state_region].filter(Boolean).join(", ") || event.country || "Online";
}

function venueLine(event: CollectorEvent): string {
  return [event.venue_name, locationLabel(event)].filter(Boolean).join(", ");
}

function normalizeUniverse(universe: string): string {
  return universe
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryFor(event: CollectorEvent): EventCategory {
  const text = `${event.name} ${event.short_desc ?? ""} ${event.long_desc ?? ""}`.toLowerCase();
  if (text.includes("auction")) return "auction";
  if (text.includes("drop") || text.includes("release")) return "drop";
  if (text.includes("gallery") || text.includes("museum")) return "gallery";
  if (text.includes("card show") || text.includes("sports card") || text.includes("trading card")) return "card_show";
  if (text.includes("namm") || text.includes("music") || text.includes("instrument")) return "music";
  return "convention";
}

function categoryLabel(category: EventCategory): string {
  const labels: Record<EventCategory, string> = {
    convention: "Convention",
    card_show: "Card Show",
    auction: "Auction",
    drop: "Online Drop",
    gallery: "Gallery",
    music: "Music",
  };
  return labels[category];
}

function categoryColor(category: EventCategory): string {
  const colors: Record<EventCategory, string> = {
    convention: "#C8CDD2",
    card_show: "#58d8f6",
    auction: "#f07ab6",
    drop: "#5dd892",
    gallery: "#b989ff",
    music: "#e0b44a",
  };
  return colors[category];
}

function eventArtStyle(event: CollectorEvent): React.CSSProperties {
  const category = categoryFor(event);
  const accent = categoryColor(category);
  const overlays: Record<EventCategory, string> = {
    convention:
      "radial-gradient(circle at 78% 18%, rgba(203,208,213,0.38), transparent 24%), linear-gradient(135deg, rgba(23,39,64,0.92), rgba(6,10,14,0.62)), repeating-linear-gradient(90deg, rgba(203,208,213,0.16) 0 2px, transparent 2px 46px)",
    card_show:
      "radial-gradient(circle at 72% 24%, rgba(88,216,246,0.26), transparent 26%), linear-gradient(135deg, rgba(11,31,48,0.92), rgba(5,9,13,0.72)), repeating-linear-gradient(125deg, rgba(203,208,213,0.14) 0 1px, transparent 1px 34px)",
    auction:
      "radial-gradient(circle at 78% 22%, rgba(240,122,182,0.28), transparent 22%), linear-gradient(135deg, rgba(50,18,31,0.9), rgba(5,9,13,0.74)), repeating-linear-gradient(0deg, rgba(203,208,213,0.14) 0 1px, transparent 1px 40px)",
    drop:
      "radial-gradient(circle at 72% 18%, rgba(93,216,146,0.30), transparent 25%), linear-gradient(135deg, rgba(9,35,29,0.92), rgba(5,9,13,0.72)), repeating-linear-gradient(135deg, rgba(93,216,146,0.12) 0 1px, transparent 1px 36px)",
    gallery:
      "radial-gradient(circle at 76% 22%, rgba(185,137,255,0.30), transparent 24%), linear-gradient(135deg, rgba(33,22,48,0.92), rgba(5,9,13,0.75)), repeating-linear-gradient(90deg, rgba(203,208,213,0.12) 0 1px, transparent 1px 42px)",
    music:
      "radial-gradient(circle at 74% 20%, rgba(224,180,74,0.34), transparent 25%), linear-gradient(135deg, rgba(45,30,10,0.92), rgba(5,9,13,0.75)), repeating-linear-gradient(115deg, rgba(224,180,74,0.14) 0 1px, transparent 1px 38px)",
  };

  return {
    background: overlays[category],
    borderColor: `color-mix(in srgb, ${accent} 52%, transparent)`,
  };
}

function EventArt({
  event,
  className = "",
  compact = false,
}: {
  event: CollectorEvent;
  className?: string;
  compact?: boolean;
}) {
  const category = categoryFor(event);
  const accent = categoryColor(category);
  const titleWords = event.name.split(/\s+/).filter(Boolean).slice(0, compact ? 2 : 4).join(" ");

  return (
    <div
      className={`relative overflow-hidden rounded-[7px] border ${className}`}
      style={eventArtStyle(event)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_72%,rgba(0,0,0,0),rgba(0,0,0,0.62)_70%)]" />
      <div className="absolute -right-8 top-4 h-28 w-28 rotate-12 rounded-[18px] border border-white/10 bg-black/20 shadow-[0_20px_70px_rgba(0,0,0,0.5)]" />
      <div className="absolute right-8 top-5 h-24 w-16 rotate-6 rounded-[5px] border border-[color:var(--theme-gold-border)] bg-black/35 shadow-[0_12px_28px_rgba(0,0,0,0.45)]" />
      <div className="absolute left-4 top-4 rounded-[5px] bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>
        {categoryLabel(category)}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="max-w-[82%] text-sm font-black leading-tight text-[color:var(--fg)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
          {titleWords}
        </div>
      </div>
    </div>
  );
}

function makeUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function MiniCalendar({ event }: { event: CollectorEvent }) {
  const start = safeDate(event.starts_at);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const first = makeUtcDate(year, month, 1);
  const daysInMonth = makeUtcDate(year, month + 1, 0).getUTCDate();
  const offset = first.getUTCDay();
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => (index < offset ? 0 : index - offset + 1));
  const monthName = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const activeDay = start.getUTCDate();

  return (
    <aside className="rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--theme-gold)]">{monthName}</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase text-[color:var(--muted)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-[color:var(--fg)]">
        {cells.map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="grid h-6 place-items-center rounded-full"
            style={{
              color: day === activeDay ? "#05080b" : day ? "var(--fg)" : "transparent",
              background: day === activeDay ? "var(--theme-gold)" : "transparent",
              fontWeight: day === activeDay ? 900 : 600,
            }}
          >
            {day || "."}
          </span>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--theme-gold)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--muted)] opacity-30" />
      </div>
    </aside>
  );
}

function EventTypeSelect({
  value,
  onChange,
}: {
  value: EventFilter;
  onChange: (value: EventFilter) => void;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[color:var(--muted)]">
        <CalendarDays size={14} />
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as EventFilter)}
        className="h-9 w-full appearance-none rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] pl-9 pr-8 text-xs font-bold text-[color:var(--fg)] outline-none"
      >
        <option value="all">All Event Types</option>
        <option value="convention">Conventions</option>
        <option value="card_show">Card Shows</option>
        <option value="auction">Auctions</option>
        <option value="drop">Drops</option>
        <option value="gallery">Gallery</option>
        <option value="music">Music</option>
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
      />
    </label>
  );
}

function SaveButton({
  saved,
  compact = false,
  onClick,
}: {
  saved: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={saved ? "Remove saved event" : "Save event"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center justify-center rounded-[7px] border border-[color:var(--border)] bg-black/30 text-[color:var(--theme-gold)] ${compact ? "h-8 w-8" : "h-9 gap-2 px-3 text-xs font-bold"}`}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
      {!compact && <span>{saved ? "Saved" : "Save Event"}</span>}
    </button>
  );
}

function EventCard({
  event,
  selected,
  saved,
  onSelect,
  onToggleSave,
}: {
  event: CollectorEvent;
  selected: boolean;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}) {
  const category = categoryFor(event);
  const accent = categoryColor(category);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className="group cursor-pointer overflow-hidden rounded-[7px] border text-left transition hover:-translate-y-0.5"
      style={{
        background: "var(--theme-card)",
        borderColor: selected ? "var(--theme-gold)" : "var(--border)",
        boxShadow: selected ? "0 0 0 1px rgba(203,208,213,0.18)" : "none",
      }}
    >
      <div className="relative">
        <EventArt event={event} className="h-[118px] rounded-none border-0" compact />
        <div className="absolute right-2 top-2">
          <SaveButton saved={saved} compact onClick={onToggleSave} />
        </div>
      </div>
      <div className="border-t border-[color:var(--border)] p-3">
        <h3 className="line-clamp-1 text-sm font-black text-[color:var(--fg)]">{event.name}</h3>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--muted)]">
          {formatDateRange(event.starts_at, event.ends_at)}
        </p>
        <p className="line-clamp-1 text-[11px] text-[color:var(--muted)]">{locationLabel(event)}</p>
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: accent }}>
          {categoryLabel(category)}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  saved,
  onSelect,
  onToggleSave,
}: {
  event: CollectorEvent;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className="grid w-full cursor-pointer grid-cols-[72px_minmax(0,1fr)_32px] gap-3 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--theme-card)] p-2 text-left"
    >
      <EventArt event={event} compact className="h-16" />
      <div className="min-w-0 self-center">
        <div className="line-clamp-1 text-sm font-black text-[color:var(--fg)]">{event.name}</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--muted)]">
          {formatDateRange(event.starts_at, event.ends_at)}
        </div>
        <div className="line-clamp-1 text-[11px] text-[color:var(--muted)]">{locationLabel(event)}</div>
      </div>
      <SaveButton saved={saved} compact onClick={onToggleSave} />
    </div>
  );
}

function EventSuggestionCard({
  suggestion,
  saved,
  onSave,
}: {
  suggestion: EventSuggestion;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--theme-card)] p-3 md:grid-cols-[112px_minmax(0,1fr)_auto]">
      <div
        className="h-24 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] bg-cover bg-center"
        style={{
          backgroundImage: suggestion.thumbnail
            ? `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.42)), url(${suggestion.thumbnail})`
            : "radial-gradient(circle at 70% 18%, rgba(203,208,213,0.24), transparent 30%), linear-gradient(135deg, rgba(14,34,48,0.88), rgba(4,7,10,0.94))",
        }}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-1 text-sm font-black text-[color:var(--fg)]">{suggestion.title}</h3>
          <span className="rounded-[5px] border border-[color:var(--border)] bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--muted)]">
            {suggestion.source}
          </span>
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-[color:var(--theme-gold)]">{suggestion.when}</p>
        <p className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">
          {[suggestion.venue, suggestion.location].filter(Boolean).join(", ") || "Location not listed"}
        </p>
        {suggestion.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[color:var(--muted)]">{suggestion.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-stretch">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-[color:var(--theme-gold-border)] bg-[color:var(--pill)] px-3 text-xs font-black text-[color:var(--theme-gold)]"
        >
          <PlusCircle size={14} />
          {saved ? "Saved" : "Save"}
        </button>
        {(suggestion.ticketLink || suggestion.link) && (
          <a
            href={suggestion.ticketLink ?? suggestion.link ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-[color:var(--border)] bg-black/20 px-3 text-xs font-black text-[color:var(--fg)]"
          >
            Open <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<CollectorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [savedSuggestionIds, setSavedSuggestionIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string>("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [eventLocation, setEventLocation] = useState("");
  const [eventSearchCategory, setEventSearchCategory] = useState<EventFilter>("convention");
  const [eventSearchRadius, setEventSearchRadius] = useState("100");
  const [eventSearchRange, setEventSearchRange] = useState("next_90");
  const [eventSearchLoading, setEventSearchLoading] = useState(false);
  const [eventSearchError, setEventSearchError] = useState("");
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventSuggestions, setEventSuggestions] = useState<EventSuggestion[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(SAVED_EVENTS_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as string[];
        setSavedIds(new Set(parsed));
      } catch {
        setSavedIds(new Set());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(EVENT_SEARCH_SAVED_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as string[];
        setSavedSuggestionIds(new Set(parsed));
      } catch {
        setSavedSuggestionIds(new Set());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const timer = window.setTimeout(() => {
        setEvents([]);
        setSelectedId("");
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    supabase
      .from("collector_events")
      .select("*")
      .eq("enabled", true)
      .order("starts_at", { ascending: true })
      .then(({ data, error: queryError }: { data: CollectorEvent[] | null; error: { message: string } | null }) => {
        if (queryError) {
          setError(queryError.message);
          setEvents([]);
          setSelectedId("");
        } else {
          const rows = (data ?? []) as CollectorEvent[];
          setEvents(rows);
          setSelectedId(rows.find((event) => event.is_featured)?.id ?? rows[0]?.id ?? "");
        }
        setLoading(false);
      });
  }, []);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => safeDate(a.starts_at).getTime() - safeDate(b.starts_at).getTime());
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const baseline = nowMs || 0;
    return sortedEvents.filter((event) => safeDate(event.ends_at).getTime() >= baseline);
  }, [nowMs, sortedEvents]);

  const featuredEvent = useMemo(() => {
    return upcomingEvents.find((event) => event.is_featured) ?? upcomingEvents[0] ?? sortedEvents[0];
  }, [sortedEvents, upcomingEvents]);

  const selectedEvent = useMemo(() => {
    return sortedEvents.find((event) => event.id === selectedId) ?? featuredEvent;
  }, [featuredEvent, selectedId, sortedEvents]);

  const filteredEvents = useMemo(() => {
    const base = upcomingEvents.length ? upcomingEvents : sortedEvents;
    const active = filter === "all" ? base : base.filter((event) => categoryFor(event) === filter);
    return showSavedOnly ? active.filter((event) => savedIds.has(event.id)) : active;
  }, [filter, sortedEvents, upcomingEvents, showSavedOnly, savedIds]);

  const savedEvents = useMemo(() => {
    return sortedEvents.filter((event) => savedIds.has(event.id));
  }, [savedIds, sortedEvents]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleSavedSuggestion = (id: string) => {
    setSavedSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(EVENT_SEARCH_SAVED_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const searchEvents = async () => {
    const location = eventLocation.trim();
    if (location.length < 2) {
      setEventSearchError("Enter a city or ZIP code.");
      return;
    }

    setEventSearchLoading(true);
    setEventSearchError("");
    setEventSearchQuery("");

    const params = new URLSearchParams({
      location,
      category: eventSearchCategory,
      radius: eventSearchRadius,
      dateRange: eventSearchRange,
    });

    const response = await fetch(`/api/events/search?${params.toString()}`).catch(() => null);
    if (!response) {
      setEventSuggestions([]);
      setEventSearchError("Event search failed. Try again.");
      setEventSearchLoading(false);
      return;
    }

    const payload = (await response.json()) as {
        query?: string;
        searchArea?: string;
        results?: EventSuggestion[];
        message?: string;
      };

    if (!response.ok) {
      setEventSuggestions([]);
      setEventSearchError(payload.message ? payload.message : "Event search failed.");
      setEventSearchLoading(false);
      return;
    }

    const results = payload.results ?? [];
      setEventSuggestions(results);
      setEventSearchQuery(payload.searchArea ? `${payload.query ?? ""} - ${payload.searchArea}` : payload.query ?? "");
    if (!results.length) {
      setEventSearchError("No event suggestions found. Try another ZIP or category.");
    }
    setEventSearchLoading(false);
  };

  const selectEvent = (id: string, scroll = false) => {
    setSelectedId(id);
    if (scroll) {
      window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
    }
  };

  const categories: { key: EventFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "convention", label: "Conventions" },
    { key: "card_show", label: "Card Shows" },
    { key: "auction", label: "Auctions" },
    { key: "drop", label: "Drops" },
  ];

  return (
    <main className="min-h-dvh bg-[color:var(--bg)] px-4 pb-24 pt-5 text-[color:var(--fg)] md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1360px]">
        {featuredEvent ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative overflow-hidden rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 md:p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_238px]">
              <div className="relative min-h-[210px] overflow-hidden rounded-[7px] border border-[color:var(--border)]">
                <EventArt event={featuredEvent} className="absolute inset-0 rounded-none border-0" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/76 via-black/38 to-black/12" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                  <div className="mb-2 inline-flex rounded-[5px] bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--theme-gold)]">
                    Featured Event
                  </div>
                  <h1 className="max-w-2xl text-2xl font-black leading-tight md:text-3xl">{featuredEvent.name}</h1>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--fg)]">
                    {formatLongDate(featuredEvent.starts_at, featuredEvent.ends_at)} - {locationLabel(featuredEvent)}
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)]">
                    {featuredEvent.short_desc ?? "Collector event with shows, releases, and market moments worth tracking."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selectEvent(featuredEvent.id, true)}
                      className="vltd-primary-button inline-flex h-9 items-center rounded-[4px] px-5 text-xs font-black"
                    >
                      View Event
                    </button>
                    <SaveButton
                      saved={savedIds.has(featuredEvent.id)}
                      onClick={() => toggleSaved(featuredEvent.id)}
                    />
                  </div>
                </div>
              </div>
              <MiniCalendar event={featuredEvent} />
            </div>
          </div>

          <aside className="hidden rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--theme-gold)]">Saved Events</h2>
            </div>
            <div className="space-y-2">
              {(savedEvents.length ? savedEvents : filteredEvents.slice(0, 3)).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => selectEvent(event.id, true)}
                  className="grid w-full grid-cols-[44px_minmax(0,1fr)] gap-2 rounded-[7px] border border-[color:var(--border)] bg-black/10 p-2 text-left"
                >
                  <EventArt event={event} compact className="h-11" />
                  <div className="min-w-0">
                    <div className="line-clamp-1 text-[11px] font-black text-[color:var(--fg)]">{event.name}</div>
                    <div className="text-[9px] font-bold uppercase text-[color:var(--muted)]">{formatDateRange(event.starts_at, event.ends_at)}</div>
                    <div className="line-clamp-1 text-[9px] text-[color:var(--muted)]">{locationLabel(event)}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </section>
        ) : null}

        <section className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
          <EventTypeSelect value={filter} onChange={setFilter} />
          <button
            type="button"
            onClick={() => setShowSavedOnly((v) => !v)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border px-3 text-xs font-bold"
            style={{
              background: showSavedOnly ? "var(--theme-gold)" : "var(--pill)",
              color: showSavedOnly ? "#05080b" : "var(--fg)",
              borderColor: "var(--border)",
            }}
          >
            <Bookmark size={14} fill={showSavedOnly ? "currentColor" : "none"} />
            {showSavedOnly ? "Showing saved" : "Saved Events"}
            <span
              className="rounded bg-black/20 px-1.5 text-[10px]"
              style={{ color: showSavedOnly ? "#05080b" : "var(--muted)" }}
            >
              {savedIds.size}
            </span>
          </button>
        </section>

        <section className="mt-4 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--theme-gold)]">Find Events</div>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Search Google Events through SerpApi by collector category, city or ZIP, and range. Range is a Google-guided nearby search, not an exact radius fence.
              </p>
            </div>
            <label className="block min-w-[170px]">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted)]">Category</span>
              <select
                value={eventSearchCategory}
                onChange={(event) => setEventSearchCategory(event.target.value as EventFilter)}
                className="h-10 w-full rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm font-bold text-[color:var(--fg)] outline-none"
              >
                <option value="convention">Conventions</option>
                <option value="card_show">Card Shows</option>
                <option value="auction">Auctions</option>
                <option value="drop">Drops</option>
                <option value="gallery">Gallery Events</option>
                <option value="music">Music / Vinyl</option>
              </select>
            </label>
            <label className="block w-full lg:w-[170px]">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted)]">City or ZIP</span>
              <input
                value={eventLocation}
                onChange={(event) => setEventLocation(event.target.value.slice(0, 80))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchEvents();
                }}
                placeholder="San Diego or 92101"
                className="h-10 w-full rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm font-bold text-[color:var(--fg)] outline-none placeholder:text-[color:var(--muted)]"
              />
            </label>
            <label className="block min-w-[130px]">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted)]">Range</span>
              <select
                value={eventSearchRadius}
                onChange={(event) => setEventSearchRadius(event.target.value)}
                className="h-10 w-full rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm font-bold text-[color:var(--fg)] outline-none"
              >
                <option value="25">25 miles</option>
                <option value="50">50 miles</option>
                <option value="100">100 miles</option>
                <option value="250">250 miles</option>
              </select>
            </label>
            <label className="block min-w-[150px]">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted)]">Date</span>
              <select
                value={eventSearchRange}
                onChange={(event) => setEventSearchRange(event.target.value)}
                className="h-10 w-full rounded-[7px] border border-[color:var(--border)] bg-[color:var(--pill)] px-3 text-sm font-bold text-[color:var(--fg)] outline-none"
              >
                <option value="next_90">Upcoming</option>
                <option value="this_month">This month</option>
                <option value="next_week">Next week</option>
                <option value="today">Today</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void searchEvents()}
              disabled={eventSearchLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] bg-[color:var(--theme-gold)] px-5 text-sm font-black text-black disabled:opacity-60"
            >
              {eventSearchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </div>

          {(eventSearchError || eventSuggestions.length > 0) && (
            <div className="mt-4 border-t border-[color:var(--border)] pt-4">
              {eventSearchQuery && (
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                  Search: {eventSearchQuery}
                </div>
              )}
              {eventSearchError && (
                <div className="mb-3 rounded-[7px] border border-[color:var(--border)] bg-black/20 px-3 py-2 text-sm text-[color:var(--muted)]">
                  {eventSearchError}
                </div>
              )}
              <div className="grid gap-3">
                {eventSuggestions.map((suggestion) => (
                  <EventSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    saved={savedSuggestionIds.has(suggestion.id)}
                    onSave={() => toggleSavedSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 md:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setFilter(category.key)}
                className="h-8 shrink-0 rounded-[7px] border px-4 text-xs font-bold"
                style={{
                  background: filter === category.key ? "var(--theme-gold)" : "var(--pill)",
                  color: filter === category.key ? "#05080b" : "var(--fg)",
                  borderColor: "var(--border)",
                }}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--theme-gold)]">Upcoming Events</h2>
            </div>

            {loading ? (
              <div className="rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)]">
                Loading events...
              </div>
            ) : error ? (
              <div className="rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-red-300">
                {error}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--muted)]">
                {showSavedOnly
                  ? "You haven't saved any events yet."
                  : "No events listed yet — check back soon, or search for events near you above."}
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-5 gap-3 md:grid">
                  {filteredEvents.slice(0, 5).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      selected={selectedEvent?.id === event.id}
                      saved={savedIds.has(event.id)}
                      onSelect={() => selectEvent(event.id)}
                      onToggleSave={() => toggleSaved(event.id)}
                    />
                  ))}
                </div>
                <div className="space-y-2 md:hidden">
                  {filteredEvents.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      saved={savedIds.has(event.id)}
                      onSelect={() => selectEvent(event.id, true)}
                      onToggleSave={() => toggleSaved(event.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--theme-gold)]">Saved Events</h2>
            </div>
            <div className="space-y-2">
              {(savedEvents.length ? savedEvents : filteredEvents.slice(0, 3)).map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  saved={savedIds.has(event.id)}
                  onSelect={() => selectEvent(event.id, true)}
                  onToggleSave={() => toggleSaved(event.id)}
                />
              ))}
            </div>
          </aside>
        </div>

        {selectedEvent ? (
        <section
          ref={detailRef}
          className="mt-5 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
        >
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--theme-gold)]">Event Highlight</div>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_240px]">
            <EventArt event={selectedEvent} className="h-[132px] md:h-full" />
            <div>
              <h2 className="text-lg font-black text-[color:var(--fg)]">{selectedEvent.name}</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                {formatDateRange(selectedEvent.starts_at, selectedEvent.ends_at)}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{venueLine(selectedEvent)}</p>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[color:var(--muted)]">
                {selectedEvent.long_desc ?? selectedEvent.short_desc ?? "A collector event worth tracking for releases, panels, dealers, and gallery inspiration."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedEvent.relevant_universes ?? ["collectibles"]).slice(0, 3).map((universe) => (
                  <span key={universe} className="rounded-[5px] border border-[color:var(--border)] bg-[color:var(--pill)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--theme-gold)]">
                    {normalizeUniverse(universe)}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[7px] border border-[color:var(--border)] bg-black/10 p-3">
              <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--muted)]">Details</h3>
              <div className="space-y-2 text-sm text-[color:var(--fg)]">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="shrink-0 text-[color:var(--theme-gold)]" />
                  {formatDateRange(selectedEvent.starts_at, selectedEvent.ends_at)}
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-[color:var(--theme-gold)]" />
                  <span>{venueLine(selectedEvent)}</span>
                </div>
                {selectedEvent.admission && (
                  <div className="flex items-center gap-2">
                    <Ticket size={14} className="shrink-0 text-[color:var(--theme-gold)]" />
                    {selectedEvent.admission}
                  </div>
                )}
              </div>
              {(selectedEvent.website_url || selectedEvent.ticket_url) && (
                <a
                  href={selectedEvent.ticket_url ?? selectedEvent.website_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-[color:var(--theme-gold-border)] bg-[color:var(--pill)] text-xs font-black text-[color:var(--theme-gold)]"
                >
                  Event link <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </section>
        ) : null}
      </div>
    </main>
  );
}
