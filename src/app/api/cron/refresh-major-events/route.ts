import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { MAJOR_SHOWS } from "@/lib/events/majorShows";
import { fillBannerArt } from "@/lib/events/eventArt";
import { runAfterResponse } from "@/lib/events/afterResponse";
import { dayStamps, eventSlug, isIsoDay, persistEvents, type EventRow } from "@/lib/events/eventPipeline";

// Runs weekly (see vercel.json) to keep a curated list of the major,
// well-known recurring collector shows current (the list lives in
// lib/events/majorShows.ts) -- this is a NAME lookup,
// not a keyword search, so there's no "plumbing convention matched the
// keyword" risk the way there is in refresh-events: nothing is being
// discovered here, only refreshed against a fixed, EK-approved list.
//
// For each show, pulls a handful of real search snippets (SerpApi's plain
// google engine, not the currently-broken google_events engine) and has
// Claude extract the next occurrence's date/location ONLY if the snippets
// clearly support it -- explicitly told not to guess or extrapolate from a
// past year's pattern, and anything not confidently determined is dropped
// rather than published with a made-up date.

// One search per show plus the AI call have to finish inside one request; the platform default (10 s on some plans) is too short for that.
export const maxDuration = 60;
// Every outside request has its own time limit, so one slow answer cannot use up the whole run (a run that hits the platform limit is killed and saves nothing).
const SERP_TIMEOUT_MS = 25_000; // was 15 s: on 2026-10-23 three of the six Google Events searches timed out at 15 s (real run); 25 s + the 25 s AI check still ends well inside the 60 s limit
const AI_TIMEOUT_MS = 25_000;

type Snippet = { title: string; snippet: string; link: string };
type SnippetResult = { snippets: Snippet[]; error: string | null };

async function fetchSearchSnippets(apiKey: string, query: string): Promise<SnippetResult> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("num", "5");

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
  } catch (err) {
    return { snippets: [], error: `"${query}": request failed (${String(err)})`.slice(0, 200) };
  }
  const payload = (await response.json().catch(() => null)) as {
    organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
    error?: string;
  } | null;
  if (!response.ok) return { snippets: [], error: `"${query}": HTTP ${response.status} ${payload?.error ?? ""}`.trim().slice(0, 200) };
  if (!payload) return { snippets: [], error: `"${query}": unreadable answer` };
  if (payload.error && !/hasn't returned any results|no results/i.test(payload.error)) return { snippets: [], error: `"${query}": ${payload.error}`.slice(0, 200) };

  return {
    snippets: (payload.organic_results ?? []).slice(0, 5).map((r) => ({
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      link: r.link ?? "",
    })),
    error: null,
  };
}

type ExtractedShow = {
  name: string;
  confident: boolean;
  startDate: string | null;
  endDate: string | null;
  city: string | null;
  link: string | null;
};

async function extractShowDates(
  apiKey: string,
  shows: Array<{ name: string; snippets: Snippet[] }>,
  now: Date,
): Promise<{ shows: ExtractedShow[]; error: string | null }> {
  if (!shows.length) return { shows: [], error: null };

  const prompt = [
    `Today's date is ${now.toISOString().slice(0, 10)}.`,
    "For each named recurring event below, use ONLY the provided search snippets to determine",
    "its NEXT upcoming occurrence -- a date on or after today. If the snippets don't clearly",
    "support a confident date for the upcoming occurrence, mark it unconfident. Do not guess or",
    "extrapolate from a past year's pattern (e.g. do not assume 'always early July' if that's",
    "not actually stated for the upcoming instance).",
    "",
    'Return ONLY a JSON array, same order, one entry per event:',
    '[{"name": "...", "confident": true|false, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "city": "..."|null, "link": "..."|null}]',
    "No explanation, no markdown.",
    "",
    JSON.stringify(shows),
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return { shows: [], error: `AI request failed: ${response.status} ${details}`.slice(0, 300) }; // fail closed
    }

    const result = (await response.json()) as { content?: { type: string; text: string }[] };
    const rawText = result.content?.[0]?.text ?? "[]";
    const firstBracket = rawText.indexOf("[");
    const lastBracket = rawText.lastIndexOf("]");
    if (firstBracket < 0 || lastBracket <= firstBracket) return { shows: [], error: `No JSON array in AI response: ${rawText}`.slice(0, 300) };

    return { shows: JSON.parse(rawText.slice(firstBracket, lastBracket + 1)) as ExtractedShow[], error: null };
  } catch (err) {
    return { shows: [], error: `AI extraction threw: ${String(err)}`.slice(0, 300) }; // fail closed
  }
}

const DAY_MS = 86_400_000;

