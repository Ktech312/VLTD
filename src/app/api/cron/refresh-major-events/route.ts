import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";

// Runs weekly (see vercel.json) to keep a curated list of the major,
// well-known recurring collector shows current -- this is a NAME lookup,
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

type MajorShow = { name: string; universes: string[] };

// EK: edit this list freely -- add/remove shows as you see fit. Each
// listed once by name; the weekly job just keeps its date/location current.
const MAJOR_SHOWS: MajorShow[] = [
  { name: "San Diego Comic-Con", universes: ["comics", "toys", "games"] },
  { name: "New York Comic Con", universes: ["comics", "toys"] },
  { name: "WonderCon", universes: ["comics"] },
  { name: "C2E2 Chicago Comic and Entertainment Expo", universes: ["comics", "toys"] },
  { name: "The National Sports Collectors Convention", universes: ["sports_cards", "tcg"] },
  { name: "Pokemon World Championships", universes: ["tcg"] },
  { name: "MagicCon", universes: ["tcg"] },
  { name: "Gen Con", universes: ["games", "tcg"] },
  { name: "NAMM Show", universes: ["vinyl"] },
  { name: "WFMU Record Fair", universes: ["vinyl"] },
  { name: "Sneaker Con", universes: ["sneakers"] },
  { name: "Windup Watch Fair", universes: ["watches"] },
  { name: "Portland Retro Gaming Expo", universes: ["games"] },
  { name: "WhiskyFest", universes: ["whisky"] },
  { name: "ANA World's Fair of Money", universes: ["coins"] },
  { name: "APS StampShow", universes: ["stamps"] },
  { name: "Barrett-Jackson Auction", universes: ["classic_cars"] },
  { name: "Pebble Beach Concours d'Elegance", universes: ["classic_cars"] },
  { name: "SEMA Show", universes: ["automotive"] },
];

type Snippet = { title: string; snippet: string; link: string };

async function fetchSearchSnippets(apiKey: string, query: string): Promise<Snippet[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("num", "5");

  const response = await fetch(url).catch(() => null);
  if (!response || !response.ok) return [];

  const payload = (await response.json().catch(() => null)) as {
    organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
  } | null;

  return (payload?.organic_results ?? []).slice(0, 5).map((r) => ({
    title: r.title ?? "",
    snippet: r.snippet ?? "",
    link: r.link ?? "",
  }));
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
): Promise<ExtractedShow[]> {
  if (!shows.length) return [];

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
    });

    if (!response.ok) return []; // fail closed

    const result = (await response.json()) as { content?: { type: string; text: string }[] };
    const rawText = result.content?.[0]?.text ?? "[]";
    const firstBracket = rawText.indexOf("[");
    const lastBracket = rawText.lastIndexOf("]");
    if (firstBracket < 0 || lastBracket <= firstBracket) return [];

    return JSON.parse(rawText.slice(firstBracket, lastBracket + 1)) as ExtractedShow[];
  } catch {
    return []; // fail closed
  }
}

function slugify(name: string, year: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "event"}-${year}`;
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

  const withSnippets = await Promise.all(
    MAJOR_SHOWS.map(async (show) => ({
      show,
      snippets: await fetchSearchSnippets(serpApiKey, `${show.name} official dates`).catch(() => []),
    })),
  );

  const extracted = await extractShowDates(
    anthropicKey,
    withSnippets.map(({ show, snippets }) => ({ name: show.name, snippets })),
    now,
  );

  const rows = [];
  let skippedUnconfident = 0;
  for (const result of extracted) {
    if (!result.confident || !result.startDate) {
      skippedUnconfident += 1;
      continue;
    }
    const show = MAJOR_SHOWS.find((s) => s.name === result.name);
    const endDate = result.endDate ?? result.startDate;
    const year = result.startDate.slice(0, 4);

    rows.push({
      slug: slugify(result.name, year),
      name: result.name,
      starts_at: `${result.startDate}T00:00:00.000Z`,
      ends_at: `${endDate}T23:59:59.000Z`,
      city: result.city,
      website_url: result.link,
      country: "US",
      relevant_universes: show?.universes ?? null,
      // enabled/is_featured omitted -- see refresh-events for why.
    });
  }

  let upserted = 0;
  if (rows.length) {
    const { error } = await svc.from("collector_events").upsert(rows, { onConflict: "slug" });
    if (!error) upserted = rows.length;
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    totalShows: MAJOR_SHOWS.length,
    skippedUnconfident,
    upserted,
  });
}
