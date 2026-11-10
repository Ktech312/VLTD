-- Read-only. Run AFTER 20261108_exhibition_snapshot_refresh.sql. Same checks as exhibition-snapshot-validation.sql, plus the
-- newer exhibition_layout copy and the older layouts the migration deliberately leaves alone. Changes nothing.
select jsonb_build_object(
  'item_edit_trigger_exists', exists(select 1 from pg_trigger where tgrelid='public.vault_items'::regclass and tgname='exhibition_snapshots_after_item_edit' and not tgisinternal),
  'gallery_save_trigger_exists', exists(select 1 from pg_trigger where tgrelid='public.galleries'::regclass and tgname='exhibition_snapshots_before_save' and not tgisinternal),
  'anonymous_cannot_call_helpers', not has_function_privilege('anon','public.refresh_exhibition_snapshot_document(jsonb,text,text)','execute'),
  'members_cannot_call_helpers', not has_function_privilege('authenticated','public.refresh_exhibition_snapshot_document(jsonb,text,text)','execute'),
  'stale_visible_snapshots_layout', (select count(*) from public.galleries g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.layout->'publicItemSnapshots')='array' then g.layout->'publicItemSnapshots' else '[]'::jsonb end) s(entry) join public.vault_items v on v.id::text=s.entry->>'id' and v.profile_id=g.profile_id::text where coalesce(s.entry->>'hidden','false')<>'true' and coalesce(g.layout->'itemIds','[]'::jsonb) @> jsonb_build_array(v.id::text) and s.entry is distinct from public.exhibition_snapshot_from_row(to_jsonb(v))),
  'stale_visible_snapshots_exhibition_layout', (select count(*) from public.galleries g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.exhibition_layout->'publicItemSnapshots')='array' then g.exhibition_layout->'publicItemSnapshots' else '[]'::jsonb end) s(entry) join public.vault_items v on v.id::text=s.entry->>'id' and v.profile_id=g.profile_id::text where coalesce(s.entry->>'hidden','false')<>'true' and coalesce(g.exhibition_layout->'itemIds','[]'::jsonb) @> jsonb_build_array(v.id::text) and s.entry is distinct from public.exhibition_snapshot_from_row(to_jsonb(v))),
  'galleries_total', (select count(*) from public.galleries),
  'older_exhibition_layouts_without_snapshots_left_untouched', (select count(*) from public.galleries where jsonb_typeof(exhibition_layout->'publicItemSnapshots') is distinct from 'array'),
  'hidden_snapshot_entries_still_hidden', (select count(*) from public.galleries g cross join lateral jsonb_array_elements(case when jsonb_typeof(g.layout->'publicItemSnapshots')='array' then g.layout->'publicItemSnapshots' else '[]'::jsonb end) s(entry) where s.entry->>'hidden'='true')
) as validation;
-- Expected: both triggers true, both helper checks true, both stale counts 0. The last three numbers are for the record (the owner sends them back).
