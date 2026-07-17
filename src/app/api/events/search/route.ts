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
  convention: "comic con convention pop culture convention",
  card_show: "card show sports card show trading card show",
  auction: "collectibles auction comic auction sports card auction",
  drop: "collectible release card release pop culture drop",
  gallery: "collector gallery comic art exhibit pop culture exhibition",
  music: "record show vinyl show guitar show instrument expo",
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

function buildSerpUrl(apiKey: string, q: string, location: string, dateRange: string): URL {
  const serpUrl = new URL("https://serpapi.com/search.json");
  serpUrl.searchParams.set("engine", "google_events");
  serpUrl.searchParams.set("q", q);
  serpUrl.searchParams.set("api_key", apiKey);
  serpUrl.searchParams.set("hl", "en");
  serpUrl.searchParams.set("gl", "us");
  serpUrl.searchParams.set("location", `${location}, United States`);

  if (dateRange === "this_month") serpUrl.searchParams.set("htichips", "date:month");
  if (dateRange === "next_week") serpUrl.searchParams.set("htichips", "date:week");
  if (dateRange === "today") serpUrl.searchParams.set("htichips", "date:today");

  return serpUrl;
}

async function fetchSerpEvents(apiKey: string, q: string, location: string, dateRange: string) {
  const response = await fetch(buildSerpUrl(apiKey, q, location, dateRange), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      events: [] as SerpApiEvent[],
      error: `SerpApi returned ${response.status}.`,
    };
  }

  const payload = (await response.json()) as { events_results?: SerpApiEvent[]; error?: string };
  if (payload.error) {
    return {
      ok: false,
      status: 502,
      events: [] as SerpApiEvent[],
      error: payload.error,
    };
  }

  return {
    ok: true,
    status: 200,
    events: payload.events_results ?? [],
    error: "",
  };
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
  const location = (searchParams.get("location") ?? searchParams.get("zip") ?? "").trim();
  const category = searchParams.get("category");
  const dateRange = searchParams.get("dateRange") ?? "next_90";
  const radius = searchParams.get("radius")?.trim() ?? "100";

  if (location.length < 2 || location.length > 80) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Enter a city or ZIP code.",
      },
      { status: 400 },
    );
  }

  if (!["25", "50", "100", "250"].includes(radius)) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Choose a valid search area.",
      },
      { status: 400 },
    );
  }

  const focusedQuery = `${categoryQuery(category)} within ${radius} miles of ${location}`;
  const fallbackQuery = `${categoryQuery(category)} near ${location}`;
  const broadQuery = `events near ${location}`;

  try {
    let q = focusedQuery;
    let result = await fetchSerpEvents(apiKey, q, location, dateRange);
    if (result.ok && result.events.length === 0) {
      q = fallbackQuery;
      result = await fetchSerpEvents(apiKey, q, location, dateRange);
    }
    if (result.ok && result.events.length === 0) {
      q = broadQuery;
      result = await fetchSerpEvents(apiKey, q, location, dateRange);
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "serpapi_error",
          message: result.error,
        },
        { status: result.status },
      );
    }

    const results = result.events.slice(0, 10).map((event, index) => {
      const address = parseAddress(event.address);
      return {
        id: `${location}-${category ?? "all"}-${index}-${event.title ?? "event"}`,
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
      searchArea: `${radius} mile starting area from ${location}. Google may still include prominent nearby regional events.`,
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
