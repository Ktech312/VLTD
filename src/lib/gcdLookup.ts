/**
 * GCD (Grand Comics Database) comic lookup — client helper.
 *
 * Calls the /api/gcd-search route (backed by Supabase) and normalizes the
 * result for the add/scan flow. Used as a fallback/complement to Metron:
 * GCD's English subset (~900k issues) is broader, so it fills gaps Metron
 * misses, especially by barcode.
 */

export type GcdComicMatch = {
  series: string;
  number: string;
  publisher: string;
  coverDate: string | null;
  barcode: string | null;
  isbn: string | null;
};

type GcdSearchResponse = {
  results?: Array<{
    series?: string;
    number?: string;
    publisher?: string;
    coverDate?: string | null;
    barcode?: string | null;
    isbn?: string | null;
  }>;
};

/** GCD key_date is "YYYY-MM-DD" with "00" for unknown parts. Trim to what's known. */
export function cleanGcdDate(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const [y, m, d] = value.split("-");
  if (!y || y === "0000") return null;
  if (d && d !== "00") return `${y}-${m}-${d}`;
  if (m && m !== "00") return `${y}-${m}`;
  return y;
}

function firstMatch(data: GcdSearchResponse): GcdComicMatch | null {
  const first = data.results?.[0];
  if (!first?.series) return null;
  return {
    series: first.series,
    number: String(first.number ?? "").trim(),
    publisher: String(first.publisher ?? "").trim(),
    coverDate: cleanGcdDate(first.coverDate),
    barcode: first.barcode ?? null,
    isbn: first.isbn ?? null,
  };
}

async function fetchSearch(params: Record<string, string>): Promise<GcdSearchResponse | null> {
  const qs = new URLSearchParams({ ...params, per_page: "1" }).toString();
  try {
    const res = await fetch(`/api/gcd-search?${qs}`);
    if (!res.ok) return null;
    return (await res.json()) as GcdSearchResponse;
  } catch {
    return null;
  }
}

/** Look up a comic by scanned barcode (UPC/EAN). Supplement-tolerant server-side. */
export async function lookupComicByBarcode(barcodeDigits: string): Promise<GcdComicMatch | null> {
  const clean = String(barcodeDigits ?? "").replace(/\D/g, "");
  if (clean.length < 8) return null;
  const data = await fetchSearch({ barcode: clean });
  return data ? firstMatch(data) : null;
}

/** Look up a comic by series title + issue number (OCR fallback). */
export async function lookupComicBySeriesIssue(
  series: string,
  issueNumber: string
): Promise<GcdComicMatch | null> {
  const s = String(series ?? "").trim();
  const n = String(issueNumber ?? "").trim();
  if (s.length < 2) return null;
  const params: Record<string, string> = { series: s };
  if (n) params.issue = n;
  const data = await fetchSearch(params);
  return data ? firstMatch(data) : null;
}
