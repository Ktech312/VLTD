import type { WishlistItem, WishStatus } from "@/lib/wishlistModel";

// Pure rules for the Wishlist / Pull List / Following page (no storage, no network), so they can be tested on their own.
//   Wishlist  = what I want.   Pull List = wants with a release date or window, grouped by when.   Following = rules that add future releases.
// Unknown stays unknown: a missing date or price is never "today" or $0.

export const MAX_QUANTITY = 99;

export type PullRuleKind = "comic_series" | "card_product" | "toy_line";
export type PullRuleState = "following" | "paused" | "stopped";
export type RuleSource = "metron" | "manual";

export type PullRule = {
  id: string;
  kind: PullRuleKind;
  /** Series, product or line name as the person sees it. */
  name: string;
  publisher?: string;
  yearBegan?: number;
  source: RuleSource;
  /** Identity of the series in its catalog (the catalog's own id when it gives one, otherwise name + year + publisher). Manual rules have none. */
  sourceKey?: string;
  quantity: number;
  /** Auto-add standard covers only. Variants are only ever offered as suggestions; nothing expensive is added without a tap. */
  variantPolicy: "standard";
  /** Free text, e.g. "Cover A only". Shown on the rule and copied onto each selection. */
  formatNote?: string;
  state: PullRuleState;
  createdAt: number;
  lastCheckedAt?: number;
  lastResult?: string;
};

export type CatalogRelease = {
  /** Source identity of this exact release, e.g. "metron:issue:181794". */
  identity: string;
  seriesKey: string;
  title: string;
  number: string;
  /** YYYY-MM-DD or null when the catalog gives none. */
  date: string | null;
  imageUrl?: string;
  variant: boolean;
  edition: string;
  url?: string;
  publisher?: string;
  externalId: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function clampQuantity(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QUANTITY);
}

