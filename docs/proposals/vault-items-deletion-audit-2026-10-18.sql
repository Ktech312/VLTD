-- DRAFT. NOT APPLIED. Do not run until EK decides (see vault-items-deletion-audit-2026-10-18.md). Tested only in an in-process Postgres
-- (supabase/validation/test-deletion-audit-draft.cjs). If adopted it moves to supabase/migrations/ and EK runs it by hand like the others.
--
-- Purpose: when a vault item is deleted, keep a restricted, append-only note of WHO (database role and, when there is one, the account),
-- WHEN, WHICH item (id, item code, collection) and WHERE THE CALL CAME FROM: a browser running the app (Origin header = https://vltd.app,
-- client library 'supabase-js-web'), a script (no Origin, 'supabase-js-node' or none), or the SQL editor (no request at all, just the database user).
-- v2 additions: origin, client library, client address, the transaction id (groups the rows of one statement), the start of the statement text. It starts recording from the day it is applied; it cannot
-- explain earlier deletions. It is tamper-EVIDENT against edits made through the app or an API key, not tamper-proof against the database owner.
begin;

create table if not exists public.vault_item_deletions (
  id              bigint generated always as identity primary key,
  deleted_at      timestamptz not null default now(),
  item_id         text not null,                 -- '*TRUNCATE*' for a truncate of the whole table
  item_code       text,                          -- the permanent internal code (e.g. 260312-0001-000142)
  profile_id      text,                          -- the collection it belonged to
  item_created_at bigint,                        -- when the item was added (ms), to tell old from new
  item_status     text,
  title_start     text,                          -- first 60 characters of the title, only so a deleted record can be recognised; restricted table
  actor_user_id   uuid,                          -- auth.uid(): null for the service key, the SQL editor, or a script
  actor_role      text,                          -- 'authenticated' | 'service_role' | 'anon' | null
  db_user         text not null default current_user,
  via             text,                          -- 'api' when the call came through the REST gateway (request.method/path were set), else 'direct'
  request_method  text,
  request_path    text,
  user_agent      text,
  request_origin  text,                          -- the Origin header: a browser page sends it, a server-side script normally does not
  client_info     text,                          -- the x-client-info header, e.g. supabase-js-web/2.x (browser) or supabase-js-node/2.x (script)
  client_ip       text,                          -- first address in x-forwarded-for (the caller's address; personal data, restricted table)
  app_name        text,                          -- the database session's application_name (the SQL editor and poolers set their own)
  txid            bigint,                        -- transaction id: every row written by one DELETE statement shares it (a bulk delete = one txid, many rows)
  statement_head  text,                          -- first 300 characters of the statement that fired the trigger (the gateway sends parameters separately, so values are not in it)
  prev_hash       text,                          -- hash of the previous row (a chain: an edited or removed row breaks every hash after it)
  row_hash        text
);

alter table public.vault_item_deletions enable row level security;   -- no policies: nobody but the owner and the service key can read it
revoke all on public.vault_item_deletions from public, anon, authenticated;

-- append-only against everything except the table owner (who can always drop a trigger: see the limits in the write-up)
create or replace function public.tg_vault_item_deletions_append_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'vault_item_deletions is append-only';
end $$;
drop trigger if exists trg_vault_item_deletions_no_edit on public.vault_item_deletions;
create trigger trg_vault_item_deletions_no_edit
  before update or delete on public.vault_item_deletions
  for each row execute function public.tg_vault_item_deletions_append_only();
drop trigger if exists trg_vault_item_deletions_no_truncate on public.vault_item_deletions;
create trigger trg_vault_item_deletions_no_truncate
  before truncate on public.vault_item_deletions
  for each statement execute function public.tg_vault_item_deletions_append_only();

-- one function writes the row (so the chain is always built the same way)
create or replace function public.write_vault_deletion_note(
  p_item_id text, p_item_code text, p_profile_id text, p_created bigint, p_status text, p_title text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev text; v_hash text; v_id bigint; v_at timestamptz := clock_timestamp();
  v_method text := nullif(current_setting('request.method', true), '');
  v_path text := nullif(current_setting('request.path', true), '');
  v_ua text := null; v_origin text := null; v_client text := null; v_ip text := null; v_hdr jsonb := null;
  v_uid uuid := null; v_role text := null; v_note text;
begin
  begin v_uid := auth.uid(); exception when others then v_uid := null; end;
  begin v_role := nullif(auth.role(), ''); exception when others then v_role := null; end;
  begin v_hdr := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then v_hdr := null; end;
  v_ua := left(v_hdr ->> 'user-agent', 200);
  v_origin := left(v_hdr ->> 'origin', 120);
  v_client := left(v_hdr ->> 'x-client-info', 80);
  v_ip := left(split_part(coalesce(v_hdr ->> 'x-forwarded-for', v_hdr ->> 'cf-connecting-ip', ''), ',', 1), 64);
  perform pg_advisory_xact_lock(710118);                       -- one writer at a time so the chain order is unambiguous
  select row_hash into v_prev from public.vault_item_deletions order by id desc limit 1;
  insert into public.vault_item_deletions (deleted_at, item_id, item_code, profile_id, item_created_at, item_status, title_start, actor_user_id, actor_role, via, request_method, request_path, user_agent, request_origin, client_info, client_ip, app_name, txid, statement_head, prev_hash)
  values (v_at, p_item_id, p_item_code, p_profile_id, p_created, p_status, left(p_title, 60), v_uid, v_role, case when v_method is not null then 'api' else 'direct' end, v_method, v_path, v_ua, nullif(v_origin, ''), nullif(v_client, ''), nullif(v_ip, ''), nullif(current_setting('application_name', true), ''), txid_current(), left(current_query(), 300), v_prev)
  returning id into v_id;
  v_note := concat_ws('|', v_id, extract(epoch from v_at), p_item_id, coalesce(p_item_code, ''), coalesce(p_profile_id, ''), coalesce(v_uid::text, ''), coalesce(v_role, ''), coalesce(nullif(v_origin, ''), ''), coalesce(nullif(v_ip, ''), ''), txid_current(), coalesce(v_prev, ''));
  v_hash := encode(sha256(convert_to(v_note, 'UTF8')), 'hex');
  -- the chain value is written by the owner-level function, bypassing the append-only trigger once, for the row just inserted
  perform set_config('vltd.audit_seal', '1', true);
  update public.vault_item_deletions set row_hash = v_hash where id = v_id;
  perform set_config('vltd.audit_seal', '', true);
end $$;
revoke all on function public.write_vault_deletion_note(text, text, text, bigint, text, text) from public, anon, authenticated;

-- the append-only trigger lets the sealing update through (only while the function above has set the flag in the same transaction)
create or replace function public.tg_vault_item_deletions_append_only()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and current_setting('vltd.audit_seal', true) = '1' and old.row_hash is null and new.row_hash is not null
     and new.id = old.id and new.item_id = old.item_id then
    return new;
  end if;
  raise exception 'vault_item_deletions is append-only';
end $$;

create or replace function public.tg_vault_items_audit_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_vault_deletion_note(old.id::text, old.item_code, old.profile_id::text, old.created_at::bigint, old.status::text, old.title::text);
  return old;
end $$;
drop trigger if exists trg_vault_items_audit_delete on public.vault_items;
create trigger trg_vault_items_audit_delete
  after delete on public.vault_items
  for each row execute function public.tg_vault_items_audit_delete();

create or replace function public.tg_vault_items_audit_truncate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_vault_deletion_note('*TRUNCATE*', null, null, null, null, null);
  return null;
end $$;
drop trigger if exists trg_vault_items_audit_truncate on public.vault_items;
create trigger trg_vault_items_audit_truncate
  before truncate on public.vault_items
  for each statement execute function public.tg_vault_items_audit_truncate();

-- read-only check of the chain (service key / owner only): returns the first row whose stored hash does not match its content, or nothing
create or replace function public.vault_deletion_chain_first_break()
returns bigint language plpgsql stable security definer set search_path = public as $$
declare r record; v_prev text := null; v_expect text;
begin
  for r in select * from public.vault_item_deletions order by id loop
    if r.prev_hash is distinct from v_prev then return r.id; end if;
    v_expect := encode(sha256(convert_to(concat_ws('|', r.id, extract(epoch from r.deleted_at), r.item_id, coalesce(r.item_code, ''), coalesce(r.profile_id, ''), coalesce(r.actor_user_id::text, ''), coalesce(r.actor_role, ''), coalesce(r.request_origin, ''), coalesce(r.client_ip, ''), r.txid, coalesce(r.prev_hash, '')), 'UTF8')), 'hex');
    if r.row_hash is distinct from v_expect then return r.id; end if;
    v_prev := r.row_hash;
  end loop;
  return null;
end $$;
revoke all on function public.vault_deletion_chain_first_break() from public, anon, authenticated;

-- the newest chain value: copy it somewhere OUTSIDE the database now and then (a note, an e-mail to yourself). If the table is ever rewritten as a whole,
-- the copy no longer matches. (service key / owner only)
create or replace function public.vault_deletion_chain_head()
returns table (last_id bigint, last_hash text, last_at timestamptz, notes bigint) language sql stable security definer set search_path = public as $$
  select (select id from public.vault_item_deletions order by id desc limit 1),
         (select row_hash from public.vault_item_deletions order by id desc limit 1),
         (select deleted_at from public.vault_item_deletions order by id desc limit 1),
         (select count(*) from public.vault_item_deletions);
$$;
revoke all on function public.vault_deletion_chain_head() from public, anon, authenticated;

-- one line per DELETE statement: how many items, by whom, from where. This is the view to read after a count drops.
create or replace view public.vault_item_deletion_statements with (security_invoker = true) as
  select txid, min(deleted_at) as first_at, max(deleted_at) as last_at, count(*) as items, min(profile_id) as profile_id, min(actor_user_id::text) as actor_user_id,
         min(actor_role) as actor_role, min(via) as via, min(request_origin) as origin, min(client_info) as client_info, min(client_ip) as client_ip,
         min(db_user) as db_user, min(app_name) as app_name, min(statement_head) as statement_head
  from public.vault_item_deletions group by txid;
revoke all on public.vault_item_deletion_statements from public, anon, authenticated;

commit;
