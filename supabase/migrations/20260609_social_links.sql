-- Migration: add social_links to profiles
-- Run in Supabase SQL editor

alter table profiles
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists bio text default '',
  add column if not exists avatar_url text default '',
  add column if not exists banner_url text default '';

-- social_links shape:
-- {
--   "instagram": "username",
--   "twitter": "username",
--   "tiktok": "username",
--   "youtube": "channel",
--   "facebook": "username",
--   "whatnot": "username",
--   "ebay": "username",
--   "website": "https://...",
--   "linktree": "username"
-- }
