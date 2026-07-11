-- Add a consent timestamp to the beta waitlist so we retain a record that the
-- applicant agreed to the Beta Testing Terms before requesting access.

alter table public.beta_waitlist
  add column if not exists consented_at timestamptz;
