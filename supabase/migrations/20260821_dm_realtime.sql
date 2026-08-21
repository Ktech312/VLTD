-- EK: "still not getting messages back and forth on the message screen
-- without having to leave the page" -- the open conversation thread and
-- the inbox list only ever fetched once (on click / on load), with no
-- live update when a new message arrives while you're already looking at
-- it. Same fix already used for auction bids/items (see
-- 20260610_auction_bids.sql) -- enable Postgres realtime on direct_messages
-- and conversations so the client can subscribe instead of requiring a
-- manual reload.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END
$$;
