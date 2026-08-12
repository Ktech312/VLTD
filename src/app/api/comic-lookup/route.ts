import { NextRequest, NextResponse } from "next/server";
import { getCachedLookup, putCachedLookup } from "@/lib/server/lookupApiGuard";

const METRON_BASE = "https://metron.cloud/api";

function getBasicAuth() {
  const user = process.env.METRON_USERNAME ?? "";
  const pass = process.env.METRON_PASSWORD ?? "";
  if (!user || !pass) return null;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export type MetronIssueResult = {
  id: number;
  series: string;
  seriesYearBegan?: number;
  number: string;
  publisher: string;
  coverDate: string | null;
  storeDate: string | null;
  imageUrl: string | null;
  description: string | null;
  upc: string | null;
};

type MetronListItem = {
  id: number;
  series: { name: string; volume?: number; year_began?: number } | string;
  number: string;
  publisher?: { id: number; name: string } | string;
  cover_date?: string | null;
  store_date?: string | null;
  image?: string | null;
};

type MetronDetailItem = MetronListItem & {
  desc?: string | null;
  upc?: string | null;
};

function normalizeListItem(item: MetronListItem): Omit<MetronIssueResult, "description" | "upc"> {
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
    coverDate: item.cover_date ?? null,
    storeDate: item.store_date ?? null,
    imageUrl: item.image ?? null,
  };
}

async function fetchMetron(path: string, auth: string, signal?: AbortSignal) {
  const url = `${METRON_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
    signal,
    next: { revalidate: 3600 }, // cache for 1 hour — Metron data rarely changes
  });

  if (res.status === 404) return null;
  if (res.status === 429) {
    // Metron's own docs put its rate limit around 30 requests/minute, not a
    // daily cap -- there's no fixed "quota exhausted for today" state to
    // track like PSA/upcitemdb, so this is just a short, honest wait
    // message rather than a fabricated daily-budget pause.
    throw new Error("Metron is rate-limiting requests right now — wait a few seconds and try again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Metron API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function GET(req: NextRequest) {
  const auth = getBasicAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Metron credentials not configured. Set METRON_USERNAME and METRON_PASSWORD." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const upc = searchParams.get("upc")?.replace(/\D/g, "").trim() ?? "";
  const seriesName = searchParams.get("series")?.trim() ?? "";
  const number = searchParams.get("number")?.trim() ?? "";
  const publisher = searchParams.get("publisher")?.trim() ?? "";

  if (!upc && !seriesName) {
    return NextResponse.json(
      { error: "Provide ?upc=... or ?series=...&number=..." },
      { status: 400 }
    );
  }

  // Permanent cache -- a comic issue's series/publisher/cover-date never
  // changes once published, so a repeat lookup (re-scan, two users with
  // the same issue, testing) costs zero real Metron calls after the first.
  const cacheKey = upc ? `upc:${upc}` : `series:${seriesName}|${number}|${publisher}`;
  const cached = await getCachedLookup<MetronIssueResult>("metron", cacheKey);
  if (cached) {
    return NextResponse.json({ result: cached, cached: true });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let listData: { count: number; results: MetronListItem[] } | null = null;

    // 1. Try UPC lookup first (exact match, fastest)
    if (upc) {
      const params = new URLSearchParams({ upc });
      listData = await fetchMetron(`/issue/?${params}`, auth, controller.signal);
    }

    // 2. Fall back to series+number search
    if ((!listData || listData.count === 0) && seriesName) {
      const params = new URLSearchParams({ series_name: seriesName });
      if (number) params.set("number", number);
      if (publisher) params.set("publisher_name", publisher);
      listData = await fetchMetron(`/issue/?${params}`, auth, controller.signal);
    }

    clearTimeout(timeout);

    if (!listData || listData.count === 0 || !listData.results?.length) {
      return NextResponse.json({ result: null });
    }

    const first = listData.results[0];
    const base = normalizeListItem(first);

    // 3. Fetch detail for description + upc confirmation (one more request)
    let description: string | null = null;
    let confirmedUpc: string | null = null;

    try {
      const detail: MetronDetailItem | null = await fetchMetron(
        `/issue/${first.id}/`,
        auth
      );
      if (detail) {
        description = detail.desc ?? null;
        confirmedUpc = detail.upc ?? null;
      }
    } catch {
      // Detail fetch failure is non-fatal — base data is still good
    }

    const result: MetronIssueResult = {
      ...base,
      description,
      upc: confirmedUpc,
    };

    await putCachedLookup("metron", cacheKey, result);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Comic lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Metron API timed out." }, { status: 504 });
    }
    if (message.includes("rate-limiting")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
