import { NextRequest, NextResponse } from "next/server";

const METRON_BASE = "https://metron.cloud/api";
const METRON_PAGE = 100; // Metron's fixed page size
const MAX_PAGES = 10; // 1,000 issues; 180 days of all publishers was ~670 in Oct 2026

function getBasicAuth() {
  const user = process.env.METRON_USERNAME ?? "";
  const pass = process.env.METRON_PASSWORD ?? "";
  if (!user || !pass) return null;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export type UpcomingIssue = {
  id: number;
  series: string;
  seriesYearBegan?: number;
  /** Metron's series id when the list answer includes it. */
  seriesId?: number;
  number: string;
  publisher: string;
  storeDate: string | null;
  coverDate: string | null;
  imageUrl: string | null;
  // Multi-source fields
  source?: "metron" | "marvel" | "comicvine";
  creatorRole?: string | null;
  isVariant?: boolean;
  variantDescription?: string | null;
};

export type CreatorResult = {
  id: number;
  name: string;
};

type MetronListItem = {
  id: number;
  series: { id?: number; name: string; year_began?: number } | string;
  number: string;
  publisher?: { id: number; name: string } | string;
  cover_date?: string | null;
  store_date?: string | null;
  image?: string | null;
};

type MetronListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: MetronListItem[];
};

type MetronCreatorItem = {
  id: number;
  name: string;
};

type MetronCreatorResponse = {
  count: number;
  results: MetronCreatorItem[];
};

function normalizeItem(item: MetronListItem): UpcomingIssue {
  const series =
    typeof item.series === "string" ? item.series : (item.series?.name ?? "");
  const seriesYearBegan =
    typeof item.series === "object" ? (item.series?.year_began ?? undefined) : undefined;
  // The catalog's own series id, when its list answer carries one: it is what makes a Following rule match exactly one series.
  const seriesId = typeof item.series === "object" && typeof item.series?.id === "number" ? item.series.id : undefined;
  const publisher =
    typeof item.publisher === "string"
      ? item.publisher
      : (item.publisher?.name ?? "");

  return {
    id: item.id,
    series,
    seriesYearBegan,
    seriesId,
    number: item.number ?? "",
    publisher,
    storeDate: item.store_date ?? null,
    coverDate: item.cover_date ?? null,
    imageUrl: item.image ?? null,
    source: "metron" as const,
  };
}

