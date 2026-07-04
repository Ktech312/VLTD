import type { MetronIssueResult } from "@/app/api/comic-lookup/route";

export type ComicLookupResult = {
  /** The series title (e.g. "Amazing Spider-Man") */
  seriesTitle: string;
  /** Issue number as string (e.g. "1", "500") */
  issueNumber: string;
  /** Publisher name (e.g. "Marvel") */
  publisher: string;
  /** Cover date string from Metron (e.g. "1999-01") */
  coverDate: string | null;
  /** Cover image URL from Metron CDN */
  imageUrl: string | null;
  /** Issue description / solicit text */
  description: string | null;
  /** Raw Metron issue ID for future detail lookups */
  metronId: number;
};

export async function lookupComicByUpc(upc: string): Promise<ComicLookupResult | null> {
  const digits = upc.replace(/\D/g, "").trim();
  if (!digits) return null;

  const res = await fetch(`/api/comic-lookup?upc=${encodeURIComponent(digits)}`, {
    method: "GET",
  });

  if (!res.ok) return null;

  const payload = (await res.json()) as { result?: MetronIssueResult | null; error?: string };
  const issue = payload.result;
  if (!issue) return null;

  return {
    seriesTitle: issue.series,
    issueNumber: issue.number,
    publisher: issue.publisher,
    coverDate: issue.coverDate,
    imageUrl: issue.imageUrl,
    description: issue.description,
    metronId: issue.id,
  };
}

export async function lookupComicBySeries(
  seriesName: string,
  number?: string,
  publisher?: string
): Promise<ComicLookupResult | null> {
  if (!seriesName.trim()) return null;

  const params = new URLSearchParams({ series: seriesName.trim() });
  if (number) params.set("number", number.trim());
  if (publisher) params.set("publisher", publisher.trim());

  const res = await fetch(`/api/comic-lookup?${params}`, { method: "GET" });
  if (!res.ok) return null;

  const payload = (await res.json()) as { result?: MetronIssueResult | null; error?: string };
  const issue = payload.result;
  if (!issue) return null;

  return {
    seriesTitle: issue.series,
    issueNumber: issue.number,
    publisher: issue.publisher,
    coverDate: issue.coverDate,
    imageUrl: issue.imageUrl,
    description: issue.description,
    metronId: issue.id,
  };
}

/** Formats a Metron cover_date ("YYYY-MM" or "YYYY-MM-DD") to "Month YYYY" display format */
export function formatComicCoverDate(coverDate: string | null): string {
  if (!coverDate) return "";
  const parts = coverDate.split("-");
  const year = parts[0];
  const month = parts[1] ? parseInt(parts[1], 10) : 0;
  if (!year) return coverDate;
  if (!month) return year;
  const monthName = new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${monthName} ${year}`;
}
