import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";
import { fetchComicIssueChecked, fetchUpcomingComicsChecked, formatStoreDate, type UpcomingIssue } from "@/lib/comicUpcoming";
import { loadWishlist, saveWishlistItems, updateWishlistItem, wantIdNamespace } from "@/lib/wishlistModel";
import { loadItems } from "@/lib/vaultModel";
import { DATE_LOOKUPS_PER_RUN, DATE_LOOKUPS_PER_WINDOW, DATE_LOOKUP_INTERVAL_MS, catalogIssueIdOf, clampQuantity, planDateCorrection, planRuleRefresh, ruleIdentityOfItem, trackedDateCandidates, type CatalogRelease, type PullRule, type PullRuleKind, type PullRuleState } from "@/lib/wantsCore";

// Following: rules that collect future releases. Saved to the account (`pull_rules`, 20261024_wishlist_pull_list.sql) with a copy on this device;
// until that table exists the rules live on this device only (the page says so).
//
// What can actually be followed automatically: COMIC SERIES, from the comic catalog (Metron, through /api/comic-upcoming). There is no release feed for
// card products or toy lines in VLTD, so those rules are manual: the person adds each release themselves. Nothing here guesses a release.

const LS_BASE = "vltd_pull_rules_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const REFRESH_EVERY_MS = 6 * 3_600_000;

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? ""; } catch { return ""; }
}
function lsKey(): string {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

export function loadPullRules(): PullRule[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LS_BASE) {
      const legacy = localStorage.getItem(LS_BASE);
      if (legacy && mayAdoptLegacyKey(LS_BASE, key)) { localStorage.setItem(key, legacy); raw = legacy; }
    }
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PullRule[]) : [];
  } catch { return []; }
}

