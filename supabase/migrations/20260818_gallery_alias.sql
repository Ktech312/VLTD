-- Per-exhibition curator alias: hide the real curator name/avatar on a
-- specific exhibition's public page without affecting ownership, comment
-- moderation, or anything else (those stay keyed to galleries.profile_id).
alter table public.galleries
  add column if not exists alias_enabled boolean not null default false,
  add column if not exists alias_name text,
  add column if not exists alias_avatar text;
