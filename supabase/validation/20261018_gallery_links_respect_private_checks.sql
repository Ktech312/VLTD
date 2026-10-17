-- READ-ONLY checks for 20261018_gallery_links_respect_private.sql. Changes nothing. Run in the Supabase SQL editor AFTER the migration.
-- Every row must say ok = true. (The SQL editor has no signed-in user, so these behave like a visitor who is not signed in.)
with fns as (
  select p.proname, p.prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_gallery_by_share_token', 'get_gallery_items_by_share_token', 'get_gallery_by_invite_token',
                      'get_gallery_items_by_invite_token', 'get_invite_item_financials', 'gallery_public_row')
)
select * from (
  select '1  the five link functions and the helper exist' as check_name,
         (select count(*) from fns) = 6 as ok
  union all
  select '2  each link function checks visibility (PUBLIC or INVITE) and state (ACTIVE)',
         (select coalesce(bool_and(prosrc like '%visibility in (''PUBLIC'', ''INVITE'')%' and prosrc like '%state = ''ACTIVE''%'), false)
          from fns where proname <> 'gallery_public_row')
  union all
  select '3  the helper cannot be called by visitors or signed-in users',
         not has_function_privilege('anon', 'public.gallery_public_row(public.galleries)', 'execute')
         and not has_function_privilege('authenticated', 'public.gallery_public_row(public.galleries)', 'execute')
  union all
  select '4  the five link functions can still be called by visitors and signed-in users',
         has_function_privilege('anon', 'public.get_gallery_by_share_token(text)', 'execute')
         and has_function_privilege('authenticated', 'public.get_gallery_by_share_token(text)', 'execute')
         and has_function_privilege('anon', 'public.get_gallery_items_by_share_token(text)', 'execute')
         and has_function_privilege('anon', 'public.get_gallery_by_invite_token(text)', 'execute')
         and has_function_privilege('anon', 'public.get_gallery_items_by_invite_token(text)', 'execute')
         and has_function_privilege('anon', 'public.get_invite_item_financials(text)', 'execute')
  union all
  select '5  for every exhibition that has a link, a visitor gets it only when it is PUBLIC/INVITE and ACTIVE',
         not exists (
           select 1 from public.galleries g
           where g.public_token is not null
             and (select count(*) from public.get_gallery_by_share_token(g.public_token))
                 <> case when g.visibility in ('PUBLIC', 'INVITE') and g.state = 'ACTIVE' then 1 else 0 end)
  union all
  select '6  no link response carries visitor identifiers (analytics_unique_view_keys)',
         not exists (
           select 1 from public.galleries g
           cross join lateral public.get_gallery_by_share_token(g.public_token) r
           where g.public_token is not null and r.analytics_unique_view_keys is not null)
  union all
  select '7  no link response for an aliased exhibition names the real account (profile_id empty)',
         not exists (
           select 1 from public.galleries g
           cross join lateral public.get_gallery_by_share_token(g.public_token) r
           where g.public_token is not null and r.alias_enabled and r.profile_id is not null)
  union all
  select '8  no exhibition that is Private (LOCKED) or in Storage can be read through a link by a visitor',
         not exists (
           select 1 from public.galleries g
           where g.public_token is not null
             and (g.visibility not in ('PUBLIC', 'INVITE') or g.state <> 'ACTIVE')
             and exists (select 1 from public.get_gallery_by_share_token(g.public_token)))
) c
order by 1;
