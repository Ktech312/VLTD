import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { parseSerpEventWindow } from "@/lib/events/serpEventDateParse";

// Runs on a daily schedule (see vercel.json) so nobody has to manually find
// and type new rows into collector_events -- pulls the same google_events
// data the "Find Events" search box already uses, and upserts it. Combined
// with the ends_at >= now() RLS policy, the events grid now fills and empties
// itself with no manual step on either end.

type SerpApiEvent = {
  title?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  description?: string;
  ticket_info?: Array<{ source?: string; link?: string }>;
};

const CATEGORY_QUERIES: Record<string, string> = {
  convention: "comic con convention pop culture convention",
  card_show: "card show sports card show trading card show",
  auction: "collectibles auction comic auction sports card auction",
  drop: "collectible release card release pop culture drop",
  gallery: "collector gallery comic art exhibit pop culture exhibition",
  music: "record show vinyl show guitar show instrument expo",
};

// Broad nationwide sweep rather than per-city -- keeps this to one SerpApi
// call per category per day. Revisit if the national query proves too thin.
const NATIONWIDE_LOCATION = "United States";

function parseAddress(address?: string[]): { venue: string | null; location: string | null } {
  if (!address?.length) return { venue: null, location: null };
  if (address.length === 1) return { venue: null, location: address[0] };
  return { venue: address[0] ?? null, location: address.slice(1).join(", ") || null };
}

function pickTicketLink(event: SerpApiEvent): string | null {
  return event.ticket_info?.find((ticket) => ticket.link)?.link ?? event.link ?? null;
}

function slugify(name: string, startsAt: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "event"}-${startsAt.slice(0, 10)}`;
}

async function fetchSerpEvents(apiKey: string, q: string): Promise<SerpApiEvent[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", q);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("location", NATIONWIDE_LOCATION);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];

  const payload = (await response.json()) as { events_results?: SerpApiEvent[]; error?: string };
  if (payload.error) return [];
  return payload.events_results ?? [];
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "not_configured", message: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured", message: "SERPAPI_KEY is not set." }, { status: 503 });
  }

  const svc = getServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "not_configured", message: "Supabase service client unavailable." }, { status: 500 });
  }

  const now = new Date();
  const summary: Record<string, { found: number; upserted: number; skipped: number }> = {};

  for (const [category, query] of Object.entries(CATEGORY_QUERIES)) {
    const found = await fetchSerpEvents(apiKey, query).catch(() => []);
    let upserted = 0;
    let skipped = 0;

    const rows = [];
    for (const event of found.slice(0, 10)) {
      const name = event.title?.trim();
      const window = parseSerpEventWindow(event.date, now);
      if (!name || !window) {
        skipped += 1;
        continue;
      }

      const address = parseAddress(event.address);
      rows.push({
        slug: slugify(name, window.startsAt),
        name,
        short_desc: event.description?.slice(0, 200) ?? null,
        long_desc: event.description ?? null,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        venue_name: address.venue,
        city: address.location,
        website_url: event.link ?? null,
        ticket_url: pickTicketLink(event),
        country: "US",
        // enabled/is_featured deliberately omitted: on a fresh insert the
        // table defaults (enabled=true, is_featured=false) apply, but on a
        // re-run that matches an existing slug, upsert only overwrites the
        // columns listed here -- so if you manually disable a bad auto-added
        // event, or feature one by hand, tomorrow's run won't undo it.
      });
    }

    if (rows.length) {
      const { error } = await svc.from("collector_events").upsert(rows, { onConflict: "slug" });
      if (!error) upserted = rows.length;
      else skipped += rows.length;
    }

    summary[category] = { found: found.length, upserted, skipped };
  }

  return NextResponse.json({ ranAt: now.toISOString(), summary });
}
