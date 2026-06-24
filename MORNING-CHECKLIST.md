# Morning Checklist — Built Overnight

## What's New

- `/events` — Collector events discovery page with filter tabs (All / Local / National / Intl / Past), countdown badges, featured highlights. 4 events seeded: SD Card Show, The National, San Diego Comic-Con, NAMM (past).
- `/registry` — Vault Registry global leaderboard. Calls `get_top_subjects()` RPC, shows collector count + item count per subject, search box, links to subject detail pages.
- `/registry/[subject]` — Per-subject leaderboard. Calls `get_subject_leaderboard()` RPC, shows ranked collectors with sample item thumbnails and share button.
- `/market` — VLTD Marketplace. Fetches `vault_items` where status = FOR_SALE, universe filter tabs, sort (recent / price asc / price desc), search, grading service chips, seller info.
- `SeasonalBanner` — Rotates multiple active themes every 35s. Optional "Apply this theme's colors?" prompt per banner.
- `UpcomingEventsWidget` — Shows next 2 featured events on the home dashboard sidebar.
- `SocialExportSheet` — Full canvas social export with aspect ratio picker (1:1 / 4:5 / 9:16 / 16:9), background picker, hashtag generation, video support, PNG download.
- Nav — Events icon + link added to TopNav.

---

## Step 1: Run Migrations in Supabase SQL Editor

Go to: **https://supabase.com → your project → SQL Editor → New query**

Run Migration A first, then Migration B.

---

### Migration A — Collector Events Table

```sql
create table if not exists public.collector_events (
  id              uuid        primary key default gen_random_uuid(),
  slug            text        not null unique,
  name            text        not null,
  short_desc      text,
  long_desc       text,
  event_type      text        not null default 'national' check (event_type in ('local','national','international')),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  venue_name      text,
  venue_address   text,
  city            text,
  state_region    text,
  country         text        not null default 'US',
  website_url     text,
  ticket_url      text,
  admission       text,
  emoji           text        default '🎪',
  relevant_universes text[],
  theme_slug      text,
  enabled         boolean     not null default true,
  is_featured     boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.collector_events enable row level security;

create policy "Anyone can read enabled events"
  on public.collector_events for select using (enabled = true);

grant select on public.collector_events to anon, authenticated;

insert into public.collector_events
  (slug,name,short_desc,long_desc,event_type,starts_at,ends_at,venue_name,venue_address,city,state_region,website_url,ticket_url,admission,emoji,relevant_universes,is_featured,enabled)
values
('sd-card-show-june-2026','SD Card Show — June 2026','Local trading card show in San Diego','Buy, sell, and trade all types of trading cards at this San Diego area show. Features dealers, exhibitors, and collectors from across the region.','local','2026-06-28T10:00:00-07:00','2026-06-28T18:00:00-07:00','DoubleTree by Hilton Hotel San Diego - Mission Valley','7450 Hazard Center Dr','San Diego','CA','https://www.eventbrite.com/e/sd-card-show-june-28th-tickets-1991007596317','https://www.eventbrite.com/e/sd-card-show-june-28th-tickets-1991007596317','Free','🃏',ARRAY['sports_cards','tcg'],false,true),

('national-sports-collectors-convention-2026','The National — 46th NSCC','The premier trading card & memorabilia event in the world','The 46th National Sports Collectors Convention spans over 600,000 square feet and features hundreds of corporate sponsors, public autograph signings from Hall of Famers and superstar athletes, and top dealers buying, selling, and trading. Sports cards, non-sports cards, autographs, unopened wax, and game-used memorabilia.','national','2026-07-29T10:00:00-05:00','2026-08-02T16:00:00-05:00','Donald E. Stephens Convention Center','5555 N River Rd','Rosemont','IL','https://www.nsccshow.com','https://www.nsccshow.com','Varies by day','🏟️',ARRAY['sports_cards','tcg','comics'],true,true),

('san-diego-comic-con-2026','San Diego Comic-Con 2026','The 56th annual pop-culture event','SDCC 2026 features the return of Marvel Studios to Hall H, hundreds of panels, exclusive merchandise drops, and after-parties across the Gaslamp Quarter. Preview Night July 22. Single-day passes $85 adults / $43 juniors; Sunday $64 adults.','national','2026-07-22T18:00:00-07:00','2026-07-26T21:00:00-07:00','San Diego Convention Center','111 W Harbor Dr','San Diego','CA','https://www.comic-con.org/cc/','https://www.comic-con.org/cc/badges/open-registration/','$85 adults / $43 juniors','🦸',ARRAY['comics','toys','games'],true,true),

('namm-show-2026','NAMM Show 2026 (Past)','125th anniversary global music products convention','The 2026 NAMM Show marked the 125th anniversary of the global music products association, bringing together thousands of professionals, artists, and creators to showcase the latest innovations in instruments and pro-audio.','national','2026-01-20T09:00:00-08:00','2026-01-24T18:00:00-08:00','Anaheim Convention Center','800 W Katella Ave','Anaheim','CA','https://www.namm.org/thenammshow',null,'Varies','🎸',ARRAY['vinyl'],false,true);
```

---

### Migration B — Vault Registry RPCs

```sql
create or replace function public.get_subject_leaderboard(p_subject text, p_limit int default 25)
returns table(rank bigint, profile_id text, username text, display_name text, item_count bigint, avatar_emoji text)
language sql security definer stable as $$
  select
    row_number() over (order by count(*) desc) as rank,
    p.id::text as profile_id,
    p.username, p.display_name,
    count(*) as item_count,
    p.avatar_emoji
  from public.vault_items vi
  join public.profiles p on p.id::text = vi.profile_id
  where lower(vi.subject) = lower(p_subject)
    and (vi.is_deleted is null or vi.is_deleted = false)
    and p.is_public = true
  group by p.id, p.username, p.display_name, p.avatar_emoji
  order by count(*) desc
  limit p_limit;
$$;
grant execute on function public.get_subject_leaderboard to anon, authenticated;

create or replace function public.get_top_subjects(p_limit int default 50)
returns table(subject text, collector_count bigint, total_items bigint)
language sql security definer stable as $$
  select lower(vi.subject) as subject,
    count(distinct vi.profile_id) as collector_count,
    count(*) as total_items
  from public.vault_items vi
  where vi.subject is not null and vi.subject != ''
    and (vi.is_deleted is null or vi.is_deleted = false)
  group by lower(vi.subject)
  order by count(distinct vi.profile_id) desc
  limit p_limit;
$$;
grant execute on function public.get_top_subjects to anon, authenticated;
```

---

## Step 2: Check these URLs after migrations

- `/events` — should show 3 upcoming + 1 past (NAMM in Past tab)
- `/registry` — will be empty until vault items have subjects tagged
- `/market` — will be empty until items are marked FOR_SALE
- Home dashboard — Upcoming Events widget shows next 2 featured events

## Step 3: Create event themes (optional)

In `/admin/themes`, create a seasonal theme for each upcoming event if you want custom accent colors when that event's banner rotates into view. Match the theme's `slug` to the event's `theme_slug` column. The SeasonalBanner rotates all active themes automatically every 35 seconds.

---

## Notes

- All pages are `"use client"` components — no auth required for public data
- Market listings link to `/v/[profile_id]` for seller contact (no payments through VLTD)
- Registry leaderboard only shows public profiles (`is_public = true`)
- SocialExportSheet is accessed from the vault item detail sheet via the Share button
