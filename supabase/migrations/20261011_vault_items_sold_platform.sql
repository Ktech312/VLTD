-- Where an item sold (eBay, Whatnot, in person, ...), so the Sold page can
-- show profit after that platform's seller fees. Safe to run more than once.
-- Until this runs, the app keeps saving everything else (sync skips the column).

alter table public.vault_items
  add column if not exists sold_platform text;
