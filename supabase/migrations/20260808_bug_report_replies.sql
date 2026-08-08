-- Lets an admin reply to a bug report and lets the reporter see the reply /
-- resolution status via their own Alerts feed. No new table, no email --
-- in-app only for now (per EK's call 2026-08-08).

alter table public.bug_reports
  add column if not exists admin_reply text,
  add column if not exists admin_replied_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Existing "read own bug_reports" policy (user_id = auth.uid()) already
-- covers these new columns -- no RLS change needed. Updates go through the
-- /api/admin/bugs route using the service-role client, which bypasses RLS,
-- same as the existing status-update path.