async function metronFetch(path: string, auth: string, signal?: AbortSignal) {
  const res = await fetch(`${METRON_BASE}${path}`, {
    headers: { Authorization: auth, Accept: "application/json" },
    signal,
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Metron ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveCreatorId(
  name: string,
  auth: string,
  signal?: AbortSignal
): Promise<{ id: number; name: string } | null> {
  const params = new URLSearchParams({ name, page_size: "5" });
  const data: MetronCreatorResponse = await metronFetch(
    `/creator/?${params}`,
    auth,
    signal
  );
  if (!data.results?.length) return null;
  return { id: data.results[0].id, name: data.results[0].name };
}

export async function GET(req: NextRequest) {
  const auth = getBasicAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Metron credentials not configured." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);

  const allIssues = searchParams.get("all") === "true";

  // One issue by its catalog id (a date check for a release already on someone's list). Not the permanent lookup cache: a date can change, so this goes to the
  // catalog (which VLTD's server caches for an hour). An issue the catalog no longer has answers with no results; only a real failure is an error.
  const issueId = searchParams.get("id")?.replace(/\D/g, "") ?? "";
  if (issueId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const detail: MetronListItem = await metronFetch(`/issue/${issueId}/`, auth, controller.signal);
      clearTimeout(timeout);
      return NextResponse.json({ count: 1, page: 1, pageSize: 1, hasMore: false, resolvedCreator: null, results: [normalizeItem(detail)] });
    } catch (error) {
      clearTimeout(timeout);
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.startsWith("Metron 404")) return NextResponse.json({ count: 0, page: 1, pageSize: 1, hasMore: false, resolvedCreator: null, results: [] });
      if (message.includes("abort")) return NextResponse.json({ error: "Metron API timed out." }, { status: 504 });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const days = Math.min(
    Math.max(1, parseInt(searchParams.get("days") ?? "60", 10)),
    180
  );

  const creatorName = searchParams.get("creator")?.trim() ?? "";
  const creatorIdParam = searchParams.get("creator_id")?.trim() ?? "";
  const publisher = searchParams.get("publisher")?.trim() ?? "";
  const series = searchParams.get("series")?.trim() ?? "";

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    Math.max(1, parseInt(searchParams.get("page_size") ?? "25", 10)),
    100
  );

  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const controller = new AbortController();
  // Upcoming mode fans out to ~7 parallel Metron pages on a cold cache.
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    let creatorId = creatorIdParam;
    let resolvedCreator: { id: number; name: string } | null = null;

    if (creatorName && !creatorId) {
      resolvedCreator = await resolveCreatorId(creatorName, auth, controller.signal);
      if (!resolvedCreator) {
        clearTimeout(timeout);
        return NextResponse.json({
          count: 0,
          page,
          pageSize,
          hasMore: false,
          dateRange: { from: today, to: until },
          resolvedCreator: null,
          results: [],
          message: `No creator found matching "${creatorName}".`,
        });
      }
      creatorId = String(resolvedCreator.id);
    }

    const params = new URLSearchParams();
    // Metron's date filter names -- `store_date__gte`/`__lte` are silently
    // ignored, which returned the whole back catalog instead of upcoming books.
    if (!allIssues) {
      params.set("store_date_range_after", today);
      params.set("store_date_range_before", until);
    }

    if (creatorId) params.set("creator_id", creatorId);
    if (publisher) params.set("publisher_name", publisher);
    if (series) params.set("series_name", series);

    let count: number;
    let hasMore: boolean;
    let items: MetronListItem[];

    if (allIssues) {
      // Back-catalog browsing: too big to pull whole, so page straight through.
      params.set("page", String(page));
      const data: MetronListResponse = await metronFetch(`/issue/?${params}`, auth, controller.signal);
      count = data.count;
      hasMore = !!data.next;
      items = data.results ?? [];
    } else {
      // Metron ignores `ordering` and `page_size` (always 100 per page, A-Z by
      // series), so pull every page in the window, sort by release date here,
      // then hand back the requested slice. Each page URL is cached for an
      // hour, which keeps this well inside Metron's 20 requests/minute.
      const first: MetronListResponse = await metronFetch(`/issue/?${params}&page=1`, auth, controller.signal);
      const totalPages = Math.min(Math.ceil((first.count ?? 0) / METRON_PAGE), MAX_PAGES);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) =>
          metronFetch(`/issue/?${params}&page=${i + 2}`, auth, controller.signal) as Promise<MetronListResponse>
        )
      );
      const all = [first, ...rest].flatMap((d) => d.results ?? []);
      all.sort((a, b) =>
        (a.store_date ?? "9999").localeCompare(b.store_date ?? "9999") ||
        normalizeItem(a).series.localeCompare(normalizeItem(b).series) ||
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
      );
      count = all.length;
      if (searchParams.get("by") === "date") {
        // One whole release date per page, so "Load more" always adds a new
        // dated row below instead of quietly lengthening a row off-screen.
        const dates = Array.from(new Set(all.map((i) => i.store_date ?? "TBD")));
        const date = dates[page - 1];
        items = date === undefined ? [] : all.filter((i) => (i.store_date ?? "TBD") === date);
        hasMore = page < dates.length;
      } else {
        items = all.slice((page - 1) * pageSize, page * pageSize);
        hasMore = page * pageSize < all.length;
      }
    }

    clearTimeout(timeout);

    return NextResponse.json({
      count,
      page,
      pageSize,
      hasMore,
      dateRange: { from: today, to: until },
      resolvedCreator: resolvedCreator
        ? { id: resolvedCreator.id, name: resolvedCreator.name }
        : creatorId
        ? { id: parseInt(creatorId, 10), name: "" }
        : null,
      results: items.map(normalizeItem),
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Metron API timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
