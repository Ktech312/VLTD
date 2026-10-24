-- 9: Wishlist, Pull List and Following (one package). Safe to run more than once. Changes no existing row's data.
--
-- 1. wishlist gets the fields a want needs: quantity and how many are in the Vault, series, edition, release window, source link, shop, category details,
--    skipped time, the Vault records created on Acquired, the Following rule that added it, its source identity, which fields the person edited, and the
--    expected price. All have defaults, so every existing row keeps working exactly as it is.
-- 2. Status widens from (want, preordered) to (want, preordered, acquired, skipped). Skipped keeps the row; nothing is deleted.
-- 3. One row per source identity per profile (e.g. 'metron:issue:181794'), so a refresh can never add the same release twice.
-- 4. pull_rules: the Following rules (a comic series now; card product and toy line rules are manual). Only the owner of the profile can read or change them.
-- 5. wishlist_shares gets per-field switches (titles are always shared; quantities, dates, prices, notes and shops are off until switched on), and the public
--    read function returns only what is switched on, and only open wants.

-- ── 1. Want fields ───────────────────────────────────────────────────
alter table public.wishlist add column if not exists quantity          integer     not null default 1;
alter table public.wishlist add column if not exists quantity_acquired integer     not null default 0;
alter table public.wishlist add column if not exists series            text;
alter table public.wishlist add column if not exists edition           text;
alter table public.wishlist add column if not exists release_window    text;
alter table public.wishlist add column if not exists source_url        text;
alter table public.wishlist add column if not exists shop              text;
alter table public.wishlist add column if not exists details           jsonb;
alter table public.wishlist add column if not exists skipped_at        timestamptz;
alter table public.wishlist add column if not exists acquired_item_ids text[]      not null default '{}';
alter table public.wishlist add column if not exists rule_id           text;
alter table public.wishlist add column if not exists source_identity   text;
alter table public.wishlist add column if not exists edited            text[]      not null default '{}';
alter table public.wishlist add column if not exists expected_price    numeric(12,2);
alter table public.wishlist add column if not exists updated_at        timestamptz not null default now();

alter table public.wishlist drop constraint if exists wishlist_quantity_check;
alter table public.wishlist add constraint wishlist_quantity_check check (quantity between 1 and 99);
alter table public.wishlist drop constraint if exists wishlist_quantity_acquired_check;
alter table public.wishlist add constraint wishlist_quantity_acquired_check check (quantity_acquired >= 0 and quantity_acquired <= quantity);
alter table public.wishlist drop constraint if exists wishlist_expected_price_check;
alter table public.wishlist add constraint wishlist_expected_price_check check (expected_price is null or expected_price >= 0);

-- ── 2. Status ───────────────────────────────────────────────────────
alter table public.wishlist drop constraint if exists wishlist_status_check;
alter table public.wishlist add constraint wishlist_status_check check (status in ('want', 'preordered', 'acquired', 'skipped'));

-- ── 3. One row per source identity ──────────────────────────────────────
-- Existing catalog picks (source 'metron') get their identity filled in so a refresh recognises them as already there.
update public.wishlist
   set source_identity = 'metron:issue:' || external_id
 where source = 'metron' and external_id is not null and source_identity is null;

create unique index if not exists wishlist_profile_identity_uidx
  on public.wishlist(profile_id, source_identity)
  where source_identity is not null;

-- ── 4. Following rules ─────────────────────────────────────────────────
create table if not exists public.pull_rules (
  id              text primary key,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('comic_series', 'card_product', 'toy_line')),
  name            text not null,
  publisher       text,
  year_began      integer,
  source          text not null default 'manual' check (source in ('metron', 'manual')),
  source_key      text,
  quantity        integer not null default 1 check (quantity between 1 and 99),
  format_note     text,
  state           text not null default 'following' check (state in ('following', 'paused', 'stopped')),
  created_at      timestamptz not null default now(),
  last_checked_at timestamptz,
  last_result     text
);
create index if not exists pull_rules_profile_idx on public.pull_rules(profile_id);
alter table public.pull_rules enable row level security;

drop policy if exists "Owners manage their pull rules - select" on public.pull_rules;
create policy "Owners manage their pull rules - select"
  on public.pull_rules for select
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "Owners manage their pull rules - insert" on public.pull_rules;
create policy "Owners manage their pull rules - insert"
  on public.pull_rules for insert
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "Owners manage their pull rules - update" on public.pull_rules;
create policy "Owners manage their pull rules - update"
  on public.pull_rules for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists "Owners manage their pull rules - delete" on public.pull_rules;
create policy "Owners manage their pull rules - delete"
  on public.pull_rules for delete
  using (profile_id in (select id from public.profiles where user_id = auth.uid()));

revoke all on public.pull_rules from anon;
grant select, insert, update, delete on public.pull_rules to authenticated;

-- ── 5. Sharing: what a public link may show ────────────────────────────
alter table public.wishlist_shares add column if not exists fields jsonb not null default '{"titles": true}'::jsonb;

drop policy if exists "Owners manage their wishlist share - update" on public.wishlist_shares;
create policy "Owners manage their wishlist share - update"
  on public.wishlist_shares for update
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- The public read. Title, picture, category, series, edition and status are always returned (that is what a shared list is). Everything else is NULL unless the
-- owner switched it on: quantities, release dates and windows, expected prices, shops, notes. Skipped and fully acquired wants are never returned.
drop function if exists public.get_shared_wishlist(text);
create function public.get_shared_wishlist(p_token text)
returns table (
  owner_name     text,
  title          text,
  image_url      text,
  universe       text,
  category       text,
  subject        text,
  series         text,
  edition        text,
  release_date   date,
  release_window text,
  quantity       integer,
  price          numeric,
  shop           text,
  notes          text,
  status         text,
  source         text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.display_name, w.title, w.image_url, w.universe, w.category, w.subject, w.series, w.edition,
         case when coalesce(s.fields->>'dates', 'false') = 'true' then w.release_date end,
         case when coalesce(s.fields->>'dates', 'false') = 'true' then w.release_window end,
         case when coalesce(s.fields->>'quantities', 'false') = 'true' then greatest(w.quantity - w.quantity_acquired, 0) end,
         case when coalesce(s.fields->>'prices', 'false') = 'true' then w.expected_price end,
         case when coalesce(s.fields->>'shops', 'false') = 'true' then w.shop end,
         case when coalesce(s.fields->>'notes', 'false') = 'true' then w.notes end,
         w.status, w.source, w.created_at
  from public.wishlist_shares s
  join public.profiles pr on pr.id = s.profile_id
  join public.wishlist w on w.profile_id = s.profile_id
  where s.token = p_token
    and w.status in ('want', 'preordered')
    and w.quantity_acquired < w.quantity
  order by w.release_date nulls last, w.created_at desc;
$$;

grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
