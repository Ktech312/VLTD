-- Seasonal theme calendar
create table if not exists public.seasonal_themes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                        -- "FIFA World Cup 2026"
  slug        text not null unique,                 -- "fifa-2026"
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  enabled     boolean not null default true,

  -- Visual: color palette
  accent_color      text,                           -- "#00A551"
  accent_secondary  text,                           -- "#003087"
  bg_tint           text,                           -- subtle overlay hex

  -- Visual: home banner
  banner_enabled    boolean not null default false,
  banner_heading    text,                           -- "FIFA World Cup is here!"
  banner_subtext    text,                           -- "Discover soccer card collections"
  banner_emoji      text,                           -- "⚽"
  banner_cta_label  text,                           -- "Explore Soccer Vaults"
  banner_cta_href   text,                           -- "/discover?category=soccer"

  -- Visual: featured category pin
  featured_category text,                           -- "Soccer" — pinned top of discover

  -- Visual: subtle accents
  accent_style      text default 'none',            -- 'none' | 'snowflakes' | 'confetti' | 'stars' | 'leaves'

  -- Meta
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Only admins can write; anyone can read active themes
alter table public.seasonal_themes enable row level security;

create policy "Public read active themes"
  on public.seasonal_themes for select
  using (enabled = true and now() between starts_at and ends_at);

create policy "Admin full access"
  on public.seasonal_themes for all
  using (
    exists (
      select 1 from public.user_roles
      where email = auth.email()
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where email = auth.email()
    )
  );

-- Grant explicit table access to roles (RLS alone is not enough)
grant select on public.seasonal_themes to anon;
grant all on public.seasonal_themes to authenticated;

-- Seed: a few example events
insert into public.seasonal_themes
  (name, slug, starts_at, ends_at, accent_color, accent_secondary,
   banner_enabled, banner_heading, banner_subtext, banner_emoji,
   banner_cta_label, banner_cta_href, featured_category, accent_style)
values
  ('FIFA World Cup 2026', 'fifa-2026',
   '2026-06-11 00:00:00+00', '2026-07-19 23:59:59+00',
   '#00A551', '#003087', true,
   'FIFA World Cup 2026', 'Discover the hottest soccer card collections',
   '⚽', 'Explore Soccer Vaults', '/discover?category=Soccer', 'Soccer', 'confetti'),

  ('Christmas 2026', 'christmas-2026',
   '2026-12-01 00:00:00+00', '2026-12-26 23:59:59+00',
   '#C41E3A', '#165B33', true,
   'Happy Holidays from VLTD', 'Share your collection with the people you love',
   '🎄', 'See Holiday Collections', '/discover', null, 'snowflakes'),

  ('Halloween 2026', 'halloween-2026',
   '2026-10-01 00:00:00+00', '2026-11-01 23:59:59+00',
   '#FF6B00', '#1A0A2E', true,
   'Trick or Treat', 'Horror, comics, and dark collectibles await',
   '🎃', 'Explore Spooky Vaults', '/discover', null, 'leaves');
