-- Beta waitlist / invite request table.
-- Collected from the public landing page before a user has an account.

create table if not exists public.beta_waitlist (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  note        text,
  source      text        not null default 'landing',
  created_at  timestamptz not null default now(),
  invited_at  timestamptz,
  constraint beta_waitlist_email_unique unique (email)
);

create index if not exists idx_beta_waitlist_email      on public.beta_waitlist (email);
create index if not exists idx_beta_waitlist_created    on public.beta_waitlist (created_at desc);
create index if not exists idx_beta_waitlist_invited    on public.beta_waitlist (invited_at);

alter table public.beta_waitlist enable row level security;

-- Anyone can insert their own email (no auth required — this is a pre-signup form).
create policy "Public insert beta_waitlist"
  on public.beta_waitlist for insert
  with check (true);

-- Nobody can read the waitlist from the client (admin only via service role).
create policy "No public read beta_waitlist"
  on public.beta_waitlist for select
  using (false);
