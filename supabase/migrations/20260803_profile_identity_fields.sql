-- Real, backend-saved identity fields for the /user/profile ("Edit public
-- profile") screen. These were previously local-only (localStorage, never
-- synced) -- date of birth / age verification / marketing opt-in had no
-- backend column at all. Self-declared age check (user-entered DOB), not
-- government ID verification.

alter table public.profiles
  add column if not exists date_of_birth  date,
  add column if not exists age_verified   boolean not null default false,
  add column if not exists marketing_opt_in boolean not null default true;
