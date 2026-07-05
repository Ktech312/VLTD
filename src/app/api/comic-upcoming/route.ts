import { NextRequest, NextResponse } from "next/server";

const METRON_BASE = "https://metron.cloud/api";

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
  series: { name: string; year_began?: number } | string;
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
  const publisher =
    typeof item.publisher === "string"
      ? item.publisher
      : (item.publisher?.name ?? "");

  return {
    id: item.id,
    series,
    seriesYearBegan,
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
  const timeout = setTimeout(() => controller.abort(), 12_000);

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

    const params = new URLSearchParams({
      ordering: allIssues ? "-store_date" : "store_date",
      page: String(page),
      page_size: String(pageSize),
    });
    if (!allIssues) {
      params.set("store_date__gte", today);
      params.set("store_date__lte", until);
    }

    if (creatorId) params.set("creator_id", creatorId);
    if (publisher) params.set("publisher_name", publisher);
    if (series) params.set("series_name", series);

    const data: MetronListResponse = await metronFetch(
      `/issue/?${params}`,
      auth,
      controller.signal
    );

    clearTimeout(timeout);

    return NextResponse.json({
      count: data.count,
      page,
      pageSize,
      hasMore: !!data.next,
      dateRange: { from: today, to: until },
      resolvedCreator: resolvedCreator
        ? { id: resolvedCreator.id, name: resolvedCreator.name }
        : creatorId
        ? { id: parseInt(creatorId, 10), name: "" }
        : null,
      results: (data.results ?? []).map(normalizeItem),
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