/** A price is only a price when it is a real, non-negative number; blank, text and NaN are "unknown" (undefined), never 0. */
export function parsePrice(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = String(raw).replace(/[$,\s]/g, "");
  if (text === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

export function normalizeStatus(value: unknown): WishStatus {
  return value === "preordered" || value === "acquired" || value === "skipped" ? value : "want";
}

export const STATUS_LABEL: Record<WishStatus, string> = { want: "Wanted", preordered: "Preordered", acquired: "Acquired", skipped: "Skipped" };

export function quantityOf(item: Pick<WishlistItem, "quantity">): number {
  return clampQuantity(item.quantity ?? 1);
}
export function acquiredOf(item: Pick<WishlistItem, "quantityAcquired" | "quantity">): number {
  const n = Math.floor(Number(item.quantityAcquired ?? 0));
  return Number.isFinite(n) && n > 0 ? Math.min(n, quantityOf(item)) : 0;
}
export function remainingOf(item: Pick<WishlistItem, "quantity" | "quantityAcquired" | "status">): number {
  if (item.status === "skipped" || item.status === "acquired") return 0;
  return Math.max(0, quantityOf(item) - acquiredOf(item));
}

/** Wants that are still open (not acquired, not skipped). */
export function isOpen(item: WishlistItem): boolean {
  return item.status !== "acquired" && item.status !== "skipped";
}

/** Planned total from known prices times the copies still to get, and how many open wants have no price (never counted as $0). */
export function plannedTotals(items: WishlistItem[]): { total: number; priced: number; unpriced: number } {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const item of items) {
    const left = remainingOf(item);
    if (left === 0) continue;
    if (typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0) {
      total += item.price * left;
      priced += 1;
    } else unpriced += 1;
  }
  return { total: Math.round(total * 100) / 100, priced, unpriced };
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
}

/** "Wed Nov 12", with the year when it is not this year. Printed from the stored calendar day, so it never shifts with time zones. */
export function formatDay(day: string, now: Date = new Date()): string {
  const d = new Date(`${day}T00:00:00Z`);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString("en-US", { weekday: sameYear ? "short" : undefined, month: "short", day: "numeric", year: sameYear ? undefined : "numeric", timeZone: "UTC" });
}

export function releaseLabel(item: Pick<WishlistItem, "releaseDate" | "releaseWindow">, now: Date = new Date()): string {
  if (item.releaseDate && isIsoDay(item.releaseDate)) return formatDay(item.releaseDate, now);
  if (item.releaseWindow && item.releaseWindow.trim()) return `Window: ${item.releaseWindow.trim()}`;
  return "Date unknown";
}

export function hasRelease(item: Pick<WishlistItem, "releaseDate" | "releaseWindow">): boolean {
  return Boolean((item.releaseDate && isIsoDay(item.releaseDate)) || (item.releaseWindow && item.releaseWindow.trim()));
}

export type PullGroup = { key: string; label: string; items: WishlistItem[]; total: number };

/** Pull List: open wants that have a date or a window, grouped (Earlier, then each month, then windows). Wants with neither stay on the Wishlist only. */
export function groupPullList(items: WishlistItem[], now: Date = new Date()): PullGroup[] {
  const today = now.toISOString().slice(0, 10);
  const groups = new Map<string, PullGroup>();
  const order = new Map<string, string>();
  const add = (key: string, label: string, sort: string, item: WishlistItem) => {
    let g = groups.get(key);
    if (!g) { g = { key, label, items: [], total: 0 }; groups.set(key, g); order.set(key, sort); }
    g.items.push(item);
  };
  for (const item of items) {
    if (!isOpen(item) || !hasRelease(item)) continue;
    if (item.releaseDate && isIsoDay(item.releaseDate)) {
      if (item.releaseDate < today) add("earlier", "Release date has passed", "0", item);
      else {
        const d = new Date(`${item.releaseDate}T00:00:00Z`);
        const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        add(`m:${item.releaseDate.slice(0, 7)}`, label, `1:${item.releaseDate.slice(0, 7)}`, item);
      }
    } else {
      const w = (item.releaseWindow ?? "").trim();
      add(`w:${w.toLowerCase()}`, `${w} (window)`, `2:${w.toLowerCase()}`, item);
    }
  }
  const out = [...groups.values()].sort((a, b) => String(order.get(a.key)).localeCompare(String(order.get(b.key))));
  for (const g of out) {
    g.items.sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || a.title.localeCompare(b.title));
    g.total = plannedTotals(g.items).total;
  }
  return out;
}

/* ── status changes ─────────────────────────────────────────────── */

export function canMarkPreordered(item: WishlistItem): boolean {
  return item.status === "want" || item.status === undefined;
}

export function withStatus(item: WishlistItem, status: WishStatus, now: number = Date.now()): WishlistItem {
  const next: WishlistItem = { ...item, status, updatedAt: now };
  if (status === "skipped") next.skippedAt = now;
  else delete next.skippedAt;
  return next;
}

/**
 * Records `count` copies as received AFTER their Vault records were saved. Partial quantities keep the want open ("1 of 2");
 * the want becomes Acquired only when every copy is in. Ids already recorded are never added twice.
 */
export function withAcquired(item: WishlistItem, newItemIds: string[], now: number = Date.now()): WishlistItem {
  const known = new Set(item.acquiredItemIds ?? []);
  const fresh = newItemIds.filter((id) => !known.has(id));
  if (fresh.length === 0) return item;
  const ids = [...(item.acquiredItemIds ?? []), ...fresh];
  const have = Math.min(quantityOf(item), ids.length);
  return { ...item, acquiredItemIds: ids, quantityAcquired: have, status: have >= quantityOf(item) ? "acquired" : item.status === "preordered" ? "preordered" : "want", updatedAt: now };
}

/** Fields the person changed by hand; a refresh from a catalog never overwrites these. */
export function markEdited(item: WishlistItem, fields: string[]): WishlistItem {
  const edited = new Set(item.edited ?? []);
  for (const f of fields) edited.add(f);
  return { ...item, edited: [...edited], updatedAt: Date.now() };
}

/* ── following: matching catalog releases to a rule ────────────────────── */

