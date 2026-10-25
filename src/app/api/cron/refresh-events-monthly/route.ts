import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { fillBannerArt } from "@/lib/events/eventArt";
import { runAfterResponse } from "@/lib/events/afterResponse";
import { eventSlug, persistEvents, type EventRow } from "@/lib/events/eventPipeline";
import { claimMonth, monthClaimName, releaseMonth } from "@/lib/events/monthlyClaim";
import {
  CATEGORY_QUERIES,
  TICKETMASTER_KEYWORDS,
  fetchSerpCandidates,
  fetchSerpAccount,
  fetchTicketmasterCandidates,
  filterRelevantCandidates,
  pingAi,
  toRow,
  type Candidate,
  type SourceResult,
} from "@/lib/events/eventSources";
import {
  AI_BATCH_SIZE,
  AI_MAX_OUTPUT_TOKENS,
  MAX_CANDIDATES_FOR_AI,
  SERPAPI_DEFAULT_USD_PER_SEARCH,
  TICKETMASTER_PAGE_SIZE,
  aiCallUsd,
  checkApproval,
  monthlyCategories,
  monthlyWindows,
  planCounts,
  serpAllowanceVerdict,
  withRecordedApproval,
} from "@/lib/events/monthlyRefreshPlan";

// The monthly Events refresh: ONE pass over the coming year (see lib/events/monthlyRefreshPlan.ts for the plan and its estimated cost).
//
//  - It runs once a month (vercel.json), authorized by the owner: once monthly, within the allowances the accounts already have, no top-ups, no overages, no repeated paid
//    retries. Switched off, a call answers with why and makes no search, no AI call and no database change.
//  - ONCE A MONTH, whatever invokes it: before any paid request it claims the month's marker (lib/events/monthlyClaim.ts); an invocation that finds it taken does nothing.
//  - Everything it may ask for is counted before the first request, and the request counts below come from that plan, so they cannot grow while it runs.
//  - Every request is made once. A search or AI call that fails is reported and is not repeated: not here, and not by a retry loop around it. The next paid
//    request happens only when the owner runs the job again.
//  - It does not need the retry memory (SQL file 8) and does not use it.
//  - Before the first search it makes one very small AI request. That is a PAID request (it uses a little of the AI account's credit), and it shows only that the key works
//    and the account could be charged for that request. It does NOT show that the balance covers the whole run: the AI account's balance is unverified.
//  - `?plan=1` (with the secret) returns the plan, the ESTIMATED worst case and whether it is switched on, and makes no outside request at all.
//
// A run on a Hobby plan needs the longer function limit; 300 seconds is the largest the platform allows there.
export const maxDuration = 300;

const SEARCH_BUDGET_MS = 150_000; // four rounds of searches normally take well under a minute; no new round starts after this

