-- STEP 1 of 2: a public view of items. Run this one first.
-- Other people's public items are read through this view, which only has the public columns
-- (never what was paid, private notes, order numbers, serial numbers or storage locations).
-- The site already knows to use it as soon as it exists, and keeps working without it.
-- Safe to run more than once. Changes no data.

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
begin
  foreach col in array wanted loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'vault_items' and column_name = col
    ) then
      cols := cols || format('%I', col);
    end if;
  end loop;

  execute format(
    'create or replace view public.public_vault_items as select %s from public.vault_items where is_public = true',
    array_to_string(cols, ', ')
  );
end;
$$;

grant select on public.public_vault_items to anon, authenticated;
