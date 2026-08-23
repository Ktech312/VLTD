import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { parseSerpEventWindow } from "@/lib/events/serpEventDateParse";

// Runs on a daily schedule (see vercel.json) so nobody has to manually find
// and type new rows into collector_events -- pulls from two independent
// keyword-search sources (Google Events via SerpApi, and Ticketmaster
// Discovery) and upserts. Combined with the ends_at >= now() RLS policy, the
// events grid now fills and empties itself with no manual step on either end.
//
// Both sources are found-by-keyword, which means either one can surface
// something irrelevant (a plumbing trade show matching "convention", say) --
// so nothing from either source reaches the table without first passing a
// batched AI relevance check (same ANTHROPIC_API_KEY VLTD already uses for
// vision). If that check can't run for any reason, everything from this run
// is dropped rather than published unchecked (fail closed, not fail open).

type Candidate = {
  category: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  city: string | null;
  websiteUrl: string | null;
  ticketUrl: string | null;
};

const CATEGORY_QUERIES: Record<string, string> = {
  convention: "comic con convention pop culture convention",
  card_show: "card show sports card show trading card show",
  auction: "collectibles auction comic auction sports card auction",
  drop: "collectible release card release pop culture drop",
  gallery: "collector gallery comic art exhibit pop culture exhibition",
  music: "record show vinyl show guitar show instrument expo",
};

// Ticketmaster's `keyword` param is a near-exact/AND match, not a fuzzy
// natural-language search like Google -- the CATEGORY_QUERIES strings above
// return zero every time on Ticketmaster (verified directly against their
// API 2026-08-23). These were found by testing real single/short-phrase
// keywords against the live API until each returned actual event hits.
const TICKETMASTER_KEYWORDS: Record<string, string> = {
  convention: "comic con",
  card_show: "card show",
  auction: "auction",
  drop: "vintage market",
  gallery: "comic art",
  music: "record show",
};

// ── Source 1: Google Events via SerpApi ─────────────────────────────────
// Same engine the "Find Events" search box uses. As of 2026-08 SerpApi has
// an open incident ("[Google Events API] Empty results for all queries") --
// this keeps returning [] until that clears, which is fine, it just means
// Ticketmaster is carrying this alone until then.

type SerpApiEvent = {
  title?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  description?: string;
  ticket_info?: Array<{ source?: string; link?: string }>;
};

const NATIONWIDE_LOCATION = "United States";

function parseAddress(address?: string[]): { venue: string | null; location: string | null } {
  if (!address?.length) return { venue: null, location: null };
  if (address.length === 1) return { venue: null, location: address[0] };
  return { venue: address[0] ?? null, location: address.slice(1).join(", ") || null };
}

function pickTicketLink(event: SerpApiEvent): string | null {
  return event.ticket_info?.find((ticket) => ticket.link)?.link ?? event.link ?? null;
}

async function fetchSerpCandidates(apiKey: string, category: string, query: string, now: Date): Promise<Candidate[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("location", NATIONWIDE_LOCATION);

  const response = await fetch(url, { headers: { Accept: "application/json" } }).catch(() => null);
  if (!response || !response.ok) return [];

  const payload = (await response.json().catch(() => null)) as { events_results?: SerpApiEvent[]; error?: string } | null;
  if (!payload || payload.error) return [];

  const candidates: Candidate[] = [];
  for (const event of (payload.events_results ?? []).slice(0, 10)) {
    const name = event.title?.trim();
    const window = parseSerpEventWindow(event.date, now);
    if (!name || !window) continue;

    const address = parseAddress(event.address);
    candidates.push({
      category,
      name,
      description: event.description?.trim() || null,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      venueName: address.venue,
      city: address.location,
      websiteUrl: event.link ?? null,
      ticketUrl: pickTicketLink(event),
    });
  }
  return candidates;
}

// ── Source 2: Ticketmaster Discovery ────────────────────────────────────
// Real structured start/end dates -- no free-text guessing needed. Coverage
// skews toward bigger, ticketed shows; smaller dealer-run shows often won't
// be here, which is exactly why this runs alongside SerpApi rather than
// instead of it.

type TicketmasterEvent = {
  name?: string;
  info?: string;
  pleaseNote?: string;
  url?: string;
  dates?: { start?: { localDate?: string }; end?: { localDate?: string } };
  _embedded?: { venues?: Array<{ name?: string; city?: { name?: string }; state?: { stateCode?: string } }> };
};

async function fetchTicketmasterCandidates(apiKey: string, category: string, keyword: string): Promise<Candidate[]> {
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("size", "10");
  url.searchParams.set("sort", "date,asc");

  const response = await fetch(url).catch(() => null);
  if (!response || !response.ok) return [];

  const payload = (await response.json().catch(() => null)) as { _embedded?: { events?: TicketmasterEvent[] } } | null;

  const candidates: Candidate[] = [];
  for (const event of payload?._embedded?.events ?? []) {
    const name = event.name?.trim();
    const startDate = event.dates?.start?.localDate;
    if (!name || !startDate) continue;
    const endDate = event.dates?.end?.localDate ?? startDate;

    const venue = event._embedded?.venues?.[0];
    const city = [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", ") || null;

    candidates.push({
      category,
      name,
      description: event.info?.trim() || event.pleaseNote?.trim() || null,
      startsAt: `${startDate}T00:00:00.000Z`,
      endsAt: `${endDate}T23:59:59.000Z`,
      venueName: venue?.name ?? null,
      city,
      websiteUrl: event.url ?? null,
      ticketUrl: event.url ?? null,
    });
  }
  return candidates;
}

