import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";

export type { UpcomingIssue };

export type FetchUpcomingOptions = {
  /** How many days ahead to look. Default 60, max 180. */
  days?: number;
  /** If true, removes date filters and searches all issues (past + future). */
  all?: boolean;
  /** Search by creator/artist name. Resolved server-side. */
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
  source?: "metron" | "marvel" | "comicvine" | "federated";
  message?: string;
  error?: string;
};

/** Federated result: results from multiple sources merged. */
export type FederatedResult = {
  results: UpcomingIssue[];
  sources: {
    metron: { count: number; ok: boolean; message?: string };
    marvel:  { count: number; ok: boolean; message?: string };
    comicvine: { count: number; ok: boolean; message?: string };
  };
  resolvedCreator: { name: string } | null;
};

/* ── Individual source fetchers ──────────────────────────── */

function buildParams(opts: FetchUpcomingOptions): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.days) p.set("days", String(opts.days));
  if (opts.creator) p.set("creator", opts.creator);
  if (opts.creatorId) p.set("creator_id", String(opts.creatorId));
  if (opts.publisher) p.set("publisher", opts.publisher);
  if (opts.series) p.set("series", opts.series);
  if (opts.page) p.set("page", String(opts.page));
  if (opts.pageSize) p.set("page_size", String(opts.pageSize));
  if (opts.all) p.set("all", "true");
  return p;
}

/** Metron (non-Marvel/DC publishers: Dark Horse, Image, IDW, BOOM!, etc.) */
export async function fetchUpcomingComics(
  opts: FetchUpcomingOptions = {}
): Promise<UpcomingComicsResult | null> {
  const qs = buildParams(opts).toString();
  const res = await fetch(`/api/comic-upcoming${qs ? "?" + qs : ""}`);
  if (!res.ok) return null;
  const data = (await res.json()) as UpcomingComicsResult;
  if (data.error) return null;
  return data;
}

/** Marvel API — richest data for Marvel titles (role, variant info). */
export async function fetchMarvelComics(
  opts: FetchUpcomingOptions = {}
): Promise<UpcomingComicsResult | null> {
  const qs = buildParams(opts).toString();
  const res = await fetch(`/api/marvel-comics${qs ? "?" + qs : ""}`);
  if (!res.ok) return null;
  const data = (await res.json()) as UpcomingComicsResult;
  if (data.error) return null;
  return data;
}

/** ComicVine — broadest database, covers all publishers. */
export async function fetchComicVineComics(
  opts: FetchUpcomingOptions = {}
): Promise<UpcomingComicsResult | null> {
  const qs = buildParams(opts).toString();
  const res = await fetch(`/api/comicvine-comics${qs ? "?" + qs : ""}`);
  if (!res.ok) return null;
  const data = (await res.json()) as UpcomingComicsResult;
  if (data.error) return null;
  return data;
}

/**
 * Query all configured sources in parallel and merge results.
 * Deduplicates by (series + number) across sources.
 */
export async function fetchAllSources(
  opts: FetchUpcomingOptions = {}
): Promise<FederatedResult> {
  const [metronRes, marvelRes, cvRes] = await Promise.allSettled([
    fetchUpcomingComics(opts),
    fetchMarvelComics(opts),
    fetchComicVineComics(opts),
  ]);

  const metronData  = metronRes.status  === "fulfilled" ? metronRes.value  : null;
  const marvelData  = marvelRes.status  === "fulfilled" ? marvelRes.value  : null;
  const cvData      = cvRes.status      === "fulfilled" ? cvRes.value      : null;

  // Merge and deduplicate
  const seen = new Set<string>();
  const all: UpcomingIssue[] = [];

  // Priority: Marvel first (best role data), then Metron, then CV
  for (const issue of [
    ...(marvelData?.results ?? []),
    ...(metronData?.results ?? []),
    ...(cvData?.results ?? []),
  ]) {
    const key = `${issue.series.toLowerCase().trim()}#${issue.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(issue);
    }
  }

  // Sort by store date
  all.sort((a, b) => {
    if (!a.storeDate && !b.storeDate) return 0;
    if (!a.storeDate) return 1;
    if (!b.storeDate) return -1;
    return a.storeDate.localeCompare(b.storeDate);
  });

  const resolvedName =
    marvelData?.resolvedCreator?.name ??
    metronData?.resolvedCreator?.name ??
    cvData?.resolvedCreator?.name ??
    null;

  return {
    results: all,
    sources: {
      metron:    { count: metronData?.results.length ?? 0, ok: !!metronData, message: metronData?.message },
      marvel:    { count: marvelData?.results.length ?? 0, ok: !!marvelData, message: marvelData?.message },
      comicvine: { count: cvData?.results.length    ?? 0, ok: !!cvData,     message: cvData?.message },
    },
    resolvedCreator: resolvedName ? { name: resolvedName } : null,
  };
}

/* ── Date formatting ─────────────────────────────────────── */

export function formatStoreDate(dateStr: string | null, long = false): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00Z");
  if (long) {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
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

/* ── Role helpers ────────────────────────────────────────── */

const COVER_ROLES = ["cover", "cover artist", "cover colorist", "variant cover"];
const INTERIOR_ROLES = ["penciler", "penciller", "inker", "writer", "colorist", "artist", "interior"];

export function roleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (COVER_ROLES.some((c) => r.includes(c))) return "Cover";
  if (INTERIOR_ROLES.some((i) => r.includes(i))) return "Interior";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function isCoverOnlyRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return COVER_ROLES.some((c) => r.includes(c)) &&
    !INTERIOR_ROLES.some((i) => r.includes(i));
}