// A rule that was saved here but whose upload has not been confirmed is remembered on this device (same idea as the wishlist outbox), so a read of the account
// can never undo a pause, an edit or a new rule that has not reached it yet. Cleared when the account confirms.
function pendingKey() {
  const pid = activeProfileId();
  return pid ? `vltd_pull_rules_pending:${pid}` : "vltd_pull_rules_pending";
}
function readPending(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(pendingKey()) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
function writePending(ids: string[]) {
  try { localStorage.setItem(pendingKey(), JSON.stringify([...new Set(ids)])); } catch { /* storage unavailable */ }
}

function saveRules(rules: PullRule[]) {
  try {
    localStorage.setItem(lsKey(), JSON.stringify(rules));
    window.dispatchEvent(new Event("vltd:pull-rules-updated"));
  } catch { /* storage full or blocked: the account copy still holds it */ }
}

function ruleRow(rule: PullRule, pid: string) {
  return {
    id: rule.id,
    profile_id: pid,
    kind: rule.kind,
    name: rule.name,
    publisher: rule.publisher ?? null,
    year_began: rule.yearBegan ?? null,
    source: rule.source,
    source_key: rule.sourceKey ?? null,
    quantity: rule.quantity,
    format_note: rule.formatNote ?? null,
    state: rule.state,
    created_at: new Date(rule.createdAt).toISOString(),
    last_checked_at: rule.lastCheckedAt ? new Date(rule.lastCheckedAt).toISOString() : null,
    last_result: rule.lastResult ?? null,
  };
}

function rowToRule(r: Record<string, unknown>): PullRule {
  return {
    id: String(r.id),
    kind: r.kind as PullRuleKind,
    name: String(r.name ?? ""),
    publisher: (r.publisher as string) ?? undefined,
    yearBegan: r.year_began != null ? Number(r.year_began) : undefined,
    source: r.source === "metron" ? "metron" : "manual",
    sourceKey: (r.source_key as string) ?? undefined,
    quantity: clampQuantity(r.quantity),
    variantPolicy: "standard",
    formatNote: (r.format_note as string) ?? undefined,
    state: r.state === "paused" || r.state === "stopped" ? (r.state as PullRuleState) : "following",
    createdAt: Date.parse(String(r.created_at)) || Date.now(),
    lastCheckedAt: r.last_checked_at ? Date.parse(String(r.last_checked_at)) || undefined : undefined,
    lastResult: (r.last_result as string) ?? undefined,
  };
}

/** True when the account table exists (rules reach the account); false means this device only. */
export async function pushRule(rule: PullRule): Promise<boolean> {
  writePending([...readPending(), rule.id]);
  try {
    const pid = activeProfileId();
    const supabase = getSupabaseBrowserClient();
    if (!pid || !supabase) return false;
    const { error } = await supabase.from("pull_rules").upsert(ruleRow(rule, pid), { onConflict: "id" });
    if (!error) writePending(readPending().filter((id) => id !== rule.id));
    return !error;
  } catch { return false; }
}

export async function syncPullRulesFromSupabase(): Promise<{ rules: PullRule[]; inAccount: boolean }> {
  const local = loadPullRules();
  try {
    const pid = activeProfileId();
    const supabase = getSupabaseBrowserClient();
    if (!pid || !supabase) return { rules: local, inAccount: false };
    const stillSame = captureIdentity();
    const { data, error } = await supabase.from("pull_rules").select("*").eq("profile_id", pid);
    if (error || !Array.isArray(data)) return { rules: local, inAccount: false }; // table not there yet
    if (!stillSame()) return { rules: local, inAccount: true };
    if (data.length === 0) {
      for (const r of local) void pushRule(r);
      return { rules: local, inAccount: true };
    }
    // A rule saved here and not yet confirmed by the account keeps this device's copy and is sent again; the account's older copy must not undo it.
    const pending = new Set(readPending());
    const localById = new Map(local.map((r) => [r.id, r]));
    const remote = (data as Record<string, unknown>[]).map(rowToRule);
    const remoteIds = new Set(remote.map((r) => r.id));
    const resend: PullRule[] = [];
    const merged = remote.map((r) => {
      const mine = localById.get(r.id);
      if (mine && pending.has(r.id)) { resend.push(mine); return mine; }
      return r;
    });
    for (const r of local) if (pending.has(r.id) && !remoteIds.has(r.id)) { resend.push(r); merged.push(r); }
    const rules = merged.sort((a, b) => b.createdAt - a.createdAt);
    saveRules(rules);
    for (const r of resend) void pushRule(r);
    return { rules, inAccount: true };
  } catch { return { rules: local, inAccount: false }; }
}

export function newRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveRule(rule: PullRule): PullRule[] {
  const next = [rule, ...loadPullRules().filter((r) => r.id !== rule.id)];
  saveRules(next);
  void pushRule(rule);
  return next;
}

export function setRuleState(id: string, state: PullRuleState): PullRule[] {
  const rules = loadPullRules();
  const next = rules.map((r) => (r.id === id ? { ...r, state } : r));
  saveRules(next);
  const changed = next.find((r) => r.id === id);
  if (changed) void pushRule(changed);
  return next;
}

export function updateRule(id: string, patch: Partial<Pick<PullRule, "quantity" | "formatNote">>): PullRule[] {
  const next = loadPullRules().map((r) => (r.id === id ? { ...r, ...patch, quantity: patch.quantity !== undefined ? clampQuantity(patch.quantity) : r.quantity } : r));
  saveRules(next);
  const changed = next.find((r) => r.id === id);
  if (changed) void pushRule(changed);
  return next;
}

/* ── the comic catalog connector ─────────────────────────────────────── */

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** One series, exactly: the catalog's id when it gives one, otherwise name + year + publisher (never the name alone). */
export function comicSeriesKey(issue: Pick<UpcomingIssue, "series" | "seriesYearBegan" | "seriesId" | "publisher">): string {
  if (issue.seriesId) return `metron:series:${issue.seriesId}`;
  return `metron:series:${slug(issue.series)}|${issue.seriesYearBegan ?? ""}|${slug(issue.publisher ?? "")}`;
}

export function issueToRelease(issue: UpcomingIssue): CatalogRelease {
  const date = issue.storeDate && /^\d{4}-\d{2}-\d{2}$/.test(issue.storeDate) ? issue.storeDate : null;
  return {
    identity: `metron:issue:${issue.id}`,
    seriesKey: comicSeriesKey(issue),
    title: issue.number ? `${issue.series} #${issue.number}` : issue.series,
    number: issue.number,
    date,
    imageUrl: issue.imageUrl ?? undefined,
    variant: Boolean(issue.isVariant),
    edition: issue.isVariant ? (issue.variantDescription?.trim() || "Variant cover") : "Standard cover",
    url: `https://metron.cloud/issue/${issue.id}/`,
    publisher: issue.publisher,
    externalId: String(issue.id),
  };
}

export type SeriesCandidate = { key: string; name: string; publisher: string; yearBegan?: number; upcoming: number; imageUrl?: string; nextDate?: string };

/** Series with releases in the next 180 days that match the typed name; each is one exact series the person can pick. */
export async function searchComicSeries(query: string): Promise<{ candidates: SeriesCandidate[]; failed: boolean }> {
  const q = query.trim();
  if (q.length < 2) return { candidates: [], failed: false };
  const { data, failed } = await fetchUpcomingComicsChecked({ series: q, days: 180, pageSize: 100 });
  if (failed || !data) return { candidates: [], failed: true };
  const map = new Map<string, SeriesCandidate>();
  for (const issue of data.results) {
    const key = comicSeriesKey(issue);
    const c = map.get(key) ?? { key, name: issue.series, publisher: issue.publisher, yearBegan: issue.seriesYearBegan, upcoming: 0, imageUrl: issue.imageUrl ?? undefined, nextDate: undefined };
    c.upcoming += 1;
    if (issue.storeDate && (!c.nextDate || issue.storeDate < c.nextDate)) c.nextDate = issue.storeDate;
    map.set(key, c);
  }
  return { candidates: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)), failed: false };
}

