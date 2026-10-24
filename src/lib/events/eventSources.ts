import { parseSerpEventWindow } from "@/lib/events/serpEventDateParse";
import { dayStamps, eventSlug, isIsoDay, type EventRow } from "@/lib/events/eventPipeline";

// The outside requests the event refreshes make (Google Events via SerpApi, Ticketmaster Discovery, and the AI relevance check), kept in one place so the daily
// job and the yearly job make them in exactly the same way. Nothing here runs on its own: a caller decides whether, and how often, to call it.

export type Candidate = {
  category: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueName: string | null;
  city: string | null;
  websiteUrl: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
};

export const CATEGORY_QUERIES: Record<string, string> = {
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
export const TICKETMASTER_KEYWORDS: Record<string, string> = {
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
  thumbnail?: string;
};

// Every outside request has its own time limit, so one slow answer cannot use up the whole run (a run that hits the platform limit is killed and saves nothing).
export const SERP_TIMEOUT_MS = 25_000; // was 15 s: on 2026-10-23 three of the six Google Events searches timed out at 15 s (real run); 25 s + the 25 s AI check still ends well inside the 60 s limit
export const TM_TIMEOUT_MS = 8_000;
export const AI_TIMEOUT_MS = 25_000;

const NATIONWIDE_LOCATION = "United States";

function parseAddress(address?: string[]): { venue: string | null; location: string | null } {
  if (!address?.length) return { venue: null, location: null };
  if (address.length === 1) return { venue: null, location: address[0] };
  return { venue: address[0] ?? null, location: address.slice(1).join(", ") || null };
}

function pickTicketLink(event: SerpApiEvent): string | null {
  return event.ticket_info?.find((ticket) => ticket.link)?.link ?? event.link ?? null;
}

// What one search gave back. A search that failed is reported as a failure, never as "found nothing", so a dead key or an outage cannot look like a quiet day.
export type SourceResult = { candidates: Candidate[]; error: string | null };

export async function fetchSerpCandidates(apiKey: string, category: string, query: string, now: Date): Promise<SourceResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("location", NATIONWIDE_LOCATION);

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
  } catch (err) {
    return { candidates: [], error: `SerpApi ${category}: request failed (${String(err)})`.slice(0, 200) };
  }
  const payload = (await response.json().catch(() => null)) as { events_results?: SerpApiEvent[]; error?: string } | null;
  if (!response.ok) return { candidates: [], error: `SerpApi ${category}: HTTP ${response.status} ${payload?.error ?? ""}`.trim().slice(0, 200) };
  if (!payload) return { candidates: [], error: `SerpApi ${category}: unreadable answer` };
  // SerpApi answers a search with no hits as an error string; that is an empty result, not a failure.
  if (payload.error) {
    if (/hasn't returned any results|no results/i.test(payload.error)) return { candidates: [], error: null };
    return { candidates: [], error: `SerpApi ${category}: ${payload.error}`.slice(0, 200) };
  }

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
      imageUrl: event.thumbnail ?? null,
    });
  }
  return { candidates, error: null };
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
  images?: Array<{ url?: string; ratio?: string; width?: number }>;
};

function pickTicketmasterImage(event: TicketmasterEvent): string | null {
  const images = event.images ?? [];
  const wide = images.find((img) => img.ratio === "16_9" && (img.width ?? 0) >= 640);
  return wide?.url ?? images[0]?.url ?? null;
}

/** Optional limits for one Ticketmaster search: only events starting inside a date range, and how many to return (the daily job asks for neither). */
export type TicketmasterOptions = { startDay?: string; endDay?: string; size?: number };

