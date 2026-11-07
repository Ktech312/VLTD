"use client";

import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";

import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { PillSelect } from "@/components/ui/PillSelect";
import { isSupplyItem } from "@/lib/vaultStats";
import { REVIEW_GAP_SHORT, reviewGaps, type ReviewGap } from "@/lib/vaultReview";
import { loadActivityEvents, syncActivityEventsFromSupabase, type ActivityEventRecord } from "@/lib/activityEvents";
import { listRecentCommentsForExhibitions, type Comment } from "@/lib/comments";
import { listExhibitionEventsForGalleries, type ExhibitionEvent } from "@/lib/exhibitionEvents";
import { loadGalleries } from "@/lib/galleryModel";
import { loadSaleHistory } from "@/lib/historyModel";
import { fetchPublicProfile } from "@/lib/publicProfile";
import { loadSales, type SaleRecord as LegacySaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, resetCloudBackoff, syncVaultItemsFromSupabaseChecked, type VaultItem } from "@/lib/vaultModel";
import { CLOUD_WAIT_MS, LoadErrorCard, StaleDataNotice } from "@/components/vault/CloudStatus";
import { itemImageOrPlaceholder } from "@/lib/itemPlaceholder";
import type { SaleRecord } from "@/types/vaultLifecycle";

type ActivityKind = "added" | "sold" | "valued" | "comment" | "exhibition" | "insurance" | "share";

type RecentComment = Comment & {
  exhibitionTitle: string;
  authorName: string;
};

type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  detail: string;
  timestamp: number;
  href?: string;
  actionLabel?: string;
  item?: VaultItem;
  imageUrl?: string;
  previousValue?: number;
  newValue?: number;
  source?: string;
  confidence?: "Low" | "Medium" | "High";
  comps?: number;
  meta?: string;
};

const FILTERS: Array<{ key: ActivityKind | "all"; label: string; icon: GlyphName }> = [
  { key: "all", label: "All", icon: "box" },
  { key: "added", label: "Items added", icon: "eye" },
  { key: "valued", label: "Value Changes", icon: "chart" },
  { key: "exhibition", label: "Exhibitions", icon: "building" },
  { key: "sold", label: "Sales", icon: "tag" },
  { key: "share", label: "Shares", icon: "share" },
];

// Basic completeness: the Vault's own four-point checklist (photo, valuation, purchase price, identifying detail), so the number here
// always agrees with the Vault's "needs review" list. It is not "every column filled in".
type BasicInfo = { done: number; total: number; missing: ReviewGap[] };
const BASIC_TOTAL = 4;

function basicInfoFor(item?: VaultItem): BasicInfo | null {
  if (!item || isSupplyItem(item)) return null;
  const missing = reviewGaps(item);
  return { done: BASIC_TOTAL - missing.length, total: BASIC_TOTAL, missing };
}

type BasicFilter = "all" | "needs_work" | "complete";
type DateRange = "any" | "today" | "7d" | "30d" | "90d" | "year" | "custom";

const DATE_OPTIONS: Array<{ value: DateRange; label: string }> = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Pick dates" },
];

function dateRangeBounds(range: DateRange, from: string, to: string): { from: number | null; to: number | null } {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n).getTime();
  if (range === "today") return { from: daysAgo(0), to: null };
  if (range === "7d") return { from: daysAgo(6), to: null };
  if (range === "30d") return { from: daysAgo(29), to: null };
  if (range === "90d") return { from: daysAgo(89), to: null };
  if (range === "year") return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: null };
  if (range === "custom") {
    const f = from ? new Date(`${from}T00:00:00`).getTime() : NaN;
    const t = to ? new Date(`${to}T23:59:59.999`).getTime() : NaN;
    return { from: Number.isFinite(f) ? f : null, to: Number.isFinite(t) ? t : null };
  }
  return { from: null, to: null };
}

