-- Migration: 20260610_auction_bids.sql
-- Adds auction columns to vault_items and creates the bids table.

-- ─── 1. Extend vault_items with auction columns ─────────────────────────────

ALTER TABLE vault_items
  ADD COLUMN IF NOT EXISTS auction_status         TEXT    CHECK (auction_status IN ('ACTIVE','ENDED','CANCELLED')),
  ADD COLUMN IF NOT EXISTS auction_ends_at        BIGINT,          -- unix ms
  ADD COLUMN IF NOT EXISTS auction_starting_bid   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS reserve_price          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS buy_it_now_price       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auction_current_bid    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS auction_bid_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_winner_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index: quickly find active auctions sorted by end time
CREATE INDEX IF NOT EXISTS idx_vault_items_auction_active
  ON vault_items (auction_ends_at ASC)
  WHERE status = 'AUCTION' AND auction_status = 'ACTIVE';

-- ─── 2. Create bids table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bids (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     TEXT    NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
  bidder_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_item_id     ON bids (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder_id   ON bids (bidder_id);

-- ─── 3. Function: place a bid (atomic; enforces min-increment) ───────────────

CREATE OR REPLACE FUNCTION place_bid(
  p_item_id  TEXT,
  p_bidder   UUID,
  p_amount   NUMERIC
) RETURNS bids
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item   vault_items%ROWTYPE;
  v_min    NUMERIC;
  v_bid    bids%ROWTYPE;
BEGIN
  -- Lock the row so concurrent bids serialise here
  SELECT * INTO v_item FROM vault_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  IF v_item.status <> 'AUCTION' OR v_item.auction_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Auction is not active';
  END IF;

  IF (v_item.auction_ends_at IS NOT NULL) AND
     (v_item.auction_ends_at < EXTRACT(EPOCH FROM NOW()) * 1000) THEN
    RAISE EXCEPTION 'Auction has expired';
  END IF;

  v_min := COALESCE(v_item.auction_current_bid, v_item.auction_starting_bid, 0) + 1;
  IF p_amount < v_min THEN
    RAISE EXCEPTION 'Minimum bid is %', v_min;
  END IF;

  -- Insert bid
  INSERT INTO bids (item_id, bidder_id, amount)
  VALUES (p_item_id, p_bidder, p_amount)
  RETURNING * INTO v_bid;

  -- Update item counters
  UPDATE vault_items
  SET
    auction_current_bid = p_amount,
    auction_bid_count   = COALESCE(auction_bid_count, 0) + 1
  WHERE id = p_item_id;

  RETURN v_bid;
END;
$$;

-- ─── 4. Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Anyone can read bids (public auctions)
CREATE POLICY "bids_select_public"
  ON bids FOR SELECT
  USING (true);

-- Only authenticated users can insert their own bids (use place_bid function for safety,
-- but also allow direct insert so the client-side fallback works)
CREATE POLICY "bids_insert_own"
  ON bids FOR INSERT
  WITH CHECK (auth.uid() = bidder_id);

-- Bids are immutable — no updates or deletes by end users
CREATE POLICY "bids_no_update"
  ON bids FOR UPDATE
  USING (false);

CREATE POLICY "bids_no_delete"
  ON bids FOR DELETE
  USING (false);

-- ─── 5. Realtime publication ─────────────────────────────────────────────────

-- Enable realtime on bids so subscribeToAuctionItem / subscribeToBids work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;
END
$$;
