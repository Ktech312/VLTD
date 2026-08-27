-- Two Gallery fields that existed in the app's TypeScript type and were
-- read from Supabase rows, but had nothing writing them (item_notes) or
-- syncing them at all (analytics_unique_view_keys) -- found in the same
-- 2026-08-27 audit as the vault_items field-sync migration. Purely
-- additive: nullable columns, no default, cannot affect any existing row.
alter table public.galleries add column if not exists item_notes jsonb;
alter table public.galleries add column if not exists analytics_unique_view_keys jsonb;
