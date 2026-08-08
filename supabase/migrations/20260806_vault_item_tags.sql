-- ─────────────────────────────────────────────────────────────
-- Vault item tags
--
-- Free-form user tags for the cross-category search/"Halls" builder
-- (compound search across title/manufacturer/universe/category/tags) and
-- for social-export hashtag suggestions (SocialExportSheet.tsx already
-- generates hashtags on the fly, but never saved them anywhere -- this is
-- that missing persistent, searchable field).
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

alter table public.vault_items
  add column if not exists tags text[] not null default '{}'::text[];

-- GIN index so "does this item have tag X" / array-overlap search on tags
-- stays fast as vaults grow.
create index if not exists idx_vault_items_tags on public.vault_items using gin (tags);
