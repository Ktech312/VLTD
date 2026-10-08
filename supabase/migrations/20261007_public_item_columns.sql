-- Signed-out visitors can only read the public columns of a public item.
-- Before this, anyone could ask the database directly for what you paid, your private notes,
-- order numbers, serial numbers and storage locations of any public item.
-- Run this AFTER the matching site update is live. Safe to run more than once. Nothing is deleted.

-- 1) Invite links that allow "financial history" get purchase prices through this checked call.
create or replace function public.get_invite_item_financials(p_token text)
returns table(id text, purchase_price numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.gallery_invites%rowtype;
begin
  select * into v_invite from public.gallery_invites where token = p_token limit 1;
  if not found or v_invite.disabled or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    return;
  end if;
  if coalesce((v_invite.permissions ->> 'financialHistory')::boolean, false) is not true then
    return;
  end if;
  return query
    select vi.id::text, vi.purchase_price::numeric
    from public.vault_items vi
    join public.gallery_items gi on gi.artifact_id::text = vi.id::text
    where gi.gallery_id = v_invite.gallery_id and vi.is_public = true;
end;
$$;

grant execute on function public.get_invite_item_financials(text) to anon, authenticated;

-- 2) Signed-out visitors: only the public columns (those that exist in your database are granted).
revoke select on public.vault_items from anon;

do $$
declare
  col text;
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
      execute format('grant select (%I) on public.vault_items to anon', col);
    end if;
  end loop;
end;
$$;
