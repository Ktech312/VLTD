-- Tracks how a vault item actually entered the vault, so the Activity feed
-- can say "Item scanned" only when that's literally true, instead of
-- claiming every item was scanned regardless of how it was added.
--
-- Existing rows get NULL (unknown origin — predates this column). The
-- Activity feed treats NULL as a generic "Added to inventory", never as a
-- guessed "scanned".

alter table public.vault_items
  add column if not exists added_via text;
