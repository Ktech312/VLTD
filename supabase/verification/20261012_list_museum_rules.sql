-- READ-ONLY. Lists the access rules that are actually in place right now on the Museum Alpha tables,
-- the Museum bake storage, the 3D saved rooms, and whether the owner-only helper functions exist.
-- It changes nothing. Send the table it returns.

select 'table rule' as kind,
       c.relname as name,
       p.polname as rule_name,
       case p.polcmd when 'r' then 'read' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' when '*' then 'all' else p.polcmd::text end as applies_to,
       coalesce((select string_agg(r.rolname, ', ') from pg_roles r where r.oid = any (p.polroles)), 'everyone') as for_roles,
       left(coalesce(pg_get_expr(p.polqual, p.polrelid), '(no condition)'), 90) as condition
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where c.relname in ('museum_campus_config','museum_spotlight_programs','museum_store_items','museum_room_items','museum_room_meta','virtual_rooms')

union all

select 'storage rule', 'storage.objects', p.polname,
       case p.polcmd when 'r' then 'read' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' when '*' then 'all' else p.polcmd::text end,
       coalesce((select string_agg(r.rolname, ', ') from pg_roles r where r.oid = any (p.polroles)), 'everyone'),
       left(coalesce(pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid), '(no condition)'), 90)
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'storage'
 where c.relname = 'objects' and (pg_get_expr(p.polqual, p.polrelid) ilike '%museum-room-bakes%' or pg_get_expr(p.polwithcheck, p.polrelid) ilike '%museum-room-bakes%')

union all

select 'function', f.proname, '', '', '', case when f.proname in ('is_vltd_owner','has_3d_gallery_access') then 'present' else 'present (unexpected)' end
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace and n.nspname = 'public'
 where f.proname in ('is_vltd_owner','has_3d_gallery_access')

union all

select 'bucket', b.id, '', '', '', case when b.public then 'PUBLIC' else 'private' end
  from storage.buckets b where b.id = 'museum-room-bakes'

union all

select 'table setting', c.relname, '', '', '', case when c.relrowsecurity then 'row security ON' else 'row security OFF' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where c.relname in ('museum_campus_config','museum_spotlight_programs','museum_store_items','museum_room_items','museum_room_meta','virtual_rooms')

order by 1, 2, 3;
