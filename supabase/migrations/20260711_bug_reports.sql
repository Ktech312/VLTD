-- Beta bug / feedback reports submitted from the in-app floating reporter.

create table if not exists public.bug_reports (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid,
  email          text,
  message        text        not null,
  screenshot_url text,
  page_path      text,
  user_agent     text,
  status         text        not null default 'open',
  created_at     timestamptz not null default now()
);

create index if not exists idx_bug_reports_created on public.bug_reports (created_at desc);
create index if not exists idx_bug_reports_status  on public.bug_reports (status);

alter table public.bug_reports enable row level security;

-- Any signed-in user can file a report.
create policy "auth insert bug_reports"
  on public.bug_reports for insert
  to authenticated
  with check (true);

-- Users can read their own reports; admins read everything via the service role
-- (which bypasses RLS), same pattern as the beta waitlist.
create policy "read own bug_reports"
  on public.bug_reports for select
  to authenticated
  using (user_id = auth.uid());

-- Screenshot storage bucket (public read so admins can view the images by URL).
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', true)
on conflict (id) do nothing;

-- Signed-in users may upload screenshots into that bucket.
create policy "auth upload bug screenshots"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bug-screenshots');