export function ruleIdentityOfItem(item: WishlistItem): string | undefined {
  if (item.sourceIdentity) return item.sourceIdentity;
  if (item.source && item.source !== "manual" && item.externalId) return `${item.source}:issue:${item.externalId}`;
  return undefined;
}

/**
 * A short, stable piece of a profile id, put inside ids that are worked out from what the want is (a catalog release, a watched item). Want ids (and the Vault ids made from them)
 * are one list for every account in the database, so two people following the same series would otherwise be asking for the same id and the second one's want could never be saved.
 */
export function idNamespaceOf(profileId: string | null | undefined): string {
  return String(profileId ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 10);
}

export function wantIdForIdentity(identity: string, namespace = ""): string {
  return `pull_${namespace ? `${namespace}_` : ""}${identity.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80)}`;
}

/** A want built from one catalog release. Same release for the same profile = same id, so adding it twice is one row. */
export function wantFromRelease(release: CatalogRelease, opts: { quantity: number; seriesName?: string; ruleId?: string; formatNote?: string; now?: number; source?: string; idNamespace?: string }): WishlistItem {
  const now = opts.now ?? Date.now();
  const date = release.date && isIsoDay(release.date) ? release.date : undefined;
  return {
    id: wantIdForIdentity(release.identity, opts.idNamespace),
    title: release.title,
    createdAt: now,
    updatedAt: now,
    universe: "POP_CULTURE",
    category: "Comics",
    series: opts.seriesName,
    edition: release.edition,
    quantity: clampQuantity(opts.quantity),
    quantityAcquired: 0,
    imageUrl: release.imageUrl,
    source: opts.source ?? "metron",
    externalId: release.externalId,
    sourceIdentity: release.identity,
    sourceUrl: release.url,
    releaseDate: date,
    ruleId: opts.ruleId,
    status: "want",
    priority: "medium",
    notes: opts.formatNote ? `Rule: ${opts.formatNote}` : undefined,
  };
}

/** A want made from something the person was watching (someone else's public item). The watched record stays; nothing about it becomes an owned record, and its value is NOT copied as a price. */
export function wantFromWatching(w: { id: string; title: string; subtitle?: string; imageFrontUrl?: string; profileId?: string; collectorName?: string }, now: number = Date.now(), idNamespace = ""): WishlistItem {
  return {
    id: `want_watch_${idNamespace ? `${idNamespace}_` : ""}${w.id}`.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 100),
    title: w.title || "Watched item",
    createdAt: now,
    updatedAt: now,
    imageUrl: w.imageFrontUrl || undefined,
    source: "watching",
    sourceIdentity: `watch:${w.id}`,
    sourceUrl: w.profileId ? `/v/${encodeURIComponent(w.profileId)}` : undefined,
    quantity: 1,
    quantityAcquired: 0,
    status: "want",
    priority: "medium",
    notes: w.collectorName ? `Saved from ${w.collectorName}'s public exhibition.` : undefined,
  };
}

export type RuleRefreshPlan = {
  add: WishlistItem[];
  update: Array<{ id: string; patch: Partial<WishlistItem> }>;
  /** Variants offered to the person; never added on their own. */
  suggestions: CatalogRelease[];
  matched: number;
};

/** The want already on the list for this exact release, however it got there (a Following rule, a tap on Upcoming Comics, an older catalog pick). */
export function findWantForIdentity(items: WishlistItem[], identity: string): WishlistItem | undefined {
  return items.find((item) => ruleIdentityOfItem(item) === identity);
}

/** The want to save when the person adds a suggested release from a Following card, or null when that release is already on the list (so Add never makes a second one). */
export function addableSuggestion(items: WishlistItem[], release: CatalogRelease, rule: Pick<PullRule, "id" | "name" | "quantity" | "formatNote">, idNamespace = "", now: number = Date.now()): WishlistItem | null {
  if (findWantForIdentity(items, release.identity)) return null;
  return wantFromRelease(release, { quantity: rule.quantity, seriesName: rule.name, ruleId: rule.id, formatNote: rule.formatNote, idNamespace, now });
}

