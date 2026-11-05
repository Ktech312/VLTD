-- Read-only checks for 20261105_vault_item_moves_owner_only.sql. Changes nothing.
-- Run in the Supabase SQL editor after the migration. Every row should say PASS (the last row should be 0).

select 'helper function exists' as check_name,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'is_profile_owner_text') then 'PASS' else 'FAIL' end as result
union all
select 'guard function exists',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'guard_vault_item_profile_change') then 'PASS' else 'FAIL' end
union all
select 'trigger is on vault_items',
       case when exists (select 1 from pg_trigger t where t.tgrelid = 'public.vault_items'::regclass and t.tgname = 'trg_guard_vault_item_profile_change' and not t.tgisinternal) then 'PASS' else 'FAIL' end
union all
select 'anon cannot execute the owner helper',
       case when has_function_privilege('anon', 'public.is_profile_owner_text(text)', 'execute') then 'FAIL' else 'PASS' end
union all
select 'authenticated can execute the owner helper',
       case when has_function_privilege('authenticated', 'public.is_profile_owner_text(text)', 'execute') then 'PASS' else 'FAIL' end
union all
-- Every profile that has items should have an owner row, otherwise its real owner could not move items between their own profiles. Should be 0.
select 'profiles with items but NO owner membership row (should be 0)',
       (select count(*)::text from (select distinct i.profile_id from public.vault_items i
          where i.profile_id ~ '^[0-9a-fA-F-]{36}$'
            and not exists (select 1 from public.profile_members m where m.profile_id = i.profile_id::uuid and m.role = 'owner')) x);
