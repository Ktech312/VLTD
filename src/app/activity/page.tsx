"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { listRecentCommentsForExhibitions, type Comment } from "@/lib/comments";
import { listExhibitionEventsForGalleries, type ExhibitionEvent } from "@/lib/exhibitionEvents";
import { loadGalleries } from "@/lib/galleryModel";
import { loadSaleHistory } from "@/lib/historyModel";
import { fetchPublicProfile } from "@/lib/publicProfile";
import { loadSales, type SaleRecord as LegacySaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
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
  { key: "insurance", label: "Insurance", icon: "shield" },
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
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

function itemMeta(item: VaultItem) {
  return [item.universe, item.categoryLabel || item.category, item.grade].filter(Boolean).join(" - ");
}

function itemImage(item?: VaultItem) {
  if (!item) return undefined;
  if (item.imageFrontUrl) return item.imageFrontUrl;
  if (item.images?.[0]?.url) return item.images[0].url;

  const text = [item.title, item.universe, item.category, item.categoryLabel].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("music") || text.includes("vinyl")) return "/collectibles/vinyl-record.png";
  if (text.includes("jordan") || text.includes("sports")) return "/collectibles/sports-slab.png";
  if (text.includes("watch") || text.includes("rolex")) return "/universe-thumbnails/jewelry-apparel.png";
  if (text.includes("game")) return "/collectibles/vault-intake-sprites.png";
  return "/collectibles/comic-slab.png";
}

function saleKey(sale: SaleRecord | LegacySaleRecord) {
  return [sale.id, sale.itemId, sale.soldAt, sale.title, sale.salePrice].join(":");
}

function confidenceLabel(item?: VaultItem): "Low" | "Medium" | "High" {
  const confidence = Number(item?.valueConfidence ?? 0);
  if (confidence >= 80) return "High";
  if (confidence >= 50) return "Medium";
  return item?.currentValue ? "Medium" : "Low";
}

function buildItemEvents(items: VaultItem[]) {
  const addedEvents: ActivityEvent[] = items
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
      newValue: Number(item.currentValue ?? item.estimatedValue ?? item.lastCompValue ?? 0),
      source: item.valueSource || item.priceSource || "Vault",
      confidence: confidenceLabel(item),
      comps: item.comparables?.length ?? item.priceSources?.length ?? 0,
      meta: itemMeta(item),
    }));

  const valueEvents: ActivityEvent[] = items
    .filter((item) => Number(item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0) > 0)
    .map((item) => {
      const newValue = Number(item.currentValue ?? item.estimatedValue ?? item.lastCompValue ?? 0);
      const previousValue = Number(item.purchasePrice ?? item.valueLow ?? item.lastCompValue ?? 0);
      return {
        id: `valued-${item.id}-${item.valueUpdatedAt ?? item.priceUpdatedAt}`,
        kind: "valued",
        title: item.title || "Untitled item",
        subtitle: "Value refreshed",
        detail: `Value updated based on ${item.comparables?.length || item.priceSources?.length || 0} comparables`,
        timestamp: Number(item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0),
        href: `/vault/item/${item.id}`,
        actionLabel: "View item record",
        item,
        imageUrl: itemImage(item),
        previousValue,
        newValue,
        source: item.valueSource || item.priceSource || "Pricing",
        confidence: confidenceLabel(item),
        comps: item.comparables?.length ?? item.priceSources?.length ?? 0,
        meta: itemMeta(item),
      } satisfies ActivityEvent;
    });

  return [...addedEvents, ...valueEvents];
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
        confidence: "High",
        comps: 1,
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
    imageUrl: "/collectibles/movie-poster.png",
    source: "Exhibition",
    confidence: "High",
    comps: 0,
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
    imageUrl: "/collectibles/movie-poster.png",
    source: "Public gallery",
    confidence: "High",
    comps: 0,
  }) satisfies ActivityEvent);
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
  return "var(--theme-gold,#F5B548)";
}

