import { NextRequest, NextResponse } from "next/server";

type SerpApiEvent = {
  title?: string;
  date?: {
    start_date?: string;
    when?: string;
  };
  address?: string[];
  link?: string;
  event_location_map?: {
    link?: string;
  };
  description?: string;
  ticket_info?: Array<{
    source?: string;
    link?: string;
  }>;
  thumbnail?: string;
};

type EventCategory = "convention" | "card_show" | "auction" | "drop" | "gallery" | "music";

const CATEGORY_QUERIES: Record<EventCategory, string> = {
  convention: "comic conventions collectibles events",
  card_show: "sports card shows trading card shows",
  auction: "comic auctions collectible auctions",
  drop: "collectible drops card release events",
  gallery: "collectibles gallery museum pop culture exhibition",
  music: "vinyl record instrument collectible shows",
};

function categoryQuery(category: string | null): string {
  if (category && category in CATEGORY_QUERIES) {
    return CATEGORY_QUERIES[category as EventCategory];
  }
  return "collector events comic con card show collectibles";
}

function parseAddress(address?: string[]): { venue: string | null; location: string | null } {
  if (!address?.length) return { venue: null, location: null };
  if (address.length === 1) return { venue: null, location: address[0] };
  return {
    venue: address[0] ?? null,
    location: address.slice(1).join(", ") || null,
  };
}

function pickTicketLink(event: SerpApiEvent): string | null {
  return event.ticket_info?.find((ticket) => ticket.link)?.link ?? event.link ?? null;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "SERPAPI_KEY is not configured.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const zip = searchParams.get("zip")?.trim() ?? "";
  const category = searchParams.get("category");
  const dateRange = searchParams.get("dateRange") ?? "next_90";

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Enter a valid 5-digit ZIP code.",
      },
      { status: 400 },
    );
  }

  const q = `${categoryQuery(category)} near ${zip}`;
  const serpUrl = new URL("https://serpapi.com/search.json");
  serpUrl.searchParams.set("engine", "google_events");
  serpUrl.searchParams.set("q", q);
  serpUrl.searchParams.set("api_key", apiKey);
  serpUrl.searchParams.set("hl", "en");
  serpUrl.searchParams.set("gl", "us");

  if (dateRange === "this_month") serpUrl.searchParams.set("htichips", "date:month");
  if (dateRange === "next_week") serpUrl.searchParams.set("htichips", "date:week");
  if (dateRange === "today") serpUrl.searchParams.set("htichips", "date:today");

  try {
    const response = await fetch(serpUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "serpapi_error",
          message: `SerpApi returned ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as { events_results?: SerpApiEvent[]; error?: string };
    if (payload.error) {
      return NextResponse.json({ error: "serpapi_error", message: payload.error }, { status: 502 });
    }

    const results = (payload.events_results ?? []).slice(0, 10).map((event, index) => {
      const address = parseAddress(event.address);
      return {
        id: `${zip}-${category ?? "all"}-${index}-${event.title ?? "event"}`,
        title: event.title ?? "Collector event",
        when: event.date?.when ?? event.date?.start_date ?? "Date not listed",
        startDate: event.date?.start_date ?? null,
        venue: address.venue,
        location: address.location,
        description: event.description ?? null,
        link: event.link ?? null,
        mapLink: event.event_location_map?.link ?? null,
        ticketLink: pickTicketLink(event),
        thumbnail: event.thumbnail ?? null,
        source: event.ticket_info?.[0]?.source ?? "Google Events",
      };
    });

    return NextResponse.json({
      query: q,
      results,
    });
  } catch {
    return NextResponse.json(
      {
        error: "search_failed",
        message: "Event search failed. Try again.",
      },
      { status: 502 },
    );
  }
}
