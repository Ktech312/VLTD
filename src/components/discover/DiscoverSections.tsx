"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { fetchUpcomingComicsChecked, formatStoreDate, type UpcomingIssue } from "@/lib/comicUpcoming";
import { comicTitle } from "@/lib/comicWishlistModel";
import { eventCountdown } from "@/lib/eventDates";
import { fetchUpcomingEventPreview, formatDateRange, type PreviewEvent } from "@/lib/events/eventPreview";
import { fetchMarketItems, type MarketItem } from "@/lib/publicProfile";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { getPrimaryImageUrl } from "@/lib/vaultModel";

// The lower sections of Discover. Everything here is public content: public exhibitions' own published items, listings people put up for sale, the public
// events catalogue and the public comic release calendar. Nothing from the signed-in person's own collection is read or shown.

export function SectionHead({ title, link }: { title: string; link?: { href: string; label: string } | { onClick: () => void; label: string } }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--theme-gold,#C8CDD2)" }}>{title}</h2>
      {link ? ("href" in link
        ? <PillButton size="compact" href={link.href}>{link.label}</PillButton>
        : <PillButton size="compact" onClick={link.onClick}>{link.label}</PillButton>) : null}
    </div>
  );
}

const cardStyle = { background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: "rgba(203,208,213,0.22)" } as const;
const muted = { color: "var(--theme-text-muted,#61656B)" } as const;

function Quiet({ children }: { children: ReactNode }) {
  return <div className="rounded-[7px] border px-4 py-5 text-sm" style={{ ...cardStyle, ...muted }}>{children}</div>;
}

/* ── Notable Items: real public items, one card per item ─────────────────────────────── */

export type NotableItem = {
  id: string;
  title: string;
  imageUrl: string;
  /** The item's published value, or null (never shown as $0). */
  value: number | null;
  roomId: string;
  roomTitle: string;
  collectorName: string;
};