// ── Relevance gate: one batched AI call for everything found this run ──

async function filterRelevantCandidates(
  apiKey: string,
  candidates: Candidate[],
): Promise<{ approved: Set<number>; error: string | null }> {
  if (!candidates.length) return { approved: new Set(), error: null };

  const prompt = [
    "You are screening event listings for VLTD, a collectibles/hobbyist marketplace app.",
    "Each candidate below was found via a generic keyword search and may include irrelevant",
    "results (trade shows, conferences, concerts, or anything with no real connection to",
    "collecting or hobbyist communities -- comics, trading cards/TCG, sports memorabilia,",
    "coins/stamps, video games/arcade, vinyl records, sneakers/watches, classic cars/",
    "motorcycles, art collecting, whisky/cigars, militaria, and similar).",
    "",
    "For each candidate, decide if it's a genuine collectibles/hobbyist event. Reject anything",
    "generic or unrelated (e.g. a plumbing trade show, a medical conference, a pop concert)",
    "even though it matched the search keyword.",
    "",
    'Return ONLY a JSON array, same order, one entry per candidate: [{"i": <index>, "relevant": true|false}]',
    "No explanation, no markdown.",
    "",
    JSON.stringify(
      candidates.map((c, i) => ({ i, name: c.name, category: c.category, description: c.description?.slice(0, 200) ?? null })),
    ),
  ].join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return { approved: new Set(), error: `AI request failed: ${response.status} ${details}`.slice(0, 500) };
    }

    const result = (await response.json()) as {
      content?: { type: string; text: string }[];
      stop_reason?: string;
    };
    const rawText = result.content?.[0]?.text ?? "[]";
    const firstBracket = rawText.indexOf("[");
    const lastBracket = rawText.lastIndexOf("]");
    if (firstBracket < 0 || lastBracket <= firstBracket) {
      return {
        approved: new Set(),
        error: `No JSON array in AI response (stop_reason=${result.stop_reason}): ${rawText}`.slice(0, 500),
      };
    }

    const parsed = JSON.parse(rawText.slice(firstBracket, lastBracket + 1)) as Array<{ i: number; relevant: boolean }>;
    return { approved: new Set(parsed.filter((entry) => entry.relevant === true).map((entry) => entry.i)), error: null };
  } catch (err) {
    return { approved: new Set(), error: `AI filter threw: ${String(err)}`.slice(0, 500) }; // fail closed
  }
}

function slugify(name: string, startsAt: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "event"}-${startsAt.slice(0, 10)}`;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "not_configured", message: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  const ticketmasterKey = process.env.TICKETMASTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!serpApiKey && !ticketmasterKey) {
    return NextResponse.json(
      { error: "not_configured", message: "Neither SERPAPI_KEY nor TICKETMASTER_API_KEY is set." },
      { status: 503 },
    );
  }

  const svc = getServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "not_configured", message: "Supabase service client unavailable." }, { status: 500 });
  }

  const now = new Date();
  const allCandidates: Candidate[] = [];
  const foundByCategory: Record<string, number> = {};

  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    const [serpCandidates, tmCandidates] = await Promise.all([
      serpApiKey ? fetchSerpCandidates(serpApiKey, category, query, now).catch(() => []) : Promise.resolve([]),
      ticketmasterKey
        ? fetchTicketmasterCandidates(ticketmasterKey, category, TICKETMASTER_KEYWORDS[category] ?? category).catch(() => [])
        : Promise.resolve([]),
    ]);
    allCandidates.push(...serpCandidates, ...tmCandidates);
    foundByCategory[category] = serpCandidates.length + tmCandidates.length;
  }

  // No AI key to gate with -> nothing from a keyword search gets published,
  // full stop. (Not expected to trigger; ANTHROPIC_API_KEY has been live in
  // Vercel for months.)
  const aiFilterResult = anthropicKey
    ? await filterRelevantCandidates(anthropicKey, allCandidates)
    : { approved: new Set<number>(), error: "ANTHROPIC_API_KEY not set" };
  const approved = allCandidates.filter((_, i) => aiFilterResult.approved.has(i));

  const rows = approved.map((c) => ({
    slug: slugify(c.name, c.startsAt),
    name: c.name,
    short_desc: c.description?.slice(0, 200) ?? null,
    long_desc: c.description ?? null,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    venue_name: c.venueName,
    city: c.city,
    website_url: c.websiteUrl,
    ticket_url: c.ticketUrl,
    country: "US",
    // enabled/is_featured deliberately omitted: on a fresh insert the table
    // defaults (enabled=true, is_featured=false) apply, but on a re-run that
    // matches an existing slug, upsert only overwrites the columns listed
    // here -- so a manual disable or feature-flip from EK never gets undone
    // by tomorrow's run.
  }));

  let upserted = 0;
  let upsertError: string | null = null;
  if (rows.length) {
    const { error } = await svc.from("collector_events").upsert(rows, { onConflict: "slug" });
    if (!error) upserted = rows.length;
    else upsertError = error.message;
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    foundByCategory,
    totalFound: allCandidates.length,
    approvedByAi: approved.length,
    aiFilterError: aiFilterResult.error,
    upserted,
    upsertError,
  });
}
