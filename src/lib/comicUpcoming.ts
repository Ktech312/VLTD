import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";

export type { UpcomingIssue };

export type FetchUpcomingOptions = {
  /** How many days ahead to look. Default 60, max 180. */
  days?: number;
  /** If true, removes date filters and searches all issues (past + future). */
  all?: boolean;
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
  dateRange?: { from: string; to: string };
  resolvedCreator: { id: number; name: string } | null;
  results: UpcomingIssue[];
  message?: string;
  error?: string;
};

/* ── Fetch from Metron ───────────────────────────────────── */

export async function fetchUpcomingComics(
  opts: FetchUpcomingOptions = {}
): Promise<UpcomingComicsResult | null> {
  const p = new URLSearchParams();
  if (opts.days)      p.set("days", String(opts.days));
  if (opts.creator)   p.set("creator", opts.creator);
  if (opts.creatorId) p.set("creator_id", String(opts.creatorId));
  if (opts.publisher) p.set("publisher", opts.publisher);
  if (opts.series)    p.set("series", opts.series);
  if (opts.page)      p.set("page", String(opts.page));
  if (opts.pageSize)  p.set("page_size", String(opts.pageSize));
  if (opts.all)       p.set("all", "true");

  const qs = p.toString();
  const res = await fetch(`/api/comic-upcoming${qs ? "?" + qs : ""}`);
  if (!res.ok) return null;

  const data = (await res.json()) as UpcomingComicsResult;
  if (data.error) return null;

  // Annotate variant info from issue number patterns (Metron doesn't expose roles)
  data.results = data.results.map(annotateVariant);

  return data;
}

/** Alias kept for components that call fetchAllSources */
export const fetchAllSources = fetchUpcomingComics;

/* ── Variant detection from Metron issue number ──────────── */

/**
 * Metron encodes variants in the issue number field.
 * Examples: "1B", "1C", "1 (Variant)", "1 (Directors Cut)",
 *           "½", "1 (2nd Print)", "1A" (A cover = main, B+ = variants)
 */
export function detectVariant(number: string): boolean {
  const n = number.trim();

  // Letter suffix after digits: "1B", "2C", "10D"
  // Note: "1A" is usually the main cover, "1B" onward are variants
  if (/^\d+[B-Za-z]$/i.test(n) && !/^1a$/i.test(n)) return true;

  // Explicit keywords in parens: "1 (Variant)", "1 (Director's Cut)"
  const lower = n.toLowerCase();
  if (lower.includes("variant") || lower.includes("director") ||
      lower.includes("2nd print") || lower.includes("second print") ||
      lower.includes("reprint") || lower.includes("facsimile")) return true;

  return false;
}

function annotateVariant(issue: UpcomingIssue): UpcomingIssue {
  if (issue.isVariant !== undefined) return issue; // already set (Marvel/CV)
  return { ...issue, isVariant: detectVariant(issue.number) };
}

/* ── Date formatting ─────────────────────────────────────── */

export function formatStoreDate(dateStr: string | null, long = false): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00Z");
  if (long) {
    return d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

/* ── Grouping ────────────────────────────────────────────── */

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

/* ── Role helpers (kept for type compatibility) ──────────── */

export function roleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes("cover")) return "Cover";
  if (r.includes("pencil") || r.includes("interior") || r.includes("artist")) return "Interior";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function isCoverOnlyRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r.includes("cover") && !r.includes("interior") && !r.includes("pencil");
}

