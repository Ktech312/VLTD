import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";

export type { UpcomingIssue };

export type FetchUpcomingOptions = {
  /** How many days ahead to look. Default 60, max 180. */
  days?: number;
  /** Search by creator/artist name. Resolved to Metron creator ID server-side. */
  creator?: string;
  /** Skip name resolution -- pass a known Metron creator ID directly. */
  creatorId?: number;
  /** Filter by publisher name (partial match). */
  publisher?: string;
  /** Filter by series name (partial match). */
  series?: string;
  /** Page number. Default 1. */
  page?: number;
  /** Results per page. Default 25, max 100. */
  pageSize?: number;
};

export type UpcomingComicsResult = {
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  dateRange: { from: string; to: string };
  resolvedCreator: { id: number; name: string } | null;
  results: UpcomingIssue[];
  message?: string;
};

/**
 * Fetches upcoming comic releases from /api/comic-upcoming.
 *
 * @example
 * const data = await fetchUpcomingComics({ creator: "Peach Momoko", days: 90 });
 */
export async function fetchUpcomingComics(
  opts: FetchUpcomingOptions = {}
): Promise<UpcomingComicsResult | null> {
  const params = new URLSearchParams();
  if (opts.days) params.set("days", String(opts.days));
  if (opts.creator) params.set("creator", opts.creator);
  if (opts.creatorId) params.set("creator_id", String(opts.creatorId));
  if (opts.publisher) params.set("publisher", opts.publisher);
  if (opts.series) params.set("series", opts.series);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("page_size", String(opts.pageSize));

  const qs = params.toString();
  const res = await fetch(`/api/comic-upcoming${qs ? "?" + qs : ""}`);
  if (!res.ok) return null;

  const data = (await res.json()) as UpcomingComicsResult & { error?: string };
  if (data.error) return null;

  return data;
}

/**
 * Formats a store date string (YYYY-MM-DD) into a readable label.
 * e.g. "2026-07-09" with long=true -> "Wednesday, July 9"
 */
export function formatStoreDate(dateStr: string | null, long = false): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00Z");
  if (long) {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Groups an array of UpcomingIssue by store date.
 * Returns ordered groups with a human-readable label.
 */
export function groupByStoreDate(
  issues: UpcomingIssue[]
): Array<{ date: string; label: string; issues: UpcomingIssue[] }> {
  const map = new Map<string, UpcomingIssue[]>();

  for (const issue of issues) {
    const key = issue.storeDate ?? "TBD";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(issue);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      label: formatStoreDate(date === "TBD" ? null : date, true),
      issues: items,
    }));
}
