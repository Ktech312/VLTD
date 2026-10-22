// Collector events are stored as calendar days, not instants: starts_at is <date>T00:00:00Z and ends_at is <date>T23:59:59Z (the Events page reads
// them as UTC so the printed day is right everywhere). Read as real instants, that made a US event "Happening now!" the evening before it began
// and made it count as over late on its last day. These helpers read such a pair as the viewer's own calendar days; an event that carries real
// times (anything that is not a midnight-to-23:59:59 pair) is still read as the instants it holds.

export type EventSpan = { starts_at: string; ends_at: string };
export type EventPhase = "upcoming" | "live" | "past";

const DAY_MS = 86_400_000;

function isCalendarSpan(e: EventSpan): boolean {
  return /T00:00:00(\.0+)?(Z|\+00:00)$/.test(e.starts_at) && /T23:59:59(\.0+)?(Z|\+00:00)$/.test(e.ends_at);
}

function utcDayAsLocal(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** First moment the event counts as started, and the first moment it counts as over, in the viewer's time. */
export function eventBounds(e: EventSpan): { start: Date; end: Date } {
  if (isCalendarSpan(e)) {
    const last = utcDayAsLocal(e.ends_at);
    return { start: utcDayAsLocal(e.starts_at), end: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1) };
  }
  return { start: new Date(e.starts_at), end: new Date(e.ends_at) };
}

export function eventPhase(e: EventSpan, now: Date = new Date()): EventPhase {
  const { start, end } = eventBounds(e);
  if (now.getTime() < start.getTime()) return "upcoming";
  if (now.getTime() < end.getTime()) return "live";
  return "past";
}

/** Whole calendar days from today until the event starts (0 = today), in the viewer's time. */
export function daysUntilStart(e: EventSpan, now: Date = new Date()): number {
  const start = localMidnight(eventBounds(e).start);
  return Math.round((start.getTime() - localMidnight(now).getTime()) / DAY_MS);
}

type EventPlace = { city?: string | null; state_region?: string | null };

export function eventCountdown(e: EventSpan & EventPlace, now: Date = new Date()): string {
  if (eventPhase(e, now) === "live") return "Happening now!";
  const days = Math.max(1, daysUntilStart(e, now));
  const loc = [e.city, e.state_region].filter(Boolean).join(", ");
  const suffix = loc ? ` — ${loc}` : "";
  if (days <= 2) return `This weekend!${suffix}`;
  return `Starts in ${days} day${days !== 1 ? "s" : ""}${suffix}`;
}
