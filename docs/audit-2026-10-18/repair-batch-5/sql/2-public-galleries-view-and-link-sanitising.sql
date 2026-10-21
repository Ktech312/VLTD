-- RC-05, STEP 2 of 4. A sanitised public view of exhibitions, and the same sanitising for share / invite links. ONE TRANSACTION.
-- Run after step 1 is verified. Changes no data and no table rule. Nothing reads the view until the site is changed (step 3).
--
-- THE RULE: only what a public screen needs is included, field by field, and nested data is rebuilt from an allowlist. Being readable
-- today is NOT a reason to include something.
--
-- public_galleries (only PUBLIC + ACTIVE exhibitions) INCLUDES:
--   id, title, description, cover_image, visibility, state, created_at                          (cards, listings, page header)
--   profile_id        NULL when the exhibition uses an alias (so the real profile is not named); real value otherwise
--   alias_enabled, alias_name, alias_avatar  (name and avatar only meaningful when the alias is on; otherwise NULL)
--   public_token      the public share link of an exhibition that is listed publicly anyway (home page and feed build links from it)
--   analytics_views   the public view counter shown on cards
--   layout, exhibition_layout   REBUILT from these keys only: themePack, displayMode, guestViewMode, shelfBackground, glassShelfOverlay,
--        shelfOverlayStyle, templateId, adultOnly, type, itemIds, sections[id,title,description,featuredItemId,itemIds,slotLayout],
--        publicItemSnapshots[id,title,subtitle,number,grade,year,description,categoryLabel,subcategoryLabel,imageFrontUrl,imageBackUrl,
--        imageFrontStoragePath,primaryImageKey,createdAt,hidden,blurThumb]. A hidden item keeps ONLY id, hidden, blurThumb, createdAt
--        (its title and image references are removed even if an old row still holds them). Only plain text/number/true-false values are
--        kept. Anything else (unknown keys, stray numeric keys, nested objects, per-item value, owner fields) is dropped.
-- EXCLUDED on purpose:
--   analytics_unique_view_keys (visitor identifiers), analytics_last_viewed_at, item_notes (curator notes: shown only to the owner),
--   updated_at, and every unknown or future column.
--
-- LINK FUNCTIONS: for anyone who is not a member of the exhibition's profile, gallery_public_row (used by the share and invite functions)
-- now returns the same sanitised layout / exhibition_layout, empty item_notes and no last-viewed time, on top of what 20261018 already
-- removes (visitor identifiers, and profile_id for an alias). It stops if 20261018_gallery_links_respect_private.sql is not in place.
--
-- UNDO: rollback-2.sql.

begin;

do $$
begin
  if to_regprocedure('public.gallery_public_row(public.galleries)') is null then
    raise exception 'gallery_public_row does not exist: 20261018_gallery_links_respect_private.sql is not applied. Nothing was changed. Send me the step-0 output.';
  end if;
end;
$$;

-- sanitising helpers: pure functions, no table access
create or replace function public.gallery_public_scalar(v jsonb)
returns jsonb language sql immutable
as $$ select case when jsonb_typeof(v) in ('string', 'number', 'boolean') then v else null end $$;

create or replace function public.gallery_public_string_array(v jsonb, allow_null boolean default false)
returns jsonb language sql immutable
as $$
  select case when jsonb_typeof(v) = 'array' then
    coalesce((select jsonb_agg(x) from jsonb_array_elements(v) x where jsonb_typeof(x) = 'string' or (allow_null and jsonb_typeof(x) = 'null')), '[]'::jsonb)
  else null end
$$;

create or replace function public.gallery_public_snapshots(v jsonb)
returns jsonb language sql immutable
as $$
  select case when jsonb_typeof(v) = 'array' then coalesce((
    select jsonb_agg(
      case when s->'hidden' = 'true'::jsonb then
        jsonb_strip_nulls(jsonb_build_object(
          'id', public.gallery_public_scalar(s->'id'), 'hidden', true,
          'blurThumb', public.gallery_public_scalar(s->'blurThumb'), 'createdAt', public.gallery_public_scalar(s->'createdAt')))
      else
        jsonb_strip_nulls(jsonb_build_object(
          'id', public.gallery_public_scalar(s->'id'), 'title', public.gallery_public_scalar(s->'title'),
          'subtitle', public.gallery_public_scalar(s->'subtitle'), 'number', public.gallery_public_scalar(s->'number'),
          'grade', public.gallery_public_scalar(s->'grade'), 'year', public.gallery_public_scalar(s->'year'),
          'description', public.gallery_public_scalar(s->'description'),
          'categoryLabel', public.gallery_public_scalar(s->'categoryLabel'), 'subcategoryLabel', public.gallery_public_scalar(s->'subcategoryLabel'),
          'imageFrontUrl', public.gallery_public_scalar(s->'imageFrontUrl'), 'imageBackUrl', public.gallery_public_scalar(s->'imageBackUrl'),
          'imageFrontStoragePath', public.gallery_public_scalar(s->'imageFrontStoragePath'),
          'primaryImageKey', public.gallery_public_scalar(s->'primaryImageKey'),
          'createdAt', public.gallery_public_scalar(s->'createdAt'), 'hidden', public.gallery_public_scalar(s->'hidden')))
      end)
    from jsonb_array_elements(v) s where jsonb_typeof(s) = 'object'), '[]'::jsonb)
  else null end
