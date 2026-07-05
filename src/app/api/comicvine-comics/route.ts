import { NextRequest, NextResponse } from "next/server";

const CV_BASE = "https://comicvine.gamespot.com/api";

function getApiKey() {
  return process.env.COMICVINE_API_KEY ?? "";
}

export type ComicVineIssueResult = {
  id: number;
  series: string;
  number: string;
  publisher: string;
  storeDate: string | null;
  coverDate: string | null;
  imageUrl: string | null;
  source: "comicvine";
  creatorRole: string | null;
  isVariant: boolean;
  variantDescription: string | null;
};

type CVPersonResult = { id: number; name: string; site_detail_url: string };
type CVSearchResponse = { results: CVPersonResult[] };

type CVPersonCredit = { id: number; name: string; role: string };
type CVIssue = {
  id: number;
  name: string | null;
  issue_number: string;
  store_date: string | null;
  cover_date: string | null;
  image: { original_url?: string; medium_url?: string } | null;
  volume: { name: string; publisher?: { name: string } } | null;
  person_credits: CVPersonCredit[];
};
type CVIssueResponse = { results: CVIssue[]; number_of_total_results: number };

async function cvFetch(path: string, params: URLSearchParams, signal?: AbortSignal) {
  const key = getApiKey();
  if (!key) throw new Error("No ComicVine API key");
  params.set("api_key", key);
  params.set("format", "json");
  const res = await fetch(`${CV_BASE}${path}?${params}`, {
    signal,
    headers: { "User-Agent": "VLTD-App/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ComicVine ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function normalizeIssue(issue: CVIssue, searchedCreatorName: string): ComicVineIssueResult {
  const imageUrl = issue.image?.medium_url ?? issue.image?.original_url ?? null;
  const publisher = issue.volume?.publisher?.name ?? "";

  // Find the searched creator's role
  const lower = searchedCreatorName.toLowerCase();
  const creatorEntry = issue.person_credits?.find((p) =>
    p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
  );

  // Detect variant by name patterns
  const titleLower = (issue.name ?? "").toLowerCase();
  const isVariant =
    titleLower.includes("variant") ||
    titleLower.includes("cover") ||
    (creatorEntry?.role ?? "").toLowerCase().includes("cover");

  return {
    id: issue.id,
    series: issue.volume?.name ?? "Unknown",
    number: issue.issue_number ?? "1",
    publisher,
    storeDate: issue.store_date ?? null,
    coverDate: issue.cover_date ?? null,
    imageUrl: imageUrl ?? null,
    source: "comicvine",
    creatorRole: creatorEntry?.role ?? null,
    isVariant,
    variantDescription: isVariant ? (issue.name ?? null) : null,
  };
}

export async function GET(req: NextRequest) {
  const key = getApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "ComicVine API key not configured. Add COMICVINE_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const creatorName = searchParams.get("creator")?.trim() ?? "";
  const seriesName = searchParams.get("series")?.trim() ?? "";
  const publisher = searchParams.get("publisher")?.trim() ?? "";
  const allIssues = searchParams.get("all") === "true";
  const days = Math.min(Math.max(1, parseInt(searchParams.get("days") ?? "90", 10)), 365);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get("page_size") ?? "25", 10)), 100);
  const offset = (page - 1) * pageSize;

  if (!creatorName && !seriesName) {
    return NextResponse.json({ error: "Provide creator= or series= param." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    let resolvedPersonId: number | null = null;
    let resolvedPersonName = creatorName;

    if (creatorName) {
      // Step 1: search for person
      const searchParams2 = new URLSearchParams({
        query: creatorName,
        resources: "person",
        limit: "5",
        field_list: "id,name",
      });
      const searchData: CVSearchResponse = await cvFetch("/search/", searchParams2, controller.signal);

      if (!searchData.results?.length) {
        clearTimeout(timeout);
        return NextResponse.json({
          count: 0,
          page,
          pageSize,
          hasMore: false,
          resolvedCreator: null,
          results: [],
          source: "comicvine",
          message: `No creator found on ComicVine matching "${creatorName}".`,
        });
      }

      const match = searchData.results[0];
      resolvedPersonId = match.id;
      resolvedPersonName = match.name;
    }

    // Step 2: build issue filter
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    const filterParts: string[] = [];
    if (resolvedPersonId) filterParts.push(`person_credits:${resolvedPersonId}`);
    if (!allIssues) {
      filterParts.push(`store_date:${today}|${until}`);
    }
    if (publisher) filterParts.push(`publisher:${publisher}`);
    if (seriesName) filterParts.push(`volume:${seriesName}`);

    const issueParams = new URLSearchParams({
      filter: filterParts.join(","),
      offset: String(offset),
      limit: String(pageSize),
      sort: allIssues ? "store_date:desc" : "store_date:asc",
      field_list: "id,name,issue_number,store_date,cover_date,image,volume,person_credits",
    });

    const issueData: CVIssueResponse = await cvFetch("/issues/", issueParams, controller.signal);
    clearTimeout(timeout);

    const results = (issueData.results ?? []).map((i) =>
      normalizeIssue(i, resolvedPersonName)
    );

    const total = issueData.number_of_total_results ?? 0;
    const fetched = offset + results.length;

    return NextResponse.json({
      count: total,
      page,
      pageSize,
      hasMore: fetched < total,
      resolvedCreator: resolvedPersonId
        ? { id: resolvedPersonId, name: resolvedPersonName }
        : null,
      results,
      source: "comicvine",
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "ComicVine API timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