// One rule for "is this entry in the list", used by the list AND by every pill's number, so a pill's count is always what tapping it shows.
function entryPasses(
  event: { kind: ActivityKind; timestamp: number },
  kind: ActivityKind | "all",
  basicFilter: BasicFilter,
  bounds: { from: number | null; to: number | null },
  basic: BasicInfo | null | undefined
) {
  if (kind !== "all" && event.kind !== kind) return false;
  if (bounds.from !== null && event.timestamp < bounds.from) return false;
  if (bounds.to !== null && event.timestamp > bounds.to) return false;
  if (basicFilter !== "all") {
    if (!basic) return false;
    if (basicFilter === "needs_work" ? basic.missing.length === 0 : basic.missing.length > 0) return false;
  }
  return true;
}

function BasicInfoBadge({ info }: { info: BasicInfo }) {
  const complete = info.missing.length === 0;
  const color = complete ? "#58D783" : info.done >= 3 ? "#F2C14E" : "#F2784B";
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>
        <span aria-hidden="true" className="inline-flex gap-0.5">
          {Array.from({ length: info.total }).map((_, i) => (
            <span key={i} className="h-2 w-4 rounded-[2px]" style={{ background: i < info.done ? color : "rgba(203,208,213,0.22)" }} />
          ))}
        </span>
        Basic info {info.done} of {info.total}
      </div>
      {complete ? null : (
        <div className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
          Needs: {info.missing.map((gap) => REVIEW_GAP_SHORT[gap].toLowerCase()).join(", ")}
        </div>
      )}
    </div>
  );
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatClock(timestamp: number) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatFullDate(timestamp: number) {
  if (!timestamp) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function dayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? 0);
}

function itemMeta(item: VaultItem) {
  return [item.universe, item.categoryLabel || item.category, item.grade].filter(Boolean).join(" - ");
}

// Real photo if the item has one, else a Universe-matched placeholder — no
// keyword-guessed stock art that pretends to be the item.
function itemImage(item?: VaultItem) {
  return itemImageOrPlaceholder(item);
}

function saleKey(sale: SaleRecord | LegacySaleRecord) {
  return [sale.id, sale.itemId, sale.soldAt, sale.title, sale.salePrice].join(":");
}

// Honest label per real origin — never assumes "scanned" for items that
// were typed in by hand, imported, or moved over from a wishlist.
// undefined means the item predates this tracking; say so plainly rather
// than guessing.
function addedSubtitle(item: VaultItem): string {
  switch (item.addedVia) {
    case "scan":
      return "Item scanned";
    case "manual":
      return "Added manually";
    case "import":
      return "Imported";
    case "wishlist":
      return "Moved from wishlist";
    default:
      return "Added to inventory";
  }
}

function buildItemEvents(items: VaultItem[]): ActivityEvent[] {
  return items
    .filter((item) => itemTimestamp(item) > 0)
    .map((item) => ({
      id: `added-${item.id}`,
      kind: "added",
      title: item.title || "Untitled item",
      subtitle: addedSubtitle(item),
      detail: "Added to inventory",
      timestamp: itemTimestamp(item),
      href: `/vault/item/${item.id}`,
      actionLabel: "View item record",
      item,
      imageUrl: itemImage(item),
      meta: itemMeta(item),
    }));
}

function buildSaleEvents(sales: Array<SaleRecord | LegacySaleRecord>, itemById: Map<string, VaultItem>) {
  const seen = new Set<string>();
  return sales
    .filter((sale) => {
      const key = saleKey(sale);
      if (seen.has(key)) return false;
      seen.add(key);
      return Number(sale.soldAt ?? 0) > 0;
    })
    .map((sale) => {
      const item = itemById.get(sale.itemId);
      const salePrice = Number(sale.salePrice ?? 0);
      const purchasePrice = Number(sale.purchasePrice ?? item?.purchasePrice ?? 0);
      const profit = salePrice - purchasePrice;
      return {
        id: `sold-${sale.id}`,
        kind: "sold",
        title: sale.title || item?.title || "Sold item",
        subtitle: "Listing sold",
        detail: `Sold for ${formatMoney(salePrice)}`,
        timestamp: Number(sale.soldAt ?? 0),
        href: sale.itemId ? `/vault/item/${sale.itemId}` : "/sales",
        actionLabel: "View sale",
        item,
        imageUrl: itemImage(item),
        previousValue: purchasePrice,
        newValue: salePrice,
        source: "Sales ledger",
        meta: `${profit >= 0 ? "+" : ""}${formatMoney(profit)} net`,
      } satisfies ActivityEvent;
    });
}

