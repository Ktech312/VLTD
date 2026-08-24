-- collector_events never had anywhere to store a real photo -- every event
-- card, automated or manually added, fell back to the category-color
-- gradient placeholder. EK: "is there anyway to have it extract images to
-- fill in the boxes."
--
-- Safe to re-run (idempotent).

alter table public.collector_events
  add column if not exists image_url text;
