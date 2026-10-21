-- RC-05 validation for STAGE 1 (events). READ ONLY. ONE query, ONE result cell (the editor shows only the last result): copy the cell to me.
select jsonb_pretty(jsonb_build_object(
  'policies', (select jsonb_agg(jsonb_build_object('policy', policyname, 'cmd', cmd, 'roles', roles::text) order by policyname)
               from pg_policies where schemaname = 'public' and tablename = 'exhibition_events'),
  'privileges', (select jsonb_agg(jsonb_build_object('grantee', grantee, 'privileges', p) order by grantee) from (
                   select grantee, string_agg(privilege_type, ', ' order by privilege_type) as p
                   from information_schema.role_table_grants
                   where table_schema = 'public' and table_name = 'exhibition_events' and grantee in ('anon', 'authenticated') group by grantee) t),
  'helpers', (select jsonb_agg(jsonb_build_object('name', proname, 'security_definer', prosecdef, 'execute_acl', proacl::text) order by proname)
              from pg_proc where pronamespace = 'public'::regnamespace and proname in ('can_record_exhibition_event', 'exhibition_events_are_public')),
  'events_total', (select count(*) from public.exhibition_events),
  'events_visible_to_visitors', (select count(*) from public.exhibition_events e where public.exhibition_events_are_public(e.gallery_id)),
  'events_hidden_from_visitors', (select count(*) from public.exhibition_events e where not public.exhibition_events_are_public(e.gallery_id))
)) as stage1;
-- expected: three policies: "Members read their own events" (SELECT, authenticated), "Members record events for their own exhibitions"
--   (INSERT, authenticated), "Public read of public exhibitions' events" (SELECT, public); privileges: anon = SELECT, authenticated = INSERT, SELECT;
--   can_record_exhibition_event executable by authenticated only; events_visible + events_hidden = events_total.
