-- Keep already-selected exhibition item details current without exposing a private profile.
-- Run this migration, then its validation file. No application deploy is required.
begin;

-- vault_items.profile_id is TEXT while galleries.profile_id is a uuid, so every comparison between them is made as text.
-- (The first version compared text = uuid and stopped with error 42883.)
drop function if exists public.refresh_exhibition_snapshot_document(jsonb, uuid, text);

create or replace function public.exhibition_snapshot_from_row(item jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', item->'id', 'title', coalesce(nullif(item->>'title',''), 'Untitled Item'),
    'subtitle', item->'subtitle', 'number', item->'number', 'grade', item->'grade',
    'year', item->'year', 'description', item->'description',
    'categoryLabel', coalesce(nullif(item->>'category_label',''), nullif(item->>'custom_category_label',''), item->>'category'),
    'subcategoryLabel', item->'subcategory_label',
    'imageFrontUrl', item->'image_front_url', 'imageBackUrl', item->'image_back_url',
    'imageFrontStoragePath', item->'image_front_storage_path',
    'primaryImageKey', item->'primary_image_key', 'createdAt', item->'created_at'
  ));
$$;

create or replace function public.refresh_exhibition_snapshot_document(doc jsonb, owner_profile text, only_item text default null)
returns jsonb language plpgsql stable set search_path = pg_catalog as $$
declare refreshed jsonb;
begin
  if jsonb_typeof(doc) is distinct from 'object'
    or jsonb_typeof(doc->'publicItemSnapshots') is distinct from 'array' then return doc; end if;
  select coalesce(jsonb_agg(
    case when v.id is not null and coalesce(s.entry->>'hidden','false') <> 'true'
      then public.exhibition_snapshot_from_row(to_jsonb(v)) else s.entry end
    order by s.ord), '[]'::jsonb)
  into refreshed
  from jsonb_array_elements(doc->'publicItemSnapshots') with ordinality as s(entry,ord)
  left join public.vault_items v on v.id::text = s.entry->>'id'
    and v.profile_id = owner_profile
    and (only_item is null or v.id::text = only_item)
    and (coalesce(doc->'itemIds','[]'::jsonb) @> jsonb_build_array(v.id::text));
  return jsonb_set(doc, '{publicItemSnapshots}', refreshed, false);
end;
$$;

create or replace function public.refresh_exhibition_snapshots_before_save()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  new.layout := public.refresh_exhibition_snapshot_document(new.layout, new.profile_id::text);
  new.exhibition_layout := public.refresh_exhibition_snapshot_document(new.exhibition_layout, new.profile_id::text);
  return new;
end;
$$;

create or replace function public.refresh_exhibitions_after_item_edit()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- No work for private-only edits, unchanged upserts, or a move handled by the existing move rules.
  if old.profile_id is distinct from new.profile_id
    or public.exhibition_snapshot_from_row(to_jsonb(old)) = public.exhibition_snapshot_from_row(to_jsonb(new))
    then return new; end if;
  update public.galleries g set
    layout = public.refresh_exhibition_snapshot_document(g.layout, new.profile_id, new.id::text),
    exhibition_layout = public.refresh_exhibition_snapshot_document(g.exhibition_layout, new.profile_id, new.id::text),
    updated_at = clock_timestamp()
  where g.profile_id::text = new.profile_id and (
    coalesce(g.layout->'itemIds','[]'::jsonb) @> jsonb_build_array(new.id::text)
    or coalesce(g.exhibition_layout->'itemIds','[]'::jsonb) @> jsonb_build_array(new.id::text)
  );
  return new;
end;
$$;

revoke all on function public.exhibition_snapshot_from_row(jsonb) from public, anon, authenticated;
revoke all on function public.refresh_exhibition_snapshot_document(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.refresh_exhibition_snapshots_before_save() from public, anon, authenticated;
revoke all on function public.refresh_exhibitions_after_item_edit() from public, anon, authenticated;

drop trigger if exists exhibition_snapshots_before_save on public.galleries;
create trigger exhibition_snapshots_before_save before insert or update of layout, exhibition_layout, profile_id
on public.galleries for each row execute function public.refresh_exhibition_snapshots_before_save();
drop trigger if exists exhibition_snapshots_after_item_edit on public.vault_items;
create trigger exhibition_snapshots_after_item_edit after update on public.vault_items
for each row execute function public.refresh_exhibitions_after_item_edit();

-- Repair existing snapshots. Selection/order, hiding, aliases, visibility and private item fields stay as stored.
update public.galleries set layout = layout, exhibition_layout = exhibition_layout;
commit;
