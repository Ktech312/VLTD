-- Clear all favorites (EK asked for a clean slate on 2026-10-10).
-- Step 1 saves a private copy of every favorite so nothing is lost; step 2 clears the live table.
-- Safe to run more than once: the backup is only made the first time.

do $$
begin
  if to_regclass('public.public_favorites_backup_20261010') is null then
    create table public.public_favorites_backup_20261010 as
      select * from public.public_favorites;
    -- No policies on purpose: with row security on and no policies, only the database owner can read it.
    alter table public.public_favorites_backup_20261010 enable row level security;
    raise notice 'Backup made: % rows', (select count(*) from public.public_favorites_backup_20261010);
  else
    raise notice 'Backup already exists, not touched.';
  end if;
end $$;

delete from public.public_favorites;

-- To put them back later (only if needed):
--   insert into public.public_favorites select * from public.public_favorites_backup_20261010;
