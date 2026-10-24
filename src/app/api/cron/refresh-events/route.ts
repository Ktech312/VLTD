import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { eventsRefreshEnabled, refreshDisabledResponse } from "@/lib/events/refreshSwitch";
import { fillBannerArt } from "@/lib/events/eventArt";
import { runAfterResponse } from "@/lib/events/afterResponse";
import { openRefreshStore, type NewCandidate } from "@/lib/events/refreshStore";
import { eventSlug, persistEvents, type EventRow } from "@/lib/events/eventPipeline";
import {
  CATEGORY_QUERIES,
  TICKETMASTER_KEYWORDS,
  NO_ANSWER,
  fetchSerpCandidates,
  fetchTicketmasterCandidates,
  filterRelevantCandidates,
  toRow,
  type AiAnswer,
  type SourceResult,
} from "@/lib/events/eventSources";

// Several searches plus the AI check run in one request; the platform default (10 s on some plans) is too short for that.
export const maxDuration = 60;

// The daily refresh. It has NO schedule today (vercel.json is empty) and does nothing unless EVENTS_REFRESH_ENABLED is exactly "true" (lib/events/refreshSwitch.ts).
// When it was scheduled it ran once a day so nobody had to manually find
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

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "not_configured", message: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Switched off (see lib/events/refreshSwitch.ts): nothing below runs, so no search, AI call or database write can happen.
  if (!eventsRefreshEnabled()) return refreshDisabledResponse("refresh-events");

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
  const t0 = Date.now();
  const day = now.toISOString().slice(0, 10);
  // The memory of paid work already done (see lib/events/refreshStore.ts): a search that succeeded today is not repeated, and what was found is kept
  // whether or not the AI check could run.
  const store = await openRefreshStore(svc, day);
  const fetched: NewCandidate[] = [];
  const foundByCategory: Record<string, number> = {};
  const sourceErrors: string[] = [];
  let searchesRun = 0;
  let searchesSkipped = 0;
  // A source that failed on every one of its searches is a dead source (bad key, outage, quota), not a quiet day.
  const attempts = { serp: 0, ticketmaster: 0 };
  const failures = { serp: 0, ticketmaster: 0 };

  // Every category at once (each is one Google Events and one Ticketmaster search) so the whole run fits in the time the function is given.
  const perCategory = await Promise.all(
    Object.entries(CATEGORY_QUERIES).map(async ([category, query]) => {
      const serpKey = store.stepKey("search", "serp", category);
      const tmKey = store.stepKey("search", "ticketmaster", category);
      const [serp, tm] = await Promise.all([
        serpApiKey && store.done(serpKey) === undefined ? fetchSerpCandidates(serpApiKey, category, query, now) : Promise.resolve<SourceResult | null>(null),
        ticketmasterKey && store.done(tmKey) === undefined
          ? fetchTicketmasterCandidates(ticketmasterKey, category, TICKETMASTER_KEYWORDS[category] ?? category)
          : Promise.resolve<SourceResult | null>(null),
      ]);
      return { category, serp, tm, serpKey, tmKey };
    }),
  );
  for (const { category, serp, tm, serpKey, tmKey } of perCategory) {
    foundByCategory[category] = 0;
    if (serpApiKey && !serp) searchesSkipped += 1;
    if (ticketmasterKey && !tm) searchesSkipped += 1;
    for (const [source, result, key] of [["serp", serp, serpKey], ["ticketmaster", tm, tmKey]] as const) {
      if (!result) continue;
      searchesRun += 1;
      attempts[source] += 1;
      if (result.error) {
        failures[source] += 1;
        sourceErrors.push(result.error);
      } else {
        await store.record(key, { found: result.candidates.length, at: new Date().toISOString() });
      }
      for (const c of result.candidates) fetched.push({ slug: eventSlug(c.name, c.startsAt.slice(0, 10), c.city), category: c.category, source, row: toRow(c), description: c.description });
      foundByCategory[category] += result.candidates.length;
    }
  }
  const deadSources = (["serp", "ticketmaster"] as const).filter((source) => attempts[source] > 0 && failures[source] === attempts[source]);
  await store.addCandidates(fetched);

  // Which events still need the AI check, and which were already approved but not saved. Without the store, everything found this run is asked about.
  const pending = store.available ? await store.pending() : fetched.map((f) => ({ slug: f.slug, category: f.category, source: f.source, row: f.row, description: f.description }));
  const approvedBefore = store.available ? await store.approvedUnsaved() : [];

  // No AI key to gate with -> nothing from a keyword search gets published,
  // full stop. (Not expected to trigger; ANTHROPIC_API_KEY has been live in
  // Vercel for months.)
  const aiFilterResult: AiAnswer = !pending.length
    ? NO_ANSWER(null)
    : anthropicKey
      ? await filterRelevantCandidates(anthropicKey, pending.map((p) => ({ name: p.row.name, category: p.category, description: p.description })))
      : NO_ANSWER("ANTHROPIC_API_KEY not set");
  const approvedNow = pending.filter((_, i) => aiFilterResult.approved.has(i));
  const rejectedNow = pending.filter((_, i) => aiFilterResult.rejected.has(i));
  await store.judge(approvedNow.map((c) => c.slug), rejectedNow.map((c) => c.slug));

  const toSave = [...new Map([...approvedBefore, ...approvedNow].map((c) => [c.slug, c])).values()];
  const repeatsMerged = approvedBefore.length + approvedNow.length - toSave.length; // the same event found by two searches or two sources
  const rows: EventRow[] = toSave.map((c) => c.row);

  const tSearched = Date.now();
  const saved = await persistEvents(svc, rows);
  await store.markSaved(toSave.map((c) => c.slug).filter((slug) => !saved.failedSlugs.includes(slug)));
  await store.purge();
  const tSaved = Date.now();
  // Pictures for the banner events that have none (their organiser's own share image). Done after the response has gone: a run that did its real work
  // must not be marked failed, or time out, because of this. Its result goes to the log.
  const artRan: { scheduled: boolean } = { scheduled: false };
  artRan.scheduled = await runAfterResponse(async () => {
    const art = await fillBannerArt(svc).catch((err) => ({ checked: 0, filled: 0, classified: 0, filledSlugs: [] as string[], errors: [`art step threw: ${String(err)}`.slice(0, 200)] }));
    const line = JSON.stringify({ checked: art.checked, filled: art.filled, classified: art.classified, errors: art.errors });
    if (art.errors.length) console.error("[refresh-events] art", line);
    else console.log("[refresh-events] art", line);
  });

  // A run that did not do its job answers with an error status (the platform marks the cron run failed and the log line below is easy to find),
  // instead of a cheerful 200 that nobody looks at.
  const problems: string[] = [];
  for (const source of deadSources) problems.push(`${source === "serp" ? "Google Events (SerpApi)" : "Ticketmaster"}: every search failed`);
  if (sourceErrors.length && !deadSources.length) problems.push(`${sourceErrors.length} of ${searchesRun} searches failed`);
  if (aiFilterResult.error) problems.push(`relevance check: ${aiFilterResult.error}`);
  if (saved.failed) problems.push(`${saved.failed} event(s) could not be saved`);
  const hardFailure = deadSources.length > 0 || Boolean(aiFilterResult.error) || saved.failed > 0;

  const body = {
    ok: !hardFailure,
    ranAt: now.toISOString(),
    searchesRun,
    searchesReusedFromToday: searchesSkipped,
    sourceErrors,
    foundByCategory,
    totalFound: fetched.length,
    // the memory of earlier work: events kept for the AI check, and events already approved that only needed saving
    memory: store.available
      ? { available: true, askedTheAiAbout: pending.length, alreadyApprovedNowSaved: approvedBefore.length, judgedApproved: approvedNow.length, judgedRejected: rejectedNow.length, stillNotJudged: pending.length - approvedNow.length - rejectedNow.length }
      : { available: false, note: store.note },
    approvedByAi: approvedNow.length,
    aiFilterError: aiFilterResult.error,
    inserted: saved.inserted,
    updated: saved.updated,
    matchedExisting: saved.matchedExisting,
    duplicatesDropped: saved.duplicatesDropped + repeatsMerged,
    failed: saved.failed,
    saveErrors: saved.errors,
    artAfterResponse: artRan.scheduled,
    // where the time went, so a slow run can be told from a failed one
    timingMs: { searchesAndAi: tSearched - t0, save: tSaved - tSearched, total: Date.now() - t0 },
    problems,
  };
  if (hardFailure || problems.length) console.error("[refresh-events]", JSON.stringify(body));
  else console.log("[refresh-events]", JSON.stringify({ ranAt: body.ranAt, totalFound: body.totalFound, inserted: body.inserted, updated: body.updated }));
  return NextResponse.json(body, { status: hardFailure ? 502 : 200 });
}
