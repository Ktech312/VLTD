-- One wishlist per profile, saved to the account, that can be shared.
--   1. wishlist gets the fields a catalog pick needs (cover, release date,
--      where it came from) and a Want / Pre-ordered status.
--   2. Comics already marked Want / Ordered on Upcoming Comics (comic_wishlist,
--      saved per login) are copied into each login's Personal profile wishlist.
--   3. A share link per profile (wishlist_shares) and a read-only function the
--      public share page uses, returning only safe columns (no notes, no prices).
-- Safe to run more than once.

-- ── 1. Catalog fields ────────────────────────────────────────────────
alter table public.wishlist add column if not exists image_url    text;
alter table public.wishlist add column if not exists source       text not null default 'manual';
alter table public.wishlist add column if not exists external_id  text;
alter table public.wishlist add column if not exists release_date date;
alter table public.wishlist add column if not exists status       text not null default 'want';

alter table public.wishlist drop constraint if exists wishlist_status_check;
alter table public.wishlist add constraint wishlist_status_check
  check (status in ('want', 'preordered'));

-- One row per catalog item per profile (e.g. source 'metron', external_id '181794').
create unique index if not exists wishlist_profile_external_uidx
  on public.wishlist(profile_id, source, external_id)
  where external_id is not null;

-- ── 2. Move saved Upcoming Comics picks in ──────────────────────────
insert into public.wishlist (id, profile_id, title, universe, category, image_url, source, external_id, release_date, status, created_at)
select
  'metron_' || cw.metron_id || '_' || left(p.id::text, 8),
  p.id,
  trim(cw.series || ' #' || coalesce(cw.number, '')),
  'POP_CULTURE',
  'Comics',
  cw.image_url,
  'metron',
  cw.metron_id::text,
  case when cw.store_date ~ '^\d{4}-\d{2}-\d{2}' then left(cw.store_date, 10)::date end,
  case when cw.status = 'preordered' then 'preordered' else 'want' end,
  coalesce(cw.added_at, now())
from public.comic_wishlist cw
join lateral (
  select pr.id from public.profiles pr
  where pr.user_id = cw.user_id
  order by (pr.profile_type = 'personal') desc, pr.id
  limit 1
) p on true
where coalesce(cw.status, 'want') in ('want', 'preordered')
on conflict do nothing;

-- ── 3. Share link ───────────────────────────────────────────────────
create table if not exists public.wishlist_shares (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now()
);
alter table public.wishlist_shares enable row level security;

drop policy if exists "Owners manage their wishlist share - select" on public.wishlist_shares;
create policy "Owners manage their wishlist share - select"
  on public.wishlist_shares for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "Owners manage their wishlist share - insert" on public.wishlist_shares;
create policy "Owners manage their wishlist share - insert"
  on public.wishlist_shares for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "Owners manage their wishlist share - delete" on public.wishlist_shares;
create policy "Owners manage their wishlist share - delete"
  on public.wishlist_shares for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- Public read for the share page: whitelisted columns only.
create or replace function public.get_shared_wishlist(p_token text)
returns table (
  owner_name   text,
  title        text,
  image_url    text,
  universe     text,
  category     text,
  subject      text,
  release_date date,
  status       text,
  source       text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.display_name, w.title, w.image_url, w.universe, w.category, w.subject,
         w.release_date, w.status, w.source, w.created_at
  from public.wishlist_shares s
  join public.profiles pr on pr.id = s.profile_id
  join public.wishlist w on w.profile_id = s.profile_id
  where s.token = p_token
  order by w.release_date nulls last, w.created_at desc;
$$;

grant execute on function public.get_shared_wishlist(text) to anon, authenticated;

-- Owner name even when the shared list is empty.
create or replace function public.get_shared_wishlist_owner(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pr.display_name
  from public.wishlist_shares s
  join public.profiles pr on pr.id = s.profile_id
  where s.token = p_token
  limit 1;
$$;

grant execute on function public.get_shared_wishlist_owner(text) to anon, authenticated;

-- ── 4. Items added from a catalog (Upcoming Comics "Own") ───────────
-- "source:id", e.g. "metron:181794", so the app knows you already own it.
-- Until this runs, vault sync skips the column and everything else saves.
alter table public.vault_items add column if not exists catalog_ref text;
create index if not exists vault_items_catalog_ref_idx
  on public.vault_items(profile_id, catalog_ref)
  where catalog_ref is not null;
