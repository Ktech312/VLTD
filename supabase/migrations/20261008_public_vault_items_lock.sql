-- STEP 2 of 2: run this ONLY after step 1 is done and the public pages have been checked.
-- It removes the old rule that let any signed-in person read every column of other people's public items.
-- After this, other people's public items can only be read through public_vault_items (public columns only).
-- Your own items are not affected: you still read and edit all of your own, in every profile you own.
--
-- UNDO (only if public pages break):
--   create policy "vault_items_read_public" on public.vault_items for select using (is_public = true);

drop policy if exists "vault_items_read_public" on public.vault_items;
