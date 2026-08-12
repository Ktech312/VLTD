-- ─────────────────────────────────────────────────────────────
-- Vault item brand/manufacturer/publisher
--
-- Was only captured per-universe (comicPublisher for comics, vinylLabel
-- for vinyl) or not at all -- a video game's box, a comic's indicia, a
-- trading card's manufacturer (Nintendo, Marvel/DC, Topps) all have one,
-- and the AI vision scan + generic UPC lookup were both already returning
-- this data, it just had nowhere to go and got silently discarded. This is
-- that missing universal field, also useful for the cross-category
-- search/"Halls" builder (a search for "Nintendo" should be able to find
-- this the same way a search for a tag does).
--
-- Safe to re-run (idempotent). Local-only until this migration is run in
-- Supabase -- src/lib/vaultCloud.ts's row map does NOT reference this
-- column yet on purpose (an unknown column makes the vault_items upsert
-- throw for every synced item, not just this field) -- wire that up only
-- after confirming this migration ran successfully.
-- ─────────────────────────────────────────────────────────────

alter table public.vault_items
  add column if not exists brand text;
