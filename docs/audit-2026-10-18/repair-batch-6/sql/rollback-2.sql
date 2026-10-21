-- Undo: the public items view without the asking_price column (a column cannot be taken out of a view, so it is rebuilt).
begin;
drop view if exists public.public_vault_items;
do $$
declare
  col text;
  cols text[] := '{}';
  wanted text[] := array[
    'id','profile_id','title','subtitle','number','grade','universe','category','custom_category_label',
    'category_label','subcategory_label','subject','year','condition','brand','edition','variant','tags',
    'description','cert_number','is_first_edition','status','is_public','is_new','created_at',
    'image_front_url','image_front_storage_path','image_back_url','primary_image_key','images_json',
    'current_value',
    'auction_status','auction_ends_at','auction_starting_bid','auction_current_bid','auction_bid_count',
    'auction_winner_id','reserve_price','buy_it_now_price'
  ];
  hidden_filter text := '';
begin
  foreach col in array wanted loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vault_items' and column_name = col) then
      cols := cols || format('%I', col);
    end if;
  end loop;
  if to_regprocedure('public.profile_is_hidden(text)') is not null then
    hidden_filter := ' and not public.profile_is_hidden(profile_id::text)';
  end if;
  execute format('create or replace view public.public_vault_items as select %s from public.vault_items where is_public = true%s', array_to_string(cols, ', '), hidden_filter);
end;
$$;
grant select on public.public_vault_items to anon, authenticated;
commit;
