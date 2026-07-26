"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { loadActivityEvents, syncActivityEventsFromSupabase, type ActivityEventRecord } from "@/lib/activityEvents";
import { listRecentCommentsForExhibitions, type Comment } from "@/lib/comments";
import { listExhibitionEventsForGalleries, type ExhibitionEvent } from "@/lib/exhibitionEvents";
import { loadGalleries } from "@/lib/galleryModel";
import { loadSaleHistory } from "@/lib/historyModel";
import { fetchPublicProfile } from "@/lib/publicProfile";
import { loadSales, type SaleRecord as LegacySaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
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
  { key: "added", label: "Scans", icon: "eye" },
  { key: "valued", label: "Value Changes", icon: "chart" },
  { key: "exhibition", label: "Exhibitions", icon: "building" },
  { key: "sold", label: "Sales", icon: "tag" },
  { key: "share", label: "Shares", icon: "share" },
];

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

function buildItemEvents(items: VaultItem[]): ActivityEvent[] {
  return items
    .filter((item) => itemTimestamp(item) > 0)
    .map((item) => ({
      id: `added-${item.id}`,
      kind: "added",
      title: item.title || "Untitled item",
      subtitle: "Item scanned",
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
    subtitle: event.type === "published" ? "Exhibition published" : "Gallery announced",
    detail: event.type === "published" ? "Public gallery updated" : "Announcement sent",
    timestamp: event.createdAt,
    href: `/museum/${event.galleryId}`,
    actionLabel: event.type === "published" ? "View exhibition" : "Open gallery",
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
    source: "Public gallery",
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
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[rgba(203,208,213,0.28)] bg-black/30`}>
      {event.imageUrl ? (
        <img src={event.imageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <Glyph name="box" size={large ? 42 : 24} style={{ color: "var(--theme-text-muted,#61656B)" }} />
      )}
    </div>
  );
}

function ActivityRow({ event, selected, onSelect }: { event: ActivityEvent; selected: boolean; onSelect: () => void }) {
  const change = deltaPct(event);
  const showValue = event.kind === "valued" || event.kind === "sold";
  const showEvidence = Boolean(event.source || event.confidence || event.comps);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[78px_50px_70px_minmax(0,1fr)_minmax(150px,220px)_150px] items-center gap-4 rounded-[7px] border p-4 text-left transition hover:-translate-y-0.5"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.88))",
        borderColor: selected ? "var(--theme-gold,#C8CDD2)" : "rgba(203,208,213,0.22)",
        boxShadow: selected ? "0 0 0 1px rgba(203,208,213,0.2), 0 18px 38px rgba(0,0,0,0.28)" : "none",
      }}
    >
      <div className="text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatClock(event.timestamp)}</div>
      <div className="grid h-11 w-11 place-items-center justify-self-center rounded-full border" style={{ borderColor: colorForKind(event.kind), color: colorForKind(event.kind), background: "rgba(0,0,0,0.24)" }}>
        <Glyph name={iconForKind(event.kind)} size={19} />
      </div>
      <ActivityThumb event={event} />
      <div className="min-w-0">
        <div className="text-lg font-black" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{event.subtitle}</div>
        <div className="truncate text-base" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{event.title}</div>
        <div className="mt-1 truncate text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{event.detail}</div>
      </div>
      <div className="min-w-0 border-l border-[rgba(203,208,213,0.16)] pl-5">
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
      <div className="border-l border-[rgba(203,208,213,0.16)] pl-5 text-right text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>
        {showEvidence ? (
          <>
            {event.confidence && <div>{event.confidence} confidence</div>}
            {event.source && <div>{event.source}{event.comps ? ` - ${event.comps} comps` : ""}</div>}
          </>
        ) : (
          <div>{event.meta || event.subtitle}</div>
        )}
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
        <Link href="/vault/add" className="rounded-[7px] px-5 py-2 text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Add item</Link>
        <Link href="/vault" className="rounded-[7px] border border-[rgba(203,208,213,0.26)] px-5 py-2 text-sm font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Open vault</Link>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [sales, setSales] = useState<Array<SaleRecord | LegacySaleRecord>>([]);
  const [loggedEvents, setLoggedEvents] = useState<ActivityEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [exhibitionEvents, setExhibitionEvents] = useState<Array<ExhibitionEvent & { galleryTitle: string }>>([]);
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadActivity() {
      setIsLoading(true);
      try {
        await syncVaultItemsFromSupabase();
      } catch {
        // Local activity still renders if sync is unavailable.
      }
      try {
        await syncSalesFromSupabase();
      } catch {
        // Local sales still render if sync is unavailable.
      }
      let nextLoggedEvents: ActivityEventRecord[];
      try {
        nextLoggedEvents = await syncActivityEventsFromSupabase();
      } catch {
        nextLoggedEvents = loadActivityEvents();
      }

      if (!isActive) return;
      setLoggedEvents(nextLoggedEvents);
      setItems(loadItems());
      setSales([...loadSaleHistory(), ...loadSales()]);
      setIsLoading(false);
    }

    void loadActivity();

    return () => {
      isActive = false;
    };
  }, []);

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
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);
  }, [exhibitionEvents, itemById, items, loggedEvents, recentComments, sales]);

  const filteredEvents = useMemo(() => {
    return filter === "all" ? allEvents : allEvents.filter((event) => event.kind === filter);
  }, [allEvents, filter]);

  const selected = filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? allEvents[0] ?? null;
  const availableFilters = FILTERS.filter((tab) => tab.key === "all" || allEvents.some((event) => event.kind === tab.key));
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
    <main className="min-h-screen px-4 py-7 text-[color:var(--theme-text-primary,#ECEDEF)] sm:px-6 lg:px-8" style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid max-w-[1420px] gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-[48px] font-black leading-none tracking-[-0.02em]">Activity</h1>
              <p className="mt-2 text-base" style={{ color: "var(--theme-text-muted,#61656B)" }}>Everything that changed in your vault.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {availableFilters.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  setVisibleCount(20);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[7px] border px-4 text-sm font-bold"
                style={{
                  background: filter === tab.key ? "linear-gradient(135deg,#8C9298,#C8CDD2)" : "var(--theme-card,rgba(15,25,45,0.86))",
                  borderColor: filter === tab.key ? "rgba(203,208,213,0.6)" : "rgba(203,208,213,0.24)",
                  color: filter === tab.key ? "#0B0B0B" : "var(--theme-gold,#C8CDD2)",
                }}
              >
                <Glyph name={tab.icon} size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-7 space-y-4">
            {isLoading ? (
              <div className="rounded-[8px] border border-[rgba(203,208,213,0.22)] p-6" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--theme-text-muted,#61656B)" }}>
                Loading activity...
              </div>
            ) : grouped.length ? (
              grouped.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-3 text-base font-black" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{group.label}</h2>
                  <div className="relative space-y-3">
                    <div className="absolute bottom-5 left-[109px] top-5 hidden w-px bg-[rgba(203,208,213,0.26)] sm:block" />
                    {group.events.map((event) => (
                      <ActivityRow
                        key={event.id}
                        event={event}
                        selected={selected?.id === event.id}
                        onSelect={() => setSelectedId(event.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState />
            )}
          </div>

          {filteredEvents.length > visibleCount && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 20)}
                className="rounded-[7px] border border-[rgba(203,208,213,0.3)] px-14 py-3 text-sm font-bold"
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
                <button type="button" onClick={() => setSelectedId(null)} style={{ color: "var(--theme-gold,#C8CDD2)" }}>x</button>
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
                    <Link href={selected.href} className="mt-5 inline-flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.34)] px-5 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>
                      {selected.actionLabel ?? "Open"}
                      <Glyph name="share" size={15} />
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-7 border-b border-[rgba(203,208,213,0.16)] pb-5">
                <div className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Event</div>
                <div className="mt-2 text-lg font-black">{selected.subtitle}</div>
                <div className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatFullDate(selected.timestamp)}</div>
              </div>

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
                <section className="mt-5 rounded-[7px] border border-[rgba(203,208,213,0.22)] p-4">
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
                  <Link href={selected.href ?? "/vault"} className="rounded-[7px] border border-[rgba(203,208,213,0.34)] px-4 py-2 text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Add note</Link>
                </div>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--theme-text-muted,#61656B)" }}>{selected.detail}</p>
              </section>

              <section className="mt-5">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#61656B)" }}>Related Activity</h3>
                <div className="mt-3 grid gap-2">
                  {allEvents.filter((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id).slice(0, 2).map((event) => (
                    <button key={event.id} type="button" onClick={() => setSelectedId(event.id)} className="flex items-center justify-between rounded-[7px] border border-[rgba(203,208,213,0.16)] px-4 py-3 text-left text-sm">
                      <span>{event.subtitle}</span>
                      <span style={{ color: "var(--theme-text-muted,#61656B)" }}>{formatFullDate(event.timestamp).split(",")[0]}</span>
                    </button>
                  ))}
                  {!allEvents.some((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id) && (
                    <div className="rounded-[7px] border border-[rgba(203,208,213,0.16)] px-4 py-3 text-sm" style={{ color: "var(--theme-text-muted,#61656B)" }}>No related activity yet.</div>
                  )}
                </div>
              </section>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Link href={selected.href ?? "/vault"} className="rounded-[7px] px-4 py-3 text-center text-sm font-black" style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}>Open record</Link>
                <Link href="/wishlist" className="rounded-[7px] border border-[rgba(203,208,213,0.34)] px-4 py-3 text-center text-sm font-bold" style={{ color: "var(--theme-gold,#C8CDD2)" }}>Add target</Link>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-[7px] border border-red-500/45 px-4 py-3 text-sm font-bold text-red-400">Dismiss</button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center" style={{ color: "var(--theme-text-muted,#61656B)" }}>Select an activity to see details.</div>
          )}
        </aside>
      </div>
    </main>
  );
}
