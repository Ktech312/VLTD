import { NextResponse } from "next/server";

/**
 * GET /api/comic-releases
 *
 * Scrapes ComicList.com for this week's new comic releases.
 * ComicList posts every Monday night with Wednesday release data.
 *
 * Returns:
 *   { week: string, publishers: Array<{ name: string, issues: ComicIssue[] }> }
 *
 * Optional query params:
 *   publisher=marvel   → filter by publisher (case-insensitive substring)
 *   q=batman           → filter issues by title keyword
 */

const COMICLIST_URL = "https://www.comiclist.com/checklist.php";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — updated Mondays

let cache: { data: ComicReleasesResult; fetchedAt: number } | null = null;

export type ComicIssue = {
  title: string;         // e.g. "AMAZING SPIDER-MAN #1"
  series: string;        // extracted series name
  number: string;        // extracted issue number
  price: string | null;  // e.g. "$3.99"
  raw: string;           // original line from ComicList
};

export type PublisherGroup = {
  name: string;
  issues: ComicIssue[];
};

export type ComicReleasesResult = {
  week: string;
  fetchedAt: string;
  publishers: PublisherGroup[];
  totalIssues: number;
  source: "comiclist.com";
};

/* ── Parser ────────────────────────────────────────────────── */

/**
 * ComicList format (plain text within HTML):
 *
 * NEW COMICS FOR JULY 9, 2025
 *
 * MARVEL COMICS
 *
 * AMAZING SPIDER-MAN #1 $3.99
 * AVENGERS #50 $4.99
 *
 * DC COMICS
 *
 * BATMAN #200 $3.99
 * ...
 *
 * Publisher names are ALL CAPS lines with no price.
 * Issue lines contain a price pattern ($X.XX) or end without one.
 */

const KNOWN_PUBLISHERS = new Set([
  "MARVEL COMICS", "DC COMICS", "IMAGE COMICS", "DARK HORSE COMICS",
  "IDW PUBLISHING", "BOOM! STUDIOS", "BOOM STUDIOS", "DYNAMITE ENTERTAINMENT",
  "TITAN COMICS", "VAULT COMICS", "AWA STUDIOS", "AFTERSHOCK COMICS",
  "ABLAZE MEDIA", "ACTION LAB ENTERTAINMENT", "ARCHIE COMICS", "ASPEN COMICS",
  "BAD IDEA", "BEHEMOTH COMICS", "BLACK MASK STUDIOS", "BLOOD MOON COMICS",
  "CHAPTER HOUSE COMICS", "DARK CIRCLE COMICS", "DEAD RECKONING", "DEVIL'S DUE",
  "FANTAGRAPHICS", "FLOATING WORLD COMICS", "GRAPHIC INDIA", "HEAVY METAL",
  "HUMANOIDS", "LION FORGE", "MAD CAVE STUDIOS", "MAGNETIC PRESS",
  "MARVEL PRESS", "MYTHOS COMICS", "ONI PRESS", "PEACH MOMOKO STUDIOS",
  "SCOUT COMICS", "SILVER SPROCKET", "SOURCE POINT PRESS", "TOP COW PRODUCTIONS",
  "TOP SHELF PRODUCTIONS", "TUNDRA PUBLISHING", "VALIANT ENTERTAINMENT",
  "VERTICAL COMICS", "VIZ MEDIA", "ZENESCOPE ENTERTAINMENT",
]);

const PRICE_RE = /\$[\d]+\.[\d]{2}$/;
const ISSUE_NUM_RE = /^(.+?)\s+#(\S+)\s*(.*?)$/;
const WEEK_RE = /NEW\s+COMICS?\s+FOR\s+(.+)/i;

function looksLikePublisher(line: string): boolean {
  const upper = line.toUpperCase().trim();
  if (KNOWN_PUBLISHERS.has(upper)) return true;
  // All-caps line, no price, no issue number indicator
  if (upper === line.trim() && upper.length > 3 && upper.length < 60 && !PRICE_RE.test(line) && !/#\d/.test(line)) {
    return true;
  }
  return false;
}

function parseIssue(raw: string): ComicIssue {
  const line = raw.trim();
  const priceMatch = line.match(/(\$[\d]+\.[\d]{2})\s*$/);
  const price = priceMatch ? priceMatch[1] : null;
  const titlePart = price ? line.slice(0, line.lastIndexOf(priceMatch![1])).trim() : line;

  const numMatch = titlePart.match(ISSUE_NUM_RE);
  const series = numMatch ? numMatch[1].trim() : titlePart;
  const number = numMatch ? numMatch[2] : "";

  return { title: titlePart, series, number, price, raw: line };
}

function parseComicList(html: string): ComicReleasesResult {
  // Strip HTML tags — ComicList is mostly plain text inside <pre> or <div>
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let week = "";
  const publishers: PublisherGroup[] = [];
  let currentPub: PublisherGroup | null = null;

  for (const line of lines) {
    // Detect week header
    const weekMatch = line.match(WEEK_RE);
    if (weekMatch && !week) {
      week = weekMatch[1].trim();
      continue;
    }

    // Skip footer / boilerplate lines
    if (
      line.startsWith("http") ||
      line.startsWith("©") ||
      line.startsWith("Copyright") ||
      line.toLowerCase().includes("comiclist.com") ||
      line.toLowerCase().includes("all rights reserved") ||
      line.toLowerCase().includes("subject to change")
    ) continue;

    if (looksLikePublisher(line)) {
      currentPub = { name: line.trim(), issues: [] };
      publishers.push(currentPub);
      continue;
    }

    // Issue line — must belong to a publisher
    if (currentPub && line.length > 2) {
      // Skip obviously non-issue lines
      if (line.length > 120) continue;
      currentPub.issues.push(parseIssue(line));
    }
  }

  // Drop publisher groups with no issues (likely false positives)
  const filtered = publishers.filter((p) => p.issues.length > 0);

  return {
    week: week || "This Week",
    fetchedAt: new Date().toISOString(),
    publishers: filtered,
    totalIssues: filtered.reduce((n, p) => n + p.issues.length, 0),
    source: "comiclist.com",
  };
}

/* ── GET handler ───────────────────────────────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pubFilter = (searchParams.get("publisher") ?? "").toLowerCase();
  const titleFilter = (searchParams.get("q") ?? "").toLowerCase();

  // Serve from cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return respond(cache.data, pubFilter, titleFilter);
  }

  try {
    const res = await fetch(COMICLIST_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VLTDComicApp/1.0; +https://vaultd.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 21600 }, // 6h Next.js cache
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ComicList returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const result = parseComicList(html);
    cache = { data: result, fetchedAt: Date.now() };

    return respond(result, pubFilter, titleFilter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch ComicList: ${msg}` }, { status: 502 });
  }
}

function respond(
  data: ComicReleasesResult,
  pubFilter: string,
  titleFilter: string
): NextResponse {
  let publishers = data.publishers;

  if (pubFilter) {
    publishers = publishers.filter((p) =>
      p.name.toLowerCase().includes(pubFilter)
    );
  }

  if (titleFilter) {
    publishers = publishers
      .map((p) => ({
        ...p,
        issues: p.issues.filter((i) =>
          i.title.toLowerCase().includes(titleFilter)
        ),
      }))
      .filter((p) => p.issues.length > 0);
  }

  return NextResponse.json({
    ...data,
    publishers,
    totalIssues: publishers.reduce((n, p) => n + p.issues.length, 0),
  });
}
