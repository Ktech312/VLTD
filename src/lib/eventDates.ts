import { eventTimeZone, type EventPlace } from "@/lib/eventTimeZone";

// Collector events are stored as calendar days, not instants: starts_at is <date>T00:00:00Z and ends_at is <date>T23:59:59Z (the Events page reads
// them as UTC so the printed day is right everywhere). Read as real instants, that made a US event "Happening now!" the evening before it began
// and made it count as over at about 5 pm Pacific on its last day. These helpers read such a pair as calendar days in the EVENT'S OWN time zone
// (named by its place, see eventTimeZone.ts): an LA event is on until midnight Los Angeles time on its last day, wherever the viewer is. When the
// place does not name a zone, the viewer's own calendar is used. An event that carries real times (anything that is not a midnight-to-23:59:59
// pair) is still read as the instants it holds.

export type EventSpan = { starts_at: string; ends_at: string } & EventPlace;
export type EventPhase = "upcoming" | "live" | "past";

const DAY_MS = 86_400_000;

// The database lets an event through until 12 hours after its stored end (the widest gap between UTC and a zone events are held in), and the
// pages then decide, event by event, in the event's own zone. Both the read policy and the pages' queries use this margin.
export const EVENT_VISIBILITY_MARGIN_MS = 12 * 3_600_000;

/** The earliest stored end time worth asking the database for: anything older is over in every time zone. */
export function earliestStoredEnd(now: Date = new Date()): string {
  return new Date(now.getTime() - EVENT_VISIBILITY_MARGIN_MS).toISOString();
}

function isCalendarSpan(e: EventSpan): boolean {
  return /T00:00:00(\.0+)?(Z|\+00:00)$/.test(e.starts_at) && /T23:59:59(\.0+)?(Z|\+00:00)$/.test(e.ends_at);
}

function utcParts(iso: string): { y: number; m: number; d: number } {
  const d = new Date(iso);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/** How far the zone's wall clock is ahead of UTC at that instant, in ms. */
function zoneOffsetMs(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The instant it is 00:00 on that calendar day in the zone (month is 0-based; a day past the end of the month rolls over). */
function zonedMidnight(zone: string, y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m, d);
  const first = guess - zoneOffsetMs(zone, guess);
  return new Date(guess - zoneOffsetMs(zone, first));
}

/** First moment the event counts as started, and the first moment it counts as over. */
export function eventBounds(e: EventSpan): { start: Date; end: Date } {
  if (!isCalendarSpan(e)) return { start: new Date(e.starts_at), end: new Date(e.ends_at) };
  const s = utcParts(e.starts_at);
  const l = utcParts(e.ends_at);
  const zone = eventTimeZone(e);
  if (zone) return { start: zonedMidnight(zone, s.y, s.m, s.d), end: zonedMidnight(zone, l.y, l.m, l.d + 1) };
  return { start: new Date(s.y, s.m, s.d), end: new Date(l.y, l.m, l.d + 1) };
}

export function eventPhase(e: EventSpan, now: Date = new Date()): EventPhase {
  const { start, end } = eventBounds(e);
  if (now.getTime() < start.getTime()) return "upcoming";
  if (now.getTime() < end.getTime()) return "live";
  return "past";
}

/** Today's calendar day in the zone (or the viewer's), as a UTC-midnight number so days can be subtracted. */
function todayNumber(now: Date, zone: string | null): number {
  if (!zone) return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const wall = new Date(now.getTime() + zoneOffsetMs(zone, now.getTime()));
  return Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
}

/** Whole calendar days from today until the event starts (0 = today), counted in the event's own zone (or the viewer's). */
export function daysUntilStart(e: EventSpan, now: Date = new Date()): number {
  if (!isCalendarSpan(e)) {
    const start = new Date(e.starts_at);
    return Math.round((Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) - todayNumber(now, null)) / DAY_MS);
  }
  const s = utcParts(e.starts_at);
  return Math.round((Date.UTC(s.y, s.m, s.d) - todayNumber(now, eventTimeZone(e))) / DAY_MS);
}

export function eventCountdown(e: EventSpan, now: Date = new Date()): string {
  if (eventPhase(e, now) === "live") return "Happening now!";
  const days = Math.max(1, daysUntilStart(e, now));
  const loc = [e.city, e.state_region].filter(Boolean).join(", ");
  const suffix = loc ? ` — ${loc}` : "";
  if (days <= 2) return `This weekend!${suffix}`;
  return `Starts in ${days} day${days !== 1 ? "s" : ""}${suffix}`;
}
