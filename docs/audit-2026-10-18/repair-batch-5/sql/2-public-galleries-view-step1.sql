-- RC-05, file 2 of 3 (STEP 1 of 2 for the profile id). A public view of exhibitions. Run before file 3.
--
-- FOUND 2026-10-20: reading a public exhibition row as a signed-out visitor returns profile_id even when the exhibition uses an alias,
-- so the hidden curator can be looked up. This view is what public pages will read instead: same columns, but profile_id is NULL
-- for an exhibition with alias_enabled. It adds no new information (every column is one a visitor can already read from the table today).
--
-- The site is changed to use this view as soon as it exists and keeps working without it (it falls back to the table), so the order of
-- deploy and SQL does not matter. Changes no data and no permissions on the table. Safe to run more than once.
--
-- UNDO: drop view if exists public.public_galleries;

create or replace view public.public_galleries as
select
  g.id,
  case when g.alias_enabled then null else g.profile_id end as profile_id,
  g.title, g.description, g.visibility, g.state, g.cover_image, g.layout, g.exhibition_layout, g.public_token,
  g.analytics_views, g.analytics_last_viewed_at, g.created_at, g.updated_at,
  g.alias_enabled, g.alias_name, g.alias_avatar, g.item_notes, g.analytics_unique_view_keys
from public.galleries g
where g.visibility = 'PUBLIC' and g.state = 'ACTIVE';

grant select on public.public_galleries to anon, authenticated;
