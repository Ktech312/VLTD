import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { captureIdentity } from "@/lib/sessionGuard";
import { fetchUpcomingComicsChecked, formatStoreDate, type UpcomingIssue } from "@/lib/comicUpcoming";
import { loadWishlist, saveWishlistItems, updateWishlistItem, wantIdNamespace } from "@/lib/wishlistModel";
import { clampQuantity, planRuleRefresh, type CatalogRelease, type PullRule, type PullRuleKind, type PullRuleState } from "@/lib/wantsCore";

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
  try {
    const pid = activeProfileId();
    const supabase = getSupabaseBrowserClient();
    if (!pid || !supabase) return false;
    const { error } = await supabase.from("pull_rules").upsert(ruleRow(rule, pid), { onConflict: "id" });
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
    const rules = (data as Record<string, unknown>[]).map(rowToRule).sort((a, b) => b.createdAt - a.createdAt);
    saveRules(rules);
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

export type RefreshOutcome = { checked: number; added: number; updated: number; suggestions: CatalogRelease[]; failed: string[] };

/**
 * Checks every Following comic rule against the catalog and applies the plan (planRuleRefresh: exact series only, standard covers only,
 * no copies, edits kept, skipped stay skipped, changed dates update the existing selection). Re-running it changes nothing new.
 * `force` ignores the 6-hour pause between automatic checks.
 */
export async function refreshPullRules(opts: { force?: boolean; ruleId?: string } = {}): Promise<RefreshOutcome> {
  const out: RefreshOutcome = { checked: 0, added: 0, updated: 0, suggestions: [], failed: [] };
  const now = Date.now();
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
    // Read the wishlist again for every rule: the previous rule's additions are part of what "already there" means.
    const plan = planRuleRefresh(rule, releases, loadWishlist(), Date.now(), wantIdNamespace());
    if (plan.add.length) saveWishlistItems(plan.add);
    for (const u of plan.update) updateWishlistItem(u.id, u.patch);
    out.added += plan.add.length;
    out.updated += plan.update.length;
    out.suggestions.push(...plan.suggestions);
    const summary = plan.matched === 0 ? "No releases found for this series in the next 180 days." : `${plan.matched} release${plan.matched === 1 ? "" : "s"} found: ${plan.add.length} added, ${plan.update.length} date change${plan.update.length === 1 ? "" : "s"}${plan.suggestions.length ? `, ${plan.suggestions.length} variant${plan.suggestions.length === 1 ? "" : "s"} to choose` : ""}.`;
    const current = loadPullRules().find((r) => r.id === rule.id);
    if (current) saveRule({ ...current, lastCheckedAt: Date.now(), lastResult: summary });
  }
  return out;
}
