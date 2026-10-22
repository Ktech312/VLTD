import { eventBounds, eventPhase, type EventSpan } from "@/lib/eventDates";

// Which events the Home banner shows. It has room for ten, and the catalogue holds hundreds of events, so taking "the ten that start first" fills it
// with whatever local show is next and a major convention a week or two out never appears. Events an admin has marked Featured (the Featured toggle in
// Admin > Events, and every show on the maintained major-events list) come first, up to FEATURED_MAX of them so the next nearest events still get
// room; the rest of the slots go to the events that start soonest. The ten chosen are then shown in date order. Events that are already over in the
// viewer's calendar are dropped.
export const BANNER_EVENT_LIMIT = 10;
export const FEATURED_MAX = 6;
export const FEATURED_HORIZON_DAYS = 60;
// How many of each list to ask the database for: more than will be shown, because some are dropped as over in the viewer's own calendar.
export const BANNER_FETCH_FEATURED = 20;
export const BANNER_FETCH_NEAREST = 30;

type BannerEvent = EventSpan & { id: string };

function byStart(a: EventSpan, b: EventSpan): number {
  return eventBounds(a).start.getTime() - eventBounds(b).start.getTime();
}

export function pickBannerEvents<T extends BannerEvent>(featured: T[], nearest: T[], now: Date = new Date(), limit = BANNER_EVENT_LIMIT): T[] {
  const notOver = (e: T) => eventPhase(e, now) !== "past";
  const horizon = now.getTime() + FEATURED_HORIZON_DAYS * 86_400_000;
  const chosen: T[] = [];
  const seen = new Set<string>();
  const take = (e: T) => {
    if (chosen.length >= limit || seen.has(e.id)) return;
    seen.add(e.id);
    chosen.push(e);
  };
  featured
    .filter((e) => notOver(e) && eventBounds(e).start.getTime() <= horizon)
    .sort(byStart)
    .slice(0, FEATURED_MAX)
    .forEach(take);
  nearest.filter(notOver).sort(byStart).forEach(take);
  return chosen.sort(byStart);
}