export function NotableItemsSection({ items, expanded, onToggle }: { items: NotableItem[]; expanded: boolean; onToggle: () => void }) {
  if (items.length === 0) return null;
  const shown = expanded ? items.slice(0, 16) : items.slice(0, 8);
  return (
    <section className="mt-5" aria-label="Notable items" data-testid="notable-items">
      <SectionHead title="Notable Items" link={items.length > 8 ? { onClick: onToggle, label: expanded ? "Show less" : "View more" } : undefined} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        {shown.map((item) => (
          <Link
            key={item.id}
            href={`/museum/${item.roomId}/guest`}
            className="group overflow-hidden rounded-[7px] border transition hover:-translate-y-0.5"
            style={cardStyle}
            aria-label={`${item.title}, in ${item.roomTitle}`}
          >
            <div className="relative aspect-square w-full overflow-hidden bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            </div>
            <div className="p-2.5">
              <div className="line-clamp-2 text-[12px] font-bold leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{item.title}</div>
              <div className="mt-0.5 truncate text-[10px]" style={muted}>in {item.roomTitle} · {item.collectorName}</div>
              {item.value ? <div className="mt-1 text-[12px] font-black" style={{ color: "var(--info,#52D6F4)" }}>${Math.round(item.value).toLocaleString("en-US")}</div> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ── Marketplace: a few current listings and a labelled link to the page ────────────── */

export function MarketplaceSection() {
  const [items, setItems] = useState<MarketItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetchMarketItems({ limit: 8 })
      .then((data) => { if (active) setItems(data.slice(0, 4)); })
      .catch(() => { if (active) { setFailed(true); setItems([]); } });
    return () => { active = false; };
  }, []);
  return (
    <section className="mt-5" aria-label="Marketplace" data-testid="discover-marketplace">
      <SectionHead title="Marketplace" link={{ href: "/market", label: "Open Marketplace" }} />
      {items === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[190px] animate-pulse rounded-[7px]" style={{ background: "var(--surface)" }} />)}</div>
      ) : items.length === 0 ? (
        <Quiet>{failed ? "Listings could not be loaded just now. " : "Nothing is listed for sale right now. "}<Link href="/market" className="font-semibold underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>Open Marketplace</Link></Quiet>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => {
            const price = item.askingPrice ?? item.currentValue;
            const priced = typeof price === "number" && Number.isFinite(price) && price > 0;
            const image = getPrimaryImageUrl(item);
            return (
              <Link key={item.id} href="/market" className="group overflow-hidden rounded-[7px] border transition hover:-translate-y-0.5" style={cardStyle} aria-label={`${item.title}, for sale on Marketplace`}>
                <div className="relative aspect-square w-full overflow-hidden bg-black/20">
                  {image ? <ProgressiveImage src={image} alt={item.title} className="h-full w-full" imageClassName="object-cover object-center transition group-hover:scale-105" /> : null}
                  <span className="absolute left-2 top-2 rounded-[5px] bg-black/60 px-1.5 py-0.5 text-[9px] font-black tracking-wide" style={{ color: "#C8CDD2" }}>FOR SALE</span>
                </div>
                <div className="p-2.5">
                  <div className="line-clamp-2 text-[12px] font-bold leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{item.title}</div>
                  <div className="mt-0.5 truncate text-[10px]" style={muted}>{item.universe ? UNIVERSE_LABEL[item.universe as UniverseKey] ?? item.universe : "Collectible"}</div>
                  {priced ? <div className="mt-1 text-[12px] font-black" style={{ color: "var(--info,#52D6F4)" }}>${Math.round(price as number).toLocaleString("en-US")} <span className="text-[10px] font-semibold" style={muted}>{item.askingPrice != null ? "asking" : "value"}</span></div> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Events: the same events as the Events page, soonest first ─────────────────────── */

export function EventsSection() {
  const [events, setEvents] = useState<PreviewEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setEvents([]); return; }
    fetchUpcomingEventPreview(supabase, 4)
      .then((rows) => { if (active) setEvents(rows); })
      .catch(() => { if (active) { setFailed(true); setEvents([]); } });
    return () => { active = false; };
  }, []);
  return (
    <section className="mt-5" aria-label="Events" data-testid="discover-events">
      <SectionHead title="Events" link={{ href: "/events", label: "See all events" }} />
      {events === null ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[96px] animate-pulse rounded-[7px]" style={{ background: "var(--surface)" }} />)}</div>
      ) : events.length === 0 ? (
        <Quiet>{failed ? "Events could not be loaded just now. " : "No upcoming events are listed. "}<Link href="/events" className="font-semibold underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>Open Events</Link></Quiet>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {events.map((event) => (
            <Link key={event.id} href="/events" className="flex gap-3 rounded-[7px] border p-3 transition hover:-translate-y-0.5" style={cardStyle} aria-label={`${event.name}, ${formatDateRange(event.starts_at, event.ends_at)}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[7px] border border-[rgba(203,208,213,0.22)]" style={{ color: "var(--theme-gold)" }}>
                <AppIcon name="events" size={20} />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-[12px] font-bold leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{event.name}</span>
                <span className="mt-1 block truncate text-[11px]" style={muted}>{formatDateRange(event.starts_at, event.ends_at)}</span>
                <span className="block truncate text-[10px]" style={{ color: "var(--theme-gold)" }}>{eventCountdown(event)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Upcoming Comics: the next releases, linking to the Upcoming Comics page ───────── */

export function UpcomingComicsSection() {
  const [issues, setIssues] = useState<UpcomingIssue[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetchUpcomingComicsChecked({ days: 30, pageSize: 12 }).then(({ data, failed: didFail }) => {
      if (!active) return;
      setFailed(didFail);
      // One card per series, so six cards are six different books.
      const seen = new Set<string>();
      const picked = (data?.results ?? []).filter((issue) => issue.imageUrl && !seen.has(issue.series) && seen.add(issue.series)).slice(0, 6);
      setIssues(picked);
    });
    return () => { active = false; };
  }, []);
  return (
    <section className="mt-5" aria-label="Upcoming Comics" data-testid="discover-upcoming">
      <SectionHead title="Upcoming Comics" link={{ href: "/upcoming", label: "Open Upcoming Comics" }} />
      {issues === null ? (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="aspect-[2/3] animate-pulse rounded-[7px]" style={{ background: "var(--surface)" }} />)}</div>
      ) : issues.length === 0 ? (
        <Quiet>{failed ? "The release calendar could not be loaded just now. " : "No releases are listed for the next 30 days. "}<Link href="/upcoming" className="font-semibold underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>Open Upcoming Comics</Link></Quiet>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {issues.map((issue) => (
            <Link key={issue.id} href="/upcoming" className="group overflow-hidden rounded-[7px] border transition hover:-translate-y-0.5" style={cardStyle} aria-label={`${comicTitle(issue.series, issue.number)}, out ${formatStoreDate(issue.storeDate)}`}>
              <div className="relative aspect-[2/3] w-full bg-black/20">
                {issue.imageUrl ? <Image src={issue.imageUrl} alt={comicTitle(issue.series, issue.number)} fill sizes="(max-width: 768px) 30vw, 160px" style={{ objectFit: "cover" }} unoptimized /> : null}
              </div>
              <div className="p-2">
                <div className="line-clamp-2 text-[11px] font-bold leading-tight" style={{ color: "var(--theme-text-primary,#ECEDEF)" }}>{comicTitle(issue.series, issue.number)}</div>
                <div className="mt-0.5 text-[10px]" style={muted}>{formatStoreDate(issue.storeDate)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
