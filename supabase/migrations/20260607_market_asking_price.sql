-- Add asking_price to vault_items for public marketplace
alter table vault_items
  add column if not exists asking_price numeric null;

-- Index for marketplace queries: public + for_sale
create index if not exists idx_vault_items_market
  on vault_items (status, is_public)
  where status = 'FOR_SALE' and is_public = true;
