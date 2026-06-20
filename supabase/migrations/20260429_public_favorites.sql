create table if not exists public.public_favorites (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('item', 'gallery')),
  content_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint public_favorites_identity_check check (user_id is not null or nullif(anonymous_id, '') is not null)
);

create unique index if not exists public_favorites_user_unique
  on public.public_favorites(content_type, content_id, user_id)
  where user_id is not null;

create unique index if not exists public_favorites_anon_unique
  on public.public_favorites(content_type, content_id, anonymous_id)
  where anonymous_id is not null;

create index if not exists public_favorites_content_idx
  on public.public_favorites(content_type, content_id, created_at desc);

create index if not exists public_favorites_user_idx
  on public.public_favorites(user_id, created_at desc)
  where user_id is not null;

create index if not exists public_favorites_anon_idx
  on public.public_favorites(anonymous_id, created_at desc)
  where anonymous_id is not null;

alter table public.public_favorites enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_favorites'
      and policyname = 'Public favorites are countable'
  ) then
    create policy "Public favorites are countable"
      on public.public_favorites
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_favorites'
      and policyname = 'Authenticated users can favorite content'
  ) then
    create policy "Authenticated users can favorite content"
      on public.public_favorites
      for insert
      with check (auth.uid() is not null and user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_favorites'
      and policyname = 'Guests can favorite public content'
  ) then
    create policy "Guests can favorite public content"
      on public.public_favorites
      for insert
      with check (user_id is null and nullif(anonymous_id, '') is not null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_favorites'
      and policyname = 'Authenticated users can remove own favorites'
  ) then
    create policy "Authenticated users can remove own favorites"
      on public.public_favorites
      for delete
      using (auth.uid() is not null and user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'public_favorites'
      and policyname = 'Guests can remove favorites by anonymous id'
  ) then
    create policy "Guests can remove favorites by anonymous id"
      on public.public_favorites
      for delete
      using (user_id is null and nullif(anonymous_id, '') is not null);
  end if;
end $$;
