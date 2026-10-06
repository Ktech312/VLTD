-- ─────────────────────────────────────────────────────────────
-- Vault item public description
--
-- A short description the owner writes for an item. It is the text shown
-- when an item is shared or appears on a public surface (share link, public
-- profile, guest museum). It is separate from `notes`, which stays private
-- to the owner.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

alter table public.vault_items
  add column if not exists description text;
