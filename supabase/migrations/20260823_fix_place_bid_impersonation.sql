-- Fixes a real, confirmed hole: place_bid() (20260610_auction_bids.sql)
-- is SECURITY DEFINER and never checked that p_bidder was actually the
-- caller (auth.uid()) — it just inserted whatever bidder id it was
-- given. The bids table's own "bids_insert_own" RLS policy
-- (auth.uid() = bidder_id) doesn't protect against this: SECURITY
-- DEFINER functions run with the function owner's privileges and bypass
-- RLS for the operations they perform internally, so that policy never
-- actually applied to bids placed through this function. The real app
-- (src/lib/auctionLib.ts) always passes the caller's own id honestly,
-- but nothing stopped a direct API/RPC call from placing a bid under
-- someone else's identity.
--
-- CREATE OR REPLACE FUNCTION keeps the same signature/return type, so
-- every existing caller keeps working unchanged — only the missing
-- identity check is added, at the very top before any other work.

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
  IF auth.uid() IS NULL OR p_bidder IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only place bids as yourself';
  END IF;

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
