import { NextRequest, NextResponse } from "next/server";
import { getCachedLookup, putCachedLookup } from "@/lib/server/lookupApiGuard";

const DISCOGS_BASE = "https://api.discogs.com";

function getAuth(): string | null {
  const token = process.env.DISCOGS_TOKEN ?? "";
  if (!token) return null;
  return `Discogs token=${token}`;
}

// Discogs requires a User-Agent or they return 403
const USER_AGENT = "VLTD/1.0 +https://vltd.app";

export type DiscogsReleaseResult = {
  id: number;
  artist: string;
  albumTitle: string;
  label: string | null;
  year: string | null;
  country: string | null;
  genre: string | null;
  format: string | null;
  imageUrl: string | null;
  catno: string | null;
  barcode: string | null;
  resourceUrl: string;
};

type DiscogsSearchItem = {
  id: number;
  title: string; // "Artist - Album Title"
  year?: string;
  country?: string;
  label?: string[];
  catno?: string;
  genre?: string[];
  style?: string[];
  format?: string[];
  thumb?: string;
  cover_image?: string;
  barcode?: string[];
  resource_url: string;
};

function parseArtistTitle(raw: string): { artist: string; albumTitle: string } {
  // Discogs format: "Artist - Album Title" — split on first " - "
  const sep = raw.indexOf(" - ");
  if (sep === -1) return { artist: "", albumTitle: raw.trim() };
  return {
    artist: raw.slice(0, sep).trim(),
    albumTitle: raw.slice(sep + 3).trim(),
  };
}

async function fetchDiscogs(path: string, auth: string, signal?: AbortSignal) {
  const url = `${DISCOGS_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: auth,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal,
    next: { revalidate: 3600 }, // cache 1 hour
  });

  if (res.status === 404) return null;
  if (res.status === 429) {
    // Discogs' documented limit is per-MINUTE (60/min authenticated), not a
    // daily cap -- same reasoning as Metron below: an honest short-wait
    // message, not a fabricated daily-budget pause.
    throw new Error("Discogs is rate-limiting requests right now — wait a few seconds and try again.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discogs API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const auth = getAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Discogs token not configured. Set DISCOGS_TOKEN." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode")?.replace(/[^0-9]/g, "").trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  const album = searchParams.get("album")?.trim() ?? "";

  if (!barcode && !artist && !album) {
    return NextResponse.json(
      { error: "Provide ?barcode=... or ?artist=...&album=..." },
      { status: 400 }
    );
  }

  // Permanent cache -- a specific pressing's artist/label/year/country never
  // changes once released, so a repeat lookup costs zero real Discogs calls
  // after the first.
  const cacheKey = barcode ? `barcode:${barcode}` : `text:${artist}|${album}`;
  const cached = await getCachedLookup<DiscogsReleaseResult>("discogs", cacheKey);
  if (cached) {
    return NextResponse.json({ result: cached, cached: true });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let searchData: { results: DiscogsSearchItem[]; pagination: { items: number } } | null = null;

    // 1. Barcode lookup (most precise — exact pressing)
    if (barcode) {
      const params = new URLSearchParams({ barcode, type: "release" });
      searchData = await fetchDiscogs(`/database/search?${params}`, auth, controller.signal);
    }

    // 2. Fallback: artist + album text search
    if ((!searchData || searchData.results.length === 0) && (artist || album)) {
      const params = new URLSearchParams({ type: "release" });
      if (artist) params.set("artist", artist);
      if (album) params.set("release_title", album);
      searchData = await fetchDiscogs(`/database/search?${params}`, auth, controller.signal);
    }

    clearTimeout(timeout);

    if (!searchData || !searchData.results.length) {
      return NextResponse.json({ result: null });
    }

    const first = searchData.results[0];
    const { artist: parsedArtist, albumTitle } = parseArtistTitle(first.title ?? "");

    const result: DiscogsReleaseResult = {
      id: first.id,
      artist: parsedArtist,
      albumTitle,
      label: first.label?.[0] ?? null,
      year: first.year ?? null,
      country: first.country ?? null,
      genre: first.genre?.[0] ?? first.style?.[0] ?? null,
      format: first.format?.[0] ?? null,
      imageUrl: first.cover_image ?? first.thumb ?? null,
      catno: first.catno ?? null,
      barcode: first.barcode?.[0] ?? null,
      resourceUrl: first.resource_url,
    };

    await putCachedLookup("discogs", cacheKey, result);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vinyl lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "Discogs API timed out." }, { status: 504 });
    }
    if (message.includes("rate-limiting")) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
