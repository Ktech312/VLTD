import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const MARVEL_BASE = "https://gateway.marvel.com/v1/public";

function getMarvelAuth() {
  const pub = process.env.MARVEL_PUBLIC_KEY ?? "";
  const priv = process.env.MARVEL_PRIVATE_KEY ?? "";
  if (!pub || !priv) return null;
  const ts = Date.now().toString();
  const hash = createHash("md5").update(ts + priv + pub).digest("hex");
  return { pub, ts, hash };
}

export type MarvelIssueResult = {
  id: number;
  series: string;
  number: string;
  publisher: "Marvel Comics";
  storeDate: string | null;
  coverDate: string | null;
  imageUrl: string | null;
  source: "marvel";
  creatorRole: string | null;   // e.g. "cover artist", "penciler", "writer"
  isVariant: boolean;
  variantDescription: string | null;
};

type MarvelComicDate = { type: string; date: string };
type MarvelCreatorItem = { name: string; role: string; resourceURI: string };
type MarvelComic = {
  id: number;
  title: string;
  issueNumber: number;
  variantDescription?: string;
  dates: MarvelComicDate[];
  thumbnail: { path: string; extension: string } | null;
  series: { name: string };
  creators: { items: MarvelCreatorItem[] };
};

type MarvelListResponse = {
  data: {
    total: number;
    count: number;
    results: MarvelComic[];
  };
};

type MarvelCreator = { id: number; fullName: string };
type MarvelCreatorResponse = {
  data: { total: number; results: MarvelCreator[] };
};

async function marvelFetch(path: string, auth: ReturnType<typeof getMarvelAuth>, signal?: AbortSignal) {
  if (!auth) throw new Error("No Marvel credentials");
  const url = new URL(`${MARVEL_BASE}${path}`);
  url.searchParams.set("apikey", auth.pub);
  url.searchParams.set("ts", auth.ts);
  url.searchParams.set("hash", auth.hash);
  const res = await fetch(url.toString(), { signal, next: { revalidate: 3600 } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Marvel ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function parseStoreDate(dates: MarvelComicDate[]): string | null {
  const onsale = dates.find((d) => d.type === "onsaleDate");
  if (!onsale?.date) return null;
  // Marvel returns ISO string; some are "-0001-11-30T00:00:00-0500" for unknown
  if (onsale.date.startsWith("-")) return null;
  return onsale.date.slice(0, 10); // YYYY-MM-DD
}

function parseFocDate(dates: MarvelComicDate[]): string | null {
  const foc = dates.find((d) => d.type === "focDate");
  if (!foc?.date || foc.date.startsWith("-")) return null;
  return foc.date.slice(0, 10);
}

function normalizeComic(comic: MarvelComic, searchedCreatorName: string): MarvelIssueResult {
  const thumb = comic.thumbnail;
  const imageUrl =
    thumb && !thumb.path.includes("image_not_available")
      ? `${thumb.path}.${thumb.extension}`
      : null;

  // Extract the searched creator's role from this issue
  const creatorEntry = comic.creators.items.find(
    (c) => c.name.toLowerCase().includes(searchedCreatorName.toLowerCase()) ||
           searchedCreatorName.toLowerCase().includes(c.name.toLowerCase().split(" ")[0])
  );

  const storeDate = parseStoreDate(comic.dates);
  const focDate = parseFocDate(comic.dates);

  // Series name from Marvel often has year in parens: "Amazing Spider-Man (2018)"
  const seriesName = comic.series.name;

  return {
    id: comic.id,
    series: seriesName,
    number: String(comic.issueNumber || "1"),
    publisher: "Marvel Comics",
    storeDate,
    coverDate: focDate,
    imageUrl,
    source: "marvel",
    creatorRole: creatorEntry?.role ?? null,
    isVariant: !!(comic.variantDescription && comic.variantDescription.trim().length > 0),
    variantDescription: comic.variantDescription || null,
  };
}

export async function GET(req: NextRequest) {
  const auth = getMarvelAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Marvel API credentials not configured. Add MARVEL_PUBLIC_KEY and MARVEL_PRIVATE_KEY to .env.local." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const creatorName = searchParams.get("creator")?.trim() ?? "";
  const seriesName = searchParams.get("series")?.trim() ?? "";
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
    let resolvedCreatorId: number | null = null;
    let resolvedCreatorName = creatorName;

    if (creatorName) {
      // Step 1: resolve creator name → Marvel creator ID
      const creatorParams = new URLSearchParams({
        nameStartsWith: creatorName,
        limit: "5",
      });
      const creatorData: MarvelCreatorResponse = await marvelFetch(
        `/creators?${creatorParams}`,
        auth,
        controller.signal
      );

      if (!creatorData.data?.results?.length) {
        clearTimeout(timeout);
        return NextResponse.json({
          count: 0,
          page,
          pageSize,
          hasMore: false,
          resolvedCreator: null,
          results: [],
          source: "marvel",
          message: `No creator found on Marvel matching "${creatorName}".`,
        });
      }

      const match = creatorData.data.results[0];
      resolvedCreatorId = match.id;
      resolvedCreatorName = match.fullName;
    }

    // Step 2: fetch comics
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    const comicParams = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    if (!allIssues) {
      comicParams.set("dateRange", `${today},${until}`);
    }
    comicParams.set("orderBy", allIssues ? "-onsaleDate" : "onsaleDate");

    let endpoint: string;
    if (resolvedCreatorId) {
      endpoint = `/creators/${resolvedCreatorId}/comics?${comicParams}`;
    } else {
      comicParams.set("titleStartsWith", seriesName);
      endpoint = `/comics?${comicParams}`;
    }

    const comicData: MarvelListResponse = await marvelFetch(endpoint, auth, controller.signal);
    clearTimeout(timeout);

    const results = (comicData.data?.results ?? []).map((c) =>
      normalizeComic(c, resolvedCreatorName)
    );

    const total = comicData.data?.total ?? 0;
    const fetched = offset + results.length;

    return NextResponse.json({
      count: total,
      page,
      pageSize,
      hasMore: fetched < total,
      resolvedCreator: resolvedCreatorId
        ? { id: resolvedCreatorId, name: resolvedCreatorName }
        : null,
      results,
      source: "marvel",
    });
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Marvel API timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
