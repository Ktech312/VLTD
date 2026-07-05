import { NextResponse } from "next/server";

/**
 * GET /api/kickstarter-comics
 *
 * Searches Kickstarter for active comic campaigns using their internal
 * search JSON endpoint. No API key required — this is the same endpoint
 * their own website uses.
 *
 * Query params:
 *   q=string           → search term (default: "comics")
 *   creator=string     → filter by creator name (client-side, post-fetch)
 *   page=number        → page number (default 1)
 *   sort=magic|newest|end_date|most_funded|most_backed
 *
 * Returns:
 *   { projects: KickstarterProject[], total_hits: number, page: number, hasMore: boolean }
 */

const KS_SEARCH =
  "https://www.kickstarter.com/projects/search.json";
const COMICS_CATEGORY_ID = 3; // Kickstarter's Comics category ID

export type KickstarterProject = {
  id: number;
  name: string;
  blurb: string;
  slug: string;
  url: string;
  creator: string;
  creatorUrl: string;
  imageUrl: string | null;
  pledged: number;
  goal: number;
  backers: number;
  percentFunded: number;
  currency: string;
  state: string;         // "live", "successful", "failed", "canceled"
  deadline: string;      // ISO date string
  launchedAt: string;
  category: string;
  subcategory: string | null;
  country: string;
};

/* ── Raw Kickstarter shape (subset) ─────────────────────────── */

interface KsRawProject {
  id: number;
  name: string;
  blurb: string;
  slug: string;
  urls: { web: { project: string; rewards?: string } };
  creator: { name: string; urls?: { web?: { user?: string } } };
  photo: { full?: string; ed?: string; med?: string } | null;
  pledged: string;
  goal: string;
  backers_count: number;
  currency: string;
  state: string;
  deadline: number;      // unix timestamp
  launched_at: number;
  category: { name: string; slug: string; parent_name?: string };
  country: string;
  usd_pledged: string;
  usd_goal: string;
}

function normalize(raw: KsRawProject): KickstarterProject {
  const pledged = parseFloat(raw.usd_pledged ?? raw.pledged ?? "0");
  const goal = parseFloat(raw.usd_goal ?? raw.goal ?? "1");
  const photo = raw.photo;
  const imageUrl = photo?.full ?? photo?.ed ?? photo?.med ?? null;

  return {
    id: raw.id,
    name: raw.name ?? "",
    blurb: raw.blurb ?? "",
    slug: raw.slug ?? "",
    url: raw.urls?.web?.project ?? `https://www.kickstarter.com/projects/${raw.slug}`,
    creator: raw.creator?.name ?? "Unknown",
    creatorUrl: raw.creator?.urls?.web?.user ?? "",
    imageUrl,
    pledged,
    goal,
    backers: raw.backers_count ?? 0,
    percentFunded: goal > 0 ? Math.round((pledged / goal) * 100) : 0,
    currency: raw.currency ?? "USD",
    state: raw.state ?? "live",
    deadline: raw.deadline
      ? new Date(raw.deadline * 1000).toISOString()
      : "",
    launchedAt: raw.launched_at
      ? new Date(raw.launched_at * 1000).toISOString()
      : "",
    category: raw.category?.name ?? "Comics",
    subcategory: raw.category?.parent_name ?? null,
    country: raw.country ?? "US",
  };
}

/* ── GET handler ─────────────────────────────────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "comics";
  const creatorFilter = (searchParams.get("creator") ?? "").toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const sort = searchParams.get("sort") ?? "magic";
  const perPage = 20;

  const ksParams = new URLSearchParams({
    term: q,
    category_id: String(COMICS_CATEGORY_ID),
    sort,
    page: String(page),
    per_page: String(perPage),
  });

  try {
    const res = await fetch(`${KS_SEARCH}?${ksParams.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VLTDComicApp/1.0; +https://vaultd.app)",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.kickstarter.com/",
      },
      next: { revalidate: 900 }, // 15 min cache
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Kickstarter returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      projects: KsRawProject[];
      total_hits?: number;
    };

    let projects = (json.projects ?? []).map(normalize);

    // Filter by creator name if requested
    if (creatorFilter) {
      projects = projects.filter((p) =>
        p.creator.toLowerCase().includes(creatorFilter)
      );
    }

    return NextResponse.json({
      projects,
      total_hits: json.total_hits ?? projects.length,
      page,
      perPage,
      hasMore: projects.length === perPage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Kickstarter fetch failed: ${msg}` },
      { status: 502 }
    );
  }
}