function buildGalleryEvents(events: Array<ExhibitionEvent & { galleryTitle: string }>): ActivityEvent[] {
  return events.map((event) => ({
    id: `exhibition-${event.id}`,
    kind: event.type === "announced" ? "share" : "exhibition",
    title: event.galleryTitle,
    subtitle: event.type === "published" ? "Exhibition published" : "Exhibition announced",
    detail: event.type === "published" ? "Public exhibition updated" : "Announcement sent",
    timestamp: event.createdAt,
    href: `/museum/${event.galleryId}`,
    actionLabel: event.type === "published" ? "View exhibition" : "Open exhibition",
    source: "Exhibition",
  }) satisfies ActivityEvent);
}

function buildCommentEvents(comments: RecentComment[]): ActivityEvent[] {
  return comments.map((comment) => ({
    id: `comment-${comment.id}`,
    kind: "comment",
    title: comment.exhibitionTitle,
    subtitle: "Comment received",
    detail: `${comment.authorName}: ${comment.body}`,
    timestamp: comment.createdAt,
    href: `/museum/${comment.exhibitionId}/guest?comment=${comment.id}`,
    actionLabel: "View comment",
    source: "Public exhibition",
  }) satisfies ActivityEvent);
}

function buildLoggedEvents(events: ActivityEventRecord[], itemById: Map<string, VaultItem>): ActivityEvent[] {
  return events.map((event) => {
    const item = event.itemId ? itemById.get(event.itemId) : undefined;
    return {
      id: event.id,
      kind: event.kind,
      title: event.title,
      subtitle: event.subtitle ?? event.kind,
      detail: event.detail ?? "",
      timestamp: event.timestamp,
      href: event.href ?? (event.itemId ? `/vault/item/${event.itemId}` : event.galleryId ? `/museum/${event.galleryId}` : undefined),
      actionLabel: event.actionLabel,
      item,
      imageUrl: event.imageUrl ?? itemImage(item),
      previousValue: event.previousValue,
      newValue: event.newValue,
      source: event.source,
      confidence: event.confidence,
      comps: event.comps,
      meta: event.meta,
    };
  });
}

function iconForKind(kind: ActivityKind): GlyphName {
  if (kind === "added") return "eye";
  if (kind === "valued") return "chart";
  if (kind === "sold") return "tag";
  if (kind === "comment") return "message";
  if (kind === "exhibition") return "building";
  if (kind === "insurance") return "shield";
  return "share";
}

function colorForKind(kind: ActivityKind) {
  if (kind === "added") return "#58D783";
  if (kind === "comment" || kind === "exhibition") return "#C252F4";
  if (kind === "share") return "#52D6F4";
  return "var(--theme-gold,#C8CDD2)";
}

function deltaPct(event: ActivityEvent) {
  const previous = Number(event.previousValue ?? 0);
  const next = Number(event.newValue ?? 0);
  if (!previous || !next) return null;
  return ((next - previous) / previous) * 100;
}

