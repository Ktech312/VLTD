create table if not exists public.spotlights (
  id            uuid        primary key default gen_random_uuid(),
  type          text        not null check (type in ('collector','artist','brand')),
  name          text        not null,
  tagline       text,
  bio           text,
  image_url     text,
  universe_tags text[],
  link_url      text,
  link_label    text,
  is_featured   boolean     not null default false,
  sort_order    int         not null default 0,
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.spotlights enable row level security;

create policy "Public can read enabled spotlights"
  on public.spotlights for select using (enabled = true);

create policy "Admin full access spotlights"
  on public.spotlights for all
  using (exists (select 1 from public.user_roles where email = auth.email()))
  with check (exists (select 1 from public.user_roles where email = auth.email()));

grant select on public.spotlights to anon, authenticated;
grant all on public.spotlights to authenticated;
