-- ─────────────────────────────────────────────────────────────
-- user_roles: admin role assignments (owner is env-var only)
-- Owner email: eck1679@gmail.com (hardcoded in RLS only)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null default 'admin' check (role in ('admin')),
  granted_by  text,
  granted_at  timestamptz default now()
);

alter table public.user_roles enable row level security;

-- Owner can read, insert, update, delete any row
create policy "owner_full_access" on public.user_roles
  for all to authenticated
  using  ((auth.jwt() ->> 'email') = 'eck1679@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'eck1679@gmail.com');

-- Any authenticated user can read their own row (to check their own role)
create policy "self_read" on public.user_roles
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));
