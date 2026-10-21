-- RC-05, STEP 0 (READ ONLY): the actual policies, grants, helpers and data this package depends on. Changes nothing.
-- Run every block, keep the output, and send it to me BEFORE any other file is run. The other files assume what is listed in
-- MIGRATION-PROPOSAL-RC05.md ("Assumptions"); this shows whether production matches.

-- 0.1 row-level security and policies on every table the package touches
select c.relname as table_name, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('galleries', 'gallery_items', 'gallery_invites', 'exhibition_events')
order by 1;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('galleries', 'gallery_items', 'gallery_invites', 'exhibition_events')
order by tablename, cmd, policyname;

-- 0.2 table privileges for the API roles (who can insert / update / delete / select at all)
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('galleries', 'gallery_items', 'exhibition_events') and grantee in ('anon', 'authenticated')
group by table_name, grantee order by table_name, grantee;

-- 0.3 column privileges that differ from the table (normally none)
select table_name, grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('galleries', 'exhibition_events') and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT' and column_name in ('profile_id', 'item_notes', 'analytics_unique_view_keys')
order by table_name, grantee, column_name;

-- 0.4 the helpers and link functions the package uses or replaces (name, security definer?, owner, who may execute)
select p.proname, p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as owner, p.proacl::text as execute_acl
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('is_profile_member', 'profile_is_hidden', 'gallery_public_row', 'get_gallery_by_share_token',
                    'get_gallery_items_by_share_token', 'get_gallery_by_invite_token', 'get_gallery_items_by_invite_token')
order by 1;

-- 0.5 the definition of gallery_public_row (does the 20261018 link-sanitising migration exist in production?)
select pg_get_functiondef('public.gallery_public_row(public.galleries)'::regprocedure) as gallery_public_row_definition;

-- 0.6 triggers on the tables (anything that reads galleries under the caller's rights would be affected by step 4)
select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table in ('galleries', 'gallery_items', 'exhibition_events')
order by 1, 2;

-- 0.7 any other policy or view that mentions galleries (these would change behaviour when step 4 restricts reading galleries)
select 'policy' as kind, tablename as name, policyname as detail, coalesce(qual, '') || ' ' || coalesce(with_check, '') as definition
from pg_policies
where schemaname = 'public' and tablename not in ('galleries') and (coalesce(qual, '') ilike '%galleries%' or coalesce(with_check, '') ilike '%galleries%')
union all
select 'view', viewname, '', definition from pg_views where schemaname = 'public' and definition ilike '%galleries%'
order by 1, 2;

-- 0.8 is the public view already there?
select table_name from information_schema.views where table_schema = 'public' and table_name = 'public_galleries';

-- 0.9 the data this package decides about
select visibility, state, alias_enabled, count(*) as exhibitions from public.galleries group by 1, 2, 3 order by 1, 2, 3;
select count(*) as exhibition_events_rows from public.exhibition_events;

-- 0.10 do any public columns of an exhibition contain an account or profile identifier? (expected: 0 rows)
select g.id, g.alias_enabled
from public.galleries g
join public.profiles p on position(p.id::text in (g.title || ' ' || coalesce(g.description, '') || ' ' || coalesce(g.cover_image, '') || ' ' ||
                                                  g.layout::text || ' ' || g.exhibition_layout::text || ' ' || coalesce(g.public_token, ''))) > 0
                       or (p.user_id is not null and position(p.user_id::text in (g.layout::text || ' ' || g.exhibition_layout::text || ' ' || coalesce(g.cover_image, ''))) > 0);