function planResponse(approval: ReturnType<typeof checkApproval>, windows: ReturnType<typeof monthlyWindows>) {
  return {
    ok: true,
    enabled: approval.allowed,
    refusedBecause: approval.reasons,
    plan: {
      windows: windows.map((w) => ({ from: w.startDay, to: w.endDay, label: w.label })),
      categories: monthlyCategories(),
      googleEventsSearches: approval.counts.serpSearches,
      ticketmasterSearches: approval.counts.ticketmasterSearches,
      aiCalls: approval.counts.aiCalls,
      eventsPutToTheAi: approval.counts.maxCandidatesForAi,
      retries: 0,
    },
    worstCaseUsd: {
      basis: "my estimate from list prices and the token limits: not an approved budget and not a spending cap at the provider",
      googleEventsSearches: round(approval.worst.serpUsd),
      aiChecks: round(approval.worst.aiUsd),
      total: round(approval.worst.totalUsd),
      assumedUsdPerSearch: approval.worst.serpUsdPerSearch,
    },
  };
}
const round = (n: number) => Math.round(n * 10_000) / 10_000;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "not_configured", message: "CRON_SECRET is not set." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const windows = monthlyWindows(now);
  const approval = checkApproval(withRecordedApproval(process.env));

  // The plan and its cost, with no outside request (works whether or not the job is approved).
  if (new URL(req.url).searchParams.get("plan") === "1") return NextResponse.json(planResponse(approval, windows), { status: 200 });

  // `?preflight=1`: reads SerpApi's own account figures (free, not a search) and says whether this run's searches would fit. Nothing else is sent, and nothing is saved.
  if (new URL(req.url).searchParams.get("preflight") === "1") {
    const key = process.env.SERPAPI_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "SERPAPI_KEY is not set" }, { status: 503 });
    const { account, error } = await fetchSerpAccount(key);
    const needed = planCounts().serpSearches;
    const verdict = account ? serpAllowanceVerdict(account, needed) : null;
    const body = { ok: Boolean(verdict?.fits), checkedAt: now.toISOString(), searchesNeeded: needed, serpApi: account, fits: verdict?.fits ?? false, shortfall: verdict?.shortfall ?? error, note: "read-only: no search, no AI call, nothing saved" };
    console.log("[refresh-events-monthly] preflight", JSON.stringify(body));
    return NextResponse.json(body, { status: 200 });
  }

  if (!approval.allowed) {
    console.log("[refresh-events-monthly] not approved: no outside request was made");
    return NextResponse.json(
      { ...planResponse(approval, windows), disabled: true, message: "This refresh is switched off. It made no search, no AI call and no database change." },
      { status: 200 },
    );
  }

  const serpKey = process.env.SERPAPI_KEY;
  const tmKey = process.env.TICKETMASTER_API_KEY;
  const aiKey = process.env.ANTHROPIC_API_KEY;
  if (!serpKey && !tmKey) return NextResponse.json({ error: "not_configured", message: "Neither SERPAPI_KEY nor TICKETMASTER_API_KEY is set." }, { status: 503 });
  if (!aiKey) return NextResponse.json({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set, so nothing found could be checked. No search was made." }, { status: 503 });
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: "not_configured", message: "Supabase service client unavailable. No search was made." }, { status: 500 });

  // BEFORE the first search is paid for: (1) SerpApi's own figures must show the plan's monthly allowance covers every search; (2) one tiny AI request must succeed, so searches are
  // never bought that the AI check could not then judge. A SerpApi allowance shortfall stops the run before any search or AI request; a refused AI request stops it before any search. The AI request is itself a PAID request (it can consume a little credit when it succeeds), so a run that goes on to search has already spent that. Neither check is retried; each says exactly what is short.
  const needed = planCounts().serpSearches;
  // ONCE A MONTH: claim this month's marker before anything is sent. An invocation that finds it taken (a second cron firing, a hand-pressed Run, two at the same instant) does nothing.
  const claimName = monthClaimName(now);
  const claim = await claimMonth(svc, claimName);
  if (claim.status === "already") {
    console.log("[refresh-events-monthly] already ran this month: nothing was sent", claimName);
    return NextResponse.json({ ok: true, alreadyRanThisMonth: true, month: claimName.slice(-7), message: "The refresh already started this month, so this call did nothing: no search, no AI call, no database change.", usage: { googleEventsSearches: { made: 0, succeeded: 0 }, ticketmasterSearches: { made: 0, succeeded: 0 }, aiCalls: { made: 0 }, retries: 0 } }, { status: 200 });
  }
  if (claim.status === "error") {
    console.error("[refresh-events-monthly] not started: this month's run could not be recorded:", claim.message);
    return NextResponse.json({ ok: false, stoppedBeforeAnySearch: true, shortfall: `this month's run could not be recorded, so it was not started (it cannot promise to run only once): ${claim.message}`, usage: { googleEventsSearches: { made: 0, succeeded: 0 }, ticketmasterSearches: { made: 0, succeeded: 0 }, aiCalls: { made: 0 }, retries: 0 } }, { status: 503 });
  }
  if (serpKey) {
    const { account, error } = await fetchSerpAccount(serpKey);
    const verdict = account ? serpAllowanceVerdict(account, needed) : null;
    if (!verdict?.fits) {
      const shortfall = verdict?.shortfall ?? `could not read the SerpApi allowance (${error})`;
      console.error("[refresh-events-monthly] stopped before any search:", shortfall);
      await releaseMonth(svc, claimName); // no monthly work was done, so the month is given back
      return NextResponse.json({ ok: false, stoppedBeforeAnySearch: true, shortfall, serpApi: account, usage: { googleEventsSearches: { made: 0, succeeded: 0 }, ticketmasterSearches: { made: 0, succeeded: 0 }, aiCalls: { made: 0 }, retries: 0 } }, { status: 503 });
    }
  }
  const ping = await pingAi(aiKey);
  if (ping.error) {
    console.error("[refresh-events-monthly] stopped before any search: AI check unavailable:", ping.error);
    await releaseMonth(svc, claimName); // no search was made, so the month is given back
    return NextResponse.json({ ok: false, stoppedBeforeAnySearch: true, shortfall: `the AI check cannot run: ${ping.error}`, usage: { googleEventsSearches: { made: 0, succeeded: 0 }, ticketmasterSearches: { made: 0, succeeded: 0 }, aiCalls: { made: 1, failed: 1 }, retries: 0 } }, { status: 503 });
  }

  const t0 = Date.now();
  const serpUsdPerSearch = Number(process.env.SERPAPI_USD_PER_SEARCH) > 0 ? Number(process.env.SERPAPI_USD_PER_SEARCH) : SERPAPI_DEFAULT_USD_PER_SEARCH;
  const usage = { serpRequests: 0, serpSucceeded: 0, ticketmasterRequests: 0, ticketmasterSucceeded: 0, aiCalls: 1, aiInputTokens: ping.usage?.inputTokens ?? 0, aiOutputTokens: ping.usage?.outputTokens ?? 0 }; // the check request before the searches is the first AI call
  const errors: string[] = [];
  const found: Candidate[] = [];
  let roundsRun = 0;
  const roundsSkipped: string[] = [];

  // One round per window; the six categories of a round go out together (a Google Events search and a Ticketmaster search each).
  for (const w of windows) {
    if (Date.now() - t0 > SEARCH_BUDGET_MS) {
      roundsSkipped.push(w.label);
      continue;
    }
    roundsRun += 1;
    const results = await Promise.all(
      Object.entries(CATEGORY_QUERIES).map(async ([category, query]) => {
        const [serp, tm] = await Promise.all([
          serpKey ? fetchSerpCandidates(serpKey, category, `${query} ${w.months}`, now) : Promise.resolve<SourceResult | null>(null),
          tmKey ? fetchTicketmasterCandidates(tmKey, category, TICKETMASTER_KEYWORDS[category] ?? category, { startDay: w.startDay, endDay: w.endDay, size: TICKETMASTER_PAGE_SIZE }) : Promise.resolve<SourceResult | null>(null),
        ]);
        return { serp, tm };
      }),
    );
    for (const { serp, tm } of results) {
      if (serp) {
        usage.serpRequests += 1;
        if (serp.error) errors.push(`${w.label}: ${serp.error}`);
        else usage.serpSucceeded += 1;
        found.push(...serp.candidates);
      }
      if (tm) {
        usage.ticketmasterRequests += 1;
        if (tm.error) errors.push(`${w.label}: ${tm.error}`);
        else usage.ticketmasterSucceeded += 1;
        found.push(...tm.candidates);
      }
    }
  }

  // The same event found twice is one event; what is already over, or starts more than a year out, is not wanted; the soonest come first and the cap applies.
  const horizon = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
  const unique = new Map<string, Candidate>();
  for (const c of found) {
    if (Date.parse(c.endsAt) < now.getTime() || Date.parse(c.startsAt) > horizon) continue;
    const slug = eventSlug(c.name, c.startsAt.slice(0, 10), c.city);
    if (!unique.has(slug)) unique.set(slug, c);
  }
  const ordered = [...unique.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const forAi = ordered.slice(0, MAX_CANDIDATES_FOR_AI);
  const leftOut = ordered.length - forAi.length;

  // The AI check: a few calls, each once, all together. A call that fails publishes none of its events (fail closed) and is not repeated.
  const batches: Candidate[][] = [];
  for (let i = 0; i < forAi.length; i += AI_BATCH_SIZE) batches.push(forAi.slice(i, i + AI_BATCH_SIZE));
  const answers = await Promise.all(batches.map((b) => filterRelevantCandidates(aiKey, b.map((c) => ({ name: c.name, category: c.category, description: c.description })), { maxTokens: AI_MAX_OUTPUT_TOKENS })));
  const approved: Candidate[] = [];
  let rejected = 0;
  let batchesFailed = 0;
  answers.forEach((answer, bi) => {
    usage.aiCalls += 1;
    usage.aiInputTokens += answer.usage?.inputTokens ?? 0;
    usage.aiOutputTokens += answer.usage?.outputTokens ?? 0;
    if (answer.error) {
      batchesFailed += 1;
      errors.push(`relevance check, group ${bi + 1}: ${answer.error}`.slice(0, 300));
    }
    batches[bi].forEach((c, i) => {
      if (answer.approved.has(i)) approved.push(c);
      else if (answer.rejected.has(i)) rejected += 1;
    });
  });

  const rows: EventRow[] = [...new Map(approved.map((c) => [eventSlug(c.name, c.startsAt.slice(0, 10), c.city), toRow(c)])).values()];
  const tSearched = Date.now();
  const saved = await persistEvents(svc, rows);

  // Pictures for banner events that have none: free (their organiser's own page), done after the response has gone.
  const artScheduled = await runAfterResponse(async () => {
    const art = await fillBannerArt(svc).catch((err) => ({ checked: 0, filled: 0, classified: 0, filledSlugs: [] as string[], errors: [`art step threw: ${String(err)}`.slice(0, 200)] }));
    const line = JSON.stringify({ checked: art.checked, filled: art.filled, classified: art.classified, errors: art.errors });
    if (art.errors.length) console.error("[refresh-events-monthly] art", line);
    else console.log("[refresh-events-monthly] art", line);
  });

  const serpUsd = usage.serpSucceeded * serpUsdPerSearch;
  const aiUsd = aiCallUsd(usage.aiInputTokens, usage.aiOutputTokens);
  const problems: string[] = [];
  if (serpKey && usage.serpRequests > 0 && usage.serpSucceeded === 0) problems.push("Google Events (SerpApi): every search failed");
  if (tmKey && usage.ticketmasterRequests > 0 && usage.ticketmasterSucceeded === 0) problems.push("Ticketmaster: every search failed");
  if (errors.length && !problems.length) problems.push(`${errors.length} request(s) failed (none repeated)`);
  if (roundsSkipped.length) problems.push(`not run (time budget): ${roundsSkipped.join("; ")}`);
  if (leftOut > 0) problems.push(`${leftOut} event(s) beyond the ${MAX_CANDIDATES_FOR_AI} cap were not put to the AI`);
  if (saved.failed) problems.push(`${saved.failed} event(s) could not be saved`);
  const hardFailure = batchesFailed > 0 || saved.failed > 0 || (usage.serpRequests > 0 && usage.serpSucceeded === 0 && usage.ticketmasterSucceeded === 0);

  const body = {
    ok: !hardFailure,
    ranAt: now.toISOString(),
    // what was asked for, against the plan (retries is always zero: nothing here repeats a request)
    usage: {
      googleEventsSearches: { made: usage.serpRequests, succeeded: usage.serpSucceeded },
      ticketmasterSearches: { made: usage.ticketmasterRequests, succeeded: usage.ticketmasterSucceeded },
      aiCalls: { made: usage.aiCalls, failed: batchesFailed, inputTokens: usage.aiInputTokens, outputTokens: usage.aiOutputTokens },
      retries: 0,
      roundsRun,
    },
    // from list prices and the usage the AI service itself reported; the provider's own billing page is the record of what was charged
    estimatedUsd: { googleEventsSearches: round(serpUsd), aiChecks: round(aiUsd), total: round(serpUsd + aiUsd), assumedUsdPerSearch: serpUsdPerSearch, basis: "estimate, not billing" },
    foundBeforeChecks: found.length,
    uniqueWanted: ordered.length,
    putToTheAi: forAi.length,
    approvedByAi: approved.length,
    rejectedByAi: rejected,
    leftOutByTheCap: leftOut,
    inserted: saved.inserted,
    updated: saved.updated,
    matchedExisting: saved.matchedExisting,
    duplicatesDropped: saved.duplicatesDropped,
    failed: saved.failed,
    saveErrors: saved.errors,
    errors,
    artAfterResponse: artScheduled,
    timingMs: { searchesAndAi: tSearched - t0, total: Date.now() - t0 },
    problems,
  };
  if (hardFailure || problems.length) console.error("[refresh-events-monthly]", JSON.stringify(body));
  else console.log("[refresh-events-monthly]", JSON.stringify({ ranAt: body.ranAt, usage: body.usage, estimatedUsd: body.estimatedUsd, inserted: body.inserted, updated: body.updated }));
  return NextResponse.json(body, { status: hardFailure ? 502 : 200 });
}
