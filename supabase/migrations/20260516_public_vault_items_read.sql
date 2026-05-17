drop policy if exists "Public vault items are readable" on vault_items;
create policy "Public vault items are readable"
  on vault_items for select
  using (is_public = true);
