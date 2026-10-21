-- UNDO for step 4: restore the public read rules on galleries and gallery_items exactly as 20260601 / 20260823 defined them.
begin;

drop policy if exists "Public galleries are readable" on public.galleries;
create policy "Public galleries are readable"
  on public.galleries for select
  using (visibility = 'PUBLIC' AND state = 'ACTIVE');

drop policy if exists "gallery_items_read_public" on public.gallery_items;
create policy "gallery_items_read_public" on public.gallery_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.galleries g
    where g.id = gallery_items.gallery_id
      and g.visibility = 'PUBLIC' and g.state = 'ACTIVE'
  ));

drop function if exists public.gallery_is_publicly_listed(text);

commit;