export function planRuleRefresh(rule: PullRule, releases: CatalogRelease[], existing: WishlistItem[], now: number = Date.now(), idNamespace = "", ownedIdentities?: ReadonlySet<string>): RuleRefreshPlan {
  const plan: RuleRefreshPlan = { add: [], update: [], suggestions: [], matched: 0 };
  if (rule.state !== "following" || rule.source === "manual" || !rule.sourceKey) return plan;
  const byIdentity = new Map<string, WishlistItem>();
  for (const item of existing) {
    const id = ruleIdentityOfItem(item);
    if (id) byIdentity.set(id, item);
  }
  const seen = new Set<string>();
  for (const release of releases) {
    // Exactly this series: an issue whose series key differs is a different book, however similar the name.
    if (release.seriesKey !== rule.sourceKey) continue;
    if (seen.has(release.identity)) continue;
    seen.add(release.identity);
    plan.matched += 1;
    const have = byIdentity.get(release.identity);
    const date = release.date && isIsoDay(release.date) ? release.date : undefined;
    if (have) {
      // Already a selection (any status, including Skipped): never add a copy, never undo the person's edits, never bring a skipped release back.
      // A changed release date updates the existing selection unless the person set the date themselves.
      if (date && have.releaseDate !== date && !(have.edited ?? []).includes("releaseDate")) plan.update.push({ id: have.id, patch: { releaseDate: date, updatedAt: now } });
      continue;
    }
    // Already in the Vault (bought with Own on Upcoming Comics, which takes the want off the list): never put it back as a want.
    if (ownedIdentities?.has(release.identity)) continue;
    if (release.variant) {
      plan.suggestions.push(release);
      continue;
    }
    plan.add.push(wantFromRelease(release, { quantity: rule.quantity, seriesName: rule.name, ruleId: rule.id, formatNote: rule.formatNote, now, source: rule.source, idNamespace }));
  }
  return plan;
}

/* ── checklist ────────────────────────────────────────────────────── */

export type ChecklistOptions = { includePrices?: boolean; includeNotes?: boolean; includeShops?: boolean; includeDates?: boolean };

export function checklistLines(items: WishlistItem[], opts: ChecklistOptions = {}, now: Date = new Date()): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (!isOpen(item)) continue;
    const bits = [item.edition?.trim() || undefined, `x${remainingOf(item)}`];
    if (opts.includeDates !== false) bits.push(releaseLabel(item, now));
    if (opts.includeShops && item.shop?.trim()) bits.push(item.shop.trim());
    if (opts.includePrices && typeof item.price === "number") bits.push(formatMoney(item.price));
    lines.push(`[ ] ${item.title}${bits.length ? ` (${bits.join(", ")})` : ""}${opts.includeNotes && item.notes?.trim() ? ` - ${item.notes.trim()}` : ""}`);
  }
  return lines;
}

export function checklistText(items: WishlistItem[], opts: ChecklistOptions = {}, now: Date = new Date()): string {
  const open = items.filter(isOpen);
  const lines = checklistLines(items, opts, now);
  const header = `VLTD checklist, ${now.toISOString().slice(0, 10)}: ${open.length} ${open.length === 1 ? "item" : "items"}`;
  const t = plannedTotals(items);
  const footer = opts.includePrices ? `\nPlanned total ${formatMoney(t.total)} from ${t.priced} priced${t.unpriced ? `; ${t.unpriced} without a price not counted` : ""}` : "";
  return `${header}\n${lines.join("\n")}${footer}\n`;
}

/** What a public share link may show. Everything private is off unless the owner switched it on. */
export type ShareFields = { titles: true; quantities: boolean; dates: boolean; prices: boolean; notes: boolean; shops: boolean };
export const DEFAULT_SHARE_FIELDS: ShareFields = { titles: true, quantities: false, dates: false, prices: false, notes: false, shops: false };

export function normalizeShareFields(raw: unknown): ShareFields {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { titles: true, quantities: r.quantities === true, dates: r.dates === true, prices: r.prices === true, notes: r.notes === true, shops: r.shops === true };
}