export function describeNextDate(c: SeriesCandidate): string {
  return c.nextDate ? `next ${formatStoreDate(c.nextDate)}` : "no date yet";
}

/** Comics already in the Vault from the catalog (Own on Upcoming Comics, or Acquired from the Wishlist), as release identities: a refresh never adds those back as wants. */
function ownedComicIdentities(): Set<string> {
  const owned = new Set<string>();
  try {
    for (const item of loadItems()) {
      const m = item.catalogRef?.match(/^metron:(\d+)$/);
      if (m) owned.add(`metron:issue:${m[1]}`);
    }
  } catch { /* the Vault could not be read: fall back to the wishlist alone */ }
  return owned;
}

export type RefreshOutcome = { checked: number; added: number; updated: number; suggestions: CatalogRelease[]; failed: string[]; /** One-issue date lookups made by this check. */ lookups: number };

// Date corrections for releases already on the list (see trackedDateCandidates): a record of when each was last looked up and of how many lookups were made in the
// last six hours, kept on this device, so the catalog is never asked more than the bounds allow.
type LookupLog = { last: Record<string, number>; recent: number[] };
function lookupLogKey() {
  const pid = activeProfileId();
  return pid ? `vltd_want_date_lookups:${pid}` : "vltd_want_date_lookups";
}
function readLookupLog(): LookupLog {
  try {
    const parsed = JSON.parse(localStorage.getItem(lookupLogKey()) ?? "{}") as Partial<LookupLog>;
    return { last: parsed.last && typeof parsed.last === "object" ? parsed.last : {}, recent: Array.isArray(parsed.recent) ? parsed.recent.filter((n) => typeof n === "number") : [] };
  } catch { return { last: {}, recent: [] }; }
}
function writeLookupLog(log: LookupLog) {
  try { localStorage.setItem(lookupLogKey(), JSON.stringify(log)); } catch { /* storage unavailable: the bounds still hold for this run */ }
}

/**
 * Looks up, one release at a time, the date of wants that the discovery window did not report this check, and corrects their date (a hand-set date always wins; a dropped
 * or unlisted release keeps its last known date). At most DATE_LOOKUPS_PER_RUN per check and DATE_LOOKUPS_PER_WINDOW in any six hours; stops at the first failure.
 */
