-- Internal tracking IDs — permanent, never reused, for real reporting.
--
--   Account ID :  260718-0007          (joined 18 Jul 2026, 7th account that day)
--   Item ID    :  260718-0007-000142   (item 142 in that collection)
--
-- Guarantees:
--   * Account IDs are system-assigned, never derived from a name, so two
--     collections both called "Kellogg Collection" get different IDs.
--   * The (day, daily counter) pair cannot repeat, so no two accounts ever
--     receive the same ID — even created in the same second.
--   * Counters only move forward. Deleting item 142 never frees up 142.
--   * Once assigned, a code is never rewritten (the assign functions return
--     the existing code instead of issuing a new one).

-- ── Counters ────────────────────────────────────────────────────────

-- One row per calendar day, holding the next account number for that day.
create table if not exists public.account_code_counters (
  day      date primary key,
  next_seq integer not null default 1
);

-- The account code lives on the profile (a profile == a collection), along
-- with that collection's own item counter.
alter table public.profiles
  add column if not exists account_code  text,
  add column if not exists next_item_seq integer not null default 1;

create unique index if not exists profiles_account_code_key
  on public.profiles(account_code) where account_code is not null;

-- The permanent per-item code.
alter table public.vault_items
  add column if not exists item_code text;

create unique index if not exists vault_items_item_code_key
  on public.vault_items(item_code) where item_code is not null;

-- ── Assignment ──────────────────────────────────────────────────────

-- Issue (or return) the account code for a profile. Safe to call repeatedly.
create or replace function public.assign_account_code(p_profile uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_day  date;
  v_seq  integer;
begin
  -- A caller may only touch their own profile. auth.uid() is null for
  -- server-side/backfill work, which is allowed.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles
     where id = p_profile and user_id = auth.uid()
  ) then
    raise exception 'assign_account_code: not your profile';
  end if;

  select account_code into v_code from public.profiles where id = p_profile;
  if v_code is not null then
    return v_code;  -- already issued; never reissue
  end if;

  -- Date-encode from when the account was created, so the ID doubles as a
  -- join-date record.
  select coalesce(created_at::date, current_date) into v_day
    from public.profiles where id = p_profile;
  if v_day is null then
    v_day := current_date;
  end if;

  -- Atomically take the next number for that day.
  insert into public.account_code_counters (day, next_seq)
       values (v_day, 2)
  on conflict (day)
    do update set next_seq = public.account_code_counters.next_seq + 1
    returning next_seq - 1 into v_seq;

  v_code := to_char(v_day, 'YYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  update public.profiles set account_code = v_code where id = p_profile;
  return v_code;
end;
$$;

-- Issue (or return) the permanent code for one item.
create or replace function public.assign_item_code(p_profile uuid, p_item text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account text;
  v_seq     integer;
  v_code    text;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles
     where id = p_profile and user_id = auth.uid()
  ) then
    raise exception 'assign_item_code: not your profile';
  end if;

  select item_code into v_code from public.vault_items where id = p_item;
  if v_code is not null then
    return v_code;  -- already issued; never reissue
  end if;

  v_account := public.assign_account_code(p_profile);

  -- Per-collection counter, forward-only.
  update public.profiles
     set next_item_seq = next_item_seq + 1
   where id = p_profile
  returning next_item_seq - 1 into v_seq;

  v_code := v_account || '-' || lpad(v_seq::text, 6, '0');

  update public.vault_items set item_code = v_code where id = p_item;
  return v_code;
end;
$$;

grant execute on function public.assign_account_code(uuid) to authenticated;
grant execute on function public.assign_item_code(uuid, text) to authenticated;

-- ── Backfill existing data ──────────────────────────────────────────
-- Oldest first, so the earliest accounts and items get the lowest numbers.

do $$
declare r record;
begin
  for r in
    select id from public.profiles
     where account_code is null
     order by created_at nulls last, id
  loop
    perform public.assign_account_code(r.id);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select id, profile_id from public.vault_items
     where item_code is null and profile_id is not null
     order by profile_id, created_at nulls last, id
  loop
    perform public.assign_item_code(r.profile_id, r.id);
  end loop;
end $$;
