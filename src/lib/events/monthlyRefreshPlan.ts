import { CATEGORY_QUERIES, type SerpAccount } from "@/lib/events/eventSources";

// The monthly Events refresh: what it would ask for, an ESTIMATE of the most it can cost, and the switch that lets it run.
//
// Everything here is pure (no outside request, no clock but the one passed in), so the numbers the owner approves are the same numbers the job enforces.
//
// ONE pass covers the coming year: the next twelve months split into four three-month windows, and for each window one Google Events search (SerpApi) and one
// Ticketmaster search per category. Every request is made once. A request that fails is reported and is NOT repeated, by this job or by anything around it.

export const WINDOW_COUNT = 4;
export const WINDOW_MONTHS = 3;

/** Events kept for the AI check, and how many go in one AI call. Anything beyond the cap is left out of this run and reported, never searched or judged later on its own. */
export const MAX_CANDIDATES_FOR_AI = 300;
export const AI_BATCH_SIZE = 50;
/** Ticketmaster events asked for per search (their free quota is 5,000 calls a day, so these cost nothing). */
export const TICKETMASTER_PAGE_SIZE = 20;

/**
 * Hard limits on one AI call, enforced in the request itself: the answer can never be longer than the output cap (the API refuses to go past max_tokens).
 * The input cap is a ceiling on the prompt the job builds: 50 events, each with a name cut to 120 characters, a description cut to 200 and a short label,
 * plus about 1,000 characters of instructions, is under 20,000 characters; at the pessimistic 2.5 characters per token that is under 8,000 tokens.
 */
export const AI_MAX_OUTPUT_TOKENS = 1_500;
export const AI_MAX_INPUT_TOKENS = 8_000;

/** The one tiny AI request made before any search (see pingAi): its prompt is about 15 tokens; 200 is a generous ceiling. Its answer is capped at 5 tokens in the request. */
export const PING_MAX_INPUT_TOKENS = 200;
export const PING_MAX_OUTPUT_TOKENS = 5;

/** Claude Haiku 4.5 list prices, US dollars per million tokens (the Claude API pricing table in the claude-api skill, cached 2026-10-06). */
export const AI_USD_PER_MTOK = { input: 1, output: 5 } as const;

/**
 * SerpApi bills a successful search. The plans checked on serpapi.com/pricing on 2026-10-24: Free 250 searches a month; Starter $25 for 1,000 ($0.025 each);
 * Developer $75 for 5,000 ($0.015); Production $150 for 15,000 ($0.010). When nothing says otherwise the job assumes the dearest of those, $0.025, so the
 * ceiling it enforces can only be too high, never too low. The owner may set SERPAPI_USD_PER_SEARCH to the real figure for their plan.
 */
export const SERPAPI_DEFAULT_USD_PER_SEARCH = 0.025;

