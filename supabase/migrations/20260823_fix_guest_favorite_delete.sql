-- Fixes a real hole (rated low-severity by the audit — no PII, just a
-- favorite counter — but still a real "any anonymous caller can delete
-- any guest's data" gap): "Guests can remove favorites by anonymous id"
-- (20260429_public_favorites.sql) was
--   for delete using (user_id is null and nullif(anonymous_id,'') is not null)
-- — that predicate only checks the ROW's own shape, never anything the
-- caller actually supplied, so a bare DELETE with no anonymous_id filter
-- at all still satisfies it for every guest-favorited row that exists.
-- The app's real code (src/lib/favorites.ts) always filters on the
-- caller's own anonymous_id already, but RLS doesn't know that a filter
-- was even applied — a hand-crafted request skipping that filter could
-- wipe every guest favorite for a piece of content (or all of them).
--
-- True per-request identity verification isn't possible for anonymous
-- (no-auth) visitors without a bigger architecture change (a signed
-- anonymous session token) — an unsigned client-generated anonymous_id
-- can't be cryptographically checked by RLS. What IS achievable now:
-- remove the ability to delete MORE than the exact one row a caller
-- names, by routing guest deletes through a SECURITY DEFINER function
-- that takes the anonymous_id as an explicit parameter and deletes only
-- the single matching row — turning "wipe everything matching a broad
-- shape" into "delete exactly the row you named," which is what the
-- real app already only ever needed to do.

drop policy if exists "Guests can remove favorites by anonymous id" on public.public_favorites;

create or replace function public.unfavorite_as_guest(
  p_content_type text,
  p_content_id text,
  p_anonymous_id text
) returns void
language plpgsql
security definer
as $$
begin
  if p_anonymous_id is null or length(trim(p_anonymous_id)) = 0 then
    raise exception 'anonymous_id is required';
  end if;

  delete from public.public_favorites
  where content_type = p_content_type
    and content_id = p_content_id
    and anonymous_id = p_anonymous_id
    and user_id is null;
end;
$$;

grant execute on function public.unfavorite_as_guest(text, text, text) to anon, authenticated;

-- "Authenticated users can remove own favorites" (auth.uid() = user_id)
-- is untouched — signed-in users already have a real, verified identity
-- to check against, so that policy was correct as-is.
