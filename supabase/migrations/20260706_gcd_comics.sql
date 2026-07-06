-- ─────────────────────────────────────────────────────────────
-- GCD comic reference data (English-language subset)
-- Public, read-only lookup tables sourced from the Grand Comics
-- Database SQLite dump, trimmed to series / issue / publisher.
-- Loaded via scripts/gcd-load-supabase.js.
-- ─────────────────────────────────────────────────────────────

-- Fast fuzzy text search on names
create extension if not exists pg_trgm;

create table if not exists public.gcd_publisher (
  id          integer primary key,
  name        text,
  country_id  integer,
  year_began  integer,
  year_ended  integer
);

create table if not exists public.gcd_series (
  id                     integer primary key,
  name                   text,
  sort_name              text,
  year_began             integer,
  year_ended             integer,
  publisher_id           integer,
  language_id            integer,
  is_comics_publication  integer,
  issue_count            integer
);

create table if not exists public.gcd_issue (
  id                integer primary key,
  number            text,
  series_id         integer,
  publication_date  text,
  key_date          text,
  on_sale_date      text,
  price             text,
  page_count        numeric,
  isbn              text,
  valid_isbn        text,
  barcode           text,
  title             text,
  notes             text,
  variant_of_id     integer,
  variant_name      text
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_series_name_trgm     on public.gcd_series    using gin (name gin_trgm_ops);
create index if not exists idx_publisher_name_trgm  on public.gcd_publisher using gin (name gin_trgm_ops);
create index if not exists idx_series_publisher     on public.gcd_series (publisher_id);
create index if not exists idx_issue_series         on public.gcd_issue (series_id);
create index if not exists idx_issue_number         on public.gcd_issue (number);
create index if not exists idx_issue_barcode        on public.gcd_issue (barcode);
create index if not exists idx_issue_valid_isbn     on public.gcd_issue (valid_isbn);

-- ── Flattened search view (security_invoker → base-table RLS applies) ──
create or replace view public.gcd_comic_search
  with (security_invoker = true) as
select
  i.id,
  s.name        as series,
  s.sort_name   as series_sort,
  i.number,
  p.name        as publisher,
  i.publication_date,
  i.on_sale_date,
  i.key_date    as cover_date,
  i.page_count,
  i.price,
  i.isbn,
  i.valid_isbn,
  i.barcode,
  i.notes,
  i.variant_name
from public.gcd_issue i
join public.gcd_series s    on i.series_id = s.id
join public.gcd_publisher p on s.publisher_id = p.id;

-- ── RLS: public read-only reference data ─────────────────────
alter table public.gcd_publisher enable row level security;
alter table public.gcd_series    enable row level security;
alter table public.gcd_issue     enable row level security;

drop policy if exists "gcd_publisher public read" on public.gcd_publisher;
drop policy if exists "gcd_series public read"    on public.gcd_series;
drop policy if exists "gcd_issue public read"     on public.gcd_issue;

create policy "gcd_publisher public read" on public.gcd_publisher for select to anon, authenticated using (true);
create policy "gcd_series public read"    on public.gcd_series    for select to anon, authenticated using (true);
create policy "gcd_issue public read"     on public.gcd_issue     for select to anon, authenticated using (true);

grant select on public.gcd_publisher     to anon, authenticated;
grant select on public.gcd_series        to anon, authenticated;
grant select on public.gcd_issue         to anon, authenticated;
grant select on public.gcd_comic_search  to anon, authenticated;
