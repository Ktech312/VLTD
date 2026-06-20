-- Migration: 20260610_vault_items_market_columns.sql
-- Adds asking_price and for-sale / auction columns to vault_items.
-- Run in Supabase SQL editor.

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS asking_price         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS status               TEXT,
  ADD COLUMN IF NOT EXISTS sold_price           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sold_at              BIGINT,
  ADD COLUMN IF NOT EXISTS is_public            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auction_status       TEXT    CHECK (auction_status IN ('ACTIVE','ENDED','CANCELLED')),
  ADD COLUMN IF NOT EXISTS auction_ends_at      BIGINT,
  ADD COLUMN IF NOT EXISTS auction_starting_bid NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS reserve_price        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS buy_it_now_price     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auction_current_bid  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auction_bid_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_winner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for market browse (items actively for sale)
CREATE INDEX IF NOT EXISTS idx_vault_items_for_sale
  ON vault_items (asking_price)
  WHERE status = 'FOR_SALE' AND is_public = TRUE;
