-- Auto-assign internal IDs on create.
--
-- The backfill in 20260718_internal_ids.sql only coded rows that already
-- existed. These BEFORE INSERT triggers make sure every NEW profile and item
-- gets a permanent code no matter how it's created — capture, quick add,
-- import, the API, or the coming bulk upload — without touching client code.

-- New profile -> account code, date-encoded from its created_at.
create or replace function public.tg_assign_account_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_seq integer;
begin
  if new.account_code is null then
    v_day := coalesce(new.created_at::date, current_date);
    insert into public.account_code_counters (day, next_seq)
         values (v_day, 2)
    on conflict (day)
      do update set next_seq = public.account_code_counters.next_seq + 1
      returning next_seq - 1 into v_seq;
    new.account_code := to_char(v_day, 'YYMMDD') || '-' || lpad(v_seq::text, 4, '0');
  end if;
  if new.next_item_seq is null then
    new.next_item_seq := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_account_code on public.profiles;
create trigger trg_profiles_account_code
  before insert on public.profiles
  for each row execute function public.tg_assign_account_code();

-- New item -> item code, using its collection's account code + a forward-only
-- per-collection counter.
create or replace function public.tg_assign_item_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid     uuid;
  v_account text;
  v_seq     integer;
begin
  if new.item_code is not null then
    return new;
  end if;
  -- profile_id is a text column; only proceed for a real uuid.
  if new.profile_id is null
     or new.profile_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  v_pid := new.profile_id::uuid;

  -- Lock the profile row, take the next item number, and read its account code.
  update public.profiles
     set next_item_seq = next_item_seq + 1
   where id = v_pid
  returning account_code, next_item_seq - 1 into v_account, v_seq;

  if not found then
    -- Item points at a profile that doesn't exist; leave the code null rather
    -- than invent one.
    return new;
  end if;

  if v_account is null then
    v_account := public.assign_account_code(v_pid);
  end if;

  new.item_code := v_account || '-' || lpad(v_seq::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_vault_items_item_code on public.vault_items;
create trigger trg_vault_items_item_code
  before insert on public.vault_items
  for each row execute function public.tg_assign_item_code();
