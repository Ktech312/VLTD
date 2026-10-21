-- RC-05 validation queries. READ ONLY (the role switches below only change who the query runs as, inside a transaction that is rolled back).
-- Run the block for a stage right after that stage, keep the output, and send it to me. Each block says what a correct result is.
-- Nothing here changes data. "set local role" works in the Supabase SQL editor; if it is refused, send me that and skip the "as visitor" lines.

------------------------------------------------------------------------------------------------------------------------------------
-- AFTER STEP 1 (events)
------------------------------------------------------------------------------------------------------------------------------------
-- V1.1 exactly three policies, with these names and commands
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'exhibition_events' order by policyname;
--   expected: "Members read their own events" (SELECT, authenticated), "Members record events for their own exhibitions" (INSERT, authenticated),
--             "Public read of public exhibitions' events" (SELECT, public)

-- V1.2 privileges: anon select only; authenticated select + insert only
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants where table_schema = 'public' and table_name = 'exhibition_events' and grantee in ('anon', 'authenticated') group by 1 order by 1;
--   expected: anon = SELECT ; authenticated = INSERT, SELECT

-- V1.3 what a visitor can read (compare with V1.4: this number must equal visible_to_visitors there)
begin;
set local role anon;
select count(*) as events_a_visitor_can_read from public.exhibition_events;
rollback;

-- V1.4 as the database owner: events whose exhibition is NOT public-without-alias, and whether a visitor would see them (expected: visible_to_visitors = 0)
select count(*) filter (where not public.exhibition_events_are_public(e.gallery_id)) as hidden_from_visitors,
       count(*) filter (where public.exhibition_events_are_public(e.gallery_id))     as visible_to_visitors,
       count(*) as total
from public.exhibition_events e;
--   expected: events_a_visitor_can_read (V1.3) = visible_to_visitors; every other event is in hidden_from_visitors

------------------------------------------------------------------------------------------------------------------------------------
-- AFTER STEP 2 (view and link functions)
------------------------------------------------------------------------------------------------------------------------------------
-- V2.1 the view has exactly these columns (expected: 15 rows, listed)
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'public_galleries' order by column_name;
--   alias_avatar, alias_enabled, alias_name, analytics_views, cover_image, created_at, description, exhibition_layout, id, layout, profile_id,
--   public_token, state, title, visibility.   MUST NOT list: analytics_unique_view_keys, analytics_last_viewed_at, item_notes, updated_at

-- V2.2 same rows as the old public rule (expected: the two numbers are equal)
select (select count(*) from public.public_galleries) as in_view,
       (select count(*) from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE') as public_active_in_table;

-- V2.3 alias exhibitions in the view have no profile_id (expected: 0)
select count(*) as alias_rows_in_view_still_naming_a_profile from public.public_galleries where alias_enabled and profile_id is not null;

-- V2.4 no account or profile id appears anywhere in an alias row of the view (expected: 0)
select count(*) as alias_rows_containing_an_account_id
from public.public_galleries v
join public.profiles p on position(p.id::text in v::text) > 0 or (p.user_id is not null and position(p.user_id::text in v::text) > 0)
where v.alias_enabled;

-- V2.5 nothing outside the allowlist survives in layout / exhibition_layout (expected: 0 rows)
select 'layout key' as kind, id, k as name from public.public_galleries, jsonb_object_keys(layout) k
  where k not in ('adultOnly','displayMode','glassShelfOverlay','guestViewMode','itemIds','publicItemSnapshots','sections','shelfBackground','shelfOverlayStyle','templateId','themePack','type')
union all
select 'exhibition_layout key', id, k from public.public_galleries, jsonb_object_keys(exhibition_layout) k
  where k not in ('adultOnly','displayMode','glassShelfOverlay','guestViewMode','itemIds','publicItemSnapshots','sections','shelfBackground','shelfOverlayStyle','templateId','themePack','type')
union all
select 'snapshot key', v.id, k from public.public_galleries v, jsonb_array_elements(v.layout->'publicItemSnapshots') s, jsonb_object_keys(s) k
  where jsonb_typeof(v.layout->'publicItemSnapshots') = 'array'
    and k not in ('id','title','subtitle','number','grade','year','description','categoryLabel','subcategoryLabel','imageFrontUrl','imageBackUrl','imageFrontStoragePath','primaryImageKey','createdAt','hidden','blurThumb')
union all
select 'section key', v.id, k from public.public_galleries v, jsonb_array_elements(v.exhibition_layout->'sections') s, jsonb_object_keys(s) k
  where jsonb_typeof(v.exhibition_layout->'sections') = 'array' and k not in ('id','title','description','featuredItemId','itemIds','slotLayout');

-- V2.6 hidden items expose nothing but id / hidden / blurThumb / createdAt (expected: 0 rows)
select v.id, s->>'id' as snapshot_id
from public.public_galleries v, jsonb_array_elements(v.layout->'publicItemSnapshots') s
where jsonb_typeof(v.layout->'publicItemSnapshots') = 'array' and s->'hidden' = 'true'::jsonb
  and (s ? 'title' or s ? 'imageFrontUrl' or s ? 'imageBackUrl' or s ? 'imageFrontStoragePath' or s ? 'primaryImageKey' or s ? 'description');

-- V2.7 what was dropped, so you can see it was only non-public material (counts of exhibitions that had it)
select count(*) filter (where item_notes is not null and item_notes <> '[]'::jsonb) as with_curator_notes,
       count(*) filter (where analytics_unique_view_keys is not null and analytics_unique_view_keys <> '[]'::jsonb) as with_visitor_keys
from public.galleries where visibility = 'PUBLIC' and state = 'ACTIVE';

-- V2.8 the link function as a visitor, for one alias exhibition's token (replace the token; expected: profile_id empty, item_notes [], keys empty)
--   begin; set local role anon;
--   select profile_id, item_notes, analytics_unique_view_keys, analytics_last_viewed_at from public.get_gallery_by_share_token('<TOKEN OF AN ALIAS EXHIBITION>');
--   rollback;

------------------------------------------------------------------------------------------------------------------------------------
-- AFTER STEP 3 (site change live; consumers checked on the site, see the staged order). Before running step 4:
------------------------------------------------------------------------------------------------------------------------------------
-- V3.1 the table is still readable the old way (step 4 not yet run): expected a policy list that still has the public read rule
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'galleries' order by policyname;

------------------------------------------------------------------------------------------------------------------------------------
-- AFTER STEP 4 (old path closed)
------------------------------------------------------------------------------------------------------------------------------------
-- V4.1 the galleries rules left: only member / owner rules (expected: no rule whose condition mentions PUBLIC without a member check)
select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = 'galleries' order by policyname;

-- V4.2 a visitor reads nothing from the table (expected: 0), but reads the public view and public items (expected: > 0)
begin;
set local role anon;
select (select count(*) from public.galleries) as table_rows_for_a_visitor,
       (select count(*) from public.public_galleries) as view_rows_for_a_visitor,
       (select count(*) from public.gallery_items) as item_rows_for_a_visitor;
rollback;
--   expected: table_rows_for_a_visitor = 0 ; view_rows_for_a_visitor = number of public exhibitions ; item_rows_for_a_visitor > 0

-- V4.3 items of private / draft / guest-only exhibitions are not readable by a visitor (expected: 0)
begin;
set local role anon;
select count(*) as visitor_readable_items_of_non_public_exhibitions
from public.gallery_items gi
where public.gallery_is_publicly_listed(gi.gallery_id::text) = false;
rollback;
