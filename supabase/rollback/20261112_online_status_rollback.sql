-- Rollback for 20261112_online_status_off_by_default.sql: removes the lookup function and the switch column. People's on/off choices are lost (they all return to the old behaviour, where the app
-- read last_seen_at directly). Safe to run more than once. Changes no other data.
begin;
drop function if exists public.get_public_online_status(uuid);
alter table public.profiles drop column if exists show_online_status;
commit;