$$;

create or replace function public.gallery_public_sections(v jsonb)
returns jsonb language sql immutable
as $$
  select case when jsonb_typeof(v) = 'array' then coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', public.gallery_public_scalar(sec->'id'), 'title', public.gallery_public_scalar(sec->'title'),
      'description', public.gallery_public_scalar(sec->'description'), 'featuredItemId', public.gallery_public_scalar(sec->'featuredItemId'),
      'itemIds', public.gallery_public_string_array(sec->'itemIds'), 'slotLayout', public.gallery_public_string_array(sec->'slotLayout', true))))
    from jsonb_array_elements(v) sec where jsonb_typeof(sec) = 'object'), '[]'::jsonb)
  else null end
$$;

create or replace function public.gallery_public_layout(l jsonb)
returns jsonb language sql immutable
as $$
  select case when coalesce(jsonb_typeof(l), 'null') <> 'object' then '{}'::jsonb else
    jsonb_strip_nulls(jsonb_build_object(
      'adultOnly', public.gallery_public_scalar(l->'adultOnly'), 'displayMode', public.gallery_public_scalar(l->'displayMode'),
      'glassShelfOverlay', public.gallery_public_scalar(l->'glassShelfOverlay'), 'guestViewMode', public.gallery_public_scalar(l->'guestViewMode'),
      'shelfBackground', public.gallery_public_scalar(l->'shelfBackground'), 'shelfOverlayStyle', public.gallery_public_scalar(l->'shelfOverlayStyle'),
      'templateId', public.gallery_public_scalar(l->'templateId'), 'themePack', public.gallery_public_scalar(l->'themePack'),
      'type', public.gallery_public_scalar(l->'type'), 'itemIds', public.gallery_public_string_array(l->'itemIds')))
    || case when l ? 'publicItemSnapshots' then jsonb_build_object('publicItemSnapshots', coalesce(public.gallery_public_snapshots(l->'publicItemSnapshots'), '[]'::jsonb)) else '{}'::jsonb end
    || case when l ? 'sections' then jsonb_build_object('sections', coalesce(public.gallery_public_sections(l->'sections'), '[]'::jsonb)) else '{}'::jsonb end
  end
$$;

-- the view
create or replace view public.public_galleries as
select
  g.id,
  case when g.alias_enabled then null else g.profile_id end as profile_id,
  g.title,
  g.description,
  g.cover_image,
  g.visibility,
  g.state,
  public.gallery_public_layout(g.layout) as layout,
  public.gallery_public_layout(g.exhibition_layout) as exhibition_layout,
  g.public_token,
  g.analytics_views,
  g.created_at,
  g.alias_enabled,
  case when g.alias_enabled then g.alias_name end as alias_name,
  case when g.alias_enabled then g.alias_avatar end as alias_avatar
from public.galleries g
where g.visibility = 'PUBLIC' and g.state = 'ACTIVE';

grant select on public.public_galleries to anon, authenticated;

-- link functions: the row a non-member receives is sanitised the same way
create or replace function public.gallery_public_row(g public.galleries)
returns public.galleries
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_populate_record(
    null::public.galleries,
    case
      when public.is_profile_member(g.profile_id) then to_jsonb(g)
      else (to_jsonb(g) - 'analytics_unique_view_keys' - 'analytics_last_viewed_at')
           || jsonb_build_object(
                'layout', public.gallery_public_layout(g.layout),
                'exhibition_layout', public.gallery_public_layout(g.exhibition_layout),
                'item_notes', '[]'::jsonb)
           || case when g.alias_enabled then jsonb_build_object('profile_id', null) else '{}'::jsonb end
    end
  );
$$;

revoke all on function public.gallery_public_row(public.galleries) from public, anon, authenticated;

commit;