export async function fetchTicketmasterCandidates(apiKey: string, category: string, keyword: string, options: TicketmasterOptions = {}): Promise<SourceResult> {
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("size", String(options.size ?? 10));
  url.searchParams.set("sort", "date,asc");
  // Ticketmaster's own format: UTC, whole seconds, a trailing Z.
  if (options.startDay && isIsoDay(options.startDay)) url.searchParams.set("startDateTime", `${options.startDay}T00:00:00Z`);
  if (options.endDay && isIsoDay(options.endDay)) url.searchParams.set("endDateTime", `${options.endDay}T00:00:00Z`);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TM_TIMEOUT_MS) });
  } catch (err) {
    return { candidates: [], error: `Ticketmaster ${category}: request failed (${String(err)})`.slice(0, 200) };
  }
  if (!response.ok) return { candidates: [], error: `Ticketmaster ${category}: HTTP ${response.status}` };
  const payload = (await response.json().catch(() => null)) as { _embedded?: { events?: TicketmasterEvent[] } } | null;
  if (!payload) return { candidates: [], error: `Ticketmaster ${category}: unreadable answer` };

  const candidates: Candidate[] = [];
  for (const event of payload._embedded?.events ?? []) {
    const name = event.name?.trim();
    const startDate = event.dates?.start?.localDate;
    if (!name || !startDate || !isIsoDay(startDate)) continue;
    const endDate = event.dates?.end?.localDate ?? startDate;

    const venue = event._embedded?.venues?.[0];
    const city = [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", ") || null;
    const stamps = dayStamps(startDate, endDate);

    candidates.push({
      category,
      name,
      description: event.info?.trim() || event.pleaseNote?.trim() || null,
      startsAt: stamps.starts_at,
      endsAt: stamps.ends_at,
      venueName: venue?.name ?? null,
      city,
      websiteUrl: event.url ?? null,
      ticketUrl: event.url ?? null,
      imageUrl: pickTicketmasterImage(event),
    });
  }
  return { candidates, error: null };
}

// ── Relevance gate: one batched AI call for the events not yet judged ──

/** What the AI said about a batch, and (when the answer came back) how many tokens it used, as reported by the API itself. */
export type AiAnswer = { approved: Set<number>; rejected: Set<number>; error: string | null; usage?: { inputTokens: number; outputTokens: number } };
export const NO_ANSWER = (error: string | null): AiAnswer => ({ approved: new Set(), rejected: new Set(), error });

export const AI_MODEL = "claude-haiku-4-5-20251001";

export async function filterRelevantCandidates(
  apiKey: string,
  candidates: Array<{ name: string; category: string; description: string | null }>,
  options: { maxTokens?: number } = {},
): Promise<AiAnswer> {
  if (!candidates.length) return NO_ANSWER(null);

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
      candidates.map((c, i) => ({ i, name: c.name.slice(0, 120), category: c.category, description: c.description?.slice(0, 200) ?? null })),
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
        model: AI_MODEL,
        max_tokens: options.maxTokens ?? 4096,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return NO_ANSWER(`AI request failed: ${response.status} ${details}`.slice(0, 500));
    }

    const result = (await response.json()) as {
      content?: { type: string; text: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const usage = result.usage ? { inputTokens: result.usage.input_tokens ?? 0, outputTokens: result.usage.output_tokens ?? 0 } : undefined;
    const rawText = result.content?.[0]?.text ?? "[]";
    const firstBracket = rawText.indexOf("[");
    const lastBracket = rawText.lastIndexOf("]");
    if (firstBracket < 0 || lastBracket <= firstBracket) {
      return { ...NO_ANSWER(`No JSON array in AI response (stop_reason=${result.stop_reason}): ${rawText}`.slice(0, 500)), usage };
    }

    const parsed = JSON.parse(rawText.slice(firstBracket, lastBracket + 1)) as Array<{ i: number; relevant: boolean }>;
    // Only what the AI actually answered about is judged: a candidate it left out stays "not yet judged" and is asked about again next time.
    return {
      approved: new Set(parsed.filter((entry) => entry.relevant === true).map((entry) => entry.i)),
      rejected: new Set(parsed.filter((entry) => entry.relevant === false).map((entry) => entry.i)),
      error: null,
      usage,
    };
  } catch (err) {
    return NO_ANSWER(`AI filter threw: ${String(err)}`.slice(0, 500)); // fail closed
  }
}

export function toRow(c: Candidate): EventRow {
  return {
    slug: eventSlug(c.name, c.startsAt.slice(0, 10), c.city),
    name: c.name,
    short_desc: c.description?.slice(0, 200) ?? null,
    long_desc: c.description ?? null,
    starts_at: c.startsAt,
    ends_at: c.endsAt,
    venue_name: c.venueName,
    city: c.city,
    website_url: c.websiteUrl,
    ticket_url: c.ticketUrl,
    image_url: c.imageUrl,
    country: "US",
    // enabled/is_featured deliberately omitted: a new row gets the table defaults (enabled=true, is_featured=false), and a row that is already there is
    // only ever updated in the columns above and only where this run has a value, so a manual disable or feature-flip is never undone by the next run.
  };
}
