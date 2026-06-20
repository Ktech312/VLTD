-- Allow anyone to read public galleries (visibility = PUBLIC, state = ACTIVE)
-- This is what powers the Discover page and public exhibition links.

alter table galleries enable row level security;

drop policy if exists "Public galleries are readable" on galleries;
create policy "Public galleries are readable"
  on galleries for select
  using (visibility = 'PUBLIC' AND state = 'ACTIVE');

drop policy if exists "Owners can manage their galleries" on galleries;
create policy "Owners can manage their galleries"
  on galleries for all
  using (auth.uid() = (
    select user_id from profiles where id = galleries.profile_id limit 1
  ))
  with check (auth.uid() = (
    select user_id from profiles where id = galleries.profile_id limit 1
  ));
