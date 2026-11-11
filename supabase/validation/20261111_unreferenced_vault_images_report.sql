-- READ-ONLY REPORT. Changes nothing, deletes nothing. Lists photo files under items/ in the vault-images bucket that NO item row and NO exhibition row mentions anywhere.
-- Why: an upload that is given up on after 45 seconds can still finish at the storage afterwards. The app removes such leftovers itself when it can (right away if the page is still open, or
-- on a later visit from the same device), but a phone that is lost or wiped before that leaves the file behind. This report is how those are TRACKED across all devices.
-- How "referenced" is decided: every text of the form items/<...> found anywhere in any vault_items row or galleries row (all columns, so a column added later is still covered). A file is listed
-- only when its path appears in none of them AND it is more than 1 day old (so a photo uploaded a moment ago, whose item is still being saved, is never listed).
-- Nothing here removes a file. If the owner later wants them removed, that is a separate, explicit step that starts from this list and re-checks each path.
-- Send the one-row result. Expected today: unknown (this has not been run).
with objs as (
  select o.name, o.created_at, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes
  from storage.objects o
  where o.bucket_id = 'vault-images' and o.name like 'items/%'
),
mentioned as (
  select distinct m[1] as name from public.vault_items vi, regexp_matches(vi::text, '(items/[A-Za-z0-9_./-]+)', 'g') as m
  union
  select distinct m[1] from public.galleries g, regexp_matches(g::text, '(items/[A-Za-z0-9_./-]+)', 'g') as m
),
unref as (
  select o.* from objs o left join mentioned r on r.name = o.name
  where r.name is null and o.created_at < now() - interval '1 day'
)
select jsonb_build_object(
  'files_under_items', (select count(*) from objs),
  'files_never_mentioned_older_than_1_day', (select count(*) from unref),
  'bytes_of_those', (select coalesce(sum(bytes), 0) from unref),
  'oldest_25', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'created_at', created_at, 'bytes', bytes) order by created_at) from (select * from unref order by created_at limit 25) x), '[]'::jsonb)
) as report;
