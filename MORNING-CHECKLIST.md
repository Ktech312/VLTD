# VLTD Morning Checklist — 2026-06-24

## Step 1 — Run Migration A: Collector Events

Paste into Supabase SQL Editor and run:

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

## Step 2 — Run Migration B: Vault Registry RPCs

Paste into Supabase SQL Editor and run:

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

## Step 3 — Deploy

```bash
git add -A && git commit -m "feat: events system, vault registry, marketplace, social export" && git push && npx vercel --prod
```

---

## Step 4 — New URLs to check after deploy

- `/events` — Upcoming Events page with Local / National / Past filter tabs and 4 seeded events
- `/registry` — Vault Registry subject leaderboard index (already existed, now has backup RPCs)
- `/market` — VLTD Marketplace (already existed, fully featured)

---

## Notes

- The Events nav item ("Events") was added to `TopNav.tsx` after "Discover" using a calendar `IconEvents` SVG
- An `UpcomingEventsWidget` was added to `HomeClient.tsx` showing the next 2 featured upcoming events with a "See all →" link to `/events`
- Social Export sheet (`SocialExportSheet.tsx`) and its "Share" button are already wired in `src/app/vault/item/[id]/page.tsx` — no new work needed
- Marketplace (`/market`) and Registry (`/registry`, `/registry/[subject]`) pages already fully existed with all features — migration B adds the two new RPCs (`get_subject_leaderboard`, `get_top_subjects`) as `create or replace` so they are safe to run even if earlier versions exist
- To add a new event later: insert a row into `collector_events` in the Supabase table editor