export type MonthlyWindow = { index: number; startDay: string; endDay: string; label: string; months: string };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const day = (y: number, m0: number, d: number) => {
  const date = new Date(Date.UTC(y, m0, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** The four windows that make up the coming year. The first starts today (nothing that is already over is wanted); each later one starts on the first of a month. */
export function monthlyWindows(now: Date): MonthlyWindow[] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const out: MonthlyWindow[] = [];
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const firstMonth = m + i * WINDOW_MONTHS;
    const months = [0, 1, 2].map((k) => {
      const date = new Date(Date.UTC(y, firstMonth + k, 1));
      return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    });
    out.push({
      index: i,
      startDay: i === 0 ? day(y, m, now.getUTCDate()) : day(y, firstMonth, 1),
      endDay: day(y, firstMonth + WINDOW_MONTHS, 1),
      label: `${months[0]} to ${months[2]}`,
      months: months.join(" "),
    });
  }
  return out;
}

export const monthlyCategories = (): string[] => Object.keys(CATEGORY_QUERIES);

export type PlanCounts = { windows: number; categories: number; serpSearches: number; ticketmasterSearches: number; aiCalls: number; preflightAiCalls: number; maxCandidatesForAi: number };

export function planCounts(): PlanCounts {
  const categories = monthlyCategories().length;
  return {
    windows: WINDOW_COUNT,
    categories,
    serpSearches: WINDOW_COUNT * categories,
    ticketmasterSearches: WINDOW_COUNT * categories,
    aiCalls: Math.ceil(MAX_CANDIDATES_FOR_AI / AI_BATCH_SIZE),
    preflightAiCalls: 1,
    maxCandidatesForAi: MAX_CANDIDATES_FOR_AI,
  };
}

export const aiCallUsd = (inputTokens: number, outputTokens: number) => (inputTokens * AI_USD_PER_MTOK.input + outputTokens * AI_USD_PER_MTOK.output) / 1_000_000;

export type WorstCase = { serpUsd: number; aiUsd: number; totalUsd: number; serpUsdPerSearch: number };

/** The most one run can cost: every search succeeds and is billed, and every AI call uses its full input and output allowance. */
export function worstCase(serpUsdPerSearch: number = SERPAPI_DEFAULT_USD_PER_SEARCH): WorstCase {
  const c = planCounts();
  const serpUsd = c.serpSearches * serpUsdPerSearch;
  const aiUsd = c.aiCalls * aiCallUsd(AI_MAX_INPUT_TOKENS, AI_MAX_OUTPUT_TOKENS) + c.preflightAiCalls * aiCallUsd(PING_MAX_INPUT_TOKENS, PING_MAX_OUTPUT_TOKENS);
  return { serpUsd, aiUsd, totalUsd: serpUsd + aiUsd, serpUsdPerSearch };
}

export type Approval = { allowed: boolean; reasons: string[]; worst: WorstCase; counts: PlanCounts };

const positive = (raw: string | undefined): number | null => {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Whether the job is switched on. It is when EVENTS_MONTHLY_REFRESH_ENABLED is exactly "true" (the owner's authorization is recorded as the default, see RECORDED_AUTHORIZATION).
 * There is NO dollar budget in the authorization. Two optional extra limits an owner can set in the environment are enforced when present, and a figure that is set but unreadable
 * switches the job off: EVENTS_MONTHLY_APPROVED_MAX_USD (checked against this plan's ESTIMATED worst case) and EVENTS_MONTHLY_APPROVED_MAX_SEARCHES (checked against the plan's searches).
 * The protection against overage is not a dollar figure: it is the allowance check and the once-a-month claim that run before anything is paid for.
 */
export function checkApproval(env: Record<string, string | undefined>): Approval {
  const counts = planCounts();
  const reasons: string[] = [];

  let perSearch = SERPAPI_DEFAULT_USD_PER_SEARCH;
  const rawPrice = env.SERPAPI_USD_PER_SEARCH;
  if (rawPrice !== undefined && rawPrice.trim() !== "") {
    const p = positive(rawPrice);
    if (p === null) reasons.push("SERPAPI_USD_PER_SEARCH is set but is not a positive number");
    else perSearch = p;
  }
  const worst = worstCase(perSearch);

  if (env.EVENTS_MONTHLY_REFRESH_ENABLED !== "true") reasons.push('EVENTS_MONTHLY_REFRESH_ENABLED is not exactly "true"');

  const rawMaxUsd = env.EVENTS_MONTHLY_APPROVED_MAX_USD;
  if (rawMaxUsd !== undefined && rawMaxUsd.trim() !== "") {
    const maxUsd = positive(rawMaxUsd);
    if (maxUsd === null) reasons.push("EVENTS_MONTHLY_APPROVED_MAX_USD is set but is not a positive number (no cost has been approved)");
    else if (maxUsd + 1e-9 < worst.totalUsd) reasons.push(`the extra cost limit $${maxUsd.toFixed(2)} set in the environment is below this plan's estimated worst case $${worst.totalUsd.toFixed(2)}`);
  }
  const rawMaxSearches = env.EVENTS_MONTHLY_APPROVED_MAX_SEARCHES;
  if (rawMaxSearches !== undefined && rawMaxSearches.trim() !== "") {
    const maxSearches = positive(rawMaxSearches);
    if (maxSearches === null) reasons.push("EVENTS_MONTHLY_APPROVED_MAX_SEARCHES is set but is not a positive number (no search count has been approved)");
    else if (maxSearches < counts.serpSearches) reasons.push(`the extra search limit ${maxSearches} set in the environment is below the plan's ${counts.serpSearches} Google Events searches`);
  }

  return { allowed: reasons.length === 0, reasons, worst, counts };
}

/**
 * Whether SerpApi's own figures say this run's searches fit in what is left of the plan's monthly allowance. The run must not dip into bought extra credits or be refused
 * part-way (no overage of any kind), so it needs the PLAN's searches left (not the total with extra credits) to cover every search it will make, and, when SerpApi reports an
 * hourly limit, room for them all in this hour (the searches go out together).
 */
export type AllowanceVerdict = { fits: boolean; shortfall: string | null };
export function serpAllowanceVerdict(account: SerpAccount, needed: number): AllowanceVerdict {
  if (account.planLeft < needed) {
    return { fits: false, shortfall: `SerpApi plan "${account.planName ?? "unknown"}": ${account.planLeft} of ${account.perMonth ?? "?"} monthly searches left, this run needs ${needed} (short by ${needed - account.planLeft})` };
  }
  if (account.hourLimit !== null && account.thisHour !== null && account.hourLimit - account.thisHour < needed) {
    return { fits: false, shortfall: `SerpApi hourly limit: ${account.hourLimit} an hour, ${account.thisHour} already used this hour, this run needs ${needed}` };
  }
  return { fits: true, shortfall: null };
}

/**
 * The owner's AUTHORIZATION, recorded here. On 2026-10-24 the owner wrote: "Enable one Events refresh on the first of each month, covering the coming year. Use the existing monthly
 * allowances. ... No automatic top-ups, paid overages or repeated paid retries." That is: once a month, within the allowances the accounts already have, no top-ups, no overages, no
 * repeated paid retries. The owner did NOT approve a dollar budget; the figures in worstCase are the developer's own estimate and nothing here treats them as an approved amount.
 * An environment variable of the same name overrides this, so the refresh can be switched off from Vercel without a deploy (EVENTS_MONTHLY_REFRESH_ENABLED=false).
 */
export const RECORDED_AUTHORIZATION = {
  EVENTS_MONTHLY_REFRESH_ENABLED: "true",
} as const;

/** The environment the switch check should read: the recorded authorization, with any real environment variable taking precedence. */
export function withRecordedApproval(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...env };
  for (const [key, value] of Object.entries(RECORDED_AUTHORIZATION)) if (out[key] === undefined || out[key] === "") out[key] = value;
  return out;
}
