"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type CollectorEvent = {
  id: string;
  slug: string;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  event_type: "local" | "national" | "international";
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

function formatDateRange(starts: string, ends: string): string {
  const s = new Date(starts);
  const e = new Date(ends);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const sStr = s.toLocaleDateString("en-US", opts);
  const eStr = e.toLocaleDateString("en-US", opts);
  const year = s.getFullYear();
  if (sStr === eStr) return `${sStr}, ${year}`;
  if (s.getMonth() === e.getMonth()) {
    const day2 = e.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
    return `${sStr}–${day2}, ${year}`;
  }
  return `${sStr} – ${eStr}, ${year}`;
}

function formatTime(dt: string): string {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function typeBadgeStyle(type: string): { bg: string; color: string; label: string } {
  if (type === "local") return { bg: "rgba(82,194,122,0.14)", color: "#52c27a", label: "Local" };
  if (type === "international") return { bg: "rgba(192,132,252,0.14)", color: "#c084fc", label: "International" };
  return { bg: "rgba(245,181,72,0.14)", color: "#F5B548", label: "National" };
}

function daysUntil(dt: string): number {
  const now = new Date();
  const d = new Date(dt);
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

function CountdownBadge({ starts_at }: { starts_at: string }) {
  const days = daysUntil(starts_at);
  if (days < 0) return null;
  if (days === 0) return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse"
      style={{ background: "rgba(245,181,72,0.2)", color: "#F5B548" }}>TODAY</span>
  );
  if (days <= 7) return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: "rgba(245,181,72,0.15)", color: "#F5B548" }}>
      {days}d away
    </span>
  );
  if (days <= 30) return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "rgba(245,181,72,0.08)", color: "#A0956B" }}>
      {days}d away
    </span>
  );
  return null;
}

