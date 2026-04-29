create extension if not exists pgcrypto;

create table if not exists public.public_content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('gallery', 'item')),
  content_id text not null,
  reason text not null,
  details text,
  page_url text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.public_content_reports enable row level security;

drop policy if exists "Anyone can create public content reports" on public.public_content_reports;
create policy "Anyone can create public content reports"
  on public.public_content_reports
  for insert
  to anon, authenticated
  with check (true);

create index if not exists public_content_reports_content_idx
  on public.public_content_reports (content_type, content_id, created_at desc);

create index if not exists public_content_reports_status_idx
  on public.public_content_reports (status, created_at desc);
