-- Batch 11 SQL (RC-27, exhibition view counter): let a visitor's visit be counted.
-- The view counter never went up for visitors: the page tried to write to the exhibition row, which only the owner's team may do, and
-- the write was refused without a word. This adds one function that does only this: for a PUBLIC, ACTIVE exhibition it adds one view per
-- distinct viewer key (the browser's own random key), never counts the exhibition's own team, and keeps the keys on the server (they are
-- not returned to anyone). It changes nothing else. Safe to run again.
--
-- READ THIS ABOUT THE NUMBER: the count is APPROXIMATE and can be inflated. A "viewer key" is a random value the visitor's own browser makes up,
-- so anyone can call this function with made-up keys and raise an exhibition's counter, and the same person on a new browser or after clearing
-- site data counts again. It is a friendly "people looked at this" figure, not a measurement, and must not be used for ranking that matters,
-- payment or any claim to a third party. The function only ever touches the counter of a PUBLIC, ACTIVE exhibition; it cannot read or change
-- anything else.
-- ORDER: run this only after the old exhibitions-table read was closed (stage 4, done and verified 2026-10-21): the function reads that table
-- on the server's side, so it does not depend on the old open read rule.
begin;

create or replace function public.record_exhibition_view(p_gallery_id text, p_viewer_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.galleries%rowtype;
  keys jsonb;
begin
  if p_gallery_id is null or p_viewer_key is null or length(p_viewer_key) < 6 or length(p_viewer_key) > 128 then
    return;
  end if;

  select * into g from public.galleries
   where id::text = p_gallery_id and visibility = 'PUBLIC' and state = 'ACTIVE'
   for update;
  if not found then return; end if;

  -- the exhibition's own team looking at it is not a visit
  if public.is_profile_member(g.profile_id) then return; end if;

  keys := case when jsonb_typeof(g.analytics_unique_view_keys) = 'array' then g.analytics_unique_view_keys else '[]'::jsonb end;

  if keys ? p_viewer_key then
    update public.galleries set analytics_last_viewed_at = now() where id = g.id;
    return;
  end if;

  keys := keys || to_jsonb(p_viewer_key);
  if jsonb_array_length(keys) > 500 then
    select coalesce(jsonb_agg(v order by ord), '[]'::jsonb) into keys
      from (select v, ord from jsonb_array_elements(keys) with ordinality as t(v, ord) order by ord desc limit 500) q;
  end if;

  update public.galleries
     set analytics_views = coalesce(analytics_views, 0) + 1,
         analytics_unique_view_keys = keys,
         analytics_last_viewed_at = now()
   where id = g.id;
end;
$$;

revoke all on function public.record_exhibition_view(text, text) from public;
grant execute on function public.record_exhibition_view(text, text) to anon, authenticated;

commit;
