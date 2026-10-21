-- Batch 7 SQL (RC-23, Market), corrected 2026-10-21: let the public items view carry the seller's ASKING PRICE for items that are for sale.
--
-- The Market page shows what the seller asks. The public view had no such column, so the page showed each item's estimated value as if it were the
-- price. Only items with status FOR_SALE (and already public, and not of a hidden profile) get a price; every other row shows nothing in the new column.
--
-- This file does NOT rebuild the view from a list of columns. It wraps the view exactly as it is in production today, so every existing column,
-- its order, the "public only" rule, the hidden-profile rule, the grants and any view options stay as they are, and the new column is added last.
-- It STOPS WITHOUT CHANGING ANYTHING if production is not exactly what was reviewed:
--   * the helper public.profile_is_hidden(text) is missing,
--   * the view is missing, or its definition no longer filters on is_public and on profile_is_hidden,
--   * vault_items has no asking_price / status / id column, or the view has no id column,
--   * anon or authenticated cannot read the view today (this file never adds or widens a grant).
-- Safe to run again (it does nothing if asking_price is already the view's last column).
begin;

do $$
declare
  def text;
  opts text;
  old_comment text;
  last_col text;
  new_def text;
begin
  if to_regprocedure('public.profile_is_hidden(text)') is null then
    raise exception 'public.profile_is_hidden(text) is missing: the hidden-profile rule cannot be preserved. Nothing was changed.';
  end if;
  if to_regclass('public.public_vault_items') is null then
    raise exception 'public.public_vault_items does not exist. Nothing was changed.';
  end if;

  def := pg_get_viewdef('public.public_vault_items'::regclass, true);
  if def not ilike '%profile_is_hidden%' then
    raise exception 'public.public_vault_items does not filter hidden profiles, so it is not the reviewed definition. Nothing was changed.';
  end if;
  if def not ilike '%is_public%' then
    raise exception 'public.public_vault_items does not filter on is_public, so it is not the reviewed definition. Nothing was changed.';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vault_items' and column_name = 'asking_price') then
    raise exception 'vault_items.asking_price does not exist. Nothing was changed.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vault_items' and column_name = 'status') then
    raise exception 'vault_items.status does not exist. Nothing was changed.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vault_items' and column_name = 'id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_vault_items' and column_name = 'id') then
    raise exception 'the id column is missing from vault_items or from the view. Nothing was changed.';
  end if;

  if not has_table_privilege('anon', 'public.public_vault_items', 'select')
     or not has_table_privilege('authenticated', 'public.public_vault_items', 'select') then
    raise exception 'anon or authenticated cannot read the view today; this file does not change grants. Nothing was changed.';
  end if;

  select column_name into last_col from information_schema.columns
   where table_schema = 'public' and table_name = 'public_vault_items' order by ordinal_position desc limit 1;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_vault_items' and column_name = 'asking_price') then
    if last_col = 'asking_price' then
      raise notice 'asking_price is already the view''s last column. Nothing to do.';
      return;
    end if;
    raise exception 'the view already has an asking_price column that is not last. Nothing was changed.';
  end if;

  -- Keep the view's options (for example security_invoker / security_barrier): replacing a view without them would reset them.
  select array_to_string(c.reloptions, ', ') into opts from pg_class c where c.oid = 'public.public_vault_items'::regclass;

  -- Remember the definition being replaced so rollback-2.sql can put it back exactly (a column cannot be removed from a view).
  old_comment := obj_description('public.public_vault_items'::regclass, 'pg_class');
  execute format('comment on view public.public_vault_items is %L',
                 'pre-asking-price' || E'\n' || coalesce(opts, '') || E'\n' || rtrim(def, '; ' || chr(10)) || E'\n--old comment--\n' || coalesce(old_comment, ''));

  new_def := format(
    'create or replace view public.public_vault_items %s as select pv.*, case when i.status = ''FOR_SALE'' then i.asking_price end as asking_price from (%s) pv join public.vault_items i on i.id = pv.id',
    case when opts is not null and opts <> '' then 'with (' || opts || ')' else '' end,
    rtrim(def, '; ' || chr(10))
  );
  execute new_def;

  if not has_table_privilege('anon', 'public.public_vault_items', 'select')
     or not has_table_privilege('authenticated', 'public.public_vault_items', 'select') then
    raise exception 'grants on the view changed unexpectedly. Rolled back.';
  end if;
end;
$$;

commit;
