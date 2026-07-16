"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { loadSaleHistory } from "@/lib/historyModel";
import { loadSales, type SaleRecord as LegacySaleRecord } from "@/lib/salesHistory";
import { syncSalesFromSupabase } from "@/lib/salesModel";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import type { SaleRecord } from "@/types/vaultLifecycle";
import { loadGalleries } from "@/lib/galleryModel";
import { listRecentCommentsForExhibitions, type Comment } from "@/lib/comments";
import { listExhibitionEventsForGalleries, type ExhibitionEvent } from "@/lib/exhibitionEvents";
import { fetchPublicProfile } from "@/lib/publicProfile";

type ActivityKind = "added" | "sold" | "valued" | "social";

type RecentComment = Comment & {
  exhibitionTitle: string;
  authorName: string;
};

function formatRelative(timestamp: number) {
  if (!timestamp) return "";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  timestamp: number;
  href?: string;
  meta?: string;
};

function formatDate(timestamp: number) {
  if (!timestamp) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatMoney(value?: number) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function itemTimestamp(item: VaultItem) {
  return Number(item.createdAt ?? item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
}

function itemLabel(item: VaultItem) {
  return [item.categoryLabel || item.category, item.grade].filter(Boolean).join(" - ");
}

function saleKey(sale: SaleRecord | LegacySaleRecord) {
  return [
    sale.id,
    sale.itemId,
    sale.soldAt,
    sale.title,
    sale.salePrice,
  ].join(":");
}

function buildEvents(items: VaultItem[], sales: Array<SaleRecord | LegacySaleRecord>) {
  const addedEvents: ActivityEvent[] = items
    .filter((item) => itemTimestamp(item) > 0)
    .map((item) => ({
      id: `added-${item.id}`,
      kind: "added",
      title: item.title || "Untitled item",
      detail: "Added to vault",
      timestamp: itemTimestamp(item),
      href: `/vault/item/${item.id}`,
      meta: itemLabel(item),
    }));

  const valueEvents: ActivityEvent[] = items
    .filter((item) => Number(item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0) > 0)
    .map((item) => {
      const timestamp = Number(item.valueUpdatedAt ?? item.priceUpdatedAt ?? 0);
      return {
        id: `valued-${item.id}-${timestamp}`,
        kind: "valued",
        title: item.title || "Untitled item",
        detail: `Value updated to ${formatMoney(item.currentValue ?? item.estimatedValue ?? item.lastCompValue)}`,
        timestamp,
        href: `/vault/item/${item.id}`,
        meta: item.valueSource || item.priceSource || itemLabel(item),
      };
    });

  const seenSales = new Set<string>();
  const soldEvents: ActivityEvent[] = sales
    .filter((sale) => {
      const key = saleKey(sale);
      if (seenSales.has(key)) return false;
      seenSales.add(key);
      return Number(sale.soldAt ?? 0) > 0;
    })
    .map((sale) => {
      const profit = Number(sale.salePrice ?? 0) - Number(sale.purchasePrice ?? 0);
      return {
        id: `sold-${sale.id}`,
        kind: "sold",
        title: sale.title || "Untitled item",
        detail: `Sold for ${formatMoney(sale.salePrice)}`,
        timestamp: Number(sale.soldAt ?? 0),
        href: sale.itemId ? `/vault/item/${sale.itemId}` : undefined,
        meta: `${profit >= 0 ? "+" : ""}${formatMoney(profit)} net`,
      };
    });

  return [...addedEvents, ...valueEvents, ...soldEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 60);
}

function KindBadge({ kind }: { kind: ActivityKind }) {
  const labelByKind: Record<ActivityKind, string> = {
    added: "Vault",
    sold: "Sale",
    valued: "Value",
    social: "Social",
  };

  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.18em]"
      style={{
        background:
          kind === "sold"
            ? "rgba(76,175,130,0.12)"
            : kind === "valued"
              ? "rgba(245,181,72,0.12)"
              : "var(--theme-gold-subtle, rgba(245,181,72,0.08))",
        border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.20))",
        color: kind === "sold" ? "#72D09B" : "var(--theme-gold, #F5B548)",
      }}
    >
      {labelByKind[kind]}
    </span>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const content = (
    <div
      className="grid gap-3 rounded-[18px] border p-4 transition hover:-translate-y-0.5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      <KindBadge kind={event.kind} />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[color:var(--fg)]">{event.title}</div>
        <div className="mt-1 text-sm text-[color:var(--muted)]">{event.detail}</div>
        {event.meta ? (
          <div className="mt-1 truncate text-xs text-[color:var(--muted2)]">{event.meta}</div>
        ) : null}
      </div>
      <div className="text-xs font-semibold text-[color:var(--muted2)] sm:text-right">
        {formatDate(event.timestamp)}
      </div>
    </div>
  );

  if (!event.href) return content;

  return (
    <Link href={event.href} className="block">
      {content}
    </Link>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [sales, setSales] = useState<Array<SaleRecord | LegacySaleRecord>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recentComments, setRecentComments] = useState<RecentComment[]>([]);
  const [exhibitionEvents, setExhibitionEvents] = useState<(ExhibitionEvent & { galleryTitle: string })[]>([]);

  useEffect(() => {
    let isActive = true;

    async function loadActivity() {
      setIsLoading(true);
      try {
        await syncVaultItemsFromSupabase();
      } catch {
        // Local activity still gives the page useful history.
      }
      try {
        await syncSalesFromSupabase();
      } catch {
        // Local sales still render.
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

  // Recent comments + exhibition events for exhibitions this collector owns.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const myGalleries = loadGalleries();
      if (myGalleries.length === 0) return;
      const galleryIds = myGalleries.map((g) => g.id);
      const titleById = new Map(myGalleries.map((g) => [g.id, g.title || "Exhibition"]));

      const [comments, events] = await Promise.all([
        listRecentCommentsForExhibitions(galleryIds),
        listExhibitionEventsForGalleries(galleryIds),
      ]);
      if (cancelled) return;

      if (comments.length > 0) {
        const uniqueAuthorIds = [...new Set(comments.map((c) => c.authorId))];
        const profiles = await Promise.all(uniqueAuthorIds.map((id) => fetchPublicProfile(id)));
        if (cancelled) return;
        const nameById = new Map(uniqueAuthorIds.map((id, i) => [id, profiles[i]?.displayName ?? "Collector"]));
        setRecentComments(
          comments.map((c) => ({
            ...c,
            exhibitionTitle: titleById.get(c.exhibitionId) ?? "Exhibition",
            authorName: nameById.get(c.authorId) ?? "Collector",
          }))
        );
      }

      if (events.length > 0) {
        setExhibitionEvents(
          events.map((e) => ({
            ...e,
            galleryTitle: titleById.get(e.galleryId) ?? "Exhibition",
          }))
        );
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const events = useMemo(() => buildEvents(items, sales), [items, sales]);
  const addedCount = items.length;
  const soldCount = sales.length;
  const totalValue = items.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);

  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">
              Activity
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[color:var(--fg)]">
              Collection Activity
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)]">
              Recent vault updates, sales, and value changes. Comments and exhibition activity appear in the sidebar — Vibes and new followers show up on your public profile.
            </p>
          </div>
          <Link
            href="/vault/add"
            className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, #8B6914, #F5B548)",
              color: "#0B0B0B",
              boxShadow: "0 4px 18px rgba(245,181,72,0.22)",
            }}
          >
            Add Item
          </Link>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Vault Items</div>
            <div className="mt-2 text-2xl font-black">{addedCount}</div>
          </div>
          <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Sales Logged</div>
            <div className="mt-2 text-2xl font-black">{soldCount}</div>
          </div>
          <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Tracked Value</div>
            <div className="mt-2 text-2xl font-black text-[color:var(--theme-gold)]">{formatMoney(totalValue)}</div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
                Timeline
              </h2>
              <span className="text-xs text-[color:var(--muted2)]">{events.length} recent events</span>
            </div>

            {isLoading ? (
              <div className="rounded-[18px] border p-5 text-sm text-[color:var(--muted)]" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                Loading activity...
              </div>
            ) : events.length ? (
              <div className="grid gap-3">
                {events.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border p-8 text-center" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                <h2 className="text-xl font-bold">No activity yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[color:var(--muted)]">
                  Add items, update values, or record a sale and this page will become your collection timeline.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link href="/vault/add" className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: "var(--theme-gold, #F5B548)", color: "#0B0B0B" }}>
                    Add First Item
                  </Link>
                  <Link href="/vault" className="rounded-full border px-5 py-2 text-sm font-semibold text-[color:var(--theme-gold)]" style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))" }}>
                    Open Vault
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            {recentComments.length > 0 && (
              <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
                  Recent Comments
                </h2>
                <div className="mt-4 grid gap-2">
                  {recentComments.slice(0, 6).map((c) => (
                    <Link
                      key={c.id}
                      href={`/museum/${c.exhibitionId}/guest?comment=${c.id}`}
                      className="block rounded-[14px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold,#F5B548)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[color:var(--fg)]">{c.authorName}</span>
                        <span className="text-[10px] text-[color:var(--muted2)]">{formatRelative(c.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-[color:var(--muted)]">{c.body}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[color:var(--muted2)]">on {c.exhibitionTitle}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {exhibitionEvents.length > 0 && (
              <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
                <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
                  Exhibition Activity
                </h2>
                <div className="mt-4 grid gap-2">
                  {exhibitionEvents.slice(0, 6).map((e) => {
                    const isPublish = e.type === "published";
                    const itemCount = typeof e.metadata.itemCount === "number" ? e.metadata.itemCount : null;
                    return (
                      <Link
                        key={e.id}
                        href={`/museum/${e.galleryId}`}
                        className="block rounded-[14px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold,#F5B548)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[color:var(--fg)]">
                            {isPublish ? "🔓 Published" : "📣 Announced"}
                          </span>
                          <span className="text-[10px] text-[color:var(--muted2)]">{formatRelative(e.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{e.galleryTitle}</div>
                        {!isPublish && itemCount !== null && (
                          <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-[color:var(--muted2)]">{itemCount} items</div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-[18px] border p-4" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}>
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
                Quick Links
              </h2>
              <div className="mt-4 grid gap-2">
                <Link href="/vault" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
                  Vault
                </Link>
                <Link href="/museum" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
                  Exhibitions
                </Link>
                <Link href="/portfolio" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]">
                  Insights
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
