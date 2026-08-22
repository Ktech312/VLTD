-- ─────────────────────────────────────────────────────────────
-- Vault item Type + Attributes
--
-- Real fields on VaultItem (itemType, itemAttributes) that /vault/add's
-- "Type" dropdown and "Attributes" checkboxes already write to locally --
-- but they were missing from vaultCloud.ts's row map, so cloud sync
-- silently dropped them on every save. This migration adds the matching
-- columns; the code fix (same commit) adds them to the upload/download
-- mapping, with the standard missing-column fallback so saves keep working
-- even before this migration is run.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

alter table public.vault_items
  add column if not exists item_type text,
  add column if not exists item_attributes text[] not null default '{}'::text[];
