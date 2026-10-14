-- A personal profile is created as soon as Step 1 of onboarding is accepted.
-- It remains marked incomplete until the collector finishes the remaining
-- setup screens. Existing profiles predate this flow and are complete.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default true;

comment on column public.profiles.onboarding_completed is
  'False only while the owner has saved Step 1 but has not finished onboarding.';