function EventCard({ ev, past = false }: { ev: CollectorEvent; past?: boolean }) {
  const badge = typeBadgeStyle(ev.event_type);
  const location = [ev.city, ev.state_region].filter(Boolean).join(", ");
  const hasTickets = ev.ticket_url && ev.ticket_url !== ev.website_url;

  return (
    <div
      className="rounded-[28px] border p-5 flex flex-col gap-4 transition"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.90))",
        borderColor: past ? "rgba(255,255,255,0.05)" : ev.is_featured ? "rgba(245,181,72,0.30)" : "var(--border)",
        opacity: past ? 0.65 : 1,
        boxShadow: ev.is_featured && !past ? "0 0 0 1px rgba(245,181,72,0.15)" : undefined,
      }}
    >
      {/* Top row */}
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {ev.emoji ?? "🎪"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            {ev.is_featured && !past && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "rgba(245,181,72,0.14)", color: "#F5B548" }}>
                ★ Featured
              </span>
            )}
            {!past && <CountdownBadge starts_at={ev.starts_at} />}
          </div>
          <h3 className="text-base font-bold leading-snug" style={{ color: "var(--fg, #EDEBE3)" }}>
            {ev.name}
          </h3>
          <div className="mt-1 text-[12px]" style={{ color: "var(--muted, #A0956B)" }}>
            📅 {formatDateRange(ev.starts_at, ev.ends_at)}
            {!past && (
              <span className="ml-2 opacity-70">
                {formatTime(ev.starts_at)}
              </span>
            )}
          </div>
          {(ev.venue_name || location) && (
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted, #A0956B)" }}>
              📍 {[ev.venue_name, location].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {ev.short_desc && (
        <p className="text-[13px] leading-relaxed" style={{ color: "rgba(237,235,227,0.75)" }}>
          {ev.short_desc}
        </p>
      )}

      {/* Admission + universes row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ev.admission && (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "rgba(82,194,122,0.10)", color: "#52c27a" }}>
            🎟 {ev.admission}
          </span>
        )}
        {(ev.relevant_universes ?? []).map((u) => (
          <span key={u} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted, #A0956B)" }}>
            {u.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        {ev.website_url && (
          <a
            href={ev.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110"
            style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}
          >
            Visit Website ↗
          </a>
        )}
        {hasTickets && (
          <a
            href={ev.ticket_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition hover:brightness-110"
            style={{
              background: "transparent",
              color: "var(--theme-gold, #F5B548)",
              border: "1px solid rgba(245,181,72,0.35)",
            }}
          >
            Get Tickets ↗
          </a>
        )}
      </div>
    </div>
  );
}

type FilterTab = "all" | "local" | "national" | "international" | "past";

export default function EventsPage() {
  const [events, setEvents] = useState<CollectorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Not connected"); setLoading(false); return; }
    supabase
      .from("collector_events")
      .select("*")
      .eq("enabled", true)
      .order("starts_at", { ascending: true })
      .then(({ data, error: e }: { data: CollectorEvent[] | null; error: { message: string } | null }) => {
        if (e) setError(e.message);
        else setEvents((data ?? []) as CollectorEvent[]);
        setLoading(false);
      });
  }, []);

  const now = new Date().toISOString();

  const upcoming = useMemo(
    () => events.filter((e) => e.ends_at >= now),
    [events, now]
  );
  const past = useMemo(
    () => events.filter((e) => e.ends_at < now).slice().reverse(),
    [events, now]
  );

  const displayed = useMemo(() => {
    if (tab === "past") return past;
    if (tab === "all") return upcoming;
    return upcoming.filter((e) => e.event_type === tab);
  }, [tab, upcoming, past]);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${upcoming.length})` },
    { key: "local", label: `Local (${upcoming.filter((e) => e.event_type === "local").length})` },
    { key: "national", label: `National (${upcoming.filter((e) => e.event_type === "national").length})` },
    { key: "international", label: `Intl (${upcoming.filter((e) => e.event_type === "international").length})` },
    { key: "past", label: `Past (${past.length})` },
  ];

  return (
    <div className="" style={{ background: "var(--bg, #0B0F1A)" }}>
      {/* Header */}
      <div className="border-b" style={{ background: "var(--surface, rgba(15,25,45,0.95))", borderColor: "var(--border, rgba(255,255,255,0.07))" }}>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center gap-3 text-sm mb-4" style={{ color: "var(--muted, #A0956B)" }}>
            <Link href="/" style={{ color: "var(--muted, #A0956B)" }}>VLTD</Link>
            <span>/</span>
            <span style={{ color: "var(--fg, #EDEBE3)" }}>Events</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg, #EDEBE3)" }}>
            📅 Upcoming Events
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted, #A0956B)" }}>
            Shows, conventions &amp; collector gatherings
          </p>

          {/* Filter tabs */}
          <div className="mt-5 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition"
                style={{
                  background: tab === t.key ? "var(--theme-gold, #F5B548)" : "rgba(255,255,255,0.05)",
                  color: tab === t.key ? "#0B0B0B" : "var(--muted, #A0956B)",
                  border: tab === t.key ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-sm" style={{ color: "var(--muted, #A0956B)" }}>
            Loading events…
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-red-400">{error}</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4 opacity-30">📅</div>
            <div className="text-sm" style={{ color: "var(--muted, #A0956B)" }}>
              {tab === "past" ? "No past events recorded." : "No upcoming events in this category."}
            </div>
            {tab !== "all" && (
              <button
                onClick={() => setTab("all")}
                className="mt-3 text-sm underline"
                style={{ color: "var(--theme-gold, #F5B548)" }}
              >
                View all events
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tab === "past" && (
              <div className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--muted, #A0956B)", opacity: 0.6 }}>
                Past Events
              </div>
            )}
            {displayed.map((ev) => (
              <EventCard key={ev.id} ev={ev} past={tab === "past"} />
            ))}
          </div>
        )}

        {/* Past events link when viewing upcoming */}
        {tab !== "past" && past.length > 0 && !loading && (
          <div className="mt-10 pt-6 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <button
              onClick={() => setTab("past")}
              className="text-sm"
              style={{ color: "var(--muted, #A0956B)" }}
            >
              View {past.length} past event{past.length !== 1 ? "s" : ""} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
