-- ─────────────────────────────────────────────────────────────
-- Business profile fields (Phase 2 signup)
-- Standard fields captured for business-type profiles. Nullable;
-- personal profiles simply leave them empty. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists business_type text;  -- dealer | gallery | brand | estate | other
alter table public.profiles add column if not exists website     text;
alter table public.profiles add column if not exists tax_id      text;     -- EIN / tax id (optional, private)
