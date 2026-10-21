-- RC-05, STEP 0 (READ ONLY), single-result version. Changes nothing.
-- The Supabase SQL editor shows only the LAST result of a script, so this is ONE query that returns ONE cell (stage0) holding everything
-- 0-inspect-read-only.sql prints. Run it, click the cell, copy the whole text and paste it to me.
-- (If you prefer the ten separate result sets, run the blocks of 0-inspect-read-only.sql one at a time instead.)

select jsonb_pretty(jsonb_build_object(
  'checked_at', now(),
  'rls', (select coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'rls_on', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity) order by c.relname), '[]'::jsonb)
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname in ('galleries', 'gallery_items', 'gallery_invites', 'exhibition_events')),
  'policies', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'cmd', cmd, 'roles', roles::text, 'using', qual, 'with_check', with_check) order by tablename, cmd, policyname), '[]'::jsonb)
               from pg_policies where schemaname = 'public' and tablename in ('galleries', 'gallery_items', 'gallery_invites', 'exhibition_events')),
  'table_grants', (select coalesce(jsonb_agg(x order by x->>'table', x->>'grantee'), '[]'::jsonb) from (
                     select jsonb_build_object('table', table_name, 'grantee', grantee, 'privileges', string_agg(privilege_type, ', ' order by privilege_type)) as x
                     from information_schema.role_table_grants
                     where table_schema = 'public' and table_name in ('galleries', 'gallery_items', 'exhibition_events') and grantee in ('anon', 'authenticated')
                     group by table_name, grantee) t),
  'column_grants_of_note', (select coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'grantee', grantee, 'column', column_name, 'privilege', privilege_type) order by table_name, grantee, column_name), '[]'::jsonb)
                            from information_schema.column_privileges
                            where table_schema = 'public' and table_name in ('galleries', 'exhibition_events') and grantee in ('anon', 'authenticated')
                              and privilege_type = 'SELECT' and column_name in ('profile_id', 'item_notes', 'analytics_unique_view_keys')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('name', p.proname, 'security_definer', p.prosecdef, 'owner', pg_get_userbyid(p.proowner), 'execute_acl', p.proacl::text) order by p.proname), '[]'::jsonb)
                from pg_proc p
                where p.pronamespace = 'public'::regnamespace
                  and p.proname in ('is_profile_member', 'profile_is_hidden', 'gallery_public_row', 'get_gallery_by_share_token', 'get_gallery_items_by_share_token',
                                    'get_gallery_by_invite_token', 'get_gallery_items_by_invite_token', 'can_record_exhibition_event', 'exhibition_events_are_public',
                                    'gallery_is_publicly_listed')),
  'gallery_public_row_definition', (select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'gallery_public_row' limit 1),
  'get_gallery_by_share_token_definition', (select pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_gallery_by_share_token' limit 1),
  'triggers', (select coalesce(jsonb_agg(jsonb_build_object('table', event_object_table, 'trigger', trigger_name, 'timing', action_timing, 'event', event_manipulation, 'action', action_statement) order by event_object_table, trigger_name), '[]'::jsonb)
               from information_schema.triggers where event_object_schema = 'public' and event_object_table in ('galleries', 'gallery_items', 'exhibition_events')),
  'other_policies_mentioning_galleries', (select coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'policy', policyname, 'definition', coalesce(qual, '') || ' ' || coalesce(with_check, '')) order by tablename, policyname), '[]'::jsonb)
               from pg_policies where schemaname = 'public' and tablename <> 'galleries' and (coalesce(qual, '') ilike '%galleries%' or coalesce(with_check, '') ilike '%galleries%')),
  'views_mentioning_galleries', (select coalesce(jsonb_agg(viewname order by viewname), '[]'::jsonb) from pg_views where schemaname = 'public' and definition ilike '%galleries%'),
  'public_galleries_view_exists', exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'public_galleries'),
  'exhibitions_by_state', (select coalesce(jsonb_agg(jsonb_build_object('visibility', visibility, 'state', state, 'alias_enabled', alias_enabled, 'count', n) order by visibility, state, alias_enabled), '[]'::jsonb)
               from (select visibility, state, alias_enabled, count(*) as n from public.galleries group by 1, 2, 3) g),
  'exhibition_events_rows', (select count(*) from public.exhibition_events),
  'exhibitions_with_account_ids_in_public_columns', (select count(*) from public.galleries g
               join public.profiles p on position(p.id::text in (g.title || ' ' || coalesce(g.description, '') || ' ' || coalesce(g.cover_image, '') || ' ' || g.layout::text || ' ' || g.exhibition_layout::text || ' ' || coalesce(g.public_token, ''))) > 0
                                      or (p.user_id is not null and position(p.user_id::text in (g.layout::text || ' ' || g.exhibition_layout::text || ' ' || coalesce(g.cover_image, ''))) > 0))
)) as stage0;