function ActivityThumb({ event, large = false }: { event: ActivityEvent; large?: boolean }) {
  const size = large ? "h-[164px] w-[128px]" : "h-[76px] w-[64px]";
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[rgba(203,208,213,0.28)] bg-black/30`}>
      {event.imageUrl ? (
        <img src={event.imageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <Glyph name="box" size={large ? 42 : 24} style={{ color: "var(--theme-text-muted,#61656B)" }} />
      )}
    </div>
  );
}

function ActivityRow({ event, selected, onSelect, basic }: { event: ActivityEvent; selected: boolean; onSelect: () => void; basic: BasicInfo | null }) {
  const change = deltaPct(event);
  const showValue = event.kind === "valued" || event.kind === "sold";
  const showEvidence = Boolean(event.source || event.confidence || event.comps);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[6px] border p-3 text-left transition hover:-translate-y-0.5 md:grid-cols-[78px_50px_70px_minmax(0,1fr)_minmax(150px,220px)_150px] md:gap-4 md:p-4"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.88))",
        borderColor: selected ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.22)",
        boxShadow: selected ? "0 0 0 1px rgba(203,208,213,0.2), 0 18px 38px rgba(0,0,0,0.28)" : "none",
      }}
    >
      <div className="relative hidden text-sm md:block after:content-[''] after:pointer-events-none after:absolute after:top-1/2 after:right-[-10px] after:h-11 after:w-px after:-translate-y-1/2 after:bg-[color:var(--border-strong)]" style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatClock(event.timestamp)}</div>
      <div className="hidden h-11 w-11 place-items-center justify-self-center rounded-full border md:grid" style={{ borderColor: colorForKind(event.kind), color: colorForKind(event.kind), background: "rgba(0,0,0,0.24)" }}>
        <Glyph name={iconForKind(event.kind)} size={19} />
      </div>
      <ActivityThumb event={event} />
      <div className="min-w-0">
        <div className="text-lg font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{event.subtitle}</div>
        <div className="truncate text-base" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{event.title}</div>
        <div className="mt-1 truncate text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{event.detail}</div>
      </div>
      <div className="relative col-span-2 min-w-0 md:col-span-1 md:pl-5 max-md:before:hidden before:content-[''] before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-11 before:w-px before:-translate-y-1/2 before:bg-[color:var(--border-strong)]">
        {showValue && event.newValue ? (
          <div className="text-[22px] font-black text-[color:var(--info,#52D6F4)]">
            {event.previousValue ? `${formatMoney(event.previousValue)} -> ` : ""}
            {formatMoney(event.newValue)}
          </div>
        ) : (
          <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{event.meta ?? "Recorded"}</div>
        )}
        {change !== null && (
          <div className={change >= 0 ? "text-green-400" : "text-red-400"}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="relative col-span-2 text-sm md:col-span-1 md:pl-5 md:text-right max-md:before:hidden before:content-[''] before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-11 before:w-px before:-translate-y-1/2 before:bg-[color:var(--border-strong)]" style={{ color: "var(--theme-text-muted,#61656B)" }}>
        {showEvidence ? (
          <>
            {event.confidence && <div>{event.confidence} confidence</div>}
            {event.source && <div>{event.source}{event.comps ? ` - ${event.comps} comps` : ""}</div>}
          </>
        ) : basic ? null : (
          <div>{event.meta || event.subtitle}</div>
        )}
        {basic ? <div className={showEvidence ? "mt-2 md:flex md:justify-end" : "md:flex md:justify-end"}><BasicInfoBadge info={basic} /></div> : null}
        <div className="mt-2" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{formatClock(event.timestamp)}</div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[8px] border border-[rgba(203,208,213,0.22)] p-10 text-center" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
      <Glyph name="chart" size={44} style={{ color: "var(--theme-gold,#C8CDD2)", marginInline: "auto" }} />
      <h2 className="mt-4 text-xl font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>No activity yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>
        Add items, update prices, publish exhibitions, or log a sale and this page will become your vault timeline.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link href="/vault/add" className="rounded-[6px] px-5 py-2 text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Add item</Link>
        <Link href="/vault" className="rounded-[6px] border border-[rgba(203,208,213,0.26)] px-5 py-2 text-sm font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Open vault</Link>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [sales, setSales] = useState<Array<SaleRecord | LegacySaleRecord>>([]);
  const [loggedEvents, setLoggedEvents] = useState<ActivityEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // True when the cloud did not answer (or answered too late): what is on screen is then the saved copy, and an empty list is not "no activity".
  const [cloudFailed, setCloudFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [exhibitionEvents, setExhibitionEvents] = useState<Array<ExhibitionEvent & { galleryTitle: string }>>([]);
  const router = useRouter();
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const [basicFilter, setBasicFilter] = useState<BasicFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("any");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Close really closes the details panel (the first activity used to take its place).
  const [panelClosed, setPanelClosed] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadActivity() {
      // Render the saved timeline immediately. A large vault can take many
      // seconds to refresh from the cloud; keeping the whole page behind its
      // loader made a healthy, populated account look frozen during that pull.
      const localItems = loadItems();
      const localSales = [...loadSaleHistory(), ...loadSales()];
      const localLoggedEvents = loadActivityEvents();
      if (isActive) {
        setItems(localItems);
        setSales(localSales);
        setLoggedEvents(localLoggedEvents);
        if (localItems.length > 0 || localSales.length > 0 || localLoggedEvents.length > 0) {
          setIsLoading(false);
        }
      }

      // These three sources are independent, so refresh them together rather
      // than serially adding every network delay before anything can render.
      const settled = Promise.allSettled([
        syncVaultItemsFromSupabaseChecked(),
        syncSalesFromSupabase(),
        syncActivityEventsFromSupabase(),
      ]);
      const finish = (results: Awaited<typeof settled> | null) => {
        if (!isActive) return;
        const [itemsResult, , activityResult] = results ?? [];
        const answered = results !== null && itemsResult?.status === "fulfilled" && itemsResult.value.ok && activityResult?.status === "fulfilled";
        setCloudFailed(!answered);
        setLoggedEvents(
          activityResult && activityResult.status === "fulfilled" ? activityResult.value : loadActivityEvents()
        );
        setItems(loadItems());
        setSales([...loadSaleHistory(), ...loadSales()]);
        setIsLoading(false);
        setRetrying(false);
      };
      // A request that never answers must not leave "Loading activity..." on screen for ever.
      const timer = window.setTimeout(() => finish(null), CLOUD_WAIT_MS);
      const results = await settled;
      window.clearTimeout(timer);
      finish(results);
    }

    void loadActivity();

    return () => {
      isActive = false;
    };
  }, [attempt]);

  const retryLoad = () => {
    resetCloudBackoff();
    setRetrying(true);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const myGalleries = loadGalleries();
      if (myGalleries.length === 0) return;

      const galleryIds = myGalleries.map((gallery) => gallery.id);
      const titleById = new Map(myGalleries.map((gallery) => [gallery.id, gallery.title || "Exhibition"]));

      const [comments, events] = await Promise.all([
        listRecentCommentsForExhibitions(galleryIds),
        listExhibitionEventsForGalleries(galleryIds),
      ]);
      if (cancelled) return;

      if (comments.length > 0) {
        const uniqueAuthorIds = [...new Set(comments.map((comment) => comment.authorId))];
        const profiles = await Promise.all(uniqueAuthorIds.map((id) => fetchPublicProfile(id)));
        if (cancelled) return;
        const nameById = new Map(uniqueAuthorIds.map((id, index) => [id, profiles[index]?.displayName ?? "Collector"]));
        setRecentComments(
          comments.map((comment) => ({
            ...comment,
            exhibitionTitle: titleById.get(comment.exhibitionId) ?? "Exhibition",
            authorName: nameById.get(comment.authorId) ?? "Collector",
          }))
        );
      }

      setExhibitionEvents(events.map((event) => ({ ...event, galleryTitle: titleById.get(event.galleryId) ?? "Exhibition" })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const allEvents = useMemo<ActivityEvent[]>(() => {
    return [
      ...buildLoggedEvents(loggedEvents, itemById),
      ...buildItemEvents(items),
      ...buildSaleEvents(sales, itemById),
      ...buildGalleryEvents(exhibitionEvents),
      ...buildCommentEvents(recentComments),
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [exhibitionEvents, itemById, items, loggedEvents, recentComments, sales]);

  // Basic completeness per event (items only; a sale is not about the item's record). Computed once, not per render.
  const basicByEvent = useMemo(() => {
    const map = new Map<string, BasicInfo | null>();
    for (const event of allEvents) map.set(event.id, event.kind === "sold" ? null : basicInfoFor(event.item));
    return map;
  }, [allEvents]);

  const dateBounds = useMemo(() => dateRangeBounds(dateRange, customFrom, customTo), [dateRange, customFrom, customTo]);
  const filteredEvents = useMemo(
    () => allEvents.filter((event) => entryPasses(event, filter, basicFilter, dateBounds, basicByEvent.get(event.id))),
    [allEvents, basicByEvent, basicFilter, dateBounds, filter]
  );
  // Each pill's number is how many entries tapping it would list, with the other filters that are on (so the number never disagrees with the list).
  const pillCounts = useMemo(() => {
    let added = 0, needsWork = 0, complete = 0;
    for (const event of allEvents) {
      const basic = basicByEvent.get(event.id);
      if (entryPasses(event, "added", basicFilter, dateBounds, basic)) added += 1;
      if (entryPasses(event, filter, "needs_work", dateBounds, basic)) needsWork += 1;
      if (entryPasses(event, filter, "complete", dateBounds, basic)) complete += 1;
    }
    return { added, needsWork, complete };
  }, [allEvents, basicByEvent, basicFilter, dateBounds, filter]);
  const anyFilterOn = filter !== "all" || basicFilter !== "all" || dateRange !== "any";
  const clearFilters = () => { setFilter("all"); setBasicFilter("all"); setDateRange("any"); setCustomFrom(""); setCustomTo(""); setVisibleCount(20); };

  // Below 1280px the details panel sits under the whole list, out of sight, so a tap opens the item itself. On a wide screen a tap selects it for the side panel.
  const openOrSelect = (event: ActivityEvent) => {
    if (event.href && typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      router.push(event.href);
      return;
    }
    setSelectedId(event.id);
    setPanelClosed(false);
  };

  const selected = panelClosed ? null : filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? allEvents[0] ?? null;
  // "Items added" is always offered (with its count, even 0) so its empty state can explain itself; the other kinds appear once they have an entry.
  const availableFilters = FILTERS.filter((tab) => tab.key === "all" || tab.key === "added" || allEvents.some((event) => event.kind === tab.key));
  const showSelectedValue = Boolean(selected && (selected.kind === "valued" || selected.kind === "sold") && selected.newValue);
  const showSelectedEvidence = Boolean(selected && (selected.source || selected.confidence || selected.comps));
  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const grouped = visibleEvents.reduce<Array<{ label: string; events: ActivityEvent[] }>>((groups, event) => {
    const label = dayLabel(event.timestamp);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.events.push(event);
    else groups.push({ label, events: [event] });
    return groups;
  }, []);

  return (
    <>
      <PageHeader
        title="Activity"
        description={<span style={{ color: "var(--theme-text-muted,#61656B)" }}>Everything that changed in your vault.</span>}
        contentClassName="max-w-[1420px]"
        actions={
          <>
            {availableFilters.map((tab) => (
              <PillButton
                key={tab.key}
                variant={filter === tab.key ? "active" : "default"}
                onClick={() => {
                  setFilter(tab.key);
                  setVisibleCount(20);
                }}
              >
                <Glyph name={tab.icon} size={16} />
                {tab.label}
                {tab.key === "added" ? ` (${pillCounts.added.toLocaleString()})` : ""}
              </PillButton>
            ))}
            <PillSelect
              align="left"
              ariaLabel="Filter by date"
              value={dateRange}
              options={DATE_OPTIONS}
              onChange={(next) => { setDateRange(next); setVisibleCount(20); }}
            />
            <PillButton
              variant={basicFilter === "needs_work" ? "active" : "default"}
              onClick={() => { setBasicFilter((current) => (current === "needs_work" ? "all" : "needs_work")); setVisibleCount(20); }}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: "#F2784B" }} />
              Needs work ({pillCounts.needsWork.toLocaleString()})
            </PillButton>
            <PillButton
              variant={basicFilter === "complete" ? "active" : "default"}
              onClick={() => { setBasicFilter((current) => (current === "complete" ? "all" : "complete")); setVisibleCount(20); }}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: "#58D783" }} />
              Complete ({pillCounts.complete.toLocaleString()})
            </PillButton>
          </>
        }
      />
      <main className="min-h-screen px-4 pb-7 text-[color:var(--theme-text-primary,#ECEDEF)] sm:px-6 lg:px-8" style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid max-w-[1420px] gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="min-w-0">
          {dateRange === "custom" ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm" style={{ color: "var(--muted)" }}>
              {([["From", customFrom, setCustomFrom], ["To", customTo, setCustomTo]] as const).map(([label, value, set]) => (
                <label key={label} className="inline-flex items-center gap-2">
                  {label}
                  <input
                    type="date"
                    value={value}
                    onChange={(event) => { set(event.target.value); setVisibleCount(20); }}
                    className="min-h-11 rounded-[6px] border px-3 text-[13px] md:min-h-9"
                    style={{ borderColor: "var(--border)", background: "var(--pill)", color: "var(--fg)", colorScheme: "light dark" }}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="mt-2 space-y-4">
            {cloudFailed && !isLoading && grouped.length > 0 ? <StaleDataNotice onRetry={retryLoad} busy={retrying} /> : null}
            {isLoading ? (
              <div className="rounded-[8px] border border-[rgba(203,208,213,0.22)] p-6" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--theme-text-muted,#61656B)" }}>
                Loading activity...
              </div>
            ) : grouped.length ? (
              grouped.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-3 text-base font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{group.label}</h2>
                  <div className="space-y-3">
                    {group.events.map((event) => (
                      <ActivityRow
                        key={event.id}
                        event={event}
                        selected={selected?.id === event.id}
                        onSelect={() => openOrSelect(event)}
                        basic={basicByEvent.get(event.id) ?? null}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : cloudFailed ? (
              <LoadErrorCard what="activity" onRetry={retryLoad} busy={retrying} />
            ) : filter === "added" && !allEvents.some((event) => event.kind === "added") ? (
              <div role="status" className="rounded-[8px] border border-[rgba(203,208,213,0.22)] p-5 text-sm" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--muted)" }}>
                No items added yet. When you add, import or scan an item, it shows up here.
              </div>
            ) : allEvents.length > 0 && anyFilterOn ? (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[rgba(203,208,213,0.22)] p-5 text-sm" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--muted)" }}>
                <span>{filter === "added" ? "No items added match these filters." : "Nothing matches these filters."}</span>
                <PillButton size="compact" onClick={clearFilters}>Clear filters</PillButton>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          {filteredEvents.length > visibleCount && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 20)}
                className="rounded-[6px] border border-[rgba(203,208,213,0.3)] px-14 py-3 text-sm font-bold"
                style={{ color: "var(--theme-gold,#C8CDD2)" }}
              >
                Load more ({filteredEvents.length - visibleCount} left)
              </button>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[8px] border border-[rgba(203,208,213,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-black">Activity Details</h2>
                <PillButton onClick={() => { setSelectedId(null); setPanelClosed(true); }} ariaLabel="Close" title="Close" className="px-0! w-11 md:w-9"><AppIcon name="close" size={16} /></PillButton>
              </div>

              <div className="mt-7 grid grid-cols-[128px_1fr] gap-5">
                <ActivityThumb event={selected} large />
                <div className="min-w-0">
                  <h3 className="text-[22px] font-black leading-tight">{selected.title}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selected.meta || selected.subtitle}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                    <Glyph name={selected.item?.isPublic ? "eye" : "key"} size={15} />
                    {selected.item?.isPublic ? "Public" : "Private"}
                  </div>
                  {selected.href && (
                    <PillButton href={selected.href} className="mt-5">
                      {selected.actionLabel ?? "Open"}
                      <Glyph name="share" size={16} />
                    </PillButton>
                  )}
                </div>
              </div>

              <div className="mt-7 border-b border-[rgba(203,208,213,0.16)] pb-5">
                <div className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Event</div>
                <div className="mt-2 text-lg font-black">{selected.subtitle}</div>
                <div className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatFullDate(selected.timestamp)}</div>
              </div>

              {basicByEvent.get(selected.id) ? (
                <section className="mt-5 border-b border-[rgba(203,208,213,0.16)] pb-5">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Basic info</h3>
                  <div className="mt-3"><BasicInfoBadge info={basicByEvent.get(selected.id) as BasicInfo} /></div>
                </section>
              ) : null}

              {showSelectedValue && (
                <section className="mt-5 border-b border-[rgba(203,208,213,0.16)] pb-5">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Value Change</h3>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Previous Value</div>
                      <div className="mt-1 text-[22px] font-black text-[color:var(--info,#52D6F4)]">{selected.previousValue ? formatMoney(selected.previousValue) : "-"}</div>
                    </div>
                    <div>
                      <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>New Value</div>
                      <div className="mt-1 text-[22px] font-black text-[color:var(--info,#52D6F4)]">{formatMoney(selected.newValue)}</div>
                    </div>
                    <div>
                      <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Change</div>
                      <div className={deltaPct(selected) !== null && Number(deltaPct(selected)) < 0 ? "mt-1 text-[22px] font-black text-red-400" : "mt-1 text-[22px] font-black text-green-400"}>
                        {deltaPct(selected) !== null ? `${Number(deltaPct(selected)) >= 0 ? "+" : ""}${Number(deltaPct(selected)).toFixed(1)}%` : "-"}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {showSelectedEvidence && (
                <section className="mt-5 rounded-[6px] border border-[rgba(203,208,213,0.22)] p-4">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Source & Evidence</h3>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    {typeof selected.comps === "number" && selected.comps > 0 && (
                      <div>
                        <div className="text-[24px] font-black text-[color:var(--info,#52D6F4)]">{selected.comps}</div>
                        <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Comparables</div>
                      </div>
                    )}
                    {selected.confidence && (
                      <div className="border-l border-[rgba(203,208,213,0.16)] pl-4">
                        <div className={selected.confidence === "High" ? "text-lg font-black text-green-400" : "text-lg font-black text-[color:var(--theme-gold,#C8CDD2)]"}>{selected.confidence}</div>
                        <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Confidence</div>
                      </div>
                    )}
                    {selected.source && (
                      <div className="border-l border-[rgba(203,208,213,0.16)] pl-4">
                        <div className="font-black">{selected.source}</div>
                        <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>Source</div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className="mt-5 border-b border-[rgba(203,208,213,0.16)] pb-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Notes</h3>
                  <PillButton size="compact" href={selected.href ?? "/vault"}>Add note</PillButton>
                </div>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selected.detail}</p>
              </section>

              <section className="mt-5">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Related Activity</h3>
                <div className="mt-3 grid gap-2">
                  {allEvents.filter((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id).slice(0, 2).map((event) => (
                    <button key={event.id} type="button" onClick={() => { setSelectedId(event.id); setPanelClosed(false); }} className="flex items-center justify-between rounded-[6px] border border-[rgba(203,208,213,0.16)] px-4 py-3 text-left text-sm">
                      <span>{event.subtitle}</span>
                      <span style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatFullDate(event.timestamp).split(",")[0]}</span>
                    </button>
                  ))}
                  {!allEvents.some((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id) && (
                    <div className="rounded-[6px] border border-[rgba(203,208,213,0.16)] px-4 py-3 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>No related activity yet.</div>
                  )}
                </div>
              </section>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Link href={selected.href ?? "/vault"} className="rounded-[6px] px-4 py-3 text-center text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Open record</Link>
                <Link href="/watchlist" className="rounded-[6px] border border-[rgba(203,208,213,0.34)] px-4 py-3 text-center text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Add target</Link>
                <button type="button" onClick={() => { setSelectedId(null); setPanelClosed(true); }} title="Closes this panel. Your activity history is not changed." className="rounded-[6px] border border-[rgba(203,208,213,0.22)] px-4 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Close</button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center" style={{ color: "var(--theme-text-muted,#61656B)" }}>Select an activity to see details.</div>
          )}
        </aside>
      </div>
      </main>
    </>
  );
}
