import type { SupabaseClient } from "@supabase/supabase-js";

// The part of the scheduled event refreshes that turns what they found into rows in collector_events, shared by both jobs
// (api/cron/refresh-events and api/cron/refresh-major-events).
//
// Things this exists to get right, each found in the 2026-10-21 banner/events pass:
//  - the same event arriving twice in one run (two categories, or Google Events plus Ticketmaster) used to put the same slug into one bulk upsert twice,
//    which Postgres rejects as a whole ("ON CONFLICT DO UPDATE command cannot affect row a second time"), so nothing from that run was saved;
//  - one bad row used to sink every row sent with it;
//  - the same show already in the table under another slug (the manual importers prefix theirs) was inserted again as a second copy;
//  - a refresh must never blank out what an earlier source or an admin filled in (a null from the new source is not a value), nor undo Disabled.

export type EventRow = {
  slug: string;
  name: string;
  short_desc?: string | null;
  long_desc?: string | null;
  starts_at: string;
  ends_at: string;
  venue_name?: string | null;
  city?: string | null;
  state_region?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  image_url?: string | null;
  country?: string | null;
  relevant_universes?: string[] | null;
  is_featured?: boolean;
};

export type PersistResult = {
  inserted: number;
  updated: number;
  failed: number;
  duplicatesDropped: number;
  matchedExisting: number;
  errors: string[];
};

const DAY_MS = 86_400_000;

/** Lower-case letters and digits only: "L.A. Comic Con", "LA Comic-Con" and "the LA Comic Con 2026" read the same. */
export function normalizeEventName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function cityKey(city: string | null | undefined): string {
  return (city ?? "").split(",")[0].toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function citiesCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cityKey(a);
  const kb = cityKey(b);
  return !ka || !kb || ka === kb;
}

/** name + start day (+ city when known), so two different shows with a generic name on the same day in different cities keep separate rows. */
export function eventSlug(name: string, startDate: string, city?: string | null): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const place = cityKey(city).slice(0, 20);
  return `${base || "event"}-${startDate}${place ? `-${place}` : ""}`;
}

/** True only for a real calendar day written YYYY-MM-DD. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Stored the way the Events page reads it: a start day at 00:00:00Z and an end day at 23:59:59Z (read as UTC, so the printed day is right everywhere;
 * lib/eventDates.ts reads the same pair as the viewer's own calendar days). An end before the start is taken as a one-day event.
 */
export function dayStamps(startDate: string, endDate?: string | null): { starts_at: string; ends_at: string } {
  const end = endDate && isIsoDay(endDate) && endDate >= startDate ? endDate : startDate;
  return { starts_at: `${startDate}T00:00:00.000Z`, ends_at: `${end}T23:59:59.000Z` };
}

function startMs(iso: string): number {
  return Date.parse(iso);
}

/** Drops repeats inside one run: same slug, or same normalised name starting within three days in the same place. The fuller row wins. */
export function dedupeRows<T extends EventRow>(rows: T[]): { rows: T[]; dropped: number } {
  const kept: T[] = [];
  let dropped = 0;
  const filled = (r: T) => Object.values(r).filter((v) => v !== null && v !== undefined && v !== "").length;
  for (const row of rows) {
    const key = normalizeEventName(row.name);
    const i = kept.findIndex(
      (k) =>
        k.slug === row.slug ||
        (normalizeEventName(k.name) === key && Math.abs(startMs(k.starts_at) - startMs(row.starts_at)) <= 3 * DAY_MS && citiesCompatible(k.city, row.city)),
    );
    if (i < 0) {
      kept.push(row);
      continue;
    }
    dropped += 1;
    if (filled(row) > filled(kept[i])) kept[i] = { ...kept[i], ...row, slug: kept[i].slug };
  }
  return { rows: kept, dropped };
}

type ExistingRow = { slug: string; name: string; starts_at: string; city: string | null };

function findExisting(row: EventRow, existing: ExistingRow[]): ExistingRow | null {
  const exact = existing.find((e) => e.slug === row.slug);
  if (exact) return exact;
  const key = normalizeEventName(row.name);
  return (
    existing.find(
      (e) => normalizeEventName(e.name) === key && Math.abs(startMs(e.starts_at) - startMs(row.starts_at)) <= 3 * DAY_MS && citiesCompatible(e.city, row.city),
    ) ?? null
  );
}

/** A row that is already in the table is changed only where the new source has a value, and never in name, slug or Disabled. */
function patchFor(row: EventRow): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "slug" || key === "name") continue;
    if (value === null || value === undefined || value === "") continue;
    patch[key] = value;
  }
  return patch;
}

const INSERT_CHUNK = 25;

export async function persistEvents(svc: SupabaseClient, input: EventRow[]): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, updated: 0, failed: 0, duplicatesDropped: 0, matchedExisting: 0, errors: [] };
  const { rows, dropped } = dedupeRows(input);
  result.duplicatesDropped = dropped;
  if (!rows.length) return result;

  const first = Math.min(...rows.map((r) => startMs(r.starts_at)));
  const last = Math.max(...rows.map((r) => startMs(r.starts_at)));
  const { data: existingData, error: lookupError } = await svc
    .from("collector_events")
    .select("slug, name, starts_at, city")
    .gte("starts_at", new Date(first - 4 * DAY_MS).toISOString())
    .lte("starts_at", new Date(last + 4 * DAY_MS).toISOString())
    .limit(5000);
  if (lookupError) {
    // Nothing is written without knowing what is already there: a blind insert is how a second copy of a show gets made.
    result.failed = rows.length;
    result.errors.push(`lookup of existing events failed: ${lookupError.message}`.slice(0, 300));
    return result;
  }
  const existing = (existingData ?? []) as ExistingRow[];

  const fresh: EventRow[] = [];
  const claimed = new Set<string>();
  for (const row of rows) {
    const match = findExisting(row, existing);
    if (!match) {
      fresh.push(row);
      continue;
    }
    if (claimed.has(match.slug)) {
      result.duplicatesDropped += 1;
      continue;
    }
    claimed.add(match.slug);
    result.matchedExisting += 1;
    const { error } = await svc.from("collector_events").update(patchFor(row)).eq("slug", match.slug);
    if (error) {
      result.failed += 1;
      result.errors.push(`update ${match.slug}: ${error.message}`.slice(0, 300));
    } else result.updated += 1;
  }

  for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
    const chunk = fresh.slice(i, i + INSERT_CHUNK);
    const { error } = await svc.from("collector_events").insert(chunk);
    if (!error) {
      result.inserted += chunk.length;
      continue;
    }
    // One bad row must not sink the others: retry the chunk one row at a time and keep what saves.
    for (const row of chunk) {
      const { error: rowError } = await svc.from("collector_events").insert(row);
      if (rowError) {
        result.failed += 1;
        result.errors.push(`insert ${row.slug}: ${rowError.message}`.slice(0, 300));
      } else result.inserted += 1;
    }
  }
  return result;
}
