import type { SupabaseClient } from "@supabase/supabase-js";
import { earliestStoredEnd, eventPhase } from "@/lib/eventDates";

// What the Events page and Discover's Events section both read, so the preview can never disagree with the page it links to:
// the same table, the same "enabled and not over" rule (the database lets an event through for 12 hours past its stored end, then each
// event is judged in its own time zone) and the same order (soonest first).

export function safeDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** "Oct 30-Nov 1, 2026" style range, printed from the stored UTC calendar days (so the day is the same everywhere). */
export function formatDateRange(starts: string, ends: string): string {
  const start = safeDate(starts);
  const end = safeDate(ends);
  const startText = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endText = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const year = start.getUTCFullYear();

  if (startText === endText) return `${startText}, ${year}`;
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return `${startText}, ${year} - ${endText}, ${end.getUTCFullYear()}`;
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${startText}-${end.getUTCDate()}, ${year}`;
  }
  return `${startText} - ${endText}, ${year}`;
}

export type PreviewEvent = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  city: string | null;
  state_region: string | null;
  country: string | null;
  emoji: string | null;
  image_url: string | null;
  is_featured: boolean;
};

/** The next `count` events that are not over, soonest first, from the same data as the Events page. */
export async function fetchUpcomingEventPreview(supabase: SupabaseClient, count = 4, now: Date = new Date()): Promise<PreviewEvent[]> {
  const { data, error } = await supabase
    .from("collector_events")
    .select("id, slug, name, starts_at, ends_at, city, state_region, country, emoji, image_url, is_featured")
    .eq("enabled", true)
    .gte("ends_at", earliestStoredEnd(now))
    .order("starts_at", { ascending: true })
    .order("id")
    .limit(60);
  if (error) throw error;
  return ((data ?? []) as PreviewEvent[]).filter((event) => eventPhase(event, now) !== "past").slice(0, count);
}
