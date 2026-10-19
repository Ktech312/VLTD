# Proposal (NOT applied): atomic persistence for exhibition links and profile moves

Status: proposal only. Nothing here has been run. The shipped fixes (commits `31334e9`, `0b0904f`) do not depend on it: they make loading read-only, write the link rows additively (never fewer links than the exhibition should have), and move items cloud-first. This proposal only closes the remaining non-atomic windows. Per your rule, no workaround was built where a migration is the right fix; apply by hand as with earlier migrations, and link-only delivery as usual.

## What is still not atomic after the shipped fixes
1. **Link rows on an intentional save:** insert missing rows, then re-number positions row by row, then delete rows that no longer belong. A failure part-way leaves a harmless superset or an old order (never missing links), and the next save repairs it. It is not one transaction.
2. **Profile move:** the account confirms the item update first; the exhibitions are pruned afterwards by the app. If the browser is closed between those two steps the item is already in the other profile while the old exhibition still lists its id until the next prune. (It is hidden from view because the exhibition only shows its own profile's items; nothing is lost, but the stale id remains.)
3. **Exhibition layout JSON** (`galleries.layout` / `exhibition_layout`: item ids, sections, slot layout, public snapshots, notes) is rewritten by the app, not the database.

## Proposal 1: `replace_gallery_items` (one transaction for the link rows)
```sql
-- SECURITY INVOKER: row-level security of gallery_items still decides who may write.
create or replace function public.replace_gallery_items(p_gallery uuid, p_ids text[])
returns void
language plpgsql
security invoker
as $$
begin
  -- remove only rows that no longer belong (and duplicates), keep the first row per artifact
  delete from public.gallery_items gi
   where gi.gallery_id = p_gallery
     and (gi.artifact_id <> all (p_ids)
          or gi.id not in (select min(id) from public.gallery_items where gallery_id = p_gallery group by artifact_id));
  -- renumber what stays
  update public.gallery_items gi
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(artifact_id, ord)
   where gi.gallery_id = p_gallery and gi.artifact_id = o.artifact_id and gi.position is distinct from o.ord - 1;
  -- add what is missing
  insert into public.gallery_items (gallery_id, artifact_id, position)
  select p_gallery, o.artifact_id, o.ord - 1
    from unnest(p_ids) with ordinality as o(artifact_id, ord)
   where not exists (select 1 from public.gallery_items gi where gi.gallery_id = p_gallery and gi.artifact_id = o.artifact_id);
end;
$$;
grant execute on function public.replace_gallery_items(uuid, text[]) to authenticated;
```
App change: `syncGalleryItemsToSupabase` calls `supabase.rpc("replace_gallery_items", { p_gallery, p_ids })` instead of the three steps. Facts checked on production with a synthetic gallery: `gallery_items` has columns `id, gallery_id, position, artifact_id` and **no** uniqueness constraint (duplicates and equal positions were accepted), which is why the additive app-side plan is safe today. Adding `unique (gallery_id, artifact_id)` would be a sensible follow-up *after* this function exists and duplicates are cleaned up (needs a read-only duplicate check first).

## Proposal 2: `move_items_to_profile` (item move and link removal in one transaction)
```sql
create or replace function public.move_items_to_profile(p_ids text[], p_target uuid)
returns table (id text)
language plpgsql
security invoker
as $$
begin
  return query
  with moved as (
    update public.vault_items v
       set profile_id = p_target, is_public = false
     where v.id = any (p_ids) and v.profile_id <> p_target
    returning v.id
  ), unlinked as (
    delete from public.gallery_items gi using moved m where gi.artifact_id = m.id returning gi.id
  )
  select m.id from moved m;
end;
$$;
grant execute on function public.move_items_to_profile(text[], uuid) to authenticated;
```
This makes "item moved" and "link rows gone" one atomic step. It deliberately does NOT rewrite the exhibition layout JSON in SQL (item ids, sections, slot layouts, public snapshots): that logic lives in the app (`pruneGalleryItemIds`) and duplicating it in SQL would let the two drift. The app would keep pruning the layout JSON after the RPC confirms, which is idempotent and can be retried. Row-level security on `vault_items` (membership of both profiles) still applies; `is_public` is forced false exactly as today.

## Risks and checks if you approve
Both functions are additive (no existing object changes), `security invoker` (no privilege escalation), and unused until the app is switched over in a separate, tested commit. Checks: a synthetic fixture run of each function (added, reordered, removed, duplicate links; a move with one id the caller may not move; a move to a profile the caller is not a member of must return nothing), then the same production verification scripts used for the shipped fixes (`rb4-verify-open.cjs`, `rb4-verify-move.cjs`).