/** A date the model gave back is only used if it is a real day, not already over, not absurdly far off, and the range is a plausible length. */
function sensibleDates(start: unknown, end: unknown, now: Date): { start: string; end: string } | null {
  if (!isIsoDay(start)) return null;
  const endDay = isIsoDay(end) ? end : start;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${endDay}T00:00:00Z`);
  if (endMs < startMs || endMs - startMs > 14 * DAY_MS) return null;
  if (endMs < now.getTime() - DAY_MS) return null; // already over
  if (startMs > now.getTime() + 540 * DAY_MS) return null; // further out than any announced show
  return { start, end: endDay };
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!serpApiKey || !anthropicKey) {
    return NextResponse.json(
      { error: "not_configured", message: "SERPAPI_KEY and ANTHROPIC_API_KEY are both required." },
      { status: 503 },
    );
  }

  const svc = getServiceClient();
  if (!svc) {
    return NextResponse.json({ error: "not_configured", message: "Supabase service client unavailable." }, { status: 500 });
  }

  const now = new Date();
  const t0 = Date.now();

  const withSnippets = await Promise.all(
    MAJOR_SHOWS.map(async (show) => ({
      show,
      ...(await fetchSearchSnippets(serpApiKey, `${show.name} official dates`)),
    })),
  );
  const searchErrors = withSnippets.flatMap((s) => (s.error ? [s.error] : []));

  // The model is only asked about shows whose search worked; a show with no snippets cannot be dated.
  const askable = withSnippets.filter((s) => !s.error && s.snippets.length > 0);
  const extraction = await extractShowDates(
    anthropicKey,
    askable.map(({ show, snippets }) => ({ name: show.name, snippets })),
    now,
  );

  const rows: EventRow[] = [];
  let skippedUnconfident = 0;
  let rejectedDates = 0;
  let unmatched = 0;
  const byName = new Map(extraction.shows.map((e) => [e?.name, e]));
  askable.forEach(({ show }, i) => {
    // By position (the model was told to keep the order), checked against the name; otherwise by name; never guessed.
    const positional = extraction.shows[i];
    const result = positional && positional.name === show.name ? positional : byName.get(show.name);
    if (!result) {
      unmatched += 1;
      return;
    }
    if (!result.confident || !result.startDate) {
      skippedUnconfident += 1;
      return;
    }
    const dates = sensibleDates(result.startDate, result.endDate, now);
    if (!dates) {
      rejectedDates += 1;
      return;
    }
    const stamps = dayStamps(dates.start, dates.end);
    rows.push({
      slug: eventSlug(show.name, dates.start, result.city),
      name: show.name,
      ...stamps,
      city: result.city,
      website_url: result.link,
      country: "US",
      relevant_universes: show.universes,
      // Every show on the maintained list is Featured: that is what puts it ahead of the small local shows in the Home banner's ten.
      is_featured: true,
      // enabled omitted -- see refresh-events for why.
    });
  });

  const tSearched = Date.now();
  const saved = await persistEvents(svc, rows);
  const tSaved = Date.now();
  // Pictures for the banner events that have none (their organiser's own share image). Done after the response has gone: a run that did its real work
  // must not be marked failed, or time out, because of this. Its result goes to the log.
  const artRan: { scheduled: boolean } = { scheduled: false };
  artRan.scheduled = await runAfterResponse(async () => {
    const art = await fillBannerArt(svc).catch((err) => ({ checked: 0, filled: 0, classified: 0, filledSlugs: [] as string[], errors: [`art step threw: ${String(err)}`.slice(0, 200)] }));
    const line = JSON.stringify({ checked: art.checked, filled: art.filled, classified: art.classified, errors: art.errors });
    if (art.errors.length) console.error("[refresh-major-events] art", line);
    else console.log("[refresh-major-events] art", line);
  });

  const problems: string[] = [];
  if (searchErrors.length === MAJOR_SHOWS.length) problems.push("every search failed");
  else if (searchErrors.length) problems.push(`${searchErrors.length} of ${MAJOR_SHOWS.length} searches failed`);
  if (extraction.error) problems.push(`date extraction: ${extraction.error}`);
  if (saved.failed) problems.push(`${saved.failed} event(s) could not be saved`);
  const hardFailure = searchErrors.length === MAJOR_SHOWS.length || Boolean(extraction.error) || saved.failed > 0;

  const body = {
    ok: !hardFailure,
    ranAt: now.toISOString(),
    totalShows: MAJOR_SHOWS.length,
    searchErrors,
    extractionError: extraction.error,
    skippedUnconfident,
    rejectedDates,
    unmatched,
    inserted: saved.inserted,
    updated: saved.updated,
    matchedExisting: saved.matchedExisting,
    duplicatesDropped: saved.duplicatesDropped,
    failed: saved.failed,
    saveErrors: saved.errors,
    artAfterResponse: artRan.scheduled,
    timingMs: { searchesAndAi: tSearched - t0, save: tSaved - tSearched, total: Date.now() - t0 },
    problems,
  };
  if (hardFailure || problems.length) console.error("[refresh-major-events]", JSON.stringify(body));
  else console.log("[refresh-major-events]", JSON.stringify({ ranAt: body.ranAt, inserted: body.inserted, updated: body.updated, skippedUnconfident }));
  return NextResponse.json(body, { status: hardFailure ? 502 : 200 });
}