function deltaPct(event: ActivityEvent) {
  const previous = Number(event.previousValue ?? 0);
  const next = Number(event.newValue ?? 0);
  if (!previous || !next) return null;
  return ((next - previous) / previous) * 100;
}

function ActivityThumb({ event, large = false }: { event: ActivityEvent; large?: boolean }) {
  const size = large ? "h-40 w-32" : "h-20 w-16";
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[rgba(245,181,72,0.28)] bg-black/30`}>
      {event.imageUrl ? (
        <img src={event.imageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <Glyph name="box" size={large ? 42 : 24} style={{ color: "var(--theme-text-muted,#A0956B)" }} />
      )}
    </div>
  );
}

function ActivityRow({ event, selected, onSelect }: { event: ActivityEvent; selected: boolean; onSelect: () => void }) {
  const change = deltaPct(event);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[84px_54px_72px_minmax(0,1fr)_minmax(180px,260px)_190px] items-center gap-5 rounded-[7px] border p-4 text-left transition hover:-translate-y-0.5"
      style={{
        background: "var(--theme-card,rgba(15,25,45,0.88))",
        borderColor: selected ? "var(--theme-gold,#F5B548)" : "rgba(245,181,72,0.22)",
        boxShadow: selected ? "0 0 0 1px rgba(245,181,72,0.2), 0 18px 38px rgba(0,0,0,0.28)" : "none",
      }}
    >
      <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{formatClock(event.timestamp)}</div>
      <div className="grid h-12 w-12 place-items-center rounded-full border" style={{ borderColor: colorForKind(event.kind), color: colorForKind(event.kind), background: "rgba(0,0,0,0.24)" }}>
        <Glyph name={iconForKind(event.kind)} size={22} />
      </div>
      <ActivityThumb event={event} />
      <div className="min-w-0">
        <div className="text-lg font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{event.subtitle}</div>
        <div className="truncate text-base" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{event.title}</div>
        <div className="mt-1 truncate text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{event.detail}</div>
      </div>
      <div className="min-w-0 border-l border-[rgba(245,181,72,0.16)] pl-6">
        {event.newValue ? (
          <div className="text-[22px] font-black text-[color:var(--info,#52D6F4)]">
            {event.previousValue ? `${formatMoney(event.previousValue)} -> ` : ""}
            {formatMoney(event.newValue)}
          </div>
        ) : (
          <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{event.meta ?? "Recorded"}</div>
        )}
        {change !== null && (
          <div className={change >= 0 ? "text-green-400" : "text-red-400"}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="border-l border-[rgba(245,181,72,0.16)] pl-6 text-right text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
        <div>{event.confidence ?? "Medium"} confidence</div>
        <div>{event.source ?? "VLTD"} {event.comps ? `- ${event.comps} comps` : ""}</div>
        <div className="mt-2" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>{formatClock(event.timestamp)}</div>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[8px] border border-[rgba(245,181,72,0.22)] p-10 text-center" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))" }}>
      <Glyph name="chart" size={44} style={{ color: "var(--theme-gold,#F5B548)", marginInline: "auto" }} />
      <h2 className="mt-4 text-xl font-black" style={{ color: "var(--theme-text-primary,#F0EAD6)" }}>No activity yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>
        Add items, update prices, publish exhibitions, or log a sale and this page will become your vault timeline.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link href="/vault/add" className="rounded-[7px] px-5 py-2 text-sm font-black" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>Add item</Link>
        <Link href="/vault" className="rounded-[7px] border border-[rgba(245,181,72,0.26)] px-5 py-2 text-sm font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>Open vault</Link>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [sales, setSales] = useState<Array<SaleRecord | LegacySaleRecord>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [exhibitionEvents, setExhibitionEvents] = useState<Array<ExhibitionEvent & { galleryTitle: string }>>([]);
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
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

      if (!isActive) return;
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
      ...buildItemEvents(items),
      ...buildSaleEvents(sales, itemById),
      ...buildGalleryEvents(exhibitionEvents),
      ...buildCommentEvents(recentComments),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);
  }, [exhibitionEvents, itemById, items, recentComments, sales]);

  const filteredEvents = useMemo(() => {
    return filter === "all" ? allEvents : allEvents.filter((event) => event.kind === filter);
  }, [allEvents, filter]);

  const selected = filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? allEvents[0] ?? null;
  const totalValue = items.reduce((sum, item) => sum + Number(item.currentValue ?? item.estimatedValue ?? 0), 0);
  const grouped = filteredEvents.reduce<Array<{ label: string; events: ActivityEvent[] }>>((groups, event) => {
    const label = dayLabel(event.timestamp);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.events.push(event);
    else groups.push({ label, events: [event] });
    return groups;
  }, []);

  return (
    <main className="min-h-screen px-4 py-7 text-[color:var(--theme-text-primary,#F0EAD6)] sm:px-6 lg:px-8" style={{ background: "var(--bg)" }}>
      <div className="mx-auto grid max-w-[1480px] gap-7 xl:grid-cols-[minmax(0,1fr)_470px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-[48px] font-black leading-none tracking-[-0.02em]">Activity</h1>
              <p className="mt-2 text-base" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Everything that changed in your vault.</p>
            </div>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.3)] px-4 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>
              <Glyph name="chart" size={16} />
              Filters
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {FILTERS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className="inline-flex h-10 items-center gap-2 rounded-[7px] border px-4 text-sm font-bold"
                style={{
                  background: filter === tab.key ? "linear-gradient(135deg,#8B6914,#F5B548)" : "var(--theme-card,rgba(15,25,45,0.86))",
                  borderColor: filter === tab.key ? "rgba(245,181,72,0.6)" : "rgba(245,181,72,0.24)",
                  color: filter === tab.key ? "#0B0B0B" : "var(--theme-gold,#F5B548)",
                }}
              >
                <Glyph name={tab.icon} size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-7 space-y-4">
            {isLoading ? (
              <div className="rounded-[8px] border border-[rgba(245,181,72,0.22)] p-6" style={{ background: "var(--theme-card,rgba(15,25,45,0.86))", color: "var(--theme-text-muted,#A0956B)" }}>
                Loading activity...
              </div>
            ) : grouped.length ? (
              grouped.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-3 text-base font-black" style={{ color: "var(--theme-gold,#F5B548)" }}>{group.label}</h2>
                  <div className="relative space-y-3">
                    <div className="absolute bottom-5 left-[109px] top-5 hidden w-px bg-[rgba(245,181,72,0.26)] sm:block" />
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

          {filteredEvents.length > 8 && (
            <div className="mt-5 flex justify-center">
              <button type="button" className="rounded-[7px] border border-[rgba(245,181,72,0.3)] px-14 py-3 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>Load more</button>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[8px] border border-[rgba(245,181,72,0.32)] p-5 xl:sticky xl:top-24" style={{ background: "var(--theme-card,rgba(15,25,45,0.92))", boxShadow: "0 18px 55px rgba(0,0,0,0.26)" }}>
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-black">Activity Details</h2>
                <button type="button" onClick={() => setSelectedId(null)} style={{ color: "var(--theme-gold,#F5B548)" }}>x</button>
              </div>

              <div className="mt-7 grid grid-cols-[138px_1fr] gap-5">
                <ActivityThumb event={selected} large />
                <div className="min-w-0">
                  <h3 className="text-[22px] font-black leading-tight">{selected.title}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selected.meta || selected.subtitle}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: "var(--theme-gold,#F5B548)" }}>
                    <Glyph name={selected.item?.isPublic ? "eye" : "key"} size={15} />
                    {selected.item?.isPublic ? "Public" : "Private"}
                  </div>
                  {selected.href && (
                    <Link href={selected.href} className="mt-5 inline-flex h-10 items-center gap-2 rounded-[7px] border border-[rgba(245,181,72,0.34)] px-5 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>
                      {selected.actionLabel ?? "Open"}
                      <Glyph name="share" size={15} />
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-7 border-b border-[rgba(245,181,72,0.16)] pb-5">
                <div className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Event</div>
                <div className="mt-2 text-lg font-black">{selected.subtitle}</div>
                <div className="mt-1 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{formatFullDate(selected.timestamp)}</div>
              </div>

              <section className="mt-5 border-b border-[rgba(245,181,72,0.16)] pb-5">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Value Change</h3>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Previous Value</div>
                    <div className="mt-1 text-[24px] font-black text-[color:var(--info,#52D6F4)]">{selected.previousValue ? formatMoney(selected.previousValue) : "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>New Value</div>
                    <div className="mt-1 text-[24px] font-black text-[color:var(--info,#52D6F4)]">{selected.newValue ? formatMoney(selected.newValue) : "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Change</div>
                    <div className={deltaPct(selected) !== null && Number(deltaPct(selected)) < 0 ? "mt-1 text-[24px] font-black text-red-400" : "mt-1 text-[24px] font-black text-green-400"}>
                      {deltaPct(selected) !== null ? `${Number(deltaPct(selected)) >= 0 ? "+" : ""}${Number(deltaPct(selected)).toFixed(1)}%` : "-"}
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-[7px] border border-[rgba(245,181,72,0.22)] p-4">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Source & Evidence</h3>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-[24px] font-black text-[color:var(--info,#52D6F4)]">{selected.comps ?? 0}</div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Comparables</div>
                  </div>
                  <div className="border-l border-[rgba(245,181,72,0.16)] pl-4">
                    <div className={selected.confidence === "High" ? "text-lg font-black text-green-400" : "text-lg font-black text-[color:var(--theme-gold,#F5B548)]"}>{selected.confidence ?? "Medium"}</div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Confidence</div>
                  </div>
                  <div className="border-l border-[rgba(245,181,72,0.16)] pl-4">
                    <div className="font-black">{selected.source ?? "VLTD"}</div>
                    <div className="text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Source</div>
                  </div>
                </div>
              </section>

              <section className="mt-5 border-b border-[rgba(245,181,72,0.16)] pb-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Notes</h3>
                  <Link href={selected.href ?? "/vault"} className="rounded-[7px] border border-[rgba(245,181,72,0.34)] px-4 py-2 text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>Add note</Link>
                </div>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--theme-text-muted,#A0956B)" }}>{selected.detail}</p>
              </section>

              <section className="mt-5">
                <h3 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Related Activity</h3>
                <div className="mt-3 grid gap-2">
                  {allEvents.filter((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id).slice(0, 2).map((event) => (
                    <button key={event.id} type="button" onClick={() => setSelectedId(event.id)} className="flex items-center justify-between rounded-[7px] border border-[rgba(245,181,72,0.16)] px-4 py-3 text-left text-sm">
                      <span>{event.subtitle}</span>
                      <span style={{ color: "var(--theme-text-muted,#A0956B)" }}>{formatFullDate(event.timestamp).split(",")[0]}</span>
                    </button>
                  ))}
                  {!allEvents.some((event) => event.id !== selected.id && event.item?.id && event.item.id === selected.item?.id) && (
                    <div className="rounded-[7px] border border-[rgba(245,181,72,0.16)] px-4 py-3 text-sm" style={{ color: "var(--theme-text-muted,#A0956B)" }}>No related activity yet.</div>
                  )}
                </div>
              </section>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <Link href={selected.href ?? "/vault"} className="rounded-[7px] px-4 py-3 text-center text-sm font-black" style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)", color: "#0B0B0B" }}>Open record</Link>
                <Link href="/wishlist" className="rounded-[7px] border border-[rgba(245,181,72,0.34)] px-4 py-3 text-center text-sm font-bold" style={{ color: "var(--theme-gold,#F5B548)" }}>Add target</Link>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-[7px] border border-red-500/45 px-4 py-3 text-sm font-bold text-red-400">Dismiss</button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center" style={{ color: "var(--theme-text-muted,#A0956B)" }}>Select an activity to see details.</div>
          )}
        </aside>
      </div>
    </main>
  );
}
