-- Undo file 2: puts the public items view back exactly as it was before (a column cannot be taken out of a view, so it is dropped and recreated
-- from the definition that file 2 saved in the view's comment). Grants to anon and authenticated are restored; file 2 only ran when both had them.
begin;
do $$
declare
  c text;
  marker constant text := E'\n--old comment--\n';
  m int;
  opts text;
  def text;
  old_comment text;
begin
  c := obj_description('public.public_vault_items'::regclass, 'pg_class');
  if c is null or c not like 'pre-asking-price' || E'\n' || '%' then
    raise exception 'the view has no saved pre-asking-price definition (file 2 did not run, or the view was changed since). Nothing was changed.';
  end if;
  m := position(marker in c);
  old_comment := nullif(substr(c, m + length(marker)), '');
  c := substr(c, 1, m - 1);
  c := substr(c, length('pre-asking-price' || E'\n') + 1);   -- now: options line, newline, definition
  opts := split_part(c, E'\n', 1);
  def := substr(c, length(opts) + 2);
  drop view public.public_vault_items;
  execute format('create view public.public_vault_items %s as %s', case when opts <> '' then 'with (' || opts || ')' else '' end, def);
  grant select on public.public_vault_items to anon, authenticated;
  if old_comment is not null then
    execute format('comment on view public.public_vault_items is %L', old_comment);
  end if;
end;
$$;
commit;