async function refreshTrackedDates(args: { covered: Set<string>; checkedRuleIds: Set<string>; force?: boolean; ruleId?: string; now: number }): Promise<{ lookups: number; updated: number }> {
  const log = readLookupLog();
  log.recent = log.recent.filter((t) => args.now - t < DATE_LOOKUP_INTERVAL_MS);
  const budget = Math.min(DATE_LOOKUPS_PER_RUN, DATE_LOOKUPS_PER_WINDOW - log.recent.length);
  let lookups = 0;
  let updated = 0;
  if (budget > 0) {
    const due = trackedDateCandidates(loadWishlist(), loadPullRules(), { covered: args.covered, checkedRuleIds: args.checkedRuleIds, lastLookup: log.last, now: args.now, force: args.force, ruleId: args.ruleId });
    for (const item of due.slice(0, budget)) {
      const id = catalogIssueIdOf(item);
      const identity = ruleIdentityOfItem(item);
      if (id === undefined || !identity) continue;
      lookups += 1;
      log.recent.push(args.now);
      const { issue, failed } = await fetchComicIssueChecked(id);
      if (failed) break; // the catalog could not be reached: nothing learned, try again at the next check
      log.last[identity] = args.now;
      const patch = planDateCorrection(item, issue ? { date: issueToRelease(issue).date } : null, Date.now());
      if (patch) { updateWishlistItem(item.id, { releaseDate: patch.releaseDate }); updated += 1; }
    }
  }
  writeLookupLog(log);
  return { lookups, updated };
}

/**
 * Checks every Following comic rule against the catalog and applies the plan (planRuleRefresh: exact series only, standard covers only,
 * no copies, edits kept, skipped stay skipped, changed dates update the existing selection). Re-running it changes nothing new.
 * `force` ignores the 6-hour pause between automatic checks.
 */
export async function refreshPullRules(opts: { force?: boolean; ruleId?: string; now?: number } = {}): Promise<RefreshOutcome> {
  const out: RefreshOutcome = { checked: 0, added: 0, updated: 0, suggestions: [], failed: [], lookups: 0 };
  const now = opts.now ?? Date.now();
  const covered = new Set<string>(); // releases the discovery window listed for a rule's own series this check: their dates are already corrected by the plan
  const checkedRuleIds = new Set<string>();
  let rules = loadPullRules().filter((r) => r.state === "following" && r.source === "metron" && r.sourceKey && (!opts.ruleId || r.id === opts.ruleId));
  if (!opts.force) rules = rules.filter((r) => !r.lastCheckedAt || now - r.lastCheckedAt >= REFRESH_EVERY_MS);
  for (const rule of rules) {
    const { data, failed } = await fetchUpcomingComicsChecked({ series: rule.name, days: 180, pageSize: 100 });
    out.checked += 1;
    if (failed || !data) {
      out.failed.push(rule.name);
      saveRule({ ...rule, lastResult: "Could not reach the comic catalog. Will try again." });
      continue;
    }
    const releases = data.results.map(issueToRelease);
    checkedRuleIds.add(rule.id);
    for (const r of releases) if (r.seriesKey === rule.sourceKey) covered.add(r.identity);
    // Read the wishlist again for every rule: the previous rule's additions are part of what "already there" means.
    const plan = planRuleRefresh(rule, releases, loadWishlist(), Date.now(), wantIdNamespace(), ownedComicIdentities());
    if (plan.add.length) saveWishlistItems(plan.add);
    for (const u of plan.update) updateWishlistItem(u.id, u.patch);
    out.added += plan.add.length;
    out.updated += plan.update.length;
    out.suggestions.push(...plan.suggestions);
    const summary = plan.matched === 0 ? "No releases found for this series in the next 180 days." : `${plan.matched} release${plan.matched === 1 ? "" : "s"} found: ${plan.add.length} added, ${plan.update.length} date change${plan.update.length === 1 ? "" : "s"}${plan.suggestions.length ? `, ${plan.suggestions.length} variant${plan.suggestions.length === 1 ? "" : "s"} to choose` : ""}.`;
    const current = loadPullRules().find((r) => r.id === rule.id);
    if (current) saveRule({ ...current, lastCheckedAt: Date.now(), lastResult: summary });
  }
  const dates = await refreshTrackedDates({ covered, checkedRuleIds, force: opts.force, ruleId: opts.ruleId, now });
  out.lookups = dates.lookups;
  out.updated += dates.updated;
  return out;
}
